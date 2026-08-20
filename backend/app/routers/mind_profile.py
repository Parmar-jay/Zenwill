from fastapi import APIRouter, Depends
from app.models.user import User
from app.schemas.analytics import MindProfileResponse
from app.middleware.auth_middleware import get_current_user
from app.services.mind_profile_service import get_or_create_mind_profile

router = APIRouter(prefix="/mind-profile", tags=["Mind Profile"])


@router.get("/", response_model=MindProfileResponse)
async def get_mind_profile(
    current_user: User = Depends(get_current_user),
):
    profile = await get_or_create_mind_profile(current_user)
    return MindProfileResponse(
        id=str(profile.id),
        user_id=str(profile.user_id),
        mind_strength=profile.mind_strength,
        recovery_days=profile.recovery_days,
        current_flow=profile.current_flow,
        longest_flow=profile.longest_flow,
        avg_sleep_quality=profile.avg_sleep_quality,
        avg_stress_level=profile.avg_stress_level,
        avg_mood=profile.avg_mood,
        avg_energy=profile.avg_energy,
        avg_focus=profile.avg_focus,
        avg_urge_intensity=profile.avg_urge_intensity,
        risk_score_today=profile.risk_score_today,
        predicted_trigger_time=profile.predicted_trigger_time,
        predicted_trigger_type=profile.predicted_trigger_type,
        top_triggers=profile.top_triggers or [],
        top_coping_strategies=profile.top_coping_strategies or [],
        high_risk_times=profile.high_risk_times or [],
        urge_free_days=profile.urge_free_days,
        total_checkins=profile.total_checkins,
        total_missions_completed=profile.total_missions_completed,
        total_journal_entries=profile.total_journal_entries,
        total_emergency_sessions=profile.total_emergency_sessions,
        successful_emergency_sessions=profile.successful_emergency_sessions,
        last_relapse_at=profile.last_relapse_at,
        last_checkin_at=profile.last_checkin_at,
        updated_at=profile.updated_at,
    )
