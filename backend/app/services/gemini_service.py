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

_cached_working_model: Optional[str] = None

async def call_gemini_api(
    prompt: str,
    system_instruction: str = SYSTEM_PROMPT_EMPOWERMENT,
    model: Optional[str] = None,
    max_tokens: int = 1000,
    temperature: float = 0.4
) -> str:
    """Call Google Gemini API using fast and reliable production models with auto-fallback and caching."""
    global _cached_working_model
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        logger.warning("No GEMINI_API_KEY set in config.")
        return ""

    candidate_models = []
    if _cached_working_model:
        candidate_models.append(_cached_working_model)
    if model:
        candidate_models.append(model)
    if settings.GEMINI_MODEL:
        candidate_models.append(settings.GEMINI_MODEL)
    
    # Priority on the active working model
    candidate_models.extend([
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-flash-latest",
    ])
    
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
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
            "thinkingConfig": {
                "thinkingBudget": 0
            }
        }
    }

    async with httpx.AsyncClient(timeout=12.0) as client:
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
                            _cached_working_model = target_model
                            return parts[0].get("text", "").strip()
                elif response.status_code == 404:
                    logger.warning(f"Gemini model {target_model} returned 404, attempting next fast fallback...")
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
    """Generate lightning-fast, friendly, simple, and concise AI Coach responses."""
    # Build history from last 6 messages (up to 3 full conversational turns)
    recent_turns = messages[-6:] if len(messages) > 6 else messages
    history_lines = []
    for msg in recent_turns[:-1]:
        role = "User" if msg.get("role") == "user" else "Coach"
        content = (msg.get("content") or "").strip()
        if content:
            history_lines.append(f"{role}: {content}")
    history_text = "\n".join(history_lines) if history_lines else "None."

    last_user_msg = (messages[-1].get("content", "") if messages else "").strip()
    user_name = user_context.get("name", "Friend")
    streak_days = user_context.get("streak", 0)
    time_of_day = user_context.get("time_of_day", "Today")
    local_time = user_context.get("local_time", "")

    clean_lower = last_user_msg.lower().strip(" .!?,:;")
    is_greeting = clean_lower in [
        "hi", "hii", "hiii", "hello", "hey", "heyy", "sup", "yo", "good morning",
        "good afternoon", "good evening", "how are you", "howdy", "morning", "evening"
    ] or (len(clean_lower.split()) <= 2 and any(w in clean_lower for w in ["hi", "hey", "hello", "sup", "yo"]))

    is_urgent_urge = any(w in clean_lower for w in ["urge", "relapse", "craving", "horny", "help", "struggling", "trigger", "edge", "edging"])

    system_instruction = (
        "You are ZenWill AI Coach, a friendly, warm, and supportive personal guide for focus and self-discipline. "
        "Rules: "
        "1. Write in SIMPLE, EASY everyday words that anyone can instantly understand. "
        "2. Keep answers SHORT (1 to 2 short sentences, max 30 words). "
        "3. Only necessary tokens. NO extra talking, NO long lectures, NO filler paragraphs. "
        "4. Be kind, practical, encouraging, and helpful."
    )

    prompt = f"""
User: {user_name} (Streak: {streak_days} days, Time: {time_of_day} {local_time})
Recent context:
{history_text}

User's message:
"{last_user_msg}"

Reply in 1-2 short, easy, friendly sentences:
"""

    response = await call_gemini_api(
        prompt=prompt,
        system_instruction=system_instruction,
        max_tokens=150,
        temperature=0.3
    )

    if response:
        cleaned = response.strip().strip('"')
        return cleaned

    # Contextual Smart Fallback
    if is_greeting:
        return f"Hey {user_name}! Good {time_of_day.lower()}. I'm right here with you—what's on your mind today?"
    elif is_urgent_urge:
        return f"Take 3 deep slow breaths right now, {user_name}. Put your phone down and drink a glass of water. You've got this!"
    else:
        return f"I'm with you, {user_name}. Stay focused and take it one moment at a time. What are you working on right now?"
