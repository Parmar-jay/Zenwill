"""
Mission Service — dynamically generates personalized missions based on the user's
current Mind Profile and recent check-in data.
"""
from typing import List, Dict, Any
from datetime import datetime, date, timedelta
from app.models.mission import Mission
from app.models.mind_profile import MindProfile
from app.models.daily_checkin import DailyCheckin
from app.services.ai_service import MISSION_LIBRARY
import random


async def generate_todays_missions(
    user_id: str,
    profile: MindProfile,
    latest_checkin: DailyCheckin = None,
) -> List[Mission]:
    """
    Generate 3-5 personalized missions for today.
    Missions reset daily at 12:00 AM (24-hour cycle).
    Selection logic is based on the user's current weaknesses and strengths.
    """
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)

    # Check if missions already generated for today
    existing = await Mission.find(
        Mission.user_id == user_id,
        Mission.date_assigned >= today_start,
        Mission.date_assigned < today_end,
        Mission.is_ai_generated == True,
    ).to_list()

    if existing:
        return existing

    # Determine priorities from profile + checkin
    priorities = _get_mission_priorities(profile, latest_checkin)

    # Pick missions based on priorities
    selected = _select_missions(priorities, count=4)

    missions = []
    for m_data in selected:
        mission = Mission(
            user_id=user_id,
            title=m_data["title"],
            description=m_data["description"],
            category=m_data["category"],
            difficulty=m_data.get("difficulty", "medium"),
            duration_minutes=m_data.get("duration_minutes", 15),
            xp_reward=m_data.get("xp_reward", 15),
            mind_strength_reward=m_data.get("mind_strength_reward", 3),
            is_completed=False,
            is_ai_generated=True,
            date_assigned=now,
            why_assigned=_get_why_assigned(m_data["category"], profile, latest_checkin),
        )
        await mission.insert()
        missions.append(mission)

    return missions


def _get_mission_priorities(profile: MindProfile, checkin: DailyCheckin = None) -> Dict[str, int]:
    """Return category weights based on current user state."""
    weights = {
        "sleep": 1,
        "focus": 1,
        "calm": 1,
        "exercise": 1,
        "purpose": 1,
        "connection": 1,
    }

    if checkin:
        sleep_q = getattr(checkin, "sleep_quality", 7)
        sleep_h = getattr(checkin, "sleep_duration", getattr(checkin, "sleep_hours", 7.0))
        stress_val = getattr(checkin, "stress_score", getattr(checkin, "stress", 3))
        focus_val = getattr(checkin, "focus_score", getattr(checkin, "focus", 5))
        mood_val = getattr(checkin, "mood_intensity", 5)
        urge_val = getattr(checkin, "urge_intensity", 0)

        if sleep_q < 5 or sleep_h < 6:
            weights["sleep"] += 3
        if stress_val > 7:
            weights["calm"] += 3
        if focus_val < 5:
            weights["focus"] += 2
        if mood_val < 5:
            weights["purpose"] += 2
            weights["connection"] += 2
        if urge_val and urge_val > 5:
            weights["calm"] += 2
            weights["exercise"] += 2

    # Risk score influence
    if profile.risk_score_today > 60:
        weights["calm"] += 2
        weights["purpose"] += 2
    elif profile.risk_score_today < 30:
        weights["focus"] += 1
        weights["exercise"] += 1

    return weights


def _select_missions(weights: Dict[str, int], count: int = 4) -> List[Dict]:
    """Weighted random selection from the mission library."""
    pool = []
    for mission in MISSION_LIBRARY:
        weight = weights.get(mission["category"], 1)
        pool.extend([mission] * weight)

    selected = []
    seen_categories = set()

    random.shuffle(pool)
    for m in pool:
        if len(selected) >= count:
            break
        if m["category"] not in seen_categories or len(selected) < count - 1:
            selected.append(m)
            seen_categories.add(m["category"])

    if len(selected) < count:
        remaining = [m for m in MISSION_LIBRARY if m not in selected]
        selected.extend(random.sample(remaining, min(count - len(selected), len(remaining))))

    return selected[:count]


def _get_why_assigned(category: str, profile: MindProfile, checkin: DailyCheckin = None) -> str:
    reasons = {
        "sleep": "Your recent sleep data shows quality below optimal. Sleep is your #1 recovery tool.",
        "calm": "Your stress levels have been elevated. Calming practices will directly reduce urge vulnerability.",
        "focus": "Strengthening focus builds the mental muscle that resists impulse.",
        "exercise": "Physical activity directly elevates mood and reduces craving intensity.",
        "purpose": "Reconnecting with your purpose provides a powerful motivational anchor.",
        "connection": "Human connection is one of the strongest natural buffers against addictive behaviors.",
    }
    return reasons.get(category, "This mission supports your overall mental strength development.")
