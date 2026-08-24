"""
ZenWill Account Data Purger
Permanently deletes all data associated with a user across all MongoDB collections.
"""
from datetime import datetime, timedelta
import asyncio
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
from app.models.chat_message import ChatMessage
from app.models.mission import Mission
from app.models.purpose import LifePurpose


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

        # 4. Delete Missions
        try:
            await Mission.find({"$or": [{"user_id": user_id_str}, {"user_id": email_str}]}).delete()
        except Exception:
            pass

        # 5. Delete Behavioral & Meditation Events
        try:
            await BehavioralEvent.find({"$or": [{"user_id": user_id_str}, {"user_id": email_str}]}).delete()
        except Exception:
            pass

        # 6. Delete Emergency Urge Sessions
        try:
            await EmergencySession.find({"$or": [{"user_id": user_id_str}, {"user_id": email_str}]}).delete()
        except Exception:
            pass

        # 7. Delete AI Chat Messages
        try:
            await ChatMessage.find({"$or": [{"user_id": user_id_str}, {"user_id": email_str}]}).delete()
        except Exception:
            pass

        # 8. Delete Community Messages
        try:
            await CommunityMessage.find({"$or": [{"user_id": user_id_str}, {"author_name": name_str}]}).delete()
        except Exception:
            pass

        # 9. Delete Direct Messages (sent or received)
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

        # 10. Delete Life Purpose Records
        try:
            await LifePurpose.find({"$or": [{"user_id": user_id_str}, {"user_id": email_str}]}).delete()
        except Exception:
            pass

        # 11. Delete Onboarding Record
        try:
            await Onboarding.find({"$or": [{"user_id": user_id_str}, {"user_id": email_str}]}).delete()
        except Exception:
            pass

        # 12. Finally, delete the User document itself
        await user.delete()
        print(f"[ZenWill Account Purger] User {user_id_str} ({email_str}) permanently purged from all MongoDB collections.")
        return True
    except Exception as e:
        print(f"[ZenWill Account Purger Error] Failed to purge user {user.id}: {e}")
        return False


async def purge_all_expired_accounts():
    """Scan and purge any accounts whose 7-day deletion grace period has expired."""
    try:
        now = datetime.utcnow()
        seven_days_ago = now - timedelta(days=7)
        expired_users = await User.find(
            User.is_scheduled_for_deletion == True,
            User.deletion_scheduled_at <= seven_days_ago
        ).to_list()

        for u in expired_users:
            print(f"[ZenWill Account Purger] Auto-purging expired account: {u.email}")
            await purge_user_data_permanently(u)
    except Exception as e:
        print(f"[ZenWill Account Purger Error] Background expired accounts scan failed: {e}")


async def start_expired_accounts_worker():
    """Background worker that runs every 6 hours to purge accounts past the 7-day grace period."""
    while True:
        try:
            await purge_all_expired_accounts()
        except Exception as e:
            print(f"[ZenWill Worker Error] {e}")
        await asyncio.sleep(6 * 3600)  # Check every 6 hours

