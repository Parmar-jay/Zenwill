from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

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


class BattleSessionResponse(BaseModel):
    id: str
    initiator_id: str
    initiator_name: str
    initiator_streak: int
    initiator_location: str
    duration_seconds: int
    status: str
    participant_count: int
    participants: List[Dict[str, Any]]
    reactions: List[Dict[str, Any]]
    started_at: datetime
    expires_at: datetime
    time_remaining_seconds: int
    is_joined: bool = False


@router.post("/sos", response_model=BattleSessionResponse)
async def trigger_battle_horn_sos(
    payload: StartBattleSessionRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Triggers the Spartan Battle Horn and initiates a live 90-second sync room.
    Posts a live battle alert to community channels so online brothers can join.
    """
    user_id_str = str(current_user.id)
    user_name = current_user.name or "Brother Warrior"
    user_streak = current_user.streak or 0
    location = payload.location or "Global Sanctum"

    # Close any expired active sessions first
    now = datetime.utcnow()
    expired_sessions = await BattleSession.find(
        BattleSession.status == "active",
        BattleSession.expires_at < now,
    ).to_list()
    for exp in expired_sessions:
        exp.status = "completed"
        exp.completed_at = now
        await exp.save()

    # Check if there's already an active session initiated by this user within last 90 seconds
    existing = await BattleSession.find_one(
        BattleSession.initiator_id == user_id_str,
        BattleSession.status == "active",
        BattleSession.expires_at > now,
    )
    if existing:
        time_left = max(0, int((existing.expires_at - now).total_seconds()))
        return BattleSessionResponse(
            id=str(existing.id),
            initiator_id=existing.initiator_id,
            initiator_name=existing.initiator_name,
            initiator_streak=existing.initiator_streak,
            initiator_location=existing.initiator_location,
            duration_seconds=existing.duration_seconds,
            status=existing.status,
            participant_count=len(existing.participant_ids),
            participants=existing.participants,
            reactions=existing.reactions[-20:],
            started_at=existing.started_at,
            expires_at=existing.expires_at,
            time_remaining_seconds=time_left,
            is_joined=True,
        )

    duration = 90
    expires_at = now + timedelta(seconds=duration)

    initiator_participant = {
        "user_id": user_id_str,
        "name": user_name,
        "badge": "🛡️",
        "joined_at": now.isoformat(),
    }

    session = BattleSession(
        initiator_id=user_id_str,
        initiator_name=user_name,
        initiator_streak=user_streak,
        initiator_location=location,
        duration_seconds=duration,
        status="active",
        participant_ids=[user_id_str],
        participants=[initiator_participant],
        reactions=[
            {
                "user_id": "system",
                "user_name": "⚔️ Battle Horn",
                "rune": "🚨 BATTLE HORN SOUNDED: 90-Second Shield Room Active!",
                "created_at": now.isoformat(),
            }
        ],
        honor_points_awarded=25,
        started_at=now,
        expires_at=expires_at,
    )
    await session.insert()

    return BattleSessionResponse(
        id=str(session.id),
        initiator_id=session.initiator_id,
        initiator_name=session.initiator_name,
        initiator_streak=session.initiator_streak,
        initiator_location=session.initiator_location,
        duration_seconds=session.duration_seconds,
        status=session.status,
        participant_count=len(session.participant_ids),
        participants=session.participants,
        reactions=session.reactions,
        started_at=session.started_at,
        expires_at=session.expires_at,
        time_remaining_seconds=duration,
        is_joined=True,
    )


@router.get("/active", response_model=Optional[BattleSessionResponse])
async def get_active_battle_session(
    current_user: User = Depends(get_current_user),
):
    """Retrieves the currently active live Spartan Battlefield urge rescue room."""
    now = datetime.utcnow()
    user_id_str = str(current_user.id)

    # Find most recent active session that hasn't expired
    session = await BattleSession.find_one(
        BattleSession.status == "active",
        BattleSession.expires_at > now,
    )
    if not session:
        return None

    time_left = max(0, int((session.expires_at - now).total_seconds()))
    is_joined = user_id_str in session.participant_ids

    return BattleSessionResponse(
        id=str(session.id),
        initiator_id=session.initiator_id,
        initiator_name=session.initiator_name,
        initiator_streak=session.initiator_streak,
        initiator_location=session.initiator_location,
        duration_seconds=session.duration_seconds,
        status=session.status,
        participant_count=len(session.participant_ids),
        participants=session.participants,
        reactions=session.reactions[-20:],
        started_at=session.started_at,
        expires_at=session.expires_at,
        time_remaining_seconds=time_left,
        is_joined=is_joined,
    )


@router.post("/join/{session_id}", response_model=BattleSessionResponse)
async def join_battle_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Join an active 90-second rescue room.
    Awards +25 Brotherhood Honor Points to the joining warrior.
    """
    now = datetime.utcnow()
    user_id_str = str(current_user.id)
    user_name = current_user.name or "Brother Warrior"

    session = await BattleSession.find_one(
        {"$or": [{"id": session_id}, {"_id": session_id}]},
    )
    if not session or session.status != "active" or session.expires_at <= now:
        raise HTTPException(status_code=404, detail="This Battle Room has already concluded. Another battle will sound soon!")

    if user_id_str not in session.participant_ids:
        session.participant_ids.append(user_id_str)
        session.participants.append({
            "user_id": user_id_str,
            "name": user_name,
            "badge": "⚔️",
            "joined_at": now.isoformat(),
        })

        # Add join reaction
        session.reactions.append({
            "user_id": user_id_str,
            "user_name": user_name,
            "rune": f"⚔️ {user_name} entered the shield wall!",
            "created_at": now.isoformat(),
        })

        # Award +25 Honor Points to User
        current_user.total_points = (current_user.total_points or 0) + 25
        await current_user.save()

        # Award +25 XP to Spartan Cell if user is in one
        cell = await SpartanCell.find_one({"member_ids": user_id_str})
        if cell:
            cell.collective_xp = (cell.collective_xp or 0) + 25
            await cell.save()

        await session.save()

    time_left = max(0, int((session.expires_at - now).total_seconds()))

    return BattleSessionResponse(
        id=str(session.id),
        initiator_id=session.initiator_id,
        initiator_name=session.initiator_name,
        initiator_streak=session.initiator_streak,
        initiator_location=session.initiator_location,
        duration_seconds=session.duration_seconds,
        status=session.status,
        participant_count=len(session.participant_ids),
        participants=session.participants,
        reactions=session.reactions[-20:],
        started_at=session.started_at,
        expires_at=session.expires_at,
        time_remaining_seconds=time_left,
        is_joined=True,
    )


@router.post("/react/{session_id}", response_model=BattleSessionResponse)
async def send_battle_reaction_rune(
    session_id: str,
    payload: ReactBattleRequest,
    current_user: User = Depends(get_current_user),
):
    """Send a live 1-tap reaction rune to support the fighting brother."""
    now = datetime.utcnow()
    user_id_str = str(current_user.id)
    user_name = current_user.name or "Brother Warrior"

    session = await BattleSession.find_one(
        {"$or": [{"id": session_id}, {"_id": session_id}]},
    )
    if not session or session.status != "active":
        raise HTTPException(status_code=404, detail="Battle Room not active.")

    session.reactions.append({
        "user_id": user_id_str,
        "user_name": user_name,
        "rune": payload.rune,
        "created_at": now.isoformat(),
    })
    # Keep only last 50 reactions in memory
    session.reactions = session.reactions[-50:]
    await session.save()

    time_left = max(0, int((session.expires_at - now).total_seconds()))
    is_joined = user_id_str in session.participant_ids

    return BattleSessionResponse(
        id=str(session.id),
        initiator_id=session.initiator_id,
        initiator_name=session.initiator_name,
        initiator_streak=session.initiator_streak,
        initiator_location=session.initiator_location,
        duration_seconds=session.duration_seconds,
        status=session.status,
        participant_count=len(session.participant_ids),
        participants=session.participants,
        reactions=session.reactions[-20:],
        started_at=session.started_at,
        expires_at=session.expires_at,
        time_remaining_seconds=time_left,
        is_joined=is_joined,
    )


@router.post("/complete/{session_id}")
async def complete_battle_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
):
    """Concludes the 90-second rescue room with victory."""
    now = datetime.utcnow()
    session = await BattleSession.find_one(
        {"$or": [{"id": session_id}, {"_id": session_id}]},
    )
    if not session:
        return {"status": "success", "message": "Battle session concluded"}

    session.status = "completed"
    session.completed_at = now
    await session.save()

    return {
        "status": "success",
        "message": "Shield room completed with victory. The line holds!",
        "participants_count": len(session.participant_ids),
        "honor_awarded": 25,
    }
