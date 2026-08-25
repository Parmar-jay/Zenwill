import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional

from app.models.user import User
from app.models.onboarding import Onboarding
from app.models.daily_checkin import DailyCheckin
from app.models.emergency_session import EmergencySession
from app.models.journal import JournalEntry
from app.models.mind_profile import MindProfile
from app.models.mission import Mission
from app.models.behavioral_event import BehavioralEvent
from app.models.recommendation_task import RecommendationTaskCompletion

logger = logging.getLogger(__name__)


# ── Yogic Meditation Knowledge Matrix ───────────────────────────────────────

MEDITATION_TECHNIQUES = {
    "nadi-shodhana": {
        "technique_id": "nadi-shodhana",
        "title": "Nadi Shodhana",
        "subtitle": "Alternate nostril breathing to balance sympathetic tone & acute stress.",
        "duration_text": "7 min",
        "difficulty": "Beginner",
        "image_key": "nadi_shodhana",
        "color": "#3B82F6",
        "target_states": ["stress", "anxiety", "anger", "overwhelm", "cortisol_spike"],
    },
    "bhramari": {
        "technique_id": "bhramari",
        "title": "Bhramari Pranayama",
        "subtitle": "Humming resonance to silence racing thoughts, overthinking & insomnia.",
        "duration_text": "5 min",
        "difficulty": "Beginner",
        "image_key": "bhramari",
        "color": "#8B5CF6",
        "target_states": ["racing_mind", "overthinking", "insomnia", "mental_fatigue"],
    },
    "dirgha-pranayama": {
        "technique_id": "dirgha-pranayama",
        "title": "Dirgha Pranayama",
        "subtitle": "3-part deep diaphragmatic breath to ground cravings & pelvic urge waves.",
        "duration_text": "5 min",
        "difficulty": "Very Easy",
        "image_key": "dirgha_pranayama",
        "color": "#10B981",
        "target_states": ["craving", "urge_active", "impulsive", "panic", "restless"],
    },
    "ajapa-japa": {
        "technique_id": "ajapa-japa",
        "title": "Ajapa Japa",
        "subtitle": "Breath & sacred mantra awareness for emotional peace & deep focus.",
        "duration_text": "10 min",
        "difficulty": "Intermediate",
        "image_key": "ajapa_japa",
        "color": "#F59E0B",
        "target_states": ["loneliness", "sadness", "boredom", "spiritual_grounding"],
    },
    "krishna-meditation": {
        "technique_id": "krishna-meditation",
        "title": "Krishna Dhyana",
        "subtitle": "Gita observer consciousness to transmute vital energy (Virya) into Ojas.",
        "duration_text": "12 min",
        "difficulty": "Advanced",
        "image_key": "krishna_meditation",
        "color": "#00E5FF",
        "target_states": ["high_streak", "deep_focus", "purpose_alignment", "vitality"],
    },
}


def get_current_time_window(hour: int) -> Dict[str, str]:
    """Returns the time window configuration based on current hour."""
    if 5 <= hour < 12:
        return {
            "key": "morning",
            "title": "Morning Intent & Focus",
            "subtitle": "Awaken your prefrontal cortex, set daily boundaries, and lock in morning intent.",
            "icon": "sunny-outline",
            "theme_color": "#6366F1",
        }
    elif 12 <= hour < 18:
        return {
            "key": "afternoon",
            "title": "Midday Vitality & Energy Reset",
            "subtitle": "Clear mental fatigue, ground midday cravings, and execute your missions.",
            "icon": "flash-outline",
            "theme_color": "#10B981",
        }
    else:
        return {
            "key": "evening",
            "title": "Evening Reflection & Digital Quarantine",
            "subtitle": "Review today's victories, quiet intrusive thoughts, and secure restorative sleep.",
            "icon": "moon-outline",
            "theme_color": "#8B5CF6",
        }


async def compute_personalized_recommendations(user: User) -> Dict[str, Any]:
    """
    100% Deterministic, Multi-Variable Recommendation & Mind Training Assistant Engine.
    Fuses all real user database records across the entire app pipeline:
    1. Onboarding (triggers, first warning sign, device vulnerabilities, personal statement)
    2. Daily Check-in (checklist, stress, energy, sleep hours, mood, focus, urge intensity)
    3. Emergency Sessions (urges today & defeated, effective coping techniques)
    4. Behavioral Events (meditations completed today, missions executed)
    5. Journals (reflections written today)
    6. Recommendation Task Completions (saved in MongoDB)
    """
    user_id_str = str(user.id)
    user_email = user.email or ""

    # Accurate local time calculation (IST UTC+5:30)
    ist_now = datetime.utcnow() + timedelta(hours=5, minutes=30)
    current_hour = ist_now.hour
    today_str = ist_now.strftime("%Y-%m-%d")
    time_window = get_current_time_window(current_hour)

    now_utc = datetime.utcnow()
    today_start_dt = datetime(now_utc.year, now_utc.month, now_utc.day)
    today_end_dt = today_start_dt + timedelta(days=1)

    # 1. Fetch Onboarding Intake
    onboarding = await Onboarding.find_one(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]}
    )

    # 2. Fetch Check-ins (Today & Historical)
    recent_checkins = await DailyCheckin.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]}
    ).sort("-date").limit(14).to_list()

    today_checkin = next((c for c in recent_checkins if str(c.date) == today_str), None)
    latest_checkin = today_checkin or (recent_checkins[0] if recent_checkins else None)

    # 3. Fetch Emergency Sessions
    emergency_sessions = await EmergencySession.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]}
    ).sort("-started_at").limit(50).to_list()

    today_urges = [
        s for s in emergency_sessions
        if (s.started_at and s.started_at.strftime("%Y-%m-%d") == today_str)
        or (s.completed_at and s.completed_at.strftime("%Y-%m-%d") == today_str)
    ]
    today_urges_count = len(today_urges)

    # 4. Fetch Meditation & Behavioral Events Today
    med_events = await BehavioralEvent.find(
        {
            "$or": [{"user_id": user_id_str}, {"user_id": user_email}],
            "event_type": {"$in": ["meditation_session", "meditation_completed", "afternoon_meditation"]}
        }
    ).to_list()

    has_meditated_today = any(
        (e.created_at and e.created_at.strftime("%Y-%m-%d") == today_str) for e in med_events
    )

    # 5. Fetch Journals Today
    recent_journals = await JournalEntry.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]}
    ).sort("-created_at").limit(5).to_list()

    has_journaled_today = any(
        (j.created_at and j.created_at.strftime("%Y-%m-%d") == today_str) for j in recent_journals
    )

    # 6. Fetch Completed Daily Missions Today from MongoDB
    today_missions = await Mission.find(
        {"$or": [{"user_id": user_id_str}, {"user_id": user_email}]},
        Mission.date_assigned >= today_start_dt,
        Mission.date_assigned < today_end_dt,
    ).to_list()

    completed_mission_categories = {
        m.category.lower().strip() for m in today_missions if m.is_completed
    }
    has_any_completed_missions = len(completed_mission_categories) > 0
    has_all_missions_done = (
        len(today_missions) > 0 and all(m.is_completed for m in today_missions)
    ) or len(completed_mission_categories) >= 3

    # 7. Fetch Completed Recommendation Tasks for Today from MongoDB
    completed_task_records = await RecommendationTaskCompletion.find(
        {
            "$or": [{"user_id": user_id_str}, {"user_id": user_email}],
            "date_str": today_str
        }
    ).to_list()
    completed_task_ids = {t.task_id for t in completed_task_records}

    # ── User Signals ──────────────────────────────────────────────────────────
    user_name = user.name or (onboarding.first_name if onboarding else "Operative")
    streak_val = user.streak or 0
    mind_strength = user.mind_strength or 500

    core_purpose = (
        getattr(onboarding, "personal_statement", "")
        or getattr(onboarding, "primary_outcome", "")
        or "Reclaiming absolute mastery over mind and vital energy."
    )
    ob_triggers = [t.lower() for t in getattr(onboarding, "emotional_triggers", [])]
    ob_first_sign = (getattr(onboarding, "first_warning_sign", "craving") or "craving").lower()
    primary_dev = (getattr(onboarding, "primary_device", "phone") or "phone").title()

    stress_score = getattr(latest_checkin, "stress_score", 4) if latest_checkin else 4
    sleep_hours = getattr(latest_checkin, "sleep_duration", 7.0) if latest_checkin else 7.0
    sleep_quality = getattr(latest_checkin, "sleep_quality", 7) if latest_checkin else 7
    energy_score = getattr(latest_checkin, "energy_score", 5) if latest_checkin else 5
    focus_score = getattr(latest_checkin, "focus_score", 5) if latest_checkin else 5
    mood = getattr(latest_checkin, "mood", "Neutral") if latest_checkin else "Neutral"
    checkin_urge_intensity = getattr(latest_checkin, "urge_intensity", 0) if latest_checkin else 0

    # Dynamic cross-model task completion flags
    is_checkin_done = (
        bool(today_checkin)
        or ("rec_checkin" in completed_task_ids)
        or ("checkin" in completed_mission_categories)
        or ("morning" in completed_mission_categories)
    )
    is_med_done = (
        has_meditated_today
        or ("rec_meditation" in completed_task_ids)
        or ("meditation" in completed_mission_categories)
        or ("calm" in completed_mission_categories)
        or ("sleep" in completed_mission_categories)
    )
    is_journal_done = (
        has_journaled_today
        or ("rec_journal" in completed_task_ids)
        or ("journal" in completed_mission_categories)
        or ("focus" in completed_mission_categories)
        or ("reflection" in completed_mission_categories)
    )
    is_coach_done = (
        ("rec_coach" in completed_task_ids)
        or ("coach" in completed_mission_categories)
        or ("purpose" in completed_mission_categories)
    )
    is_rescue_done = (
        ("rec_rescue" in completed_task_ids)
        or (today_urges_count > 0)
        or ("rescue" in completed_mission_categories)
        or ("exercise" in completed_mission_categories)
        or ("emergency" in completed_mission_categories)
    )
    is_missions_done = (
        has_all_missions_done
        or has_any_completed_missions
        or ("rec_missions" in completed_task_ids)
    )
    is_purpose_done = (
        ("rec_purpose" in completed_task_ids)
        or ("purpose" in completed_mission_categories)
    )
    is_radar_done = (
        ("rec_trigger_intel" in completed_task_ids)
        or ("rec_device_firewall" in completed_task_ids)
        or is_checkin_done
    )
    is_firewall_done = (
        ("rec_device_firewall" in completed_task_ids)
        or ("rec_trigger_intel" in completed_task_ids)
    )

    # ── Recommended Meditation Practice Algorithm ────────────────────────────
    chosen_technique_key = "nadi-shodhana"
    reason_text = "Balances autonomic tone and calms baseline stress."

    if today_urges_count > 0 or checkin_urge_intensity >= 6 or ob_first_sign in ["craving", "physical", "touching"]:
        chosen_technique_key = "dirgha-pranayama"
        reason_text = "Calms active craving waves and diverts pelvic tension."
    elif stress_score >= 7 or "stress" in ob_triggers or mood in ["Anxious", "Overwhelmed"]:
        chosen_technique_key = "nadi-shodhana"
        reason_text = f"Counteracts high stress ({stress_score}/10) and restores parasympathetic balance."
    elif sleep_hours < 6.0 or sleep_quality <= 4 or current_hour >= 21 or "insomnia" in ob_triggers:
        chosen_technique_key = "bhramari"
        reason_text = "Quiets mental chatter and induces deep parasympathetic relaxation for sleep."
    elif mood in ["Sad", "Lonely"] or "loneliness" in ob_triggers or "boredom" in ob_triggers:
        chosen_technique_key = "ajapa-japa"
        reason_text = "Grounds emotional emptiness and builds deep internal focus."
    elif streak_val >= 14 or (energy_score >= 7 and focus_score >= 7):
        chosen_technique_key = "krishna-meditation"
        reason_text = "Transmutes accumulated vital energy (Virya) into pure intellectual focus (Ojas)."
    else:
        chosen_technique_key = "dirgha-pranayama"
        reason_text = "Deep relaxation and baseline mind strength conditioning."

    recommended_meditation = dict(MEDITATION_TECHNIQUES[chosen_technique_key])
    recommended_meditation["reason"] = reason_text

    # ── Timeline & Data-Driven Multi-Task Recommendations ─────────────────────
    recommended_actions: List[Dict[str, Any]] = []

    # --- 1. MORNING TIMELINE ACTIONS (05:00 - 11:59) ---
    if time_window["key"] == "morning":
        # Action 1: Daily Check-in
        recommended_actions.append({
            "id": "rec_checkin",
            "action_type": "checkin",
            "title": "Daily Accountability Check-in",
            "description": "Log your mood, energy, sleep hours, and set today's non-negotiable intent.",
            "route": "/daily-checkin",
            "time_window": "Morning",
            "xp_reward": 20,
            "color": "#6366F1",
            "icon": "create-outline",
            "is_completed": is_checkin_done,
        })

        # Action 2: Morning Sun & Breathwork
        recommended_actions.append({
            "id": "rec_meditation",
            "action_type": "meditation",
            "title": f"Morning {recommended_meditation['title']}",
            "description": f"{recommended_meditation['subtitle']} ({recommended_meditation['duration_text']}).",
            "route": "/meditation",
            "time_window": "Morning",
            "xp_reward": 25,
            "color": "#10B981",
            "icon": "flower-outline",
            "is_completed": is_med_done,
        })

        # Action 3: Daily Missions or Purpose Anchor
        if streak_val >= 7:
            recommended_actions.append({
                "id": "rec_purpose",
                "action_type": "purpose",
                "title": "Reaffirm Core Brahmacharya Purpose",
                "description": f"Anchor your {streak_val}d clean momentum: {core_purpose[:55]}...",
                "route": "/purpose",
                "time_window": "Morning",
                "xp_reward": 15,
                "color": "#00E5FF",
                "icon": "compass-outline",
                "is_completed": is_purpose_done,
            })
        else:
            recommended_actions.append({
                "id": "rec_missions",
                "action_type": "missions",
                "title": "Execute Morning Habit Missions",
                "description": "Engage dopamine in constructive physical & mental challenges today.",
                "route": "/missions",
                "time_window": "Morning",
                "xp_reward": 15,
                "color": "#F59E0B",
                "icon": "checkbox-outline",
                "is_completed": is_missions_done,
            })

    # --- 2. AFTERNOON TIMELINE ACTIONS (12:00 - 17:59) ---
    elif time_window["key"] == "afternoon":
        # Action 1: 3 PM Afternoon Mindfulness / Vitality Reset
        recommended_actions.append({
            "id": "rec_meditation",
            "action_type": "meditation",
            "title": "3 PM Vitality & Mind Reset",
            "description": "5 minutes of diaphragmatic grounding to discharge midday fatigue and stress.",
            "route": "/meditation",
            "time_window": "Afternoon",
            "xp_reward": 25,
            "color": "#10B981",
            "icon": "flower-outline",
            "is_completed": is_med_done,
        })

        # Action 2: Check-in if not yet done, or Trigger Radar
        if not is_checkin_done:
            recommended_actions.append({
                "id": "rec_checkin",
                "action_type": "checkin",
                "title": "Midday Check-in Catchup",
                "description": "Your morning checklist is still open. Log your current energy & stress state.",
                "route": "/daily-checkin",
                "time_window": "Afternoon",
                "xp_reward": 20,
                "color": "#6366F1",
                "icon": "create-outline",
                "is_completed": is_checkin_done,
            })
        else:
            recommended_actions.append({
                "id": "rec_trigger_intel",
                "action_type": "trigger_intel",
                "title": "Inspect Trigger Intelligence Radar",
                "description": "Review your predicted danger window and environmental guardrails.",
                "route": "/trigger-intelligence",
                "time_window": "Afternoon",
                "xp_reward": 15,
                "color": "#00E5FF",
                "icon": "shield-checkmark-outline",
                "is_completed": is_radar_done,
            })

        # Action 3: AI Mind Coach or Urge Surfing
        if today_urges_count > 0 or stress_score >= 7:
            recommended_actions.append({
                "id": "rec_rescue",
                "action_type": "rescue",
                "title": "Urge Surfing Transmutation",
                "description": "Neutralize craving intensity and redirect raw drive into physical energy.",
                "route": "/emergency/urge-surfing",
                "time_window": "Afternoon",
                "xp_reward": 20,
                "color": "#EF4444",
                "icon": "flash-outline",
                "is_completed": is_rescue_done,
            })
        else:
            recommended_actions.append({
                "id": "rec_coach",
                "action_type": "chat",
                "title": "Consult AI Mind Coach",
                "description": "Unpack any subtle urges, mental friction, or dopamine seeking.",
                "route": "/chat",
                "time_window": "Afternoon",
                "xp_reward": 15,
                "color": "#8B5CF6",
                "icon": "chatbubble-ellipses-outline",
                "is_completed": is_coach_done,
            })

    # --- 3. EVENING / NIGHT TIMELINE ACTIONS (18:00 - 04:59) ---
    else:
        # Action 1: Evening Reflection Journal
        recommended_actions.append({
            "id": "rec_journal",
            "action_type": "journal",
            "title": "Evening Victory & Reflection Journal",
            "description": "Document today's disciplined wins and clear mental clutter before bed.",
            "route": "/journal",
            "time_window": "Evening",
            "xp_reward": 20,
            "color": "#F59E0B",
            "icon": "book-outline",
            "is_completed": is_journal_done,
        })

        # Action 2: Pre-Sleep Breathwork
        recommended_actions.append({
            "id": "rec_meditation",
            "action_type": "meditation",
            "title": "Pre-Sleep Bhramari Pranayama",
            "description": "5 minutes of bee humming vibration to slow brainwaves and silence nocturnal cravings.",
            "route": "/meditation",
            "time_window": "Evening",
            "xp_reward": 25,
            "color": "#8B5CF6",
            "icon": "flower-outline",
            "is_completed": is_med_done,
        })

        # Action 3: Digital Quarantine / Device Distance
        recommended_actions.append({
            "id": "rec_device_firewall",
            "action_type": "trigger_intel",
            "title": f"Enforce {primary_dev} Bedroom Firewall",
            "description": f"Keep {primary_dev} charging at least 2 meters away from bed to eliminate late-night vulnerability.",
            "route": "/trigger-intelligence",
            "time_window": "Evening",
            "xp_reward": 15,
            "color": "#EF4444",
            "icon": "shield-outline",
            "is_completed": is_firewall_done,
        })

    # ── Calculate Progress Stats ──────────────────────────────────────────────
    total_tasks = len(recommended_actions)
    completed_tasks = sum(1 for a in recommended_actions if a.get("is_completed", False))
    completion_percentage = int((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0

    # ── Smart Primary Directive / AI Insight Card ─────────────────────────────
    # Pick the most critical uncompleted action or victory banner
    first_uncompleted = next((a for a in recommended_actions if not a.get("is_completed", False)), None)

    if not first_uncompleted:
        directive = {
            "category": "DISCIPLINE ACHIEVED",
            "headline": f"All {time_window['key'].capitalize()} Recommendations Completed",
            "subtitle": f"Peak neural self-regulation active. Operating on an unbroken {streak_val}-day trajectory" + (f" with {today_urges_count} urge waves defeated." if today_urges_count > 0 else "."),
            "action_text": "View Progress",
            "route": "/progress",
            "color": "#10B981",
            "icon": "checkmark-circle",
        }
    else:
        directive = {
            "category": f"{time_window['key'].upper()} PROTOCOL",
            "headline": first_uncompleted["title"],
            "subtitle": first_uncompleted["description"],
            "action_text": "Start Task",
            "route": first_uncompleted["route"],
            "color": first_uncompleted["color"],
            "icon": first_uncompleted["icon"],
        }

    return {
        "recommended_meditation": recommended_meditation,
        "ai_insight": directive,
        "time_window": time_window,
        "recommended_actions": recommended_actions,
        "progress_stats": {
            "completed_tasks": completed_tasks,
            "total_tasks": total_tasks,
            "completion_percentage": completion_percentage,
        },
        "streak_context": {
            "streak": streak_val,
            "mind_strength": mind_strength,
            "has_checked_in": bool(today_checkin),
            "has_meditated": has_meditated_today,
            "has_journaled": has_journaled_today,
        },
    }


async def complete_user_recommendation_task(
    user: User,
    task_id: str,
    action_type: str = "general",
    title: str = "Completed Recommendation Task"
) -> Dict[str, Any]:
    """
    Persists recommendation task completion to MongoDB and rewards user with Mind Strength points.
    """
    user_id_str = str(user.id)
    today_str = date.today().isoformat()
    current_hour = datetime.now().hour
    time_window_key = get_current_time_window(current_hour)["key"]

    existing = await RecommendationTaskCompletion.find_one({
        "user_id": user_id_str,
        "task_id": task_id,
        "date_str": today_str,
    })

    if existing:
        return {
            "success": True,
            "message": "Task already completed today.",
            "task_id": task_id,
            "points_earned": 0,
            "mind_strength": user.mind_strength or 500,
        }

    reward_xp = 15
    new_completion = RecommendationTaskCompletion(
        user_id=user_id_str,
        task_id=task_id,
        action_type=action_type,
        title=title,
        date_str=today_str,
        time_window=time_window_key,
        xp_reward=reward_xp,
        completed_at=datetime.utcnow(),
    )
    await new_completion.insert()

    # Update User Mind Strength
    new_strength = (user.mind_strength or 500) + reward_xp
    user.mind_strength = new_strength
    user.points = (user.points or 0) + reward_xp
    await user.save()

    # Also sync MindProfile if exists
    profile = await MindProfile.find_one({"user_id": user_id_str})
    if profile:
        profile.mind_strength = new_strength
        await profile.save()

    return {
        "success": True,
        "message": f"Great work! Earned +{reward_xp} Mind Strength XP.",
        "task_id": task_id,
        "points_earned": reward_xp,
        "mind_strength": new_strength,
    }
