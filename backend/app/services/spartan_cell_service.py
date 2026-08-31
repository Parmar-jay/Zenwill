import random
import string
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from bson import ObjectId
from app.models.spartan_cell import SpartanCell
from app.models.user import User


async def get_user_safely(uid: str) -> Optional[User]:
    """
    Robust user lookup from MongoDB across Beanie ObjectId, string ID, and email.
    """
    if not uid:
        return None
    uid_str = str(uid).strip()
    
    # 1. Try direct Beanie ID get
    try:
        u = await User.get(uid_str)
        if u:
            return u
    except Exception:
        pass

    # 2. Try ObjectId find
    try:
        if ObjectId.is_valid(uid_str):
            u = await User.find_one({"_id": ObjectId(uid_str)})
            if u:
                return u
    except Exception:
        pass

    # 3. Try string email or fallback string fields
    try:
        u = await User.find_one({
            "$or": [
                {"email": uid_str.lower()},
                {"id": uid_str},
                {"_id": uid_str},
            ]
        })
        if u:
            return u
    except Exception:
        pass

    return None


def generate_cell_join_code() -> str:
    """Generate a unique 6-character alphanumeric join code."""
    chars = string.ascii_uppercase + string.digits
    # Avoid ambiguous characters like 0, O, 1, I
    clean_chars = [c for c in chars if c not in ["0", "O", "1", "I"]]
    return "SP-" + "".join(random.choices(clean_chars, k=4))


def get_rank_badge_for_streak(days: int) -> Dict[str, str]:
    d = days if isinstance(days, int) and days >= 0 else 0
    if d <= 7: return {"rank_tier": "Bronze I", "badge": "🥉"}
    elif d <= 14: return {"rank_tier": "Bronze II", "badge": "🥉"}
    elif d <= 30: return {"rank_tier": "Bronze III", "badge": "🥉"}
    elif d <= 45: return {"rank_tier": "Silver I", "badge": "🥈"}
    elif d <= 60: return {"rank_tier": "Silver II", "badge": "🥈"}
    elif d <= 90: return {"rank_tier": "Silver III", "badge": "🥈"}
    elif d <= 120: return {"rank_tier": "Gold I", "badge": "🥇"}
    elif d <= 180: return {"rank_tier": "Gold II", "badge": "🥇"}
    elif d <= 270: return {"rank_tier": "Gold III", "badge": "🥇"}
    elif d <= 365: return {"rank_tier": "Platinum", "badge": "💎"}
    elif d <= 730: return {"rank_tier": "Diamond", "badge": "⚔️"}
    else: return {"rank_tier": "Master", "badge": "👑"}


async def recalculate_cell_stats(cell: SpartanCell) -> SpartanCell:
    """
    Deeply and accurately recalculates collective streak, live member details, 
    and Cohort Honor (cumulative member XP) directly from MongoDB user documents.
    """
    today_str = date.today().isoformat()
    total_streak_accum = 0
    total_xp_accum = 0
    updated_members = []
    checked_in_count = 0

    # Ensure leader_id is in member_ids
    if cell.leader_id and cell.leader_id not in cell.member_ids:
        cell.member_ids.append(cell.leader_id)

    # Deduplicate member_ids while preserving order
    seen_ids = set()
    deduped_ids = []
    for m in cell.member_ids:
        if m and m not in seen_ids:
            seen_ids.add(m)
            deduped_ids.append(m)
    cell.member_ids = deduped_ids

    for m_id in cell.member_ids:
        user = await get_user_safely(m_id)
        if not user:
            # Fallback to existing member cache if user temporarily unresolvable
            prev = next((pm for pm in (cell.members or []) if pm.get("user_id") == m_id), None)
            if prev:
                total_streak_accum += int(prev.get("streak", 0))
                total_xp_accum += int(prev.get("xp", 0) or 0)
                updated_members.append(prev)
            continue
        
        user_streak = int(user.streak or 0)
        user_points = int(user.total_points or 0)
        total_streak_accum += user_streak
        total_xp_accum += user_points
        rank_info = get_rank_badge_for_streak(user_streak)

        # Check if user submitted daily check-in today
        has_checked_in_today = (user.last_checkin_date == today_str) or (getattr(user, "last_retain_date", None) == today_str)
        if has_checked_in_today:
            checked_in_count += 1

        is_leader = (str(user.id) == cell.leader_id or user.email == cell.leader_id)
        if is_leader:
            cell.leader_name = user.name or "Commander"

        updated_members.append({
            "user_id": str(user.id),
            "name": user.name or "Spartan Warrior",
            "streak": user_streak,
            "xp": user_points,
            "rank_tier": rank_info["rank_tier"],
            "badge": rank_info["badge"],
            "last_checkin_date": user.last_checkin_date,
            "today_checked_in": has_checked_in_today,
            "is_leader": is_leader,
            "is_online": True,
            "joined_at": datetime.utcnow().isoformat(),
        })

    # Sort members: Leader first, then highest streak descending
    updated_members.sort(key=lambda m: (not m["is_leader"], -m["streak"]))

    cell.total_streak = total_streak_accum
    cell.collective_xp = total_xp_accum
    cell.members = updated_members

    # Shield Status Calculation:
    total_members_cnt = max(len(updated_members), 1)
    if checked_in_count == total_members_cnt:
        cell.shield_status = "gold"
    elif checked_in_count >= max(1, int(total_members_cnt * 0.7)):
        cell.shield_status = "active"
    else:
        cell.shield_status = "cracked"

    cell.updated_at = datetime.utcnow()
    await cell.save()
    return cell


async def recalculate_user_cell_streak(user_id_str: str) -> None:
    """
    Helper invoked whenever a user retains, checks in, earns points, or relapses
    to instantly update their cell's total streak and Cohort Honor.
    """
    try:
        user = await get_user_safely(user_id_str)
        query_clauses: List[Dict[str, Any]] = [
            {"member_ids": user_id_str},
            {"leader_id": user_id_str},
        ]
        if user and user.email:
            query_clauses.extend([
                {"member_ids": user.email},
                {"leader_id": user.email},
                {"member_ids": str(user.id)},
                {"leader_id": str(user.id)},
            ])
        
        cells = await SpartanCell.find({"$or": query_clauses}).to_list()
        for cell in cells:
            await recalculate_cell_stats(cell)
    except Exception as e:
        print(f"[SpartanCellRecalculate Error] {e}")
