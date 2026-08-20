"""
ZenWill Account Data Purger
Permanently deletes all data associated with a user across all MongoDB collections.
"""
from typing import Optional
from app.models.user import User
from app.models.mind_profile import MindProfile
from app.models.daily_checkin import DailyCheckin
from app.models.journal import JournalEntry
from app.models.behavioral_event import BehavioralEvent
from app.models.emergency_session import EmergencySession
from app.models.community_message import CommunityMessage
from app.models.direct_message import DirectMessage
from app.models.onboarding import Onboarding


async def purge_user_data_permanently(user: User) -> bool:
    """Permanently delete all user records across all MongoDB collections."""
    try:
        user_id_str = str(user.id)
        email_str = user.email or ""
        name_str = user.name or ""

        # 1. Delete Mind Profile
        try:
            await MindProfile.find({"$or": [{"user_id": user_id_str}, {"user_id": email_str}]}).delete()
        except Exception:
            pass

        # 2. Delete Daily Check-ins
        try:
            await DailyCheckin.find({"$or": [{"user_id": user_id_str}, {"user_id": email_str}]}).delete()
        except Exception:
            pass

        # 3. Delete Journal Entries
        try:
            await JournalEntry.find({"$or": [{"user_id": user_id_str}, {"user_id": email_str}]}).delete()
        except Exception:
            pass

        # 4. Delete Behavioral Events
        try:
            await BehavioralEvent.find({"$or": [{"user_id": user_id_str}, {"user_id": email_str}]}).delete()
        except Exception:
            pass

        # 5. Delete Emergency Sessions
        try:
            await EmergencySession.find({"$or": [{"user_id": user_id_str}, {"user_id": email_str}]}).delete()
        except Exception:
            pass

        # 6. Delete Community Messages
        try:
            await CommunityMessage.find({"$or": [{"user_id": user_id_str}, {"author_name": name_str}]}).delete()
        except Exception:
            pass

        # 7. Delete Direct Messages (sent or received)
        try:
            await DirectMessage.find({
                "$or": [
                    {"sender_id": user_id_str},
                    {"receiver_id": user_id_str},
                    {"sender_name": name_str},
                    {"receiver_name": name_str},
                ]
            }).delete()
        except Exception:
            pass

        # 8. Delete Onboarding Record
        try:
            await Onboarding.find({"$or": [{"user_id": user_id_str}, {"user_id": email_str}]}).delete()
        except Exception:
            pass

        # 9. Finally, delete the User document itself
        await user.delete()
        print(f"[ZenWill Account Purger] User {user_id_str} ({email_str}) permanently purged from MongoDB.")
        return True
    except Exception as e:
        print(f"[ZenWill Account Purger Error] Failed to purge user {user.id}: {e}")
        return False
