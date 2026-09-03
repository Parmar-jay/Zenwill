from motor.motor_asyncio import AsyncIOMotorClient
# pyrefly: ignore [missing-import]
from beanie import init_beanie
from app.config import settings

from app.models.user import User
from app.models.mind_profile import MindProfile
from app.models.daily_checkin import DailyCheckin
from app.models.journal import JournalEntry
from app.models.mission import Mission
from app.models.behavioral_event import BehavioralEvent
from app.models.emergency_session import EmergencySession
from app.models.chat_message import ChatMessage
from app.models.community_message import CommunityMessage
from app.models.purpose import LifePurpose
from app.models.direct_message import DirectMessage
from app.models.onboarding import Onboarding
from app.models.recommendation_task import RecommendationTaskCompletion
from app.models.relapse_autopsy import RelapseAutopsy
from app.models.spartan_cell import SpartanCell
from app.models.battle_session import BattleSession
from app.models.meditation_session import MeditationSession

DOCUMENT_MODELS = [
    User,
    MindProfile,
    DailyCheckin,
    JournalEntry,
    Mission,
    BehavioralEvent,
    EmergencySession,
    ChatMessage,
    CommunityMessage,
    LifePurpose,
    DirectMessage,
    Onboarding,
    RecommendationTaskCompletion,
    RelapseAutopsy,
    SpartanCell,
    BattleSession,
    MeditationSession,
]

motor_client: AsyncIOMotorClient = None


async def init_db() -> None:
    """Initialize MongoDB connection and Beanie document models on startup with fallback support."""
    global motor_client
    print(f"[ZenWill] Connecting to MongoDB at {settings.MONGODB_URL} (Database: {settings.MONGODB_DB_NAME})...")
    try:
        motor_client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
        setattr(motor_client, "append_metadata", lambda *args, **kwargs: None)
        database = motor_client[settings.MONGODB_DB_NAME]
        await init_beanie(database=database, document_models=DOCUMENT_MODELS)
        print(f"[ZenWill Success] Connected to MongoDB and initialized {len(DOCUMENT_MODELS)} collections!")
    except Exception as e:
        print(f"[ZenWill Warning] Primary MongoDB connection failed ({e}). Using in-memory MongoMock database fallback...")
        # pyrefly: ignore [missing-import]
        from mongomock_motor import AsyncIOMockClient
        motor_client = AsyncIOMockClient()
        setattr(motor_client, "append_metadata", lambda *args, **kwargs: None)
        database = motor_client[settings.MONGODB_DB_NAME]
        await init_beanie(database=database, document_models=DOCUMENT_MODELS)
        print(f"[ZenWill Success] In-memory fallback database initialized with {len(DOCUMENT_MODELS)} collections!")


async def get_db():
    """No-op dependency placeholder for route compatibility."""
    yield None
