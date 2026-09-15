from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from ..auth import get_user_from_token
from ..database import SessionLocal
from ..realtime import manager, utc_iso

router = APIRouter(tags=["realtime"])


@router.websocket("/api/ws")
async def realtime_socket(
    websocket: WebSocket,
    token: str | None = None,
    public: bool = False,
):
    is_public = public and not token
    if is_public:
        # Public event pages receive metadata-only data_update messages. They do
        # not participate in staff presence and cannot send application data.
        user_id = f"public:{uuid4()}"
    else:
        if not token:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
            return
        db = SessionLocal()
        try:
            user = get_user_from_token(token, db)
            user_id = str(user.id)
        except Exception:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
            return
        finally:
            db.close()

    became_online = await manager.connect(user_id, websocket)
    try:
        if not is_public:
            await manager.send_personal(
                websocket,
                {
                    "type": "presence_snapshot",
                    "online_user_ids": [
                        value
                        for value in await manager.online_user_ids()
                        if not value.startswith("public:")
                    ],
                    "timestamp": utc_iso(),
                },
            )
        if became_online and not is_public:
            await manager.broadcast(
                {
                    "type": "status_change",
                    "user_id": user_id,
                    "status": "online",
                    "timestamp": utc_iso(),
                }
            )

        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await manager.send_personal(
                    websocket,
                    {"type": "pong", "timestamp": utc_iso()},
                )
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        if await manager.disconnect(user_id, websocket) and not is_public:
            await manager.broadcast(
                {
                    "type": "status_change",
                    "user_id": user_id,
                    "status": "offline",
                    "timestamp": utc_iso(),
                }
            )
