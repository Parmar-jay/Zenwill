import random
import string
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from bson import ObjectId
from app.models.spartan_cell import SpartanCell
from app.models.user import User


async def get_user_safely(uid: str) -> Optional[User]:
    """
    Robust multi-strategy user lookup from MongoDB across string IDs, ObjectIds, emails, and usernames.
    """
    if not uid:
        return None
    uid_str = str(uid).strip()
    
    # 1. Direct query matching standard string id or _id or email
    try:
        u = await User.find_one({
            "$or": [
                {"id": uid_str},
                {"_id": uid_str},
                {"email": uid_str.lower()},
            ]
        })
        if u:
            return u
    except Exception:
        pass

    # 2. Beanie Document.get
    try:
        u = await User.get(uid_str)
        if u:
            return u
    except Exception:
        pass

    # 3. BSON ObjectId lookup
    try:
        if ObjectId.is_valid(uid_str):
            u = await User.find_one({"_id": ObjectId(uid_str)})
            if u:
                return u
    except Exception:
        pass

    # 4. Fallback by name if identifier was passed as name
    try:
        u = await User.find_one({"name": uid_str})
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


import uuid
from app.models.direct_message import DirectMessage


async def recalculate_cell_stats(cell: SpartanCell) -> SpartanCell:
    """
    Deeply recalculates collective streak, live member details, Cohort Honor (cumulative XP),
    and exact daily retention status (Retained vs Relapsed vs Pending) directly from MongoDB.
    """
    today_str = date.today().isoformat()
    total_streak_accum = 0
    total_xp_accum = 0
    updated_members = []
    checked_in_count = 0

    # Ensure leader_id is resolved and present
    if cell.leader_id:
        leader_user = await get_user_safely(cell.leader_id)
        if leader_user:
            cell.leader_id = str(leader_user.id)
            if leader_user.name:
                cell.leader_name = leader_user.name
        if cell.leader_id not in cell.member_ids:
            cell.member_ids.append(cell.leader_id)

    seen_user_ids = set()
    canonical_member_ids = []

    for m_id in (cell.member_ids or []):
        if not m_id:
            continue
        user = await get_user_safely(m_id)
        if not user:
            # Fallback to existing cached member item if user temporarily unresolvable
            prev = next((pm for pm in (cell.members or []) if pm.get("user_id") == m_id), None)
            if prev:
                prev_id = str(prev.get("user_id") or m_id).strip()
                if prev_id and prev_id not in seen_user_ids:
                    seen_user_ids.add(prev_id)
                    canonical_member_ids.append(prev_id)
                    s_val = int(prev.get("streak", 0) or 0)
                    xp_val = int(prev.get("xp", 0) or 0)
                    total_streak_accum += s_val
                    total_xp_accum += xp_val
                    updated_members.append(prev)
            continue
        
        uid = str(user.id).strip()
        if uid in seen_user_ids:
            continue
        seen_user_ids.add(uid)
        canonical_member_ids.append(uid)

        user_streak = int(user.streak or 0)
        user_points = int(user.total_points or 0)
        total_streak_accum += user_streak
        total_xp_accum += user_points
        rank_info = get_rank_badge_for_streak(user_streak)

        last_status = getattr(user, "last_retain_status", None)
        last_ret_date = getattr(user, "last_retain_date", None)
        last_chk_date = user.last_checkin_date

        # Determine retention status for the active cycle
        is_relapsed = (
            last_status == "relapsed"
            or user_streak == 0
            or (last_chk_date == today_str and last_status == "relapsed")
            or (last_ret_date == today_str and last_status == "relapsed")
        )

        has_confirmed_retained_today = (
            not is_relapsed and user_streak > 0 and (
                (last_status == "retained" and (last_ret_date == today_str or last_chk_date == today_str))
                or (last_chk_date == today_str or last_ret_date == today_str)
            )
        )

        if is_relapsed:
            status = "relapsed"
            has_checked_in_today = True
        elif has_confirmed_retained_today:
            status = "retained"
            has_checked_in_today = True
            checked_in_count += 1
        else:
            status = "pending"
            has_checked_in_today = False

        is_leader = (
            str(user.id) == cell.leader_id or 
            user.email == cell.leader_id or 
            (user.name and user.name == cell.leader_name)
        )
        if is_leader:
            cell.leader_name = user.name or "Commander"
            cell.leader_id = str(user.id)

        user_display_name = user.name or (user.email.split("@")[0] if user.email else "Warrior")

        updated_members.append({
            "user_id": str(user.id),
            "name": user_display_name,
            "streak": user_streak,
            "xp": user_points,
            "rank_tier": rank_info["rank_tier"],
            "badge": rank_info["badge"],
            "last_checkin_date": user.last_checkin_date,
            "last_retain_date": last_ret_date,
            "last_retain_status": "relapsed" if is_relapsed else last_status,
            "status": status,
            "retain_status": status,
            "today_checked_in": has_checked_in_today,
            "is_leader": is_leader,
            "is_online": True,
            "joined_at": datetime.utcnow().isoformat(),
        })

    # Sort members: Leader first, then highest streak descending
    updated_members.sort(key=lambda m: (not m["is_leader"], -m["streak"]))

    cell.member_ids = canonical_member_ids
    cell.total_streak = total_streak_accum
    cell.collective_xp = total_xp_accum
    cell.members = updated_members

    # Shield Status Calculation:
    total_members_cnt = max(len(updated_members), 1)
    has_any_relapse = any(
        m.get("status") == "relapsed" or m.get("last_retain_status") == "relapsed" or m.get("streak", 0) == 0
        for m in updated_members
    )
    if checked_in_count == total_members_cnt and total_members_cnt > 0 and not has_any_relapse:
        cell.shield_status = "gold"
    elif checked_in_count >= max(1, int(total_members_cnt * 0.7)) and not has_any_relapse:
        cell.shield_status = "active"
    else:
        cell.shield_status = "cracked"

    cell.updated_at = datetime.utcnow()
    await cell.save()
    return cell


async def recalculate_user_cell_streak(user_id_str: str) -> None:
    """
    Helper invoked whenever a user checks in, earns XP, updates profile, or relapses
    to immediately recalculate all associated Spartan Cells in MongoDB.
    """
    try:
        user = await get_user_safely(user_id_str)
        query_clauses: List[Dict[str, Any]] = [
            {"member_ids": user_id_str},
            {"leader_id": user_id_str},
        ]
        if user:
            if user.email:
                query_clauses.extend([
                    {"member_ids": user.email},
                    {"leader_id": user.email},
                ])
            if str(user.id) != user_id_str:
                query_clauses.extend([
                    {"member_ids": str(user.id)},
                    {"leader_id": str(user.id)},
                ])
        
        cells = await SpartanCell.find({"$or": query_clauses}).to_list()
        for cell in cells:
            await recalculate_cell_stats(cell)
    except Exception as e:
        print(f"[SpartanCellRecalculate Error] {e}")


async def broadcast_cell_relapse_support(user_id_str: str, user_name: Optional[str] = None) -> None:
    """
    Broadcasts supportive alerts and direct messages to all members of a Spartan Cell
    when one of their brothers relapses, encouraging them to rally around him, help him recover,
    and stay mentally strong together.
    """
    try:
        user = await get_user_safely(user_id_str)
        clean_name = (user.name if user and user.name else user_name) or "Brother"
        
        query_clauses: List[Dict[str, Any]] = [
            {"member_ids": user_id_str},
            {"leader_id": user_id_str},
        ]
        if user:
            if user.email:
                query_clauses.extend([
                    {"member_ids": user.email},
                    {"leader_id": user.email},
                ])
            if str(user.id) != user_id_str:
                query_clauses.extend([
                    {"member_ids": str(user.id)},
                    {"leader_id": str(user.id)},
                ])

        cells = await SpartanCell.find({"$or": query_clauses}).to_list()
        now_dt = datetime.utcnow()
        alert_msg = (
            f"🛡️ Brotherhood Notice: Brother {clean_name} has relapsed today. "
            f"Please reach out, stand by him, and help him recover to bounce back and stay mentally strong! We hold the line together."
        )

        for cell in cells:
            # 1. Record broadcast in cell
            if not hasattr(cell, "broadcasts") or cell.broadcasts is None:
                cell.broadcasts = []
            
            # Avoid duplicate alert within the last 15 minutes
            recent_same_user = any(
                b.get("user_id") == user_id_str and 
                (now_dt - datetime.fromisoformat(b.get("created_at", now_dt.isoformat()))).total_seconds() < 900
                for b in cell.broadcasts[-3:]
            ) if cell.broadcasts else False

            if not recent_same_user:
                cell.broadcasts.append({
                    "id": str(uuid.uuid4()),
                    "type": "relapse_support",
                    "user_id": user_id_str,
                    "user_name": clean_name,
                    "message": alert_msg,
                    "created_at": now_dt.isoformat(),
                })
                # Retain last 20 broadcasts
                if len(cell.broadcasts) > 20:
                    cell.broadcasts = cell.broadcasts[-20:]

            await recalculate_cell_stats(cell)

            # 2. Send supporting DirectMessage to every fellow squad member
            for m_id in cell.member_ids:
                if m_id == user_id_str or (user and (m_id == user.email or m_id == str(user.id))):
                    continue
                fellow_user = await get_user_safely(m_id)
                if fellow_user:
                    fellow_id = str(fellow_user.id)
                    dm = DirectMessage(
                        sender_id="system_spartan_cell",
                        sender_name="🛡️ Spartan Cell Brotherhood",
                        sender_username="spartan_brotherhood",
                        receiver_id=fellow_id,
                        receiver_name=fellow_user.name or "Brother",
                        receiver_username=(fellow_user.name or "brother").lower().replace(" ", "_"),
                        content=f"🛡️ Brotherhood Alert: Brother {clean_name} has relapsed today. Please reach out to him, stand by him, and help him recover to stay mentally strong! We hold the line together.",
                        message_type="relapse_support_alert",
                        audio_duration=None,
                        is_read=False,
                        created_at=now_dt,
                    )
                    await dm.insert()

            # 3. Send encouraging recovery message to the relapsed user
            if user:
                user_dm = DirectMessage(
                    sender_id="system_spartan_cell",
                    sender_name="🛡️ Spartan Cell Brotherhood",
                    sender_username="spartan_brotherhood",
                    receiver_id=str(user.id),
                    receiver_name=clean_name,
                    receiver_username=(clean_name).lower().replace(" ", "_"),
                    content="🛡️ You are not alone, brother. A setback is just a moment to rebuild—it does not define you. Your squad stands with you. Reset your focus, take a deep breath, and let's conquer today together.",
                    message_type="relapse_recovery_support",
                    audio_duration=None,
                    is_read=False,
                    created_at=now_dt,
                )
                await user_dm.insert()
    except Exception as e:
        print(f"[SpartanCellRelapseBroadcast Error]: {e}")

