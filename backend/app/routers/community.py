from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.community_message import CommunityMessage
from app.models.direct_message import (
    DirectMessage,
    DirectMessageSendRequest,
    DirectMessageResponse,
    ConversationSummary,
)
from app.models.user import User
from app.middleware.auth_middleware import get_current_user, get_optional_current_user

router = APIRouter(prefix="/community", tags=["community"])

IST = timezone(timedelta(hours=5, minutes=30))


def format_ist_time(dt: Optional[datetime]) -> str:
    if not dt:
        dt = datetime.now(IST)
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc).astimezone(IST)
    else:
        dt = dt.astimezone(IST)
    return dt.strftime("%I:%M %p")


class CreateMessageRequest(BaseModel):
    user_id: Optional[str] = "user_guest"
    author_name: str = "Operative"
    author_rank: str = "Silver I"
    author_badge: str = "🥈"
    author_streak: int = 0
    content: str = Field(..., min_length=1, max_length=1000)


class MessageResponse(BaseModel):
    id: str
    user_id: str
    author_name: str
    author_rank: str
    author_badge: str
    author_streak: int
    content: str
    created_at: str
    likes_count: int


class UserStatusResponse(BaseModel):
    user_id: str
    name: str
    is_online: bool
    last_seen: str


class CommunityRankingItem(BaseModel):
    rank_number: int
    id: str
    author_name: str
    badge: str
    rank_tier: str
    streak_days: int
    mind_strength: int
    is_user: bool = False


# Initial Seed Messages array - EMPTY so only real user messages exist
DEFAULT_MESSAGES = []


def get_rank_info_for_days(days: int):
    d = days if isinstance(days, int) and days >= 0 else 0
    if d <= 7: return ("Bronze I", "🥉")
    elif d <= 14: return ("Bronze II", "🥉")
    elif d <= 30: return ("Bronze III", "🥉")
    elif d <= 45: return ("Silver I", "🥈")
    elif d <= 60: return ("Silver II", "🥈")
    elif d <= 90: return ("Silver III", "🥈")
    elif d <= 120: return ("Gold I", "🥇")
    elif d <= 180: return ("Gold II", "🥇")
    elif d <= 270: return ("Gold III", "🥇")
    elif d <= 365: return ("Platinum", "💎")
    elif d <= 730: return ("Diamond", "⚔️")
    elif d <= 1095: return ("Master", "👑")
    elif d <= 1825: return ("Grandmaster", "🌟")
    elif d <= 3650: return ("Sage", "🔱")
    else: return ("Legend", "☀️")


@router.get("/messages", response_model=List[MessageResponse])
async def get_world_chat_messages(limit: int = 50):
    """Retrieve recent World Chat messages from database with real-time user streaks."""
    try:
        dummy_names = ["Operative_Kobe", "Operative_Titan", "Vanguard_Zero", "Sage_Arjuna"]
        await CommunityMessage.find({"author_name": {"$in": dummy_names}}).delete()

        messages = await CommunityMessage.find_all().sort("-created_at").limit(limit).to_list()
        messages.sort(key=lambda m: m.created_at)

        result = []
        for m in messages:
            streak = m.author_streak or 0
            name = m.author_name
            
            # Look up live user streak and name directly from User collection in MongoDB
            try:
                db_u = None
                if m.user_id and len(m.user_id) == 24:
                    db_u = await User.get(m.user_id)
                if not db_u and m.user_id:
                    db_u = await User.find_one({"$or": [{"_id": m.user_id}, {"id": m.user_id}, {"email": m.user_id}]})
                if not db_u and m.author_name:
                    db_u = await User.find_one({"name": m.author_name})

                if db_u:
                    if db_u.streak is not None:
                        streak = db_u.streak
                    if db_u.name and db_u.name.strip() and not is_invalid_user_identifier(db_u.name):
                        name = db_u.name.split(" ")[0]
            except Exception:
                pass

            rank_tier, rank_badge = get_rank_info_for_days(streak)

            result.append(
                MessageResponse(
                    id=str(m.id),
                    user_id=m.user_id or "user_guest",
                    author_name=name,
                    author_rank=rank_tier,
                    author_badge=rank_badge,
                    author_streak=streak,
                    content=m.content,
                    created_at=format_ist_time(m.created_at),
                    likes_count=m.likes_count,
                )
            )
        return result
    except Exception as e:
        print(f"[ZenWill Community API Warning] DB fetch error ({e}).")
        return []


@router.get("/users/status/{target_identifier}", response_model=UserStatusResponse)
async def get_user_online_status(
    target_identifier: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """Check if target user is currently online or offline based on recent activity."""
    if current_user:
        current_user.last_active_at = datetime.utcnow()
        try:
            await current_user.save()
        except Exception:
            pass

    name = target_identifier.split(" ")[0]
    is_online = False
    last_seen = "Offline"

    if target_identifier and target_identifier not in ["operative", "user_guest", "user_current"]:
        try:
            target_u = None
            if len(target_identifier) == 24:
                target_u = await User.get(target_identifier)
            if not target_u:
                target_u = await User.find_one({"name": target_identifier})

            if target_u:
                name = (target_u.name or name).split(" ")[0]
                if target_u.last_active_at:
                    diff = (datetime.utcnow() - target_u.last_active_at.replace(tzinfo=None)).total_seconds()
                    if diff < 180:  # Active within 3 mins
                        is_online = True
                        last_seen = "Online"
                    else:
                        last_seen = f"Last seen {format_ist_time(target_u.last_active_at)}"
        except Exception as e:
            print(f"[ZenWill Community] Status error: {e}")

    return UserStatusResponse(
        user_id=target_identifier,
        name=name,
        is_online=is_online,
        last_seen=last_seen if not is_online else "Online",
    )


@router.post("/messages", response_model=MessageResponse)
async def post_world_chat_message(payload: CreateMessageRequest):
    """Post a new message to the World Chat database."""
    try:
        author_name = payload.author_name
        author_streak = payload.author_streak
        author_rank = payload.author_rank
        author_badge = payload.author_badge

        if payload.user_id and payload.user_id not in ["user_guest", "user_current"]:
            try:
                db_user = await User.get(payload.user_id)
                if db_user:
                    if db_user.name and db_user.name.strip():
                        author_name = db_user.name
                    if db_user.streak is not None and db_user.streak >= 0:
                        author_streak = db_user.streak
            except Exception as user_err:
                print(f"[ZenWill Community] Could not fetch DB user for ID {payload.user_id}: {user_err}")

        new_msg = CommunityMessage(
            user_id=payload.user_id or "user_guest",
            author_name=author_name,
            author_rank=author_rank,
            author_badge=author_badge,
            author_streak=author_streak,
            content=payload.content,
            created_at=datetime.utcnow(),
            likes_count=0,
        )
        await new_msg.insert()
        return MessageResponse(
            id=str(new_msg.id),
            user_id=new_msg.user_id or "user_guest",
            author_name=new_msg.author_name,
            author_rank=new_msg.author_rank,
            author_badge=new_msg.author_badge,
            author_streak=new_msg.author_streak,
            content=new_msg.content,
            created_at=new_msg.created_at.strftime("%I:%M %p"),
            likes_count=0,
        )
    except Exception as e:
        print(f"[ZenWill Community API Warning] Message insert error ({e}). Returning generated response.")
        now = datetime.utcnow()
        return MessageResponse(
            id=f"local-{now.timestamp()}",
            user_id=payload.user_id or "user_guest",
            author_name=payload.author_name,
            author_rank=payload.author_rank,
            author_badge=payload.author_badge,
            author_streak=payload.author_streak,
            content=payload.content,
            created_at=now.strftime("%I:%M %p"),
            likes_count=0,
        )


_LEADERBOARD_CACHE = {"timestamp": 0, "rankings": []}


@router.get("/rankings", response_model=List[CommunityRankingItem])
async def get_community_rankings():
    """Retrieve real community member rankings directly from MongoDB User collection, refreshed every 3 hours."""
    global _LEADERBOARD_CACHE
    import time
    now_ts = time.time()
    three_hours_seconds = 3 * 3600

    # If cache is valid (< 3 hours old) and non-empty, return cached real rankings
    if _LEADERBOARD_CACHE["rankings"] and (now_ts - _LEADERBOARD_CACHE["timestamp"]) < three_hours_seconds:
        return _LEADERBOARD_CACHE["rankings"]

    try:
        # Clean up any dummy test accounts from DB
        dummy_names = ["Operative_Kobe", "Operative_Titan", "Vanguard_Zero", "Sage_Arjuna"]
        await User.find({"name": {"$in": dummy_names}}).delete()
        await CommunityMessage.find({"author_name": {"$in": dummy_names}}).delete()

        # Fetch real users directly from MongoDB User collection
        users = await User.find_all().sort("-streak").to_list()

        results = []
        rank = 1
        for u in users:
            name = (u.name or u.email.split("@")[0] or "Operative").split(" ")[0]
            # Strict filter: skip dummy test accounts or invalid IDs
            if is_invalid_user_identifier(name) or name in dummy_names:
                continue

            streak = u.streak or 0
            rank_tier, badge = get_rank_info_for_days(streak)

            results.append(
                CommunityRankingItem(
                    rank_number=rank,
                    id=str(u.id),
                    author_name=name,
                    badge=badge,
                    rank_tier=rank_tier,
                    streak_days=streak,
                    mind_strength=u.mind_strength or 50,
                    is_user=False,
                )
            )
            rank += 1

        _LEADERBOARD_CACHE["timestamp"] = now_ts
        _LEADERBOARD_CACHE["rankings"] = results
        return results
    except Exception as e:
        print(f"[ZenWill Community API Warning] get_community_rankings error ({e}).")
        return _LEADERBOARD_CACHE.get("rankings", [])


@router.post("/messages/{message_id}/like")
async def like_community_message(message_id: str):
    """Increment like count for a World Chat message."""
    try:
        msg = await CommunityMessage.get(message_id)
        if msg:
            msg.likes_count += 1
            await msg.save()
            return {"status": "success", "likes_count": msg.likes_count}
    except Exception:
        pass
    return {"status": "success", "likes_count": 1}


# ==============================================================================
# DIRECT MESSAGING (DM) PIPELINE & DATABASE ENDPOINTS
# ==============================================================================

def is_invalid_user_identifier(val: Optional[str]) -> bool:
    if not val or not val.strip():
        return True
    v = val.strip()
    if len(v) == 24 or v.startswith("user_") or v.startswith("usr_") or v.startswith("guest_"):
        return True
    if len(v) >= 20 and "-" in v:
        return True
    return False


async def resolve_user_real_name(user_id_or_name: str, fallback: str = "Operative") -> str:
    """Fetch exact user's real name directly from MongoDB User collection."""
    if not user_id_or_name or not str(user_id_or_name).strip():
        return fallback

    uid = str(user_id_or_name).strip()
    try:
        u = await User.find_one({
            "$or": [
                {"_id": uid},
                {"id": uid},
                {"email": uid},
                {"name": uid}
            ]
        })
        if u and u.name and u.name.strip():
            return u.name.strip().split(" ")[0]
    except Exception as e:
        print(f"[User Lookup Notice] {e}")

    if fallback and fallback.strip() and fallback != "Operative" and not fallback.startswith("user_") and not fallback.startswith("usr_") and "@" not in fallback:
        return fallback.strip().split(" ")[0]

    if not uid.startswith("user_") and not uid.startswith("usr_") and "@" not in uid and len(uid) != 24 and not ("-" in uid and len(uid) >= 20):
        return uid.split(" ")[0]

    return fallback


@router.get("/dm/conversations", response_model=List[ConversationSummary])
async def get_dm_conversations(current_user: Optional[User] = Depends(get_optional_current_user)):
    """Fetch list of all active DM conversations for current user."""
    user_id_str = str(current_user.id) if current_user else "user_current"
    user_name_str = (current_user.name if current_user and current_user.name else "Operative").split(" ")[0]
    try:
        # Clean up any corrupt self-referential or dummy test messages
        await DirectMessage.find({
            "$or": [
                {"sender_id": user_id_str, "receiver_id": user_id_str},
                {"sender_name": "Operative_Kobe"},
                {"sender_name": "Operative_Titan"},
            ]
        }).delete()

        # Fetch all DMs involving current user
        dms = await DirectMessage.find(
            {
                "$or": [
                    {"sender_id": user_id_str},
                    {"receiver_id": user_id_str},
                    {"sender_name": user_name_str},
                    {"receiver_name": user_name_str},
                ]
            }
        ).sort("-created_at").to_list()

        conv_dict = {}
        for dm in dms:
            # Skip invalid self-messages or corrupted records
            if (dm.sender_id == dm.receiver_id and dm.sender_id == user_id_str) or (dm.sender_name == dm.receiver_name and dm.sender_name == user_name_str):
                continue

            is_sender = dm.sender_id == user_id_str or dm.sender_name == user_name_str
            other_id = dm.receiver_id if is_sender else dm.sender_id
            raw_other_name = dm.receiver_name if is_sender else dm.sender_name

            # Resolve actual real user display name directly from MongoDB User collection
            other_name = await resolve_user_real_name(other_id, fallback=raw_other_name)
            other_username = other_name.lower().replace(" ", "_")

            if other_id not in conv_dict and other_name != user_name_str:
                conv_dict[other_id] = ConversationSummary(
                    other_user_id=other_id,
                    other_user_name=other_name,
                    other_user_username=other_username,
                    last_message=dm.content,
                    last_message_at=format_ist_time(dm.created_at),
                    unread_count=1 if (not is_sender and not dm.is_read) else 0,
                )
            elif not is_sender and not dm.is_read and other_id in conv_dict:
                conv_dict[other_id].unread_count += 1

        return list(conv_dict.values())
    except Exception as e:
        print(f"[ZenWill DM API Warning] get_dm_conversations error ({e}).")
        return []


@router.get("/dm/{target_user_identifier}", response_model=List[DirectMessageResponse])
async def get_dm_chat_history(
    target_user_identifier: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """Fetch DM chat history between current user and target user ID or username."""
    user_id_str = str(current_user.id) if current_user else "user_current"
    user_name_str = (current_user.name if current_user and current_user.name else "Operative").split(" ")[0]
    user_email_str = current_user.email if (current_user and current_user.email) else ""
    try:
        target_id = target_user_identifier

        # Resolve target user from DB if possible
        target_name_str = await resolve_user_real_name(target_user_identifier, fallback=target_user_identifier)

        query_conditions = [
            {"sender_id": user_id_str, "receiver_id": target_id},
            {"sender_id": target_id, "receiver_id": user_id_str},
            {"sender_id": user_id_str, "receiver_name": target_name_str},
            {"sender_name": target_name_str, "receiver_id": user_id_str},
            {"sender_id": target_id, "receiver_name": user_name_str},
            {"sender_name": user_name_str, "receiver_name": target_name_str},
            {"sender_name": target_name_str, "receiver_name": user_name_str},
        ]
        if user_email_str:
            query_conditions.extend([
                {"sender_id": user_email_str, "receiver_id": target_id},
                {"sender_id": target_id, "receiver_id": user_email_str},
            ])

        dms = await DirectMessage.find({"$or": query_conditions}).sort("created_at").to_list()

        # Mark incoming unread messages as read
        for dm in dms:
            if (dm.receiver_id == user_id_str or dm.receiver_name == user_name_str) and not dm.is_read:
                dm.is_read = True
                await dm.save()

        return [
            DirectMessageResponse(
                id=str(d.id),
                sender_id=d.sender_id,
                sender_name=d.sender_name,
                sender_username=d.sender_username,
                receiver_id=d.receiver_id,
                receiver_name=d.receiver_name,
                receiver_username=d.receiver_username,
                content=d.content,
                message_type=d.message_type or "text",
                audio_duration=d.audio_duration,
                is_read=d.is_read,
                created_at=format_ist_time(d.created_at),
            )
            for d in dms
        ]
    except Exception as e:
        print(f"[ZenWill DM API Warning] get_dm_chat_history error ({e}).")
        return []


@router.post("/dm/{target_user_identifier}", response_model=DirectMessageResponse)
async def send_direct_message(
    target_user_identifier: str,
    payload: DirectMessageSendRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """Send a direct message to target user and save cleanly to MongoDB."""
    user_id_str = str(current_user.id) if current_user else "user_current"
    sender_name = current_user.name.split(" ")[0] if (current_user and current_user.name) else await resolve_user_real_name(user_id_str, "Operative")
    sender_username = sender_name.lower().replace(" ", "_")

    target_id = payload.receiver_id or target_user_identifier
    target_name = await resolve_user_real_name(target_id, fallback=target_user_identifier)
    if target_name == "Operative" or target_name == target_user_identifier:
        target_name = await resolve_user_real_name(target_user_identifier, fallback="Operative")
    target_username = target_name.lower().replace(" ", "_")

    new_dm = DirectMessage(
        sender_id=user_id_str,
        sender_name=sender_name,
        sender_username=sender_username,
        receiver_id=target_id,
        receiver_name=target_name,
        receiver_username=target_username,
        content=payload.content,
        message_type=payload.message_type or "text",
        audio_duration=payload.audio_duration,
        is_read=False,
        created_at=datetime.utcnow(),
    )
    await new_dm.insert()

    return DirectMessageResponse(
        id=str(new_dm.id),
        sender_id=new_dm.sender_id,
        sender_name=new_dm.sender_name,
        sender_username=new_dm.sender_username,
        receiver_id=new_dm.receiver_id,
        receiver_name=new_dm.receiver_name,
        receiver_username=new_dm.receiver_username,
        content=new_dm.content,
        message_type=new_dm.message_type,
        audio_duration=new_dm.audio_duration,
        is_read=new_dm.is_read,
        created_at=format_ist_time(new_dm.created_at),
    )


@router.get("/users/search")
async def search_operatives(q: str = Query(..., min_length=1)):
    """Search registered users / operatives by username or display name."""
    try:
        users = await User.find(
            {"name": {"$regex": q, "$options": "i"}}
        ).limit(10).to_list()

        results = [
            {
                "id": str(u.id),
                "name": u.name or "Operative",
                "username": (u.name or "operative").lower().replace(" ", "_"),
                "badge": "🛡️",
            }
            for u in users
        ]

        # Also search CommunityMessage senders if user list is small
        if len(results) < 5:
            c_msgs = await CommunityMessage.find(
                {"author_name": {"$regex": q, "$options": "i"}}
            ).limit(10).to_list()

            existing_names = {r["name"] for r in results}
            for m in c_msgs:
                if m.author_name and m.author_name not in existing_names:
                    existing_names.add(m.author_name)
                    results.append({
                        "id": m.user_id or f"user_{m.author_name.lower()}",
                        "name": m.author_name,
                        "username": m.author_name.lower().replace(" ", "_"),
                        "badge": m.author_badge or "⚔️",
                    })

        return results
    except Exception as e:
        print(f"[ZenWill DM Search Warning] search_operatives error ({e}).")
        return []
