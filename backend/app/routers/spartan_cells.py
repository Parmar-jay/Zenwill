from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from app.models.user import User
from app.models.spartan_cell import SpartanCell
from app.models.community_message import CommunityMessage
from app.models.direct_message import DirectMessage
from app.middleware.auth_middleware import get_current_user
from app.services.spartan_cell_service import (
    generate_cell_join_code,
    recalculate_cell_stats,
    get_rank_badge_for_streak,
    get_user_safely,
)
from app.services.realtime_bus import realtime_bus

router = APIRouter(prefix="/spartan-cells", tags=["Spartan Cells"])


class CreateCellRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=40)
    motto: Optional[str] = "We hold the line together."
    is_public: Optional[bool] = True


class JoinCellRequest(BaseModel):
    join_code: str = Field(..., min_length=2, max_length=20)


class RequestJoinCellRequest(BaseModel):
    join_code: str = Field(..., min_length=2, max_length=20)


class CancelJoinRequest(BaseModel):
    join_code: Optional[str] = None
    cell_id: Optional[str] = None


class RespondJoinRequest(BaseModel):
    cell_id: str
    request_id: str
    action: str  # "approve" | "reject"


class MemberActionRequest(BaseModel):
    target_user_id: str


class NudgeMemberRequest(BaseModel):
    target_user_id: str
    target_user_name: str


class SendStrengthRequest(BaseModel):
    target_user_id: str
    target_user_name: str
    custom_message: Optional[str] = None


class SpartanCellSummary(BaseModel):
    id: str
    name: str
    motto: str
    join_code: str
    leader_id: str
    leader_name: str
    co_leader_ids: List[str] = []
    join_requests: List[Dict[str, Any]] = []
    member_count: int
    max_members: int
    total_streak: int
    collective_xp: int
    shield_status: str  # "gold" | "active" | "cracked"
    is_public: bool
    created_at: datetime
    broadcasts: List[Dict[str, Any]] = []
    members: List[Dict[str, Any]] = []


def _cell_to_summary(
    c: SpartanCell,
    requesting_user_id: Optional[str] = None,
    requesting_user_email: Optional[str] = None,
) -> SpartanCellSummary:
    seen = set()
    deduped_members = []
    for m in (c.members or []):
        uid = (m.get("user_id") or "").strip()
        if uid and uid not in seen:
            seen.add(uid)
            deduped_members.append(m)
        elif not uid:
            deduped_members.append(m)
    raw_reqs = getattr(c, "join_requests", []) or []

    return SpartanCellSummary(
        id=str(c.id),
        name=c.name,
        motto=c.motto,
        join_code=c.join_code,
        leader_id=c.leader_id,
        leader_name=c.leader_name,
        co_leader_ids=getattr(c, "co_leader_ids", []) or [],
        join_requests=raw_reqs,
        member_count=len(deduped_members),
        max_members=c.max_members,
        total_streak=c.total_streak,
        collective_xp=c.collective_xp,
        shield_status=c.shield_status,
        is_public=c.is_public,
        created_at=c.created_at,
        broadcasts=getattr(c, "broadcasts", []) or [],
        members=deduped_members,
    )


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
    import re
    name_exists = await SpartanCell.find_one({"name": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"}})
    if name_exists:
        raise HTTPException(status_code=400, detail=f"An Accountability Cell named '{clean_name}' already exists. Please choose a unique name.")

    # Generate unique join code
    join_code = generate_cell_join_code()
    while await SpartanCell.find_one({"join_code": join_code}):
        join_code = generate_cell_join_code()

    rank_info = get_rank_badge_for_streak(user_streak)
    today_str = date.today().isoformat()
    has_checked_in = (current_user.last_checkin_date == today_str) or (getattr(current_user, "last_retain_date", None) == today_str)

    leader_member = {
        "user_id": user_id_str,
        "email": current_user.email,
        "name": user_name,
        "streak": user_streak,
        "xp": current_user.total_points or 100,
        "rank_tier": rank_info["rank_tier"],
        "badge": rank_info["badge"],
        "last_checkin_date": current_user.last_checkin_date,
        "last_retain_date": getattr(current_user, "last_retain_date", None),
        "last_retain_status": getattr(current_user, "last_retain_status", None),
        "status": "retained" if has_checked_in else "pending",
        "retain_status": "retained" if has_checked_in else "pending",
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
        broadcasts=[],
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    await cell.insert()
    updated_cell = await recalculate_cell_stats(cell)
    summary = _cell_to_summary(updated_cell, requesting_user_id=user_id_str, requesting_user_email=current_user.email)

    # Clean up any pending join requests current user had across other cells
    try:
        user_email_clean = (current_user.email or "").strip().lower()
        clean_clauses = [{"join_requests.user_id": user_id_str}]
        if user_email_clean:
            clean_clauses.append({"join_requests.user_email": user_email_clean})
        pending_cells = await SpartanCell.find({"$or": clean_clauses}).to_list()
        for pc in pending_cells:
            if str(pc.id) != str(cell.id):
                pc.join_requests = [
                    r for r in (pc.join_requests or [])
                    if str(r.get("user_id") or "").strip().lower() != user_id_str.lower()
                    and (not user_email_clean or str(r.get("user_email") or "").strip().lower() != user_email_clean)
                ]
                await pc.save()
                summary_pc = _cell_to_summary(await recalculate_cell_stats(pc))
                await realtime_bus.broadcast_to_channel(
                    f"cell:{pc.id}",
                    {
                        "type": "CELL_UPDATED",
                        "cell_id": str(pc.id),
                        "event": "join_request_cleared",
                        "data": summary_pc.model_dump(),
                    }
                )
    except Exception:
        pass

    # Broadcast real-time creation event
    await realtime_bus.broadcast_to_channel("public_cells", {"type": "PUBLIC_CELLS_CHANGED"})
    await realtime_bus.broadcast_all({"type": "LEADERBOARD_UPDATED"})

    return summary


@router.post("/join", response_model=SpartanCellSummary)
async def join_spartan_cell(
    payload: JoinCellRequest,
    current_user: User = Depends(get_current_user),
):
    """Join an existing Spartan Cell via unique 6-character code."""
    user_id_str = str(current_user.id)
    raw_code = payload.join_code.strip().upper()
    pure_code = raw_code.replace("SP-", "").replace("SP ", "").replace("SP", "").strip()

    cell = await SpartanCell.find_one({
        "$or": [
            {"join_code": raw_code},
            {"join_code": f"SP-{raw_code}"},
            {"join_code": f"SP-{pure_code}"},
            {"join_code": pure_code},
            {"id": raw_code},
            {"id": pure_code},
        ]
    })
    if not cell:
        raise HTTPException(status_code=404, detail="Invalid Cell Code. Please check the code and try again.")

    if user_id_str in cell.member_ids or (current_user.email and current_user.email in cell.member_ids):
        # Already member
        return _cell_to_summary(await recalculate_cell_stats(cell), requesting_user_id=user_id_str, requesting_user_email=current_user.email)

    # Check maximum capacity
    if len(cell.member_ids or []) >= (cell.max_members or 20):
        raise HTTPException(status_code=400, detail="This Accountability Squad has reached maximum member capacity (20 warriors).")

    # Remove user from any prior cell (if not the target cell)
    user_email = (current_user.email or "").strip().lower()
    prior_query = {
        "$or": [
            {"member_ids": user_id_str},
            {"leader_id": user_id_str},
        ]
    }
    if user_email:
        prior_query["$or"].extend([
            {"member_ids": user_email},
            {"member_ids": current_user.email},
            {"leader_id": user_email},
            {"leader_id": current_user.email},
        ])
    prior_cells = await SpartanCell.find(prior_query).to_list()
    for pc in prior_cells:
        if str(pc.id) != str(cell.id):
            pc.member_ids = [
                m for m in pc.member_ids
                if m != user_id_str and (not user_email or (m.lower() != user_email and m != current_user.email))
            ]
            if not pc.member_ids:
                await pc.delete()
                await realtime_bus.broadcast_to_channel(
                    f"cell:{pc.id}",
                    {"type": "CELL_DELETED", "cell_id": str(pc.id)}
                )
            else:
                is_pc_leader = (
                    pc.leader_id == user_id_str or
                    (user_email and (pc.leader_id.lower() == user_email or pc.leader_id == current_user.email))
                )
                if is_pc_leader:
                    next_leader_id = pc.member_ids[0]
                    next_leader = await get_user_safely(next_leader_id)
                    pc.leader_id = str(next_leader.id) if next_leader else next_leader_id
                    pc.leader_name = next_leader.name if next_leader and next_leader.name else "Commander"
                updated_pc = await recalculate_cell_stats(pc)
                summary_pc = _cell_to_summary(updated_pc)
                await realtime_bus.broadcast_to_channel(
                    f"cell:{pc.id}",
                    {
                        "type": "CELL_UPDATED",
                        "cell_id": str(pc.id),
                        "event": "member_left",
                        "user_id": user_id_str,
                        "user_email": current_user.email,
                        "data": summary_pc.model_dump(),
                    }
                )

    if user_id_str not in cell.member_ids:
        cell.member_ids.append(user_id_str)
    updated_cell = await recalculate_cell_stats(cell)
    summary = _cell_to_summary(updated_cell, requesting_user_id=user_id_str, requesting_user_email=current_user.email)

    # Sub-second real-time broadcast to all members in this cell!
    await realtime_bus.broadcast_to_channel(
        f"cell:{cell.id}",
        {
            "type": "CELL_UPDATED",
            "cell_id": str(cell.id),
            "event": "member_joined",
            "user_id": user_id_str,
            "user_email": current_user.email,
            "user_name": current_user.name or "Warrior",
            "data": summary.model_dump(),
        }
    )
    await realtime_bus.broadcast_to_channel("public_cells", {"type": "PUBLIC_CELLS_CHANGED"})
    await realtime_bus.broadcast_all({"type": "LEADERBOARD_UPDATED"})

    return summary


@router.post("/request-join")
async def request_join_spartan_cell(
    payload: RequestJoinCellRequest,
    current_user: User = Depends(get_current_user),
):
    """Submit an official Join Request to the Leader & Co-Leaders of a Spartan Cell. Users can apply to N cells while unattached."""
    user_id_str = str(current_user.id).strip()
    user_email = (current_user.email or "").strip().lower()

    # 1. Check if user is already an active member of ANY squad cell
    existing = await SpartanCell.find_one({
        "$or": [
            {"member_ids": user_id_str},
            {"member_ids": current_user.email},
            {"leader_id": user_id_str},
            {"leader_id": current_user.email},
        ]
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"You are already an active member of '{existing.name}'. Please depart your current squad before requesting to join another."
        )

    raw_code = payload.join_code.strip().upper()
    pure_code = raw_code.replace("SP-", "").replace("SP ", "").replace("SP", "").strip()

    cell = await SpartanCell.find_one({
        "$or": [
            {"join_code": raw_code},
            {"join_code": f"SP-{raw_code}"},
            {"join_code": f"SP-{pure_code}"},
            {"join_code": pure_code},
            {"id": raw_code},
            {"id": pure_code},
        ]
    })
    if not cell:
        raise HTTPException(status_code=404, detail="Invalid Squad Code. Please verify the code and try again.")

    if user_id_str in cell.member_ids or (current_user.email and current_user.email in cell.member_ids):
        return {"status": "already_member", "message": "You are already a member of this Squad.", "cell_id": str(cell.id)}

    if len(cell.member_ids or []) >= (cell.max_members or 20):
        raise HTTPException(status_code=400, detail="This Accountability Squad has reached maximum member capacity (20 warriors).")

    # 2. Check if user already submitted a join request to THIS specific cell
    if hasattr(cell, "join_requests") and cell.join_requests:
        already_requested = any(
            r.get("user_id") == user_id_str or (user_email and r.get("user_email") == user_email)
            for r in cell.join_requests
        )
        if already_requested:
            return {
                "status": "pending",
                "message": f"Your join request is already pending review by the leadership of '{cell.name}'.",
                "cell_id": str(cell.id),
                "join_code": cell.join_code,
            }

    if not hasattr(cell, "join_requests") or cell.join_requests is None:
        cell.join_requests = []

    import uuid
    rank_info = get_rank_badge_for_streak(current_user.streak or 0)
    user_name = current_user.name or (current_user.email.split("@")[0] if current_user.email else "Warrior")

    req_item = {
        "id": str(uuid.uuid4()),
        "user_id": user_id_str,
        "user_name": user_name,
        "user_email": current_user.email,
        "streak": current_user.streak or 0,
        "xp": current_user.total_points or 100,
        "badge": rank_info["badge"],
        "rank_tier": rank_info["rank_tier"],
        "created_at": datetime.utcnow().isoformat(),
    }

    cell.join_requests.append(req_item)
    cell.updated_at = datetime.utcnow()
    await cell.save()

    # Real-time notification broadcast to cell leadership and members
    try:
        summary = _cell_to_summary(cell)
        await realtime_bus.broadcast_to_channel(
            f"cell:{cell.id}",
            {
                "type": "JOIN_REQUEST_RECEIVED",
                "cell_id": str(cell.id),
                "applicant_name": user_name,
                "data": summary.model_dump(),
            }
        )
        if cell.leader_id:
            await realtime_bus.send_to_user(
                cell.leader_id,
                {
                    "type": "CELL_UPDATED",
                    "cell_id": str(cell.id),
                    "event": "join_request_received",
                    "data": summary.model_dump(),
                }
            )
        for cid in (getattr(cell, "co_leader_ids", []) or []):
            if cid:
                await realtime_bus.send_to_user(
                    str(cid),
                    {
                        "type": "CELL_UPDATED",
                        "cell_id": str(cell.id),
                        "event": "join_request_received",
                        "data": summary.model_dump(),
                    }
                )
        await realtime_bus.broadcast_to_channel("public_cells", {"type": "PUBLIC_CELLS_CHANGED"})
    except Exception:
        pass

    return {
        "status": "pending",
        "message": f"Join request sent! The leadership of '{cell.name}' will review your admission.",
        "cell_id": str(cell.id),
        "join_code": cell.join_code,
    }


@router.post("/cancel-join-request")
async def cancel_join_request(
    payload: CancelJoinRequest,
    current_user: User = Depends(get_current_user),
):
    """Cancel a pending squad join request for a specific squad or all squads."""
    user_id_str = str(current_user.id).strip()
    user_email = (current_user.email or "").strip().lower()

    target_code = (payload.join_code or "").strip().upper()
    target_cell_id = (payload.cell_id or "").strip()

    cells_to_update = []

    if target_code or target_cell_id:
        pure_code = target_code.replace("SP-", "").replace("SP ", "").replace("SP", "").strip() if target_code else ""
        query_conditions: List[Dict[str, Any]] = []
        if target_cell_id:
            query_conditions.extend([
                {"id": target_cell_id},
                {"_id": target_cell_id},
            ])
            from bson import ObjectId
            if ObjectId.is_valid(target_cell_id):
                query_conditions.append({"_id": ObjectId(target_cell_id)})
        if target_code:
            query_conditions.extend([
                {"join_code": target_code},
                {"join_code": f"SP-{target_code}"},
                {"join_code": f"SP-{pure_code}"},
                {"join_code": pure_code},
            ])

        specific_cell = await SpartanCell.find_one({"$or": query_conditions})
        if specific_cell:
            cells_to_update = [specific_cell]
    else:
        or_clauses = [{"join_requests.user_id": user_id_str}]
        if user_email:
            or_clauses.append({"join_requests.user_email": user_email})
        cells_to_update = await SpartanCell.find({"$or": or_clauses}).to_list()

    for c in cells_to_update:
        c.join_requests = [
            r for r in (c.join_requests or [])
            if r.get("user_id") != user_id_str and (not user_email or r.get("user_email") != user_email)
        ]
        c.updated_at = datetime.utcnow()
        await c.save()
        try:
            summary = _cell_to_summary(c)
            await realtime_bus.broadcast_to_channel(
                f"cell:{c.id}",
                {
                    "type": "CELL_UPDATED",
                    "cell_id": str(c.id),
                    "event": "join_request_cancelled",
                    "data": summary.model_dump(),
                }
            )
            if c.leader_id:
                await realtime_bus.send_to_user(
                    c.leader_id,
                    {
                        "type": "CELL_UPDATED",
                        "cell_id": str(c.id),
                        "event": "join_request_cancelled",
                        "data": summary.model_dump(),
                    }
                )
            for cid in (getattr(c, "co_leader_ids", []) or []):
                if cid:
                    await realtime_bus.send_to_user(
                        str(cid),
                        {
                            "type": "CELL_UPDATED",
                            "cell_id": str(c.id),
                            "event": "join_request_cancelled",
                            "data": summary.model_dump(),
                        }
                    )
            await realtime_bus.broadcast_to_channel("public_cells", {"type": "PUBLIC_CELLS_CHANGED"})
        except Exception:
            pass

    return {"status": "success", "message": "Join request cancelled."}


@router.get("/my-requests")
async def get_my_join_requests(
    current_user: User = Depends(get_current_user),
):
    """Retrieve all pending squad join requests submitted by current user."""
    user_id_str = str(current_user.id).strip()
    user_email = (current_user.email or "").strip().lower()

    or_clauses = [{"join_requests.user_id": user_id_str}]
    if user_email:
        or_clauses.append({"join_requests.user_email": user_email})

    cells = await SpartanCell.find({"$or": or_clauses}).to_list()
    return [
        {
            "cell_id": str(c.id),
            "join_code": c.join_code,
            "name": c.name,
        }
        for c in cells
    ]


@router.post("/respond-join-request")
async def respond_join_request(
    payload: RespondJoinRequest,
    current_user: User = Depends(get_current_user),
):
    """Leader or Co-Leader approves or rejects an incoming squad join request."""
    user_id_str = str(current_user.id).strip()
    user_email = (current_user.email or "").strip().lower()

    cell = await SpartanCell.find_one({
        "$or": [
            {"id": payload.cell_id},
            {"_id": payload.cell_id},
            {"join_code": payload.cell_id},
        ]
    })
    if not cell:
        from bson import ObjectId
        if ObjectId.is_valid(payload.cell_id):
            cell = await SpartanCell.find_one({"_id": ObjectId(payload.cell_id)})
    if not cell:
        raise HTTPException(status_code=404, detail="Accountability Squad not found.")

    co_leaders = [str(cid).lower() for cid in (getattr(cell, "co_leader_ids", []) or [])]
    is_leader = (
        cell.leader_id == user_id_str or
        (user_email and (cell.leader_id.lower() == user_email or cell.leader_id == current_user.email))
    )
    is_co_leader = (
        user_id_str.lower() in co_leaders or
        (user_email and user_email in co_leaders)
    )
    if not is_leader and not is_co_leader:
        raise HTTPException(status_code=403, detail="Only the Squad Leader or appointed Co-Leaders have authority to review join requests.")

    reqs = getattr(cell, "join_requests", []) or []
    target_req = next(
        (r for r in reqs if r.get("id") == payload.request_id or r.get("user_id") == payload.request_id),
        None
    )
    if not target_req:
        raise HTTPException(status_code=404, detail="Join request not found or has already been reviewed.")

    applicant_id = str(target_req.get("user_id")).strip()
    applicant_name = target_req.get("user_name", "Warrior")
    applicant_email = (target_req.get("user_email") or "").strip().lower()

    if payload.action == "reject":
        target_id_str = str(target_req.get("id") or "")
        applicant_id_str = applicant_id.lower()

        cell.join_requests = [
            r for r in reqs
            if str(r.get("id") or "") != target_id_str
            and str(r.get("user_id") or "").strip().lower() != applicant_id_str
            and (not applicant_email or str(r.get("user_email") or "").strip().lower() != applicant_email)
        ]
        cell.updated_at = datetime.utcnow()
        await cell.save()
        updated_cell = await recalculate_cell_stats(cell)
        summary = _cell_to_summary(updated_cell)

        # Notify applicant over real-time socket
        await realtime_bus.send_to_user(
            applicant_id,
            {
                "type": "JOIN_REQUEST_REJECTED",
                "cell_id": str(cell.id),
                "cell_name": cell.name,
            }
        )
        if applicant_email:
            await realtime_bus.send_to_user(
                applicant_email,
                {
                    "type": "JOIN_REQUEST_REJECTED",
                    "cell_id": str(cell.id),
                    "cell_name": cell.name,
                }
            )

        # Broadcast updated cell to all squad subscribers
        await realtime_bus.broadcast_to_channel(
            f"cell:{cell.id}",
            {
                "type": "CELL_UPDATED",
                "cell_id": str(cell.id),
                "event": "join_request_rejected",
                "data": summary.model_dump(),
            }
        )
        # Directly notify Leader and all Co-Leaders to guarantee universal live sync across accounts
        if cell.leader_id:
            await realtime_bus.send_to_user(
                cell.leader_id,
                {
                    "type": "CELL_UPDATED",
                    "cell_id": str(cell.id),
                    "event": "join_request_rejected",
                    "data": summary.model_dump(),
                }
            )
        for cid in (getattr(cell, "co_leader_ids", []) or []):
            if cid:
                await realtime_bus.send_to_user(
                    str(cid),
                    {
                        "type": "CELL_UPDATED",
                        "cell_id": str(cell.id),
                        "event": "join_request_rejected",
                        "data": summary.model_dump(),
                    }
                )

        await realtime_bus.broadcast_to_channel("public_cells", {"type": "PUBLIC_CELLS_CHANGED"})
        await realtime_bus.broadcast_all({"type": "LEADERBOARD_UPDATED"})

        return {"status": "rejected", "message": f"Join request from {applicant_name} was declined.", "data": summary.model_dump()}

    elif payload.action == "approve":
        if len(cell.member_ids or []) >= (cell.max_members or 20):
            raise HTTPException(status_code=400, detail="Squad has reached maximum capacity (20 warriors).")

        # 1. Resolve applicant safely and build canonical identifiers
        applicant_user = await get_user_safely(applicant_id)
        applicant_canonical_id = str(applicant_user.id) if applicant_user else applicant_id
        resolved_email = (applicant_user.email if applicant_user and applicant_user.email else applicant_email).strip().lower()

        applicant_identifiers = {applicant_id.strip().lower(), applicant_canonical_id.strip().lower()}
        if resolved_email:
            applicant_identifiers.add(resolved_email)
        if applicant_email:
            applicant_identifiers.add(applicant_email)

        id_list = list(applicant_identifiers)

        # 2. Check if applicant has ALREADY joined another cell
        other_cells = await SpartanCell.find({
            "$or": [
                {"member_ids": {"$in": id_list}},
                {"leader_id": {"$in": id_list}},
                {"members.user_id": {"$in": id_list}},
            ]
        }).to_list()
        already_in_cell = next((c for c in other_cells if str(c.id) != str(cell.id)), None)

        if already_in_cell:
            # User has ALREADY joined another cell! Notify leadership and remove petition from this queue.
            target_id_str = str(target_req.get("id") or "")
            cell.join_requests = [
                r for r in (cell.join_requests or [])
                if str(r.get("id") or "") != target_id_str
                and str(r.get("user_id") or "").strip().lower() not in applicant_identifiers
                and (not resolved_email or str(r.get("user_email") or "").strip().lower() != resolved_email)
            ]
            cell.updated_at = datetime.utcnow()
            await cell.save()

            # Clean up applicant's pending requests from all other cells as well
            try:
                applicant_clauses = [{"join_requests.user_id": {"$in": id_list}}]
                if resolved_email:
                    applicant_clauses.append({"join_requests.user_email": resolved_email})
                all_requested_cells = await SpartanCell.find({"$or": applicant_clauses}).to_list()
                for arc in all_requested_cells:
                    arc.join_requests = [
                        r for r in (arc.join_requests or [])
                        if str(r.get("user_id") or "").strip().lower() not in applicant_identifiers
                        and (not resolved_email or str(r.get("user_email") or "").strip().lower() != resolved_email)
                    ]
                    await arc.save()
            except Exception:
                pass

            updated_cell = await recalculate_cell_stats(cell)
            summary = _cell_to_summary(updated_cell)

            await realtime_bus.broadcast_to_channel(
                f"cell:{cell.id}",
                {
                    "type": "CELL_UPDATED",
                    "cell_id": str(cell.id),
                    "event": "join_request_cleared",
                    "data": summary.model_dump(),
                }
            )
            if cell.leader_id:
                await realtime_bus.send_to_user(
                    cell.leader_id,
                    {
                        "type": "CELL_UPDATED",
                        "cell_id": str(cell.id),
                        "event": "join_request_cleared",
                        "data": summary.model_dump(),
                    }
                )
            for cid in (getattr(cell, "co_leader_ids", []) or []):
                if cid:
                    await realtime_bus.send_to_user(
                        str(cid),
                        {
                            "type": "CELL_UPDATED",
                            "cell_id": str(cell.id),
                            "event": "join_request_cleared",
                            "data": summary.model_dump(),
                        }
                    )

            return {
                "status": "already_joined",
                "message": f"{applicant_name} has already joined another Spartan Cell ('{already_in_cell.name}'). Their petition has been cleared from your queue.",
                "data": summary.model_dump()
            }

        # 3. Clean up applicant's pending requests from ALL other cells in MongoDB
        target_id_str = str(target_req.get("id") or "")
        try:
            applicant_clauses = [{"join_requests.user_id": {"$in": id_list}}]
            if resolved_email:
                applicant_clauses.append({"join_requests.user_email": resolved_email})

            all_requested_cells = await SpartanCell.find({"$or": applicant_clauses}).to_list()
            for arc in all_requested_cells:
                if str(arc.id) != str(cell.id):
                    arc.join_requests = [
                        r for r in (arc.join_requests or [])
                        if str(r.get("user_id") or "").strip().lower() not in applicant_identifiers
                        and (not resolved_email or str(r.get("user_email") or "").strip().lower() != resolved_email)
                    ]
                    await arc.save()
                    try:
                        sum_arc = _cell_to_summary(await recalculate_cell_stats(arc))
                        await realtime_bus.broadcast_to_channel(
                            f"cell:{arc.id}",
                            {
                                "type": "CELL_UPDATED",
                                "cell_id": str(arc.id),
                                "event": "join_request_cleared",
                                "data": sum_arc.model_dump(),
                            }
                        )
                    except Exception:
                        pass
        except Exception:
            pass

        # 4. Add canonical applicant ID to cell.member_ids
        if applicant_canonical_id not in cell.member_ids:
            cell.member_ids.append(applicant_canonical_id)

        # Remove petition from cell.join_requests
        cell.join_requests = [
            r for r in (cell.join_requests or [])
            if str(r.get("id") or "") != target_id_str
            and str(r.get("user_id") or "").strip().lower() not in applicant_identifiers
            and (not resolved_email or str(r.get("user_email") or "").strip().lower() != resolved_email)
        ]

        # 5. Recalculate cell stats
        updated_cell = await recalculate_cell_stats(cell)
        summary = _cell_to_summary(updated_cell)

        # 6. Real-time notification directly to applicant
        await realtime_bus.send_to_user(
            applicant_canonical_id,
            {
                "type": "JOIN_REQUEST_APPROVED",
                "cell_id": str(cell.id),
                "cell_name": cell.name,
                "data": summary.model_dump(),
            }
        )
        if applicant_id != applicant_canonical_id:
            await realtime_bus.send_to_user(
                applicant_id,
                {
                    "type": "JOIN_REQUEST_APPROVED",
                    "cell_id": str(cell.id),
                    "cell_name": cell.name,
                    "data": summary.model_dump(),
                }
            )
        if resolved_email:
            await realtime_bus.send_to_user(
                resolved_email,
                {
                    "type": "JOIN_REQUEST_APPROVED",
                    "cell_id": str(cell.id),
                    "cell_name": cell.name,
                    "data": summary.model_dump(),
                }
            )

        # 7. Real-time broadcast to all squad members
        await realtime_bus.broadcast_to_channel(
            f"cell:{cell.id}",
            {
                "type": "CELL_UPDATED",
                "cell_id": str(cell.id),
                "event": "member_joined",
                "user_id": applicant_canonical_id,
                "user_name": applicant_name,
                "data": summary.model_dump(),
            }
        )
        if cell.leader_id:
            await realtime_bus.send_to_user(
                cell.leader_id,
                {
                    "type": "CELL_UPDATED",
                    "cell_id": str(cell.id),
                    "event": "member_joined",
                    "user_id": applicant_canonical_id,
                    "user_name": applicant_name,
                    "data": summary.model_dump(),
                }
            )
        for cid in (getattr(cell, "co_leader_ids", []) or []):
            if cid:
                await realtime_bus.send_to_user(
                    str(cid),
                    {
                        "type": "CELL_UPDATED",
                        "cell_id": str(cell.id),
                        "event": "member_joined",
                        "user_id": applicant_canonical_id,
                        "user_name": applicant_name,
                        "data": summary.model_dump(),
                    }
                )

        await realtime_bus.broadcast_to_channel("public_cells", {"type": "PUBLIC_CELLS_CHANGED"})
        await realtime_bus.broadcast_all({"type": "LEADERBOARD_UPDATED"})

        return {"status": "approved", "message": f"{applicant_name} inducted into {cell.name}!", "data": summary.model_dump()}

    else:
        raise HTTPException(status_code=400, detail="Invalid action. Must be 'approve' or 'reject'.")


@router.post("/promote-co-leader")
async def promote_co_leader(
    payload: MemberActionRequest,
    current_user: User = Depends(get_current_user),
):
    """Leader promotes a squad member to Co-Leader."""
    caller_id = str(current_user.id).strip()
    caller_email = (current_user.email or "").strip().lower()
    target_id = payload.target_user_id.strip()

    caller_identifiers = {caller_id.lower(), caller_email}
    cell = await SpartanCell.find_one({
        "$or": [
            {"leader_id": caller_id},
            {"leader_id": current_user.email},
            {"leader_id": caller_email},
        ]
    })
    if not cell:
        all_cells = await SpartanCell.find_all().to_list()
        for c in all_cells:
            if c.leader_id and str(c.leader_id).strip().lower() in caller_identifiers:
                cell = c
                break

    if not cell:
        raise HTTPException(status_code=403, detail="Only the Squad Leader can appoint Co-Leaders.")

    target_user = await get_user_safely(target_id)
    canonical_target_id = str(target_user.id) if target_user else target_id
    target_clean_ids = {target_id.lower(), canonical_target_id.lower()}
    if target_user and target_user.email:
        target_clean_ids.add(target_user.email.lower())

    # Fallback search inside cell.members for matching member
    if not target_user and cell.members:
        for m in cell.members:
            if isinstance(m, dict):
                m_uid = str(m.get("user_id") or "").strip()
                m_email = str(m.get("email") or "").strip().lower()
                m_name = str(m.get("name") or "").strip().lower()
                if target_id.lower() in {m_uid.lower(), m_email, m_name}:
                    if m_uid:
                        target_clean_ids.add(m_uid.lower())
                        u = await get_user_safely(m_uid)
                        if u:
                            target_user = u
                            canonical_target_id = str(u.id)
                            target_clean_ids.add(canonical_target_id.lower())
                            if u.email:
                                target_clean_ids.add(u.email.lower())
                    break

    if any(tid in caller_identifiers for tid in target_clean_ids):
        raise HTTPException(status_code=400, detail="Leader already possesses full sovereign command.")

    is_in_cell = any(str(m).strip().lower() in target_clean_ids for m in cell.member_ids) or any(
        isinstance(m, dict) and (
            str(m.get("user_id") or "").strip().lower() in target_clean_ids or
            str(m.get("email") or "").strip().lower() in target_clean_ids or
            str(m.get("name") or "").strip().lower() == target_id.lower()
        )
        for m in (cell.members or [])
    )
    if not is_in_cell:
        raise HTTPException(status_code=404, detail="Warrior is not a member of this squad.")

    if not hasattr(cell, "co_leader_ids") or cell.co_leader_ids is None:
        cell.co_leader_ids = []

    if canonical_target_id not in cell.co_leader_ids:
        cell.co_leader_ids.append(canonical_target_id)
    if target_id not in cell.co_leader_ids:
        cell.co_leader_ids.append(target_id)

    # Immediately reflect promotion in members array
    for m in (cell.members or []):
        if isinstance(m, dict):
            m_uid = str(m.get("user_id") or "").strip().lower()
            m_email = str(m.get("email") or "").strip().lower()
            if m_uid in target_clean_ids or (m_email and m_email in target_clean_ids):
                m["is_co_leader"] = True

    updated_cell = await recalculate_cell_stats(cell)
    summary = _cell_to_summary(updated_cell, requesting_user_id=caller_id, requesting_user_email=caller_email)

    await realtime_bus.send_to_user(
        canonical_target_id,
        {
            "type": "PROMOTED_TO_CO_LEADER",
            "cell_id": str(cell.id),
            "cell_name": cell.name,
            "data": summary.model_dump(),
        }
    )
    if target_id != canonical_target_id:
        await realtime_bus.send_to_user(
            target_id,
            {
                "type": "PROMOTED_TO_CO_LEADER",
                "cell_id": str(cell.id),
                "cell_name": cell.name,
                "data": summary.model_dump(),
            }
        )
    await realtime_bus.broadcast_to_channel(
        f"cell:{cell.id}",
        {
            "type": "CELL_UPDATED",
            "cell_id": str(cell.id),
            "event": "co_leader_promoted",
            "user_id": canonical_target_id,
            "data": summary.model_dump(),
        }
    )

    return {"status": "success", "message": "Warrior promoted to Co-Leader.", "data": summary.model_dump()}


@router.post("/demote-co-leader")
async def demote_co_leader(
    payload: MemberActionRequest,
    current_user: User = Depends(get_current_user),
):
    """Leader revokes Co-Leader status from a squad member."""
    caller_id = str(current_user.id).strip()
    caller_email = (current_user.email or "").strip().lower()
    target_id = payload.target_user_id.strip()

    caller_identifiers = {caller_id.lower(), caller_email}
    cell = await SpartanCell.find_one({
        "$or": [
            {"leader_id": caller_id},
            {"leader_id": current_user.email},
            {"leader_id": caller_email},
        ]
    })
    if not cell:
        all_cells = await SpartanCell.find_all().to_list()
        for c in all_cells:
            if c.leader_id and str(c.leader_id).strip().lower() in caller_identifiers:
                cell = c
                break

    if not cell:
        raise HTTPException(status_code=403, detail="Only the Squad Leader can demote Co-Leaders.")

    target_user = await get_user_safely(target_id)
    canonical_target_id = str(target_user.id) if target_user else target_id
    target_clean_ids = {target_id.lower(), canonical_target_id.lower()}
    if target_user and target_user.email:
        target_clean_ids.add(target_user.email.lower())

    if not target_user and cell.members:
        for m in cell.members:
            if isinstance(m, dict):
                m_uid = str(m.get("user_id") or "").strip()
                m_email = str(m.get("email") or "").strip().lower()
                m_name = str(m.get("name") or "").strip().lower()
                if target_id.lower() in {m_uid.lower(), m_email, m_name}:
                    if m_uid:
                        target_clean_ids.add(m_uid.lower())
                        u = await get_user_safely(m_uid)
                        if u:
                            target_user = u
                            canonical_target_id = str(u.id)
                            target_clean_ids.add(canonical_target_id.lower())
                            if u.email:
                                target_clean_ids.add(u.email.lower())
                    break

    cell.co_leader_ids = [
        cid for cid in (getattr(cell, "co_leader_ids", []) or [])
        if str(cid).strip().lower() not in target_clean_ids
    ]
    # Immediately reflect demotion in members array
    for m in (cell.members or []):
        if isinstance(m, dict):
            m_uid = str(m.get("user_id") or "").strip().lower()
            m_email = str(m.get("email") or "").strip().lower()
            if m_uid in target_clean_ids or (m_email and m_email in target_clean_ids):
                m["is_co_leader"] = False

    updated_cell = await recalculate_cell_stats(cell)
    summary = _cell_to_summary(updated_cell, requesting_user_id=caller_id, requesting_user_email=caller_email)

    await realtime_bus.send_to_user(
        canonical_target_id,
        {
            "type": "DEMOTED_FROM_CO_LEADER",
            "cell_id": str(cell.id),
            "cell_name": cell.name,
            "data": summary.model_dump(),
        }
    )
    if target_id != canonical_target_id:
        await realtime_bus.send_to_user(
            target_id,
            {
                "type": "DEMOTED_FROM_CO_LEADER",
                "cell_id": str(cell.id),
                "cell_name": cell.name,
                "data": summary.model_dump(),
            }
        )
    await realtime_bus.broadcast_to_channel(
        f"cell:{cell.id}",
        {
            "type": "CELL_UPDATED",
            "cell_id": str(cell.id),
            "event": "co_leader_demoted",
            "user_id": canonical_target_id,
            "data": summary.model_dump(),
        }
    )

    return {"status": "success", "message": "Co-Leader returned to warrior rank.", "data": summary.model_dump()}


@router.post("/kick-member")
async def kick_member(
    payload: MemberActionRequest,
    current_user: User = Depends(get_current_user),
):
    """Leader or Co-Leader kicks a member from the squad."""
    caller_id = str(current_user.id).strip()
    caller_email = (current_user.email or "").strip().lower()
    target_id = payload.target_user_id.strip()

    caller_identifiers = {caller_id.lower(), caller_email}

    if target_id.lower() in caller_identifiers:
        raise HTTPException(status_code=400, detail="You cannot kick yourself. Use the Leave button instead.")

    cell = await SpartanCell.find_one({
        "$or": [
            {"member_ids": caller_id},
            {"member_ids": current_user.email},
            {"leader_id": caller_id},
            {"leader_id": current_user.email},
        ]
    })
    if not cell:
        all_cells = await SpartanCell.find_all().to_list()
        for c in all_cells:
            for m in (c.member_ids or []):
                if str(m).strip().lower() in caller_identifiers:
                    cell = c
                    break
            if cell:
                break

    if not cell:
        raise HTTPException(status_code=404, detail="You are not a member of any Spartan Cell.")

    is_leader = str(cell.leader_id).strip().lower() in caller_identifiers
    co_leaders = [str(cid).strip().lower() for cid in (getattr(cell, "co_leader_ids", []) or [])]
    for pm in (cell.members or []):
        if isinstance(pm, dict) and pm.get("is_co_leader"):
            if pm.get("user_id"): co_leaders.append(str(pm["user_id"]).strip().lower())
            if pm.get("email"): co_leaders.append(str(pm["email"]).strip().lower())

    is_co_leader = any(cid in co_leaders for cid in caller_identifiers)

    if not is_leader and not is_co_leader:
        raise HTTPException(status_code=403, detail="Only the Squad Leader or appointed Co-Leaders have authority to kick members.")

    target_user = await get_user_safely(target_id)
    canonical_target_id = str(target_user.id) if target_user else target_id
    target_clean_ids = {target_id.lower(), canonical_target_id.lower()}
    if target_user and target_user.email:
        target_clean_ids.add(target_user.email.lower())

    if not target_user and cell.members:
        for m in cell.members:
            if isinstance(m, dict):
                m_uid = str(m.get("user_id") or "").strip()
                m_email = str(m.get("email") or "").strip().lower()
                m_name = str(m.get("name") or "").strip().lower()
                if target_id.lower() in {m_uid.lower(), m_email, m_name}:
                    if m_uid:
                        target_clean_ids.add(m_uid.lower())
                        u = await get_user_safely(m_uid)
                        if u:
                            target_user = u
                            canonical_target_id = str(u.id)
                            target_clean_ids.add(canonical_target_id.lower())
                            if u.email:
                                target_clean_ids.add(u.email.lower())
                    break

    target_is_leader = any(tid == str(cell.leader_id).strip().lower() for tid in target_clean_ids)
    target_is_co_leader = any(tid in co_leaders for tid in target_clean_ids)

    if is_co_leader and (target_is_leader or target_is_co_leader):
        raise HTTPException(status_code=403, detail="Co-Leaders cannot kick the Squad Leader or fellow Co-Leaders.")

    if is_leader and target_is_leader:
        raise HTTPException(status_code=400, detail="You cannot kick yourself. Use the Leave button instead.")

    is_in_cell = any(str(m).strip().lower() in target_clean_ids for m in cell.member_ids) or any(
        isinstance(m, dict) and (
            str(m.get("user_id") or "").strip().lower() in target_clean_ids or
            str(m.get("email") or "").strip().lower() in target_clean_ids or
            str(m.get("name") or "").strip().lower() == target_id.lower()
        )
        for m in (cell.members or [])
    )
    if not is_in_cell:
        raise HTTPException(status_code=404, detail="Warrior is not a member of this squad.")

    cell.member_ids = [m for m in cell.member_ids if str(m).lower() not in target_clean_ids]
    cell.co_leader_ids = [cid for cid in (cell.co_leader_ids or []) if str(cid).lower() not in target_clean_ids]
    cell.members = [
        m for m in (cell.members or [])
        if str(m.get("user_id", "")).lower() not in target_clean_ids and str(m.get("email", "")).lower() not in target_clean_ids
    ]
    updated_cell = await recalculate_cell_stats(cell)
    summary = _cell_to_summary(updated_cell, requesting_user_id=caller_id, requesting_user_email=caller_email)

    # Real-time event directly to kicked user
    await realtime_bus.send_to_user(
        canonical_target_id,
        {
            "type": "MEMBER_KICKED",
            "cell_id": str(cell.id),
            "cell_name": cell.name,
        }
    )
    if target_id != canonical_target_id:
        await realtime_bus.send_to_user(
            target_id,
            {
                "type": "MEMBER_KICKED",
                "cell_id": str(cell.id),
                "cell_name": cell.name,
            }
        )

    # Broadcast to cell members
    await realtime_bus.broadcast_to_channel(
        f"cell:{cell.id}",
        {
            "type": "CELL_UPDATED",
            "cell_id": str(cell.id),
            "event": "member_left",
            "user_id": canonical_target_id,
            "data": summary.model_dump(),
        }
    )
    await realtime_bus.broadcast_to_channel("public_cells", {"type": "PUBLIC_CELLS_CHANGED"})
    await realtime_bus.broadcast_all({"type": "LEADERBOARD_UPDATED"})

    return {"status": "success", "message": "Member removed from squad.", "data": summary.model_dump()}


@router.get("/my-cell", response_model=Optional[SpartanCellSummary])
async def get_my_spartan_cell(
    current_user: User = Depends(get_current_user),
):
    """Retrieve current authenticated user's Spartan Cell with live recalculated stats."""
    user_id_str = str(current_user.id).strip()
    user_email = (current_user.email or "").strip().lower()
    raw_email = (current_user.email or "").strip()
    user_name = (current_user.name or "").strip().lower()

    user_identifiers = {user_id_str.lower(), user_email}
    if user_name:
        user_identifiers.add(user_name)
    if raw_email:
        user_identifiers.add(raw_email.lower())

    def is_user_in_cell(c: SpartanCell) -> bool:
        if not c:
            return False
        # Strictly verify active membership in member_ids, members list, or leadership
        for m in (c.member_ids or []):
            if m and str(m).strip().lower() in user_identifiers:
                return True
        for m in (c.members or []):
            if isinstance(m, dict):
                uid = str(m.get("user_id") or "").strip().lower()
                em = str(m.get("email") or "").strip().lower()
                nm = str(m.get("name") or "").strip().lower()
                if (uid and uid in user_identifiers) or (em and em in user_identifiers) or (nm and nm in user_identifiers):
                    return True
        if c.leader_id and str(c.leader_id).strip().lower() in user_identifiers:
            return True
        return False

    query_clauses: List[Dict[str, Any]] = [
        {"member_ids": user_id_str},
        {"member_ids": user_email},
        {"leader_id": user_id_str},
        {"leader_id": user_email},
        {"members.user_id": user_id_str},
        {"members.email": user_email},
    ]
    if raw_email and raw_email != user_email:
        query_clauses.extend([
            {"member_ids": raw_email},
            {"leader_id": raw_email},
            {"members.email": raw_email},
        ])
    from bson import ObjectId
    if ObjectId.is_valid(user_id_str):
        query_clauses.append({"member_ids": ObjectId(user_id_str)})

    matching_cells = await SpartanCell.find({"$or": query_clauses}).sort("-updated_at").to_list()
    active_cell = None
    for c in matching_cells:
        if is_user_in_cell(c):
            active_cell = c
            break

    if not active_cell:
        all_cells = await SpartanCell.find_all().sort("-updated_at").to_list()
        for c in all_cells:
            if is_user_in_cell(c):
                active_cell = c
                break

    if not active_cell:
        return None

    updated_cell = await recalculate_cell_stats(active_cell)
    return _cell_to_summary(updated_cell, requesting_user_id=user_id_str, requesting_user_email=user_email)


@router.post("/leave")
async def leave_spartan_cell(
    current_user: User = Depends(get_current_user),
):
    """Leave current Spartan Cell. If leader, transfers leadership to next warrior or dissolves empty cell."""
    user_id_str = str(current_user.id).strip()
    user_email = (current_user.email or "").strip().lower()
    raw_email = (current_user.email or "").strip()
    user_name = (current_user.name or "").strip().lower()

    leaving_identifiers = {user_id_str.lower(), user_email}
    if user_name:
        leaving_identifiers.add(user_name)
    if raw_email:
        leaving_identifiers.add(raw_email.lower())

    def is_leaving_user(val) -> bool:
        if not val:
            return False
        return str(val).strip().lower() in leaving_identifiers

    def is_user_in_cell(c: SpartanCell) -> bool:
        if not c:
            return False
        for m in (c.member_ids or []):
            if m and str(m).strip().lower() in leaving_identifiers:
                return True
        for m in (c.members or []):
            if isinstance(m, dict):
                uid = str(m.get("user_id") or "").strip().lower()
                em = str(m.get("email") or "").strip().lower()
                if (uid and uid in leaving_identifiers) or (em and em in leaving_identifiers):
                    return True
        if c.leader_id and str(c.leader_id).strip().lower() in leaving_identifiers:
            return True
        return False

    all_cells = await SpartanCell.find_all().to_list()
    cells = [c for c in all_cells if is_user_in_cell(c)]

    # Direct database collection level purge
    try:
        motor_col = SpartanCell.get_motor_collection()
        id_list = list(leaving_identifiers)
        await motor_col.update_many(
            {},
            {
                "$pull": {
                    "member_ids": {"$in": id_list},
                    "co_leader_ids": {"$in": id_list},
                }
            }
        )
    except Exception:
        pass

    for cell in cells:
        # 1. Filter out leaving user from member_ids, co_leader_ids, members
        cell.member_ids = [m for m in (cell.member_ids or []) if not is_leaving_user(m)]
        cell.co_leader_ids = [cid for cid in (getattr(cell, "co_leader_ids", []) or []) if not is_leaving_user(cid)]
        cell.members = [
            m for m in (cell.members or [])
            if not is_leaving_user(m.get("user_id")) and not is_leaving_user(m.get("email")) and not is_leaving_user(m.get("name"))
        ]
        if hasattr(cell, "join_requests") and cell.join_requests:
            cell.join_requests = [
                req for req in cell.join_requests
                if not is_leaving_user(req.get("user_id")) and not is_leaving_user(req.get("user_email")) and not is_leaving_user(req.get("email"))
            ]

        # 2. If no members left in the cell, disband it completely
        if not cell.member_ids:
            cell_id_str = str(cell.id)
            try:
                await cell.delete()
            except Exception:
                pass
            try:
                from bson import ObjectId
                motor_col = SpartanCell.get_motor_collection()
                del_query = [{"_id": cell.id}, {"id": str(cell.id)}]
                if ObjectId.is_valid(str(cell.id)):
                    del_query.append({"_id": ObjectId(str(cell.id))})
                await motor_col.delete_many({"$or": del_query})
            except Exception:
                pass

            await realtime_bus.broadcast_to_channel(
                f"cell:{cell_id_str}",
                {"type": "CELL_DELETED", "cell_id": cell_id_str}
            )
        else:
            # 3. If the leaving user was the leader, promote the first remaining member
            if is_leaving_user(cell.leader_id) or not any(str(m).strip().lower() == str(cell.leader_id).strip().lower() for m in cell.member_ids):
                next_leader_id = cell.member_ids[0]
                next_leader = await get_user_safely(next_leader_id)
                cell.leader_id = str(next_leader.id) if next_leader else str(next_leader_id)
                cell.leader_name = next_leader.name if next_leader and next_leader.name else "Commander"

            updated_cell = await recalculate_cell_stats(cell)
            summary = _cell_to_summary(updated_cell)

            await realtime_bus.broadcast_to_channel(
                f"cell:{cell.id}",
                {
                    "type": "CELL_UPDATED",
                    "cell_id": str(cell.id),
                    "event": "member_left",
                    "user_id": user_id_str,
                    "user_email": current_user.email,
                    "data": summary.model_dump(),
                }
            )

    # Clean up any memberless orphan cells remaining in MongoDB
    try:
        motor_col = SpartanCell.get_motor_collection()
        await motor_col.delete_many({
            "$or": [
                {"member_ids": {"$size": 0}},
                {"member_ids": None},
                {"member_ids": {"$exists": False}},
            ]
        })
    except Exception:
        pass

    # Broadcast direct message to leaving user's socket so their UI instantly unbinds
    await realtime_bus.send_to_user(
        user_id_str,
        {
            "type": "CELL_LEFT",
            "user_id": user_id_str,
        }
    )

    await realtime_bus.broadcast_to_channel("public_cells", {"type": "PUBLIC_CELLS_CHANGED"})
    await realtime_bus.broadcast_all({"type": "LEADERBOARD_UPDATED"})

    return {"status": "success", "message": "Successfully departed Spartan Cell."}


@router.post("/delete")
async def delete_spartan_cell(
    current_user: User = Depends(get_current_user),
):
    """Allows the cell commander/leader or sole member to completely disband and delete the Spartan Cell."""
    user_id_str = str(current_user.id).strip()
    user_email = (current_user.email or "").strip().lower()
    raw_email = (current_user.email or "").strip()
    user_name = (current_user.name or "").strip().lower()

    user_identifiers = {user_id_str.lower(), user_email}
    if user_name:
        user_identifiers.add(user_name)
    if raw_email:
        user_identifiers.add(raw_email.lower())

    def is_user_in_cell(c: SpartanCell) -> bool:
        if not c:
            return False
        for m in (c.member_ids or []):
            if m and str(m).strip().lower() in user_identifiers:
                return True
        for m in (c.members or []):
            if isinstance(m, dict):
                uid = str(m.get("user_id") or "").strip().lower()
                em = str(m.get("email") or "").strip().lower()
                if (uid and uid in user_identifiers) or (em and em in user_identifiers):
                    return True
        if c.leader_id and str(c.leader_id).strip().lower() in user_identifiers:
            return True
        return False

    all_cells = await SpartanCell.find_all().to_list()
    cells = [c for c in all_cells if is_user_in_cell(c)]

    for cell in cells:
        cell_id_str = str(cell.id)
        try:
            await cell.delete()
        except Exception:
            pass
        try:
            from bson import ObjectId
            motor_col = SpartanCell.get_motor_collection()
            del_query = [{"_id": cell.id}, {"id": str(cell.id)}]
            if ObjectId.is_valid(str(cell.id)):
                del_query.append({"_id": ObjectId(str(cell.id))})
            await motor_col.delete_many({"$or": del_query})
        except Exception:
            pass

        await realtime_bus.broadcast_to_channel(
            f"cell:{cell_id_str}",
            {"type": "CELL_DELETED", "cell_id": cell_id_str}
        )

    await realtime_bus.send_to_user(
        user_id_str,
        {
            "type": "CELL_LEFT",
            "user_id": user_id_str,
        }
    )

    await realtime_bus.broadcast_to_channel("public_cells", {"type": "PUBLIC_CELLS_CHANGED"})
    await realtime_bus.broadcast_all({"type": "LEADERBOARD_UPDATED"})

    return {"status": "success", "message": "Spartan Cell has been disbanded."}


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
        results.append(_cell_to_summary(c))

    # Re-sort after recalculating
    results.sort(key=lambda x: (-x.total_streak, -x.collective_xp))
    return results


@router.post("/nudge")
async def nudge_cell_member(
    payload: NudgeMemberRequest,
    current_user: User = Depends(get_current_user),
):
    """Sends a brotherhood accountability streak reminder directly to a cell member's DM."""
    target_id = payload.target_user_id
    target_name = payload.target_user_name
    sender_id_str = str(current_user.id)
    sender_name = current_user.name.split(" ")[0] if current_user.name else "Brother"
    sender_username = (current_user.name or "brother").lower().replace(" ", "_")
    target_username = target_name.lower().replace(" ", "_")

    dm_content = f"🛡️ Streak Reminder: Hey {target_name}, please complete your daily streak check-in today to hold the line for our Squad!"
    try:
        new_dm = DirectMessage(
            sender_id=sender_id_str,
            sender_name=sender_name,
            sender_username=sender_username,
            receiver_id=target_id,
            receiver_name=target_name,
            receiver_username=target_username,
            content=dm_content,
            message_type="system_reminder",
            audio_duration=None,
            is_read=False,
            created_at=datetime.utcnow(),
        )
        await new_dm.insert()

        # Real-time sub-second delivery to target member's socket
        await realtime_bus.send_to_user(
            target_id,
            {
                "type": "DM_RECEIVED",
                "sender_id": sender_id_str,
                "sender_name": sender_name,
                "message": dm_content,
                "message_type": "system_reminder",
            }
        )
        await realtime_bus.send_to_user(target_id, {"type": "UNREAD_COUNT_CHANGED"})
    except Exception as e:
        print(f"[SpartanCell Nudge DM Error]: {e}")

    return {
        "status": "success",
        "message": f"Streak reminder sent to {target_name}'s DM! The line holds strong.",
    }


@router.post("/send-strength")
async def send_strength_to_member(
    payload: SendStrengthRequest,
    current_user: User = Depends(get_current_user),
):
    """Sends an empowering brotherhood recovery message directly to a relapsed or struggling cell member's DM."""
    target_id = payload.target_user_id
    target_name = payload.target_user_name
    sender_id_str = str(current_user.id)
    sender_name = current_user.name.split(" ")[0] if current_user.name else "Brother"
    sender_username = (current_user.name or "brother").lower().replace(" ", "_")
    target_username = target_name.lower().replace(" ", "_")

    msg_content = payload.custom_message or (
        f"⚡ Brother {sender_name} sends you mental strength! \"Stand strong, brother! A slip is just a moment—our squad is right behind you. Take a deep breath, reset your mind, and let's conquer this day together.\""
    )
    try:
        new_dm = DirectMessage(
            sender_id=sender_id_str,
            sender_name=sender_name,
            sender_username=sender_username,
            receiver_id=target_id,
            receiver_name=target_name,
            receiver_username=target_username,
            content=msg_content,
            message_type="brotherhood_strength",
            audio_duration=None,
            is_read=False,
            created_at=datetime.utcnow(),
        )
        await new_dm.insert()

        # Real-time sub-second delivery to target member's socket
        await realtime_bus.send_to_user(
            target_id,
            {
                "type": "DM_RECEIVED",
                "sender_id": sender_id_str,
                "sender_name": sender_name,
                "message": msg_content,
                "message_type": "brotherhood_strength",
            }
        )
        await realtime_bus.send_to_user(target_id, {"type": "UNREAD_COUNT_CHANGED"})
    except Exception as e:
        print(f"[SpartanCell SendStrength Error]: {e}")

    return {
        "status": "success",
        "message": f"Strength and brotherhood energy sent to {target_name}!",
    }


@router.get("/public-cells", response_model=List[SpartanCellSummary])
async def get_public_cells(limit: int = 50):
    """Retrieve open public Spartan Cells with live recalculated streaks and member lists."""
    cells = await SpartanCell.find({
        "$or": [
            {"is_public": True},
            {"is_public": {"$ne": False}},
            {"is_public": {"$exists": False}},
            {"is_public": None},
        ]
    }).sort("-total_streak").limit(limit).to_list()
    results = []
    for c in cells:
        if c.member_ids:
            updated = await recalculate_cell_stats(c)
            results.append(_cell_to_summary(updated))
    results.sort(key=lambda x: (-x.total_streak, -x.collective_xp))
    return results

