from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime, date
from app.models.user import User
from app.models.mission import Mission
from app.schemas.mission import (
    MissionResponse,
    MissionCompleteCategoryRequest,
    MissionSyncTasksRequest,
    MissionCompleteResponse,
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
    "rescue": ["exercise", "rescue", "emergency", "calm"],
    "exercise": ["exercise", "rescue", "emergency", "calm"],
}


@router.get("/today", response_model=List[MissionResponse])
async def get_todays_missions(
    current_user: User = Depends(get_current_user),
):
    profile = await get_or_create_mind_profile(current_user)
    missions = await generate_todays_missions(str(current_user.id), profile)
    return [_to_response(m) for m in missions]


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
    todays_missions = await generate_todays_missions(str(current_user.id), profile)

    cat_key = payload.category.lower().strip()
    target_categories = CATEGORY_MAP.get(cat_key, [cat_key])

    matched_mission = None
    for m in todays_missions:
        if m.category in target_categories:
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
            date_assigned=datetime.utcnow(),
            date_completed=datetime.utcnow(),
            why_assigned="Daily ritual completed by operative.",
            tags=[cat_key, "daily_ritual"],
        )
        await matched_mission.insert()
    else:
        matched_mission.is_completed = True
        matched_mission.date_completed = datetime.utcnow()
        await matched_mission.save()

    # Update mind profile & user total points
    xp_gain = matched_mission.xp_reward or 20
    strength_gain = matched_mission.mind_strength_reward or 5
    await record_mission_complete(profile, strength_gain)

    current_user.total_points = (current_user.total_points or 0) + xp_gain
    await current_user.save()

    # Fetch updated list of today's missions
    updated_missions = await generate_todays_missions(str(current_user.id), profile)

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
    todays_missions = await generate_todays_missions(str(current_user.id), profile)

    tasks = payload.tasks or {}
    for task_key, is_done in tasks.items():
        if not is_done:
            continue
        cat_key = task_key.lower().strip()
        target_categories = CATEGORY_MAP.get(cat_key, [cat_key])
        for m in todays_missions:
            if m.category in target_categories and not m.is_completed:
                m.is_completed = True
                m.date_completed = datetime.utcnow()
                await m.save()

    # Refresh
    refreshed = await generate_todays_missions(str(current_user.id), profile)
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

