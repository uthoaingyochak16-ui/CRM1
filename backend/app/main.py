import logging
import os
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
# from . import models
from app import models
from .auth import hash_password
from .config import settings
from .database import Base, SessionLocal, engine
# from .routers import app_settings, auth, customers, dashboard, notifications, projects, public, reports, tasks, users, registrations
from .routers import agent, app_settings, auth, customers, dashboard, followups, notifications, performance, projects, public, realtime, registrations, reports, tasks, users
from .routers import email_templates
from .routers import call_logs
from .routers.notifications import notify as create_notification
from .realtime import broker

logger = logging.getLogger(__name__)

os.makedirs(settings.upload_dir, exist_ok=True)

scheduler = AsyncIOScheduler()


def _seed_initial_admin():
    db = SessionLocal()
    try:
        admin_email = settings.initial_admin_email.lower().strip()
        admin_username = (admin_email.split("@")[0] if "@" in admin_email else admin_email).strip() or "admin"
        matching_admin = (
            db.query(models.User)
            .filter(
                (models.User.email == admin_email)
                | (models.User.username == admin_username)
                | (models.User.role == "admin")
            )
            .order_by(models.User.created_at.desc())
            .first()
        )

        if matching_admin is not None:
            matching_admin.name = matching_admin.name or settings.initial_admin_name
            matching_admin.email = admin_email
            matching_admin.username = (matching_admin.username or admin_username).strip() or admin_username
            matching_admin.role = "admin"
            matching_admin.is_super_admin = True
            matching_admin.is_active = True
            matching_admin.password_hash = hash_password(settings.initial_admin_password)
            db.commit()
            return

        db.add(
            models.User(
                name=settings.initial_admin_name,
                username=admin_username,
                email=admin_email,
                password_hash=hash_password(settings.initial_admin_password),
                role="admin",
                is_super_admin=True,
                is_active=True,
            )
        )
        db.commit()
    finally:
        db.close()


def initialize_database() -> None:
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:  # pragma: no cover - defensive startup behavior
        if settings.database_url.startswith("sqlite"):
            logger.warning("Schema creation failed; resetting SQLite database: %s", exc)
            try:
                Base.metadata.drop_all(bind=engine)
                Base.metadata.create_all(bind=engine)
            except Exception as reset_exc:  # pragma: no cover - defensive startup behavior
                logger.warning("Database reset failed: %s", reset_exc)
                return
        else:
            logger.warning("Database initialization skipped: %s", exc)
            return

    with engine.begin() as connection:
        inspector = inspect(connection)
        migrations = {
            ("users", "can_manage_customers"): "ALTER TABLE users ADD COLUMN can_manage_customers BOOLEAN DEFAULT false",
            ("users", "is_super_admin"): "ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT false",
            ("users", "can_use_ai_chat_widget"): "ALTER TABLE users ADD COLUMN can_use_ai_chat_widget BOOLEAN DEFAULT false",
            ("users", "can_manual_lead_entry"): "ALTER TABLE users ADD COLUMN can_manual_lead_entry BOOLEAN DEFAULT false",
            ("users", "can_create_events"): "ALTER TABLE users ADD COLUMN can_create_events BOOLEAN DEFAULT false",
            ("users", "daily_task_limit"): "ALTER TABLE users ADD COLUMN daily_task_limit INTEGER",
            ("users", "daily_followup_limit"): "ALTER TABLE users ADD COLUMN daily_followup_limit INTEGER",
            ("users", "phone"): "ALTER TABLE users ADD COLUMN phone VARCHAR DEFAULT ''",
            ("users", "username"): "ALTER TABLE users ADD COLUMN username VARCHAR DEFAULT ''",
            ("users", "designation"): "ALTER TABLE users ADD COLUMN designation VARCHAR DEFAULT ''",
            ("users", "center"): "ALTER TABLE users ADD COLUMN center VARCHAR DEFAULT ''",
            ("users", "profile_image_url"): "ALTER TABLE users ADD COLUMN profile_image_url VARCHAR DEFAULT ''",
            ("users", "password_hash"): "ALTER TABLE users ADD COLUMN password_hash VARCHAR",
            ("users", "is_active"): "ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true",
            ("users", "updated_at"): "ALTER TABLE users ADD COLUMN updated_at TIMESTAMP",
            ("projects", "published"): "ALTER TABLE projects ADD COLUMN published BOOLEAN DEFAULT false",
            ("projects", "title_part1"): "ALTER TABLE projects ADD COLUMN title_part1 VARCHAR DEFAULT ''",
            ("projects", "title_part2"): "ALTER TABLE projects ADD COLUMN title_part2 VARCHAR DEFAULT ''",
            ("projects", "place"): "ALTER TABLE projects ADD COLUMN place VARCHAR DEFAULT ''",
            ("projects", "event_date"): "ALTER TABLE projects ADD COLUMN event_date TIMESTAMP",
            ("projects", "display_date"): "ALTER TABLE projects ADD COLUMN display_date VARCHAR DEFAULT ''",
            ("projects", "display_time"): "ALTER TABLE projects ADD COLUMN display_time VARCHAR DEFAULT ''",
            ("projects", "home_registration_instruction"): "ALTER TABLE projects ADD COLUMN home_registration_instruction TEXT DEFAULT ''",
            ("projects", "registration_instruction"): "ALTER TABLE projects ADD COLUMN registration_instruction TEXT DEFAULT ''",
            ("projects", "max_registrations"): "ALTER TABLE projects ADD COLUMN max_registrations INTEGER",
            ("projects", "ecard_image_path"): "ALTER TABLE projects ADD COLUMN ecard_image_path VARCHAR",
            ("projects", "ecard_image_remote_url"): "ALTER TABLE projects ADD COLUMN ecard_image_remote_url VARCHAR",
            ("projects", "registration_email_subject"): "ALTER TABLE projects ADD COLUMN registration_email_subject VARCHAR DEFAULT ''",
            ("projects", "registration_email_html"): "ALTER TABLE projects ADD COLUMN registration_email_html TEXT DEFAULT ''",
            ("projects", "registration_email_cc_enabled"): "ALTER TABLE projects ADD COLUMN registration_email_cc_enabled BOOLEAN DEFAULT false",
            ("projects", "registration_email_cc_list"): "ALTER TABLE projects ADD COLUMN registration_email_cc_list JSON DEFAULT '[]'",
            ("projects", "enable_payment"): "ALTER TABLE projects ADD COLUMN enable_payment BOOLEAN DEFAULT false",
            ("projects", "payment_amount"): "ALTER TABLE projects ADD COLUMN payment_amount INTEGER DEFAULT 0",
            ("projects", "auto_email_on_payment"): "ALTER TABLE projects ADD COLUMN auto_email_on_payment BOOLEAN DEFAULT false",
            ("projects", "email_template_payment"): "ALTER TABLE projects ADD COLUMN email_template_payment VARCHAR DEFAULT ''",
            ("projects", "updated_at"): "ALTER TABLE projects ADD COLUMN updated_at TIMESTAMP",
            ("project_permissions", "can_view"): "ALTER TABLE project_permissions ADD COLUMN can_view BOOLEAN DEFAULT true",
            ("project_permissions", "can_view_registrations"): "ALTER TABLE project_permissions ADD COLUMN can_view_registrations BOOLEAN DEFAULT false",
            ("project_permissions", "can_edit_event"): "ALTER TABLE project_permissions ADD COLUMN can_edit_event BOOLEAN DEFAULT false",
            ("project_permissions", "can_edit_fields"): "ALTER TABLE project_permissions ADD COLUMN can_edit_fields BOOLEAN DEFAULT false",
            ("project_permissions", "can_publish"): "ALTER TABLE project_permissions ADD COLUMN can_publish BOOLEAN DEFAULT false",
            ("project_permissions", "can_export"): "ALTER TABLE project_permissions ADD COLUMN can_export BOOLEAN DEFAULT false",
            ("project_permissions", "can_manage_tasks"): "ALTER TABLE project_permissions ADD COLUMN can_manage_tasks BOOLEAN DEFAULT false",
            ("registrations", "customer_id"): "ALTER TABLE registrations ADD COLUMN customer_id VARCHAR",
            ("registrations", "email_status"): "ALTER TABLE registrations ADD COLUMN email_status VARCHAR DEFAULT 'not_requested'",
            ("registrations", "email_error"): "ALTER TABLE registrations ADD COLUMN email_error TEXT DEFAULT ''",
            ("customers", "location"): "ALTER TABLE customers ADD COLUMN location VARCHAR DEFAULT ''",
            ("customers", "profile_image_url"): "ALTER TABLE customers ADD COLUMN profile_image_url VARCHAR DEFAULT ''",
            ("customers", "profession"): "ALTER TABLE customers ADD COLUMN profession VARCHAR DEFAULT ''",
            ("customers", "age"): "ALTER TABLE customers ADD COLUMN age INTEGER",
            ("customers", "stage"): "ALTER TABLE customers ADD COLUMN stage VARCHAR DEFAULT ''",
            ("customers", "customer_problem"): "ALTER TABLE customers ADD COLUMN customer_problem TEXT DEFAULT ''",
            ("customers", "executive_remarks"): "ALTER TABLE customers ADD COLUMN executive_remarks TEXT DEFAULT ''",
            ("customers", "first_following_date"): "ALTER TABLE customers ADD COLUMN first_following_date TIMESTAMP",
            ("customers", "next_following_date"): "ALTER TABLE customers ADD COLUMN next_following_date TIMESTAMP",
            ("tasks", "customer_id"): "ALTER TABLE tasks ADD COLUMN customer_id VARCHAR",
            ("tasks", "full_name_update"): "ALTER TABLE tasks ADD COLUMN full_name_update VARCHAR DEFAULT ''",
            ("tasks", "location"): "ALTER TABLE tasks ADD COLUMN location VARCHAR DEFAULT ''",
            ("tasks", "profession"): "ALTER TABLE tasks ADD COLUMN profession VARCHAR DEFAULT ''",
            ("tasks", "age"): "ALTER TABLE tasks ADD COLUMN age INTEGER",
            ("tasks", "customer_problem"): "ALTER TABLE tasks ADD COLUMN customer_problem TEXT DEFAULT ''",
            ("tasks", "executive_remarks"): "ALTER TABLE tasks ADD COLUMN executive_remarks TEXT DEFAULT ''",
            ("tasks", "stage"): "ALTER TABLE tasks ADD COLUMN stage VARCHAR DEFAULT ''",
            ("tasks", "first_following_date"): "ALTER TABLE tasks ADD COLUMN first_following_date TIMESTAMP",
            ("tasks", "next_following_date"): "ALTER TABLE tasks ADD COLUMN next_following_date TIMESTAMP",
            ("tasks", "manual_lead_data"): "ALTER TABLE tasks ADD COLUMN manual_lead_data JSON DEFAULT '{}'",
            ("tasks", "assigned_at"): "ALTER TABLE tasks ADD COLUMN assigned_at TIMESTAMP",
            ("tasks", "followup_id"): "ALTER TABLE tasks ADD COLUMN followup_id INTEGER",
            ("tasks", "root_task_id"): "ALTER TABLE tasks ADD COLUMN root_task_id INTEGER",
            ("tasks", "followup_reason"): "ALTER TABLE tasks ADD COLUMN followup_reason TEXT DEFAULT ''",
            ("tasks", "followup_extra_data"): "ALTER TABLE tasks ADD COLUMN followup_extra_data JSON DEFAULT '{}'",
            ("notifications", "target_url"): "ALTER TABLE notifications ADD COLUMN target_url VARCHAR",
            ("executive_sessions", "proper_work_minutes"): "ALTER TABLE executive_sessions ADD COLUMN proper_work_minutes FLOAT DEFAULT 0",
            ("daily_reports", "time3_start"): "ALTER TABLE daily_reports ADD COLUMN time3_start VARCHAR DEFAULT ''",
            ("daily_reports", "time3_end"): "ALTER TABLE daily_reports ADD COLUMN time3_end VARCHAR DEFAULT ''",
            ("call_logs", "provider"): "ALTER TABLE call_logs ADD COLUMN provider VARCHAR DEFAULT ''",
            ("call_logs", "started_at"): "ALTER TABLE call_logs ADD COLUMN started_at TIMESTAMP",
            ("call_logs", "ended_at"): "ALTER TABLE call_logs ADD COLUMN ended_at TIMESTAMP",
            ("feed_ads", "after_posts"): "ALTER TABLE feed_ads ADD COLUMN after_posts INTEGER",
            ("feed_ads", "created_by"): "ALTER TABLE feed_ads ADD COLUMN created_by VARCHAR",
            ("feed_ads", "updated_at"): "ALTER TABLE feed_ads ADD COLUMN updated_at TIMESTAMP",
        }
        for (table, column), statement in migrations.items():
            if table in inspector.get_table_names() and column not in {item["name"] for item in inspector.get_columns(table)}:
                connection.execute(text(statement))

        if engine.dialect.name != "sqlite" and "feed_ads" in inspector.get_table_names():
            original = connection.execute(text(
                "SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c "
                "JOIN pg_class t ON c.conrelid = t.oid "
                "WHERE t.relname = 'feed_ads' AND c.conname = 'ck_feed_ad_placement'"
            )).scalar()
            expected = "CHECK (placement IN ('first', 'after', 'banner'))"
            if original is None:
                connection.execute(text(
                    "ALTER TABLE feed_ads ADD CONSTRAINT ck_feed_ad_placement "
                    "CHECK (placement IN ('first', 'after', 'banner'))"
                ))
            elif original != expected:
                connection.execute(text("ALTER TABLE feed_ads DROP CONSTRAINT IF EXISTS ck_feed_ad_placement"))
                connection.execute(text(
                    "ALTER TABLE feed_ads ADD CONSTRAINT ck_feed_ad_placement "
                    "CHECK (placement IN ('first', 'after', 'banner'))"
                ))

        if "users" in inspector.get_table_names():
            rows = connection.execute(text("SELECT id, email, username FROM users ORDER BY created_at, id")).mappings().all()
            used: set[str] = set()
            for row in rows:
                base = (row["username"] or (row["email"] or "").split("@")[0] or "user").strip().lower()
                base = "".join(char for char in base if char.isalnum() or char in "._-") or "user"
                candidate = base
                suffix = 2
                while candidate in used:
                    candidate = f"{base}{suffix}"
                    suffix += 1
                used.add(candidate)
                if row["username"] != candidate:
                    connection.execute(
                        text("UPDATE users SET username = :username WHERE id = :user_id"),
                        {"username": candidate, "user_id": row["id"]},
                    )
        if engine.dialect.name != "sqlite":
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_registrations_project_id ON registrations (project_id)"
            ))
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_registrations_email_status ON registrations (email_status)"
            ))

    try:
        db = SessionLocal()
        try:
            profession_fields = db.query(models.FormField).filter(models.FormField.key == "profession").all()
            for field in profession_fields:
                field.type = "select"
                field.options = list(projects.PROFESSION_OPTIONS)
            if profession_fields:
                db.commit()
        finally:
            db.close()
        _sync_registration_tasks()
    except Exception as exc:  # pragma: no cover - defensive startup behavior
        logger.warning("Admin seeding / task sync skipped: %s", exc)


def _sync_registration_tasks():
    db = SessionLocal()
    try:
        registrations = db.query(models.Registration).all()
        tasks = db.query(models.Task).all()
        existing_reg_ids = {t.registration_id for t in tasks if t.registration_id}

        for reg in registrations:
            if reg.id not in existing_reg_ids:
                lead_name = (reg.data or {}).get("full_name") or (reg.customer.full_name if reg.customer else "") or "Unknown"
                proj_name = reg.project.name if reg.project else "Event"
                task = models.Task(
                    title=f"New registration — {lead_name} ({proj_name})",
                    description=f"Registration {reg.reg_id}",
                    assigned_to="",
                    created_by=None,
                    project_id=reg.project_id,
                    registration_id=reg.id,
                    customer_id=reg.customer_id,
                    status="pending",
                )
                db.add(task)
        db.commit()
    except Exception as exc:
        logger.warning("Registration tasks sync skipped: %s", exc)
    finally:
        db.close()



is_production = settings.environment.lower() == "production"
app = FastAPI(
    title="Quantum Foundation Registration API",
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
)

app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_host_list)

# ── CORS ── must be registered immediately after app creation, before routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def check_due_reminders() -> None:
    db = SessionLocal()
    try:
        due_reminders = (
            db.query(models.AgentReminder)
            .filter(
                models.AgentReminder.remind_at <= datetime.utcnow(),
                models.AgentReminder.is_sent.is_(False),
            )
            .all()
        )
        for reminder in due_reminders:
            create_notification(
                db,
                reminder.user_id,
                reminder.message,
                "reminder",
                "/admin/tasks",
            )
            reminder.is_sent = True
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to process due agent reminders")
    finally:
        db.close()


@app.on_event("startup")
def on_startup() -> None:
    if settings.auto_initialize_database:
        initialize_database()
    # Production uses Alembic for schema management and deliberately disables
    # the legacy initializer. Admin bootstrapping is a separate, idempotent
    # startup responsibility and must therefore not be gated by that flag.
    _seed_initial_admin()
    if not scheduler.running:
        scheduler.add_job(
            check_due_reminders,
            "interval",
            minutes=1,
            id="check_due_reminders",
            replace_existing=True,
        )
        scheduler.start()


@app.on_event("startup")
async def start_realtime_broker() -> None:
    import anyio

    anyio.to_thread.current_default_thread_limiter().total_tokens = 100
    await broker.start()


@app.on_event("shutdown")
def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)


@app.on_event("shutdown")
async def stop_realtime_broker() -> None:
    await broker.stop()


# CORSMiddleware is already registered above (immediately after app creation)

app.mount(f"/{settings.upload_dir}", StaticFiles(directory=settings.upload_dir), name="uploads")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(public.router)
app.include_router(tasks.router)
app.include_router(dashboard.router)
app.include_router(customers.router)
app.include_router(customers.fields_router)
app.include_router(followups.router)
app.include_router(reports.router)
app.include_router(notifications.router)
app.include_router(app_settings.router)
app.include_router(app_settings.public_router)
app.include_router(registrations.router)
app.include_router(email_templates.router)
app.include_router(call_logs.router)
app.include_router(performance.router)
app.include_router(agent.router)
app.include_router(realtime.router)


@app.get("/api/health")
def health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        logger.exception("Health check failed")
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
