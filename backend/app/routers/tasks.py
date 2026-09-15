# from datetime import datetime
from datetime import datetime, timedelta, date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session, selectinload
from .notifications import notify


from .. import models, schemas
from ..auth import get_current_user, require_admin
from ..database import get_db
from ..models import BD_TZ # Import BD_TZ

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

# Fields an assignee (non-admin) may fill in themselves — the lead follow-up
# form, plus toggling status. Title/description/assignment/due date stay
# admin-only.
ASSIGNEE_EDITABLE_FIELDS = {
    "status",
    "full_name_update",
    "location",
    "profession",
    "age",
    "customer_problem",
    "executive_remarks",
    "stage",
    "first_following_date",
    "next_following_date",
    "followup_reason",
    "followup_extra_data",
    "call_received",
}


def _to_out(t: models.Task) -> schemas.TaskOut:
    registration_data = dict(t.manual_lead_data or {})
    if t.registration:
        registration_data.update(t.registration.data or {})
        if t.registration.project:
            registration_data["manual_field_labels"] = {
                field.key: field.label
                for field in t.registration.project.form_fields
            }
    if t.customer:
        # Only stable personal information is shared between contexts.
        customer_data = {
            "full_name": t.customer.full_name or "",
            "mobile": t.customer.mobile or "",
            "email": t.customer.email or "",
            "location": t.customer.location or "",
            "profession": t.customer.profession or "",
            "age": t.customer.age,
            **(t.customer.extra_data or {}),
        }
        registration_data = {**customer_data, **registration_data}
    return schemas.TaskOut(
        id=t.id,
        title=t.title,
        description=t.description or "",
        assigned_to=t.assigned_to,
        assignee_name=t.assignee.name if t.assignee else None,
        assignee_image_url=t.assignee.profile_image_url if t.assignee else "",
        created_by=t.created_by,
        creator_name=t.creator.name if t.creator else None,
        creator_image_url=t.creator.profile_image_url if t.creator else "",
        project_id=t.project_id,
        project_name=t.project.name if t.project else ("Manual Lead" if t.manual_lead_data else None),
        registration_id=t.registration_id,
        customer_id=t.customer_id,
        customer_name=t.customer.full_name if t.customer else None,
        customer_image_url=t.customer.profile_image_url if t.customer else "",
        status=t.status,
        due_date=t.due_date,
        assigned_at=t.assigned_at,
        created_at=t.created_at,
        completed_at=t.completed_at,
        full_name_update=t.full_name_update or "",
        location=t.location or "",
        profession=t.profession or "",
        age=t.age,
        customer_problem=t.customer_problem or "",
        executive_remarks=t.executive_remarks or "",
        stage=t.stage or "",
        first_following_date=t.first_following_date,
        next_following_date=t.next_following_date,
        followup_reason=t.followup_reason or "",
        followup_extra_data=t.followup_extra_data or {},
        followup_id=t.followup_id,
        registration_data=registration_data,
    )


def _history_entry(task: models.Task) -> schemas.TaskHistoryEntry:
    return schemas.TaskHistoryEntry(
        id=task.id,
        context_id=task.root_task_id or task.id,
        kind="Follow-up" if task.followup_id else "Initial Lead Task",
        project_name=task.project.name if task.project else ("Manual Lead" if task.manual_lead_data else ""),
        status=task.status,
        consultant=task.assignee.name if task.assignee else "",
        created_by_name=task.creator.name if task.creator else ("System" if task.registration_id else ""),
        stage=task.stage or "",
        customer_problem=task.customer_problem or "",
        executive_remarks=task.executive_remarks or "",
        followup_reason=task.followup_reason or "",
        extra_data=task.followup_extra_data or {},
        lead_data=task.manual_lead_data or {},
        due_date=task.due_date,
        next_following_date=task.next_following_date,
        created_at=task.created_at,
        completed_at=task.completed_at,
    )


def _day_bounds() -> tuple[datetime, datetime]:
    start = datetime.now(BD_TZ).replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + timedelta(days=1)


def _validate_assignment_capacity(
    db: Session,
    user_id: Optional[str],
    additional: int = 1,
    excluding_task_ids: Optional[list[int]] = None,
) -> models.User:
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.role == "executive",
        models.User.is_active.is_(True),
    ).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Communicator পাওয়া যায়নি")
    if user.daily_task_limit is None:
        return user
    start, end = _day_bounds()
    query = db.query(models.Task).filter(
        models.Task.assigned_to == user.id,
        models.Task.assigned_at >= start,
        models.Task.assigned_at < end,
    )
    if excluding_task_ids:
        query = query.filter(~models.Task.id.in_(excluding_task_ids))
    if query.count() + additional > user.daily_task_limit:
        raise HTTPException(
            status_code=400,
            detail=f"{user.name}-এর আজকের task assignment limit ({user.daily_task_limit}) পূর্ণ হয়েছে",
        )
    return user


def _validate_followup_capacity(db: Session, user: models.User) -> None:
    if user.daily_followup_limit is None:
        return
    start, end = _day_bounds()
    completed = db.query(models.Task).filter(
        models.Task.assigned_to == user.id,
        models.Task.customer_id.is_not(None),
        models.Task.completed_at >= start,
        models.Task.completed_at < end,
    ).count()
    if completed >= user.daily_followup_limit:
        raise HTTPException(
            status_code=400,
            detail=f"আজকের follow-up limit ({user.daily_followup_limit}) পূর্ণ হয়েছে",
        )


def _sync_task_to_customer(db: Session, task: models.Task) -> None:
    """Copy only stable personal information to the shared profile."""
    if not task.customer_id:
        return
    customer = db.query(models.Customer).filter(models.Customer.id == task.customer_id).first()
    if customer is None:
        return

    if task.full_name_update:
        customer.full_name = task.full_name_update
    if task.location:
        customer.location = task.location
    if task.profession:
        customer.profession = task.profession
    if task.age:
        customer.age = task.age
    if task.stage:
        customer.stage = task.stage


def _sync_registration_tasks(db: Session):
    try:
        registrations = db.query(models.Registration).all()
        tasks = db.query(models.Task).all()
        existing_reg_ids = {t.registration_id for t in tasks if t.registration_id}

        new_tasks = []
        for reg in registrations:
            if reg.id not in existing_reg_ids:
                lead_name = (reg.data or {}).get("full_name") or (reg.customer.full_name if reg.customer else "") or "Unknown"
                proj_name = reg.project.name if reg.project else "Event"
                task = models.Task(
                    title=f"New registration — {lead_name} ({proj_name})",
                    description=f"Registration ID: {reg.reg_id or reg.id}",
                    assigned_to="",
                    created_by=None,
                    project_id=reg.project_id,
                    registration_id=reg.id,
                    customer_id=reg.customer_id,
                    status="pending",
                )
                new_tasks.append(task)
        if new_tasks:
            db.add_all(new_tasks)
            db.commit()
    except Exception:
        db.rollback()


@router.get("", response_model=list[schemas.TaskOut])
def list_tasks(
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Task).options(
        selectinload(models.Task.assignee),
        selectinload(models.Task.creator),
        selectinload(models.Task.project),
        selectinload(models.Task.registration),
        selectinload(models.Task.customer),
    )
    if current_user.role == "user":
        q = q.filter(
            models.Task.created_by == current_user.id,
            models.Task.title.like("Manual lead —%"),
        )
    elif current_user.role != "admin":
        q = q.filter(models.Task.assigned_to == current_user.id)
    if project_id:
        q = q.filter(models.Task.project_id == project_id)
    if status:
        q = q.filter(models.Task.status == status)
    tasks = q.order_by(models.Task.created_at.desc()).all()
    return [_to_out(t) for t in tasks]

# backend/app/routers/tasks.py — এই endpoint যোগ করুন (list_tasks-এর পরে)

@router.get("/my-todos", response_model=list[schemas.TaskOut])
def my_todos(
    target_date: Optional[date_type] = None,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Executive-এর আজকের To-do list:
    1. Assigned pending tasks (general + lead)
    2. Customers যাদের next_following_date আজ বা আগে
       — এবং সেই customer-এর কোনো open (pending) lead task
         এই executive-এর কাছে আছে
    """
    selected_date = target_date or date_type.today()
    target_user_id = current_user.id
    if user_id and current_user.role == "admin":
        target = db.query(models.User).filter(
            models.User.id == user_id,
            models.User.role == "executive",
        ).first()
        if target is None:
            raise HTTPException(status_code=404, detail="Communicator পাওয়া যায়নি")
        target_user_id = target.id
    effective_date = case(
        (
            models.Task.status == "completed",
            func.date(func.coalesce(models.Task.completed_at, models.Task.created_at)),
        ),
        else_=func.date(func.coalesce(
            models.Task.next_following_date,
            models.Task.due_date,
            models.Task.created_at,
        )),
    )
    q = db.query(models.Task).filter(
        models.Task.assigned_to == target_user_id,
        models.Task.customer_id.is_(None),
        models.Task.registration_id.is_(None),
        models.Task.followup_id.is_(None),
    )

    if selected_date == date_type.today():
        q = q.filter(
            or_(
                effective_date == selected_date,
                and_(effective_date < selected_date, models.Task.status == "pending"),
            )
        )
    else:
        q = q.filter(effective_date == selected_date)

    tasks = q.order_by(
        case((models.Task.status == "completed", 1), else_=0).asc(),
        func.coalesce(models.Task.next_following_date, models.Task.due_date, models.Task.created_at).asc(),
    ).all()
    return [_to_out(task) for task in tasks]


@router.get("/{task_id}/history", response_model=schemas.TaskHistoryDetail)
def task_history(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task পাওয়া যায়নি")
    can_view_own_entry = current_user.role == "user" and task.created_by == current_user.id
    if current_user.role != "admin" and task.assigned_to != current_user.id and not can_view_own_entry:
        raise HTTPException(status_code=403, detail="এই task history দেখার অনুমতি নেই")

    if task.registration_id:
        related = db.query(models.Task).filter(
            models.Task.registration_id == task.registration_id,
            or_(models.Task.status == "completed", models.Task.followup_id.is_not(None)),
        ).order_by(models.Task.created_at.asc()).all()
    elif task.customer_id:
        context_task_id = task.root_task_id or task.id
        related = db.query(models.Task).filter(
            or_(
                models.Task.root_task_id == context_task_id,
                models.Task.id == context_task_id,
            ),
        ).order_by(models.Task.created_at.asc()).all()
    else:
        related = [task]

    return schemas.TaskHistoryDetail(
        task_id=task.id,
        registration_data=_to_out(task).registration_data,
        history=[_history_entry(item) for item in related],
    )


@router.post("", response_model=schemas.TaskOut)
def create_task(
    payload: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assigned_to = payload.assigned_to
    if current_user.role != "admin":
        if assigned_to and assigned_to != current_user.id:
            raise HTTPException(status_code=403, detail="আপনি শুধু নিজের জন্য task তৈরি করতে পারবেন")
        assigned_to = current_user.id  # executives always self-assign their own to-dos

    if assigned_to:
        _validate_assignment_capacity(db, assigned_to)

    if payload.project_id and db.query(models.Project).filter(models.Project.id == payload.project_id).first() is None:
        raise HTTPException(status_code=404, detail="Project পাওয়া যায়নি")

    if payload.registration_id and db.query(models.Registration).filter(models.Registration.id == payload.registration_id).first() is None:
        raise HTTPException(status_code=404, detail="Registration পাওয়া যায়নি")

    if payload.customer_id and db.query(models.Customer).filter(models.Customer.id == payload.customer_id).first() is None:
        raise HTTPException(status_code=404, detail="Client পাওয়া যায়নি")

    task = models.Task(
        title=payload.title,
        description=payload.description,
        assigned_to=assigned_to,
        created_by=current_user.id,
        project_id=payload.project_id,
        registration_id=payload.registration_id,
        customer_id=payload.customer_id,
        due_date=payload.due_date,
        assigned_at=datetime.now(BD_TZ) if assigned_to else None,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    if assigned_to:
        notify(db, assigned_to, f'New task assigned: "{task.title}"', "task_assigned", "/admin/tasks")
        db.commit()

    return _to_out(task)


@router.post("/manual-lead", response_model=schemas.TaskOut)
def create_manual_lead(
    payload: schemas.ManualLeadCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in {"admin", "user"} and not current_user.can_manual_lead_entry:
        raise HTTPException(status_code=403, detail="Manual Lead Entry permission নেই")

    cleaned = {
        str(key).strip(): value
        for key, value in payload.data.items()
        if str(key).strip()
    }
    full_name = str(cleaned.get("full_name") or "").strip()
    if not full_name:
        raise HTTPException(status_code=400, detail='"Name" ফিল্ডটি আবশ্যক')
    mobile = str(cleaned.get("mobile") or "").strip()
    if not mobile:
        raise HTTPException(status_code=400, detail='"Phone Number" ফিল্ডটি আবশ্যক')

    from .public import _find_or_create_customer

    customer = _find_or_create_customer(db, cleaned)
    if customer is None:
        customer = models.Customer(full_name=full_name)
        db.add(customer)
        db.flush()
    if cleaned.get("location"):
        customer.location = str(cleaned["location"])

    lead_name = full_name
    task = models.Task(
        title=f"Manual lead — {lead_name}",
        description="Manually entered lead",
        assigned_to=None,
        created_by=current_user.id,
        project_id=None,
        registration_id=None,
        customer_id=customer.id,
        manual_lead_data=cleaned,
        status="pending",
    )
    db.add(task)
    db.flush()
    task.root_task_id = task.id
    db.commit()
    db.refresh(task)
    return _to_out(task)


@router.get("/executive-workload", dependencies=[Depends(require_admin)])
def executive_workload(db: Session = Depends(get_db)):
    from datetime import timedelta
    executives = db.query(models.User).filter(
        models.User.role == "executive", models.User.is_active == True
    ).all()
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    aggregate_rows = db.query(
        models.Task.assigned_to,
        func.sum(case((models.Task.status == "pending", 1), else_=0)).label("pending"),
        func.sum(case((and_(models.Task.status == "pending", or_(models.Task.followup_id.is_not(None), models.Task.due_date.is_not(None))), 1), else_=0)).label("pending_followups"),
        func.sum(case((and_(models.Task.status == "completed", models.Task.completed_at >= thirty_days_ago), 1), else_=0)).label("completed_last_30"),
    ).filter(models.Task.assigned_to.is_not(None)).group_by(models.Task.assigned_to).all()
    aggregates = {row.assigned_to: row for row in aggregate_rows}
    result = []
    for e in executives:
        stats = aggregates.get(e.id)
        result.append({
            "user_id": e.id,
            "name": e.name,
            "completed_last_30_days": int(stats.completed_last_30 or 0) if stats else 0,
            "pending": int(stats.pending or 0) if stats else 0,
            "pending_followups": int(stats.pending_followups or 0) if stats else 0,
            "daily_task_limit": e.daily_task_limit,
            "daily_followup_limit": e.daily_followup_limit,
        })
    return result

@router.patch("/bulk-assign", response_model=list[schemas.TaskOut], dependencies=[Depends(require_admin)])
def bulk_assign_tasks(payload: schemas.BulkAssignRequest, db: Session = Depends(get_db)):
    if not payload.task_ids:
        raise HTTPException(status_code=400, detail="অন্তত একটি task নির্বাচন করুন")

    tasks = db.query(models.Task).filter(models.Task.id.in_(payload.task_ids)).all()
    if len(tasks) != len(set(payload.task_ids)):
        raise HTTPException(status_code=404, detail="কিছু task পাওয়া যায়নি")
    newly_assigned = [task for task in tasks if task.assigned_to != payload.assigned_to]
    _validate_assignment_capacity(
        db,
        payload.assigned_to,
        len(newly_assigned),
        [task.id for task in tasks],
    )

    for task in tasks:
        if task.assigned_to != payload.assigned_to:
            task.assigned_at = datetime.now(BD_TZ)
        task.assigned_to = payload.assigned_to
        if payload.assigned_to:
            notify(db, payload.assigned_to, f'New task assigned: "{task.title}"', "task_assigned", "/admin/tasks")
    db.commit()
    for task in tasks:
        db.refresh(task)
    return [_to_out(t) for t in tasks]


@router.post("/bulk-delete", dependencies=[Depends(require_admin)])
def bulk_delete_tasks(payload: schemas.BulkDeleteTasksRequest, db: Session = Depends(get_db)):
    task_ids = list(set(payload.task_ids))
    if not task_ids:
        raise HTTPException(status_code=400, detail="অন্তত একটি task নির্বাচন করুন")
    tasks = db.query(models.Task).filter(models.Task.id.in_(task_ids)).all()
    if len(tasks) != len(task_ids):
        raise HTTPException(status_code=404, detail="কিছু task পাওয়া যায়নি")
    for task in tasks:
        db.delete(task)
    db.commit()
    return {"ok": True, "deleted_count": len(tasks)}

@router.patch("/{task_id}", response_model=schemas.TaskOut)
def update_task(
    task_id: int,
    payload: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task পাওয়া যায়নি")

    is_owner = task.assigned_to == current_user.id
    if current_user.role != "admin" and not is_owner:
        raise HTTPException(status_code=403, detail="এই task পরিবর্তন করার অনুমতি আপনার নেই")

    data = payload.model_dump(exclude_unset=True)
    if current_user.role != "admin":
        data = {k: v for k, v in data.items() if k in ASSIGNEE_EDITABLE_FIELDS}

    if "assigned_to" in data:
        new_assignee = data["assigned_to"]
        if new_assignee and new_assignee != task.assigned_to:
            _validate_assignment_capacity(db, new_assignee)
            task.assigned_at = datetime.now(BD_TZ)
        elif not new_assignee:
            task.assigned_at = None
        if new_assignee and new_assignee != task.assigned_to:
            notify(db, new_assignee, f'New task assigned: "{task.title}"', "task_assigned", "/admin/tasks")
            db.commit()
        data["assigned_to"] = new_assignee


    if "stage" in data and data["stage"] and data["stage"] not in schemas.STAGE_OPTIONS:
        raise HTTPException(status_code=400, detail="Stage অবশ্যই তালিকাভুক্ত মানগুলোর একটি হতে হবে")

    call_received = data.pop("call_received", None)

    if task.customer_id and data.get("status") == "completed":
        stage = str(data.get("stage", task.stage) or "").strip()
        if not stage:
            raise HTTPException(
                status_code=400,
                detail="Task complete করতে Stage পূরণ করুন",
            )
    next_followup_date = data.get("next_following_date")
    followup_note = str(data.get("followup_reason", task.followup_reason) or "").strip()
    if next_followup_date and data.get("status") == "completed" and not followup_note:
        raise HTTPException(
            status_code=400,
            detail="পরবর্তী Follow-up date দিলে কেন Follow-up করবেন সেই note লিখুন",
        )

    became_completed = False
    if "status" in data:
        if data["status"] not in ("pending", "completed"):
            raise HTTPException(status_code=400, detail="status অবশ্যই pending অথবা completed হতে হবে")
        became_completed = data["status"] == "completed" and task.status != "completed"
        if became_completed and current_user.role != "admin":
            _validate_followup_capacity(db, current_user)
        task.status = data["status"] # This line was already present
        task.completed_at = datetime.now(BD_TZ) if data["status"] == "completed" else None # Changed from datetime.utcnow()
        data.pop("status")

    for field, value in data.items():
        setattr(task, field, value)

    if became_completed:
        _sync_task_to_customer(db, task)
        if call_received is not None:
            phone_number = task.customer.mobile if task.customer else ""
            db.add(models.CallLog(
                task_id=task.id,
                customer_id=task.customer_id,
                executive_id=current_user.id,
                phone_number=phone_number or "",
                received=call_received,
                notes=task.executive_remarks or "",
            ))
        if task.followup_id:
            followup = db.query(models.CustomerFollowUp).filter(
                models.CustomerFollowUp.id == task.followup_id
            ).first()
            if followup:
                followup.completed = True
                followup.completed_at = task.completed_at
                followup.result = task.executive_remarks or followup.result
                followup.stage = task.stage or followup.stage
        if task.customer_id and task.next_following_date:
            next_followup = models.CustomerFollowUp(
                customer_id=task.customer_id,
                assigned_to=task.assigned_to,
                created_by=current_user.id,
                scheduled_at=task.next_following_date,
                note=task.followup_reason or task.customer_problem or task.executive_remarks or "Next follow-up",
                stage=task.stage or "",
            )
            db.add(next_followup)
            db.flush()
            db.add(models.Task(
                title=f"Follow-up — {task.customer.full_name if task.customer else 'Client'}",
                description=next_followup.note,
                assigned_to=task.assigned_to,
                assigned_at=datetime.now(BD_TZ),
                created_by=current_user.id,
                project_id=task.project_id,
                registration_id=task.registration_id,
                customer_id=task.customer_id,
                followup_id=next_followup.id,
                root_task_id=task.root_task_id or task.id,
                due_date=next_followup.scheduled_at,
                stage=next_followup.stage,
                status="pending",
            ))

    db.commit()
    db.refresh(task)
    return _to_out(task)


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task পাওয়া যায়নি")
    if current_user.role == "user":
        raise HTTPException(status_code=403, detail="Manual entry মুছে ফেলার অনুমতি নেই")
    if current_user.role != "admin" and task.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="এই task মুছে ফেলার অনুমতি আপনার নেই")
    db.delete(task)
    db.commit()
    return {"ok": True}
