import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket
from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

PUBLIC_REALTIME_RESOURCES = {"projects", "registrations", "form_fields"}

IGNORED_TABLES = {
    "executive_sessions",
    "executive_activity_logs",
    "agent_audit_log",
    "agent_conversations",
}


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, websocket: WebSocket) -> bool:
        await websocket.accept()
        async with self._lock:
            became_online = not self._connections[user_id]
            self._connections[user_id].add(websocket)
        return became_online

    async def disconnect(self, user_id: str, websocket: WebSocket) -> bool:
        async with self._lock:
            connections = self._connections.get(user_id)
            if not connections:
                return False
            connections.discard(websocket)
            if connections:
                return False
            self._connections.pop(user_id, None)
            return True

    async def online_user_ids(self) -> list[str]:
        async with self._lock:
            return list(self._connections)

    async def send_personal(self, websocket: WebSocket, message: dict[str, Any]) -> None:
        await websocket.send_json(message)

    async def broadcast(self, message: dict[str, Any]) -> None:
        async with self._lock:
            targets = [
                (user_id, websocket)
                for user_id, connections in self._connections.items()
                for websocket in connections
            ]

        failed: list[tuple[str, WebSocket]] = []
        for user_id, websocket in targets:
            outgoing = message
            if user_id.startswith("public:"):
                if (
                    message.get("type") != "data_update"
                    or message.get("resource") not in PUBLIC_REALTIME_RESOURCES
                ):
                    continue
                outgoing = {
                    "type": "data_update",
                    "resource": message["resource"],
                    "timestamp": message.get("timestamp", utc_iso()),
                }
            try:
                await websocket.send_json(outgoing)
            except Exception:
                failed.append((user_id, websocket))

        newly_offline: list[str] = []
        for user_id, websocket in failed:
            if await self.disconnect(user_id, websocket):
                newly_offline.append(user_id)

        for user_id in newly_offline:
            await self.broadcast(
                {
                    "type": "status_change",
                    "user_id": user_id,
                    "status": "offline",
                    "timestamp": utc_iso(),
                }
            )


class RealtimeBroker:
    def __init__(self, connection_manager: ConnectionManager) -> None:
        self.manager = connection_manager
        self.loop: asyncio.AbstractEventLoop | None = None
        self.queue: asyncio.Queue[dict[str, Any]] | None = None
        self.worker: asyncio.Task | None = None

    async def start(self) -> None:
        if self.worker and not self.worker.done():
            return
        self.loop = asyncio.get_running_loop()
        self.queue = asyncio.Queue(maxsize=10_000)
        self.worker = asyncio.create_task(self._run(), name="realtime-broadcast-worker")

    async def stop(self) -> None:
        worker = self.worker
        self.worker = None
        if worker:
            worker.cancel()
            try:
                await worker
            except asyncio.CancelledError:
                pass
        self.loop = None
        self.queue = None

    async def _run(self) -> None:
        assert self.queue is not None
        while True:
            message = await self.queue.get()
            try:
                await self.manager.broadcast(message)
            except Exception:
                logger.exception("Realtime broadcast failed")
            finally:
                self.queue.task_done()

    def publish_from_sync(self, message: dict[str, Any]) -> None:
        if not self.loop or not self.queue or self.loop.is_closed():
            return

        def enqueue() -> None:
            assert self.queue is not None
            try:
                self.queue.put_nowait(message)
            except asyncio.QueueFull:
                logger.warning("Realtime queue full; dropping %s event", message.get("resource"))

        self.loop.call_soon_threadsafe(enqueue)


manager = ConnectionManager()
broker = RealtimeBroker(manager)
_listeners_installed = False


def _model_event(instance: Any, action: str) -> dict[str, Any] | None:
    mapper = inspect(instance).mapper
    table_name = mapper.local_table.name
    if table_name in IGNORED_TABLES:
        return None
    identity = inspect(instance).identity
    entity_id = str(identity[0]) if identity else str(getattr(instance, "id", "") or "")
    return {
        "type": "data_update",
        "resource": table_name,
        "action": action,
        "entity_id": entity_id,
        "timestamp": utc_iso(),
    }


def install_session_listeners() -> None:
    global _listeners_installed
    if _listeners_installed:
        return
    _listeners_installed = True

    @event.listens_for(Session, "before_flush")
    def capture_deletes(session: Session, _flush_context, _instances) -> None:
        pending = session.info.setdefault("realtime_events", {})
        for instance in session.deleted:
            message = _model_event(instance, "deleted")
            if message:
                pending[(message["resource"], message["entity_id"], "deleted")] = message

    @event.listens_for(Session, "after_flush")
    def capture_changes(session: Session, _flush_context) -> None:
        pending = session.info.setdefault("realtime_events", {})
        for instance in session.new:
            message = _model_event(instance, "created")
            if message:
                pending[(message["resource"], message["entity_id"], "created")] = message
        for instance in session.dirty:
            if not session.is_modified(instance, include_collections=False):
                continue
            message = _model_event(instance, "updated")
            if message:
                pending[(message["resource"], message["entity_id"], "updated")] = message

    @event.listens_for(Session, "after_commit")
    def publish_changes(session: Session) -> None:
        pending = session.info.pop("realtime_events", {})
        for message in pending.values():
            broker.publish_from_sync(message)

    @event.listens_for(Session, "after_rollback")
    def discard_changes(session: Session) -> None:
        session.info.pop("realtime_events", None)
