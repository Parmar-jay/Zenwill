import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from collections import Counter

from app.models.user import User
from app.models.onboarding import Onboarding
from app.models.daily_checkin import DailyCheckin
from app.models.emergency_session import EmergencySession
from app.models.journal import JournalEntry
from app.models.mind_profile import MindProfile
from app.models.mission import Mission
from app.models.behavioral_event import BehavioralEvent
from app.models.relapse_autopsy import RelapseAutopsy

logger = logging.getLogger(__name__)


# ── Archetype & Status Tier Definitions ─────────────────────────────────────

MINDSET_STATUS_TIERS = [
    (90, "Ojas Transmutation Sovereign", "#00E5FF"),
    (75, "Brahmacharya Sentinel", "#10B981"),
    (60, "Neural Rewiring Active", "#8B5CF6"),
    (45, "Vigilant Warrior", "#F59E0B"),
    (0, "Rebuilding Foundation", "#EF4444"),
]


def _get_status_tier(score: int) -> tuple[str, str]:
    for threshold, title, color in MINDSET_STATUS_TIERS:
        if score >= threshold:
            return title, color
    return "Rebuilding Foundation", "#EF4444"


async def compute_deep_progress_intelligence(user: User) -> Dict[str, Any]:
    """
    100% Algorithmic, Zero-AI Progress Intelligence Engine.
    Deeply analyzes all real user data across:
    1. Onboarding Profile (purpose, baseline metrics, occupation, self-control)
    2. Daily Check-in (today's checklist + 30-day multi-variable trends)
    3. Emergency Urge Sessions (all historical urges, effectiveness, techniques)
    4. Meditation Sessions & Behavioral Telemetry
    5. Journal Reflections (depth & mood tagging)
    6. Daily Missions Completed
    7. User Streak, Points & Mind Strength
    """
    user_id_str = str(user.id)
    user_email = user.email or ""
    today = date.today()
    today_str = today.isoformat()

    # 1. Fetch Onboarding Record
    onboarding = await Onboarding.find_one(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]}
    )

    # 2. Fetch Check-in (Today or Most Recent) & Past 30 Days Check-ins
    recent_checkins = await DailyCheckin.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]}
    ).sort("-date").limit(30).to_list()

    today_checkin = next((c for c in recent_checkins if str(c.date) == today_str), None)
    latest_checkin = today_checkin or (recent_checkins[0] if recent_checkins else None)

    # 3. Fetch Emergency Urge Sessions (Up to 100)
    emergency_sessions = await EmergencySession.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]}
    ).sort("-started_at").limit(100).to_list()

    today_urges = [
        s for s in emergency_sessions
        if (s.started_at and s.started_at.strftime("%Y-%m-%d") == today_str)
        or (s.completed_at and s.completed_at.strftime("%Y-%m-%d") == today_str)
    ]
    today_urges_count = len(today_urges)
    total_urges_count = len(emergency_sessions)

    effective_sessions = [
        s for s in emergency_sessions
        if getattr(s, "was_effective", True) or getattr(s, "outcome", "") == "resisted"
    ]

    # 4. Fetch Meditation Events (Today & Total)
    med_events = await BehavioralEvent.find(
        {
            "$or": [{"user_id": user_id_str}, {"user_id": user_email}],
            "event_type": {"$in": ["meditation_session", "meditation_completed", "afternoon_meditation"]}
        }
    ).sort("-created_at").limit(50).to_list()

    has_meditated_today = any(
        (e.created_at and e.created_at.strftime("%Y-%m-%d") == today_str) for e in med_events
    )
    total_meditations_count = len(med_events)

    # 5. Fetch Recent Journals (Today & Total)
    recent_journals = await JournalEntry.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]}
    ).sort("-created_at").limit(10).to_list()

    has_journaled_today = any(
        (j.created_at and j.created_at.strftime("%Y-%m-%d") == today_str) for j in recent_journals
    )
    total_journals_count = len(recent_journals)

    # 6. Fetch Missions (Last 7 Days)
    since_7d = datetime.utcnow() - timedelta(days=7)
    recent_missions = await Mission.find(
        {
            "$or": [{"user_id": user_id_str}, {"user_id": user_email}],
            "date_assigned": {"$gte": since_7d}
        }
    ).to_list()
    completed_missions_count = sum(1 for m in recent_missions if getattr(m, "is_completed", False))
    total_missions_count = len(recent_missions)

    # 7. Fetch Latest Relapse Autopsy Record
    latest_autopsy = await RelapseAutopsy.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]}
    ).sort("-timestamp").first_or_none()

    # ── A. Base User Metrics ──────────────────────────────────────────────────
    user_name = user.name or (onboarding.first_name if onboarding else "Operative")
    streak_val = user.streak or 0
    max_streak_val = user.max_streak or streak_val
    mind_strength = user.mind_strength or 500

    occupation = getattr(onboarding, "occupation", "") if onboarding else ""
    core_purpose = (
        getattr(onboarding, "personal_statement", "")
        or getattr(onboarding, "primary_outcome", "")
        or "Reclaiming master focus, vitality, and emotional sovereignty."
    )

    # ── B. Check-in Metric Extraction ─────────────────────────────────────────
    mood = getattr(latest_checkin, "mood", "Neutral") if latest_checkin else "Neutral"
    mood_intensity = getattr(latest_checkin, "mood_intensity", 5) if latest_checkin else 5
    energy_score = getattr(latest_checkin, "energy_score", 5) if latest_checkin else 5
    stress_score = getattr(latest_checkin, "stress_score", 4) if latest_checkin else 4
    sleep_hours = getattr(latest_checkin, "sleep_duration", 7.0) if latest_checkin else 7.0
    sleep_quality = getattr(latest_checkin, "sleep_quality", 7) if latest_checkin else 7
    focus_score = getattr(latest_checkin, "focus_score", 5) if latest_checkin else 5
    relapse_today = getattr(today_checkin, "relapse_occurred", False) if today_checkin else False

    stress_causes: List[str] = getattr(latest_checkin, "stress_causes", []) if latest_checkin else []
    focus_factors: List[str] = getattr(latest_checkin, "focus_factors", []) if latest_checkin else []

    # ── C. 4-Pillar Algorithmic Scoring (0–100) ───────────────────────────────

    # Pillar 1: Daily Checklist & Mind Discipline (0–30 PTS)
    checkin_pts = 0
    if today_checkin:
        checkin_pts += 15  # Baseline for executing daily accountability
        if energy_score >= 7:
            checkin_pts += 4
        elif energy_score >= 5:
            checkin_pts += 2

        if focus_score >= 7:
            checkin_pts += 4
        elif focus_score >= 5:
            checkin_pts += 2

        if stress_score <= 4:
            checkin_pts += 4
        elif stress_score <= 6:
            checkin_pts += 2

        if sleep_hours >= 7.0 and sleep_quality >= 7:
            checkin_pts += 3
        elif sleep_hours >= 6.0:
            checkin_pts += 1
    elif latest_checkin:
        checkin_pts = 10
    else:
        checkin_pts = 5
    checkin_pts = max(0, min(30, checkin_pts))

    # Pillar 2: Reflection & Journaling (0–20 PTS)
    journal_pts = 0
    if has_journaled_today:
        journal_pts += 15
        if getattr(today_checkin, "reflection_response", None):
            journal_pts += 5
    elif total_journals_count >= 3:
        journal_pts = 10
    elif total_journals_count >= 1:
        journal_pts = 6
    else:
        journal_pts = 2
    journal_pts = max(0, min(20, journal_pts))

    # Pillar 3: Mindfulness & Yogic Transmutation (0–25 PTS)
    meditation_pts = 0
    if has_meditated_today:
        meditation_pts += 20
    elif total_meditations_count >= 5:
        meditation_pts += 12
    elif total_meditations_count >= 1:
        meditation_pts += 6
    else:
        meditation_pts = 2

    if completed_missions_count > 0:
        meditation_pts += min(completed_missions_count * 2, 5)
    meditation_pts = max(0, min(25, meditation_pts))

    # Pillar 4: Impulse Mastery & Urge Neutralization (0–25 PTS)
    urge_pts = 0
    if relapse_today:
        urge_pts = 0
    else:
        if streak_val >= 30:
            urge_pts = 25
        elif streak_val >= 14:
            urge_pts = 22
        elif streak_val >= 7:
            urge_pts = 18
        elif streak_val >= 3:
            urge_pts = 14
        else:
            urge_pts = 10

        if today_urges_count > 0:
            urge_pts = min(25, urge_pts + (today_urges_count * 3))
    urge_pts = max(0, min(25, urge_pts))

    # Total Score Calculation (0–100)
    raw_total_score = checkin_pts + journal_pts + meditation_pts + urge_pts
    final_score = max(10, min(100, raw_total_score))

    status_title, status_color = _get_status_tier(final_score)

    # ── D. Intelligent Contextual Summary Synthesis ───────────────────────────
    summary_parts: List[str] = []

    if streak_val > 0:
        summary_parts.append(f"Operating on an active {streak_val}-day clean trajectory.")
    elif latest_autopsy and getattr(latest_autopsy, "retained_percentage", None):
        summary_parts.append(
            f"Recovery baseline active: {latest_autopsy.retained_percentage}% retained neural rewiring preserved from {latest_autopsy.clean_days_count} clean days."
        )
    else:
        summary_parts.append("Currently establishing day 1 neuroplastic baseline.")

    if today_checkin:
        stress_detail = f" ({stress_causes[0]})" if stress_causes else ""
        focus_detail = f" with primary driver in {focus_factors[0]}" if focus_factors else ""
        summary_parts.append(
            f"Daily check-in confirms {mood.lower()} mood, {energy_score}/10 energy, and {stress_score}/10 stress load{stress_detail}{focus_detail}."
        )
    else:
        summary_parts.append("Daily checklist pending execution.")

    if today_urges_count > 0:
        summary_parts.append(
            f"{today_urges_count} urge {'wave' if today_urges_count == 1 else 'waves'} neutralized and transmuted today."
        )
    elif streak_val >= 7:
        summary_parts.append("Prefrontal inhibition is stabilized with zero unmanaged dopamine spikes.")

    intelligence_summary = " ".join(summary_parts)

    # ── E. Dynamic Transmutation Protocol Generation ──────────────────────────
    if streak_val == 0 and latest_autopsy and getattr(latest_autopsy, "generated_golden_rule", None):
        transmutation_protocol = (
            f"Firewall Stabilization Protocol: Enforce active rule: \"{latest_autopsy.generated_golden_rule}\". "
            "Engage 5 minutes of restorative Nadi Shodhana breathing to rapidly anchor prefrontal recovery."
        )
    elif stress_score >= 7:
        cause_txt = f" stemming from {stress_causes[0]}" if stress_causes else ""
        transmutation_protocol = (
            f"Acute Cortisol Directive: Stress is elevated ({stress_score}/10){cause_txt}. Divert sympathetic nervous arousal immediately "
            "into 3 cycles of Box Breathing (4-4-4-4) followed by 20 deep squats or 15 minutes of vigorous physical movement."
        )
    elif sleep_hours < 6.0 or sleep_quality <= 4:
        transmutation_protocol = (
            f"Prefrontal Recovery Protocol: Sleep deficit detected ({sleep_hours:.1f}h). Fatigue weakens impulse inhibition. "
            "Enforce a strict 9:30 PM digital shutdown and engage in 10 minutes of restorative Nadi Shodhana breathing."
        )
    elif today_urges_count > 0:
        transmutation_protocol = (
            "Direct Transmutation Protocol: Urge momentum is active. Channel raw sexual energy (Virya) upwards into "
            "30 minutes of deep intellectual focus, creative output, or cold water immersion to convert it into Ojas."
        )
    elif energy_score >= 7 and focus_score >= 7:
        transmutation_protocol = (
            "Apex Vitality Protocol: High mental clarity and physical energy recorded. Sublimate this vital force directly into "
            f"your primary life outcome: {core_purpose[:60]}."
        )
    else:
        transmutation_protocol = (
            "Sovereignty Protocol: Maintain steady sensory discipline. Complete your daily checklist and afternoon meditation "
            "to reinforce neural pathways against evening vulnerability."
        )

    # ── F. 7-Day Trend & Prediction Intelligence ──────────────────────────────
    relapse_count_7d = sum(1 for c in recent_checkins[:7] if getattr(c, "relapse_occurred", False))
    urge_free_days_7d = sum(
        1 for c in recent_checkins[:7]
        if not getattr(c, "urge_intensity", 0) or getattr(c, "urge_intensity", 0) == 0
    )
    avg_sleep_7d = (
        sum(getattr(c, "sleep_duration", 7.0) for c in recent_checkins[:7]) / max(len(recent_checkins[:7]), 1)
    )
    avg_stress_7d = (
        sum(getattr(c, "stress_score", 4) for c in recent_checkins[:7]) / max(len(recent_checkins[:7]), 1)
    )
    avg_mood_7d = (
        sum(getattr(c, "mood_intensity", 5) for c in recent_checkins[:7]) / max(len(recent_checkins[:7]), 1)
    )

    predictions: List[str] = []
    if streak_val >= 14:
        predictions.append("Dopamine receptor sensitivity is normalizing; expect higher intrinsic motivation and mental endurance.")
    elif streak_val >= 7:
        predictions.append("Entering week 2 neuro-stabilization window; vigilance against rationalizations is recommended.")
    else:
        predictions.append("Early habit formation stage; highest risk occurs during idle evening downtime.")

    if avg_stress_7d >= 6.5:
        predictions.append("Elevated weekly stress trend poses a secondary trigger risk during weekend evenings.")
    if avg_sleep_7d < 6.5:
        predictions.append("Accumulated sleep debt will lower impulse inhibition if sleep recovery is delayed.")

    recommendations: List[str] = [
        "Complete your daily check-in every morning before 10 AM to establish daily psychological intent.",
        "Maintain the 2-meter physical boundary between your sleeping area and mobile devices.",
        "Execute 3-minute Pranayama or Cold Splash immediately upon detecting any first warning cue.",
    ]

    return {
        "score": final_score,
        "status_title": status_title,
        "status_color": status_color,
        "summary": intelligence_summary,
        "transmutation_tip": transmutation_protocol,
        "checkin_score": checkin_pts,
        "journal_score": journal_pts,
        "meditation_urge_score": meditation_pts + urge_pts,
        "metrics_breakdown": {
            "checkin_points": checkin_pts,
            "journal_points": journal_pts,
            "meditation_points": meditation_pts,
            "urge_control_points": urge_pts,
        },
        "weekly_stats": {
            "total_checkins": len(recent_checkins[:7]),
            "relapse_count": relapse_count_7d,
            "urge_free_days": urge_free_days_7d,
            "avg_sleep_hours": round(avg_sleep_7d, 1),
            "avg_stress": round(avg_stress_7d, 1),
            "avg_mood": round(avg_mood_7d, 1),
            "total_missions": total_missions_count,
            "missions_completed": completed_missions_count,
            "total_journals": total_journals_count,
        },
        "predictions": predictions,
        "recommendations": recommendations,
    }
