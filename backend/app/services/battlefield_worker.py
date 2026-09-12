"""
ZenWill Battlefield Background Worker
Monitors the global 15-minute epoch cycle and automatically triggers
room wipe-out and BATTLE_SESSION_RESET broadcasts at epoch boundaries.
"""
import asyncio
import time
import uuid
from datetime import datetime

from app.models.battle_session import BattleSession
from app.routers.battlefield import (
    get_current_epoch_info,
    purge_old_battlefield_epochs,
    format_battle_response,
    EPOCH_SECONDS,
)
from app.services.realtime_bus import realtime_bus


async def start_battlefield_epoch_worker():
    """
    Background worker that runs continuously.
    Detects when the global 15-minute wall-clock epoch changes, purges expired sessions,
    initializes the clean new session, and broadcasts BATTLE_SESSION_RESET to all connected clients.
    """
    print("[Battlefield Worker] Started 15-minute epoch monitoring background task.")
    last_known_epoch, _, _, _ = get_current_epoch_info()

    while True:
        try:
            await asyncio.sleep(2)
            current_epoch, time_remaining, epoch_start, epoch_expires = get_current_epoch_info()

            if current_epoch != last_known_epoch:
                print(f"[Battlefield Worker] Epoch transition: {last_known_epoch} -> {current_epoch}. Initiating room wipe-out.")
                last_known_epoch = current_epoch

                # 1. Purge previous sessions
                await purge_old_battlefield_epochs(current_epoch)

                # 2. Check if a session for the new epoch already exists
                session = await BattleSession.find_one(
                    BattleSession.session_number == current_epoch,
                    BattleSession.status == "active",
                )

                initial_msg = {
                    "id": str(uuid.uuid4()),
                    "user_id": "system",
                    "user_name": "⚔️ Spartan Commander",
                    "user_streak": 0,
                    "text": "🛡️ 15-Minute Shield Wall Epoch Renewed! Battlefield chat has been reset for the new cycle.",
                    "is_system": True,
                    "created_at": datetime.utcnow().isoformat() + "Z",
                }

                if not session:
                    session = BattleSession(
                        id=str(uuid.uuid4()),
                        session_number=current_epoch,
                        initiator_id="system",
                        initiator_name="Spartan Commander",
                        initiator_streak=0,
                        initiator_location="Global Sanctum",
                        duration_seconds=EPOCH_SECONDS,
                        status="active",
                        participant_ids=[],
                        participants=[],
                        messages=[initial_msg],
                        reactions=[],
                        honor_points_awarded=25,
                        started_at=epoch_start,
                        expires_at=epoch_expires,
                    )
                    await session.insert()

                # 3. Broadcast BATTLE_SESSION_RESET to all connected warriors on 'battlefield' channel
                formatted_resp = format_battle_response(session, "system")
                await realtime_bus.broadcast_to_channel(
                    "battlefield",
                    {
                        "type": "BATTLE_SESSION_RESET",
                        "session_id": str(session.id),
                        "session_number": current_epoch,
                        "message": session.messages[0] if session.messages else initial_msg,
                        "data": formatted_resp.model_dump(),
                    }
                )
                print(f"[Battlefield Worker] Successfully broadcast BATTLE_SESSION_RESET for epoch #{current_epoch}.")

        except asyncio.CancelledError:
            print("[Battlefield Worker] Worker cancelled.")
            break
        except Exception as e:
            print(f"[Battlefield Worker Error]: {e}")
            await asyncio.sleep(5)
