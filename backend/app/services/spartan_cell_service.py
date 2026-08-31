import random
import string
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from app.models.spartan_cell import SpartanCell
from app.models.user import User
from app.models.daily_checkin import DailyCheckin


from bson import ObjectId


async def get_user_safely(uid: str) -> Optional[User]:
    if not uid:
        return None
    clauses: List[Dict[str, Any]] = [{"email": uid}, {"id": uid}]
    try:
        clauses.append({"_id": ObjectId(uid)})
    except Exception:
        pass
    return await User.find_one({"$or": clauses})


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
    Deeply recalculates collective streak, live member details, and Gold Shield status.
    If 5 users are in a cell each with 10 days, total_streak = 50.
    If one user relapses and loses 10 days, total_streak immediately falls to 40.
    """
    today_str = date.today().isoformat()
    total_streak_accum = 0
    total_xp_accum = 0
    updated_members = []
    checked_in_count = 0

    for m_id in cell.member_ids:
        user = await get_user_safely(m_id)
        if not user:
            continue
        
        user_streak = user.streak or 0
        user_points = user.total_points or 0
        total_streak_accum += user_streak
        total_xp_accum += user_points
        rank_info = get_rank_badge_for_streak(user_streak)

        # Check if user submitted daily check-in today
        has_checked_in_today = (user.last_checkin_date == today_str) or (getattr(user, "last_retain_date", None) == today_str)
        if has_checked_in_today:
            checked_in_count += 1

        is_leader = (str(user.id) == cell.leader_id or user.email == cell.leader_id)

        updated_members.append({
            "user_id": str(user.id),
            "name": user.name or "Spartan Warrior",
            "streak": user_streak,
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
    # If 100% of members checked in today -> Gold Shield (+20% XP boost)
    # If >= 70% checked in -> Active Shield
    # If any member is pending/dark -> Cracked Shield (with Nudge Brother button)
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
    Helper invoked whenever a user retains or relapses to instantly update their cell's total streak.
    """
    try:
        cell = await SpartanCell.find_one({"member_ids": user_id_str})
        if cell:
            await recalculate_cell_stats(cell)
    except Exception:
        pass
