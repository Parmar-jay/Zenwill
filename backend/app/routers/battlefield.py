from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import uuid
import time

from app.models.user import User
from app.models.battle_session import BattleSession
from app.models.community_message import CommunityMessage
from app.models.spartan_cell import SpartanCell
from app.middleware.auth_middleware import get_current_user
from app.services.spartan_cell_service import recalculate_user_cell_streak

router = APIRouter(prefix="/battlefield", tags=["Spartan Battlefield"])


class StartBattleSessionRequest(BaseModel):
    location: Optional[str] = "Global Sanctum"


class ReactBattleRequest(BaseModel):
    rune: str = Field(..., min_length=1, max_length=100)


class SendBattleMessageRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)


class BattleSessionResponse(BaseModel):
    id: str
    session_number: int = 1
    initiator_id: str
    initiator_name: str
    initiator_streak: int
    initiator_location: str
    duration_seconds: int = 900
    status: str
    participant_count: int
    participants: List[Dict[str, Any]]
    messages: List[Dict[str, Any]] = []
    reactions: List[Dict[str, Any]] = []
    started_at: datetime
    expires_at: datetime
    time_remaining_seconds: int
    is_joined: bool = False


# Constant: 15-Minute Global Battlefield Countdown (900 seconds)
EPOCH_SECONDS = 900


def get_current_epoch_info():
    """
    Computes global wall-clock 15-minute epoch cycle (runs continuously in background).
    Users entering or sending messages never alter the timer.
    Uses time.time() UTC timestamp to prevent local timezone skew.
    """
    now_ts = int(time.time())
    epoch_number = now_ts // EPOCH_SECONDS
    seconds_into_epoch = now_ts % EPOCH_SECONDS
    time_remaining = EPOCH_SECONDS - seconds_into_epoch
    epoch_start = datetime.fromtimestamp(epoch_number * EPOCH_SECONDS, tz=timezone.utc).replace(tzinfo=None)
    epoch_expires = datetime.fromtimestamp((epoch_number + 1) * EPOCH_SECONDS, tz=timezone.utc).replace(tzinfo=None)
    return epoch_number, time_remaining, epoch_start, epoch_expires


async def purge_old_battlefield_epochs(current_epoch_number: int):
    """
    Purges any expired battle sessions and old messages from previous 15-minute epochs.
    Ensures that every 15 minutes the old chat is wiped cleanly from the database.
    """
    try:
        now = datetime.utcnow()
        await BattleSession.find({
            "$or": [
                {"session_number": {"$lt": current_epoch_number}},
                {"session_number": {"$ne": current_epoch_number}},
                {"expires_at": {"$lte": now}},
            ]
        }).delete()
    except Exception as e:
        print(f"[Battlefield Purge Error]: {e}")


async def get_or_create_battle_session(current_user: User, auto_join: bool = True) -> BattleSession:
    """
    Finds or provisions the active 15-minute session anchored to the global wall-clock epoch.
    Wipes old chat history when an epoch expires and notifies all warriors.
    """
    now = datetime.utcnow()
    user_id_str = str(current_user.id)
    user_name = current_user.name or "Brother Warrior"
    user_streak = current_user.streak or 0

    epoch_number, time_remaining, epoch_start, epoch_expires = get_current_epoch_info()

    # 1. Purge previous 15-minute epoch sessions & messages from DB
    await purge_old_battlefield_epochs(epoch_number)

    # 2. Find active session for current epoch
    session = await BattleSession.find_one(
        BattleSession.session_number == epoch_number,
        BattleSession.status == "active",
    )

    initiator_participant = {
        "user_id": user_id_str,
        "name": user_name,
        "streak": user_streak,
        "badge": "🛡️",
        "joined_at": now.isoformat(),
        "last_active_at": now.isoformat(),
    }

    if not session:
        # Create fresh session for this 15-minute epoch
        participant_ids = [user_id_str] if auto_join else []
        participants = [initiator_participant] if auto_join else []
        initial_messages = []
        if auto_join:
            join_msg = {
                "id": str(uuid.uuid4()),
                "user_id": "system",
                "user_name": "⚔️ Spartan Commander",
                "user_streak": 0,
                "text": f"🛡️ {user_name} joined the Shield Wall!",
                "is_system": True,
                "created_at": now.isoformat() + "Z",
            }
            initial_messages.append(join_msg)

        session = BattleSession(
            id=str(uuid.uuid4()),
            session_number=epoch_number,
            initiator_id=user_id_str if auto_join else "system",
            initiator_name=user_name if auto_join else "Spartan Commander",
            initiator_streak=user_streak if auto_join else 0,
            initiator_location="Global Sanctum",
            duration_seconds=EPOCH_SECONDS,
            status="active",
            participant_ids=participant_ids,
            participants=participants,
            messages=initial_messages,
            reactions=[],
            honor_points_awarded=25,
            started_at=epoch_start,
            expires_at=epoch_expires,
        )
        await session.insert()

        # Broadcast session reset to all connected warriors so their screens wipe out cleanly on time
        try:
            from app.services.realtime_bus import realtime_bus
            formatted_resp = format_battle_response(session, user_id_str)
            await realtime_bus.broadcast_to_channel(
                "battlefield",
                {
                    "type": "BATTLE_SESSION_RESET",
                    "session_id": str(session.id),
                    "session_number": epoch_number,
                    "message": initial_messages[0] if initial_messages else None,
                    "data": formatted_resp.model_dump(),
                }
            )
        except Exception as broadcast_err:
            print(f"[Battlefield WS Error] Failed to broadcast session reset: {broadcast_err}")

        return session

    # Session already active: add or refresh user presence if auto_join is True
    if auto_join:
        participant_found = False
        updated_participants = []
        for p in (session.participants or []):
            if str(p.get("user_id", "")).strip().lower() == user_id_str.lower():
                participant_found = True
                p["last_active_at"] = now.isoformat()
                p["streak"] = user_streak
                p["name"] = user_name
            updated_participants.append(p)

        if not participant_found:
            updated_participants.append(initiator_participant)
            if user_id_str not in (session.participant_ids or []):
                session.participant_ids = (session.participant_ids or []) + [user_id_str]

            join_msg = {
                "id": str(uuid.uuid4()),
                "user_id": "system",
                "user_name": "⚔️ Spartan Commander",
                "user_streak": 0,
                "text": f"🛡️ {user_name} joined the Shield Wall!",
                "is_system": True,
                "created_at": now.isoformat() + "Z",
            }
            session.messages = (session.messages or []) + [join_msg]
            session.messages = session.messages[-200:]
            session.participants = updated_participants
            await session.save()

            try:
                from app.services.realtime_bus import realtime_bus
                formatted_resp = format_battle_response(session, user_id_str)
                await realtime_bus.broadcast_to_channel(
                    "battlefield",
                    {
                        "type": "WARRIOR_JOINED",
                        "session_id": str(session.id),
                        "participant": initiator_participant,
                        "message": join_msg,
                        "data": formatted_resp.model_dump(),
                    }
                )
            except Exception as broadcast_err:
                print(f"[Battlefield WS Error] Failed to broadcast join: {broadcast_err}")
        else:
            # Atomic update of last_active_at without full document overwrite
            await BattleSession.get_pymongo_collection().update_one(
                {"$or": [{"_id": str(session.id)}, {"id": str(session.id)}], "participants.user_id": user_id_str},
                {
                    "$set": {
                        "participants.$.last_active_at": now.isoformat(),
                        "participants.$.streak": user_streak,
                        "participants.$.name": user_name,
                    }
                }
            )

    return session


def format_battle_response(session: BattleSession, current_user_id: str) -> BattleSessionResponse:
    now = datetime.utcnow()
    time_left = max(0, int((session.expires_at - now).total_seconds()))

    participants = session.participants or []
    is_joined = current_user_id in (session.participant_ids or []) or any(
        str(p.get("user_id", "")).strip().lower() == current_user_id.lower() for p in participants
    )

    return BattleSessionResponse(
        id=str(session.id),
        session_number=getattr(session, 'session_number', 1),
        initiator_id=session.initiator_id,
        initiator_name=session.initiator_name,
        initiator_streak=session.initiator_streak,
        initiator_location=session.initiator_location,
        duration_seconds=session.duration_seconds or 900,
        status=session.status,
        participant_count=len(participants),
        participants=participants,
        messages=session.messages[-100:] if hasattr(session, 'messages') and session.messages else [],
        reactions=session.reactions[-20:] if session.reactions else [],
        started_at=session.started_at,
        expires_at=session.expires_at,
        time_remaining_seconds=time_left,
        is_joined=is_joined,
    )


@router.get("/active", response_model=BattleSessionResponse)
async def get_active_battle_session(
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves the current 15-minute live Spartan Battlefield urge room.
    auto_join=False: Does NOT register presence on passive reads (e.g. Home screen).
    """
    session = await get_or_create_battle_session(current_user, auto_join=False)
    return format_battle_response(session, str(current_user.id))


@router.post("/sos", response_model=BattleSessionResponse)
async def trigger_battle_horn_sos(
    payload: StartBattleSessionRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Enters or triggers the live 15-minute Battlefield session.
    """
    session = await get_or_create_battle_session(current_user)
    return format_battle_response(session, str(current_user.id))


@router.post("/join", response_model=BattleSessionResponse)
@router.post("/join/{session_id}", response_model=BattleSessionResponse)
async def join_battle_session(
    session_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """Join an active battle session and register as an active warrior immediately."""
    session = await get_or_create_battle_session(current_user, auto_join=True)
    return format_battle_response(session, str(current_user.id))


@router.post("/message", response_model=BattleSessionResponse)
async def send_battle_message(
    payload: SendBattleMessageRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Send a real-time message to all active brothers in the current 15-minute battlefield session.
    Stores the message in MongoDB first, broadcasts to all clients, and returns the confirmed session state.
    """
    now = datetime.utcnow()
    user_id_str = str(current_user.id)
    user_name = current_user.name or "Brother Warrior"
    user_streak = current_user.streak or 0

    epoch_number, _, _, _ = get_current_epoch_info()
    await purge_old_battlefield_epochs(epoch_number)

    session = await BattleSession.find_one(
        BattleSession.session_number == epoch_number,
        BattleSession.status == "active",
    )
    if not session:
        session = await get_or_create_battle_session(current_user)
    session_id = str(session.id)

    now_iso = now.isoformat() + "Z"
    msg = {
        "id": str(uuid.uuid4()),
        "user_id": user_id_str,
        "user_name": user_name,
        "user_streak": user_streak,
        "text": payload.text.strip(),
        "is_system": False,
        "created_at": now_iso,
    }

    participant_entry = {
        "user_id": user_id_str,
        "name": user_name,
        "streak": user_streak,
        "badge": "🛡️",
        "joined_at": now_iso,
        "last_active_at": now_iso,
    }

    coll = BattleSession.get_pymongo_collection()

    # 1. Store message in MongoDB atomically
    res = await coll.update_one(
        {"_id": session_id, "participants.user_id": user_id_str},
        {
            "$push": {
                "messages": {"$each": [msg], "$slice": -200},
            },
            "$set": {
                "participants.$.last_active_at": now_iso,
                "participants.$.streak": user_streak,
                "participants.$.name": user_name,
            },
            "$addToSet": {
                "participant_ids": user_id_str,
            },
        },
    )

    if res.matched_count == 0:
        await coll.update_one(
            {"_id": session_id},
            {
                "$push": {
                    "messages": {"$each": [msg], "$slice": -200},
                    "participants": participant_entry,
                },
                "$addToSet": {
                    "participant_ids": user_id_str,
                },
            },
        )

    # 2. Broadcast stored message to all connected warriors in real time
    try:
        from app.services.realtime_bus import realtime_bus
        await realtime_bus.broadcast_to_channel(
            "battlefield",
            {
                "type": "BATTLE_MESSAGE_RECEIVED",
                "session_id": session_id,
                "session_number": epoch_number,
                "message": msg,
            }
        )
    except Exception as broadcast_err:
        print(f"[Battlefield WS Error] Failed to broadcast message: {broadcast_err}")

    # 3. Retrieve confirmed session directly from database
    updated_session = await BattleSession.get(session_id) or await BattleSession.find_one(BattleSession.id == session_id)
    if not updated_session:
        session.messages = (session.messages or []) + [msg]
        updated_session = session
    elif not any(m.get("id") == msg["id"] for m in (updated_session.messages or [])):
        updated_session.messages = (updated_session.messages or []) + [msg]

    return format_battle_response(updated_session, user_id_str)


@router.post("/heartbeat", response_model=BattleSessionResponse)
async def battle_heartbeat(
    current_user: User = Depends(get_current_user),
):
    """
    Lightweight heartbeat endpoint called to refresh active warrior presence and retrieve latest session state.
    Uses targeted atomic Mongo update to prevent document write contention.
    """
    now = datetime.utcnow()
    user_id_str = str(current_user.id)
    epoch_number, _, _, _ = get_current_epoch_info()
    await purge_old_battlefield_epochs(epoch_number)

    session = await BattleSession.find_one(
        BattleSession.session_number == epoch_number,
        BattleSession.status == "active",
    )
    if not session:
        session = await get_or_create_battle_session(current_user, auto_join=True)
        return format_battle_response(session, user_id_str)

    coll = BattleSession.get_pymongo_collection()
    session_id = str(session.id)
    await coll.update_one(
        {"_id": session_id, "participants.user_id": user_id_str},
        {"$set": {"participants.$.last_active_at": now.isoformat()}}
    )
    for p in (session.participants or []):
        if p.get("user_id") == user_id_str:
            p["last_active_at"] = now.isoformat()
            break

    return format_battle_response(session, user_id_str)


@router.post("/react/{session_id}", response_model=BattleSessionResponse)
async def send_battle_reaction_rune(
    session_id: str,
    payload: ReactBattleRequest,
    current_user: User = Depends(get_current_user),
):
    """Send a live 1-tap reaction rune / quick transmission."""
    now = datetime.utcnow()
    now_iso = now.isoformat() + "Z"
    user_id_str = str(current_user.id)
    user_name = current_user.name or "Brother Warrior"
    user_streak = current_user.streak or 0
    epoch_number, _, _, _ = get_current_epoch_info()

    rune_entry = {
        "user_id": user_id_str,
        "user_name": user_name,
        "rune": payload.rune,
        "created_at": now_iso,
    }

    msg = {
        "id": str(uuid.uuid4()),
        "user_id": user_id_str,
        "user_name": user_name,
        "user_streak": user_streak,
        "text": payload.rune,
        "is_system": False,
        "created_at": now_iso,
    }

    # Atomically push reaction rune and chat message in MongoDB
    coll = BattleSession.get_pymongo_collection()
    await coll.update_one(
        {"_id": session_id},
        {
            "$push": {
                "reactions": {"$each": [rune_entry], "$slice": -50},
                "messages": {"$each": [msg], "$slice": -200},
            },
            "$addToSet": {
                "participant_ids": user_id_str,
            },
        },
    )

    try:
        from app.services.realtime_bus import realtime_bus
        await realtime_bus.broadcast_to_channel(
            "battlefield",
            {
                "type": "BATTLE_MESSAGE_RECEIVED",
                "session_id": session_id,
                "session_number": epoch_number,
                "message": msg,
            }
        )
    except Exception as broadcast_err:
        print(f"[Battlefield WS Error] Failed to broadcast reaction: {broadcast_err}")

    updated_session = await BattleSession.get(session_id) or await BattleSession.find_one(BattleSession.id == session_id)
    if not updated_session:
        session = await get_or_create_battle_session(current_user)
        return format_battle_response(session, user_id_str)

    if not any(m.get("id") == msg["id"] for m in (updated_session.messages or [])):
        updated_session.messages = (updated_session.messages or []) + [msg]

    return format_battle_response(updated_session, user_id_str)



@router.post("/new-session", response_model=BattleSessionResponse)
async def start_new_battlefield_session(
    current_user: User = Depends(get_current_user),
):
    """
    Explicitly wipes the current expired session along with its chat and initializes a fresh 15-minute session.
    """
    now = datetime.utcnow()
    # Delete all previous sessions and their chat
    all_sessions = await BattleSession.find().to_list()
    max_num = 0
    for s in all_sessions:
        if hasattr(s, 'session_number') and s.session_number and s.session_number > max_num:
            max_num = s.session_number
        try:
            await s.delete()
        except Exception:
            pass

    next_num = max_num + 1
    duration = 900
    user_id_str = str(current_user.id)
    user_name = current_user.name or "Brother Warrior"
    user_streak = current_user.streak or 0

    session = BattleSession(
        id=str(uuid.uuid4()),
        session_number=next_num,
        initiator_id=user_id_str,
        initiator_name=user_name,
        initiator_streak=user_streak,
        initiator_location="Global Sanctum",
        duration_seconds=duration,
        status="active",
        participant_ids=[user_id_str],
        participants=[{
            "user_id": user_id_str,
            "name": user_name,
            "streak": user_streak,
            "badge": "🛡️",
            "joined_at": now.isoformat(),
            "last_active_at": now.isoformat(),
        }],
        messages=[{
            "id": str(uuid.uuid4()),
            "user_id": "system",
            "user_name": "⚔️ Spartan Commander",
            "user_streak": 0,
            "text": f"🛡️ TACTICAL BATTLEFIELD SESSION #{next_num} INITIATED: Fresh 15-Minute Transmission Window Active!",
            "is_system": True,
            "created_at": now.isoformat(),
        }],
        reactions=[],
        honor_points_awarded=25,
        started_at=now,
        expires_at=now + timedelta(seconds=duration),
    )
    await session.insert()
    return format_battle_response(session, user_id_str)


@router.post("/complete/{session_id}")
async def complete_battle_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    """Concludes the battlefield rescue room with victory and awards honor."""
    now = datetime.utcnow()
    session = await BattleSession.get(session_id) or await BattleSession.find_one(BattleSession.id == session_id)
    if not session:
        return {"status": "success", "message": "Battle session concluded"}

    session.status = "completed"
    session.completed_at = now
    await session.save()

    # Award honor XP
    current_user.total_points = (current_user.total_points or 0) + 25
    await current_user.save()

    # Recalculate Spartan Cell Cohort Honor in real time
    try:
        from app.services.spartan_cell_service import recalculate_user_cell_streak
        await recalculate_user_cell_streak(str(current_user.id))
    except Exception:
        pass

    return {
        "status": "success",
        "message": "Battlefield session completed with victory. The line holds!",
        "participants_count": len(session.participant_ids),
        "honor_awarded": 25,
        "xp_awarded": 25,
    }


@router.post("/leave")
async def leave_battle_session(
    current_user: User = Depends(get_current_user),
):
    """
    Removes the user from active participants list when they leave the battlefield
    (either by pressing Back or tapping Done).
    """
    now = datetime.utcnow()
    user_id_str = str(current_user.id).strip().lower()
    raw_user_id = str(current_user.id)
    display_user_name = current_user.name or "Brother Warrior"
    user_name_lower = display_user_name.strip().lower()

    sessions = await BattleSession.find(
        BattleSession.status == "active",
    ).to_list()

    for session in sessions:
        was_present = any(
            str(p.get("user_id", "")).strip().lower() == user_id_str
            for p in (session.participants or [])
        )
        if was_present:
            session.participant_ids = [
                pid for pid in (session.participant_ids or [])
                if str(pid).strip().lower() != user_id_str
            ]
            session.participants = [
                p for p in (session.participants or [])
                if str(p.get("user_id", "")).strip().lower() != user_id_str
            ]
            leave_msg = {
                "id": str(uuid.uuid4()),
                "user_id": "system",
                "user_name": "⚔️ Spartan Commander",
                "user_streak": 0,
                "text": f"⚔️ {display_user_name} stepped back from the front line.",
                "is_system": True,
                "created_at": now.isoformat() + "Z",
            }
            session.messages = (session.messages or []) + [leave_msg]
            session.messages = session.messages[-200:]
            await session.save()

            try:
                from app.services.realtime_bus import realtime_bus
                formatted_resp = format_battle_response(session, raw_user_id)
                await realtime_bus.broadcast_to_channel(
                    "battlefield",
                    {
                        "type": "WARRIOR_LEFT",
                        "session_id": str(session.id),
                        "user_id": raw_user_id,
                        "user_name": display_user_name,
                        "message": leave_msg,
                        "data": formatted_resp.model_dump(),
                    }
                )
            except Exception as broadcast_err:
                print(f"[Battlefield WS Error] Failed to broadcast leave: {broadcast_err}")

    return {"status": "success", "message": "Left battlefield"}

