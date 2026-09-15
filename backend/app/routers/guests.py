from datetime import datetime
import os
import uuid
from typing import Any, cast

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import String, cast as sql_cast, exists, or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, require_admin, require_customer_access, require_customer_edit_access
from ..database import get_db
from ..config import settings
from .notifications import notify

router = APIRouter(prefix="/api/customers", tags=["customers"])
fields_router = APIRouter(prefix="/api/customer-fields", tags=["customer-fields"])


def _get_last_assignment_summary(db: Session, customer_id: str) -> tuple[str | None, datetime | None]:
    task = (
        db.query(models.Task)
        .filter(
            models.Task.customer_id == customer_id,
            models.Task.assigned_to.isnot(None),
            models.Task.assigned_at.isnot(None),
        )
        .order_by(models.Task.assigned_at.desc(), models.Task.created_at.desc())
        .first()
    )
    if task is not None and task.assigned_to:
        return task.assignee.name if getattr(task, "assignee", None) else None, task.assigned_at

    followup = (
        db.query(models.CustomerFollowUp)
        .filter(
            models.CustomerFollowUp.customer_id == customer_id,
            models.CustomerFollowUp.assigned_to.isnot(None),
        )
        .order_by(models.CustomerFollowUp.created_at.desc(), models.CustomerFollowUp.scheduled_at.desc())
        .first()
    )
    if followup is not None and followup.assigned_to:
        return followup.assignee.name if getattr(followup, "assignee", None) else None, followup.created_at

    return None, None


def _to_out(
    db: Session,
    c: models.Customer,
    stage_override: str = "",
    last_assigned_comm_name: str | None = None,
    last_assigned_at: datetime | None = None,
) -> schemas.CustomerOut:
    count = db.query(models.Registration).filter(models.Registration.customer_id == c.id).count()
    return schemas.CustomerOut(
        id=c.id,
        full_name=c.full_name,
        mobile=c.mobile,
        email=c.email,
        profile_image_url=c.profile_image_url or "",
        location=c.location or "",
        profession=c.profession or "",
        age=c.age,
        stage=stage_override or c.stage or "",
        customer_problem="",
        executive_remarks="",
        first_following_date=None,
        next_following_date=None,
        last_assigned_comm_name=last_assigned_comm_name,
        last_assigned_at=last_assigned_at,
        extra_data=c.extra_data or {},
        programs_count=count,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )

def _get_or_404(db: Session, customer_id: str) -> models.Customer:
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if customer is None:
        raise HTTPException(status_code=404, detail="Client পাওয়া যায়নি")
    return customer


def _followup_out(item: models.CustomerFollowUp) -> schemas.CustomerFollowUpOut:
    return schemas.CustomerFollowUpOut(
        id=item.id,
        customer_id=item.customer_id,
        assigned_to=item.assigned_to,
        assignee_name=item.assignee.name if item.assignee else None,
        assignee_image_url=item.assignee.profile_image_url if item.assignee else "",
        created_by=item.created_by,
        creator_name=item.creator.name if item.creator else None,
        creator_image_url=item.creator.profile_image_url if item.creator else "",
        scheduled_at=item.scheduled_at,
        note=item.note or "",
        result=item.result or "",
        stage=item.stage or "",
        completed=bool(item.completed),
        completed_at=item.completed_at,
        created_at=item.created_at,
    )


def _validate_followup_assignee(db: Session, user_id: str | None) -> models.User | None:
    if not user_id:
        return None
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.role == "executive",
        models.User.is_active.is_(True),
    ).first()
    if user is None:
        raise HTTPException(status_code=400, detail="Follow-up শুধু active communicator-কে assign করা যাবে")
    return user


@router.get("", response_model=list[schemas.CustomerOut], dependencies=[Depends(require_customer_access)])
def list_customers(q: str = "", db: Session = Depends(get_db)):
    query = db.query(models.Customer)
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.Customer.full_name.ilike(like),
                models.Customer.mobile.ilike(like),
                models.Customer.email.ilike(like),
                models.Customer.location.ilike(like),
                models.Customer.profession.ilike(like),
                models.Customer.stage.ilike(like),
                sql_cast(models.Customer.age, String).ilike(like),
                sql_cast(models.Customer.extra_data, String).ilike(like),
                exists().where(
                    models.Registration.customer_id == models.Customer.id,
                    sql_cast(models.Registration.data, String).ilike(like),
                ),
                exists().where(
                    models.CustomerFollowUp.customer_id == models.Customer.id,
                    or_(
                        models.CustomerFollowUp.note.ilike(like),
                        models.CustomerFollowUp.result.ilike(like),
                        models.CustomerFollowUp.stage.ilike(like),
                    ),
                ),
                exists().where(
                    models.Task.customer_id == models.Customer.id,
                    or_(
                        models.Task.stage.ilike(like),
                        models.Task.customer_problem.ilike(like),
                        models.Task.executive_remarks.ilike(like),
                        sql_cast(models.Task.followup_extra_data, String).ilike(like),
                        sql_cast(models.Task.manual_lead_data, String).ilike(like),
                    ),
                ),
                exists().where(
                    models.CallLog.customer_id == models.Customer.id,
                    models.CallLog.notes.ilike(like),
                ),
            )
        )
    customers = query.order_by(models.Customer.updated_at.desc()).all()
    customer_ids = [c.id for c in customers]
    latest_stage_by_customer: dict[str, str] = {}
    last_assignment_by_customer: dict[str, tuple[str | None, datetime | None]] = {}
    if customer_ids:
        followups = (
            db.query(models.CustomerFollowUp.customer_id, models.CustomerFollowUp.stage)
            .filter(models.CustomerFollowUp.customer_id.in_(customer_ids))
            .order_by(models.CustomerFollowUp.customer_id, models.CustomerFollowUp.updated_at.desc())
            .all()
        )
        for customer_id, stage in followups:
            if customer_id not in latest_stage_by_customer and stage:
                latest_stage_by_customer[customer_id] = stage
    for customer in customers:
        last_assignment_by_customer[customer.id] = _get_last_assignment_summary(db, customer.id)
    return [
        _to_out(
            db,
            c,
            latest_stage_by_customer.get(c.id, ""),
            last_assignment_by_customer[c.id][0],
            last_assignment_by_customer[c.id][1],
        )
        for c in customers
    ]


@router.post("", response_model=schemas.CustomerOut, dependencies=[Depends(require_customer_edit_access)])
def create_customer(payload: schemas.CustomerCreate, db: Session = Depends(get_db)):
    if not payload.mobile.strip():
        raise HTTPException(status_code=400, detail="মোবাইল নম্বর আবশ্যক")
    customer = models.Customer(**payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return _to_out(db, customer)


@router.get("/{customer_id}", response_model=schemas.CustomerDetailOut, dependencies=[Depends(require_customer_access)])
def get_customer(customer_id: str, db: Session = Depends(get_db)):
    customer = _get_or_404(db, customer_id)
    regs = (
        db.query(models.Registration)
        .filter(models.Registration.customer_id == customer_id)
        .order_by(models.Registration.created_at.desc())
        .all()
    )
    from .tasks import _history_entry

    def registration_task_history(registration: models.Registration) -> list[schemas.TaskHistoryEntry]:
        query = db.query(models.Task).filter(
            models.Task.registration_id == registration.id,
        )
        rows = query.order_by(models.Task.created_at.asc()).all()
        return [_history_entry(row) for row in rows]

    last_assigned_comm_name, last_assigned_at = _get_last_assignment_summary(db, customer_id)
    base = _to_out(db, customer, last_assigned_comm_name=last_assigned_comm_name, last_assigned_at=last_assigned_at)
    standalone_tasks = db.query(models.Task).filter(
        models.Task.customer_id == customer_id,
        models.Task.registration_id.is_(None),
    ).order_by(models.Task.created_at.desc()).all()
    return schemas.CustomerDetailOut(
        **base.model_dump(),
        registrations=[
            schemas.CustomerRegistrationSummary(
                registration_id=cast(int, r.id),
                reg_id=cast(str, r.reg_id),
                project_id=cast(str, r.project_id),
                project_name=r.project.name if r.project else "",
                data=cast(dict[str, Any], r.data or {}),
                field_labels={
                    field.key: field.label
                    for field in (r.project.form_fields if r.project else [])
                },
                created_at=cast(datetime, r.created_at),
                task_history=registration_task_history(r),
            )
            for r in regs
        ],
        lead_history=[_history_entry(row) for row in standalone_tasks],
    )


@router.patch("/{customer_id}", response_model=schemas.CustomerOut, dependencies=[Depends(require_customer_edit_access)])
def update_customer(customer_id: str, payload: schemas.CustomerUpdate, db: Session = Depends(get_db)):
    customer = _get_or_404(db, customer_id)
    data = payload.model_dump(exclude_unset=True)
    if "mobile" in data:
        data["mobile"] = (data["mobile"] or "").strip()
        if not data["mobile"]:
            raise HTTPException(status_code=400, detail="মোবাইল নম্বর আবশ্যক")
    if "extra_data" in data and data["extra_data"] is not None:
        merged = dict(customer.extra_data or {})
        merged.update(data["extra_data"])
        customer.extra_data = merged
        data.pop("extra_data")
    for field, value in data.items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return _to_out(db, customer)


@router.post("/{customer_id}/profile-image", response_model=schemas.CustomerOut)
async def upload_customer_profile_image(
    customer_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(require_customer_edit_access),
):
    customer = _get_or_404(db, customer_id)
    allowed_types = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    extension = allowed_types.get(file.content_type or "")
    if not extension:
        raise HTTPException(status_code=400, detail="JPG, PNG, WEBP অথবা GIF image দিন")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Profile image সর্বোচ্চ 5 MB হতে পারবে")

    os.makedirs(settings.upload_dir, exist_ok=True)
    filename = f"customer_{customer.id}_{uuid.uuid4().hex[:10]}{extension}"
    destination = os.path.join(settings.upload_dir, filename)
    with open(destination, "wb") as output:
        output.write(content)

    customer.profile_image_url = f"/{settings.upload_dir}/{filename}"
    db.commit()
    db.refresh(customer)
    return _to_out(db, customer)


@router.get("/{customer_id}/followups", response_model=list[schemas.CustomerFollowUpOut], dependencies=[Depends(require_customer_access)])
def list_customer_followups(customer_id: str, db: Session = Depends(get_db)):
    _get_or_404(db, customer_id)
    rows = db.query(models.CustomerFollowUp).filter(
        models.CustomerFollowUp.customer_id == customer_id
    ).order_by(models.CustomerFollowUp.scheduled_at.desc()).all()
    return [_followup_out(row) for row in rows]


@router.post("/{customer_id}/followups", response_model=schemas.CustomerFollowUpOut)
def create_customer_followup(
    customer_id: str,
    payload: schemas.CustomerFollowUpCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_customer_edit_access),
):
    customer = _get_or_404(db, customer_id)
    if payload.stage not in schemas.STAGE_OPTIONS:
        raise HTTPException(status_code=400, detail="সঠিক stage নির্বাচন করুন")
    assigned_to = current_user.id if current_user.role == "executive" else payload.assigned_to
    assignee = _validate_followup_assignee(db, assigned_to)
    if current_user.role == "admin" and assignee is None:
        raise HTTPException(status_code=400, detail="একজন communicator নির্বাচন করুন")

    item = models.CustomerFollowUp(
        customer_id=customer.id,
        assigned_to=assigned_to,
        created_by=current_user.id,
        scheduled_at=payload.scheduled_at,
        note=payload.note.strip(),
        result=payload.result.strip(),
        stage=payload.stage,
    )
    db.add(item)
    db.flush()

    from .tasks import _validate_assignment_capacity
    _validate_assignment_capacity(db, assigned_to)
    task = models.Task(
        title=f"Follow-up — {customer.full_name or 'Client'}",
        description=payload.note.strip() or "Scheduled customer follow-up",
        assigned_to=assigned_to,
        assigned_at=datetime.now(models.BD_TZ),
        created_by=current_user.id,
        customer_id=customer.id,
        followup_id=item.id,
        due_date=payload.scheduled_at,
        stage=payload.stage,
        status="pending",
    )
    db.add(task)
    db.flush()
    task.root_task_id = task.id
    notify(db, assigned_to, f'Follow-up scheduled: "{customer.full_name}"', "task_assigned", "/admin/tasks")
    db.commit()
    db.refresh(item)
    return _followup_out(item)


@router.patch("/{customer_id}/followups/{followup_id}", response_model=schemas.CustomerFollowUpOut)
def update_customer_followup(
    customer_id: str,
    followup_id: int,
    payload: schemas.CustomerFollowUpUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_customer_edit_access),
):
    customer = _get_or_404(db, customer_id)
    item = db.query(models.CustomerFollowUp).filter(
        models.CustomerFollowUp.id == followup_id,
        models.CustomerFollowUp.customer_id == customer_id,
    ).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Follow-up পাওয়া যায়নি")
    if current_user.role != "admin" and item.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="এই follow-up পরিবর্তনের অনুমতি নেই")
    data = payload.model_dump(exclude_unset=True)
    if data.get("stage") and data["stage"] not in schemas.STAGE_OPTIONS:
        raise HTTPException(status_code=400, detail="সঠিক stage নির্বাচন করুন")
    if "assigned_to" in data:
        if current_user.role != "admin":
            data.pop("assigned_to")
        else:
            if not data["assigned_to"]:
                raise HTTPException(status_code=400, detail="একজন communicator নির্বাচন করুন")
            _validate_followup_assignee(db, data["assigned_to"])
    if data.get("completed") is True and not item.completed and current_user.role != "admin":
        from .tasks import _validate_followup_capacity
        _validate_followup_capacity(db, current_user)
    if data.get("completed") is True and not item.completed:
        item.completed_at = datetime.now(models.BD_TZ)
    elif data.get("completed") is False:
        item.completed_at = None
    for key, value in data.items():
        setattr(item, key, value.strip() if isinstance(value, str) else value)

    task = db.query(models.Task).filter(models.Task.followup_id == item.id).first()
    if task:
        if task.assigned_to != item.assigned_to:
            from .tasks import _validate_assignment_capacity
            _validate_assignment_capacity(db, item.assigned_to)
            task.assigned_at = datetime.now(models.BD_TZ)
        task.due_date = item.scheduled_at
        task.assigned_to = item.assigned_to
        task.stage = item.stage
        task.executive_remarks = item.result
        task.status = "completed" if item.completed else "pending"
        task.completed_at = item.completed_at
    db.commit()
    db.refresh(item)
    return _followup_out(item)


@router.delete("/{customer_id}", dependencies=[Depends(require_admin)])
def delete_customer(customer_id: str, db: Session = Depends(get_db)):
    customer = _get_or_404(db, customer_id)
    db.delete(customer)
    db.commit()
    return {"ok": True}


# ── Global schema for the extra personal-data fields (admin only) ──


@fields_router.get("", response_model=list[schemas.CustomerFieldOut], dependencies=[Depends(require_customer_access)])
def list_customer_fields(db: Session = Depends(get_db)):
    return db.query(models.CustomerField).order_by(models.CustomerField.position).all()


@fields_router.put("", response_model=list[schemas.CustomerFieldOut], dependencies=[Depends(require_admin)])
def replace_customer_fields(fields: list[schemas.CustomerFieldIn], db: Session = Depends(get_db)):
    keys = [f.key for f in fields]
    if len(keys) != len(set(keys)):
        raise HTTPException(status_code=400, detail="Field key duplicate করা যাবে না")

    db.query(models.CustomerField).delete()
    for i, f in enumerate(fields):
        db.add(models.CustomerField(key=f.key, label=f.label, type=f.type, options=f.options, position=i))
    db.commit()
    return db.query(models.CustomerField).order_by(models.CustomerField.position).all()
