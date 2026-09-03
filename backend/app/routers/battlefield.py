from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import uuid

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


EPOCH_SECONDS = 900  # 15 minutes


def get_current_epoch_info():
    """
    Computes global wall-clock 15-minute epoch cycle (runs continuously in background).
    Users entering or sending messages never alter the timer.
    """
    now = datetime.utcnow()
    now_ts = int(now.timestamp())
    epoch_number = now_ts // EPOCH_SECONDS
    seconds_into_epoch = now_ts % EPOCH_SECONDS
    time_remaining = EPOCH_SECONDS - seconds_into_epoch
    epoch_start = datetime.utcfromtimestamp(epoch_number * EPOCH_SECONDS)
    epoch_expires = datetime.utcfromtimestamp((epoch_number + 1) * EPOCH_SECONDS)
    return epoch_number, time_remaining, epoch_start, epoch_expires


async def purge_old_battlefield_epochs(current_epoch_number: int):
    """
    Purges any expired battle sessions and old messages from previous 15-minute epochs.
    Ensures that every 15 minutes the old chat is wiped cleanly from the database.
    """
    try:
        await BattleSession.find({
            "$or": [
                {"session_number": {"$ne": current_epoch_number}},
                {"expires_at": {"$lte": datetime.utcnow()}},
            ]
        }).delete()
    except Exception as e:
        print(f"[Battlefield Purge Error]: {e}")


async def get_or_create_battle_session(current_user: User, auto_join: bool = True) -> BattleSession:
    """
    Finds or provisions the active 15-minute session anchored to the global wall-clock epoch.
    Wipes old chat history when an epoch expires.
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
            messages=[],
            reactions=[],
            honor_points_awarded=25,
            started_at=epoch_start,
            expires_at=epoch_expires,
        )
        await session.insert()
        return session

    # Session already active: add or refresh user presence if auto_join is True
    if auto_join:
        participant_found = False
        updated_participants = []
        for p in (session.participants or []):
            if p.get("user_id") == user_id_str or p.get("name") == user_name:
                participant_found = True
                p["last_active_at"] = now.isoformat()
                p["streak"] = user_streak
                p["name"] = user_name
            updated_participants.append(p)

        if not participant_found:
            updated_participants.append(initiator_participant)
            if user_id_str not in (session.participant_ids or []):
                session.participant_ids = (session.participant_ids or []) + [user_id_str]

        session.participants = updated_participants
        await session.save()

    return session


def format_battle_response(session: BattleSession, current_user_id: str) -> BattleSessionResponse:
    now = datetime.utcnow()
    time_left = max(0, int((session.expires_at - now).total_seconds()))

    # Filter active participants who checked in within last 75 seconds (heartbeat is every 3s)
    recent_threshold = (now - timedelta(seconds=75)).isoformat()
    active_members = []
    for p in (session.participants or []):
        last_act = p.get("last_active_at") or p.get("joined_at") or ""
        if last_act >= recent_threshold:
            active_members.append(p)

    is_joined = current_user_id in (session.participant_ids or []) or any(
        p.get("user_id") == current_user_id for p in active_members
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
        participant_count=len(active_members),
        participants=active_members,
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


@router.post("/join/{session_id}", response_model=BattleSessionResponse)
async def join_battle_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    """Join an active battle session and register as an active warrior."""
    session = await get_or_create_battle_session(current_user)
    return format_battle_response(session, str(current_user.id))


@router.post("/message", response_model=BattleSessionResponse)
async def send_battle_message(
    payload: SendBattleMessageRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Send a real-time message to all active brothers in the current 15-minute battlefield session.
    """
    now = datetime.utcnow()
    user_id_str = str(current_user.id)
    user_name = current_user.name or "Brother Warrior"
    user_streak = current_user.streak or 0

    session = await get_or_create_battle_session(current_user)

    msg = {
        "id": str(uuid.uuid4()),
        "user_id": user_id_str,
        "user_name": user_name,
        "user_streak": user_streak,
        "text": payload.text.strip(),
        "is_system": False,
        "created_at": now.isoformat(),
    }

    if not hasattr(session, 'messages') or session.messages is None:
        session.messages = []

    session.messages.append(msg)
    # Keep last 150 messages in current session
    session.messages = session.messages[-150:]

    # Update or add sender to participants
    sender_found = False
    for p in (session.participants or []):
        if p.get("user_id") == user_id_str:
            sender_found = True
            p["last_active_at"] = now.isoformat()
            p["streak"] = user_streak

    if not sender_found:
        session.participants = (session.participants or []) + [{
            "user_id": user_id_str,
            "name": user_name,
            "streak": user_streak,
            "badge": "🛡️",
            "joined_at": now.isoformat(),
            "last_active_at": now.isoformat(),
        }]
        if user_id_str not in (session.participant_ids or []):
            session.participant_ids = (session.participant_ids or []) + [user_id_str]

    await session.save()
    return format_battle_response(session, user_id_str)


@router.post("/heartbeat", response_model=BattleSessionResponse)
async def battle_heartbeat(
    current_user: User = Depends(get_current_user),
):
    """
    Lightweight heartbeat endpoint called every few seconds to refresh active warriors presence,
    retrieve incoming messages, and sync the countdown timer.
    """
    session = await get_or_create_battle_session(current_user)
    return format_battle_response(session, str(current_user.id))


@router.post("/react/{session_id}", response_model=BattleSessionResponse)
async def send_battle_reaction_rune(
    session_id: str,
    payload: ReactBattleRequest,
    current_user: User = Depends(get_current_user),
):
    """Send a live 1-tap reaction rune / quick transmission."""
    now = datetime.utcnow()
    user_id_str = str(current_user.id)
    user_name = current_user.name or "Brother Warrior"
    user_streak = current_user.streak or 0

    session = await get_or_create_battle_session(current_user)

    # Add as both reaction and chat transmission
    session.reactions.append({
        "user_id": user_id_str,
        "user_name": user_name,
        "rune": payload.rune,
        "created_at": now.isoformat(),
    })
    session.reactions = session.reactions[-50:]

    msg = {
        "id": str(uuid.uuid4()),
        "user_id": user_id_str,
        "user_name": user_name,
        "user_streak": user_streak,
        "text": payload.rune,
        "is_system": False,
        "created_at": now.isoformat(),
    }
    session.messages.append(msg)
    session.messages = session.messages[-150:]

    await session.save()
    return format_battle_response(session, user_id_str)


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
    session = await BattleSession.find_one(
        {"$or": [{"id": session_id}, {"_id": session_id}]},
    )
    if not session:
        return {"status": "success", "message": "Battle session concluded"}

    session.status = "completed"
    session.completed_at = now
    await session.save()

    # Award honor points
    current_user.total_points = (current_user.total_points or 0) + 25
    await current_user.save()

    return {
        "status": "success",
        "message": "Battlefield session completed with victory. The line holds!",
        "participants_count": len(session.participant_ids),
        "honor_awarded": 25,
    }


@router.post("/leave")
async def leave_battle_session(
    current_user: User = Depends(get_current_user),
):
    """
    Removes the user from active participants list when they leave the battlefield
    (either by pressing Back or tapping Done).
    """
    user_id_str = str(current_user.id).strip().lower()
    user_name = (current_user.name or "").strip().lower()

    sessions = await BattleSession.find(
        BattleSession.status == "active",
    ).to_list()

    for session in sessions:
        session.participant_ids = [
            pid for pid in (session.participant_ids or [])
            if str(pid).strip().lower() != user_id_str
        ]
        session.participants = [
            p for p in (session.participants or [])
            if str(p.get("user_id", "")).strip().lower() != user_id_str
            and (not user_name or str(p.get("name", "")).strip().lower() != user_name)
        ]
        await session.save()

    return {"status": "success", "message": "Left battlefield"}

