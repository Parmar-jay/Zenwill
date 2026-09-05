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

    def _is_today_checkin(c) -> bool:
        if getattr(c, "date", None):
            if str(c.date)[:10] == today_str:
                return True
        if getattr(c, "created_at", None):
            if hasattr(c.created_at, "strftime") and c.created_at.strftime("%Y-%m-%d") == today_str:
                return True
            elif str(c.created_at)[:10] == today_str:
                return True
        return False

    today_checkin = next((c for c in recent_checkins if _is_today_checkin(c)), None)
    if not today_checkin and getattr(user, "last_checkin_date", None) == today_str and recent_checkins:
        if _is_today_checkin(recent_checkins[0]):
            today_checkin = recent_checkins[0]
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

    # Pillar 1: Daily Checklist & Mind Discipline (0–25 XP)
    checkin_pts = 0
    if today_checkin:
        checkin_pts += 15  # Baseline for executing daily accountability
        if energy_score >= 7:
            checkin_pts += 3
        elif energy_score >= 5:
            checkin_pts += 1

        if focus_score >= 7:
            checkin_pts += 3
        elif focus_score >= 5:
            checkin_pts += 1

        if stress_score <= 4:
            checkin_pts += 2
        elif stress_score <= 6:
            checkin_pts += 1

        if sleep_hours >= 7.0 and sleep_quality >= 7:
            checkin_pts += 2
        elif sleep_hours >= 6.0:
            checkin_pts += 1
    else:
        checkin_pts = 0
    checkin_pts = max(0, min(25, checkin_pts))

    # Pillar 2: Reflection & Journaling (0–20 XP)
    journal_pts = 0
    if has_journaled_today:
        journal_pts += 15
        if today_checkin and getattr(today_checkin, "reflection_response", None):
            journal_pts += 5
    elif total_journals_count >= 3:
        journal_pts = 10
    elif total_journals_count >= 1:
        journal_pts = 6
    else:
        journal_pts = 0
    journal_pts = max(0, min(20, journal_pts))

    # Pillar 3: Mindfulness & Yogic Transmutation (0–25 XP)
    meditation_pts = 0
    if has_meditated_today:
        meditation_pts += 20
    elif total_meditations_count >= 5:
        meditation_pts += 12
    elif total_meditations_count >= 1:
        meditation_pts += 6
    else:
        meditation_pts = 0

    if completed_missions_count > 0:
        meditation_pts += min(completed_missions_count * 2, 5)
    meditation_pts = max(0, min(25, meditation_pts))

    # Pillar 4: Impulse Mastery & Urge Neutralization (0–25 XP)
    urge_pts = 0
    if relapse_today:
        urge_pts = 0
    elif streak_val > 0:
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
    elif today_urges_count > 0:
        urge_pts = min(20, today_urges_count * 5)
    else:
        urge_pts = 0
    urge_pts = max(0, min(25, urge_pts))

    # Total Score Calculation (0–100)
    raw_total_score = checkin_pts + journal_pts + meditation_pts + urge_pts
    final_score = max(0, min(100, raw_total_score))

    status_title, status_color = _get_status_tier(final_score)

    # ── D. Intelligent Contextual Summary Synthesis (Human Scannable) ────────
    headline = ""
    summary_parts: List[str] = []

    if streak_val > 0:
        headline = f"{streak_val}-Day Clean Trajectory • Prefrontal Control Active"
        summary_parts.append(f"Operating on a steady {streak_val}-day neural rewiring path.")
    elif latest_autopsy and getattr(latest_autopsy, "retained_percentage", None):
        headline = f"Recovery Active • {latest_autopsy.retained_percentage}% Neural Rewiring Preserved"
        clean_days = getattr(latest_autopsy, "retained_clean_days", getattr(latest_autopsy, "streak_before_relapse", 0))
        summary_parts.append(
            f"Preserved {latest_autopsy.retained_percentage}% neural pathways from your {clean_days}-day run."
        )
    else:
        headline = "Day 1 Baseline • Establishing Mental Fortress"
        summary_parts.append("Establishing day 1 foundation; evening solitude is the critical window.")

    if today_checkin:
        stress_detail = f" (driver: {stress_causes[0]})" if stress_causes else ""
        summary_parts.append(
            f"Today: {mood.capitalize()} mood, {energy_score}/10 energy, {stress_score}/10 stress{stress_detail}."
        )
    else:
        summary_parts.append("Morning checklist ready for execution.")

    if today_urges_count > 0:
        summary_parts.append(
            f"{today_urges_count} urge {'wave' if today_urges_count == 1 else 'waves'} neutralized and transmuted today."
        )

    intelligence_summary = " ".join(summary_parts)

    # ── E. Dynamic Transmutation Protocol Generation (Punchy & Direct) ────────
    if streak_val == 0 and latest_autopsy and getattr(latest_autopsy, "generated_golden_rule", None):
        transmutation_protocol = (
            f"Firewall Rule: \"{latest_autopsy.generated_golden_rule}\". "
            "Execute 5 minutes of Nadi Shodhana breathing to restore prefrontal focus."
        )
    elif stress_score >= 7:
        cause_txt = f" from {stress_causes[0]}" if stress_causes else ""
        transmutation_protocol = (
            f"Cortisol Reset: Stress is elevated ({stress_score}/10){cause_txt}. "
            "Divert sympathetic arousal into 3 cycles of Box Breathing and 20 deep squats immediately."
        )
    elif sleep_hours < 6.0 or sleep_quality <= 4:
        transmutation_protocol = (
            f"Sleep Restoration: Sleep deficit ({sleep_hours:.1f}h) weakens impulse control. "
            "Enforce a strict 9:30 PM device curfew and 10 minutes of nasal breathing."
        )
    elif today_urges_count > 0:
        transmutation_protocol = (
            "Energy Transmutation: Channel sexual energy (Virya) upward into "
            "30 minutes of deep creative focus or physical training to convert into Ojas."
        )
    elif energy_score >= 7 and focus_score >= 7:
        transmutation_protocol = (
            f"Peak Focus Directive: High mental clarity recorded. Sublimate vital energy into: {core_purpose[:45]}."
        )
    else:
        transmutation_protocol = (
            "Sensory Discipline: Maintain steady vigilance. Complete afternoon meditation to guard against evening vulnerability."
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

    clean_rate_7d = int(((7 - relapse_count_7d) / 7) * 100) if recent_checkins else (100 if streak_val > 0 else 0)

    predictions: List[Dict[str, Any]] = []
    if streak_val >= 14:
        predictions.append({
            "level": "FAVORABLE",
            "title": "Dopamine Resensitization",
            "text": "Receptor density increasing; expect higher intrinsic motivation and baseline clarity.",
            "color": "#10B981",
            "icon": "sparkles",
        })
    elif streak_val >= 7:
        predictions.append({
            "level": "MODERATE",
            "title": "Week 2 Neuro-Stabilization",
            "text": "Vigilance against subtle rationalizations is critical between days 7 and 10.",
            "color": "#00E5FF",
            "icon": "shield-outline",
        })
    else:
        predictions.append({
            "level": "ELEVATED",
            "title": "Early Habit Vulnerability",
            "text": "Highest risk occurs during unmanaged evening screen solitude.",
            "color": "#F59E0B",
            "icon": "alert-circle-outline",
        })

    if avg_stress_7d >= 6.5:
        predictions.append({
            "level": "WARNING",
            "title": "Accumulated Cortisol Load",
            "text": f"Weekly stress averaging {avg_stress_7d:.1f}/10 increases craving sensitivity.",
            "color": "#EF4444",
            "icon": "flame-outline",
        })
    if avg_sleep_7d < 6.5:
        predictions.append({
            "level": "CAUTION",
            "title": "Sleep Debt Detected",
            "text": f"Averaging {avg_sleep_7d:.1f}h sleep diminishes willpower and impulse control.",
            "color": "#F59E0B",
            "icon": "moon-outline",
        })

    recommendations: List[Dict[str, Any]] = [
        {
            "title": "Morning Intent Lock",
            "action": "Complete daily check-in before 10 AM to prime prefrontal resistance.",
            "tag": "Daily Priming",
            "color": "#00E5FF",
            "icon": "sunny-outline",
        },
        {
            "title": "Spatial Device Curfew",
            "action": "Keep devices outside sleeping area 45 minutes before sleep.",
            "tag": "Environment",
            "color": "#A855F7",
            "icon": "bed-outline",
        },
        {
            "title": "3-Second Somatic Snap",
            "action": "Splash cold water or do 20 squats on first sign of mental fantasy.",
            "tag": "Emergency",
            "color": "#10B981",
            "icon": "flash-outline",
        },
    ]

    # 4 Quick Metric Cards for instant human scanning
    has_checkins_7d = len(recent_checkins[:7]) > 0
    sleep_stress_val = f"{avg_sleep_7d:.1f}h / {avg_stress_7d:.0f}st" if has_checkins_7d else "N/A"
    sleep_stress_sub = "Cortisol Index" if has_checkins_7d else "No Check-ins Logged"

    core_metrics = [
        {
            "id": "clean_consistency",
            "label": "7-Day Consistency",
            "value": f"{clean_rate_7d}%" if (recent_checkins or streak_val > 0) else "N/A",
            "sub": f"{7 - relapse_count_7d}/7 Days Clean" if (recent_checkins or streak_val > 0) else "0/7 Days Clean",
            "color": "#10B981",
            "icon": "shield-checkmark",
        },
        {
            "id": "urges_neutralized",
            "label": "Urges Neutralized",
            "value": str(len(effective_sessions)) if emergency_sessions else (str(today_urges_count) if today_urges_count > 0 else "0"),
            "sub": "Zero Relapse Yield" if streak_val > 0 else "Urge Defense Count",
            "color": "#00E5FF",
            "icon": "flame",
        },
        {
            "id": "mind_strength",
            "label": "Mind Strength",
            "value": str(user.mind_strength or 500),
            "sub": f"{status_title[:18]}",
            "color": "#A855F7",
            "icon": "flash",
        },
        {
            "id": "recovery_balance",
            "label": "Sleep & Stress",
            "value": sleep_stress_val,
            "sub": sleep_stress_sub,
            "color": "#38BDF8",
            "icon": "moon",
        },
    ]

    return {
        "score": final_score,
        "status_title": status_title,
        "status_color": status_color,
        "headline": headline,
        "summary": intelligence_summary,
        "transmutation_tip": transmutation_protocol,
        "checkin_score": checkin_pts,
        "journal_score": journal_pts,
        "meditation_urge_score": meditation_pts + urge_pts,
        "today_checkin_completed": today_checkin is not None,
        "metrics_breakdown": {
            "checkin_points": checkin_pts if today_checkin else None,
            "journal_points": journal_pts if (total_journals_count > 0 or has_journaled_today) else None,
            "meditation_points": meditation_pts if (total_meditations_count > 0 or has_meditated_today or completed_missions_count > 0) else None,
            "urge_control_points": urge_pts if (streak_val > 0 or today_urges_count > 0 or emergency_sessions) else None,
        },
        "core_metrics": core_metrics,
        "weekly_stats": {
            "total_checkins": len(recent_checkins[:7]),
            "relapse_count": relapse_count_7d,
            "urge_free_days": urge_free_days_7d,
            "clean_rate_percentage": clean_rate_7d,
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
