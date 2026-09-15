from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import String, case, cast, exists, func, or_
from sqlalchemy.orm import Session

from .. import models
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/followups", tags=["followups"])


def _normalize_profile_key(key: object) -> str:
    return "".join(character for character in str(key).lower() if character.isalnum())


def _profile_value(profile: dict, *aliases: str):
    normalized = {
        _normalize_profile_key(key): value
        for key, value in profile.items()
        if value not in (None, "")
    }
    for alias in aliases:
        value = normalized.get(_normalize_profile_key(alias))
        if value not in (None, ""):
            return value
    return ""


def _profile_age(profile: dict):
    value = _profile_value(profile, "age", "client_age", "বয়স", "বয়স")
    if value in (None, ""):
        return None
    try:
        return int(float(str(value).strip()))
    except (TypeError, ValueError):
        return str(value)


@router.get("")
def list_all_followups(
    q: str = "",
    stage: str = "",
    profession: str = "",
    location: str = "",
    age: Optional[int] = None,
    date_of_birth: str = "",
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    assigned_to: str = "",
    completed: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in {"admin", "executive"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Follow-up access required")

    query = db.query(models.CustomerFollowUp).join(models.Customer)
    if current_user.role == "executive":
        query = query.filter(models.CustomerFollowUp.assigned_to == current_user.id)
    elif assigned_to:
        query = query.filter(models.CustomerFollowUp.assigned_to == assigned_to)
    if stage:
        query = query.filter(models.CustomerFollowUp.stage == stage)
    if profession:
        query = query.filter(models.Customer.profession.ilike(f"%{profession.strip()}%"))
    if location:
        query = query.filter(models.Customer.location.ilike(f"%{location.strip()}%"))
    if age is not None:
        query = query.filter(models.Customer.age == age)
    if completed is not None:
        query = query.filter(models.CustomerFollowUp.completed == completed)
    if date_from:
        query = query.filter(models.CustomerFollowUp.scheduled_at >= date_from)
    if date_to:
        query = query.filter(models.CustomerFollowUp.scheduled_at < datetime.combine(date_to, datetime.min.time()) + timedelta(days=1))
    if date_of_birth:
        dob_like = f"%{date_of_birth.strip()}%"
        query = query.filter(or_(
            cast(models.Customer.extra_data, String).ilike(dob_like),
            exists().where(
                models.Registration.customer_id == models.Customer.id,
                cast(models.Registration.data, String).ilike(dob_like),
            ),
            exists().where(
                models.ArchivedLead.customer_id == models.Customer.id,
                cast(models.ArchivedLead.data, String).ilike(dob_like),
            ),
        ))
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(
            models.Customer.full_name.ilike(like),
            models.Customer.mobile.ilike(like),
            models.Customer.email.ilike(like),
            models.Customer.location.ilike(like),
            models.Customer.profession.ilike(like),
            models.Customer.stage.ilike(like),
            models.Customer.customer_problem.ilike(like),
            models.Customer.executive_remarks.ilike(like),
            cast(models.Customer.age, String).ilike(like),
            cast(models.Customer.extra_data, String).ilike(like),
            models.CustomerFollowUp.note.ilike(like),
            models.CustomerFollowUp.result.ilike(like),
            models.CustomerFollowUp.stage.ilike(like),
            exists().where(
                models.User.id == models.CustomerFollowUp.assigned_to,
                models.User.name.ilike(like),
            ),
            exists().where(
                models.Registration.customer_id == models.Customer.id,
                cast(models.Registration.data, String).ilike(like),
            ),
            exists().where(
                models.ArchivedLead.customer_id == models.Customer.id,
                cast(models.ArchivedLead.data, String).ilike(like),
            ),
        ))

    today_first = case(
        (func.date(models.CustomerFollowUp.scheduled_at) == date.today(), 0),
        else_=1,
    )
    rows = query.order_by(
        today_first.asc(),
        models.CustomerFollowUp.completed.asc(),
        models.CustomerFollowUp.created_at.desc(),
        models.CustomerFollowUp.scheduled_at.desc(),
    ).limit(5000).all()
    output = []
    for item in rows:
        customer = item.customer
        linked_task = db.query(models.Task).filter(
            models.Task.followup_id == item.id
        ).order_by(models.Task.created_at.desc()).first()
        source_data = {}
        root_task = None
        if linked_task and linked_task.registration:
            source_data = dict(linked_task.registration.data or {})
        elif linked_task and linked_task.root_task_id:
            root_task = db.query(models.Task).filter(
                models.Task.id == linked_task.root_task_id
            ).first()
            source_data = dict((root_task.manual_lead_data if root_task else None) or {})
        merged_profile = {**(customer.extra_data or {}), **source_data}
        date_of_birth = _profile_value(
            merged_profile, "date_of_birth", "dob", "birth_date", "জন্ম তারিখ"
        )
        profession = customer.profession or _profile_value(
            merged_profile, "profession", "occupation", "পেশা"
        )
        customer_problem = (
            (linked_task.customer_problem if linked_task else "")
            or (root_task.customer_problem if root_task else "")
            or ""
        )
        executive_remarks = (
            (linked_task.executive_remarks if linked_task else "")
            or item.result
            or ""
        )
        output.append({
            "id": item.id,
            "customer_id": customer.id,
            "name": customer.full_name or "",
            "mobile": customer.mobile or "",
            "email": customer.email or "",
            "profile_image_url": customer.profile_image_url or "",
            "profession": str(profession or ""),
            "location": customer.location or "",
            "age": customer.age if customer.age is not None else _profile_age(merged_profile),
            "date_of_birth": str(date_of_birth or ""),
            "customer_problem": str(customer_problem or ""),
            "executive_remarks": str(executive_remarks or ""),
            "stage": item.stage or customer.stage or "",
            "scheduled_at": item.scheduled_at,
            "note": item.note or "",
            "result": item.result or "",
            "completed": bool(item.completed),
            "completed_at": item.completed_at,
            "assigned_to": item.assigned_to,
            "consultant": item.assignee.name if item.assignee else "",
            "consultant_image_url": item.assignee.profile_image_url if item.assignee else "",
            "profile_data": merged_profile,
            "created_at": item.created_at,
        })

    return output
