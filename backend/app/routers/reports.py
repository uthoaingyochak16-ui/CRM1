# backend/app/routers/reports.py — new file
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, require_admin
from ..database import get_db
from .notifications import notify
from ..reporting import task_stage_summary

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/prefill")
def report_prefill(
    report_date: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        selected = datetime.strptime(report_date, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="সঠিক report date দিন") from exc
    day_end = selected + timedelta(days=1)
    stages, conversions = task_stage_summary(db, selected, day_end, current_user.id)
    return {
        "date": report_date,
        "name": current_user.name,
        "phone": current_user.phone or "",
        "designation": current_user.designation or "",
        "center": current_user.center or "",
        "stage_summary": stages,
        "stage_conversions": conversions,
    }


def _to_out(db: Session, r: models.DailyReport) -> schemas.DailyReportOut:
    selected = r.report_date or r.created_at
    day_start = selected.replace(hour=0, minute=0, second=0, microsecond=0)
    stages, conversions = task_stage_summary(db, day_start, day_start + timedelta(days=1), r.executive_id)
    return schemas.DailyReportOut(
        id=r.id,
        executive_id=r.executive_id,
        executive_name=r.executive.name if r.executive else None,
        report_date=r.report_date,
        designation=r.designation or "",
        mobile=r.mobile or "",
        center=r.center or "",
        purpose=r.purpose or "",
        specific_program=r.specific_program or "",
        contact_target=r.contact_target or "",
        time1_start=r.time1_start or "",
        time1_end=r.time1_end or "",
        time2_start=r.time2_start or "",
        time2_end=r.time2_end or "",
        time3_start=r.time3_start or "",
        time3_end=r.time3_end or "",
        meditation_before=r.meditation_before or "",
        prayer_after=r.prayer_after or "",
        positives=r.positives or "",
        challenges=r.challenges or "",
        suggestions=r.suggestions or "",
        admin_feedback=r.admin_feedback or "",
        created_at=r.created_at,
        stage_summary=stages,
        stage_conversions=conversions,
    )


@router.get("", response_model=list[schemas.DailyReportOut])
def list_reports(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    q = db.query(models.DailyReport)
    if current_user.role != "admin":
        q = q.filter(models.DailyReport.executive_id == current_user.id)
    reports = q.order_by(models.DailyReport.created_at.desc()).all()
    return [_to_out(db, r) for r in reports]


@router.get("/mine", response_model=list[schemas.DailyReportOut])
def list_my_reports(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    reports = (
        db.query(models.DailyReport)
          .filter(models.DailyReport.executive_id == current_user.id)
          .order_by(models.DailyReport.created_at.desc())
          .all()
    )
    return [_to_out(db, r) for r in reports]


@router.post("", response_model=schemas.DailyReportOut)
def create_report(
    payload: schemas.DailyReportCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    report_data = payload.model_dump()
    report_data["designation"] = (report_data.get("designation") or "").strip() or (current_user.designation or "")
    report_data["mobile"] = (report_data.get("mobile") or "").strip() or (current_user.phone or "")
    report_data["center"] = (report_data.get("center") or "").strip() or (current_user.center or "")
    report = models.DailyReport(executive_id=current_user.id, **report_data)
    db.add(report)
    db.flush()

    admins = db.query(models.User).filter(models.User.role == "admin", models.User.is_active.is_(True)).all()
    for admin in admins:
        notify(db, admin.id, f"{current_user.name} নতুন daily report জমা দিয়েছেন", "report_submitted", "/admin/reports")

    db.commit()
    db.refresh(report)
    return _to_out(db, report)


@router.patch("/{report_id}/feedback", response_model=schemas.DailyReportOut, dependencies=[Depends(require_admin)])
def give_feedback(report_id: int, payload: schemas.DailyReportFeedback, db: Session = Depends(get_db)):
    report = db.query(models.DailyReport).filter(models.DailyReport.id == report_id).first()
    if report is None:
        raise HTTPException(status_code=404, detail="Report পাওয়া যায়নি")
    report.admin_feedback = payload.admin_feedback
    notify(db, report.executive_id, "আপনার report-এ admin feedback দিয়েছেন", "report_feedback", "/admin/reports")
    db.commit()
    db.refresh(report)
    return _to_out(db, report)
