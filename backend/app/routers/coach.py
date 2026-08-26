from fastapi import APIRouter, Depends
from typing import List
from datetime import datetime
import uuid as uuid_module
from app.models.user import User
from app.models.chat_message import ChatMessage
from app.schemas.coach import CoachMessageRequest, CoachMessageResponse, ChatHistoryMessage
from app.middleware.auth_middleware import get_current_user
from app.services.ai_service import ai_service
from app.services.mind_profile_service import get_or_create_mind_profile, get_profile_summary

router = APIRouter(prefix="/coach", tags=["AI Coach"])


@router.post("/message", response_model=CoachMessageResponse)
async def send_message(
    payload: CoachMessageRequest,
    current_user: User = Depends(get_current_user),
):
    session_id = payload.session_id or str(uuid_module.uuid4())
    user_id_str = str(current_user.id)
    user_email = current_user.email if current_user.email else ""
    query = {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]} if user_email else {"user_id": user_id_str}

    # Load last 14 messages (7 full conversation turns) for context
    history_rows = await ChatMessage.find(query).sort("-created_at").limit(14).to_list()
    history_rows = list(reversed(history_rows))
    history = [{"role": m.role, "content": m.content} for m in history_rows]

    # Get mind profile for context
    profile = await get_or_create_mind_profile(current_user)
    profile_summary = get_profile_summary(profile)

    # Store user message in MongoDB
    user_msg = ChatMessage(
        user_id=user_id_str,
        role="user",
        content=payload.message,
        emotional_context=payload.emotional_context,
        session_id=session_id,
    )
    await user_msg.save()

    # Determine real-time time of day and temporal context
    time_of_day = payload.time_of_day
    if not time_of_day:
        now_hour = datetime.utcnow().hour
        time_of_day = "Morning" if 5 <= now_hour < 12 else ("Afternoon" if 12 <= now_hour < 18 else ("Evening" if 18 <= now_hour < 23 else "Late Night"))

    local_time_val = payload.local_time or datetime.utcnow().strftime("%I:%M %p")
    local_date_val = payload.local_date or datetime.utcnow().strftime("%A, %B %d, %Y")
    timezone_val = payload.timezone or "UTC"

    # Generate AI reply via Gemini
    from app.services.gemini_service import get_chat_response
    user_ctx = {
        "name": current_user.name or "Warrior",
        "streak": getattr(current_user, "streak", 0),
        "total_urges_count": profile_summary.get("total_urges_count", 0),
        "time_of_day": time_of_day,
        "local_time": local_time_val,
        "local_date": local_date_val,
        "timezone": timezone_val,
        "mind_strength": getattr(profile, "mind_strength", 75),
    }
    reply = await get_chat_response(messages=history + [{"role": "user", "content": payload.message}], user_context=user_ctx)

    # Detect emotional context from reply
    detected_context = _detect_emotional_context(payload.message)

    # Store assistant reply in MongoDB
    assistant_msg = ChatMessage(
        user_id=user_id_str,
        role="assistant",
        content=reply,
        emotional_context=detected_context,
        session_id=session_id,
    )
    await assistant_msg.save()

    # Build suggested actions
    suggested_actions = _get_suggested_actions(detected_context, profile_summary)

    return CoachMessageResponse(
        reply=reply,
        session_id=session_id,
        emotional_context_detected=detected_context,
        suggested_actions=suggested_actions,
        created_at=datetime.utcnow(),
    )


@router.get("/history", response_model=List[ChatHistoryMessage])
async def get_chat_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
):
    user_id_str = str(current_user.id)
    user_email = current_user.email if current_user.email else ""
    query = {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]} if user_email else {"user_id": user_id_str}

    messages = await ChatMessage.find(query).sort("-created_at").limit(limit).to_list()
    messages = list(reversed(messages))

    return [
        ChatHistoryMessage(
            id=str(m.id),
            role=m.role,
            content=m.content,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.delete("/history")
async def clear_chat_history(
    current_user: User = Depends(get_current_user),
):
    """Clear all stored AI Coach chat messages for the current user."""
    user_id_str = str(current_user.id)
    user_email = current_user.email if current_user.email else ""
    query = {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]} if user_email else {"user_id": user_id_str}

    await ChatMessage.find(query).delete()
    return {"status": "success", "message": "Chat history cleared"}


def _detect_emotional_context(message: str) -> str:
    """Simple keyword-based emotional context detection."""
    message_lower = message.lower()
    if any(w in message_lower for w in ["urge", "craving", "want to", "tempted", "about to"]):
        return "urge"
    if any(w in message_lower for w in ["relapsed", "failed", "slipped", "gave in"]):
        return "relapse"
    if any(w in message_lower for w in ["stressed", "anxious", "overwhelmed", "worried"]):
        return "stressed"
    if any(w in message_lower for w in ["proud", "succeeded", "resisted", "strong", "great"]):
        return "motivated"
    if any(w in message_lower for w in ["sad", "lonely", "depressed", "empty", "hopeless"]):
        return "low_mood"
    return "general"


def _get_suggested_actions(context: str, profile: dict) -> List[str]:
    """Return quick action suggestions based on emotional context."""
    action_map = {
        "urge": ["Open Emergency SOS", "Start Breathing Exercise", "Read Your Purpose"],
        "relapse": ["Log this as a learning event", "Talk to your coach", "Review your triggers"],
        "stressed": ["Try 5-minute Breathing", "Take a 10-minute walk", "Write in your journal"],
        "motivated": ["Complete a Mission", "Write about this win in your journal", "Set a new goal"],
        "low_mood": ["Read your purpose statement", "Reach out to someone", "Do a 5-minute meditation"],
        "general": ["Submit today's check-in", "Review your progress", "Complete a mission"],
    }
    return action_map.get(context, action_map["general"])
