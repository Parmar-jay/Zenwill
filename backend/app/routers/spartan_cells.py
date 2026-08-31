from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from app.models.user import User
from app.models.spartan_cell import SpartanCell
from app.models.community_message import CommunityMessage
from app.middleware.auth_middleware import get_current_user
from app.services.spartan_cell_service import (
    generate_cell_join_code,
    recalculate_cell_stats,
    get_rank_badge_for_streak,
    get_user_safely,
)

router = APIRouter(prefix="/spartan-cells", tags=["Spartan Cells"])


class CreateCellRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=40)
    motto: Optional[str] = "We hold the line together."
    is_public: Optional[bool] = True


class JoinCellRequest(BaseModel):
    join_code: str = Field(..., min_length=4, max_length=15)


class NudgeMemberRequest(BaseModel):
    target_user_id: str
    target_user_name: str


class SpartanCellSummary(BaseModel):
    id: str
    name: str
    motto: str
    join_code: str
    leader_id: str
    leader_name: str
    member_count: int
    max_members: int
    total_streak: int
    collective_xp: int
    shield_status: str  # "gold" | "active" | "cracked"
    is_public: bool
    created_at: datetime
    members: List[Dict[str, Any]] = []


@router.post("/create", response_model=SpartanCellSummary)
async def create_spartan_cell(
    payload: CreateCellRequest,
    current_user: User = Depends(get_current_user),
):
    """Create a new Spartan Cell and set current user as Commander."""
    user_id_str = str(current_user.id)
    user_name = current_user.name or "Commander"
    user_streak = current_user.streak or 0

    # Check if user is already in a cell
    existing = await SpartanCell.find_one({"member_ids": user_id_str})
    if existing:
        # User is already in a cell -> return existing or prompt
        return await get_my_spartan_cell(current_user)

    # Check if name is taken
    clean_name = payload.name.strip()
    name_exists = await SpartanCell.find_one({"name": clean_name})
    if name_exists:
        raise HTTPException(status_code=400, detail="A Spartan Cell with this name already exists. Choose a unique battle name.")

    # Generate unique join code
    join_code = generate_cell_join_code()
    while await SpartanCell.find_one({"join_code": join_code}):
        join_code = generate_cell_join_code()

    rank_info = get_rank_badge_for_streak(user_streak)
    today_str = date.today().isoformat()
    has_checked_in = (current_user.last_checkin_date == today_str) or (getattr(current_user, "last_retain_date", None) == today_str)

    leader_member = {
        "user_id": user_id_str,
        "name": user_name,
        "streak": user_streak,
        "rank_tier": rank_info["rank_tier"],
        "badge": rank_info["badge"],
        "last_checkin_date": current_user.last_checkin_date,
        "today_checked_in": has_checked_in,
        "is_leader": True,
        "is_online": True,
        "joined_at": datetime.utcnow().isoformat(),
    }

    cell = SpartanCell(
        name=clean_name,
        motto=payload.motto or "We hold the line together.",
        join_code=join_code,
        leader_id=user_id_str,
        leader_name=user_name,
        member_ids=[user_id_str],
        members=[leader_member],
        total_streak=user_streak,
        collective_xp=current_user.total_points or 100,
        shield_status="gold" if has_checked_in else "active",
        is_public=payload.is_public if payload.is_public is not None else True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    await cell.insert()

    return SpartanCellSummary(
        id=str(cell.id),
        name=cell.name,
        motto=cell.motto,
        join_code=cell.join_code,
        leader_id=cell.leader_id,
        leader_name=cell.leader_name,
        member_count=len(cell.member_ids),
        max_members=cell.max_members,
        total_streak=cell.total_streak,
        collective_xp=cell.collective_xp,
        shield_status=cell.shield_status,
        is_public=cell.is_public,
        created_at=cell.created_at,
        members=cell.members,
    )


@router.post("/join", response_model=SpartanCellSummary)
async def join_spartan_cell(
    payload: JoinCellRequest,
    current_user: User = Depends(get_current_user),
):
    """Join an existing Spartan Cell via unique 6-character code."""
    user_id_str = str(current_user.id)
    clean_code = payload.join_code.strip().upper()

    cell = await SpartanCell.find_one({"$or": [{"join_code": clean_code}, {"join_code": f"SP-{clean_code}"}, {"id": clean_code}]})
    if not cell:
        raise HTTPException(status_code=404, detail="Invalid Cell Code. Please check the code and try again.")

    if user_id_str in cell.member_ids:
        # Already member
        return await recalculate_cell_stats(cell)

    if len(cell.member_ids) >= cell.max_members:
        raise HTTPException(status_code=400, detail="This Spartan Cell has reached its maximum capacity of 20 warriors.")

    # Remove user from any prior cell
    prior_cells = await SpartanCell.find({"member_ids": user_id_str}).to_list()
    for pc in prior_cells:
        pc.member_ids = [m for m in pc.member_ids if m != user_id_str]
        await recalculate_cell_stats(pc)

    cell.member_ids.append(user_id_str)
    updated_cell = await recalculate_cell_stats(cell)

    return SpartanCellSummary(
        id=str(updated_cell.id),
        name=updated_cell.name,
        motto=updated_cell.motto,
        join_code=updated_cell.join_code,
        leader_id=updated_cell.leader_id,
        leader_name=updated_cell.leader_name,
        member_count=len(updated_cell.member_ids),
        max_members=updated_cell.max_members,
        total_streak=updated_cell.total_streak,
        collective_xp=updated_cell.collective_xp,
        shield_status=updated_cell.shield_status,
        is_public=updated_cell.is_public,
        created_at=updated_cell.created_at,
        members=updated_cell.members,
    )


@router.get("/my-cell", response_model=Optional[SpartanCellSummary])
async def get_my_spartan_cell(
    current_user: User = Depends(get_current_user),
):
    """Retrieve current authenticated user's Spartan Cell with live recalculated stats."""
    user_id_str = str(current_user.id)
    cell = await SpartanCell.find_one({"member_ids": user_id_str})
    if not cell:
        return None

    updated_cell = await recalculate_cell_stats(cell)

    return SpartanCellSummary(
        id=str(updated_cell.id),
        name=updated_cell.name,
        motto=updated_cell.motto,
        join_code=updated_cell.join_code,
        leader_id=updated_cell.leader_id,
        leader_name=updated_cell.leader_name,
        member_count=len(updated_cell.member_ids),
        max_members=updated_cell.max_members,
        total_streak=updated_cell.total_streak,
        collective_xp=updated_cell.collective_xp,
        shield_status=updated_cell.shield_status,
        is_public=updated_cell.is_public,
        created_at=updated_cell.created_at,
        members=updated_cell.members,
    )


@router.post("/leave")
async def leave_spartan_cell(
    current_user: User = Depends(get_current_user),
):
    """Leave current Spartan Cell. If leader, transfers leadership to highest streak warrior or dissolves empty cell."""
    user_id_str = str(current_user.id)
    cell = await SpartanCell.find_one({"member_ids": user_id_str})
    if not cell:
        return {"status": "success", "message": "Not in any cell"}

    cell.member_ids = [m for m in cell.member_ids if m != user_id_str]

    if not cell.member_ids:
        await cell.delete()
        return {"status": "success", "message": "Spartan Cell disbanded as last warrior departed."}

    # If leader left, promote next member
    if cell.leader_id == user_id_str:
        next_leader_id = cell.member_ids[0]
        next_leader = await get_user_safely(next_leader_id)
        cell.leader_id = next_leader_id
        cell.leader_name = next_leader.name if next_leader else "Commander"

    await recalculate_cell_stats(cell)
    return {"status": "success", "message": "Successfully departed Spartan Cell."}


@router.get("/leaderboard", response_model=List[SpartanCellSummary])
async def get_cell_leaderboard(
    limit: int = 50,
):
    """Retrieve global Spartan Cell rankings sorted by total streak and collective XP."""
    cells = await SpartanCell.find_all().sort("-total_streak", "-collective_xp").limit(limit).to_list()
    
    # Recalculate top 10 on the fly for 100% accurate live streaks
    results = []
    for c in cells:
        await recalculate_cell_stats(c)
        results.append(
            SpartanCellSummary(
                id=str(c.id),
                name=c.name,
                motto=c.motto,
                join_code=c.join_code,
                leader_id=c.leader_id,
                leader_name=c.leader_name,
                member_count=len(c.member_ids),
                max_members=c.max_members,
                total_streak=c.total_streak,
                collective_xp=c.collective_xp,
                shield_status=c.shield_status,
                is_public=c.is_public,
                created_at=c.created_at,
                members=c.members,
            )
        )

    # Re-sort after recalculating
    results.sort(key=lambda x: (-x.total_streak, -x.collective_xp))
    return results


@router.post("/nudge")
async def nudge_cell_member(
    payload: NudgeMemberRequest,
    current_user: User = Depends(get_current_user),
):
    """Sends a brotherhood accountability nudge to a cell member whose shield is cracked."""
    sender_name = current_user.name or "Brother Warrior"
    target_name = payload.target_user_name

    # Post an encouragement alert to community messages
    msg = CommunityMessage(
        user_id="spartan_system",
        author_name="⚔️ Spartan Cell Shield",
        author_rank="Gold Shield",
        author_badge="🛡️",
        author_streak=0,
        content=f"⚔️ {sender_name} just nudged Brother {target_name}: 'Hold the line today, Brother! The Cell Shield needs your check-in.'",
        created_at=datetime.utcnow(),
    )
    await msg.insert()

    return {
        "status": "success",
        "message": f"Brotherhood nudge sent to {target_name}. The line holds strong!",
    }


@router.get("/public-cells", response_model=List[SpartanCellSummary])
async def get_public_cells(limit: int = 20):
    """Retrieve open public Spartan Cells looking for warriors."""
    cells = await SpartanCell.find(SpartanCell.is_public == True).sort("-total_streak").limit(limit).to_list()
    return [
        SpartanCellSummary(
            id=str(c.id),
            name=c.name,
            motto=c.motto,
            join_code=c.join_code,
            leader_id=c.leader_id,
            leader_name=c.leader_name,
            member_count=len(c.member_ids),
            max_members=c.max_members,
            total_streak=c.total_streak,
            collective_xp=c.collective_xp,
            shield_status=c.shield_status,
            is_public=c.is_public,
            created_at=c.created_at,
            members=c.members,
        )
        for c in cells
    ]
