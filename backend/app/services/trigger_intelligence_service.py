import logging
from datetime import datetime, date, timedelta, timezone
from typing import Dict, Any, List, Optional
from collections import Counter

from app.models.user import User
from app.models.onboarding import Onboarding
from app.models.daily_checkin import DailyCheckin
from app.models.emergency_session import EmergencySession
from app.models.journal import JournalEntry
from app.models.mind_profile import MindProfile
from app.models.behavioral_event import BehavioralEvent
from app.models.relapse_autopsy import RelapseAutopsy

logger = logging.getLogger(__name__)


# ── Domain Knowledge Bases & Protocol Matrices ──────────────────────────────

TIME_SLOT_RANGES = {
    "morning": ("06:30 AM - 09:00 AM", 7),
    "afternoon": ("01:30 PM - 04:30 PM", 14),
    "evening": ("06:30 PM - 09:30 PM", 19),
    "night": ("09:30 PM - 11:45 PM", 22),
    "late_night": ("11:30 PM - 02:00 AM", 23),
    "midnight": ("11:45 PM - 02:30 AM", 0),
    "waking_up": ("06:00 AM - 08:30 AM", 7),
    "bedtime": ("10:30 PM - 01:00 AM", 23),
}

FIRST_SIGN_PROTOCOLS = {
    "fantasy": {
        "title": "Mental Fantasy / Visualization",
        "action": "Execute the 3-Second Mental Severance: Acknowledge the mental imagery as meaningless neural noise without feeding or fighting it. Immediately splash cold water on your face, fix eyes on a real physical object, and vocalize 'Not this.'",
        "category": "Cognitive",
        "color": "#10B981",
    },
    "thought": {
        "title": "Compulsive Suggestion / Whisper",
        "action": "Cognitive Pattern Interrupt: Shift conscious awareness immediately to 5 sensory stimuli in your immediate environment. Take 5 deep diaphragmatic breaths (4s inhale, 4s hold, 6s exhale) to re-engage prefrontal cortex control.",
        "category": "Cognitive",
        "color": "#06B6D4",
    },
    "physical": {
        "title": "Pelvic Heat / Physical Restlessness",
        "action": "Somatic Blood-Flow Redirection: Stand up immediately from any seated or lying position. Perform 20 deep bodyweight squats or 15 pushups to divert pelvic blood flow into major skeletal muscle groups.",
        "category": "Physical",
        "color": "#F59E0B",
    },
    "craving": {
        "title": "Dopamine Hunger / Craving Pulse",
        "action": "Dopamine Grounding & Hydration: Drink a full glass of cold water with a pinch of mineral salt. Put your device down completely and step into a bright, public, or well-lit space for at least 5 minutes.",
        "category": "Physical",
        "color": "#EC4899",
    },
    "emotion": {
        "title": "Emotional Urgency / Dysphoria",
        "action": "Vagus Nerve Somatic Reset: Place your right hand firmly over your heart center. Initiate 4-7-8 Pranayama breathing (4s inhale, 7s hold, 8s slow exhale) to deactivate the sympathetic stress response.",
        "category": "Emotional",
        "color": "#8B5CF6",
    },
    "memory": {
        "title": "Neural Memory / Nostalgia Flash",
        "action": "Aftermath Recall Protocol: Instantly bring to mind the immediate post-relapse sensations (brain fog, depleted vitality, heavy regret). Reconnect with your non-negotiable purpose pledge.",
        "category": "Cognitive",
        "color": "#3B82F6",
    },
    "touching": {
        "title": "Unconscious Tactile Proximity",
        "action": "Hands-Off Spatial Reset: Remove hands from device and body immediately. Stand up, open room door, wash hands with cold water, and change your physical room posture.",
        "category": "Physical",
        "color": "#EF4444",
    },
    "dont_know": {
        "title": "Subtle Baseline Urge",
        "action": "Immediate Spatial Relocation: Change your physical room environment immediately. Walk into natural light or fresh air and practice slow mindful nasal breathing.",
        "category": "Physical",
        "color": "#10B981",
    },
}


def _format_hour_window(start_hour: int, span_hours: int = 2) -> str:
    """Formats a numeric start hour into a clean AM/PM window string."""
    end_hour = (start_hour + span_hours) % 24

    def _fmt(h: int) -> str:
        period = "AM" if h < 12 else "PM"
        display_h = h % 12
        if display_h == 0:
            display_h = 12
        return f"{display_h:02d}:00 {period}"

    return f"{_fmt(start_hour)} - {_fmt(end_hour)}"


def get_realtime_diurnal_phase(hour: int) -> Dict[str, Any]:
    """
    Returns exact diurnal circadian phase with rich biological and behavioral telemetry.
    Morning: 05:00 - 11:59
    Afternoon: 12:00 - 17:59
    Evening: 18:00 - 21:59
    Night / Late Night: 22:00 - 04:59
    """
    if 5 <= hour < 12:
        return {
            "phase_id": "morning",
            "phase_name": "Morning Awakening & Focus",
            "time_window": "06:00 AM - 12:00 PM",
            "status_label": "ACTIVE RIGHT NOW: MORNING PROTOCOL",
            "biological_state": "Cortisol Awakening Surge & Prefrontal Booting",
            "primary_hazard": "Bedside screen grazing in bed before getting on two feet",
            "tactical_directive": "Execute the 3-Minute Grounding Launch: Get on your feet, drink 500ml cold water, get outdoor sunlight, and complete morning check-in before opening any digital app.",
            "color": "#6366F1",
        }
    elif 12 <= hour < 18:
        return {
            "phase_id": "afternoon",
            "phase_name": "Midday Focus & Energy Reset",
            "time_window": "12:00 PM - 06:00 PM",
            "status_label": "ACTIVE RIGHT NOW: AFTERNOON RESET",
            "biological_state": "Circadian Dopamine Dip & Cognitive Work Fatigue",
            "primary_hazard": "Post-lunch mental slump and work-stress grazing on feeds",
            "tactical_directive": "Execute the 3 PM Somatic Reset: Step away from all monitors, perform 20 deep bodyweight squats or 5 minutes of Bhramari Pranayama (humming resonance) to clear mental fog.",
            "color": "#10B981",
        }
    elif 18 <= hour < 22:
        return {
            "phase_id": "evening",
            "phase_name": "Evening Decompression & Digital Quarantine",
            "time_window": "06:00 PM - 10:00 PM",
            "status_label": "ACTIVE RIGHT NOW: EVENING QUARANTINE",
            "biological_state": "Willpower Depletion & Post-Work Dopamine Seeking",
            "primary_hazard": "Unstructured horizontal screen scrolling in solitary living space",
            "tactical_directive": "Activate Evening Quarantine: Keep ambient room lights bright, engage dedicated physical workout or social dinner, and leave phone charging across the room.",
            "color": "#8B5CF6",
        }
    else:
        return {
            "phase_id": "night",
            "phase_name": "Peak Circadian & Bedside Solitude",
            "time_window": "10:00 PM - 02:00 AM",
            "status_label": "ACTIVE RIGHT NOW: HIGH-RISK BEDSIDE WINDOW",
            "biological_state": "Melatonin Rise & Sensitized Impulse Gate (Prefrontal Offline)",
            "primary_hazard": "Late-night private bedroom solitude with screen in the dark",
            "tactical_directive": "Bedside Non-Negotiable Lockdown: Phone must be plugged in minimum 10 feet away from mattress. Practice 5 minutes of 4-7-8 Pranayama in darkness to induce deep restorative sleep.",
            "color": "#EF4444",
        }


def infer_realistic_temporal_spatial_context(
    start_hour: int,
    occupation: str,
    daily_schedule: str,
    ob_locations: List[str],
    logged_environments: List[str],
    primary_device: str,
) -> Dict[str, str]:
    """
    Intelligently determines realistic spatial and contextual vulnerability.
    """
    occ_lower = (occupation or "").lower()
    sched_lower = (daily_schedule or "standard").lower()
    is_work_student = any(k in occ_lower for k in ["engineer", "developer", "student", "office", "manager", "accountant", "analyst", "designer", "doctor", "consultant"]) or sched_lower == "standard"

    if logged_environments:
        clean_logged = logged_environments[0].strip()
        if clean_logged and len(clean_logged) > 2:
            return {
                "environment_label": clean_logged,
                "context_description": f"{clean_logged} during {primary_device} usage",
                "environmental_rule": f"Spatial Guardrail: Maintain strict device mindfulness in {clean_logged} and keep ambient lighting high.",
            }

    # 1. Morning Awakening Window (05:00 - 08:59)
    if 5 <= start_hour < 9:
        loc = "Bedroom Bedside" if "bedroom" in ob_locations else "Awakening Space"
        return {
            "environment_label": f"Morning {loc}",
            "context_description": f"Waking up with {primary_device} in hand before getting out of bed",
            "environmental_rule": f"Morning Launch Rule: Never check {primary_device} while still in bed. Get on two feet, hydrate, and get sunlight first.",
        }

    # 2. Midday / Work / Study Window (09:00 - 17:59)
    elif 9 <= start_hour < 18:
        if is_work_student:
            return {
                "environment_label": "Workplace Desk / Study Space",
                "context_description": f"Midday mental fatigue or post-lunch downtime with {primary_device}",
                "environmental_rule": "Workplace Boundary: Keep phone in bag or desk drawer during deep work sprints. Take walking breaks away from screens.",
            }
        else:
            loc = ob_locations[0].replace("_", " ").title() if ob_locations else "Home Workspace"
            return {
                "environment_label": f"Midday {loc}",
                "context_description": f"Unstructured midday downtime with {primary_device} in {loc}",
                "environmental_rule": f"Daytime Spatial Rule: Avoid solitary idle screen time in {loc}. Engage active physical tasks.",
            }

    # 3. Evening Decompression Window (18:00 - 21:59)
    elif 18 <= start_hour < 22:
        loc = ob_locations[0].replace("_", " ").title() if ob_locations else "Living Space"
        return {
            "environment_label": f"Evening {loc}",
            "context_description": f"Post-work decompression and fatigue-driven browsing in {loc}",
            "environmental_rule": f"Evening Quarantine: Replace passive scrolling in {loc} with dedicated exercise, reading, or social dinner.",
        }

    # 4. Late Night / Bedtime Window (22:00 - 04:59)
    else:
        return {
            "environment_label": "Private Bedside Solitude",
            "context_description": f"Late-night private bedroom screen usage on {primary_device}",
            "environmental_rule": f"Bedside Boundary: Charge {primary_device} across the room or outside bedroom 30 minutes before sleep.",
        }


async def compute_deep_trigger_intelligence(
    user: User,
    client_local_hour: Optional[int] = None,
    tz_offset_minutes: Optional[int] = None,
) -> Dict[str, Any]:
    """
    100% Algorithmic Real-Time Trigger Intelligence Engine.
    Deeply analyzes all real user data:
    1. Onboarding Profile (occupation, schedule, warning cues, device, stated urge times & locations)
    2. Daily Check-ins (30-day history of stress causes, sleep quality/duration, mood, urge intensities)
    3. Emergency Sessions (actual logged urge timestamps, environments, trigger reasons, effective techniques)
    4. Behavioral Telemetry & Habit Consistency
    5. User Streak & Gamification State
    """
    user_id_str = str(user.id)
    user_email = user.email or ""

    # 1. Fetch Onboarding Record
    onboarding = await Onboarding.find_one(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]}
    )

    # 2. Fetch Daily Checkins (Last 30 days)
    recent_checkins = await DailyCheckin.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]}
    ).sort("-date").limit(30).to_list()

    # 3. Fetch Emergency Urge Sessions (Up to 100)
    emergency_sessions = await EmergencySession.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]}
    ).sort("-started_at").limit(100).to_list()

    # 4. Fetch Behavioral Events
    behavioral_events = await BehavioralEvent.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]}
    ).sort("-created_at").limit(50).to_list()

    # 5. Fetch Latest Relapse Autopsy Record
    latest_autopsy = await RelapseAutopsy.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]}
    ).sort("-created_at").first_or_none()

    # ── A. Base User Parameters ───────────────────────────────────────────────
    user_name = user.name or (onboarding.first_name if onboarding else "Operative")
    streak_val = user.streak or 0
    last_status = getattr(user, "last_retain_status", None)
    is_post_relapse = streak_val == 0 or last_status == "relapsed"
    mind_strength = user.mind_strength or 500

    occupation = getattr(onboarding, "occupation", "") if onboarding else ""
    daily_schedule = getattr(onboarding, "daily_schedule", "standard") if onboarding else "standard"
    ob_triggers = [t.lower() for t in getattr(onboarding, "emotional_triggers", [])] if onboarding else []
    ob_first_sign = (getattr(onboarding, "first_warning_sign", "craving") or "craving").lower()
    ob_locations = [l.lower() for l in getattr(onboarding, "urge_locations", [])] if onboarding else []
    ob_device = (getattr(onboarding, "primary_device", "phone") or "phone").lower()
    ob_urge_times = getattr(onboarding, "urge_times", []) if onboarding else []
    primary_dev = ob_device.replace("_", " ").title()

    if latest_autopsy and latest_autopsy.device_involved:
        primary_dev = latest_autopsy.device_involved.replace("_", " ").title()

    # ── B. Precision Real-Time Hour & Timezone Resolution ─────────────────────
    if client_local_hour is not None and 0 <= client_local_hour <= 23:
        current_hour = client_local_hour
        now_local = datetime.utcnow()
        if tz_offset_minutes is not None:
            tz = timezone(timedelta(minutes=tz_offset_minutes))
            now_local = datetime.now(tz)
        today_weekday_name = now_local.strftime("%A")
    elif tz_offset_minutes is not None:
        tz = timezone(timedelta(minutes=tz_offset_minutes))
        now_local = datetime.now(tz)
        current_hour = now_local.hour
        today_weekday_name = now_local.strftime("%A")
    else:
        # Default to IST (UTC+5:30) as primary user base or server local time
        tz_ist = timezone(timedelta(hours=5, minutes=30))
        now_local = datetime.now(tz_ist)
        current_hour = now_local.hour
        today_weekday_name = now_local.strftime("%A")

    current_phase_info = get_realtime_diurnal_phase(current_hour)

    # ── C. Timestamp & Temporal Distribution Analysis ─────────────────────────
    total_urges_count = len(emergency_sessions)
    today_str = date.today().isoformat()

    today_urges = [
        s for s in emergency_sessions
        if (s.started_at and s.started_at.strftime("%Y-%m-%d") == today_str)
        or (s.completed_at and s.completed_at.strftime("%Y-%m-%d") == today_str)
    ]
    today_urges_count = len(today_urges)

    effective_sessions = [
        s for s in emergency_sessions
        if getattr(s, "was_effective", True) or getattr(s, "outcome", "") == "resisted"
    ]
    effectiveness_rate = (
        int((len(effective_sessions) / max(total_urges_count, 1)) * 100)
        if emergency_sessions
        else (95 if streak_val > 7 else (72 if is_post_relapse else 88))
    )

    urge_hours: List[int] = []
    urge_days: List[str] = []
    session_reasons: List[str] = []
    helpful_techniques: List[str] = []
    logged_environments: List[str] = []

    for s in emergency_sessions:
        dt = s.started_at or s.completed_at
        if dt:
            urge_hours.append(dt.hour)
            urge_days.append(dt.strftime("%A"))
        if getattr(s, "environment", None):
            logged_environments.append(s.environment.strip())
        if getattr(s, "trigger_reason", None):
            session_reasons.append(s.trigger_reason.strip())
        if getattr(s, "main_influence", None):
            session_reasons.append(s.main_influence.strip())
        if getattr(s, "most_helpful_technique", None):
            helpful_techniques.append(s.most_helpful_technique.strip())

    for e in behavioral_events:
        if getattr(e, "hour_of_day", None) is not None:
            urge_hours.append(e.hour_of_day)
        elif e.created_at:
            urge_hours.append(e.created_at.hour)
            urge_days.append(e.created_at.strftime("%A"))

    # ── D. Circadian Peak Window Computation ─────────────────────────────────
    if is_post_relapse and latest_autopsy and latest_autopsy.approximate_time_window:
        peak_risk_window = latest_autopsy.approximate_time_window
        window_start_hour = 23 if ("night" in peak_risk_window.lower() or "bed" in peak_risk_window.lower()) else 14
    elif urge_hours:
        hour_counts = Counter(urge_hours)
        peak_hour = max(hour_counts, key=hour_counts.get)
        peak_risk_window = _format_hour_window(peak_hour, 2)
        window_start_hour = peak_hour
    elif ob_urge_times:
        first_time_pref = ob_urge_times[0].lower()
        if first_time_pref in TIME_SLOT_RANGES:
            peak_risk_window, window_start_hour = TIME_SLOT_RANGES[first_time_pref]
        else:
            peak_risk_window, window_start_hour = ("10:30 PM - 12:30 AM", 23)
    elif daily_schedule == "night_shift":
        peak_risk_window, window_start_hour = ("03:00 AM - 05:30 AM", 3)
    else:
        peak_risk_window, window_start_hour = ("10:30 PM - 12:30 AM", 23)

    # ── E. Peak Risk Day Computation ──────────────────────────────────────────
    if urge_days and len(urge_days) >= 2:
        day_counts = Counter(urge_days)
        top_day = day_counts.most_common(1)[0][0]
        if day_counts[top_day] >= 2:
            peak_day = f"{top_day}s"
        else:
            peak_day = "Late Evenings & Weekends"
    elif daily_schedule in ["night_shift", "freelancer"]:
        peak_day = "Weekends (Fri / Sat)"
    elif daily_schedule == "student":
        peak_day = "Sunday Evenings"
    else:
        peak_day = "Weekends & Late Evenings"

    # ── F. Realistic Spatial & Contextual Intelligence ───────────────────────
    spatial_intel = infer_realistic_temporal_spatial_context(
        start_hour=window_start_hour,
        occupation=occupation,
        daily_schedule=daily_schedule,
        ob_locations=ob_locations,
        logged_environments=logged_environments,
        primary_device=primary_dev,
    )
    environment_label = spatial_intel["environment_label"]
    environmental_rule = spatial_intel["environmental_rule"]

    if latest_autopsy and latest_autopsy.physical_environment:
        environment_label = latest_autopsy.physical_environment
    if latest_autopsy and latest_autopsy.generated_golden_rule:
        environmental_rule = latest_autopsy.generated_golden_rule

    # Calculate Next Predicted High-Risk Window relative to current real-time hour
    if current_hour >= 22 or current_hour < 5:
        next_predicted_window = "Active Right Now (Late-Night Screen Solitude)"
        next_predicted_context = f"Active Bedside Solitude with {primary_dev}"
    elif 5 <= current_hour < 12:
        if window_start_hour < 12 and window_start_hour >= current_hour:
            next_predicted_window = f"This Morning, {peak_risk_window}"
        else:
            next_predicted_window = f"Tonight, {peak_risk_window}"
        next_predicted_context = f"Evening Decompression in {environment_label}"
    elif 12 <= current_hour < 18:
        if 12 <= window_start_hour < 18 and window_start_hour >= current_hour:
            next_predicted_window = f"This Afternoon, {peak_risk_window}"
            next_predicted_context = f"Midday Screen Slump in {environment_label}"
        else:
            next_predicted_window = f"Tonight, {peak_risk_window}"
            next_predicted_context = f"Late-Night Bedside in {environment_label}"
    else:
        next_predicted_window = f"Tonight, {peak_risk_window}"
        next_predicted_context = f"Late-Night Bedside in {environment_label}"

    # ── G. Check-in Multi-Day Telemetry Analysis ─────────────────────────────
    latest_checkin = recent_checkins[0] if recent_checkins else None

    avg_stress = sum(getattr(c, "stress_score", 4) for c in recent_checkins) / max(len(recent_checkins), 1)
    avg_sleep_hours = sum(getattr(c, "sleep_duration", 7.0) for c in recent_checkins) / max(len(recent_checkins), 1)
    avg_sleep_quality = sum(getattr(c, "sleep_quality", 7) for c in recent_checkins) / max(len(recent_checkins), 1)

    current_stress = getattr(latest_checkin, "stress_score", 4) if latest_checkin else int(avg_stress)
    current_sleep_hours = getattr(latest_checkin, "sleep_duration", 7.0) if latest_checkin else avg_sleep_hours
    current_sleep_quality = getattr(latest_checkin, "sleep_quality", 7) if latest_checkin else int(avg_sleep_quality)
    current_mood = getattr(latest_checkin, "mood", "Neutral") if latest_checkin else "Neutral"
    checkin_urge_intensity = getattr(latest_checkin, "urge_intensity", 0) if latest_checkin else 0

    checkin_triggers: List[str] = []
    checkin_stress_causes: List[str] = []
    for c in recent_checkins:
        if getattr(c, "primary_triggers", None):
            checkin_triggers.extend(c.primary_triggers)
        if getattr(c, "stress_causes", None):
            checkin_stress_causes.extend(c.stress_causes)

    # ── H. Dynamic Multi-Variable Risk Score (0–100) ─────────────────────────
    if is_post_relapse:
        base_risk = 72
    elif streak_val >= 90:
        base_risk = 14
    elif streak_val >= 30:
        base_risk = 22
    elif streak_val >= 14:
        base_risk = 30
    elif streak_val >= 7:
        base_risk = 38
    elif streak_val >= 3:
        base_risk = 48
    else:
        base_risk = 58

    stress_pts = 25 if current_stress >= 8 else (16 if current_stress >= 6 else (8 if current_stress >= 4 else 0))
    sleep_pts = 20 if (current_sleep_hours < 5.5 or current_sleep_quality <= 3) else (12 if (current_sleep_hours < 6.5 or current_sleep_quality <= 5) else 0)
    urge_velocity_pts = min(today_urges_count * 14, 28)
    checkin_urge_pts = 16 if checkin_urge_intensity >= 7 else (8 if checkin_urge_intensity >= 4 else 0)
    mood_pts = 10 if current_mood in ["Sad", "Anxious", "Lonely", "Overwhelmed", "Frustrated", "Angry"] else 0

    # Real-Time Hour Risk Modifier (Night & Late Evening have biologically higher risk)
    hour_risk_modifier = 12 if (current_hour >= 22 or current_hour < 4) else (8 if 18 <= current_hour < 22 else 0)

    total_risk = base_risk + stress_pts + sleep_pts + urge_velocity_pts + checkin_urge_pts + mood_pts + hour_risk_modifier
    risk_score = max(15, min(96, total_risk))

    if risk_score >= 75 or is_post_relapse:
        risk_level = "CRITICAL (POST-RELAPSE REBOUND)" if is_post_relapse else "CRITICAL VULNERABILITY"
    elif risk_score >= 50:
        risk_level = "ELEVATED VULNERABILITY"
    elif risk_score >= 30:
        risk_level = "MODERATE VULNERABILITY"
    else:
        risk_level = "OPTIMAL RESILIENCE"

    # ── I. Environmental & Behavioral Active Domino Triggers ──────────────────
    active_catalysts = []
    active_catalysts.append(f"{current_phase_info['phase_name']}")
    if is_post_relapse and latest_autopsy:
        active_catalysts.append(f"Recent Domino: {latest_autopsy.first_compromise_title}")
        active_catalysts.append(f"Vulnerable Space: {latest_autopsy.physical_environment}")
    else:
        if current_sleep_hours < 6.5 or current_sleep_quality <= 4:
            active_catalysts.append(f"Sleep Deficit ({current_sleep_hours:.1f}h)")
        if current_stress >= 6:
            active_catalysts.append(f"High Stress ({current_stress}/10)")
        if checkin_triggers:
            top_checkin_trigger = Counter(checkin_triggers).most_common(1)[0][0]
            active_catalysts.append(top_checkin_trigger)
        active_catalysts.append(f"{primary_dev} in {environment_label}")

    first_sign_info = FIRST_SIGN_PROTOCOLS.get(ob_first_sign, FIRST_SIGN_PROTOCOLS["craving"])
    if today_urges_count > 0:
        active_catalysts.append("Urge SOS Reset")

    # ── J. Dynamic Real-Time Primary Vulnerability Statement ──────────────────
    if is_post_relapse:
        if latest_autopsy:
            primary_vulnerability = f"Post-Relapse Chaser Window: Guard against repeat compromise ({latest_autopsy.first_compromise_title} in {latest_autopsy.physical_environment}). Enforce your Golden Rule immediately."
        else:
            primary_vulnerability = "Post-Relapse Rebuilding Phase: Prefrontal control is sensitized. Lock down solitary screen access and follow immediate physical grounding."
    elif 12 <= current_hour < 18 and current_stress >= 6:
        primary_vulnerability = f"Midday Work Slump ({current_phase_info['time_window']}): Cognitive fatigue ({current_stress}/10 stress) is triggering digital dopamine snacking on {primary_dev}."
    elif 18 <= current_hour < 22:
        primary_vulnerability = f"Evening Decompression Window: Willpower depleted after work/study. Solitary screen lounging in {environment_label} is the primary vulnerability."
    elif current_hour >= 22 or current_hour < 5:
        primary_vulnerability = f"Peak Bedside Vulnerability (Active Right Now): Late-night solitude with {primary_dev} in the dark. Prefrontal impulse control is offline."
    elif 5 <= current_hour < 12:
        primary_vulnerability = f"Morning Awakening Horizon: Checking {primary_dev} before sunlight or hydration creates an immediate dopamine craving loop for the day."
    elif today_urges_count > 0 or checkin_urge_intensity >= 6:
        primary_vulnerability = f"Active craving wave recorded today. High dopamine seeking predicted during {peak_risk_window} in {environment_label}."
    else:
        primary_vulnerability = f"Unstructured idle screen time on {primary_dev} during {peak_risk_window} in {environment_label}."

    # ── K. 3-Tier Tactical Defense Protocol (Real-Time Synchronized) ───────────
    step1_action = first_sign_info["action"]
    step2_device_rule = current_phase_info["tactical_directive"]
    clean_techs = [t for t in (helpful_techniques or []) if t and t.lower() not in ["unknown", "none", "null"]]
    top_tech = clean_techs[0] if clean_techs else ("Bhramari Pranayama" if 12 <= current_hour < 18 else "4-7-8 Pranayama Reset")
    step3_transmute = f"Engage {top_tech}: Transmute vital physical energy through deep diaphragmatic breath or 20 pushups."

    tactical_defense = f"1) {step1_action} 2) {step2_device_rule} 3) {step3_transmute}"

    # ── L. Future Trigger Forecast & Preemptive Shield ────────────────────────
    predicted_probability = min(95, max(35, risk_score + (15 if is_post_relapse else 0) + (10 if current_stress >= 6 else 0)))

    if is_post_relapse and latest_autopsy:
        forecast_root = f"Chaser effect and dopamine rebound in {latest_autopsy.physical_environment}"
        predicted_trigger = f"Chaser Wave: {latest_autopsy.first_compromise_title}"
    elif current_hour >= 22 or current_hour < 5:
        forecast_root = f"Active late-night bedroom solitude with {primary_dev}"
        predicted_trigger = f"Late-Night Bedside {primary_dev} Solitude"
    elif 12 <= current_hour < 18:
        forecast_root = f"Midday post-lunch mental fatigue ({current_stress}/10 stress) and screen slump"
        predicted_trigger = f"Midday Screen Grazing on {primary_dev}"
    elif 18 <= current_hour < 22:
        forecast_root = f"Post-work willpower depletion and unstructured lounge in {environment_label}"
        predicted_trigger = f"Evening Decompression on {primary_dev}"
    else:
        forecast_root = f"Unstructured solitary screen time on {primary_dev} in {environment_label}"
        predicted_trigger = f"Tonight's Bedside {primary_dev} Window"

    future_trigger_forecast = {
        "predicted_window": next_predicted_window,
        "predicted_context": next_predicted_context,
        "probability_pct": predicted_probability,
        "predicted_trigger_name": predicted_trigger,
        "root_catalyst": forecast_root,
        "preemptive_action": f"Pre-commit now: {current_phase_info['tactical_directive']}",
    }

    # ── M. 24-Hour Predictive Risk Horizon Timeline (Accurately Synced) ───────
    forecast_timeline_24h = [
        {
            "id": "slot-morning",
            "time_label": "06:00 AM - 12:00 PM",
            "period_name": "Morning Awakening",
            "risk_score": max(20, min(55, int(risk_score * 0.45) + (15 if is_post_relapse else 0))),
            "risk_level": "MODERATE" if is_post_relapse else "LOW",
            "key_hazard": f"Checking {primary_dev} in bed before getting on two feet",
            "shield_protocol": "Hydrate with 500ml water and get 5 min outdoor sunlight before opening digital feeds.",
            "is_current": 5 <= current_hour < 12,
        },
        {
            "id": "slot-midday",
            "time_label": "12:00 PM - 06:00 PM",
            "period_name": "Midday Focus & Energy",
            "risk_score": max(35, min(75, int(risk_score * 0.7) + (10 if is_post_relapse else 0) + (10 if current_stress >= 6 else 0))),
            "risk_level": "ELEVATED" if (is_post_relapse or current_stress >= 6) else "MODERATE",
            "key_hazard": f"Post-lunch cognitive fatigue and work-stress grazing on {primary_dev}",
            "shield_protocol": "Step away from screen at 3 PM: execute 20 bodyweight squats or 5 min Bhramari breathwork.",
            "is_current": 12 <= current_hour < 18,
        },
        {
            "id": "slot-evening",
            "time_label": "06:00 PM - 10:00 PM",
            "period_name": "Evening Decompression",
            "risk_score": max(55, min(88, int(risk_score * 0.85) + (10 if is_post_relapse else 0))),
            "risk_level": "CRITICAL" if is_post_relapse else "ELEVATED",
            "key_hazard": f"Unstructured solitary lounging on couch/bed in {environment_label}",
            "shield_protocol": "Keep ambient room lighting bright; engage workout or social dinner; keep device in living area.",
            "is_current": 18 <= current_hour < 22,
        },
        {
            "id": "slot-night",
            "time_label": "10:00 PM - 02:00 AM",
            "period_name": "Peak Bedside Solitude",
            "risk_score": min(96, max(80 if is_post_relapse else 68, risk_score + 12)),
            "risk_level": "CRITICAL",
            "key_hazard": f"Late-night private bedroom screen time in {environment_label}",
            "shield_protocol": "Bedside Boundary: Charge phone 10 feet away from bed 30 minutes before sleep.",
            "is_current": current_hour >= 22 or current_hour < 5,
        },
    ]

    # ── N. Granular Triggers Breakdown Array (5 Real-Time Categories) ─────────
    triggers_breakdown: List[Dict[str, Any]] = []

    if is_post_relapse and latest_autopsy:
        triggers_breakdown.append({
            "id": "trig-compromise-domino",
            "name": f"Compromise Domino: {latest_autopsy.first_compromise_title}",
            "category": "Environmental",
            "frequency": max(total_urges_count, 1),
            "riskScore": 95,
            "color": "#EF4444",
            "peakTime": latest_autopsy.approximate_time_window or peak_risk_window,
            "recommendation": environmental_rule,
        })

    triggers_breakdown.extend([
        {
            "id": "trig-circadian",
            "name": f"{current_phase_info['phase_name']} ({current_phase_info['time_window']})",
            "category": "Circadian",
            "frequency": max(total_urges_count, 1),
            "riskScore": min(95, risk_score + 4),
            "color": current_phase_info["color"],
            "peakTime": current_phase_info["time_window"],
            "recommendation": current_phase_info["tactical_directive"],
        },
        {
            "id": "trig-environmental",
            "name": f"{environment_label} Proximity",
            "category": "Environmental",
            "frequency": max(total_urges_count, 2),
            "riskScore": min(90, max(55, risk_score - 4)),
            "color": "#8B5CF6",
            "peakTime": peak_risk_window,
            "recommendation": environmental_rule,
        },
        {
            "id": "trig-physical",
            "name": f"Somatic Cue: {first_sign_info['title']}",
            "category": "Physical",
            "frequency": max(total_urges_count, 1),
            "riskScore": min(88, max(50, risk_score - 8)),
            "color": "#F59E0B",
            "peakTime": "Immediate",
            "recommendation": step1_action,
        },
        {
            "id": "trig-emotional",
            "name": f"Stress & Autonomic State ({current_stress}/10)",
            "category": "Emotional",
            "frequency": max(len(recent_checkins), 1),
            "riskScore": min(92, max(45, (current_stress * 10) + 15)),
            "color": "#EF4444" if current_stress >= 6 else "#10B981",
            "peakTime": "Late Afternoons & Evenings",
            "recommendation": "Execute 5 minutes of Nadi Shodhana Pranayama to balance sympathetic stress response.",
        },
        {
            "id": "trig-cognitive",
            "name": f"Digital Stimulus on {primary_dev}",
            "category": "Cognitive",
            "frequency": max(total_urges_count, 1),
            "riskScore": min(85, max(40, risk_score - 12)),
            "color": "#EC4899",
            "peakTime": peak_risk_window,
            "recommendation": f"Establish a physical quarantine boundary for your {primary_dev} during {current_phase_info['time_window']}.",
        },
    ])

    return {
        "peak_risk_window": peak_risk_window,
        "next_predicted_window": next_predicted_window,
        "next_predicted_context": next_predicted_context,
        "today_weekday": today_weekday_name,
        "today_status_label": current_phase_info["status_label"],
        "primary_vulnerability": primary_vulnerability,
        "tactical_defense": tactical_defense,
        "future_trigger_forecast": future_trigger_forecast,
        "forecast_timeline_24h": forecast_timeline_24h,
        "current_phase": current_phase_info,
        "vitality_boost_quote": (
            "Energy is never destroyed; it is only transmuted. When you hold your ground, "
            "raw sexual energy transforms into pure intellectual sovereignty (Ojas)."
        ),
        "purpose_alignment_quote": (
            getattr(onboarding, "personal_statement", None)
            or getattr(onboarding, "primary_outcome", None)
            or "You are mastering the ancient science of Brahmacharya. Your focus is sovereign."
        ),
        "risk_level": risk_level,
        "risk_score": risk_score,
        "active_triggers": active_catalysts,
        "first_sign_action": step1_action,
        "environmental_rule": environmental_rule,
        "highest_risk_day": peak_day,
        "effectiveness_rate": effectiveness_rate,
        "total_urges_defeated": len(effective_sessions),
        "today_urges_count": today_urges_count,
        "triggers": triggers_breakdown,
    }
