"""
ZenWill Real-Time Event Bus
High-performance, non-blocking in-memory pub/sub event broadcaster for WebSockets.
Sub-second event propagation (<50ms) across Spartan Cells, DMs, check-ins, and battle sessions.
"""
import asyncio
import json
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket


class RealtimeBus:
    def __init__(self):
        # user_id -> Set of WebSockets (a user can have multiple devices / tabs)
        self.user_sockets: Dict[str, Set[WebSocket]] = {}
        # channel_name -> Set of WebSockets (e.g. "cell:123", "community", "battlefield:abc")
        self.channel_subscribers: Dict[str, Set[WebSocket]] = {}
        # Reverse mapping for O(1) cleanup
        self.socket_user: Dict[WebSocket, str] = {}
        self.socket_channels: Dict[WebSocket, Set[str]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        """Register a new authenticated WebSocket connection."""
        if user_id not in self.user_sockets:
            self.user_sockets[user_id] = set()
        self.user_sockets[user_id].add(websocket)
        self.socket_user[websocket] = user_id
        self.socket_channels[websocket] = set()

        # Automatically subscribe user to their own personal notification channel
        await self.subscribe(websocket, f"user:{user_id}")

    def disconnect(self, websocket: WebSocket):
        """Cleanly remove a disconnected WebSocket and its channel subscriptions."""
        user_id = self.socket_user.pop(websocket, None)
        if user_id and user_id in self.user_sockets:
            self.user_sockets[user_id].discard(websocket)
            if not self.user_sockets[user_id]:
                del self.user_sockets[user_id]

        channels = self.socket_channels.pop(websocket, set())
        for channel in channels:
            if channel in self.channel_subscribers:
                self.channel_subscribers[channel].discard(websocket)
                if not self.channel_subscribers[channel]:
                    del self.channel_subscribers[channel]

    async def subscribe(self, websocket: WebSocket, channel: str):
        """Subscribe a socket to a specific channel (e.g. 'cell:<cell_id>')."""
        if channel not in self.channel_subscribers:
            self.channel_subscribers[channel] = set()
        self.channel_subscribers[channel].add(websocket)

        if websocket in self.socket_channels:
            self.socket_channels[websocket].add(channel)

    async def unsubscribe(self, websocket: WebSocket, channel: str):
        """Unsubscribe a socket from a specific channel."""
        if channel in self.channel_subscribers:
            self.channel_subscribers[channel].discard(websocket)
            if not self.channel_subscribers[channel]:
                del self.channel_subscribers[channel]

        if websocket in self.socket_channels:
            self.socket_channels[websocket].discard(channel)

    async def _send_safe(self, ws: WebSocket, message_str: str) -> bool:
        """Send JSON string to socket, discarding silently if disconnected."""
        try:
            await ws.send_text(message_str)
            return True
        except Exception:
            self.disconnect(ws)
            return False

    async def broadcast_to_channel(self, channel: str, payload: Dict[str, Any]):
        """
        Lightweight broadcast to all subscribers of a channel in parallel.
        Executes in fractions of a millisecond.
        """
        subscribers = list(self.channel_subscribers.get(channel, set()))
        if not subscribers:
            return

        message_str = json.dumps(payload, default=str)
        tasks = [self._send_safe(ws, message_str) for ws in subscribers]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def send_to_user(self, user_id: str, payload: Dict[str, Any]):
        """Send a real-time event directly to all active connections of a specific user."""
        sockets = list(self.user_sockets.get(str(user_id), set()))
        if not sockets:
            return

        message_str = json.dumps(payload, default=str)
        tasks = [self._send_safe(ws, message_str) for ws in sockets]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_all(self, payload: Dict[str, Any]):
        """Broadcast an event to every connected client."""
        sockets = list(self.socket_user.keys())
        if not sockets:
            return

        message_str = json.dumps(payload, default=str)
        tasks = [self._send_safe(ws, message_str) for ws in sockets]
        await asyncio.gather(*tasks, return_exceptions=True)


# Global singleton instance
realtime_bus = RealtimeBus()
