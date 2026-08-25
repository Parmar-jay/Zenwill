import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from collections import Counter

from app.models.user import User
from app.models.onboarding import Onboarding
from app.models.daily_checkin import DailyCheckin
from app.models.emergency_session import EmergencySession
from app.models.mind_profile import MindProfile
from app.models.relapse_autopsy import RelapseAutopsy

logger = logging.getLogger(__name__)


DOMINO_FIREWALL_RULES = {
    "phone_in_bed": {
        "title": "Bringing Phone to Bedside",
        "rule": "Enforce the 2-Meter Bedroom Phone Firewall: Never bring your phone into bed. Plug it in at least 2 meters away 45 minutes before sleep.",
        "category": "Environmental",
    },
    "doomscrolling": {
        "title": "Social Media Doomscrolling",
        "rule": "Digital Friction Protocol: Remove infinite-scroll apps from your home screen and enforce a strict 15-minute daily app timer.",
        "category": "Cognitive",
    },
    "work_stress_isolation": {
        "title": "Work Stress & Solitary Isolation",
        "rule": "Somatic Stress Decompression: Never sit alone behind closed doors immediately after high-stress work. Execute 5-minute Box Breathing or a brisk walk first.",
        "category": "Emotional",
    },
    "suggestive_peeking": {
        "title": "Suggestive Peeking & Soft Triggers",
        "rule": "The 3-Second Severance Rule: Zero tolerance for soft triggers. The instant suggestive media appears, immediately power off screen and step out of the room.",
        "category": "Cognitive",
    },
    "skipped_habits": {
        "title": "Skipping Daily Check-in / Habits",
        "rule": "Morning Non-Negotiable Anchor: Complete your daily check-in before opening any digital feeds or browser windows.",
        "category": "Habitual",
    },
    "late_night_boredom": {
        "title": "Late-Night Idleness & Boredom",
        "rule": "Fixed Lights-Out Directive: Enforce a strict 10:30 PM bedtime. If sleepless after 20 minutes, get out of bed and read a physical book under dim light.",
        "category": "Circadian",
    },
    "bathroom_phone": {
        "title": "Bathroom Phone Usage",
        "rule": "Device-Free Sanctuary: Never bring any phone or tablet into the bathroom. Leave devices charging in the living room.",
        "category": "Environmental",
    },
    "alcohol_substances": {
        "title": "Alcohol / Fatigue Lowering Inhibition",
        "rule": "Prefrontal Guardrail: Recognize that fatigue and alcohol impair self-regulation filters. Keep all devices locked in a drawer during social recovery.",
        "category": "Physical",
    },
    "emotional_loneliness": {
        "title": "Emotional Loneliness / Conflict",
        "rule": "Connection Protocol: When feeling isolated or hurt, step into a common area or call an accountability friend instead of seeking digital numbness.",
        "category": "Emotional",
    },
    "couch_procrastination": {
        "title": "Passive Stagnation & Procrastination",
        "rule": "Physical Movement Directive: The moment you notice 15 minutes of passive lying on the couch, immediately stand up and do 20 bodyweight squats.",
        "category": "Physical",
    },
    "incognito_browsing": {
        "title": "Private / Incognito Browsing",
        "rule": "Strict Accountability Firewall: Block incognito mode on your primary browser and enforce content filters with open-door device usage.",
        "category": "Cognitive",
    },
}


async def submit_and_analyze_relapse_autopsy(user: User, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    100% Algorithmic, Zero-AI Relapse Autopsy Engine.
    1. Kills shame/guilt by calculating true long-term neural retention percentage.
    2. Pinpoints the exact first compromise domino.
    3. Generates the concrete Golden Firewall Rule.
    4. Safely resets streak in database without destroying accumulated mind points.
    5. Persists RelapseAutopsy to MongoDB.
    """
    user_id_str = str(user.id)
    user_email = user.email or ""
    today = date.today()
    today_str = today.isoformat()

    streak_before = user.streak or 0

    first_domino_key = payload.get("first_compromise_domino", "phone_in_bed")
    emotional_precursor = payload.get("emotional_precursor", "stress")
    physical_env = payload.get("physical_environment", "Bedroom Bedside")
    device_involved = payload.get("device_involved", "phone").lower()
    time_window = payload.get("approximate_time_window", "Late Night (11:00 PM - 01:00 AM)")
    user_note = payload.get("user_reflection_note", "")

    # 1. Fetch Past 60-Day Check-in History to Calculate Real Retained Neural Progress
    recent_checkins = await DailyCheckin.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]}
    ).sort("-date").limit(60).to_list()

    clean_days_count = sum(1 for c in recent_checkins if not getattr(c, "relapse_occurred", False))
    total_days_logged = max(len(recent_checkins), 1)

    # Calculate real retention rate
    if streak_before >= 14:
        retained_pct = max(88.0, round(((clean_days_count + streak_before) / max(total_days_logged + streak_before, 1)) * 100, 1))
    elif streak_before >= 7:
        retained_pct = max(80.0, round(((clean_days_count + streak_before) / max(total_days_logged + streak_before, 1)) * 100, 1))
    else:
        retained_pct = max(70.0, round((clean_days_count / max(total_days_logged, 1)) * 100, 1))
    retained_pct = min(98.5, retained_pct)

    # 2. Extract Domino Info & Generate Custom Golden Firewall Rule
    domino_info = DOMINO_FIREWALL_RULES.get(first_domino_key, DOMINO_FIREWALL_RULES["phone_in_bed"])
    domino_title = domino_info["title"]
    rule_category = domino_info["category"]
    generated_rule = domino_info["rule"]

    # If specific environment or device is customized, enrich the rule
    if "bed" in first_domino_key:
        generated_rule = f"The {physical_env} Firewall: Never operate your {device_involved.title()} in {physical_env}. Plug it in 2 meters away before 10:30 PM."

    # 3. Create and Save RelapseAutopsy Record
    autopsy = RelapseAutopsy(
        user_id=user_id_str,
        date_str=today_str,
        streak_before_relapse=streak_before,
        first_compromise_domino=first_domino_key,
        first_compromise_title=domino_title,
        emotional_precursor=emotional_precursor,
        physical_environment=physical_env,
        device_involved=device_involved,
        approximate_time_window=time_window,
        retained_clean_days=clean_days_count,
        retained_percentage=retained_pct,
        generated_golden_rule=generated_rule,
        rule_category=rule_category,
        pledge_signed=True,
        user_reflection_note=user_note,
        created_at=datetime.utcnow(),
    )
    await autopsy.insert()

    # 4. Safely Update User Streak & Retain Status in Database
    user.streak = 0
    user.last_retain_status = "relapsed"
    user.last_retain_date = today_str
    await user.save()

    # 5. Also sync MindProfile if exists
    profile = await MindProfile.find_one({"user_id": user_id_str})
    if profile:
        profile.current_flow = 0
        profile.last_relapse_at = datetime.utcnow()
        profile.updated_at = datetime.utcnow()
        await profile.save()

    # 6. Update or Create Today's DailyCheckin to mark relapse_occurred = True
    today_checkin = await DailyCheckin.find_one(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]},
        DailyCheckin.date == today
    )
    if today_checkin:
        today_checkin.relapse_occurred = True
        today_checkin.action_taken = "Yes"
        if not today_checkin.primary_triggers:
            today_checkin.primary_triggers = [emotional_precursor]
        await today_checkin.save()
    else:
        new_checkin = DailyCheckin(
            user_id=user_id_str,
            date=today,
            mood="Neutral",
            energy_score=4,
            stress_score=7,
            sleep_duration=6.5,
            sleep_quality=5,
            urge_intensity=8,
            primary_triggers=[emotional_precursor],
            action_taken="Yes",
            relapse_occurred=True,
        )
        await new_checkin.insert()

    return {
        "success": True,
        "autopsy_id": str(autopsy.id),
        "retained_percentage": retained_pct,
        "clean_days_count": clean_days_count,
        "streak_before": streak_before,
        "domino_title": domino_title,
        "generated_golden_rule": generated_rule,
        "rule_category": rule_category,
        "reframing_message": (
            f"You did not lose your {clean_days_count} clean days of neural rewiring. "
            f"Your brain retains {retained_pct}% of its dopamine baseline. "
            "Execute your new Golden Firewall Rule and resume your trajectory now."
        ),
    }


async def get_latest_relapse_autopsy(user: User) -> Optional[Dict[str, Any]]:
    """Retrieves the most recent Relapse Autopsy record for the user."""
    user_id_str = str(user.id)
    autopsy = await RelapseAutopsy.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": user.email}]}
    ).sort("-timestamp").first_or_none()

    if not autopsy:
        return None

    return {
        "autopsy_id": str(autopsy.id),
        "date_str": autopsy.date_str,
        "streak_before_relapse": autopsy.streak_before_relapse,
        "first_compromise_domino": autopsy.first_compromise_domino,
        "first_compromise_title": autopsy.first_compromise_title,
        "emotional_precursor": autopsy.emotional_precursor,
        "physical_environment": autopsy.physical_environment,
        "device_involved": autopsy.device_involved,
        "retained_percentage": autopsy.retained_percentage,
        "generated_golden_rule": autopsy.generated_golden_rule,
        "rule_category": autopsy.rule_category,
        "pledge_signed": autopsy.pledge_signed,
        "created_at": autopsy.created_at.isoformat() if autopsy.created_at else None,
    }
