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
    "access_customers": "ai_access_customers",
    "access_tasks": "ai_access_tasks",
    "access_reports": "ai_access_reports",
    "access_registrations": "ai_access_registrations",
}

AI_ACCESS_KEYS = (
    ("customers", SETTING_KEYS["access_customers"]),
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
    return {name: _setting_enabled(stored, key, False) for name, key in AI_ACCESS_KEYS}


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


def _search_terms(message: str) -> list[str]:
    return [term for term in message.lower().split() if len(term) > 2][:8]


def _build_data_context(
    db: Session,
    current_user: models.User,
    resource_access: dict[str, bool],
    message: str,
) -> str:
    """Build a small, permission-filtered context from the main project DB."""
    terms = _search_terms(message)
    sections: list[str] = []

    if resource_access.get("customers"):
        customer_query = db.query(models.Customer)
        if current_user.role != "admin":
            customer_ids = {
                row[0]
                for row in db.query(models.Task.customer_id)
                .filter(models.Task.assigned_to == current_user.id, models.Task.customer_id.isnot(None))
                .all()
            }
            customer_query = customer_query.filter(models.Customer.id.in_(customer_ids)) if customer_ids else customer_query.filter(False)
        if terms:
            customer_query = customer_query.filter(or_(*[
                models.Customer.full_name.ilike(f"%{term}%")
                | models.Customer.mobile.ilike(f"%{term}%")
                | models.Customer.email.ilike(f"%{term}%")
                | models.Customer.profession.ilike(f"%{term}%")
                for term in terms
            ]))
        customers = customer_query.order_by(models.Customer.updated_at.desc()).limit(20).all()
        sections.append("GUESTS:\n" + ("\n".join(
            f"- {c.full_name} | phone={c.mobile} | email={c.email} | stage={c.stage} | profession={c.profession}"
            for c in customers
        ) or "No matching guests."))

    if resource_access.get("tasks"):
        task_query = db.query(models.Task)
        if current_user.role != "admin":
            task_query = task_query.filter(
                or_(models.Task.assigned_to == current_user.id, models.Task.created_by == current_user.id)
            )
        if terms:
            task_query = task_query.filter(or_(*[
                models.Task.title.ilike(f"%{term}%")
                | models.Task.description.ilike(f"%{term}%")
                | models.Task.stage.ilike(f"%{term}%")
                | models.Task.customer_problem.ilike(f"%{term}%")
                for term in terms
            ]))
        tasks = task_query.order_by(models.Task.created_at.desc()).limit(20).all()
        sections.append("TASKS:\n" + ("\n".join(
            f"- {t.title} | status={t.status} | stage={t.stage} | due={t.due_date} | remarks={t.executive_remarks}"
            for t in tasks
        ) or "No matching tasks."))

    if resource_access.get("reports"):
        report_query = db.query(models.DailyReport)
        if current_user.role != "admin":
            report_query = report_query.filter(models.DailyReport.executive_id == current_user.id)
        reports = report_query.order_by(models.DailyReport.created_at.desc()).limit(10).all()
        sections.append("REPORTS:\n" + ("\n".join(
            f"- date={r.report_date} | purpose={r.purpose} | positives={r.positives} | challenges={r.challenges} | suggestions={r.suggestions}"
            for r in reports
        ) or "No reports found."))

    if resource_access.get("registrations"):
        registration_query = db.query(models.Registration).join(models.Project)
        if current_user.role != "admin":
            registration_query = registration_query.join(
                models.Task, models.Task.registration_id == models.Registration.id
            ).filter(models.Task.assigned_to == current_user.id)
        registrations = registration_query.order_by(models.Registration.created_at.desc()).limit(20).all()
        sections.append("REGISTRATIONS:\n" + ("\n".join(
            f"- {r.reg_id} | project={r.project.name if r.project else ''} | submitted={r.created_at} | data={json.dumps(r.data or {}, ensure_ascii=False)[:500]}"
            for r in registrations
        ) or "No registrations found."))

    return "\n\n".join(sections)[:12000]


def _system_prompt(current_user: models.User, resource_access: dict[str, bool], data_context: str) -> str:
    allowed_resources = [name for name, enabled in resource_access.items() if enabled]
    resources_text = ", ".join(allowed_resources) if allowed_resources else "কোনো resource নয়"
    return (
        "তুমি Quantum Registration সিস্টেমের একজন assistant। "
        f"বর্তমান ব্যবহারকারীর role: {current_user.role}। "
        f"AI settings অনুযায়ী অনুমোদিত resource: {resources_text}। "
        "অনুমতি ছাড়া কোনো সংরক্ষিত তথ্য দাবি বা পরিবর্তন করবে না। "
        "নিচের context একই project database থেকে এসেছে। Context-এ তথ্য না থাকলে অনুমান করবে না; পরিষ্কারভাবে বলবে যে data পাওয়া যায়নি।\n\n"
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
