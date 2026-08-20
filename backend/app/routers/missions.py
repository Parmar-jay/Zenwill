from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import datetime
from app.models.user import User
from app.models.mission import Mission
from app.schemas.mission import MissionResponse, MissionCompleteRequest, MissionCompleteResponse
from app.middleware.auth_middleware import get_current_user
from app.services.mission_service import generate_todays_missions
from app.services.mind_profile_service import get_or_create_mind_profile, record_mission_complete

router = APIRouter(prefix="/missions", tags=["Missions"])


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


@router.post("/{mission_id}/complete", response_model=MissionCompleteResponse)
async def complete_mission(
    mission_id: str,
    payload: MissionCompleteRequest = MissionCompleteRequest(),
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
