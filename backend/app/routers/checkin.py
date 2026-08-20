from fastapi import APIRouter, Depends, HTTPException
from datetime import date, datetime
from app.models.user import User
from app.models.daily_checkin import DailyCheckin
from app.models.behavioral_event import BehavioralEvent
from app.schemas.checkin import DailyCheckinRequest, DailyCheckinResponse
from app.middleware.auth_middleware import get_current_user
from app.services.mind_profile_service import get_or_create_mind_profile, update_from_checkin
from app.services.mission_service import generate_todays_missions

router = APIRouter(prefix="/checkin", tags=["Daily Check-in"])


@router.post("/", response_model=DailyCheckinResponse, status_code=201)
async def submit_checkin(
    payload: DailyCheckinRequest,
    current_user: User = Depends(get_current_user),
):
    checkin_date = payload.date or date.today()

    # If check-in already submitted for today, update existing record seamlessly
    checkin = await DailyCheckin.find_one(
        DailyCheckin.user_id == str(current_user.id),
        DailyCheckin.date == checkin_date,
    )
    if not checkin:
        checkin = DailyCheckin(
            user_id=str(current_user.id),
            date=checkin_date,
        )

    checkin.mood = payload.mood
    checkin.mood_intensity = payload.mood_intensity
    checkin.mood_factors = payload.mood_factors or []
    checkin.energy_score = payload.energy_score
    checkin.energy_category = payload.energy_category
    checkin.energy_factors = payload.energy_factors or []
    checkin.stress_score = payload.stress_score
    checkin.stress_causes = payload.stress_causes or []
    checkin.sleep_duration = payload.sleep_duration
    checkin.sleep_quality = payload.sleep_quality
    checkin.rested_status = payload.rested_status
    checkin.urge_intensity = payload.urge_intensity
    checkin.primary_triggers = payload.primary_triggers or []
    checkin.action_taken = payload.action_taken
    checkin.relapse_occurred = payload.relapse_occurred
    checkin.pornography_involved = payload.pornography_involved
    checkin.session_duration = payload.session_duration
    checkin.post_relapse_emotions = payload.post_relapse_emotions or []
    checkin.focus_score = payload.focus_score
    checkin.focus_factors = payload.focus_factors or []
    checkin.reflection_question = payload.reflection_question
    checkin.reflection_response = payload.reflection_response

    await checkin.save()

    # Update mind profile
    profile = await get_or_create_mind_profile(current_user)
    await update_from_checkin(profile, checkin)

    # Log deep BehavioralEvent snapshot for AI pattern intelligence
    now = datetime.utcnow()
    event = BehavioralEvent(
        user_id=str(current_user.id),
        user_email=current_user.email,
        user_name=current_user.name or "Operative",
        user_streak=current_user.streak,
        mind_strength_at_event=profile.mind_strength,
        event_type="daily_checkin_submitted",
        screen_name="DailyCheckin",
        feature_name="Daily Check-in Flow",
        emotional_state=checkin.mood,
        trigger_context=", ".join(checkin.primary_triggers) if checkin.primary_triggers else None,
        outcome="relapsed" if checkin.relapse_occurred else "retained",
        intensity=float(checkin.urge_intensity) if checkin.urge_intensity is not None else 0.0,
        impact_score=-8.0 if checkin.relapse_occurred else +5.0,
        hour_of_day=now.hour,
        day_of_week=now.weekday(),
        event_metadata={
            "mood": checkin.mood,
            "energy": checkin.energy_score,
            "stress": checkin.stress_score,
            "sleep_duration": checkin.sleep_duration,
            "relapse_occurred": checkin.relapse_occurred,
            "triggers": checkin.primary_triggers,
        },
        created_at=now,
    )
    await event.insert()

    # Generate today's missions
    missions = await generate_todays_missions(str(current_user.id), profile, checkin)
    checkin.ai_risk_score = profile.risk_score_today
    checkin.ai_mission_ids = [str(m.id) for m in missions]

    await checkin.save()

    # Update User Streak & Gamification Stats
    if payload.relapse_occurred:
        current_user.streak = 0

    current_user.last_checkin_date = checkin_date.isoformat()
    await current_user.save()

    return DailyCheckinResponse(
        id=str(checkin.id),
        date=checkin.date,
        mood=checkin.mood,
        mood_intensity=checkin.mood_intensity,
        mood_factors=checkin.mood_factors or [],
        energy_score=checkin.energy_score,
        energy_category=checkin.energy_category,
        energy_factors=checkin.energy_factors or [],
        stress_score=checkin.stress_score,
        stress_causes=checkin.stress_causes or [],
        sleep_duration=checkin.sleep_duration,
        sleep_quality=checkin.sleep_quality,
        rested_status=checkin.rested_status,
        urge_intensity=checkin.urge_intensity,
        primary_triggers=checkin.primary_triggers or [],
        action_taken=checkin.action_taken,
        relapse_occurred=checkin.relapse_occurred,
        pornography_involved=checkin.pornography_involved,
        session_duration=checkin.session_duration,
        post_relapse_emotions=checkin.post_relapse_emotions or [],
        focus_score=checkin.focus_score,
        focus_factors=checkin.focus_factors or [],
        reflection_question=checkin.reflection_question,
        reflection_response=checkin.reflection_response,
        ai_summary=checkin.ai_summary,
        ai_risk_score=checkin.ai_risk_score,
        ai_insight=checkin.ai_insight,
        ai_mission_ids=checkin.ai_mission_ids or [],
        created_at=checkin.created_at,
    )


@router.get("/today", response_model=DailyCheckinResponse | None)
async def get_todays_checkin(
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    checkin = await DailyCheckin.find_one(
        DailyCheckin.user_id == str(current_user.id),
        DailyCheckin.date == today,
    )
    if not checkin:
        return None

    return DailyCheckinResponse(
        id=str(checkin.id),
        date=checkin.date,
        mood=checkin.mood,
        mood_intensity=checkin.mood_intensity,
        mood_factors=checkin.mood_factors or [],
        energy_score=checkin.energy_score,
        energy_category=checkin.energy_category,
        energy_factors=checkin.energy_factors or [],
        stress_score=checkin.stress_score,
        stress_causes=checkin.stress_causes or [],
        sleep_duration=checkin.sleep_duration,
        sleep_quality=checkin.sleep_quality,
        rested_status=checkin.rested_status,
        urge_intensity=checkin.urge_intensity,
        primary_triggers=checkin.primary_triggers or [],
        action_taken=checkin.action_taken,
        relapse_occurred=checkin.relapse_occurred,
        pornography_involved=checkin.pornography_involved,
        session_duration=checkin.session_duration,
        post_relapse_emotions=checkin.post_relapse_emotions or [],
        focus_score=checkin.focus_score,
        focus_factors=checkin.focus_factors or [],
        reflection_question=checkin.reflection_question,
        reflection_response=checkin.reflection_response,
        ai_summary=checkin.ai_summary,
        ai_risk_score=checkin.ai_risk_score,
        ai_insight=checkin.ai_insight,
        ai_mission_ids=checkin.ai_mission_ids or [],
        created_at=checkin.created_at,
    )
