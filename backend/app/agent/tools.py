from app.routers import tasks as tasks_router
from app.routers import customers as customers_router
from app.auth import get_current_user  # existing dependency reuse

def check_agent_permission(db, user_id, resource, need="read"):
    perm = db.query(AgentPermission).filter_by(user_id=user_id, resource_name=resource).first()
    if not perm or perm.access_level == "none":
        return False
    return need != "read_write" or perm.access_level == "read_write"

def tool_get_executive_workload(db, current_user, executive_id: int):
    # Executive হলে নিজের ছাড়া অন্য কারো ডেটা agent দিয়ে দেখানো যাবে না
    if current_user.role != "admin" and current_user.id != executive_id:
        return {"error": "Permission denied"}
    if not check_agent_permission(db, current_user.id, "tasks", "read"):
        return {"error": "Agent access not enabled for this resource"}
    return tasks_router.get_workload_data(db, executive_id)  # existing function reuse

def tool_analyze_daily_reports(db, current_user, date_range):
    if not check_agent_permission(db, current_user.id, "reports", "read"):
        return {"error": "Permission denied"}
    reports = reports_router.get_reports_in_range(db, current_user, date_range)
    return reports  # raw data ফেরত দিন, analysis Claude করবে

def tool_set_reminder(db, current_user, message: str, remind_at: str):
    reminder = AgentReminder(user_id=current_user.id, message=message, remind_at=remind_at)
    db.add(reminder); db.commit()
    return {"status": "reminder set", "id": reminder.id}