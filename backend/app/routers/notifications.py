
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
RETENTION_DAYS = 15


def purge_expired_notifications(db: Session) -> None:
    cutoff = (datetime.now(models.BD_TZ) - timedelta(days=RETENTION_DAYS)).replace(tzinfo=None)
    deleted = db.query(models.Notification).filter(models.Notification.created_at < cutoff).delete(
        synchronize_session=False
    )
    if deleted:
        db.commit()


def notify(
    db: Session,
    user_id: str,
    message: str,
    type_: str = "general",
    target_url: str | None = None,
) -> None:
    if not user_id:
        return
    db.add(
        models.Notification(
            user_id=user_id,
            message=message,
            type=type_,
            target_url=target_url,
        )
    )


@router.get("", response_model=list[schemas.NotificationOut])
def list_notifications(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    purge_expired_notifications(db)
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    purge_expired_notifications(db)
    count = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id, models.Notification.is_read.is_(False))
        .count()
    )
    return {"count": count}


@router.post("/mark-read")
def mark_read(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id, models.Notification.is_read.is_(False)
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}


@router.post("/{notification_id}/read", response_model=schemas.NotificationOut)
def mark_one_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    notification = (
        db.query(models.Notification)
        .filter(
            models.Notification.id == notification_id,
            models.Notification.user_id == current_user.id,
        )
        .first()
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification পাওয়া যায়নি")
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification
