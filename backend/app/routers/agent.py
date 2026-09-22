import os
import json
from typing import Literal
from urllib.parse import quote, urlencode, urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user, require_admin
from app.database import get_db

router = APIRouter(prefix="/api/agent", tags=["agent"])

Provider = Literal["anthropic", "openai_compatible", "gemini"]

PROVIDER_DEFAULTS = {
    "anthropic": {
        "endpoint": "https://api.anthropic.com",
        "model": "claude-haiku-4-5-20251001",
    },
    "openai_compatible": {
        "endpoint": "https://api.openai.com/v1",
        "model": "gpt-5-nano",
    },
    "gemini": {
        "endpoint": "https://generativelanguage.googleapis.com/v1beta",
        "model": "gemini-3.1-flash-lite",
    },
}

SETTING_KEYS = {
    "provider": "agent_provider",
    "model": "agent_model",
    "endpoint": "agent_api_endpoint",
    "api_key": "agent_api_key",
    "widget_enabled": "ai_widget_enabled",
    "access_guests": "ai_access_guests",
    "access_customers": "ai_access_customers",
    "access_events": "ai_access_events",
    "access_communicators": "ai_access_communicators",
    "access_tasks": "ai_access_tasks",
    "access_reports": "ai_access_reports",
    "access_registrations": "ai_access_registrations",
}

AI_ACCESS_KEYS = (
    ("guests", SETTING_KEYS["access_guests"]),
    ("customers", SETTING_KEYS["access_customers"]),
    ("events", SETTING_KEYS["access_events"]),
    ("communicators", SETTING_KEYS["access_communicators"]),
    ("tasks", SETTING_KEYS["access_tasks"]),
    ("reports", SETTING_KEYS["access_reports"]),
    ("registrations", SETTING_KEYS["access_registrations"]),
)


class AgentChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class AgentConfigUpdate(BaseModel):
    provider: Provider
    model: str = Field(min_length=1, max_length=200)
    endpoint: str = Field(min_length=1, max_length=1000)
    api_key: str = Field(default="", max_length=4000)

    @field_validator("model", "endpoint")
    @classmethod
    def strip_value(cls, value: str) -> str:
        return value.strip()

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("A valid HTTP(S) API endpoint is required")
        if parsed.scheme == "http" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
            raise ValueError("Remote AI endpoints must use HTTPS")
        return value.rstrip("/")


def _settings_map(db: Session) -> dict[str, str]:
    keys = set(SETTING_KEYS.values())
    rows = db.query(models.AppSetting).filter(models.AppSetting.key.in_(keys)).all()
    return {row.key: row.value or "" for row in rows}


def _resolved_config(db: Session) -> dict[str, str]:
    stored = _settings_map(db)
    provider = stored.get(SETTING_KEYS["provider"]) or os.getenv("AI_PROVIDER", "anthropic")
    if provider not in PROVIDER_DEFAULTS:
        provider = "anthropic"
    defaults = PROVIDER_DEFAULTS[provider]
    return {
        "provider": provider,
        "model": stored.get(SETTING_KEYS["model"]) or os.getenv("AI_MODEL", defaults["model"]),
        "endpoint": (
            stored.get(SETTING_KEYS["endpoint"])
            or os.getenv("AI_API_ENDPOINT", defaults["endpoint"])
        ).rstrip("/"),
        "api_key": (
            stored.get(SETTING_KEYS["api_key"])
            or os.getenv("AI_API_KEY")
            or (os.getenv("ANTHROPIC_API_KEY") if provider == "anthropic" else "")
            or (os.getenv("OPENAI_API_KEY") if provider == "openai_compatible" else "")
            or (os.getenv("GEMINI_API_KEY") if provider == "gemini" else "")
            or ""
        ),
    }


def _setting_enabled(stored: dict[str, str], key: str, default: bool = False) -> bool:
    value = (stored.get(key) or "").strip().lower()
    if not value:
        return default
    return value in {"1", "true", "yes", "on"}


def _resolved_ai_access(stored: dict[str, str]) -> dict[str, bool]:
    guests_enabled = _setting_enabled(stored, SETTING_KEYS["access_guests"], default=True) or _setting_enabled(stored, SETTING_KEYS["access_customers"], default=True)
    return {
        "guests": guests_enabled,
        "customers": guests_enabled,
        "events": _setting_enabled(stored, SETTING_KEYS["access_events"], default=True),
        "communicators": _setting_enabled(stored, SETTING_KEYS["access_communicators"], default=True),
        "tasks": _setting_enabled(stored, SETTING_KEYS["access_tasks"], default=True),
        "reports": _setting_enabled(stored, SETTING_KEYS["access_reports"], default=True),
        "registrations": _setting_enabled(stored, SETTING_KEYS["access_registrations"], default=True),
    }


def _can_use_widget(current_user: models.User, stored: dict[str, str]) -> bool:
    return bool(current_user and current_user.is_active)


def _upsert_setting(
    db: Session,
    *,
    key: str,
    label: str,
    value: str,
    is_secret: bool = False,
) -> None:
    row = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
    if row is None:
        db.add(
            models.AppSetting(
                key=key,
                label=label,
                category="ai",
                is_secret=is_secret,
                value=value,
            )
        )
        return
    row.label = label
    row.category = "ai"
    row.is_secret = is_secret
    row.value = value


@router.get("/config")
def get_agent_config(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    config = _resolved_config(db)
    stored = _settings_map(db)
    return {
        "provider": config["provider"],
        "model": config["model"],
        "endpoint": config["endpoint"],
        "has_api_key": bool(config["api_key"]),
        "can_manage": current_user.role == "admin",
        "widget_enabled": True,
        "can_use_widget": _can_use_widget(current_user, stored),
        "resource_access": _resolved_ai_access(stored),
    }


@router.put("/config")
def update_agent_config(
    payload: AgentConfigUpdate,
    db: Session = Depends(get_db),
    _current_user: models.User = Depends(require_admin),
):
    current = _settings_map(db)
    _upsert_setting(
        db,
        key=SETTING_KEYS["provider"],
        label="AI Provider",
        value=payload.provider,
    )
    _upsert_setting(
        db,
        key=SETTING_KEYS["model"],
        label="AI Model",
        value=payload.model,
    )
    _upsert_setting(
        db,
        key=SETTING_KEYS["endpoint"],
        label="AI API Endpoint",
        value=payload.endpoint,
    )
    _upsert_setting(
        db,
        key=SETTING_KEYS["api_key"],
        label="AI API Key",
        value=payload.api_key or current.get(SETTING_KEYS["api_key"], ""),
        is_secret=True,
    )
    db.commit()
    config = _resolved_config(db)
    stored = _settings_map(db)
    return {
        "provider": config["provider"],
        "model": config["model"],
        "endpoint": config["endpoint"],
        "has_api_key": bool(config["api_key"]),
        "can_manage": True,
        "widget_enabled": True,
        "can_use_widget": True,
        "resource_access": _resolved_ai_access(stored),
    }


STOP_WORDS = {
    # English general & domain words
    "guest", "guests", "customer", "customers", "client", "clients",
    "communicator", "communicators", "executive", "executives", "user", "users", "staff",
    "event", "events", "project", "projects", "program", "programs",
    "task", "tasks", "todo", "todos", "work",
    "report", "reports", "daily",
    "registration", "registrations", "reg",
    "all", "list", "show", "get", "find", "who", "what", "which", "how", "many",
    "total", "count", "active", "status", "published", "unpublished", "running", "paused",
    "give", "tell", "please", "me", "are", "is", "the", "a", "an", "in", "on", "at",
    "yes", "no", "not", "with", "from", "to", "for", "of", "and", "or",
    # Bengali question & domain terms
    "কে", "কাকে", "কারা", "কার", "কি", "কী", "কবে", "কোথায়", "কোথায়", "কত", "কতজন",
    "সব", "সবাই", "সকল", "লিস্ট", "তালিকা", "তথ্য", "দেখাও", "বলো", "দাও", "আছে", "নাই",
    "নেই", "নাকি", "হলো", "হবে", "চালু", "বন্ধ", "স্থগিত", "পাবলিশ", "আনপাবলিশ", "পজ",
    "রানিং", "গেস্ট", "গেস্টরা", "গেস্টদের", "কমিউনিকেটর", "কমিউনিকেটররা", "কমিউনিকেটরদের",
    "ইভেন্ট", "ইভেন্টটি", "ইভেন্টের", "প্রজেক্ট", "প্রজেক্টের", "প্রোগ্রাম", "প্রোগ্রামের",
    "টাস্ক", "কাজ", "রিপোর্ট", "রেজিস্ট্রেশন", "স্ট্যাটাস", "অবস্থা", "কেমন", "কোন", "কোনটি",
    "কোনগুলো", "কোনগুলা", "একটু", "বলেন", "দিন", "চলছে", "চলমান", "জানাও", "বলোতো",
}


def _search_terms(message: str) -> list[str]:
    clean = message.lower()
    for char in "?!,.:;()[]{}\"'`~":
        clean = clean.replace(char, " ")
    return [term.strip() for term in clean.split() if len(term.strip()) > 1][:12]


def _build_data_context(
    db: Session,
    current_user: models.User,
    resource_access: dict[str, bool],
    message: str,
) -> str:
    """Build a comprehensive, permission-filtered context from the project DB."""
    terms = _search_terms(message)
    specific_terms = [t for t in terms if t not in STOP_WORDS]
    sections: list[str] = []

    # ── Overview Stats ──
    total_events = db.query(models.Project).count()
    running_events = db.query(models.Project).filter(models.Project.published.is_(True)).count()
    paused_events = total_events - running_events
    total_guests = db.query(models.Customer).count()
    total_communicators = db.query(models.User).filter(models.User.role.in_(["executive", "admin"])).count()
    total_tasks = db.query(models.Task).count()
    pending_tasks = db.query(models.Task).filter(models.Task.status == "pending").count()
    completed_tasks = db.query(models.Task).filter(models.Task.status == "completed").count()
    total_reg = db.query(models.Registration).count()

    summary_header = (
        "=== SYSTEM OVERVIEW STATS ===\n"
        f"- Events (ইভেন্ট): {total_events} মোট ({running_events} Running/Published চালু, {paused_events} Paused/Unpublished বন্ধ/স্থগিত)\n"
        f"- Guests (গেস্ট): {total_guests} মোট\n"
        f"- Communicators (কমিউনিকেটর): {total_communicators} মোট\n"
        f"- Tasks (টাস্ক): {total_tasks} মোট ({pending_tasks} Pending, {completed_tasks} Completed)\n"
        f"- Registrations (রেজিস্ট্রেশন): {total_reg} মোট\n"
    )
    sections.append(summary_header)

    # ── 1. EVENTS / PROJECTS (Status: RUNNING/PUBLISHED vs PAUSED/UNPUBLISHED) ──
    if resource_access.get("events", True):
        projects = db.query(models.Project).order_by(models.Project.created_at.desc()).all()
        project_lines = []
        for p in projects:
            reg_count = db.query(models.Registration).filter(models.Registration.project_id == p.id).count()
            if p.published:
                status_text = "RUNNING / PUBLISHED (পাবলিশ / চালু / সক্রিয় / চলমান)"
            else:
                status_text = "PAUSED / UNPUBLISHED (আনপাবলিশ / স্থগিত / বন্ধ / নিষ্ক্রিয়)"

            d_date = p.display_date or (p.event_date.strftime("%Y-%m-%d") if p.event_date else "Not set")
            d_time = p.display_time or "Not set"
            venue = p.place or "Not set"
            max_limit = str(p.max_registrations) if p.max_registrations else "Unlimited"
            payment_info = f"{p.payment_amount} BDT" if p.enable_payment else "Free / Not required"

            project_lines.append(
                f"- Event: {p.name} | Status: {status_text} | Published: {p.published} | "
                f"Date: {d_date} | Time: {d_time} | Place: {venue} | "
                f"Registrations: {reg_count}/{max_limit} | Payment: {payment_info}"
            )
        sections.append("EVENTS / PROGRAMS (ইভেন্ট ও তাদের স্ট্যাটাস):\n" + ("\n".join(project_lines) or "No events found."))

    # ── 2. COMMUNICATORS (কমিউনিকেটর / স্টাফ) ──
    if resource_access.get("communicators", True):
        users = db.query(models.User).order_by(models.User.name).all()
        user_lines = []
        for u in users:
            role_display = "Super Admin" if u.is_super_admin else ("Admin" if u.role == "admin" else "Communicator")
            p_tasks = db.query(models.Task).filter(models.Task.assigned_to == u.id, models.Task.status == "pending").count()
            c_tasks = db.query(models.Task).filter(models.Task.assigned_to == u.id, models.Task.status == "completed").count()
            user_lines.append(
                f"- Communicator: {u.name} | Role: {role_display} | Username: {u.username} | Phone: {u.phone or 'N/A'} | Email: {u.email} | Pending Tasks: {p_tasks} | Completed Tasks: {c_tasks}"
            )
        sections.append("COMMUNICATORS (কমিউনিকেটরদের তালিকা ও কাজের তথ্য):\n" + ("\n".join(user_lines) or "No communicators found."))

    # ── 3. GUESTS (গেস্ট প্রোফাইল) ──
    if resource_access.get("guests", True) or resource_access.get("customers", True):
        guest_query = db.query(models.Customer)
        if current_user.role != "admin":
            customer_ids = {
                row[0]
                for row in db.query(models.Task.customer_id)
                .filter(models.Task.assigned_to == current_user.id, models.Task.customer_id.isnot(None))
                .all()
            }
            guest_query = guest_query.filter(models.Customer.id.in_(customer_ids)) if customer_ids else guest_query.filter(False)

        total_guests_count = guest_query.count()

        if specific_terms:
            filtered_query = guest_query.filter(or_(*[
                models.Customer.full_name.ilike(f"%{term}%")
                | models.Customer.mobile.ilike(f"%{term}%")
                | models.Customer.email.ilike(f"%{term}%")
                | models.Customer.profession.ilike(f"%{term}%")
                | models.Customer.location.ilike(f"%{term}%")
                | models.Customer.stage.ilike(f"%{term}%")
                for term in specific_terms
            ]))
            matched_guests = filtered_query.order_by(models.Customer.updated_at.desc()).limit(25).all()
            guests = matched_guests if matched_guests else guest_query.order_by(models.Customer.updated_at.desc()).limit(25).all()
        else:
            guests = guest_query.order_by(models.Customer.updated_at.desc()).limit(25).all()

        guest_lines = []
        for g in guests:
            last_comm_name = None
            last_task = db.query(models.Task).filter(models.Task.customer_id == g.id).order_by(models.Task.created_at.desc()).first()
            if last_task and last_task.assignee:
                last_comm_name = last_task.assignee.name
            guest_lines.append(
                f"- Guest: {g.full_name} | Mobile: {g.mobile or 'N/A'} | Email: {g.email or 'N/A'} | Stage: {g.stage or 'Not set'} | "
                f"Profession: {g.profession or 'N/A'} | Location: {g.location or 'N/A'} | "
                f"Assigned Communicator: {last_comm_name or 'None'} | Problem: {g.customer_problem or 'None'} | Remarks: {g.executive_remarks or 'None'}"
            )
        sections.append(f"GUESTS (মোট গেস্ট সংখ্যা: {total_guests_count}):\n" + ("\n".join(guest_lines) or "No guests found."))

    # ── 4. TASKS (টাস্ক তালিকা) ──
    if resource_access.get("tasks", True):
        task_query = db.query(models.Task)
        if current_user.role != "admin":
            task_query = task_query.filter(
                or_(models.Task.assigned_to == current_user.id, models.Task.created_by == current_user.id)
            )
        total_tasks_count = task_query.count()
        p_count = task_query.filter(models.Task.status == "pending").count()
        c_count = task_query.filter(models.Task.status == "completed").count()

        if specific_terms:
            filtered_task_query = task_query.filter(or_(*[
                models.Task.title.ilike(f"%{term}%")
                | models.Task.description.ilike(f"%{term}%")
                | models.Task.stage.ilike(f"%{term}%")
                | models.Task.customer_problem.ilike(f"%{term}%")
                for term in specific_terms
            ]))
            matched_tasks = filtered_task_query.order_by(models.Task.created_at.desc()).limit(25).all()
            tasks = matched_tasks if matched_tasks else task_query.order_by(models.Task.created_at.desc()).limit(25).all()
        else:
            tasks = task_query.order_by(models.Task.created_at.desc()).limit(25).all()

        task_lines = []
        for t in tasks:
            comm_name = t.assignee.name if t.assignee else "Unassigned"
            g_name = t.customer.full_name if t.customer else "N/A"
            task_lines.append(
                f"- Task #{t.id}: {t.title} | Status: {t.status} | Stage: {t.stage or 'N/A'} | "
                f"Communicator: {comm_name} | Guest: {g_name} | Due: {t.due_date or 'N/A'} | Remarks: {t.executive_remarks or 'None'}"
            )
        sections.append(f"TASKS (মোট টাস্ক: {total_tasks_count}, Pending: {p_count}, Completed: {c_count}):\n" + ("\n".join(task_lines) or "No tasks found."))

    # ── 5. REGISTRATIONS (রেজিস্ট্রেশন তালিকা) ──
    if resource_access.get("registrations", True):
        registration_query = db.query(models.Registration).join(models.Project)
        if current_user.role != "admin":
            registration_query = registration_query.join(
                models.Task, models.Task.registration_id == models.Registration.id
            ).filter(models.Task.assigned_to == current_user.id)
        total_reg_count = registration_query.count()
        registrations = registration_query.order_by(models.Registration.created_at.desc()).limit(20).all()
        reg_lines = []
        for r in registrations:
            p_name = r.project.name if r.project else "Event"
            g_name = r.customer.full_name if r.customer else (r.data or {}).get("full_name", "Unknown")
            reg_lines.append(
                f"- Reg ID: {r.reg_id} | Event: {p_name} | Guest: {g_name} | Date: {r.created_at.strftime('%Y-%m-%d %H:%M') if r.created_at else 'N/A'}"
            )
        sections.append(f"REGISTRATIONS (মোট রেজিস্ট্রেশন: {total_reg_count}):\n" + ("\n".join(reg_lines) or "No registrations found."))

    # ── 6. DAILY REPORTS (রিপোর্ট) ──
    if resource_access.get("reports", True):
        report_query = db.query(models.DailyReport)
        if current_user.role != "admin":
            report_query = report_query.filter(models.DailyReport.executive_id == current_user.id)
        reports = report_query.order_by(models.DailyReport.created_at.desc()).limit(10).all()
        report_lines = []
        for rep in reports:
            comm = db.query(models.User).filter(models.User.id == rep.executive_id).first()
            c_name = comm.name if comm else "Communicator"
            report_lines.append(
                f"- Date: {rep.report_date} | Communicator: {c_name} | Purpose: {rep.purpose or 'N/A'} | "
                f"Positives: {rep.positives or 'N/A'} | Challenges: {rep.challenges or 'N/A'} | Suggestions: {rep.suggestions or 'N/A'}"
            )
        sections.append("DAILY REPORTS (দৈনিক রিপোর্ট):\n" + ("\n".join(report_lines) or "No reports found."))

    return "\n\n".join(sections)[:14000]


def _system_prompt(current_user: models.User, resource_access: dict[str, bool], data_context: str) -> str:
    user_role_name = "Super Admin" if getattr(current_user, "is_super_admin", False) else ("Admin" if current_user.role == "admin" else "Communicator")
    return (
        "তুমি Quantum Foundation (CRM & Communication Platform)-এর একজন দক্ষ ও নির্ভরযোগ্য AI Assistant।\n"
        f"বর্তমান ব্যবহারকারী: {current_user.name} (Role: {user_role_name})।\n\n"
        "টার্মিনোলজি ও ব্যবসায়িক নিয়মাবলি:\n"
        "1. 'Guest' (গেস্ট): ডেটাবেসের গ্রাহক/গেস্ট প্রোফাইল (Customer)। কখনোই একে অন্য কিছু ভাববে না।\n"
        "2. 'Communicator' (কমিউনিকেটর): প্রতিষ্ঠানের কর্মী/এক্সিকিউটিভ (User), যারা গেস্টদের সাথে যোগাযোগ ও টাস্ক সম্পন্ন করেন।\n"
        "3. 'Event' (ইভেন্ট / প্রোগ্রাম): ডেটাবেসের প্রজেক্ট (Project)।\n"
        "   - ইভেন্টের স্ট্যাটাস নির্দেশিকা:\n"
        "     * যদি `Published: True` হয়, তবে ইভেন্টটি 'RUNNING' / 'PUBLISHED' (পাবলিশ / চালু / সক্রিয় / চলমান)।\n"
        "     * যদি `Published: False` হয়, তবে ইভেন্টটি 'PAUSED' / 'UNPUBLISHED' (আনপাবলিশ / স্থগিত / বন্ধ / নিষ্ক্রিয়)।\n"
        "4. ইভেন্ট সম্পর্কিত প্রশ্ন:\n"
        "   - ব্যবহারকারী যদি জানতে চায় কোনো ইভেন্ট চালু আছে কিনা বা বন্ধ আছে কিনা, কিংবা পাবলিশ নাকি আনপাবলিশ, "
        "কনটেক্সটের EVENTS সেকশন দেখে সুনির্দিষ্ট ও স্পষ্টভাবে জানাবে (যেমন: 'Orientation ইভেন্টটি বর্তমানে চালু/পাবলিশ রয়েছে, ভেন্যু IDEB...')।\n"
        "5. গেস্ট, কমিউনিকেটর, টাস্ক, রেজিস্ট্রেশন বা রিপোর্ট সম্পর্কিত যেকোনো প্রশ্নের উত্তর নিচের DATABASE CONTEXT থেকে যথাযথভাবে প্রদান করবে।\n"
        "6. ভাষা ও টোন: ব্যবহারকারী যে ভাষায় (বাংলা অথবা ইংরেজি) প্রশ্ন করবেন, সেই ভাষায় সুন্দর, স্পষ্ট ও সাবলীলভাবে উত্তর দাও।\n\n"
        f"DATABASE CONTEXT:\n{data_context or 'কোনো অনুমোদিত database context পাওয়া যায়নি।'}"
    )


async def _anthropic_chat(config: dict[str, str], message: str, system_prompt: str) -> str:
    url = f"{config['endpoint']}/v1/messages"
    headers = {
        "x-api-key": config["api_key"],
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": config["model"],
        "max_tokens": 1024,
        "system": system_prompt,
        "messages": [{"role": "user", "content": message}],
    }
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
    return "\n".join(
        block.get("text", "") for block in response.json().get("content", []) if block.get("type") == "text"
    ).strip()


async def _openai_compatible_chat(config: dict[str, str], message: str, system_prompt: str) -> str:
    endpoint = config["endpoint"]
    url = endpoint if endpoint.endswith("/chat/completions") else f"{endpoint}/chat/completions"
    headers = {"content-type": "application/json"}
    if config["api_key"]:
        headers["authorization"] = f"Bearer {config['api_key']}"
    payload = {
        "model": config["model"],
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message},
        ],
        "max_tokens": 1024,
    }
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
    content = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
    if isinstance(content, list):
        return "\n".join(item.get("text", "") for item in content if isinstance(item, dict)).strip()
    return str(content).strip()


async def _gemini_chat(config: dict[str, str], message: str, system_prompt: str) -> str:
    model = quote(config["model"], safe="")
    query = urlencode({"key": config["api_key"]})
    url = f"{config['endpoint']}/models/{model}:generateContent?{query}"
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": message}]}],
        "generationConfig": {"maxOutputTokens": 1024},
    }
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
    candidates = response.json().get("candidates", [])
    parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
    return "\n".join(part.get("text", "") for part in parts).strip()


@router.post("/chat")
async def agent_chat(
    payload: AgentChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    config = _resolved_config(db)
    stored = _settings_map(db)
    if not _can_use_widget(current_user, stored):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI chat widget এই account-এর জন্য enabled নয়।",
        )
    resource_access = _resolved_ai_access(stored)
    data_context = _build_data_context(db, current_user, resource_access, payload.message)
    if not config["api_key"] and config["provider"] != "openai_compatible":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI API key সেট করা হয়নি। Widget-এর settings থেকে API key যোগ করুন।",
        )

    try:
        if config["provider"] == "anthropic":
            text = await _anthropic_chat(config, payload.message, _system_prompt(current_user, resource_access, data_context))
        elif config["provider"] == "gemini":
            text = await _gemini_chat(config, payload.message, _system_prompt(current_user, resource_access, data_context))
        else:
            text = await _openai_compatible_chat(config, payload.message, _system_prompt(current_user, resource_access, data_context))
    except httpx.HTTPStatusError as exc:
        detail = f"AI provider request failed ({exc.response.status_code})."
        try:
            provider_error = exc.response.json().get("error")
            if isinstance(provider_error, dict):
                detail = provider_error.get("message") or detail
            elif provider_error:
                detail = str(provider_error)
        except ValueError:
            pass
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI provider-এর সঙ্গে সংযোগ করা যায়নি। Endpoint পরীক্ষা করুন।",
        ) from exc

    if not text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI provider কোনো text response দেয়নি।",
        )
    return {"response": text, "provider": config["provider"], "model": config["model"]}
