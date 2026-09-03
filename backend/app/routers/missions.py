from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime, date, timedelta
from app.models.user import User
from app.models.mission import Mission
from app.models.daily_checkin import DailyCheckin
from app.models.journal import JournalEntry
from app.models.meditation_session import MeditationSession
from app.schemas.mission import (
    MissionResponse,
    MissionCompleteCategoryRequest,
    MissionSyncTasksRequest,
    MissionCompleteResponse,
    DailyTasksStatusResponse,
)
from app.middleware.auth_middleware import get_current_user
from app.services.mission_service import generate_todays_missions
from app.services.mind_profile_service import get_or_create_mind_profile, record_mission_complete

router = APIRouter(prefix="/missions", tags=["Missions"])

CATEGORY_MAP = {
    "checkin": ["checkin", "morning"],
    "meditation": ["calm", "meditation", "sleep"],
    "calm": ["calm", "meditation", "sleep"],
    "journal": ["focus", "journal", "reflection"],
    "focus": ["focus", "journal", "reflection"],
    "coach": ["purpose", "coach", "connection"],
    "purpose": ["purpose", "coach", "connection"],
    "rescue": ["exercise", "rescue", "emergency"],
    "exercise": ["exercise", "rescue", "emergency"],
}


@router.get("/today", response_model=List[MissionResponse])
async def get_todays_missions(
    current_user: User = Depends(get_current_user),
):
    profile = await get_or_create_mind_profile(current_user)
    # Ensure today's AI missions exist
    await generate_todays_missions(str(current_user.id), profile)

    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)

    todays_missions = await Mission.find(
        Mission.user_id == str(current_user.id),
        {"$or": [
            {"date_assigned": {"$gte": today_start, "$lt": today_end}},
            {"date_completed": {"$gte": today_start, "$lt": today_end}},
            {"created_at": {"$gte": today_start, "$lt": today_end}},
        ]}
    ).sort("-date_assigned").to_list()

    return [_to_response(m) for m in todays_missions]


@router.get("/today-tasks", response_model=DailyTasksStatusResponse)
async def get_today_tasks_status(
    current_user: User = Depends(get_current_user),
):
    """
    Direct, 100% authoritative endpoint returning the real-time status of the 5 daily rituals.
    Cross-verifies Missions, DailyCheckin, MeditationSession, and JournalEntry collections.
    """
    user_id = str(current_user.id)
    user_email = current_user.email
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)
    today_str = now.strftime("%Y-%m-%d")
    today_date = now.date()

    # 1. Missions completed today
    user_query = {"$or": [{"user_id": user_id}, {"user_email": user_email}]} if user_email else {"user_id": user_id}
    mission_query = {
        **user_query,
        "$or": [
            {"date_assigned": {"$gte": today_start, "$lt": today_end}},
            {"date_completed": {"$gte": today_start, "$lt": today_end}},
            {"created_at": {"$gte": today_start, "$lt": today_end}},
        ]
    }
    missions = await Mission.find(mission_query).to_list()
    completed_missions = [m for m in missions if m.is_completed]
    completed_cats = {m.category.lower().strip() for m in completed_missions if m.category}

    # 2. Checkin verification
    has_checkin = bool(
        any(c in completed_cats for c in ["checkin", "morning"])
        or (current_user.last_checkin_date == today_str)
        or await DailyCheckin.find_one(
            DailyCheckin.user_id == user_id,
            DailyCheckin.date == today_date,
        )
    )

    # 3. Meditation verification
    has_meditation = bool(
        any(c in completed_cats for c in ["meditation", "calm", "sleep"])
        or await MeditationSession.find_one(
            {"$or": [{"user_id": user_id}, {"user_email": user_email}] if user_email else {"user_id": user_id}},
            {"$or": [
                {"created_at": {"$gte": today_start, "$lt": today_end}},
                {"completed_at": {"$gte": today_start, "$lt": today_end}},
            ]}
        )
    )

    # 4. Journal verification
    has_journal = bool(
        any(c in completed_cats for c in ["journal", "focus", "reflection"])
        or await JournalEntry.find_one(
            JournalEntry.user_id == user_id,
            JournalEntry.created_at >= today_start,
            JournalEntry.created_at < today_end,
        )
    )

    # 5. Coach verification
    has_coach = bool(
        any(c in completed_cats for c in ["coach", "purpose", "connection"])
    )

    # 6. Rescue verification
    has_rescue = bool(
        any(c in completed_cats for c in ["rescue", "exercise", "emergency"])
    )

    tasks_dict = {
        "checkin": has_checkin,
        "meditation": has_meditation,
        "journal": has_journal,
        "coach": has_coach,
        "rescue": has_rescue,
    }

    completed_count = sum(1 for v in tasks_dict.values() if v)
    total_pts = completed_count * 20

    return DailyTasksStatusResponse(
        date=today_str,
        tasks=tasks_dict,
        completed_count=completed_count,
        total_points=total_pts,
        all_completed=completed_count == 5,
    )


@router.get("/history")
async def get_missions_history(
    days: int = 7,
    current_user: User = Depends(get_current_user),
):
    days = max(1, min(days, 30))
    user_id_str = str(current_user.id)
    now = datetime.utcnow()

    # Calculate start of window (days - 1 days ago at 00:00:00 UTC)
    start_date = datetime(now.year, now.month, now.day) - timedelta(days=days - 1)

    # Fetch all relevant records in this window for user
    missions_in_window = await Mission.find(
        Mission.user_id == user_id_str,
        Mission.date_assigned >= start_date,
    ).to_list()

    checkins_in_window = await DailyCheckin.find(
        DailyCheckin.user_id == user_id_str,
        DailyCheckin.date >= start_date.date(),
    ).to_list()

    journals_in_window = await JournalEntry.find(
        JournalEntry.user_id == user_id_str,
        JournalEntry.created_at >= start_date,
    ).to_list()

    history_days = []

    for i in range(days - 1, -1, -1):
        target_dt = datetime(now.year, now.month, now.day) - timedelta(days=i)
        target_date_str = target_dt.strftime("%Y-%m-%d")
        target_date_obj = target_dt.date()
        day_name = target_dt.strftime("%a")

        # Check task completion for this target date
        day_missions = [
            m
            for m in missions_in_window
            if m.date_assigned and m.date_assigned.strftime("%Y-%m-%d") == target_date_str
        ]

        has_checkin = any(
            c.date == target_date_obj or (hasattr(c, "created_at") and c.created_at and c.created_at.strftime("%Y-%m-%d") == target_date_str)
            for c in checkins_in_window
        ) or any(
            m.is_completed and m.category.lower() in ["checkin", "morning"]
            for m in day_missions
        )

        has_meditation = any(
            m.is_completed and m.category.lower() in ["calm", "meditation", "sleep"]
            for m in day_missions
        )

        has_journal = any(
            j.created_at and j.created_at.strftime("%Y-%m-%d") == target_date_str
            for j in journals_in_window
        ) or any(
            m.is_completed and m.category.lower() in ["focus", "journal", "reflection"]
            for m in day_missions
        )

        has_coach = any(
            m.is_completed and m.category.lower() in ["purpose", "coach", "connection"]
            for m in day_missions
        )

        has_rescue = any(
            m.is_completed and m.category.lower() in ["exercise", "rescue", "emergency"]
            for m in day_missions
        )

        tasks_dict = {
            "checkin": bool(has_checkin),
            "meditation": bool(has_meditation),
            "journal": bool(has_journal),
            "coach": bool(has_coach),
            "rescue": bool(has_rescue),
        }

        completed_count = sum(1 for v in tasks_dict.values() if v)
        percent = int(round((completed_count / 5.0) * 100))
        points_earned = completed_count * 20
        all_completed = completed_count == 5

        history_days.append({
            "date": target_date_str,
            "day_name": day_name,
            "tasks": tasks_dict,
            "completed_count": completed_count,
            "percent": percent,
            "points_earned": points_earned,
            "all_completed": all_completed,
        })

    total_pts_week = sum(d["points_earned"] for d in history_days)
    avg_pct = int(round(sum(d["percent"] for d in history_days) / float(len(history_days)))) if history_days else 0
    active_days = sum(1 for d in history_days if d["points_earned"] > 0)

    return {
        "days": history_days,
        "summary": {
            "total_points_week": total_pts_week,
            "average_percent": avg_pct,
            "active_days": active_days,
            "current_streak": getattr(current_user, "current_streak", 0) or getattr(current_user, "streak", 0) or active_days,
        },
    }


@router.get("/", response_model=List[MissionResponse])
async def list_all_missions(
    limit: int = 30,
    completed: bool = None,
    current_user: User = Depends(get_current_user),
):
    query_args = [Mission.user_id == str(current_user.id)]
    if completed is not None:
        query_args.append(Mission.is_completed == completed)

    missions = await Mission.find(*query_args).sort(-Mission.date_assigned).limit(limit).to_list()
    return [_to_response(m) for m in missions]


@router.post("/complete-category", response_model=MissionCompleteResponse)
async def complete_mission_by_category(
    payload: MissionCompleteCategoryRequest,
    current_user: User = Depends(get_current_user),
):
    profile = await get_or_create_mind_profile(current_user)
    # Ensure today's missions exist
    await generate_todays_missions(str(current_user.id), profile)

    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)

    todays_missions = await Mission.find(
        Mission.user_id == str(current_user.id),
        {"$or": [
            {"date_assigned": {"$gte": today_start, "$lt": today_end}},
            {"date_completed": {"$gte": today_start, "$lt": today_end}},
            {"created_at": {"$gte": today_start, "$lt": today_end}},
        ]}
    ).to_list()

    cat_key = payload.category.lower().strip()
    target_categories = CATEGORY_MAP.get(cat_key, [cat_key])

    matched_mission = None
    for m in todays_missions:
        if m.category.lower() in target_categories:
            matched_mission = m
            break

    if not matched_mission:
        # Create a dedicated completed mission record for today
        matched_mission = Mission(
            user_id=str(current_user.id),
            title=f"Complete Daily {cat_key.title()}",
            description=f"Successfully completed daily {cat_key} practice.",
            category=cat_key,
            difficulty="easy",
            duration_minutes=payload.duration_actual_minutes or 10,
            xp_reward=20,
            mind_strength_reward=5,
            is_completed=True,
            is_ai_generated=False,
            date_assigned=now,
            date_completed=now,
            why_assigned="Daily ritual completed by operative.",
            tags=[cat_key, "daily_ritual"],
        )
        await matched_mission.insert()
    else:
        matched_mission.is_completed = True
        matched_mission.date_completed = now
        await matched_mission.save()

    # Update mind profile & user total points
    xp_gain = matched_mission.xp_reward or 20
    strength_gain = matched_mission.mind_strength_reward or 5
    await record_mission_complete(profile, strength_gain)

    current_user.total_points = (current_user.total_points or 0) + xp_gain
    await current_user.save()

    # Recalculate Spartan Cell Cohort Honor in real time
    try:
        from app.services.spartan_cell_service import recalculate_user_cell_streak
        await recalculate_user_cell_streak(str(current_user.id))
    except Exception:
        pass

    # Fetch updated list of today's missions
    updated_missions = await Mission.find(
        Mission.user_id == str(current_user.id),
        Mission.date_assigned >= today_start,
        Mission.date_assigned < today_end,
    ).sort("-date_assigned").to_list()

    return MissionCompleteResponse(
        success=True,
        xp_earned=xp_gain,
        mind_strength_gained=strength_gain,
        new_mind_strength=profile.mind_strength,
        message=f"{cat_key.title()} mission completed! +{xp_gain} XP, +{strength_gain} Mind Strength",
        missions=[_to_response(m) for m in updated_missions],
    )


@router.post("/sync", response_model=List[MissionResponse])
async def sync_daily_tasks(
    payload: MissionSyncTasksRequest,
    current_user: User = Depends(get_current_user),
):
    profile = await get_or_create_mind_profile(current_user)
    await generate_todays_missions(str(current_user.id), profile)

    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)

    todays_missions = await Mission.find(
        Mission.user_id == str(current_user.id),
        {"$or": [
            {"date_assigned": {"$gte": today_start, "$lt": today_end}},
            {"date_completed": {"$gte": today_start, "$lt": today_end}},
            {"created_at": {"$gte": today_start, "$lt": today_end}},
        ]}
    ).to_list()

    tasks = payload.tasks or {}
    for task_key, is_done in tasks.items():
        if not is_done:
            continue
        cat_key = task_key.lower().strip()
        target_categories = CATEGORY_MAP.get(cat_key, [cat_key])
        matched = False
        for m in todays_missions:
            if m.category.lower() in target_categories:
                matched = True
                if not m.is_completed:
                    m.is_completed = True
                    m.date_completed = now
                    await m.save()
        if not matched:
            new_m = Mission(
                user_id=str(current_user.id),
                title=f"Complete Daily {cat_key.title()}",
                description=f"Successfully completed daily {cat_key} practice.",
                category=cat_key,
                difficulty="easy",
                duration_minutes=10,
                xp_reward=20,
                mind_strength_reward=5,
                is_completed=True,
                is_ai_generated=False,
                date_assigned=now,
                date_completed=now,
                why_assigned="Daily ritual completed by operative.",
                tags=[cat_key, "daily_ritual"],
            )
            await new_m.insert()

    # Refresh
    refreshed = await Mission.find(
        Mission.user_id == str(current_user.id),
        Mission.date_assigned >= today_start,
        Mission.date_assigned < today_end,
    ).sort("-date_assigned").to_list()
    return [_to_response(m) for m in refreshed]


@router.post("/{mission_id}/complete", response_model=MissionCompleteResponse)
async def complete_mission(
    mission_id: str,
    payload: MissionCompleteCategoryRequest = MissionCompleteCategoryRequest(category="general"),
    current_user: User = Depends(get_current_user),
):
    mission = await Mission.find_one(
        Mission.id == mission_id,
        Mission.user_id == str(current_user.id),
    )
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    if mission.is_completed:
        raise HTTPException(status_code=400, detail="Mission already completed")

    mission.is_completed = True
    mission.date_completed = datetime.utcnow()
    await mission.save()

    # Update mind profile
    profile = await get_or_create_mind_profile(current_user)
    await record_mission_complete(profile, mission.mind_strength_reward)
    current_user.total_points = (current_user.total_points or 0) + mission.xp_reward
    await current_user.save()

    # Recalculate Spartan Cell Cohort Honor in real time
    try:
        from app.services.spartan_cell_service import recalculate_user_cell_streak
        await recalculate_user_cell_streak(str(current_user.id))
    except Exception:
        pass

    return MissionCompleteResponse(
        success=True,
        xp_earned=mission.xp_reward,
        mind_strength_gained=mission.mind_strength_reward,
        new_mind_strength=profile.mind_strength,
        message=f"Mission complete! +{mission.xp_reward} XP, +{mission.mind_strength_reward} Mind Strength",
    )


def _to_response(mission: Mission) -> MissionResponse:
    return MissionResponse(
        id=str(mission.id),
        title=mission.title,
        description=mission.description,
        category=mission.category,
        difficulty=mission.difficulty,
        duration_minutes=mission.duration_minutes,
        xp_reward=mission.xp_reward,
        mind_strength_reward=mission.mind_strength_reward,
        is_completed=mission.is_completed,
        is_ai_generated=mission.is_ai_generated,
        date_assigned=mission.date_assigned,
        date_completed=mission.date_completed,
        why_assigned=mission.why_assigned,
        tags=mission.tags or [],
    )

