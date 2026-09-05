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
    DirectMessageUnreadResponse,
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
    
    now_ist = datetime.now(IST)
    if dt.date() == now_ist.date():
        return dt.strftime("%I:%M %p")
    elif dt.date() == (now_ist - timedelta(days=1)).date():
        return "Yesterday, " + dt.strftime("%I:%M %p")
    else:
        return dt.strftime("%b %d, %I:%M %p")


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
    """Retrieve recent World Chat messages from database with instant batch resolution."""
    try:
        # Permanently purge any legacy system/battle horn notifications from MongoDB
        await CommunityMessage.find({
            "$or": [
                {"user_id": {"$regex": "^spartan_", "$options": "i"}},
                {"author_name": {"$regex": "BATTLE HORN|🚨|Spartan Cell Shield", "$options": "i"}},
                {"content": {"$regex": "90-Second Sync Room active|nudged Brother", "$options": "i"}},
            ]
        }).delete()

        # Fetch only genuine real user messages
        messages = await CommunityMessage.find({
            "user_id": {"$nin": ["spartan_battle_horn", "spartan_system", "system"]},
            "author_name": {"$not": {"$regex": "BATTLE HORN|🚨|Shield", "$options": "i"}},
        }).sort("-created_at").limit(limit).to_list()
        messages.sort(key=lambda m: m.created_at)

        # Comprehensive batch lookup: map users by ObjectId, id string, email, and name
        raw_ids = []
        user_ids = []
        emails = []
        names = []

        from bson import ObjectId

        for m in messages:
            uid = (m.user_id or "").strip()
            if uid and uid not in ["user_guest", "user_current", "operative"]:
                user_ids.append(uid)
                if "@" in uid:
                    emails.append(uid.lower())
                else:
                    try:
                        raw_ids.append(ObjectId(uid))
                    except Exception:
                        pass
            auth_name = (m.author_name or "").strip()
            if auth_name and auth_name not in ["Operative", "You"]:
                names.append(auth_name)

        users_map = {}
        query_clauses = []
        if raw_ids:
            query_clauses.append({"_id": {"$in": raw_ids}})
        if user_ids:
            query_clauses.append({"id": {"$in": user_ids}})
        if emails:
            query_clauses.append({"email": {"$in": emails}})
        if names:
            query_clauses.append({"name": {"$in": names}})

        if query_clauses:
            try:
                db_users = await User.find({"$or": query_clauses}).to_list()
                for u in db_users:
                    u_id_str = str(u.id)
                    users_map[u_id_str] = u
                    users_map[u_id_str.lower()] = u
                    if hasattr(u, "_id") and u._id:
                        users_map[str(u._id)] = u
                        users_map[str(u._id).lower()] = u
                    if u.email:
                        users_map[u.email.lower()] = u
                    if u.name:
                        users_map[u.name.strip()] = u
                        users_map[u.name.strip().lower()] = u
            except Exception as err:
                print(f"[ZenWill Community] Live User DB batch lookup notice: {err}")

        result = []
        for m in messages:
            # Default to message payload fallback
            streak = m.author_streak or 0
            name = m.author_name or "Operative"

            # Check live MongoDB user document by ID, email, or author name
            db_u = (
                users_map.get(m.user_id)
                or users_map.get((m.user_id or "").lower())
                or users_map.get(m.author_name)
                or users_map.get((m.author_name or "").strip())
                or users_map.get((m.author_name or "").strip().lower())
            )

            if db_u:
                # Always prioritize the live up-to-date streak directly from the User database
                if db_u.streak is not None and db_u.streak >= 0:
                    streak = db_u.streak
                if db_u.name and db_u.name.strip():
                    name = db_u.name.strip()
                elif db_u.email:
                    name = db_u.email.split("@")[0].strip()

            if "@" in name:
                name = name.split("@")[0].strip()
            if not name:
                name = "Operative"

            # Compute current live rank tier and badge from the updated database streak
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
            created_at=format_ist_time(new_msg.created_at),
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
            created_at=format_ist_time(now),
            likes_count=0,
        )


_LEADERBOARD_CACHE = {"timestamp": 0, "rankings": []}


@router.get("/rankings", response_model=List[CommunityRankingItem])
async def get_community_rankings():
    """Retrieve real community member rankings directly from MongoDB User collection with instant live syncing."""
    global _LEADERBOARD_CACHE
    import time
    now_ts = time.time()
    # Low cache (5 seconds) to prevent spam while delivering real-time live rankings
    cache_ttl = 5

    if _LEADERBOARD_CACHE["rankings"] and (now_ts - _LEADERBOARD_CACHE["timestamp"]) < cache_ttl:
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
        seen_user_ids = set()
        for u in users:
            uid = str(u.id)
            if uid in seen_user_ids:
                continue
            seen_user_ids.add(uid)

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


async def resolve_user_real_name(user_id_or_name: str, fallback: str = "Former Member") -> str:
    """Fetch exact user's real name directly from MongoDB User collection. If deleted, return 'Former Member'."""
    if not user_id_or_name or not str(user_id_or_name).strip():
        return "Former Member"

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
        if u:
            if u.is_scheduled_for_deletion or not u.is_active:
                return "Former Member"
            if u.name and u.name.strip():
                return u.name.strip().split(" ")[0]
    except Exception as e:
        print(f"[User Lookup Notice] {e}")

    if fallback and fallback.strip() and fallback not in ["Operative", "Former Member"] and not fallback.startswith("user_") and not fallback.startswith("usr_") and "@" not in fallback:
        return fallback.strip().split(" ")[0]

    if not uid.startswith("user_") and not uid.startswith("usr_") and "@" not in uid and len(uid) != 24 and not ("-" in uid and len(uid) >= 20):
        return uid.split(" ")[0]

    return "Former Member"


@router.get("/dm/unread-count", response_model=DirectMessageUnreadResponse)
async def get_dm_unread_count(current_user: Optional[User] = Depends(get_optional_current_user)):
    """Fetch unread DM count and latest unread message summary in real time with zero lag."""
    if not current_user:
        return DirectMessageUnreadResponse(unread_count=0)

    user_id_str = str(current_user.id)
    user_email_str = (current_user.email or "").strip().lower()
    my_ids = [user_id_str]
    if user_email_str:
        my_ids.append(user_email_str)

    try:
        unreads = await DirectMessage.find({
            "receiver_id": {"$in": my_ids},
            "is_read": False,
        }).sort("-created_at").to_list()

        # Exclude any self-sent messages
        filtered = [u for u in unreads if u.sender_id not in my_ids]

        if not filtered:
            return DirectMessageUnreadResponse(unread_count=0)

        latest = filtered[0]
        return DirectMessageUnreadResponse(
            unread_count=len(filtered),
            latest_sender_name=latest.sender_name or "Brother",
            latest_sender_id=latest.sender_id,
            latest_message=latest.content,
            latest_created_at=format_ist_time(latest.created_at),
        )
    except Exception as e:
        print(f"[ZenWill DM API Warning] get_dm_unread_count error ({e})")
        return DirectMessageUnreadResponse(unread_count=0)


@router.get("/dm/conversations", response_model=List[ConversationSummary])
async def get_dm_conversations(current_user: Optional[User] = Depends(get_optional_current_user)):
    """Fetch list of active DM conversations STRICTLY for the current authenticated user."""
    if not current_user:
        return []

    user_id_str = str(current_user.id)
    user_email_str = current_user.email or ""
    user_name_str = (current_user.name if current_user.name else "Warrior").split(" ")[0]

    try:
        # Clean up any corrupt self-referential or dummy test messages
        await DirectMessage.find({
            "$or": [
                {"sender_id": user_id_str, "receiver_id": user_id_str},
                {"sender_id": user_email_str, "receiver_id": user_email_str},
                {"sender_name": "Operative_Kobe"},
                {"sender_name": "Operative_Titan"},
            ]
        }).delete()

        # STRICT ISOLATION: Fetch only DMs where the current user is strictly the sender or receiver
        user_ids = [user_id_str]
        if user_email_str:
            user_ids.append(user_email_str)

        dms = await DirectMessage.find(
            {
                "$or": [
                    {"sender_id": {"$in": user_ids}},
                    {"receiver_id": {"$in": user_ids}},
                ]
            }
        ).sort("-created_at").to_list()

        conv_dict = {}
        for dm in dms:
            # Check whether current user is sender or receiver
            is_sender = dm.sender_id in user_ids
            is_receiver = dm.receiver_id in user_ids

            # If user is neither, skip (strict privacy check)
            if not is_sender and not is_receiver:
                continue

            # Skip self messages
            other_id = dm.receiver_id if is_sender else dm.sender_id
            if other_id in user_ids or other_id == "user_current":
                continue

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
    """Fetch DM chat history STRICTLY between current user and target user ID."""
    if not current_user:
        return []

    user_id_str = str(current_user.id)
    user_email_str = current_user.email or ""
    my_ids = [user_id_str]
    if user_email_str:
        my_ids.append(user_email_str)

    target_id = target_user_identifier
    target_ids = [target_id]

    try:
        if "@" in target_id:
            t_user = await User.find_one({"email": target_id})
            if t_user:
                target_ids.append(str(t_user.id))
        else:
            try:
                from bson import ObjectId
                t_user = await User.find_one({"_id": ObjectId(target_id)})
                if t_user and t_user.email:
                    target_ids.append(t_user.email)
            except Exception:
                pass
    except Exception:
        pass

    try:
        query_conditions = [
            {"sender_id": {"$in": my_ids}, "receiver_id": {"$in": target_ids}},
            {"sender_id": {"$in": target_ids}, "receiver_id": {"$in": my_ids}},
        ]

        dms = await DirectMessage.find({"$or": query_conditions}).sort("created_at").to_list()

        # Mark incoming unread messages as read
        for dm in dms:
            if dm.receiver_id in my_ids and not dm.is_read:
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
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required to send direct messages.")

    user_id_str = str(current_user.id)
    sender_name = current_user.name.split(" ")[0] if current_user.name else "Operative"
    sender_username = (current_user.name or "operative").lower().replace(" ", "_")

    target_id = payload.receiver_id or target_user_identifier
    target_name = await resolve_user_real_name(target_id, fallback=target_user_identifier)
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


@router.delete("/dm/{target_user_identifier}")
async def delete_dm_conversation(
    target_user_identifier: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """Delete all direct messages between the current user and target user."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required to delete direct messages.")

    user_id_str = str(current_user.id)
    user_email_str = (current_user.email or "").strip().lower()
    user_name_str = (current_user.name or "").strip()
    my_ids = [user_id_str, "user_current"]
    if user_email_str:
        my_ids.append(user_email_str)
    if user_name_str:
        my_ids.append(user_name_str)

    target_id = target_user_identifier.strip()
    target_ids = [target_id, target_id.lower()]

    try:
        from bson import ObjectId
        t_user = None
        if "@" in target_id:
            t_user = await User.find_one({"email": {"$regex": f"^{target_id}$", "$options": "i"}})
        else:
            try:
                t_user = await User.find_one({"_id": ObjectId(target_id)})
            except Exception:
                pass
            if not t_user:
                t_user = await User.find_one({"$or": [{"name": target_id}, {"id": target_id}, {"email": target_id}]})

        if t_user:
            target_ids.append(str(t_user.id))
            if t_user.email:
                target_ids.append(t_user.email.lower())
            if t_user.name:
                target_ids.append(t_user.name)
    except Exception as e:
        print(f"[ZenWill DM API Warning] Target lookup notice: {e}")

    try:
        delete_result = await DirectMessage.find({
            "$or": [
                {"sender_id": {"$in": my_ids}, "receiver_id": {"$in": target_ids}},
                {"sender_id": {"$in": target_ids}, "receiver_id": {"$in": my_ids}},
                {"sender_name": {"$in": my_ids}, "receiver_name": {"$in": target_ids}},
                {"sender_name": {"$in": target_ids}, "receiver_name": {"$in": my_ids}},
            ]
        }).delete()

        return {
            "status": "success",
            "message": "Conversation deleted successfully",
            "deleted_count": getattr(delete_result, "deleted_count", 0),
        }
    except Exception as e:
        print(f"[ZenWill DM API Warning] delete_dm_conversation error ({e}).")
        raise HTTPException(status_code=500, detail="Failed to delete conversation.")


@router.get("/users/search")
async def search_operatives(
    q: str = Query(..., min_length=1),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """Search registered users directly from the User collection by name or email."""
    try:
        query_str = q.strip()
        if not query_str:
            return []

        # Query real users from database matching name or email prefix
        db_users = await User.find(
            {
                "$and": [
                    {"is_active": True},
                    {"is_scheduled_for_deletion": {"$ne": True}},
                    {
                        "$or": [
                            {"name": {"$regex": query_str, "$options": "i"}},
                            {"email": {"$regex": query_str, "$options": "i"}},
                        ]
                    },
                ]
            }
        ).limit(20).to_list()

        current_user_id = str(current_user.id) if current_user else None
        current_user_email = (current_user.email or "").lower() if current_user else None

        results = []
        for u in db_users:
            u_id = str(u.id)
            u_email = (u.email or "").lower()

            # Exclude current user from their own search
            if current_user_id and u_id == current_user_id:
                continue
            if current_user_email and u_email == current_user_email:
                continue

            streak_days = u.streak or 0
            rank_tier, badge = get_rank_info_for_days(streak_days)
            display_name = u.name or (u_email.split("@")[0] if u_email else "Operative")
            username = (u.name or (u_email.split("@")[0] if u_email else "operative")).lower().replace(" ", "_")

            results.append({
                "id": u_id,
                "name": display_name,
                "username": username,
                "badge": badge,
                "rank": rank_tier,
                "streak": streak_days,
            })

        return results
    except Exception as e:
        print(f"[ZenWill User Search Error] search_operatives error ({e}).")
        return []
