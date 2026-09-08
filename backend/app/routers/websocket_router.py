"""
ZenWill WebSocket Router
Provides persistent full-duplex WebSocket connections for sub-second real-time notifications,
cell state synchronization, direct messaging alerts, and live battle events.
"""
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from typing import Optional
from app.utils.security import decode_token
from app.models.user import User
from app.services.realtime_bus import realtime_bus

router = APIRouter(tags=["WebSockets"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """
    WebSocket endpoint for real-time bidirectional synchronization.
    URL: ws://<host>/api/v1/ws?token=<access_token>
    """
    # 1. Validate JWT Token
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication token missing")
        return

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid authentication token")
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Token missing user subject")
        return

    # 2. Accept connection
    await websocket.accept()
    await realtime_bus.connect(websocket, str(user_id))

    # Automatically subscribe socket to public broadcast channels
    await realtime_bus.subscribe(websocket, "public_cells")
    await realtime_bus.subscribe(websocket, "battlefield")

    # Automatically look up user's active Spartan Cell in DB and subscribe to cell channel
    try:
        from app.models.spartan_cell import SpartanCell
        user_id_str = str(user_id).strip()
        user_cell = await SpartanCell.find_one({
            "$or": [
                {"member_ids": user_id_str},
                {"leader_id": user_id_str},
                {"members.user_id": user_id_str},
            ]
        })
        if user_cell:
            await realtime_bus.subscribe(websocket, f"cell:{user_cell.id}")
    except Exception:
        pass

    # Send initial connection acknowledgment
    await websocket.send_text(
        json.dumps({
            "type": "CONNECTED",
            "user_id": str(user_id),
            "message": "Connected to ZenWill Real-Time Bus",
        })
    )

    # 3. Message loop
    try:
        while True:
            raw_text = await websocket.receive_text()
            if not raw_text:
                continue

            try:
                data = json.loads(raw_text)
            except Exception:
                # If plain text 'ping' received
                if raw_text.strip().lower() == "ping":
                    await websocket.send_text(json.dumps({"type": "PONG"}))
                continue

            msg_type = data.get("action") or data.get("type")

            if msg_type == "PING" or msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "PONG"}))

            elif msg_type == "subscribe":
                channel = data.get("channel")
                if channel and isinstance(channel, str):
                    await realtime_bus.subscribe(websocket, channel.strip())
                    await websocket.send_text(
                        json.dumps({"type": "SUBSCRIBED", "channel": channel.strip()})
                    )

            elif msg_type == "unsubscribe":
                channel = data.get("channel")
                if channel and isinstance(channel, str):
                    await realtime_bus.unsubscribe(websocket, channel.strip())
                    await websocket.send_text(
                        json.dumps({"type": "UNSUBSCRIBED", "channel": channel.strip()})
                    )

    except WebSocketDisconnect:
        realtime_bus.disconnect(websocket)
    except Exception as e:
        realtime_bus.disconnect(websocket)
