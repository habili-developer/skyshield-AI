from __future__ import annotations

import json
import logging
from typing import Dict, List

from fastapi import WebSocket


logger = logging.getLogger("skyshield.websocket")


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New WebSocket connection. Total: {len(self.active_connections)}")
        # Send initial connection confirmation
        await self.send_personal_message({
            "type": "connection_established",
            "message": "Connected to SkyShield AI WebSocket"
        }, websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: Dict) -> None:
        """
        Broadcast a message to all connected clients.
        """
        if not self.active_connections:
            return

        message_str = json.dumps(message)
        disconnected = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                disconnected.append(connection)
        
        # Clean up failed connections
        for conn in disconnected:
            self.disconnect(conn)

    async def send_personal_message(self, message: Dict, websocket: WebSocket) -> None:
        await websocket.send_text(json.dumps(message))
