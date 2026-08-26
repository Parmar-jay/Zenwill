import logging
import json
import httpx
from typing import Dict, Any, List, Optional
from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

SYSTEM_PROMPT_EMPOWERMENT = (
    "You are ZenWill AI Coach, a master of mind control, discipline, and Vedic energy transmutation. "
    "Your foundational philosophy is SEXUAL ENERGY TRANSMUTATION (transforming raw urge fuel 'Virya' "
    "into mental clarity 'Ojas' and spiritual radiance 'Tejas' as taught in Katha Upanishad). "
    "You do not judge, suppress, or shame sexual energy or urges. Instead, you view them as raw fuel "
    "for greatness, drive, focus, and constructing an exceptional life. "
    "Always respond with empowering, practical, articulate, and deeply motivating guidance."
)

async def call_gemini_api(prompt: str, system_instruction: str = SYSTEM_PROMPT_EMPOWERMENT, model: Optional[str] = None) -> str:
    """Call Google Gemini API using fast and reliable production models with auto-fallback."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        logger.warning("No GEMINI_API_KEY set in config.")
        return ""

    candidate_models = [
        model or settings.GEMINI_MODEL or "gemini-2.5-flash",
        "gemini-2.5-flash",
        "gemini-flash-latest",
        "gemini-2.5-pro",
        "gemini-pro-latest",
    ]
    # Remove duplicates while preserving order
    models_to_try = list(dict.fromkeys(candidate_models))

    payload = {
        "system_instruction": {
            "parts": [{"text": system_instruction}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.5,
            "maxOutputTokens": 2048,
        }
    }

    async with httpx.AsyncClient(timeout=35.0) as client:
        for target_model in models_to_try:
            url = f"{GEMINI_BASE_URL}/{target_model}:generateContent?key={api_key}"
            try:
                response = await client.post(url, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            return parts[0].get("text", "").strip()
                elif response.status_code == 404:
                    logger.warning(f"Gemini model {target_model} returned 404, attempting next fallback...")
                    continue
                else:
                    logger.warning(f"Gemini model {target_model} returned HTTP {response.status_code}: {response.text}")
                    continue
            except Exception as e:
                logger.error(f"Error calling Gemini model {target_model}: {str(e)}")
                continue

    return ""


def safe_json_dumps(obj: Any) -> str:
    """Safely serialize Python objects containing dates or datetimes to JSON string."""
    try:
        return json.dumps(obj, default=str)
    except Exception:
        return str(obj)


def try_extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Attempt to parse JSON, fixing minor truncation if needed."""
    if not text:
        return None
    clean = text.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(clean)
    except Exception:
        pass
    
    # Try finding the first '{' and last '}'
    first_brace = clean.find("{")
    last_brace = clean.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        try:
            return json.loads(clean[first_brace:last_brace + 1])
        except Exception:
            pass
    return None


async def evaluate_daily_mindset(user_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Synthesize user's 1-day check-in, recent 3 journals, meditation logs, urges count,
    and onboarding purpose into a structured Mindset Score (0-100) + Energy Transmutation Summary.
    """
    prompt = f"""
Analyze the following 1-day data for user '{user_payload.get("username", "Warrior")}':

- Onboarding Primary Goal/Purpose: {user_payload.get("onboarding_purpose", "Mind Mastery & Energy Transmutation")}
- Current Streak: {user_payload.get("streak", 0)} days
- Today's Check-in Log: {safe_json_dumps(user_payload.get("today_checkin", {}))}
- Today's Urges Defeated: {user_payload.get("today_urges_count", 0)} (Total Urges Defeated: {user_payload.get("total_urges_count", 0)})
- Meditation Log Today: {safe_json_dumps(user_payload.get("meditation_log", {}))}
- Recent 3 Journal Entries: {safe_json_dumps(user_payload.get("recent_journals", []))}
- Urge Feedback & Triggers Logged Today: {safe_json_dumps(user_payload.get("today_urge_sessions", []))}

You MUST return STRICT JSON ONLY (no markdown formatting, no code blocks) matching this EXACT schema:
{{
  "score": <integer 0 to 100 representing Mindset Mastery Score>,
  "status_title": "<short status tier title, e.g., 'Transmutation Master' or 'Shield Active'>",
  "summary": "<2-3 sentence AI intelligence summary evaluating daily emotional control, mood, and urge discipline>",
  "transmutation_tip": "<1 key actionable advice on how to channel raw urge fuel into creative work/exercise/greatness>",
  "checkin_score": <integer 0-30 based on checkin checklist completeness>,
  "journal_score": <integer 0-20 based on self-reflection depth>,
  "meditation_urge_score": <integer 0-50 based on mindfulness & urge control>
}}
"""
    system_instruction = (
        "You are an AI Mind Scientist specializing in Sexual Energy Transmutation and Neuro-Plasticity. "
        "Calculate a precise Mindset Score (0-100) and structured output based strictly on input payload. "
        "Return ONLY raw valid JSON."
    )

    raw_response = await call_gemini_api(prompt, system_instruction=system_instruction)
    
    if raw_response:
        parsed = try_extract_json(raw_response)
        if parsed and isinstance(parsed, dict) and "score" in parsed:
            return parsed
        logger.warning(f"Could not parse Gemini Mindset evaluation JSON. Raw: {raw_response[:100]}...")

    # Robust fallback calculation if API key is rate-limited or pending
    checkin_done = 30 if user_payload.get("today_checkin") else 10
    journal_count = len(user_payload.get("recent_journals", []))
    journal_pts = min(journal_count * 7, 20)
    urges_pts = min(user_payload.get("today_urges_count", 0) * 10, 30)
    med_pts = 20 if user_payload.get("meditation_log") else 5
    calculated_score = min(checkin_done + journal_pts + urges_pts + med_pts, 100)

    return {
        "score": calculated_score,
        "status_title": "Ojas Transmutation Active",
        "summary": "Your daily check-ins and urge control show strong mental fortitude. Keep redirecting vital energy into focus.",
        "transmutation_tip": "Channel sexual energy spikes into 25 minutes of deep focus work or physical conditioning.",
        "checkin_score": checkin_done,
        "journal_score": journal_pts,
        "meditation_urge_score": urges_pts + med_pts
    }


async def generate_trigger_intelligence_report(trigger_data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate AI Trigger Intelligence tactics for high-risk urge patterns."""
    prompt = f"""
Analyze urge trigger metrics:
- Total Urges Defeated: {trigger_data.get("total_urges_count", 0)}
- Past 7 Days Breakdown: {safe_json_dumps(trigger_data.get("daily_urge_counts", []))}
- Common Triggers Logged: {safe_json_dumps(trigger_data.get("top_triggers", ["Stress", "Late Night", "Boredom"]))}
- Surfing Effectiveness Rate: {trigger_data.get("effectiveness_rate", 85)}%

Generate STRICT JSON ONLY (no markdown code blocks):
{{
  "peak_risk_window": "<e.g., '10:00 PM - 12:30 AM'>",
  "primary_vulnerability": "<e.g., 'Late Night Stress & Idle Environment'>",
  "tactical_defense": "<2-sentence actionable tactical protocol to counter this trigger before peak urge wave>",
  "vitality_boost_quote": "<1 inspiring Vedic transmutation quote>"
}}
"""
    raw_response = await call_gemini_api(prompt)
    if raw_response:
        parsed = try_extract_json(raw_response)
        if parsed and isinstance(parsed, dict) and "peak_risk_window" in parsed:
            return parsed

    return {
        "peak_risk_window": "10:30 PM - 1:00 AM",
        "primary_vulnerability": "Late Night Fatigue & Private Screen Exposure",
        "tactical_defense": "Leave mobile phone outside sleeping room after 10 PM. Execute 3 cycles of Box Breathing upon first urge sensation.",
        "vitality_boost_quote": "Virya redirected becomes Ojas—the radiance of intellect and irresistible willpower."
    }


async def get_chat_response(messages: List[Dict[str, str]], user_context: Dict[str, Any]) -> str:
    """Generate multi-turn AI Coach chat response focused on calibrated brevity, professional guidance, and 7-turn memory."""
    # Build history from last 14 messages (up to 7 full conversational turns)
    recent_turns = messages[-14:] if len(messages) > 14 else messages
    history_lines = []
    for msg in recent_turns[:-1]:
        role = "User" if msg.get("role") == "user" else "ZenWill Coach"
        content = (msg.get("content") or "").strip()
        if content:
            history_lines.append(f"{role}: {content}")
    history_text = "\n".join(history_lines) if history_lines else "No previous conversation."

    last_user_msg = (messages[-1].get("content", "") if messages else "").strip()
    user_name = user_context.get("name", "Operative")
    streak_days = user_context.get("streak", 0)
    time_of_day = user_context.get("time_of_day", "Today")
    local_time = user_context.get("local_time", "")
    local_date = user_context.get("local_date", "")
    timezone = user_context.get("timezone", "")

    # Detect if user message is a short greeting or quick check-in
    clean_lower = last_user_msg.lower().strip(" .!?,:;")
    is_greeting = clean_lower in [
        "hi", "hii", "hiii", "hello", "hey", "heyy", "sup", "yo", "good morning",
        "good afternoon", "good evening", "how are you", "howdy", "morning", "evening"
    ] or len(clean_lower.split()) <= 2 and any(w in clean_lower for w in ["hi", "hey", "hello", "sup", "yo"])

    is_urgent_urge = any(w in clean_lower for w in ["urge", "relapse", "craving", "horny", "help", "struggling", "trigger", "edge", "edging"])

    prompt = f"""
You are the ZenWill AI Mind & Willpower Coach. You are speaking with {user_name}.

REAL-TIME TEMPORAL CONTEXT (MANDATORY & STRICT):
- User's Exact Local Date: {local_date}
- User's Exact Local Time: {local_time} ({time_of_day}) [Timezone: {timezone}]
- User's Current Clean Streak: {streak_days} days
CRITICAL INSTRUCTION: You MUST strictly match the user's real-time temporal context ({time_of_day} at {local_time}). If it is Afternoon, NEVER say "Good morning". If it is Evening/Night, NEVER say "Good afternoon" or "Good morning". Match all greetings, check-ins, and temporal phrasing precisely to {time_of_day}.

CORE CONVERSATIONAL PRINCIPLES:
1. CALIBRATED BREVITY (CRITICAL):
   - If the user sends a simple greeting or short remark (e.g. "hi", "hello", "hey"): Respond in ONLY 1 to 2 short, warm, professional sentences matching the current {time_of_day.lower()}. NEVER preach, lecture, or dump paragraphs on a greeting.
   - If the user asks a specific question or shares a challenge: Deliver a sharp, actionable, highly professional response (2 to 4 concise sentences max).
   - If the user is in an active urge: Give 1-2 immediate physical/mental grounding steps.
2. PROFESSIONAL & EMPATHETIC: Speak like an elite executive performance and mindfulness mentor. Calm, disciplined, respectful, and sharp. No fluff, no robotic filler.
3. CONVERSATIONAL CONTINUITY: Use the previous 7 turns of context below to understand what {user_name} is going through. Do not repeat what was already said.

Previous Conversation Context (Last 7 Turns):
{history_text}

User's Latest Message:
"{last_user_msg}"

Reply:
"""

    response = await call_gemini_api(prompt)
    if response:
        cleaned = response.strip().strip('"')
        return cleaned

    # Contextual Smart Fallback
    if is_greeting:
        return f"Hello {user_name}. Good {time_of_day.lower()}. Ready to assist your focus and discipline. What's on your mind?"
    elif is_urgent_urge:
        return f"Pause right now, {user_name}. Place your device down, take 3 deep breaths, and ground your attention in this room. The urge wave will peak and dissipate."
    else:
        return f"Understood, {user_name}. Maintain your presence and focus this {time_of_day.lower()}. What specific challenge or objective are you working through right now?"
