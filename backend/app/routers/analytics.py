import json
from fastapi import APIRouter, Depends
from datetime import date, timedelta
from typing import Dict, Any

from app.models.user import User
from app.schemas.analytics import WeeklyInsightResponse
from app.middleware.auth_middleware import get_current_user
from app.services.analytics_service import get_week_stats, get_checkin_history
from app.services.mind_profile_service import get_or_create_mind_profile
from app.services.progress_intelligence_service import compute_deep_progress_intelligence
from app.services.trigger_intelligence_service import compute_deep_trigger_intelligence

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/weekly", response_model=WeeklyInsightResponse)
async def get_weekly_insights(
    current_user: User = Depends(get_current_user),
):
    """
    Returns high-accuracy 7-day Progress & Trend Intelligence computed
    directly from user telemetry without external AI dependencies.
    """
    profile = await get_or_create_mind_profile(current_user)
    week_stats = await get_week_stats(str(current_user.id), profile)
    progress_intel = await compute_deep_progress_intelligence(current_user)

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
        ai_summary=progress_intel["summary"],
        ai_predictions=progress_intel["predictions"],
        ai_recommendations=progress_intel["recommendations"],
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
            "exercise_minutes": getattr(c, "exercise_minutes", 0),
            "meditation_minutes": getattr(c, "meditation_minutes", 0),
            "ai_risk_score": c.ai_risk_score,
        }
        for c in checkins
    ]


@router.post("/mindset-eval/run")
async def run_mindset_evaluation(
    current_user: User = Depends(get_current_user),
):
    """
    Executes algorithmic 4-pillar Mindset & Transmutation Score evaluation
    fusing Onboarding, Check-ins, Meditation logs, and Urge discipline.
    """
    from app.database import motor_client
    from app.config import settings

    db = motor_client[settings.MONGODB_DB_NAME]
    user_id = str(current_user.id)
    today_str = date.today().isoformat()

    progress_intel = await compute_deep_progress_intelligence(current_user)

    record = {
        "user_id": user_id,
        "date_str": today_str,
        "score": progress_intel["score"],
        "status_title": progress_intel["status_title"],
        "status_color": progress_intel["status_color"],
        "summary": progress_intel["summary"],
        "transmutation_tip": progress_intel["transmutation_tip"],
        "checkin_score": progress_intel["checkin_score"],
        "journal_score": progress_intel["journal_score"],
        "meditation_urge_score": progress_intel["meditation_urge_score"],
        "metrics_breakdown": progress_intel["metrics_breakdown"],
        "created_at": today_str,
    }

    await db["mindset_evaluations"].update_one(
        {"user_id": user_id, "date_str": today_str},
        {"$set": record},
        upsert=True,
    )

    return {
        "score": progress_intel["score"],
        "status_title": progress_intel["status_title"],
        "summary": progress_intel["summary"],
        "transmutation_tip": progress_intel["transmutation_tip"],
        "checkin_score": progress_intel["checkin_score"],
        "journal_score": progress_intel["journal_score"],
        "meditation_urge_score": progress_intel["meditation_urge_score"],
    }


@router.get("/mindset-eval/today")
async def get_today_mindset_evaluation(
    current_user: User = Depends(get_current_user),
):
    """Retrieves or auto-computes today's algorithmic Mindset Score."""
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


@router.get("/progress-intelligence")
async def get_progress_intelligence(
    current_user: User = Depends(get_current_user),
):
    """Returns comprehensive Progress Intelligence report with 4-pillar breakdown & trend metrics."""
    return await compute_deep_progress_intelligence(current_user)


@router.get("/trigger-intelligence")
async def get_trigger_intelligence(
    current_user: User = Depends(get_current_user),
):
    """Generates comprehensive Trigger Intelligence report fusing Onboarding, Daily Check-ins, and Urge logs."""
    return await compute_deep_trigger_intelligence(current_user)


@router.get("/recommendations")
async def get_user_recommendations(
    current_user: User = Depends(get_current_user),
):
    """Returns personalized mind assistant directive and recommended yogic meditation practice."""
    from app.services.recommendation_service import compute_personalized_recommendations
    return await compute_personalized_recommendations(current_user)


@router.post("/recommendations/complete")
async def complete_recommendation(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    """Marks a personalized recommendation task as completed and persists to MongoDB."""
    from app.services.recommendation_service import complete_user_recommendation_task
    task_id = payload.get("task_id", "")
    action_type = payload.get("action_type", "general")
    title = payload.get("title", "Completed Recommendation Task")
    return await complete_user_recommendation_task(current_user, task_id, action_type, title)


@router.post("/relapse-autopsy/submit")
async def submit_relapse_autopsy(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    """Submits a forensic Relapse Autopsy, computes retained neural progress, and generates a Golden Firewall Rule."""
    from app.services.relapse_autopsy_service import submit_and_analyze_relapse_autopsy
    return await submit_and_analyze_relapse_autopsy(current_user, payload)


@router.get("/relapse-autopsy/latest")
async def get_latest_autopsy(
    current_user: User = Depends(get_current_user),
):
    """Retrieves the most recent Relapse Autopsy and active Golden Firewall Rule."""
    from app.services.relapse_autopsy_service import get_latest_relapse_autopsy
    return await get_latest_relapse_autopsy(current_user)



