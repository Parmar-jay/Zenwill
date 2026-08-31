from fastapi import APIRouter, Depends, HTTPException
from app.models.user import User
from app.schemas.profile import UserProfileResponse, UpdateProfileRequest, OnboardingDataSubmit
from app.middleware.auth_middleware import get_current_user
from app.services.mind_profile_service import get_or_create_mind_profile

router = APIRouter(prefix="/profile", tags=["Profile"])


from app.models.journal import JournalEntry
from app.models.daily_checkin import DailyCheckin
from app.models.behavioral_event import BehavioralEvent
from app.models.emergency_session import EmergencySession
from app.models.chat_message import ChatMessage
from datetime import timedelta


@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    user_id_str = str(current_user.id)
    
    # 1. Fetch top 3 recent journals
    journals = await JournalEntry.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": current_user.email}]}
    ).sort("-created_at").limit(3).to_list()

    recent_journals_list = [
        {
            "id": str(j.id),
            "title": j.title or f"Journal Entry #{idx+1}",
            "content": j.content[:120] + "..." if len(j.content) > 120 else j.content,
            "mood_tag": j.mood_tag or "Reflective",
            "created_at": j.created_at.strftime("%b %d, %I:%M %p"),
        }
        for idx, j in enumerate(journals)
    ]

    # 2. Fetch daily check-in checklist logs
    checkins = await DailyCheckin.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": current_user.email}]}
    ).sort("-created_at").limit(30).to_list()

    checkin_history_list = [
        {
            "date": str(c.date),
            "status": "relapsed" if getattr(c, "relapse_occurred", False) else "retained",
            "streakAfter": getattr(c, "streak_day", 1) or 1,
            "strengthAfter": getattr(c, "focus_score", 50) or 50,
            "mood": c.mood,
            "urge_intensity": c.urge_intensity,
        }
        for c in checkins
    ]

    latest_checkin = checkins[0] if checkins else None
    latest_checkin_summary = None
    if latest_checkin:
        latest_checkin_summary = {
            "mood": latest_checkin.mood,
            "mood_intensity": latest_checkin.mood_intensity,
            "energy_score": latest_checkin.energy_score,
            "stress_score": latest_checkin.stress_score,
            "sleep_quality": latest_checkin.sleep_quality,
            "focus_score": latest_checkin.focus_score,
            "date": str(latest_checkin.date),
        }


    # 3. Fetch emergency sessions & urge count stats
    emergency_sessions = await EmergencySession.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": current_user.email}]}
    ).to_list()

    now_dt = datetime.utcnow()
    today_str = now_dt.strftime("%Y-%m-%d")
    total_urges_count = len(emergency_sessions)

    today_urges_count = sum(
        1 for s in emergency_sessions
        if (s.completed_at and s.completed_at.strftime("%Y-%m-%d") == today_str)
        or (s.started_at and s.started_at.strftime("%Y-%m-%d") == today_str)
    )

    daily_urge_counts = []
    for i in range(6, -1, -1):
        d = (now_dt - timedelta(days=i)).date()
        d_str = d.strftime("%Y-%m-%d")
        d_label = d.strftime("%a")[0]
        cnt = sum(
            1 for s in emergency_sessions
            if (s.completed_at and s.completed_at.strftime("%Y-%m-%d") == d_str)
            or (s.started_at and s.started_at.strftime("%Y-%m-%d") == d_str)
        )
        daily_urge_counts.append({
            "date": d_str,
            "dayLabel": d_label,
            "count": cnt,
            "isToday": (i == 0),
        })

    # 4. Fetch meditation / behavioral events (including 3 PM sessions)
    events = await BehavioralEvent.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": current_user.email}]}
    ).to_list()

    meditations_count = len(events)
    afternoon_meditation_done = any(
        (getattr(e, "hour_of_day", None) is not None and e.hour_of_day >= 15) or
        (getattr(e, "created_at", None) is not None and getattr(e.created_at, "hour", 0) >= 15)
        for e in events
    )

    # 5. Compute AI Mindset Score (0 - 1000)
    streak_val = current_user.streak or 0
    max_streak_val = max(current_user.max_streak or 0, streak_val)
    if max_streak_val > (current_user.max_streak or 0):
        current_user.max_streak = max_streak_val
        await current_user.save()

    streak_score = min(350, streak_val * 15)

    checklist_score = 250
    if checkins:
        avg_mood = sum(c.mood_intensity for c in checkins) / len(checkins)
        avg_focus = sum(c.focus_score for c in checkins) / len(checkins)
        avg_sleep = sum(c.sleep_quality for c in checkins) / len(checkins)
        checklist_score = int(min(300, (avg_mood + avg_focus + avg_sleep) * 10))

    journal_score = min(200, len(journals) * 65)
    meditation_score = min(150, (meditations_count + (1 if afternoon_meditation_done else 0)) * 50)

    ai_mindset_score = max(50, min(1000, streak_score + checklist_score + journal_score + meditation_score))

    # 6. Formulate AI Mindset Analysis
    journal_text = f"{len(journals)} journal entries analyzed" if journals else "No journals submitted yet"
    meditation_text = "3 PM afternoon meditation active" if afternoon_meditation_done else "Daily mindfulness logged"
    ai_analysis = (
        f"AI Mindset Evaluation: Strong emotional clarity detected ({journal_text}). "
        f"Daily checklist indicates steady focus and mental power ({ai_mindset_score}/1000). {meditation_text}."
    )

    # 7. Fetch Onboarding Profile Record
    onboarding_record = await Onboarding.find_one(
        {"$or": [{"user_id": user_id_str}, {"user_id": current_user.email}]}
    )
    bio_val = getattr(onboarding_record, "personal_statement", None) if onboarding_record else None
    primary_outcome_val = getattr(onboarding_record, "primary_outcome", None) if onboarding_record else None
    occupation_val = getattr(onboarding_record, "occupation", None) if onboarding_record else None
    daily_schedule_val = getattr(onboarding_record, "daily_schedule", None) if onboarding_record else None
    self_control_val = getattr(onboarding_record, "self_control", None) if onboarding_record else None

    return UserProfileResponse(
        id=user_id_str,
        email=current_user.email,
        name=current_user.name,
        is_onboarded=current_user.is_onboarded,
        onboarding_step=current_user.onboarding_step,
        created_at=current_user.created_at,
        streak=streak_val,
        max_streak=max_streak_val,
        total_points=current_user.total_points or 0,
        mind_strength=ai_mindset_score,
        last_checkin_date=current_user.last_checkin_date,
        last_retain_date=getattr(current_user, "last_retain_date", None),
        last_retain_status=getattr(current_user, "last_retain_status", None),
        ai_mindset_score=int(ai_mindset_score),
        ai_mindset_analysis=ai_analysis,
        journals_count=len(journals),
        recent_journals=recent_journals_list,
        meditations_count=meditations_count,
        afternoon_meditation_done=afternoon_meditation_done,
        latest_checkin_summary=latest_checkin_summary,
        total_urges_count=total_urges_count,
        today_urges_count=today_urges_count,
        daily_urge_counts=daily_urge_counts,
        checkin_history=checkin_history_list,
        bio=bio_val,
        primary_outcome=primary_outcome_val,
        occupation=occupation_val,
        daily_schedule=daily_schedule_val,
        self_control=self_control_val,
    )


@router.patch("/me", response_model=UserProfileResponse)
async def update_my_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
):
    user_id_str = str(current_user.id)

    if payload.name is not None:
        clean_name = payload.name.strip()
        if len(clean_name) < 2:
            raise HTTPException(status_code=400, detail="Display name must be at least 2 characters.")
        
        # Check if another user already has this display name (case-insensitive)
        import re
        query = {
            "name": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"},
            "_id": {"$ne": current_user.id}
        }
        existing_user = await User.find_one(query)
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail=f"The display name '{clean_name}' is already taken by another warrior. Please choose a unique name."
            )
        current_user.name = clean_name
    if payload.onboarding_step is not None:
        current_user.onboarding_step = payload.onboarding_step
    if payload.streak is not None:
        current_user.streak = payload.streak
        if payload.streak > (current_user.max_streak or 0):
            current_user.max_streak = payload.streak
    if payload.max_streak is not None:
        current_user.max_streak = payload.max_streak
    if payload.mind_strength is not None:
        current_user.mind_strength = payload.mind_strength
    if payload.total_points is not None:
        current_user.total_points = payload.total_points
    if payload.last_checkin_date is not None:
        current_user.last_checkin_date = payload.last_checkin_date
    if payload.last_retain_date is not None:
        current_user.last_retain_date = payload.last_retain_date
    if payload.last_retain_status is not None:
        current_user.last_retain_status = payload.last_retain_status

    await current_user.save()

    # Recalculate Spartan Cell total streak and Cohort Honor dynamically
    if (payload.streak is not None or 
        payload.total_points is not None or 
        payload.name is not None or 
        payload.last_retain_status is not None or 
        payload.last_checkin_date is not None or 
        payload.last_retain_date is not None):
        try:
            from app.services.spartan_cell_service import recalculate_user_cell_streak
            await recalculate_user_cell_streak(user_id_str)
        except Exception:
            pass

    # Also update Onboarding record in MongoDB if provided
    onboarding_record = await Onboarding.find_one(
        {"$or": [{"user_id": user_id_str}, {"user_id": current_user.email}]}
    )
    if not onboarding_record:
        onboarding_record = Onboarding(user_id=user_id_str)

    if payload.name is not None:
        onboarding_record.first_name = payload.name
    if payload.bio is not None:
        onboarding_record.personal_statement = payload.bio
    elif payload.personal_statement is not None:
        onboarding_record.personal_statement = payload.personal_statement
    if payload.primary_outcome is not None:
        onboarding_record.primary_outcome = payload.primary_outcome
    if payload.occupation is not None:
        onboarding_record.occupation = payload.occupation
    if payload.daily_schedule is not None:
        onboarding_record.daily_schedule = payload.daily_schedule
    if payload.self_control is not None:
        onboarding_record.self_control = payload.self_control

    await onboarding_record.save()

    return await get_my_profile(current_user=current_user)



from app.models.onboarding import Onboarding
from datetime import datetime


@router.post("/onboarding", status_code=201)
async def submit_onboarding(
    payload: OnboardingDataSubmit,
    current_user: User = Depends(get_current_user),
):
    """
    Submit the complete onboarding profile from the React Native store.
    Persists data to 'onboardings' collection and initializes Mind Profile.
    """
    # 1. Save / Update Onboarding collection document
    user_id_str = str(current_user.id)
    onboarding_record = await Onboarding.find_one(
        {"$or": [{"user_id": user_id_str}, {"user_id": current_user.email}]}
    )
    if not onboarding_record:
        onboarding_record = Onboarding(user_id=user_id_str)

    onboarding_record.first_name = payload.firstName
    onboarding_record.age_group = payload.ageGroup
    onboarding_record.gender = payload.gender
    onboarding_record.occupation = payload.occupation
    onboarding_record.country = payload.country
    onboarding_record.timezone = payload.timezone
    onboarding_record.daily_schedule = payload.dailySchedule
    onboarding_record.relationship_status = payload.relationshipStatus

    onboarding_record.self_control = payload.selfControl
    onboarding_record.motivation_to_change = payload.motivationToChange or 5
    onboarding_record.confidence_in_quitting = payload.confidenceInQuitting or 5
    onboarding_record.stress_level = payload.stressLevel or 5
    onboarding_record.anxiety_level = payload.anxietyLevel or 5
    onboarding_record.mood = payload.mood
    onboarding_record.energy = payload.energy
    onboarding_record.sleep_quality = payload.sleepQuality
    onboarding_record.focus_level = payload.focusLevel
    onboarding_record.emotional_control = payload.emotionalControl
    onboarding_record.urge_frequency = payload.urgeFrequency
    onboarding_record.screen_time = payload.screenTime

    onboarding_record.improvement_reasons = payload.improvementReasons or []
    onboarding_record.primary_outcome = payload.primaryOutcome
    onboarding_record.personal_statement = payload.personalStatement

    onboarding_record.urge_times = payload.urgeTimes or []
    onboarding_record.urge_locations = payload.urgeLocations or []
    onboarding_record.emotional_triggers = payload.emotionalTriggers or []
    onboarding_record.first_warning_sign = payload.firstWarningSign
    onboarding_record.urge_duration = payload.urgeDuration
    onboarding_record.typical_responses = payload.typicalResponses or []
    onboarding_record.emotional_aftermath = payload.emotionalAftermath or []
    onboarding_record.primary_device = payload.primaryDevice
    onboarding_record.online_platforms = payload.onlinePlatforms or []

    onboarding_record.perm_notifications = payload.permNotifications or False

    onboarding_record.signature = payload.signature
    onboarding_record.is_pledge_signed = payload.isPledgeSigned or False

    onboarding_record.raw_onboarding_data = payload.model_dump()
    onboarding_record.updated_at = datetime.utcnow()
    await onboarding_record.save()

    # 2. Save onboarding data to mind profile
    profile = await get_or_create_mind_profile(current_user)
    profile.onboarding_data = payload.model_dump()
    _seed_profile_from_onboarding(profile, payload)
    await profile.save()

    # 3. Mark user as onboarded
    current_user.is_onboarded = True
    current_user.onboarding_step = 6
    if payload.firstName:
        clean_name = payload.firstName.strip()
        import re
        query = {
            "name": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"},
            "_id": {"$ne": current_user.id}
        }
        existing_user = await User.find_one(query)
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail=f"The display name '{clean_name}' is already taken by another warrior. Please choose a unique name."
            )
        current_user.name = clean_name

    await current_user.save()

    # 4. Seed initial AI Coach greeting in MongoDB if no chat history exists
    existing_chat = await ChatMessage.find_one(
        {"$or": [{"user_id": user_id_str}, {"user_id": current_user.email}]}
    )
    if not existing_chat:
        user_display_name = payload.firstName or current_user.name or "Warrior"
        welcome_text = (
            f"Welcome, {user_display_name}. I am your ZenWill Mind & Willpower Coach. "
            "Together, we master your impulses, forge unbreakable mental discipline, and transmute raw urge energy into pure focus. "
            "How are you feeling right now?"
        )
        first_msg = ChatMessage(
            user_id=user_id_str,
            role="assistant",
            content=welcome_text,
            emotional_context="welcome",
            created_at=datetime.utcnow(),
        )
        await first_msg.save()

    return {
        "success": True,
        "message": f"Welcome to ZenWill, {current_user.name}! Your Mind Profile and Onboarding records have been saved.",
        "mind_strength": profile.mind_strength,
        "risk_score_today": profile.risk_score_today,
    }


@router.get("/onboarding")
async def get_onboarding_data(
    current_user: User = Depends(get_current_user),
):
    """Retrieve saved onboarding submission for the authenticated user."""
    onboarding_record = await Onboarding.find_one(Onboarding.user_id == str(current_user.id))
    if not onboarding_record:
        raise HTTPException(status_code=404, detail="Onboarding data not found")
    return onboarding_record


def _seed_profile_from_onboarding(profile, data: OnboardingDataSubmit):
    """Initialize profile metrics from onboarding answers."""
    # Stress level → initial risk score baseline
    if data.stressLevel:
        profile.avg_stress_level = float(data.stressLevel)
        profile.risk_score_today = min(80, data.stressLevel * 8)

    # Self control → initial mind strength
    strength_map = {
        "very_strong": 70, "strong": 60, "average": 50, "weak": 35, "very_weak": 20
    }
    if data.selfControl:
        profile.mind_strength = strength_map.get(data.selfControl, 50)

    # Sleep quality → avg sleep
    sleep_map = {
        "excellent": 9.0, "good": 7.5, "average": 6.5, "poor": 5.0, "very_poor": 4.0
    }
    if data.sleepQuality:
        profile.avg_sleep_quality = sleep_map.get(data.sleepQuality, 6.5)

    # Emotional triggers → top_triggers
    if data.emotionalTriggers:
        profile.top_triggers = data.emotionalTriggers[:5]

    # Typical responses → top coping strategies
    if data.typicalResponses:
        profile.top_coping_strategies = data.typicalResponses[:5]

    # Urge times → high risk times
    time_map = {
        "morning": "08:00", "afternoon": "14:00",
        "evening": "19:00", "night": "22:00", "late_night": "23:00"
    }
    if data.urgeTimes:
        profile.high_risk_times = [time_map.get(t, t) for t in data.urgeTimes]
