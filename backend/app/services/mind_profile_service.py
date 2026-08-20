"""
Mind Profile Service — calculates and updates the central behavioral profile.
This is the brain of ZenWill.
"""
from typing import Optional, Dict, Any
from datetime import datetime, date, timedelta
from app.models.mind_profile import MindProfile
from app.models.daily_checkin import DailyCheckin
from app.models.user import User


async def get_or_create_mind_profile(user: User) -> MindProfile:
    profile = await MindProfile.find_one(MindProfile.user_id == str(user.id))
    if not profile:
        profile = MindProfile(user_id=str(user.id))
        await profile.insert()
    return profile


async def record_user_activity(
    profile: MindProfile,
    activity_type: str,
    feature_name: str,
    details: str = "",
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Log fine-grained user activity for AI progress & behavioral analysis."""
    activity_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "activity_type": activity_type,
        "feature_name": feature_name,
        "details": details,
        "metadata": metadata or {},
    }
    history = list(profile.activity_log or [])
    history.append(activity_entry)
    profile.activity_log = history[-100:]  # Retain latest 100 entries

    timeline_entry = {
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "timestamp": datetime.utcnow().isoformat(),
        "mind_strength": profile.mind_strength,
        "risk_score_today": profile.risk_score_today,
        "current_flow": profile.current_flow,
        "activity_type": activity_type,
    }
    timeline = list(profile.mind_improvement_timeline or [])
    timeline.append(timeline_entry)
    profile.mind_improvement_timeline = timeline[-60:]


async def update_from_checkin(
    profile: MindProfile,
    checkin: DailyCheckin,
) -> MindProfile:
    """Recalculate profile metrics after a new check-in."""
    # Update flow streak
    if checkin.relapse_occurred:
        profile.current_flow = 0
        profile.last_relapse_at = datetime.utcnow()
        profile.mind_strength = max(10, profile.mind_strength - 8)
    else:
        profile.current_flow += 1
        profile.recovery_days += 1
        if profile.current_flow > profile.longest_flow:
            profile.longest_flow = profile.current_flow

    # Update urge-free tracking
    if checkin.urge_intensity == 0:
        profile.urge_free_days += 1

    # Update running averages (exponential moving average, weight 0.2)
    alpha = 0.2
    profile.avg_sleep_quality = _ema(profile.avg_sleep_quality, float(checkin.sleep_quality), alpha)
    profile.avg_stress_level = _ema(profile.avg_stress_level, float(checkin.stress_score), alpha)
    profile.avg_mood = _ema(profile.avg_mood, float(checkin.mood_intensity), alpha)
    profile.avg_energy = _ema(profile.avg_energy, float(checkin.energy_score), alpha)
    profile.avg_focus = _ema(profile.avg_focus, float(checkin.focus_score), alpha)
    if checkin.urge_intensity:
        profile.avg_urge_intensity = _ema(profile.avg_urge_intensity, float(checkin.urge_intensity), alpha)

    # Top triggers tracking
    if checkin.primary_triggers:
        existing_triggers = list(profile.top_triggers or [])
        for trg in checkin.primary_triggers:
            if trg not in existing_triggers:
                existing_triggers.append(trg)
        profile.top_triggers = existing_triggers[-5:]

    # Recalculate mind strength
    profile.mind_strength = _calculate_mind_strength(profile, checkin)

    # Update risk score for today
    profile.risk_score_today = _calculate_risk_score(checkin, profile)

    profile.total_checkins += 1
    profile.last_checkin_at = datetime.utcnow()
    profile.updated_at = datetime.utcnow()

    # Log activity & snapshot
    await record_user_activity(
        profile=profile,
        activity_type="daily_checkin",
        feature_name="Daily Check-in",
        details=f"Completed daily check-in (Mood: {checkin.mood}, Stress: {checkin.stress_score}, Urges: {checkin.urge_intensity})",
        metadata={"relapse": checkin.relapse_occurred, "triggers": checkin.primary_triggers},
    )

    await profile.save()
    return profile


async def record_mission_complete(
    profile: MindProfile,
    mind_strength_gain: int,
    mission_title: str = "Daily Mission",
    category: str = "Discipline",
) -> None:
    profile.total_missions_completed += 1
    profile.mind_strength = min(100, profile.mind_strength + mind_strength_gain)

    # Store mission history
    m_history = list(profile.completed_missions_history or [])
    m_history.append({
        "title": mission_title,
        "category": category,
        "mind_strength_gained": mind_strength_gain,
        "completed_at": datetime.utcnow().isoformat(),
    })
    profile.completed_missions_history = m_history[-50:]

    await record_user_activity(
        profile=profile,
        activity_type="mission_completed",
        feature_name="Daily Missions",
        details=f"Completed mission: '{mission_title}' (+{mind_strength_gain} Mind Strength)",
        metadata={"category": category, "gain": mind_strength_gain},
    )

    profile.updated_at = datetime.utcnow()
    await profile.save()


async def record_journal_entry(profile: MindProfile, title: str = "") -> None:
    profile.total_journal_entries += 1
    profile.mind_strength = min(100, profile.mind_strength + 1)

    await record_user_activity(
        profile=profile,
        activity_type="journal_created",
        feature_name="Reflection Journal",
        details=f"Created journal entry: '{title or 'Personal Reflection'}'",
    )

    profile.updated_at = datetime.utcnow()
    await profile.save()


async def record_emergency_outcome(
    profile: MindProfile,
    outcome: str,
    techniques_used: list,
    duration_minutes: int = 5,
) -> None:
    profile.total_emergency_sessions += 1
    if outcome == "resisted":
        profile.successful_emergency_sessions += 1
        profile.mind_strength = min(100, profile.mind_strength + 3)
        for technique in techniques_used:
            if technique not in profile.top_coping_strategies:
                profile.top_coping_strategies = list(profile.top_coping_strategies or []) + [technique]
        profile.top_coping_strategies = profile.top_coping_strategies[-5:]
    elif outcome == "relapsed":
        profile.current_flow = 0
        profile.last_relapse_at = datetime.utcnow()
        profile.mind_strength = max(10, profile.mind_strength - 5)

    await record_user_activity(
        profile=profile,
        activity_type="emergency_session",
        feature_name="Emergency De-escalation Protocol",
        details=f"Emergency Session Outcome: {outcome.upper()} using {', '.join(techniques_used) if techniques_used else 'Mind Shield Protocol'}",
        metadata={"outcome": outcome, "techniques": techniques_used, "duration_minutes": duration_minutes},
    )

    profile.updated_at = datetime.utcnow()
    await profile.save()


def get_profile_summary(profile: MindProfile) -> Dict[str, Any]:
    """Return a dict representation for AI context."""
    return {
        "mind_strength": profile.mind_strength,
        "current_flow": profile.current_flow,
        "recovery_days": profile.recovery_days,
        "risk_score_today": profile.risk_score_today,
        "avg_sleep_quality": profile.avg_sleep_quality,
        "avg_stress_level": profile.avg_stress_level,
        "top_triggers": profile.top_triggers or [],
        "top_coping_strategies": profile.top_coping_strategies or [],
        "high_risk_times": profile.high_risk_times or [],
        "total_checkins": profile.total_checkins,
        "total_missions_completed": profile.total_missions_completed,
    }


def _ema(current: float, new_value: float, alpha: float = 0.2) -> float:
    """Exponential moving average — smooth updating of running stats."""
    return round(alpha * new_value + (1 - alpha) * current, 2)


def _calculate_mind_strength(profile: MindProfile, checkin: DailyCheckin) -> int:
    """
    Composite Mind Strength score (0–100)
    """
    current = profile.mind_strength

    daily_score = (
        checkin.mood_intensity * 0.20 +
        checkin.sleep_quality * 0.20 +
        checkin.focus_score * 0.20 +
        checkin.energy_score * 0.20 +
        (10 - (checkin.stress_score or 3)) * 0.20
    )  # 0–10 range

    delta = (daily_score - 5) * 0.4

    if not checkin.relapse_occurred:
        new_strength = current + delta
    else:
        new_strength = current - 8

    return max(0, min(100, round(new_strength)))


def _calculate_risk_score(checkin: DailyCheckin, profile: MindProfile) -> int:
    """
    Risk score for today (0–100, higher = more vulnerable):
    Based on: sleep quality, stress, urge intensity, mood
    """
    risk = 0

    # Sleep deprivation increases risk significantly
    sleep_hrs = getattr(checkin, 'sleep_duration', getattr(checkin, 'sleep_hours', 7.0))
    if sleep_hrs < 5:
        risk += 25
    elif sleep_hrs < 6:
        risk += 15
    elif sleep_hrs < 7:
        risk += 8

    # High stress
    stress_val = getattr(checkin, 'stress_score', getattr(checkin, 'stress', 3))
    if stress_val >= 8:
        risk += 20
    elif stress_val >= 6:
        risk += 12

    # Mood intensity
    mood_val = getattr(checkin, 'mood_intensity', 5)
    if mood_val <= 3:
        risk += 15
    elif mood_val <= 5:
        risk += 8

    # Urge intensity
    risk += (checkin.urge_intensity or 0) * 3

    # Low energy
    energy_val = getattr(checkin, 'energy_score', getattr(checkin, 'energy', 5))
    if energy_val <= 3:
        risk += 10

    if checkin.relapse_occurred:
        risk += 30

    return max(0, min(100, risk))
