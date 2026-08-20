"""
AI Service — wraps OpenAI GPT-4o with smart fallbacks.
If OPENAI_API_KEY is not set, returns high-quality templated responses
so the app is fully functional without a paid API key.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.config import settings


# ── Templated fallback responses ─────────────────────────────────────────────
COACH_TEMPLATES = [
    "I hear you. Every moment you choose awareness over impulse, you're literally reshaping your neural pathways. What you're doing right now — reaching out instead of giving in — that IS the work. How are you feeling in this moment?",
    "Your mind is trainable. Just like a muscle responds to resistance, your prefrontal cortex strengthens every time you pause and choose intentionally. What's one small action you can take in the next 5 minutes that aligns with who you're becoming?",
    "Recovery isn't a straight line — it's a spiral. You come back to the same challenges, but each time you have more tools, more self-awareness, more resilience. What have you learned about yourself recently?",
    "The urge you're experiencing is information, not a command. Your brain is signaling a need — for connection, rest, stimulation, comfort. What is the real need underneath this moment?",
    "You are not your impulses. You are the awareness that observes them. That observer — that's the real you. What would that version of you choose right now?",
    "Think about why you started this journey. Not the surface reason — the deep one. The person you're becoming. Can you see that version of yourself clearly right now?",
    "Strong people don't lack temptation — they've developed the skill to respond to it consciously. Every time you practice this, you're building a superpower most people never develop.",
]

INSIGHT_TEMPLATES = [
    "Your check-in data shows a pattern: when your sleep drops below 6 hours, your stress spikes the next day. Prioritizing sleep is your highest-leverage recovery tool right now.",
    "You've successfully resisted urges {count} times this week. Each resistance makes the next one easier. Your neural pathways are changing.",
    "Your strongest days correlate with morning exercise. Even 15 minutes has a measurable impact on your afternoon focus and emotional stability.",
    "The data shows your highest-risk time is late evening. Building a structured wind-down routine could dramatically reduce your vulnerability during this window.",
]

EMERGENCY_TEMPLATES = [
    {
        "plan": "I'm here with you right now. This urge is intense, but it's temporary — it will peak and pass within 20 minutes if you give it space. Let's work through this together using a proven sequence:\n\n**Step 1 (2 min)**: Take 4 deep breaths. Inhale for 4 counts, hold for 4, exhale for 6. This activates your parasympathetic system.\n\n**Step 2 (3 min)**: Name 5 things you can see, 4 you can touch, 3 you can hear. Ground yourself in the present moment.\n\n**Step 3**: Move your body. Stand up, walk to another room, do 10 pushups. Physical movement disrupts the craving cycle neurologically.\n\n**Step 4**: Read your purpose statement. Remember who you're becoming.\n\nYou've handled this before. You can handle it now.",
        "techniques": [
            {"id": "breathing_4_4_6", "name": "4-4-6 Breathing", "duration_seconds": 120, "description": "Inhale 4, hold 4, exhale 6 — activates calm"},
            {"id": "grounding_54321", "name": "5-4-3-2-1 Grounding", "duration_seconds": 180, "description": "Sensory anchoring technique"},
            {"id": "physical_movement", "name": "Physical Movement", "duration_seconds": 300, "description": "Change your physiology, change your state"},
            {"id": "cold_water", "name": "Cold Water Reset", "duration_seconds": 60, "description": "Splash cold water on your face to trigger calm reflex"},
            {"id": "purpose_reminder", "name": "Purpose Reminder", "duration_seconds": 120, "description": "Read your purpose statement aloud"},
        ]
    }
]

MISSION_LIBRARY = [
    # Sleep category
    {"title": "Sleep Optimization Protocol", "category": "sleep", "difficulty": "easy", "duration_minutes": 5, "description": "Set a consistent sleep alarm for the next 7 days. Consistent wake times are the #1 regulator of your circadian rhythm.", "xp_reward": 15, "mind_strength_reward": 3},
    {"title": "No Screens 1 Hour Before Bed", "category": "sleep", "difficulty": "medium", "duration_minutes": 60, "description": "Blue light suppresses melatonin. Tonight, put your phone away 1 hour before your target sleep time.", "xp_reward": 20, "mind_strength_reward": 4},
    # Focus category
    {"title": "25-Minute Deep Work Session", "category": "focus", "difficulty": "medium", "duration_minutes": 25, "description": "Complete one full Pomodoro of focused work without checking your phone. No notifications. Total presence.", "xp_reward": 20, "mind_strength_reward": 4},
    {"title": "Digital Detox Hour", "category": "focus", "difficulty": "hard", "duration_minutes": 60, "description": "One full hour with no social media, no YouTube, no random browsing. Use this time intentionally.", "xp_reward": 30, "mind_strength_reward": 6},
    # Calm category
    {"title": "5-Minute Breathing Practice", "category": "calm", "difficulty": "easy", "duration_minutes": 5, "description": "Box breathing: inhale 4 counts, hold 4, exhale 4, hold 4. Repeat for 5 minutes. This trains your nervous system.", "xp_reward": 15, "mind_strength_reward": 3},
    {"title": "10-Minute Meditation", "category": "calm", "difficulty": "medium", "duration_minutes": 10, "description": "Sit comfortably, close your eyes, and observe your breath without controlling it. When you wander, return. That's the practice.", "xp_reward": 20, "mind_strength_reward": 4},
    # Exercise category
    {"title": "20-Minute Walk", "category": "exercise", "difficulty": "easy", "duration_minutes": 20, "description": "A brisk 20-minute walk elevates BDNF (brain growth factor) and reduces cortisol. Your brain will thank you.", "xp_reward": 15, "mind_strength_reward": 3},
    {"title": "Full Body Workout", "category": "exercise", "difficulty": "hard", "duration_minutes": 45, "description": "Complete a 45-minute workout. Physical discipline directly trains mental discipline.", "xp_reward": 40, "mind_strength_reward": 8},
    # Purpose category
    {"title": "Read Your Purpose Statement", "category": "purpose", "difficulty": "easy", "duration_minutes": 3, "description": "Open your Purpose page and read your statement aloud. Remind yourself who you are becoming and why.", "xp_reward": 10, "mind_strength_reward": 2},
    {"title": "Write a Future Letter", "category": "purpose", "difficulty": "medium", "duration_minutes": 15, "description": "Write a letter to your future self 1 year from now. What will you have accomplished? Who will you be?", "xp_reward": 25, "mind_strength_reward": 5},
    # Connection category
    {"title": "Reach Out to Someone", "category": "connection", "difficulty": "medium", "duration_minutes": 10, "description": "Send a genuine message to a friend or family member. Human connection is one of the strongest buffers against urges.", "xp_reward": 20, "mind_strength_reward": 4},
    {"title": "Journal Entry", "category": "connection", "difficulty": "easy", "duration_minutes": 10, "description": "Write in your journal about what challenged you today and what you're grateful for. Self-reflection builds self-awareness.", "xp_reward": 15, "mind_strength_reward": 3},
]


class AIService:
    def __init__(self):
        self.client = None
        self._initialized = False

    def _init_openai(self):
        if not self._initialized and settings.OPENAI_API_KEY:
            try:
                from openai import AsyncOpenAI
                self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
                self._initialized = True
            except Exception:
                self.client = None
        self._initialized = True

    async def generate_coach_reply(
        self,
        user_message: str,
        history: List[Dict[str, str]],
        mind_profile_summary: Dict[str, Any],
        user_name: str = "there",
    ) -> str:
        self._init_openai()
        if self.client:
            try:
                system_prompt = self._build_coach_system_prompt(mind_profile_summary, user_name)
                messages = [{"role": "system", "content": system_prompt}]
                # Include last 10 messages for context
                for msg in history[-10:]:
                    messages.append({"role": msg["role"], "content": msg["content"]})
                messages.append({"role": "user", "content": user_message})

                response = await self.client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=messages,
                    max_tokens=400,
                    temperature=0.85,
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                print(f"OpenAI error: {e}")

        # Fallback
        import random
        return random.choice(COACH_TEMPLATES)

    def _build_coach_system_prompt(self, profile: Dict[str, Any], name: str) -> str:
        flow = profile.get("current_flow", 0)
        strength = profile.get("mind_strength", 50)
        risk = profile.get("risk_score_today", 30)
        triggers = ", ".join(profile.get("top_triggers", []) or ["general stress"])
        strategies = ", ".join(profile.get("top_coping_strategies", []) or ["breathing"])

        return f"""You are the AI Coach inside ZenWill — a Mental Operating System designed to help people build genuine mental mastery over their impulses, emotions, and decisions.

You are speaking with {name}. Here is their current profile:
- Mind Strength: {strength}/100
- Current Flow (streak): {flow} days  
- Today's Risk Score: {risk}/100 (higher = more vulnerable)
- Known triggers: {triggers}
- Effective coping strategies: {strategies}

Your coaching philosophy:
1. You are NOT a porn blocker or shame-based app. You help people build mental strength.
2. Never give generic motivational speeches. Be specific, personal, and psychologically precise.
3. Reference their data when relevant ("your streak of {flow} days shows real progress")
4. If risk score is high (>60), gently guide toward immediate calming techniques.
5. Always reinforce identity: "You're becoming someone who masters their attention."
6. Keep responses concise (150-250 words). Be warm, direct, intelligent.
7. Occasionally ask one powerful reflective question to deepen self-awareness.
8. Never shame or punish. Every moment is an opportunity to choose consciously.

Speak like a mentor who genuinely knows and cares about this person's growth."""

    async def generate_emergency_intervention(
        self,
        urge_intensity: int,
        trigger_type: Optional[str],
        emotional_state: Optional[str],
        profile: Dict[str, Any],
        user_name: str = "there",
    ) -> tuple[str, List[Dict]]:
        self._init_openai()
        
        template = EMERGENCY_TEMPLATES[0]
        techniques = template["techniques"]

        if self.client:
            try:
                prompt = f"""Generate a personalized emergency intervention plan for {user_name}.
Urge intensity: {urge_intensity}/10
Trigger type: {trigger_type or 'unknown'}
Emotional state: {emotional_state or 'unknown'}
Their successful strategies historically: {', '.join(profile.get('top_coping_strategies', []) or ['breathing'])}

Write a calm, grounding, personalized intervention plan (3-4 paragraphs). 
Start by acknowledging the moment, then guide through 3-4 specific steps.
Be direct but compassionate. This person needs immediate, actionable support."""

                response = await self.client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=400,
                    temperature=0.7,
                )
                plan = response.choices[0].message.content.strip()
                return plan, techniques
            except Exception as e:
                print(f"OpenAI emergency error: {e}")

        return template["plan"], techniques

    async def generate_weekly_insights(
        self,
        profile: Dict[str, Any],
        week_stats: Dict[str, Any],
        user_name: str = "there",
    ) -> tuple[str, List[str], List[str]]:
        self._init_openai()
        
        if self.client:
            try:
                prompt = f"""Generate weekly AI insights for {user_name} using their ZenWill data:

Week Stats:
- Mind Strength change: {week_stats.get('mind_strength_change', 0):+d} points
- Check-ins completed: {week_stats.get('total_checkins', 0)}/7
- Missions completed: {week_stats.get('missions_completed', 0)}/{week_stats.get('total_missions', 0)}
- Avg sleep: {week_stats.get('avg_sleep_hours', 0):.1f}h
- Avg stress: {week_stats.get('avg_stress', 5):.1f}/10
- Urge-free days: {week_stats.get('urge_free_days', 0)}
- Relapses: {week_stats.get('relapse_count', 0)}
- Top trigger: {week_stats.get('top_trigger', 'unknown')}

Provide:
1. A 2-3 paragraph behavioral analysis that identifies meaningful patterns
2. 3 specific predictions for the coming week (as a JSON array of strings)
3. 3 personalized recommendations (as a JSON array of strings)

Format as JSON: {{"summary": "...", "predictions": [...], "recommendations": [...]}}"""

                response = await self.client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=600,
                    temperature=0.7,
                    response_format={"type": "json_object"},
                )
                import json
                data = json.loads(response.choices[0].message.content)
                return (
                    data.get("summary", ""),
                    data.get("predictions", []),
                    data.get("recommendations", [])
                )
            except Exception as e:
                print(f"OpenAI weekly insights error: {e}")

        # Fallback
        import random
        summary = random.choice(INSIGHT_TEMPLATES).format(count=week_stats.get("urge_free_days", 0))
        return summary, [
            "Your highest risk window is late evening — plan proactively",
            "Sleep quality will be your key leverage point this week",
            "Completing 3+ missions will accelerate Mind Strength growth"
        ], [
            "Set a phone-free zone in your bedroom",
            "Schedule your workouts in your calendar as non-negotiable",
            "Write one journal entry before bed each night"
        ]

    async def analyze_journal_entry(self, content: str, user_name: str = "there") -> tuple[List[str], str]:
        """Extract themes and generate AI reflection for a journal entry."""
        self._init_openai()
        
        if self.client:
            try:
                prompt = f"""Analyze this journal entry from {user_name} and provide:
1. A list of 3-5 emotional/behavioral themes (as short phrases)
2. A thoughtful, empathetic AI reflection (2-3 sentences that help them gain insight)

Entry: {content[:1000]}

Return JSON: {{"themes": [...], "insight": "..."}}"""

                response = await self.client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=300,
                    temperature=0.7,
                    response_format={"type": "json_object"},
                )
                import json
                data = json.loads(response.choices[0].message.content)
                return data.get("themes", []), data.get("insight", "")
            except Exception as e:
                print(f"OpenAI journal error: {e}")

        return ["self-reflection", "growth mindset"], "Your honesty in this entry shows real self-awareness. The patterns you're noticing are the first step toward changing them."

    async def generate_daily_checkin_summary(
        self,
        checkin_data: Dict[str, Any],
        profile_summary: Dict[str, Any],
        top_mission_title: str = "10-Minute Mindful Reset"
    ) -> Dict[str, Any]:
        """
        Generate dynamic daily check-in summary containing:
        - Emotional condition, energy level, stress level, sleep quality, urge intensity, focus score
        - Dynamic Recovery Score (0-100)
        - Dynamic Estimated Relapse Risk (% and Category)
        - Key Behavioral Insight
        - Personalized Recommendation
        - Single Most Important Mission
        """
        mood = checkin_data.get("mood", "Neutral")
        mood_intensity = checkin_data.get("mood_intensity", 5)
        energy_score = checkin_data.get("energy_score", 5)
        energy_category = checkin_data.get("energy_category", "Normal")
        stress_score = checkin_data.get("stress_score", 3)
        sleep_quality = checkin_data.get("sleep_quality", 7)
        sleep_duration = checkin_data.get("sleep_duration", 7.0)
        rested_status = checkin_data.get("rested_status", "Yes")
        urge_intensity = checkin_data.get("urge_intensity", 0)
        action_taken = checkin_data.get("action_taken", "No")
        relapse_occurred = checkin_data.get("relapse_occurred", False)
        focus_score = checkin_data.get("focus_score", 5)
        primary_triggers = checkin_data.get("primary_triggers", [])

        # Dynamic Recovery Score Calculation (0-100)
        recovery_score = int(
            (sleep_quality * 2.0) +
            (energy_score * 1.5) +
            (focus_score * 1.5) +
            (max(0, 10 - stress_score) * 2.0) +
            (max(0, 10 - urge_intensity) * 3.0)
        )
        if relapse_occurred:
            recovery_score = max(10, recovery_score - 35)
        recovery_score = max(10, min(100, recovery_score))

        # Dynamic Relapse Risk Calculation (0-100%)
        risk_pct = (stress_score * 3) + (urge_intensity * 5) + (10 - sleep_quality) * 2
        if checkin_data.get("energy_score", 5) <= 3:
            risk_pct += 15
        if relapse_occurred:
            risk_pct = max(85, risk_pct)
        elif action_taken == "Almost":
            risk_pct += 25
        risk_pct = max(5, min(95, risk_pct))

        if risk_pct > 70:
            risk_category = "High"
        elif risk_pct > 40:
            risk_category = "Moderate"
        else:
            risk_category = "Low"

        # Insight and recommendation generation
        if relapse_occurred:
            insight = "Relapse is a data point, not a destination. Identify the trigger window and reset with self-compassion."
            recommendation = "Engage immediately in a 5-minute breathing reset, drink cold water, and review your purpose statement."
        elif urge_intensity > 5:
            triggers_str = ", ".join(primary_triggers) if primary_triggers else "heightened sensitivity"
            insight = f"High urge intensity detected driven by {triggers_str}. Your nervous system needs physical grounding."
            recommendation = "Step away from screens right now. Perform 10 pushups or take a brisk walk to disrupt craving loops."
        elif sleep_duration < 6 or sleep_quality < 5:
            insight = "Sleep deficit is straining your willpower battery today. Your impulse threshold is lower than usual."
            recommendation = "Schedule an early wind-down routine tonight. Avoid high-dopamine activities after 9 PM."
        else:
            insight = "High baseline emotional stability and disciplined focus detected. Your neural momentum is strengthening."
            recommendation = "Capitalize on today's high energy by completing your primary focus mission early."

        return {
            "emotional_condition": f"{mood} (Intensity: {mood_intensity}/10)",
            "energy_level": f"{energy_category} ({energy_score}/10)",
            "stress_level": f"{stress_score}/10",
            "sleep_quality": f"{sleep_quality}/10 ({sleep_duration} hrs, {rested_status})",
            "urge_intensity": f"{urge_intensity}/10 ({action_taken})",
            "focus_score": f"{focus_score}/10",
            "overall_recovery_score": recovery_score,
            "estimated_relapse_risk": f"{risk_pct}% ({risk_category})",
            "relapse_risk_category": risk_category,
            "relapse_risk_percentage": risk_pct,
            "key_behavioral_insight": insight,
            "personalized_recommendation": recommendation,
            "top_mission": top_mission_title,
        }


ai_service = AIService()

