"""
Analytics Service — computes weekly and long-term behavioral patterns.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
from app.models.daily_checkin import DailyCheckin
from app.models.mission import Mission
from app.models.journal import JournalEntry
from app.models.mind_profile import MindProfile


async def get_week_stats(
    user_id: str,
    profile: MindProfile,
    days: int = 7,
) -> Dict[str, Any]:
    """Compute stats for the last N days."""
    since = date.today() - timedelta(days=days)
    since_dt = datetime(since.year, since.month, since.day)

    # Checkins
    checkins = await DailyCheckin.find(
        DailyCheckin.user_id == user_id,
        DailyCheckin.date >= since,
    ).to_list()

    # Missions
    missions = await Mission.find(
        Mission.user_id == user_id,
        Mission.date_assigned >= since_dt,
    ).to_list()

    # Journal entries count
    journal_count = await JournalEntry.find(
        JournalEntry.user_id == user_id,
        JournalEntry.created_at >= since_dt,
    ).count()

    # Aggregate checkin stats
    total_checkins = len(checkins)
    relapse_count = sum(1 for c in checkins if c.relapse_occurred)
    urge_free_days = sum(1 for c in checkins if not c.urge_intensity or c.urge_intensity == 0)
    avg_sleep_hours = sum(c.sleep_hours for c in checkins) / max(total_checkins, 1)
    avg_stress = sum(c.stress for c in checkins) / max(total_checkins, 1)
    avg_mood = sum(c.mood for c in checkins) / max(total_checkins, 1)

    # Trigger frequency
    trigger_freq: Dict[str, int] = {}
    for c in checkins:
        for t in (c.relapse_triggers or []):
            trigger_freq[t] = trigger_freq.get(t, 0) + 1
    top_trigger = max(trigger_freq, key=trigger_freq.get) if trigger_freq else None

    # Missions
    completed_missions = sum(1 for m in missions if m.is_completed)

    # Mind strength change (approximate)
    mind_strength_change = 0
    if total_checkins >= 2:
        mind_strength_change = min(total_checkins * 2 - relapse_count * 8, 15)

    return {
        "total_checkins": total_checkins,
        "relapse_count": relapse_count,
        "urge_free_days": urge_free_days,
        "avg_sleep_hours": round(avg_sleep_hours, 1),
        "avg_stress": round(avg_stress, 1),
        "avg_mood": round(avg_mood, 1),
        "top_trigger": top_trigger,
        "total_missions": len(missions),
        "missions_completed": completed_missions,
        "total_journal_entries": journal_count,
        "mind_strength_change": mind_strength_change,
        "best_coping_strategy": (profile.top_coping_strategies or ["breathing"])[0] if profile.top_coping_strategies else "breathing",
    }


async def get_checkin_history(
    user_id: str,
    days: int = 30,
) -> List[DailyCheckin]:
    since = date.today() - timedelta(days=days)
    return await DailyCheckin.find(
        DailyCheckin.user_id == user_id,
        DailyCheckin.date >= since,
    ).sort(+DailyCheckin.date).to_list()
