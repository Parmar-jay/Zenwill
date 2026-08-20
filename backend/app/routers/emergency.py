from fastapi import APIRouter, Depends
from datetime import datetime
from app.models.user import User
from app.models.emergency_session import EmergencySession
from app.models.behavioral_event import BehavioralEvent
from app.schemas.analytics import EmergencyStartRequest, EmergencyCompleteRequest, EmergencyStartResponse
from app.middleware.auth_middleware import get_current_user
from app.services.ai_service import ai_service
from app.services.mind_profile_service import get_or_create_mind_profile, get_profile_summary, record_emergency_outcome

router = APIRouter(prefix="/emergency", tags=["Emergency"])


@router.post("/start", response_model=EmergencyStartResponse)
async def start_emergency_session(
    payload: EmergencyStartRequest,
    current_user: User = Depends(get_current_user),
):
    profile = await get_or_create_mind_profile(current_user)
    profile_summary = get_profile_summary(profile)

    # Generate personalized intervention
    plan, techniques = await ai_service.generate_emergency_intervention(
        urge_intensity=payload.urge_intensity,
        trigger_type=payload.trigger_type,
        emotional_state=payload.emotional_state,
        profile=profile_summary,
        user_name=current_user.name or "there",
    )

    # Create session record
    session = EmergencySession(
        user_id=str(current_user.id),
        urge_intensity=payload.urge_intensity,
        trigger_type=payload.trigger_type,
        emotional_state=payload.emotional_state,
        environment=payload.environment,
        ai_intervention_plan=plan,
        techniques_offered=[t["id"] for t in techniques],
    )
    await session.insert()

    return EmergencyStartResponse(
        session_id=str(session.id),
        ai_intervention_plan=plan,
        techniques_offered=techniques,
        message=f"You've got this, {current_user.name or 'friend'}. Let's work through this together.",
    )


@router.post("/complete")
async def complete_emergency_session(
    payload: EmergencyCompleteRequest,
    current_user: User = Depends(get_current_user),
):
    session = None
    if payload.session_id:
        session = await EmergencySession.find_one(EmergencySession.id == payload.session_id)

    if not session:
        session = EmergencySession(
            user_id=str(current_user.id),
            urge_intensity=payload.urge_intensity_before or 5,
            trigger_type=payload.trigger_reason or "Urge Surfing",
            emotional_state="Surfed",
        )

    session.techniques_used = payload.techniques_used or ["Urge Surfing"]
    session.outcome = payload.outcome or "resisted"
    session.urge_intensity_after = payload.urge_intensity_after if payload.urge_intensity_after is not None else 1
    session.duration_minutes = payload.duration_minutes or 2
    session.most_helpful_technique = payload.main_influence or payload.most_helpful_technique or "Urge Surfing Wave"
    session.user_feedback = payload.thought_note or payload.user_feedback or "Completed urge surfing session."
    session.was_effective = payload.was_effective if payload.was_effective is not None else True
    session.trigger_reason = payload.trigger_reason
    session.main_influence = payload.main_influence
    session.urge_surfing_completed = True
    session.completed_at = datetime.utcnow()
    await session.save()

    # Update mind profile based on outcome
    profile = await get_or_create_mind_profile(current_user)
    profile.total_emergency_sessions = (profile.total_emergency_sessions or 0) + 1
    if session.was_effective or payload.outcome == "resisted":
        profile.successful_emergency_sessions = (profile.successful_emergency_sessions or 0) + 1
    await record_emergency_outcome(profile, payload.outcome or "resisted", session.techniques_used)
    await profile.save()

    # Calculate total and today urge count for current user
    user_id_str = str(current_user.id)
    all_sessions = await EmergencySession.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": current_user.email}]}
    ).to_list()

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    total_urges_count = len(all_sessions)
    today_urges_count = sum(
        1 for s in all_sessions
        if (s.completed_at and s.completed_at.strftime("%Y-%m-%d") == today_str)
        or (s.started_at and s.started_at.strftime("%Y-%m-%d") == today_str)
    )

    # Log deep BehavioralEvent snapshot
    now = datetime.utcnow()
    event = BehavioralEvent(
        user_id=user_id_str,
        user_email=current_user.email,
        user_name=current_user.name or "Operative",
        user_streak=current_user.streak,
        mind_strength_at_event=profile.mind_strength,
        event_type="urge_surfing_completed",
        screen_name="UrgeSurfingScreen",
        feature_name="Urge Surfing Protocol",
        trigger_context=payload.trigger_reason or "Urge Spike",
        outcome=payload.outcome or "resisted",
        intensity=float(payload.urge_intensity_before or session.urge_intensity or 5),
        impact_score=+5.0 if (session.was_effective or payload.outcome == "resisted") else -2.0,
        duration_seconds=float((payload.duration_minutes or 2) * 60),
        hour_of_day=now.hour,
        day_of_week=now.weekday(),
        event_metadata={
            "was_effective": payload.was_effective,
            "main_influence": payload.main_influence,
            "trigger_reason": payload.trigger_reason,
            "urge_intensity_before": payload.urge_intensity_before,
            "urge_intensity_after": payload.urge_intensity_after,
            "thought_note": payload.thought_note,
        },
        created_at=now,
    )
    await event.insert()

    return {
        "success": True,
        "outcome": payload.outcome or "resisted",
        "message": "Urge surfing session recorded successfully! Urge count updated.",
        "mind_strength": profile.mind_strength,
        "total_urges_count": total_urges_count,
        "today_urges_count": today_urges_count,
    }
