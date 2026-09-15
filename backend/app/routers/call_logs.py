from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/call-logs", tags=["call_logs"])

def _to_out(c: models.CallLog) -> schemas.CallLogOut:
    return schemas.CallLogOut(
        id=c.id, task_id=c.task_id, customer_id=c.customer_id,
        executive_id=c.executive_id,
        executive_name=c.executive.name if c.executive else None,
        phone_number=c.phone_number or "", received=c.received,
        duration_seconds=c.duration_seconds or 0, notes=c.notes or "",
        provider=c.provider or "", started_at=c.started_at, ended_at=c.ended_at,
        created_at=c.created_at,
    )

@router.post("", response_model=schemas.CallLogOut)
def create_call_log(
    payload: schemas.CallLogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    log = models.CallLog(
        task_id=payload.task_id, customer_id=payload.customer_id,
        executive_id=current_user.id, phone_number=payload.phone_number,
        received=payload.received, duration_seconds=payload.duration_seconds,
        notes=payload.notes, provider=payload.provider,
        started_at=payload.started_at, ended_at=payload.ended_at,
    )
    db.add(log); db.commit(); db.refresh(log)
    return _to_out(log)

@router.get("/by-task/{task_id}", response_model=list[schemas.CallLogOut])
def list_call_logs_by_task(
    task_id: int, db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    logs = db.query(models.CallLog).filter(
        models.CallLog.task_id == task_id
    ).order_by(models.CallLog.created_at.desc()).all()
    return [_to_out(c) for c in logs]


@router.get("/config")
def get_call_config(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    keys = {"call_provider", "call_uri_template", "call_country_code"}
    values = {
        row.key: row.value or ""
        for row in db.query(models.AppSetting).filter(models.AppSetting.key.in_(keys)).all()
    }
    return {
        "provider": values.get("call_provider") or "Zoiper / System Dialer",
        "uri_template": values.get("call_uri_template") or "tel:{phone}",
        "country_code": values.get("call_country_code") or "",
    }


@router.get("/by-customer/{customer_id}", response_model=list[schemas.CallLogOut])
def list_call_logs_by_customer(
    customer_id: str, db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    logs = db.query(models.CallLog).filter(
        models.CallLog.customer_id == customer_id
    ).order_by(models.CallLog.created_at.desc()).all()
    return [_to_out(c) for c in logs]
