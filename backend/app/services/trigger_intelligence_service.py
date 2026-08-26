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
    Prevents unrealistic assumptions (e.g. 'Living room at 1 PM on a weekday for an office worker').
    """
    occ_lower = (occupation or "").lower()
    sched_lower = (daily_schedule or "standard").lower()
    is_work_student = any(k in occ_lower for k in ["engineer", "developer", "student", "office", "manager", "accountant", "analyst", "designer", "doctor", "consultant"]) or sched_lower == "standard"

    # Prioritize actual logged environment from recent emergency urge sessions if present
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
        loc = "Bedroom Bedside" if "bedroom" in ob_locations else "Morning Awakening Space"
        return {
            "environment_label": f"Morning {loc}",
            "context_description": f"Waking up with {primary_device} in hand before getting out of bed",
            "environmental_rule": f"Morning Launch Rule: Never check {primary_device} while still in bed. Get on two feet, hydrate, and get sunlight first.",
        }

    # 2. Midday / Work / Study Window (09:00 - 17:59)
    elif 9 <= start_hour < 18:
        if is_work_student:
            return {
                "environment_label": "Workplace Desk / Study Break",
                "context_description": f"Midday mental fatigue or lunch break downtime with {primary_device}",
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
            "context_description": f"Late-night bedroom isolation with {primary_device} proximity before sleep",
            "environmental_rule": f"2-Meter Device Firewall: Never bring {primary_device} to bed. Charge it 2 meters away 45 minutes before sleep.",
        }


async def compute_deep_trigger_intelligence(user: User) -> Dict[str, Any]:
    """
    100% Algorithmic, Zero-AI Trigger Intelligence Engine.
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
    ).sort("-timestamp").first_or_none()

    # ── A. Base User Parameters ───────────────────────────────────────────────
    user_name = user.name or (onboarding.first_name if onboarding else "Operative")
    streak_val = user.streak or 0
    mind_strength = user.mind_strength or 500

    occupation = getattr(onboarding, "occupation", "") if onboarding else ""
    daily_schedule = getattr(onboarding, "daily_schedule", "standard") if onboarding else "standard"
    ob_triggers = [t.lower() for t in getattr(onboarding, "emotional_triggers", [])] if onboarding else []
    ob_first_sign = (getattr(onboarding, "first_warning_sign", "craving") or "craving").lower()
    ob_locations = [l.lower() for l in getattr(onboarding, "urge_locations", [])] if onboarding else []
    ob_device = (getattr(onboarding, "primary_device", "phone") or "phone").lower()
    ob_urge_times = getattr(onboarding, "urge_times", []) if onboarding else []
    primary_dev = ob_device.replace("_", " ").title()

    # ── B. Timestamp & Temporal Distribution Analysis ─────────────────────────
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
        else (95 if streak_val > 7 else 88)
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

    # ── C. Circadian Peak Window Computation ─────────────────────────────────
    if urge_hours:
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

    # ── D. Peak Risk Day & Real-Time Day-of-Week Computation ──────────────────
    now_utc = datetime.utcnow()
    current_hour = now_utc.hour
    today_weekday_name = now_utc.strftime("%A")

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

    # ── E. Realistic Spatial & Contextual Intelligence ───────────────────────
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

    # Calculate Next Predicted High-Risk Window relative to current time
    if current_hour < 12:
        if any(13 <= h <= 17 for h in urge_hours):
            next_predicted_window = "Today, 02:00 PM - 04:30 PM"
            next_predicted_context = "Midday Screen Fatigue"
        else:
            next_predicted_window = f"Tonight, {peak_risk_window}"
            next_predicted_context = f"Bedside Solitude in {environment_label}"
    elif 12 <= current_hour < 18:
        next_predicted_window = f"Tonight, {peak_risk_window}"
        next_predicted_context = f"Post-Work Decompression in {environment_label}"
    elif 18 <= current_hour < 23:
        next_predicted_window = f"Tonight, {peak_risk_window}"
        next_predicted_context = f"Nighttime Bedside with {primary_dev}"
    else:
        next_predicted_window = "Active Right Now (Late-Night Screen Solitude)"
        next_predicted_context = f"Active Bedside Hazard with {primary_dev}"

    # ── F. Check-in Multi-Day Telemetry Analysis ─────────────────────────────
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

    # ── G. Dynamic Multi-Variable Risk Score (0–100) ─────────────────────────
    if streak_val >= 90:
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

    total_risk = base_risk + stress_pts + sleep_pts + urge_velocity_pts + checkin_urge_pts + mood_pts
    risk_score = max(12, min(95, total_risk))

    if risk_score >= 75:
        risk_level = "CRITICAL VULNERABILITY"
    elif risk_score >= 50:
        risk_level = "ELEVATED VULNERABILITY"
    elif risk_score >= 30:
        risk_level = "MODERATE VIGILANCE"
    else:
        risk_level = "OPTIMAL SHIELD"

    # ── H. Active Catalysts List ──────────────────────────────────────────────
    active_catalysts: List[str] = []

    if current_stress >= 6:
        cause_suffix = f" ({checkin_stress_causes[0]})" if checkin_stress_causes else ""
        active_catalysts.append(f"Acute Stress ({current_stress}/10){cause_suffix}")

    if current_sleep_hours < 6.5 or current_sleep_quality <= 5:
        active_catalysts.append(f"Sleep Deficit ({current_sleep_hours:.1f}h)")

    if current_mood in ["Anxious", "Lonely", "Sad", "Overwhelmed", "Frustrated"]:
        active_catalysts.append(f"Emotional State ({current_mood})")

    active_catalysts.append(f"{primary_dev} in {environment_label}")

    first_sign_info = FIRST_SIGN_PROTOCOLS.get(ob_first_sign, FIRST_SIGN_PROTOCOLS["craving"])
    active_catalysts.append(f"Early Warning Cue: {first_sign_info['title']}")

    if session_reasons:
        top_reason = Counter(session_reasons).most_common(1)[0][0]
        if top_reason and top_reason not in active_catalysts:
            active_catalysts.append(top_reason)
    elif checkin_triggers:
        top_checkin_trig = Counter(checkin_triggers).most_common(1)[0][0].replace("_", " ").title()
        if top_checkin_trig not in active_catalysts:
            active_catalysts.append(top_checkin_trig)

    # ── I. Contextual Primary Vulnerability Synthesis ─────────────────────────
    if current_stress >= 7:
        primary_vulnerability = f"Elevated stress load ({current_stress}/10) lowering impulse control during {peak_risk_window} in {environment_label}."
    elif current_sleep_hours < 6.0:
        primary_vulnerability = f"Willpower deficit from sleep debt ({current_sleep_hours:.1f}h) during {peak_risk_window} hours."
    elif today_urges_count >= 1 or checkin_urge_intensity >= 6:
        primary_vulnerability = f"Active craving wave recorded today. High dopamine seeking predicted during {peak_risk_window} in {environment_label}."
    elif streak_val >= 7:
        primary_vulnerability = f"Clean streak momentum is high ({streak_val}d). Guard against overconfidence and idle screen time in {environment_label}."
    else:
        primary_vulnerability = f"Unstructured idle screen time on {primary_dev} during {peak_risk_window} in {environment_label}."

    if latest_autopsy and getattr(latest_autopsy, "generated_golden_rule", None):
        environmental_rule = latest_autopsy.generated_golden_rule
        active_catalysts.insert(0, f"Recent Trigger: {latest_autopsy.first_compromise_title}")

    # ── J. 3-Tier Tactical Defense Protocol ──────────────────────────────────
    step1_action = first_sign_info["action"]
    step2_device_rule = environmental_rule
    top_tech = helpful_techniques[0] if helpful_techniques else "Urge Surfing (3-Min)"
    step3_transmute = f"Engage {top_tech}: Transmute vital physical energy through deep breathing, a cold splash, or pushups."

    tactical_defense = f"1) {step1_action} 2) {step2_device_rule} 3) {step3_transmute}"

    # ── K. Future Trigger Forecast & Preemptive Shield ────────────────────────
    predicted_probability = min(92, max(28, risk_score + (10 if current_stress >= 6 else 0) + (10 if current_sleep_hours < 6.0 else 0)))

    if current_stress >= 7:
        forecast_root = f"High stress level ({current_stress}/10) depleting prefrontal willpower"
    elif current_sleep_hours < 6.0:
        forecast_root = f"Sleep deficit ({current_sleep_hours:.1f}h) impairing impulse control"
    elif today_urges_count >= 1 or checkin_urge_intensity >= 6:
        forecast_root = "Active craving velocity recorded today"
    else:
        forecast_root = f"Unstructured solitary screen time on {primary_dev} in {environment_label}"

    future_trigger_forecast = {
        "predicted_window": next_predicted_window,
        "predicted_context": next_predicted_context,
        "probability_pct": predicted_probability,
        "predicted_trigger_name": f"Late Evening / Bedside {primary_dev} Solitude" if current_hour >= 16 else f"Midday Screen Slump with {primary_dev}",
        "root_catalyst": forecast_root,
        "preemptive_action": f"Pre-commit before {peak_risk_window}: {environmental_rule}",
    }

    # ── L. 24-Hour Predictive Risk Horizon Timeline ───────────────────────────
    forecast_timeline_24h = [
        {
            "id": "slot-morning",
            "time_label": "06:00 AM - 12:00 PM",
            "period_name": "Morning Awakening",
            "risk_score": max(15, min(45, int(risk_score * 0.4))),
            "risk_level": "LOW",
            "key_hazard": f"Checking {primary_dev} in bed before getting up",
            "shield_protocol": "Hydrate with water and complete morning check-in before touching feeds.",
            "is_current": current_hour < 12,
        },
        {
            "id": "slot-midday",
            "time_label": "12:00 PM - 06:00 PM",
            "period_name": "Midday Focus & Energy",
            "risk_score": max(25, min(65, int(risk_score * 0.7))),
            "risk_level": "MODERATE",
            "key_hazard": f"Post-lunch mental slump and work stress grazing on {primary_dev}",
            "shield_protocol": "Take a 5-minute walking break away from screens and practice 3 PM breathwork.",
            "is_current": 12 <= current_hour < 18,
        },
        {
            "id": "slot-evening",
            "time_label": "06:00 PM - 10:00 PM",
            "period_name": "Evening Decompression",
            "risk_score": max(40, min(85, int(risk_score * 0.85))),
            "risk_level": "ELEVATED",
            "key_hazard": f"Unstructured solitary lounging in {environment_label}",
            "shield_protocol": "Keep ambient room lighting bright and engage dedicated physical/social tasks.",
            "is_current": 18 <= current_hour < 22,
        },
        {
            "id": "slot-night",
            "time_label": "10:00 PM - 02:00 AM",
            "period_name": "Peak Circadian Window",
            "risk_score": min(95, max(60, risk_score + 10)),
            "risk_level": "CRITICAL" if risk_score >= 60 else "ELEVATED",
            "key_hazard": f"Late-night private screen time in {environment_label}",
            "shield_protocol": environmental_rule,
            "is_current": current_hour >= 22 or current_hour < 6,
        },
    ]

    # ── M. Granular Triggers Breakdown Array (5 Categories) ───────────────────
    triggers_breakdown: List[Dict[str, Any]] = [
        {
            "id": "trig-circadian",
            "name": f"Circadian Window ({peak_risk_window})",
            "category": "Circadian",
            "frequency": max(total_urges_count, 1),
            "riskScore": min(95, risk_score + 6),
            "color": "#00E5FF",
            "peakTime": peak_risk_window,
            "recommendation": f"Pre-commit to screen cutoff: keep {primary_dev} away from bed 30 minutes before this window.",
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
            "peakTime": peak_risk_window,
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
            "name": "Digital Novelty Seeking",
            "category": "Cognitive",
            "frequency": max(total_urges_count, 1),
            "riskScore": min(85, max(40, risk_score - 12)),
            "color": "#EC4899",
            "peakTime": peak_risk_window,
            "recommendation": "Set strict daily app limits and remove infinite-scroll apps from your primary home screen.",
        },
    ]

    return {
        "peak_risk_window": peak_risk_window,
        "next_predicted_window": next_predicted_window,
        "next_predicted_context": next_predicted_context,
        "today_weekday": today_weekday_name,
        "today_status_label": f"TODAY ({today_weekday_name.upper()})",
        "primary_vulnerability": primary_vulnerability,
        "tactical_defense": tactical_defense,
        "future_trigger_forecast": future_trigger_forecast,
        "forecast_timeline_24h": forecast_timeline_24h,
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
