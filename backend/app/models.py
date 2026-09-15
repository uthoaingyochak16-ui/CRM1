from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from sqlalchemy import Float, Numeric
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base




# Define BD_TZ globally for consistent timezone handling
BD_TZ = timezone(timedelta(hours=6))


def gen_id() -> str:
    return uuid.uuid4().hex[:12]


def gen_reg_id() -> str:
    # Human friendly registration id, e.g. QF-8F3A2C1B
    return "QF-" + uuid.uuid4().hex[:8].upper()


class User(Base):
    """An admin or executive account. Both log in with email + password."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    username = Column(String, unique=True, nullable=False, default="")
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    phone = Column(String, default="")
    designation = Column(String, default="")
    center = Column(String, default="")
    profile_image_url = Column(String, nullable=False, default="")
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False, default="executive")  # "admin" | "executive"
    is_super_admin = Column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # can_manage_customers: Mapped[bool] = mapped_column(Boolean, default=False) 
    # # global — not tied to a single project
    can_manage_customers = Column(Boolean, default=False)  # global — not tied to a single project
    can_use_ai_chat_widget = Column(Boolean, default=False)  # global AI chat widget visibility
    can_manual_lead_entry = Column(Boolean, default=False)
    can_create_events = Column(Boolean, default=False)
    daily_task_limit = Column(Integer, nullable=True)
    daily_followup_limit = Column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(BD_TZ))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(BD_TZ), onupdate=lambda: datetime.now(BD_TZ))

    permissions: Mapped[list["ProjectPermission"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    tasks_assigned: Mapped[list["Task"]] = relationship(
        back_populates="assignee", foreign_keys="Task.assigned_to", cascade="all, delete-orphan"
    )


class ProjectPermission(Base):
    """Per-executive, per-project feature access. Admins bypass this entirely."""

    __tablename__ = "project_permissions"
    __table_args__ = (UniqueConstraint("user_id", "project_id", name="uq_permission_per_user_project"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    can_view: Mapped[bool] = mapped_column(Boolean, default=True)
    can_view_registrations: Mapped[bool] = mapped_column(Boolean, default=False)
    can_edit_event: Mapped[bool] = mapped_column(Boolean, default=False)
    can_edit_fields: Mapped[bool] = mapped_column(Boolean, default=False)
    can_publish: Mapped[bool] = mapped_column(Boolean, default=False)
    can_export: Mapped[bool] = mapped_column(Boolean, default=False)
    can_manage_tasks: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="permissions")
    project: Mapped["Project"] = relationship()


class Task(Base):
    """A to-do — either a general admin-assigned task, or a customer
    follow-up lead auto-created from a registration. Lead tasks start
    unassigned (assigned_to is null) until an admin assigns an executive;
    the executive then fills the follow-up form, which completes the task
    and syncs the entered data onto the linked Customer's main profile."""

    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    assigned_to = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    registration_id = Column(Integer, ForeignKey("registrations.id", ondelete="CASCADE"), nullable=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    status = Column(String, default="pending")  # "pending" | "completed"
    due_date = Column(DateTime, nullable=True)
    assigned_at = Column(DateTime, nullable=True)


    created_at = Column(DateTime, default=lambda: datetime.now(BD_TZ))
    completed_at = Column(DateTime, nullable=True)

    # Follow-up form fields (filled by the executive when completing a lead task)
    full_name_update = Column(String, default="")
    location = Column(String, default="")
    profession = Column(String, default="")
    age = Column(Integer, nullable=True)
    customer_problem = Column(Text, default="")
    executive_remarks = Column(Text, default="")
    stage = Column(String, default="")
    first_following_date = Column(DateTime, nullable=True)
    next_following_date = Column(DateTime, nullable=True)
    followup_reason = Column(Text, default="")
    followup_extra_data = Column(JSON, default=dict)
    followup_id = Column(Integer, ForeignKey("customer_followups.id", ondelete="SET NULL"), nullable=True)
    # Groups a standalone/manual lead and its later follow-up tasks without
    # mixing them with other leads belonging to the same customer.
    root_task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    manual_lead_data = Column(JSON, default=dict)

    assignee = relationship("User", back_populates="tasks_assigned", foreign_keys=[assigned_to])
    creator = relationship("User", foreign_keys=[created_by])
    project = relationship("Project")
    registration = relationship("Registration")
    customer = relationship("Customer")


class Project(Base):
    __tablename__ = "projects"
    auto_email_on_registration: Mapped[bool] = mapped_column(Boolean, default=False)
    email_template_registration: Mapped[str] = mapped_column(String, default="")
    registration_email_subject: Mapped[str] = mapped_column(String, default="")
    registration_email_html: Mapped[str] = mapped_column(Text, default="")
    registration_email_cc_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    registration_email_cc_list: Mapped[list[str]] = mapped_column(JSON, default=list)
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    published: Mapped[bool] = mapped_column(Boolean, default=False)

    # Event / admin config
    title_part1: Mapped[str] = mapped_column(String, default="")
    title_part2: Mapped[str] = mapped_column(String, default="")
    place: Mapped[str] = mapped_column(String, default="")
    event_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)  # combined date+time used for countdown
    display_date: Mapped[str] = mapped_column(String, default="")
    display_time: Mapped[str] = mapped_column(String, default="")
    home_registration_instruction: Mapped[str] = mapped_column(Text, default="")
    registration_instruction: Mapped[str] = mapped_column(Text, default="")
    max_registrations: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # None/0 = unlimited
    ecard_image_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ecard_image_remote_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    enable_payment: Mapped[bool] = mapped_column(Boolean, default=False)
    payment_amount: Mapped[int] = mapped_column(Integer, default=0)
    auto_email_on_payment: Mapped[bool] = mapped_column(Boolean, default=False)
    email_template_payment: Mapped[str] = mapped_column(String, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(BD_TZ))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(BD_TZ), onupdate=lambda: datetime.now(BD_TZ))

    form_fields: Mapped[list["FormField"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="FormField.position"
    )
    registrations: Mapped[list["Registration"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class FormField(Base):
    __tablename__ = "form_fields"
    __table_args__ = (UniqueConstraint("project_id", "key", name="uq_field_key_per_project"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    key: Mapped[str] = mapped_column(String, nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, default="text")  # text | tel | email | textarea | select
    placeholder: Mapped[str] = mapped_column(String, default="")
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    options: Mapped[list[str]] = mapped_column(JSON, default=list)  # for select fields
    position: Mapped[int] = mapped_column(Integer, default=0)

    project: Mapped["Project"] = relationship(back_populates="form_fields")


class Registration(Base):
    __tablename__ = "registrations"

    id = Column(Integer, primary_key=True)
    reg_id = Column(String, unique=True, default=gen_reg_id)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    data = Column(JSON, default=dict)  # arbitrary form_field key -> value
    created_at = Column(DateTime, default=lambda: datetime.now(BD_TZ))
    email_status = Column(String, default="not_requested", index=True)
    email_error = Column(Text, default="")

    project = relationship("Project", back_populates="registrations")
    customer = relationship("Customer", back_populates="registrations")


class ArchivedLead(Base):
    """Immutable registration snapshot retained when its source event is deleted."""

    __tablename__ = "archived_leads"

    id = Column(Integer, primary_key=True)
    original_registration_id = Column(Integer, nullable=True, index=True)
    reg_id = Column(String, default="", index=True)
    event_id = Column(String, default="", index=True)
    event_name = Column(String, default="")
    customer_id = Column(String, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    data = Column(JSON, default=dict)
    registered_at = Column(DateTime, nullable=True)
    archived_at = Column(DateTime, default=lambda: datetime.now(BD_TZ), index=True)


class Customer(Base):
    """Master profile deduplicated across every program's registrations,
    matched by mobile or email. Holds admin-managed personal data on top of
    whatever each program's form collected."""

    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=gen_id)
    full_name = Column(String, default="")
    mobile = Column(String, default="", index=True)
    email = Column(String, default="", index=True)
    profile_image_url = Column(String, nullable=False, default="")
    location = Column(String, default="")
    profession = Column(String, default="")
    age = Column(Integer, nullable=True)
    stage = Column(String, default="")  # see STAGE_OPTIONS in schemas.py
    customer_problem = Column(Text, default="")
    executive_remarks = Column(Text, default="")
    first_following_date = Column(DateTime, nullable=True)
    next_following_date = Column(DateTime, nullable=True)
    extra_data = Column(JSON, default=dict)  # keyed by CustomerField.key
    created_at = Column(DateTime, default=lambda: datetime.now(BD_TZ))
    updated_at = Column(DateTime, default=lambda: datetime.now(BD_TZ), onupdate=lambda: datetime.now(BD_TZ))

    registrations = relationship("Registration", back_populates="customer")
    communication_logs = relationship("CommunicationLog", back_populates="customer", cascade="all, delete-orphan")
    followups = relationship("CustomerFollowUp", back_populates="customer", cascade="all, delete-orphan")


class CustomerFollowUp(Base):
    __tablename__ = "customer_followups"

    id = Column(Integer, primary_key=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_to = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    scheduled_at = Column(DateTime, nullable=False, index=True)
    note = Column(Text, default="")
    result = Column(Text, default="")
    stage = Column(String, default="")
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(BD_TZ), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(BD_TZ), onupdate=lambda: datetime.now(BD_TZ))

    customer = relationship("Customer", back_populates="followups")
    assignee = relationship("User", foreign_keys=[assigned_to])
    creator = relationship("User", foreign_keys=[created_by])



class CustomerField(Base):
    """Admin-configurable schema for the extra personal-data fields shown on
    every customer profile (address, DOB, NID, notes, etc.) — global, not
    per-project, since one profile spans many programs."""

    __tablename__ = "customer_fields"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, default="text")  # text | textarea | date | select
    options: Mapped[list[str]] = mapped_column(JSON, default=list)
    position: Mapped[int] = mapped_column(Integer, default=0)


class CommunicationLog(Base):
    """Permanent audit trail of every communication between an executive and
    a customer. Created whenever a task linked to a customer is marked complete.
    Allows tracking the full history of interactions and stage transitions."""

    __tablename__ = "communication_logs"

    id = Column(Integer, primary_key=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    executive_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Snapshot of the form data at the time of communication
    full_name = Column(String, default="")
    location = Column(String, default="")
    profession = Column(String, default="")
    age = Column(Integer, nullable=True)
    customer_problem = Column(Text, default="")
    executive_remarks = Column(Text, default="")
    stage = Column(String, default="")
    first_following_date = Column(DateTime, nullable=True)
    next_following_date = Column(DateTime, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=lambda: datetime.now(BD_TZ), index=True)

    customer = relationship("Customer", back_populates="communication_logs")
    executive = relationship("User", foreign_keys=[executive_id])


class AppSetting(Base):
    """Admin-only key/value store for site-wide settings — payment gateway
    keys, email/SMTP config, third-party API keys, etc. Secret values are
    masked when read back over the API."""

    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, nullable=False)
    label = Column(String, nullable=False)
    category = Column(String, default="other")  # email | payment | other
    is_secret = Column(Boolean, default=False)
    value = Column(Text, default="")
    updated_at = Column(DateTime, default=lambda: datetime.now(BD_TZ), onupdate=lambda: datetime.now(BD_TZ))


class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True)
    title = Column(String, default="")
    summary = Column(Text, default="")
    report_date = Column(DateTime, nullable=False)
    executive_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(BD_TZ))
    designation = Column(String, default="")
    mobile = Column(String, default="")
    center = Column(String, default="")
    purpose = Column(String, default="")
    specific_program = Column(String, default="")
    contact_target = Column(String, default="")
    received_promaster = Column(Integer, default=0)
    received_graduate = Column(Integer, default=0)
    received_associate = Column(Integer, default=0)
    received_brandnew = Column(Integer, default=0)
    notreceived_promaster = Column(Integer, default=0)
    notreceived_graduate = Column(Integer, default=0)
    notreceived_associate = Column(Integer, default=0)
    notreceived_brandnew = Column(Integer, default=0)
    time1_start = Column(String, default="")
    time1_end = Column(String, default="")
    time2_start = Column(String, default="")
    time2_end = Column(String, default="")
    time3_start = Column(String, default="")
    time3_end = Column(String, default="")
    meditation_before = Column(String, default="হ্যাঁ")
    prayer_after = Column(String, default="হ্যাঁ")
    positives = Column(Text, default="")
    challenges = Column(Text, default="")
    suggestions = Column(Text, default="")
    executive = relationship("User", foreign_keys=[executive_id])
    feedbacks = relationship("ReportFeedback", back_populates="report", cascade="all, delete-orphan")

class ReportFeedback(Base):
    __tablename__ = "report_feedbacks"
    id = Column(Integer, primary_key=True)
    report_id = Column(Integer, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False)
    admin_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    feedback = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(BD_TZ))
    report = relationship("Report", back_populates="feedbacks")
    admin = relationship("User", foreign_keys=[admin_id])
    

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, default="general")
    target_url = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(BD_TZ))

    

class DailyReport(Base):
    __tablename__ = "daily_reports"

    id = Column(Integer, primary_key=True)
    executive_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    report_date = Column(DateTime, nullable=True)
    designation = Column(String, default="")
    mobile = Column(String, default="")
    center = Column(String, default="")
    purpose = Column(String, default="")
    specific_program = Column(String, default="")

    contact_target = Column(String, default="")
    received_promaster = Column(Integer, default=0)
    received_graduate = Column(Integer, default=0)
    received_associate = Column(Integer, default=0)
    received_brandnew = Column(Integer, default=0)
    notreceived_promaster = Column(Integer, default=0)
    notreceived_graduate = Column(Integer, default=0)
    notreceived_associate = Column(Integer, default=0)
    notreceived_brandnew = Column(Integer, default=0)

    time1_start = Column(String, default="")
    time1_end = Column(String, default="")
    time2_start = Column(String, default="")
    time2_end = Column(String, default="")
    time3_start = Column(String, default="")
    time3_end = Column(String, default="")
    meditation_before = Column(String, default="")
    prayer_after = Column(String, default="")

    positives = Column(Text, default="")
    challenges = Column(Text, default="")
    suggestions = Column(Text, default="")

    admin_feedback = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(BD_TZ))


    executive = relationship("User")
    

class EmailTemplate(Base):
    __tablename__ = "email_templates"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    subject = Column(String, default="")
    html_body = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(BD_TZ))
    updated_at = Column(DateTime, default=lambda: datetime.now(BD_TZ), onupdate=lambda: datetime.now(BD_TZ))
    

class CallLog(Base):
    __tablename__ = "call_logs"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    executive_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    phone_number = Column(String, default="")
    received = Column(Boolean, nullable=True)
    duration_seconds = Column(Integer, default=0)
    notes = Column(Text, default="")
    provider = Column(String, default="")
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(BD_TZ))
    task = relationship("Task")
    customer = relationship("Customer")
    executive = relationship("User")
    
    
# backend/app/models.py — append

class ExecutiveSession(Base):
    __tablename__ = "executive_sessions"
    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    login_at = Column(DateTime, default=datetime.utcnow)
    logout_at = Column(DateTime, nullable=True)
    last_heartbeat_at = Column(DateTime, default=datetime.utcnow)
    proper_work_minutes = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class ExecutiveActivityLog(Base):
    __tablename__ = "executive_activity_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("executive_sessions.id", ondelete="SET NULL"), nullable=True)
    activity_type = Column(String, nullable=False)  # profile_viewed|profile_updated|followup_added|note_added|status_changed|task_completed|other
    customer_id = Column(String, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    details = Column(JSON, default=dict)
    ip_address = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class CustomerCommunication(Base):
    __tablename__ = "customer_communications"
    id = Column(Integer, primary_key=True)
    executive_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    method = Column(String, default="call")  # call|whatsapp|sms|email|in_person|other
    communication_at = Column(DateTime, default=datetime.utcnow)
    duration_minutes = Column(Integer, default=0)
    outcome = Column(String, default="other")  # interested|not_interested|wants_to_join|already_graduate|no_response|followup_required|call_back_later|invalid_contact|other
    notes = Column(Text, default="")
    follow_up_date = Column(DateTime, nullable=True)
    interest_level = Column(String, default="")
    joined_program = Column(Boolean, default=False)
    graduated = Column(Boolean, default=False)
    followup_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ExecutiveTarget(Base):
    __tablename__ = "executive_targets"
    __table_args__ = (UniqueConstraint("user_id", "period", name="uq_target_user_period"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    period = Column(String, nullable=False)  # daily|weekly|monthly
    communication_target = Column(Integer, default=0)
    interested_target = Column(Integer, default=0)
    join_target = Column(Integer, default=0)
    followup_target = Column(Integer, default=0)
    graduate_target = Column(Integer, default=0)
    productive_hour_target = Column(Integer, default=0)
    point_target = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AdminPerformanceFeedback(Base):
    __tablename__ = "admin_performance_feedback"
    id = Column(Integer, primary_key=True)
    executive_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    admin_id = Column(String, ForeignKey("users.id"), nullable=True)
    feedback = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)   
    
class AgentPermission(Base):
    __tablename__ = "agent_permissions"
    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    resource_name = Column(String)   # 'customers', 'tasks', 'reports', 'reminders'
    access_level = Column(String)    # 'none' | 'read' | 'read_write'

class AgentReminder(Base):
    __tablename__ = "agent_reminders"
    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(String)
    remind_at = Column(DateTime)
    is_sent = Column(Boolean, default=False)

class AgentAuditLog(Base):
    __tablename__ = "agent_audit_log"
    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tool_name = Column(String)
    input_params = Column(JSON)
    result_summary = Column(String)
    created_at = Column(DateTime, server_default=func.now())

class AgentConversation(Base):
    __tablename__ = "agent_conversations"
    id = Column(Integer, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String)   # user | assistant
    content = Column(String)
    created_at = Column(DateTime, server_default=func.now())


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)  # None = org-wide
    author_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    content = Column(Text, nullable=False)
    post_type = Column(String, default="text")  # text | image | video | link | poll
    is_pinned = Column(Boolean, default=False)

    # link preview
    link_url = Column(String, nullable=True)
    link_title = Column(String, nullable=True)
    link_domain = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    author = relationship("User")
    project = relationship("Project")
    attachments = relationship("PostAttachment", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("PostComment", back_populates="post", cascade="all, delete-orphan")
    reactions = relationship("PostReaction", back_populates="post", cascade="all, delete-orphan")
    poll_options = relationship("PollOption", back_populates="post", cascade="all, delete-orphan")


class PostAttachment(Base):
    __tablename__ = "post_attachments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    file_url = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # image | video

    post = relationship("Post", back_populates="attachments")


class FeedUserPreference(Base):
    __tablename__ = "feed_user_preferences"
    __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_feed_user_preference_user_post"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    is_saved = Column(Boolean, default=False)
    is_hidden = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PostComment(Base):
    __tablename__ = "post_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("Post", back_populates="comments")
    author = relationship("User")


class PostReaction(Base):
    __tablename__ = "post_reactions"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_reaction_user"),)

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reaction_type = Column(String, default="like")

    post = relationship("Post", back_populates="reactions")


class PollOption(Base):
    __tablename__ = "poll_options"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    label = Column(String, nullable=False)

    post = relationship("Post", back_populates="poll_options")
    votes = relationship("PollVote", back_populates="option", cascade="all, delete-orphan")


class PollVote(Base):
    __tablename__ = "poll_votes"
    __table_args__ = (UniqueConstraint("option_id", "user_id", name="uq_poll_vote_user_option"),)

    id = Column(Integer, primary_key=True, index=True)
    option_id = Column(Integer, ForeignKey("poll_options.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    option = relationship("PollOption", back_populates="votes")


class FeedAd(Base):
    __tablename__ = "feed_ads"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    image_url = Column(String, nullable=False)
    website_url = Column(String, nullable=False)
    cta_text = Column(String, nullable=False)
    sponsor_name = Column(String, nullable=False)
    placement = Column(String, nullable=False)  # "first" | "after" | "banner"
    after_posts = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    creator = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        CheckConstraint("placement IN ('first', 'after', 'banner')", name="ck_feed_ad_placement"),
        CheckConstraint("placement != 'after' OR after_posts >= 1", name="ck_feed_ad_after_posts"),
    )
