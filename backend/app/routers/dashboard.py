from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional

from .. import models, schemas
from ..auth import get_current_user, require_admin
from ..database import get_db
from ..models import BD_TZ 
from ..reporting import task_stage_summary
router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(require_admin)])


def _day_bounds(dt: datetime):
    # start = datetime(dt.year, dt.month, dt.day)
    start = dt.replace(hour=0, minute=0, second=0, microsecond=0) 
    return start, start + timedelta(days=1)


def _registration_counts_by_project(db: Session, start=None, end=None) -> dict:
    q = db.query(models.Registration.project_id, func.count(models.Registration.id))
    if start is not None:
        q = q.filter(models.Registration.created_at >= start, models.Registration.created_at < end)
    return dict(q.group_by(models.Registration.project_id).all())


def _daily_lead_breakdown(db: Session, start: datetime, end: datetime) -> schemas.DailyLeadBreakdown:
    source_counts: dict[str, int] = {}
    stage_counts: dict[str, int] = {}

    def add(source: str, stage: str) -> None:
        source_name = source.strip() or "Unknown Source"
        stage_name = stage.strip() or "Stage Not Set"
        source_counts[source_name] = source_counts.get(source_name, 0) + 1
        stage_counts[stage_name] = stage_counts.get(stage_name, 0) + 1

    registrations = db.query(models.Registration).filter(
        models.Registration.created_at >= start,
        models.Registration.created_at < end,
    ).all()
    for registration in registrations:
        registration_task = db.query(models.Task).filter(
            models.Task.registration_id == registration.id,
            models.Task.stage != "",
        ).order_by(models.Task.created_at.desc()).first()
        add(
            registration.project.name if registration.project else "Event",
            registration_task.stage if registration_task else str((registration.data or {}).get("stage") or ""),
        )

    archived = db.query(models.ArchivedLead).filter(
        models.ArchivedLead.registered_at >= start,
        models.ArchivedLead.registered_at < end,
    ).all()
    for lead in archived:
        add(lead.event_name or "Deleted Event", str((lead.data or {}).get("stage") or ""))

    manual_tasks = db.query(models.Task).filter(
        models.Task.created_at >= start,
        models.Task.created_at < end,
        models.Task.manual_lead_data.is_not(None),
    ).all()
    for task in manual_tasks:
        if task.manual_lead_data:
            add("Manual Entry", task.stage or str((task.manual_lead_data or {}).get("stage") or ""))

    return schemas.DailyLeadBreakdown(
        date=start.date().isoformat(),
        total=sum(source_counts.values()),
        sources=[schemas.LeadBreakdownItem(name=name, count=count) for name, count in sorted(source_counts.items(), key=lambda item: (-item[1], item[0]))],
        stages=[schemas.LeadBreakdownItem(name=name, count=count) for name, count in sorted(stage_counts.items(), key=lambda item: (-item[1], item[0]))],
    )


@router.get("/overview", response_model=schemas.DashboardOverview)
def overview(report_date: Optional[str] = None, db: Session = Depends(get_db)):
    now = datetime.now(BD_TZ) 
    today_start, today_end = _day_bounds(now)
    yesterday_start, yesterday_end = _day_bounds(now - timedelta(days=1))

    yesterday_counts = _registration_counts_by_project(db, yesterday_start, yesterday_end)
    today_counts = _registration_counts_by_project(db, today_start, today_end)
    total_counts = _registration_counts_by_project(db)

    projects = db.query(models.Project).order_by(models.Project.created_at.desc()).all()
    project_stats = [
        schemas.ProjectRegistrationStat(
            project_id=p.id,
            project_name=p.name,
            registrations_yesterday=yesterday_counts.get(p.id, 0),
            registrations_today=today_counts.get(p.id, 0),
            registrations_total=total_counts.get(p.id, 0),
        )
        for p in projects
    ]

    executives = db.query(models.User).filter(models.User.role == "executive").order_by(models.User.name).all()
    executive_stats = []
    for e in executives:
        pending = (
            db.query(models.Task)
            .filter(models.Task.assigned_to == e.id, models.Task.status == "pending")
            .count()
        )
        completed_total = (
            db.query(models.Task)
            .filter(models.Task.assigned_to == e.id, models.Task.status == "completed")
            .count()
        )
        completed_yesterday = (
            db.query(models.Task)
            .filter(
                models.Task.assigned_to == e.id,
                models.Task.status == "completed",
                models.Task.completed_at >= yesterday_start,
                models.Task.completed_at < yesterday_end,
            )
            .count()
        )
        executive_stats.append(
            schemas.ExecutiveStat(
                user_id=e.id,
                name=e.name,
                tasks_completed_yesterday=completed_yesterday,
                tasks_completed_total=completed_total,
                tasks_pending=pending,
            )
        )

    totals = schemas.DashboardTotals(
        registrations_yesterday=sum(yesterday_counts.values()),
        registrations_today=sum(today_counts.values()),
        tasks_pending=db.query(models.Task).filter(models.Task.status == "pending").count(),
        tasks_completed=db.query(models.Task).filter(models.Task.status == "completed").count(),
    )
    stage_start = today_start
    if report_date:
        try:
            selected = datetime.strptime(report_date, "%Y-%m-%d")
            stage_start = selected.replace(tzinfo=today_start.tzinfo)
        except ValueError:
            stage_start = today_start
    today_stage_summary, today_stage_conversions = task_stage_summary(db, stage_start, stage_start + timedelta(days=1))

    return schemas.DashboardOverview(
        yesterday_date=yesterday_start.date().isoformat(),
        today_date=today_start.date().isoformat(),
        projects=project_stats,
        executives=executive_stats,
        totals=totals,
        today_leads=_daily_lead_breakdown(db, today_start, today_end),
        yesterday_leads=_daily_lead_breakdown(db, yesterday_start, yesterday_end),
        today_stage_summary=today_stage_summary,
        today_stage_conversions=today_stage_conversions,
        stage_report_date=stage_start.date().isoformat(),
    )


@router.get("/api/dashboard/feed-overview")
def feed_overview(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task_q = db.query(models.Task)
    reg_q = db.query(models.Registration)
    if project_id:
        task_q = task_q.filter(models.Task.project_id == project_id)
        reg_q = reg_q.filter(models.Registration.project_id == project_id)

    return {
        "tasks": {
            "total": task_q.count(),
            "unassigned": task_q.filter(models.Task.assigned_to_id.is_(None)).count(),
            "completed": task_q.filter(models.Task.status == "completed").count(),
        },
        "registrations_today": reg_q.filter(
            func.date(models.Registration.created_at) == func.current_date()
        ).count(),
        "customers_total": db.query(func.count(models.Customer.id)).scalar(),
        
    }
