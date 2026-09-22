from app import models
from app.models import AgentPermission, AgentReminder
from app.routers import tasks as tasks_router
from app.routers import guests as guests_router
from app.routers import reports as reports_router
from app.auth import get_current_user


def check_agent_permission(db, user_id: str, resource: str, need: str = "read") -> bool:
    perm = db.query(AgentPermission).filter_by(user_id=user_id, resource_name=resource).first()
    if not perm or perm.access_level == "none":
        return False
    return need != "read_write" or perm.access_level == "read_write"


def tool_get_communicator_workload(db, current_user, communicator_id: str):
    """Get workload statistics for a communicator."""
    # Communicator হলে নিজের ছাড়া অন্য কারো ডেটা agent দিয়ে দেখানো যাবে না
    if current_user.role != "admin" and current_user.id != communicator_id:
        return {"error": "Permission denied"}
    if not check_agent_permission(db, current_user.id, "tasks", "read"):
        return {"error": "Agent access not enabled for this resource"}
    return tasks_router.get_workload_data(db, communicator_id)


tool_get_executive_workload = tool_get_communicator_workload  # backward compatibility alias


def tool_check_event_status(db, current_user, event_name_or_id: str = ""):
    """Check if an event is running/published or paused/unpublished."""
    query = db.query(models.Project)
    if event_name_or_id:
        query = query.filter(
            (models.Project.id == event_name_or_id)
            | (models.Project.name.ilike(f"%{event_name_or_id}%"))
        )
    projects = query.all()
    results = []
    for p in projects:
        reg_count = db.query(models.Registration).filter(models.Registration.project_id == p.id).count()
        results.append({
            "id": p.id,
            "name": p.name,
            "published": p.published,
            "status": "RUNNING / PUBLISHED (চালু/পাবলিশ)" if p.published else "PAUSED / UNPUBLISHED (স্থগিত/আনপাবলিশ)",
            "place": p.place,
            "display_date": p.display_date,
            "display_time": p.display_time,
            "registrations_count": reg_count,
            "max_registrations": p.max_registrations,
        })
    return results


def tool_get_guests(db, current_user, search_query: str = ""):
    """Search and get guest profiles."""
    if not check_agent_permission(db, current_user.id, "customers", "read"):
        return {"error": "Permission denied"}
    query = db.query(models.Customer)
    if search_query:
        query = query.filter(
            models.Customer.full_name.ilike(f"%{search_query}%")
            | models.Customer.mobile.ilike(f"%{search_query}%")
            | models.Customer.email.ilike(f"%{search_query}%")
            | models.Customer.profession.ilike(f"%{search_query}%")
        )
    guests = query.order_by(models.Customer.updated_at.desc()).limit(20).all()
    return [
        {
            "id": g.id,
            "full_name": g.full_name,
            "mobile": g.mobile,
            "email": g.email,
            "stage": g.stage,
            "profession": g.profession,
            "location": g.location,
        }
        for g in guests
    ]


def tool_analyze_daily_reports(db, current_user, date_range):
    if not check_agent_permission(db, current_user.id, "reports", "read"):
        return {"error": "Permission denied"}
    reports = reports_router.get_reports_in_range(db, current_user, date_range)
    return reports


def tool_set_reminder(db, current_user, message: str, remind_at: str):
    reminder = AgentReminder(user_id=current_user.id, message=message, remind_at=remind_at)
    db.add(reminder)
    db.commit()
    return {"status": "reminder set", "id": reminder.id}