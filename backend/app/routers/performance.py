# backend/app/routers/performance.py — new file
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, require_admin
from ..database import get_db

router = APIRouter(prefix="/api/performance", tags=["performance"])

DEFAULT_POINT_RULES = {
    "comm_success": 2, "interested": 3, "wants_to_join": 5, "joined": 10,
    "graduated": 20, "followup_on_time": 3, "profile_update": 1,
    "missed_followup": -2,
}


def _idle_timeout_minutes(db: Session) -> int:
    return 10


def _point_rules(db: Session) -> dict:
    rows = db.query(models.AppSetting).filter(models.AppSetting.category == "performance_points").all()
    rules = dict(DEFAULT_POINT_RULES)
    for r in rows:
        if r.key not in rules:
            continue
        try:
            rules[r.key] = float(r.value)
        except (ValueError, TypeError):
            pass
    return rules


def _period_bounds(period: str, start: Optional[datetime], end: Optional[datetime]):
    now = datetime.utcnow()
    if period == "custom" and start and end:
        return start, end
    if period == "daily":
        s = datetime(now.year, now.month, now.day)
        return s, s + timedelta(days=1)
    if period == "weekly":
        s = now - timedelta(days=now.weekday())
        s = datetime(s.year, s.month, s.day)
        return s, s + timedelta(days=7)
    if period == "yearly":
        return datetime(now.year, 1, 1), datetime(now.year + 1, 1, 1)
    s = datetime(now.year, now.month, 1)
    nxt_month = now.month + 1 if now.month < 12 else 1
    nxt_year = now.year if now.month < 12 else now.year + 1
    return s, datetime(nxt_year, nxt_month, 1)


def _safe_div(n, d):
    return round((n / d) * 100, 1) if d else 0.0


# ── Session tracking ──

@router.post("/session/start", response_model=schemas.SessionStartOut)
def start_session(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "executive":
        raise HTTPException(403, "Performance session শুধু communicator account-এর জন্য")

    now = datetime.utcnow()
    idle_timeout = _idle_timeout_minutes(db)
    open_session = (
        db.query(models.ExecutiveSession)
        .filter(
            models.ExecutiveSession.user_id == current_user.id,
            models.ExecutiveSession.logout_at.is_(None),
        )
        .order_by(models.ExecutiveSession.id.desc())
        .first()
    )
    if open_session is not None:
        last_seen = open_session.last_heartbeat_at or open_session.login_at
        if now - last_seen <= timedelta(minutes=idle_timeout):
            open_session.last_heartbeat_at = now
            db.commit()
            return schemas.SessionStartOut(session_id=open_session.id, status="online")
        open_session.logout_at = last_seen

    session = models.ExecutiveSession(user_id=current_user.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return schemas.SessionStartOut(session_id=session.id, status="online")


@router.post("/session/{session_id}/heartbeat")
def heartbeat(session_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    s = db.query(models.ExecutiveSession).filter(
        models.ExecutiveSession.id == session_id,
        models.ExecutiveSession.user_id == current_user.id,
        models.ExecutiveSession.logout_at.is_(None),
    ).first()
    if s is None:
        raise HTTPException(404, "Session পাওয়া যায়নি")
    now = datetime.utcnow()
    last_seen = s.last_heartbeat_at or s.login_at
    interaction_gap = max(0.0, (now - last_seen).total_seconds() / 60)
    if interaction_gap <= _idle_timeout_minutes(db):
        s.proper_work_minutes = float(s.proper_work_minutes or 0) + interaction_gap
    s.last_heartbeat_at = now
    db.commit()
    return {"ok": True, "session_id": s.id, "status": "online"}


@router.post("/session/{session_id}/end")
def end_session(session_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    s = db.query(models.ExecutiveSession).filter(
        models.ExecutiveSession.id == session_id,
        models.ExecutiveSession.user_id == current_user.id,
        models.ExecutiveSession.logout_at.is_(None),
    ).first()
    if s is None:
        raise HTTPException(404, "Session পাওয়া যায়নি")
    s.logout_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


# ── Activity logging ──

@router.post("/activity")
def log_activity(
    payload: schemas.ActivityLogCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    last_session = (
        db.query(models.ExecutiveSession)
        .filter(models.ExecutiveSession.user_id == current_user.id)
        .order_by(models.ExecutiveSession.id.desc())
        .first()
    )
    log = models.ExecutiveActivityLog(
        user_id=current_user.id,
        session_id=last_session.id if last_session else None,
        activity_type=payload.activity_type,
        customer_id=payload.customer_id,
        project_id=payload.project_id,
        details=payload.details,
        ip_address=request.client.host if request.client else "",
    )
    db.add(log)
    if last_session:
        last_session.last_heartbeat_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


# ── Communications ──

@router.post("/communications", response_model=schemas.CommunicationOut)
def create_communication(
    payload: schemas.CommunicationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if db.query(models.Customer).filter(models.Customer.id == payload.customer_id).first() is None:
        raise HTTPException(404, "Client পাওয়া যায়নি")

    comm_at = payload.communication_at or datetime.utcnow()
    dup = (
        db.query(models.CustomerCommunication)
        .filter(
            models.CustomerCommunication.executive_id == current_user.id,
            models.CustomerCommunication.customer_id == payload.customer_id,
            models.CustomerCommunication.communication_at == comm_at,
        )
        .first()
    )
    if dup:
        raise HTTPException(400, "একই সময়ে একই customer-এর জন্য ইতিমধ্যে entry আছে (duplicate)")

    record = models.CustomerCommunication(executive_id=current_user.id, **{**payload.model_dump(), "communication_at": comm_at})
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/communications", response_model=list[schemas.CommunicationOut])
def list_communications(
    customer_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.CustomerCommunication)
    if current_user.role != "admin":
        q = q.filter(models.CustomerCommunication.executive_id == current_user.id)
    if customer_id:
        q = q.filter(models.CustomerCommunication.customer_id == customer_id)
    return q.order_by(models.CustomerCommunication.communication_at.desc()).limit(200).all()


# ── Summary / score computation ──

def _compute_summary(db: Session, user: models.User, start: datetime, end: datetime) -> schemas.PerformanceSummary:
    idle_timeout = _idle_timeout_minutes(db)
    rules = _point_rules(db)

    sessions = db.query(models.ExecutiveSession).filter(
        models.ExecutiveSession.user_id == user.id,
        models.ExecutiveSession.login_at < end,
        or_(models.ExecutiveSession.logout_at.is_(None), models.ExecutiveSession.logout_at >= start),
    ).all()

    active_minutes = 0.0
    proper_work_minutes = 0.0
    idle_minutes = 0.0
    last_active = None
    for s in sessions:
        session_start = max(s.login_at, start)
        end_time = min(s.logout_at or datetime.utcnow(), end)
        duration = max(0.0, (end_time - session_start).total_seconds() / 60)
        active_minutes += duration
        proper_work_minutes += float(s.proper_work_minutes or 0)
        session_last_active = s.logout_at or s.last_heartbeat_at or s.login_at
        if not last_active or session_last_active > last_active:
            last_active = session_last_active

    now = datetime.utcnow()
    latest_session = db.query(models.ExecutiveSession).filter(models.ExecutiveSession.user_id == user.id).order_by(
        models.ExecutiveSession.id.desc()
    ).first()
    if latest_session and latest_session.logout_at is None:
        gap = (now - (latest_session.last_heartbeat_at or latest_session.login_at)).total_seconds() / 60
        if gap <= idle_timeout:
            status = "online"
        elif gap <= idle_timeout * 2:
            status = "idle"
        else:
            status = "offline"
    else:
        status = "offline"
    if latest_session:
        latest_seen = latest_session.logout_at or latest_session.last_heartbeat_at or latest_session.login_at
        if not last_active or latest_seen > last_active:
            last_active = latest_seen

    comms = db.query(models.CustomerCommunication).filter(
        models.CustomerCommunication.executive_id == user.id,
        models.CustomerCommunication.communication_at >= start,
        models.CustomerCommunication.communication_at < end,
    ).all()

    total_attempts = len(comms)
    unique_contacted = len(set(c.customer_id for c in comms))
    outcome_counts = {}
    total_duration = 0
    for c in comms:
        outcome_counts[c.outcome] = outcome_counts.get(c.outcome, 0) + 1
        total_duration += c.duration_minutes or 0

    interested = outcome_counts.get("interested", 0)
    not_interested = outcome_counts.get("not_interested", 0)
    wants_to_join = outcome_counts.get("wants_to_join", 0)
    no_response = outcome_counts.get("no_response", 0)
    followup_required = outcome_counts.get("followup_required", 0)
    joined = sum(1 for c in comms if c.joined_program)
    graduated = sum(1 for c in comms if c.graduated)
    followups_due = [c for c in comms if c.follow_up_date]
    followups_done = sum(1 for c in followups_due if c.followup_completed)

    completed_tasks = db.query(models.Task).filter(
        models.Task.assigned_to == user.id, models.Task.status == "completed",
        models.Task.completed_at >= start, models.Task.completed_at < end,
    ).count()

    points = (
        (total_attempts - no_response) * rules["comm_success"]
        + interested * rules["interested"]
        + wants_to_join * rules["wants_to_join"]
        + joined * rules["joined"]
        + graduated * rules["graduated"]
        + followups_done * rules["followup_on_time"]
    )
    missed_followups = sum(1 for c in followups_due if not c.followup_completed and c.follow_up_date < now)
    points += missed_followups * rules["missed_followup"]

    active_hours = round(active_minutes / 60, 2)
    productive_hours = round(proper_work_minutes / 60, 2)
    followup_rate = _safe_div(followups_done, len(followups_due))
    interest_rate = _safe_div(interested, total_attempts)
    join_rate = _safe_div(joined, interested) if interested else 0.0
    grad_rate = _safe_div(graduated, joined) if joined else 0.0
    response_rate = _safe_div(total_attempts - no_response, total_attempts)

    score = (
        min(active_hours / 8, 1) * 15
        + min(total_attempts / 20, 1) * 15
        + (interest_rate / 100) * 20
        + (join_rate / 100) * 20
        + (followup_rate / 100) * 20
        + min(completed_tasks / 10, 1) * 10
    )
    score = max(0.0, min(100.0, round(score, 1)))
    category = (
        "Excellent" if score >= 90 else "Very Good" if score >= 75 else
        "Good" if score >= 60 else "Needs Improvement" if score >= 40 else "Poor"
    )

    return schemas.PerformanceSummary(
        user_id=user.id, name=user.name, status=status, last_active=last_active,
        active_hours=active_hours, productive_hours=productive_hours,
        idle_hours=round(idle_minutes / 60, 2),
        total_contacted=total_attempts, unique_contacted=unique_contacted,
        interested=interested, not_interested=not_interested, wants_to_join=wants_to_join,
        no_response=no_response, followup_required=followup_required, joined=joined, graduated=graduated,
        total_attempts=total_attempts, avg_duration_minutes=round(total_duration / total_attempts, 1) if total_attempts else 0.0,
        followup_completion_rate=followup_rate, interest_conversion_rate=interest_rate,
        join_conversion_rate=join_rate, graduation_conversion_rate=grad_rate, response_rate=response_rate,
        total_points=round(points, 1), performance_score=score, performance_category=category,
        completed_tasks=completed_tasks,
    )


@router.get("/summary", response_model=schemas.PerformanceSummary)
def get_summary(
    period: str = "monthly",
    user_id: Optional[str] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    target_id = user_id if (user_id and current_user.role == "admin") else current_user.id
    user = db.query(models.User).filter(models.User.id == target_id).first()
    if user is None:
        raise HTTPException(404, "User পাওয়া যায়নি")
    s, e = _period_bounds(period, start, end)
    return _compute_summary(db, user, s, e)


@router.get("/trend")
def get_performance_trend(
    days: int = 7,
    user_id: Optional[str] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    target_id = user_id if (user_id and current_user.role == "admin") else current_user.id
    user = db.query(models.User).filter(models.User.id == target_id).first()
    if user is None:
        raise HTTPException(404, "User পাওয়া যায়নি")

    if start and end:
        first_day = start.replace(hour=0, minute=0, second=0, microsecond=0)
        requested_days = max(1, (end.date() - first_day.date()).days)
        days = min(requested_days, 366)
    else:
        days = max(1, min(days, 31))
        first_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
    trend = []
    for offset in range(days):
        day_start = first_day + timedelta(days=offset)
        if end and day_start >= end:
            break
        day_end = min(day_start + timedelta(days=1), end) if end else day_start + timedelta(days=1)
        summary = _compute_summary(db, user, day_start, day_end)
        trend.append({
            "date": day_start.date().isoformat(),
            "day_label": day_start.strftime("%a"),
            "active_hours": summary.active_hours,
            "productive_hours": summary.productive_hours,
            "score": summary.performance_score,
            "points": summary.total_points,
            "communications": summary.total_contacted,
            "completed_tasks": summary.completed_tasks,
        })
    return trend


@router.get("/leaderboard", response_model=list[schemas.PerformanceSummary], dependencies=[Depends(require_admin)])
def leaderboard(
    period: str = "monthly",
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    execs = db.query(models.User).filter(models.User.role == "executive", models.User.is_active.is_(True)).all()
    s, e = _period_bounds(period, start, end)
    return [_compute_summary(db, u, s, e) for u in execs]


@router.get("/stage-breakdown")
def stage_breakdown(
    period: str = "daily",
    user_id: Optional[str] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if period not in {"daily", "weekly", "monthly", "yearly", "custom"}:
        raise HTTPException(400, "সঠিক period নির্বাচন করুন")
    target_id = user_id if current_user.role == "admin" and user_id else (
        None if current_user.role == "admin" else current_user.id
    )
    s, e = _period_bounds(period, start, end)
    target_period = period
    if period == "custom":
        span_days = max(1, (e.date() - s.date()).days)
        target_period = "daily" if span_days == 1 else "weekly" if span_days <= 7 else "monthly" if span_days <= 31 else "yearly"
    query = db.query(models.Task.stage, func.count(models.Task.id)).filter(
        models.Task.status == "completed",
        models.Task.completed_at >= s,
        models.Task.completed_at < e,
        models.Task.stage.is_not(None),
        models.Task.stage != "",
    )
    if target_id:
        query = query.filter(models.Task.assigned_to == target_id)
    else:
        query = query.join(models.User, models.Task.assigned_to == models.User.id).filter(
            models.User.role == "executive"
        )
    counts = dict(query.group_by(models.Task.stage).all())
    history_query = db.query(models.Task.completed_at, models.Task.stage).filter(
        models.Task.status == "completed",
        models.Task.completed_at >= s,
        models.Task.completed_at < e,
        models.Task.stage.is_not(None),
        models.Task.stage != "",
    )
    if target_id:
        history_query = history_query.filter(models.Task.assigned_to == target_id)
    else:
        history_query = history_query.join(models.User, models.Task.assigned_to == models.User.id).filter(
            models.User.role == "executive"
        )
    daily_counts: dict[str, dict[str, int]] = {}
    for completed_at, stage in history_query.all():
        date_key = completed_at.date().isoformat()
        daily_counts.setdefault(date_key, {})
        daily_counts[date_key][stage] = daily_counts[date_key].get(stage, 0) + 1
    dates = []
    cursor = s
    while cursor < e and len(dates) < 366:
        dates.append(cursor.date().isoformat())
        cursor += timedelta(days=1)

    users = (
        db.query(models.User).filter(models.User.id == target_id).all()
        if target_id else
        db.query(models.User).filter(models.User.role == "executive", models.User.is_active.is_(True)).all()
    )
    points_earned = sum(_compute_summary(db, user, s, e).total_points for user in users)
    point_targets = db.query(models.ExecutiveTarget).filter(
        models.ExecutiveTarget.user_id.in_([user.id for user in users]),
        models.ExecutiveTarget.period == target_period,
    ).all() if users else []
    points_possible = sum(target.point_target for target in point_targets if target.point_target > 0)
    if points_possible <= 0:
        points_possible = 100 * max(1, len(users))

    return {
        "period": target_period,
        "start": s,
        "end": e,
        "total_clients": sum(counts.values()),
        "consultant_count": len(users),
        "aggregation": "total" if target_id is None else "individual",
        "stages": [
            {
                "stage": stage,
                "count": int(counts.get(stage, 0)),
            }
            for stage in schemas.STAGE_OPTIONS
        ],
        "dates": dates,
        "series": [
            {
                "stage": stage,
                "values": [daily_counts.get(date_key, {}).get(stage, 0) for date_key in dates],
            }
            for stage in schemas.STAGE_OPTIONS
        ],
        "points_earned": round(points_earned, 1),
        "points_possible": points_possible,
    }


# ── Point rules (reuses AppSetting) ──

@router.get("/point-rules")
def get_point_rules(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rules = _point_rules(db)
    return [{"key": k, "points": v} for k, v in rules.items()]


@router.put("/point-rules", dependencies=[Depends(require_admin)])
def set_point_rules(payload: list[dict], db: Session = Depends(get_db)):
    for item in payload:
        if item.get("key") not in DEFAULT_POINT_RULES:
            continue
        row = db.query(models.AppSetting).filter(models.AppSetting.key == item["key"]).first()
        if row is None:
            row = models.AppSetting(key=item["key"], label=item["key"], category="performance_points", value=str(item["points"]))
            db.add(row)
        else:
            row.value = str(item["points"])
    db.commit()
    return {"ok": True}


# ── Targets ──

@router.put("/targets/{user_id}", response_model=schemas.TargetOut, dependencies=[Depends(require_admin)])
def set_target(user_id: str, payload: schemas.TargetIn, db: Session = Depends(get_db)):
    row = db.query(models.ExecutiveTarget).filter(
        models.ExecutiveTarget.user_id == user_id, models.ExecutiveTarget.period == payload.period
    ).first()
    if row is None:
        row = models.ExecutiveTarget(user_id=user_id, **payload.model_dump())
        db.add(row)
    else:
        for f, v in payload.model_dump().items():
            setattr(row, f, v)
    db.commit()
    db.refresh(row)
    return row


@router.get("/targets/{user_id}", response_model=list[schemas.TargetOut])
def get_targets(user_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(403, "অনুমতি নেই")
    return db.query(models.ExecutiveTarget).filter(models.ExecutiveTarget.user_id == user_id).all()


# ── Admin feedback ──

@router.post("/feedback/{user_id}", response_model=schemas.FeedbackOut, dependencies=[Depends(require_admin)])
def give_feedback(user_id: str, payload: schemas.FeedbackIn, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    row = models.AdminPerformanceFeedback(executive_id=user_id, admin_id=current_user.id, feedback=payload.feedback)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/feedback/{user_id}", response_model=list[schemas.FeedbackOut])
def list_feedback(user_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(403, "অনুমতি নেই")
    return db.query(models.AdminPerformanceFeedback).filter(models.AdminPerformanceFeedback.executive_id == user_id).order_by(
        models.AdminPerformanceFeedback.created_at.desc()
    ).all()
