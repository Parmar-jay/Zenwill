from fastapi import APIRouter, Depends
from datetime import date, timedelta
from app.models.user import User
from app.schemas.analytics import WeeklyInsightResponse
from app.middleware.auth_middleware import get_current_user
from app.services.analytics_service import get_week_stats, get_checkin_history
from app.services.mind_profile_service import get_or_create_mind_profile, get_profile_summary
from app.services.ai_service import ai_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/weekly", response_model=WeeklyInsightResponse)
async def get_weekly_insights(
    current_user: User = Depends(get_current_user),
):
    profile = await get_or_create_mind_profile(current_user)
    week_stats = await get_week_stats(str(current_user.id), profile)

    summary, predictions, recommendations = await ai_service.generate_weekly_insights(
        profile=get_profile_summary(profile),
        week_stats=week_stats,
        user_name=current_user.name or "there",
    )

    today = date.today()
    week_start = today - timedelta(days=6)

    return WeeklyInsightResponse(
        week_start=str(week_start),
        week_end=str(today),
        mind_strength_start=max(0, profile.mind_strength - week_stats["mind_strength_change"]),
        mind_strength_end=profile.mind_strength,
        mind_strength_change=week_stats["mind_strength_change"],
        total_checkins=week_stats["total_checkins"],
        total_missions=week_stats["total_missions"],
        missions_completed=week_stats["missions_completed"],
        total_journal_entries=week_stats["total_journal_entries"],
        avg_sleep_hours=week_stats["avg_sleep_hours"],
        avg_stress=week_stats["avg_stress"],
        avg_mood=week_stats["avg_mood"],
        relapse_count=week_stats["relapse_count"],
        urge_free_days=week_stats["urge_free_days"],
        top_trigger=week_stats["top_trigger"],
        best_coping_strategy=week_stats["best_coping_strategy"],
        ai_summary=summary,
        ai_predictions=predictions,
        ai_recommendations=recommendations,
    )


@router.get("/history")
async def get_checkin_chart_data(
    days: int = 30,
    current_user: User = Depends(get_current_user),
):
    """Returns daily check-in history suitable for charting."""
    checkins = await get_checkin_history(str(current_user.id), days)
    return [
        {
            "date": str(c.date),
            "mood": c.mood,
            "energy": c.energy,
            "stress": c.stress,
            "sleep_hours": c.sleep_hours,
            "sleep_quality": c.sleep_quality,
            "urge_intensity": c.urge_intensity,
            "relapse_occurred": c.relapse_occurred,
            "exercise_minutes": c.exercise_minutes,
            "meditation_minutes": c.meditation_minutes,
            "ai_risk_score": c.ai_risk_score,
        }
        for c in checkins
    ]


@router.post("/mindset-eval/run")
async def run_mindset_evaluation(
    current_user: User = Depends(get_current_user),
):
    """Triggers 1-day multi-variable Gemini AI Mindset Evaluation."""
    from datetime import date
    from app.database import motor_client
    from app.config import settings
    from app.services.gemini_service import evaluate_daily_mindset
    
    db = motor_client[settings.MONGODB_DB_NAME]
    user_id = str(current_user.id)
    today_str = date.today().isoformat()

    # 1. Fetch 1-day Check-in
    checkin_doc = await db["checkins"].find_one({"user_id": user_id, "date": today_str})
    
    # 2. Fetch Recent 3 Journals
    journal_cursor = db["journal_entries"].find({"user_id": user_id}).sort("created_at", -1).limit(3)
    journals = await journal_cursor.to_list(length=3)
    journal_texts = [{"title": j.get("title", ""), "content": j.get("content", ""), "date": str(j.get("created_at", ""))} for j in journals]

    # 3. Fetch Emergency Urges Today & Total
    urge_cursor = db["emergency_sessions"].find({"user_id": user_id}).sort("created_at", -1)
    urge_sessions = await urge_cursor.to_list(length=100)
    today_urges = [s for s in urge_sessions if str(s.get("created_at", "")).startswith(today_str)]
    
    # 4. Fetch Meditation Sessions Today
    med_doc = await db["behavioral_events"].find_one({"user_id": user_id, "event_type": "meditation_session", "created_at": {"$gte": today_str}})

    user_payload = {
        "username": current_user.name or "Warrior",
        "onboarding_purpose": getattr(current_user, "primary_goal", "Sexual Energy Transmutation & Mind Control"),
        "streak": getattr(current_user, "streak", 0),
        "today_checkin": checkin_doc or {},
        "today_urges_count": len(today_urges),
        "total_urges_count": len(urge_sessions),
        "meditation_log": med_doc or {},
        "recent_journals": journal_texts,
        "today_urge_sessions": [{"trigger": s.get("trigger_reason"), "effective": s.get("was_effective")} for s in today_urges]
    }

    eval_result = await evaluate_daily_mindset(user_payload)

    # Save to MongoDB
    record = {
        "user_id": user_id,
        "date_str": today_str,
        "score": eval_result.get("score", 85),
        "status_title": eval_result.get("status_title", "Ojas Transmutation Active"),
        "summary": eval_result.get("summary", ""),
        "transmutation_tip": eval_result.get("transmutation_tip", ""),
        "checkin_score": eval_result.get("checkin_score", 30),
        "journal_score": eval_result.get("journal_score", 20),
        "meditation_urge_score": eval_result.get("meditation_urge_score", 35),
        "details_json": user_payload,
        "created_at": date.today().isoformat()
    }
    
    await db["mindset_evaluations"].update_one(
        {"user_id": user_id, "date_str": today_str},
        {"$set": record},
        upsert=True
    )

    return eval_result


@router.get("/mindset-eval/today")
async def get_today_mindset_evaluation(
    current_user: User = Depends(get_current_user),
):
    """Retrieves or auto-computes today's AI Mindset Score."""
    from datetime import date
    from app.database import motor_client
    from app.config import settings
    
    db = motor_client[settings.MONGODB_DB_NAME]
    user_id = str(current_user.id)
    today_str = date.today().isoformat()

    record = await db["mindset_evaluations"].find_one({"user_id": user_id, "date_str": today_str})
    if record:
        return {
            "score": record.get("score", 85),
            "status_title": record.get("status_title", "Ojas Transmutation Active"),
            "summary": record.get("summary", ""),
            "transmutation_tip": record.get("transmutation_tip", ""),
            "checkin_score": record.get("checkin_score", 30),
            "journal_score": record.get("journal_score", 20),
            "meditation_urge_score": record.get("meditation_urge_score", 35),
        }

    return await run_mindset_evaluation(current_user=current_user)


@router.get("/trigger-intelligence")
async def get_trigger_intelligence(
    current_user: User = Depends(get_current_user),
):
    """Generates AI Trigger Intelligence report."""
    from app.database import motor_client
    from app.config import settings
    from app.services.gemini_service import generate_trigger_intelligence_report

    db = motor_client[settings.MONGODB_DB_NAME]
    user_id = str(current_user.id)

    urge_cursor = db["emergency_sessions"].find({"user_id": user_id})
    sessions = await urge_cursor.to_list(length=100)

    triggers = [s.get("trigger_reason") for s in sessions if s.get("trigger_reason")]
    effective = [s for s in sessions if s.get("was_effective")]
    rate = int((len(effective) / len(sessions)) * 100) if sessions else 90

    trigger_payload = {
        "total_urges_count": len(sessions),
        "top_triggers": triggers[:5] if triggers else ["Stress", "Late Night", "Boredom"],
        "effectiveness_rate": rate
    }

    return await generate_trigger_intelligence_report(trigger_payload)

