from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from .email_defaults import DEFAULT_REGISTRATION_EMAIL_HTML, DEFAULT_REGISTRATION_EMAIL_SUBJECT


class PermissionIn(BaseModel):
    project_id: str
    can_view: bool = True
    can_view_registrations: bool = False
    can_edit_event: bool = False
    can_edit_fields: bool = False
    can_publish: bool = False
    can_export: bool = False
    can_manage_tasks: bool = False


class PermissionOut(PermissionIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_name: Optional[str] = None


class LoginRequest(BaseModel):
    username: str | None = None
    email: str | None = None
    password: str

    @model_validator(mode="before")
    @classmethod
    def ensure_login_identifier(cls, values):
        if not isinstance(values, dict):
            return values
        identifier = (values.get("username") or values.get("email") or "").strip()
        if not identifier:
            raise ValueError("username or email required")
        values["username"] = identifier
        values["email"] = identifier
        return values


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    username: str
    email: str
    phone: str
    designation: str
    center: str = ""
    profile_image_url: str = ""
    role: str
    is_super_admin: bool
    is_active: bool
    can_manage_customers: bool
    can_use_ai_chat_widget: bool
    can_manual_lead_entry: bool
    can_create_events: bool
    daily_task_limit: Optional[int] = None
    daily_followup_limit: Optional[int] = None
    permissions: list[PermissionOut] = Field(default_factory=list)
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ChangeOwnPasswordRequest(BaseModel):
    current_password: str
    new_password: str


class OwnProfileUpdate(BaseModel):
    name: str
    email: str
    phone: str = ""
    designation: str = ""
    center: str = ""


class UserCreate(BaseModel):
    name: str
    username: str
    email: str
    password: str
    role: str = "executive"  # "admin" | "executive"
    phone: str = ""
    designation: str = ""
    center: str = ""


class UserUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    center: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None
    can_manage_customers: Optional[bool] = None
    can_use_ai_chat_widget: Optional[bool] = None
    can_manual_lead_entry: Optional[bool] = None
    can_create_events: Optional[bool] = None
    daily_task_limit: Optional[int] = None
    daily_followup_limit: Optional[int] = None
    permissions: Optional[list[PermissionIn]] = None




class UserResetPassword(BaseModel):
    new_password: str


class FormFieldIn(BaseModel):
    key: str
    label: str
    type: str = "text"
    placeholder: str = ""
    required: bool = False
    options: list[str] = []


class FormFieldOut(FormFieldIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ProjectCreate(BaseModel):
    name: str


class ProjectRename(BaseModel):
    name: str


class ProjectEventUpdate(BaseModel):
    title_part1: str = ""
    title_part2: str = ""
    place: str = ""
    event_date: Optional[datetime] = None
    display_date: str = ""
    display_time: str = ""
    home_registration_instruction: str = ""
    registration_instruction: str = ""
    max_registrations: Optional[int] = None
    ecard_image_remote_url: str = ""
    auto_email_on_registration: bool = False
    email_template_registration: str = ""
    registration_email_subject: str = DEFAULT_REGISTRATION_EMAIL_SUBJECT
    registration_email_html: str = DEFAULT_REGISTRATION_EMAIL_HTML
    registration_email_cc_enabled: bool = False
    registration_email_cc_list: list[str] = Field(default_factory=list)
    enable_payment: bool = False
    payment_amount: int = 0
    auto_email_on_payment: bool = False
    email_template_payment: str = ""

    @field_validator("ecard_image_remote_url")
    @classmethod
    def validate_ecard_image_remote_url(cls, value: str) -> str:
        value = value.strip()
        if value and not value.lower().startswith(("http://", "https://")):
            raise ValueError("Image URL must start with http:// or https://")
        return value

    @field_validator("registration_email_cc_list")
    @classmethod
    def validate_registration_email_cc_list(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in values:
            email = item.strip().lower()
            if not email:
                continue
            if "@" not in email or email.startswith("@") or email.endswith("@"):
                raise ValueError(f"Invalid CC email: {item}")
            if email not in cleaned:
                cleaned.append(email)
        return cleaned


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    slug: str
    published: bool
    title_part1: str
    title_part2: str
    place: str
    event_date: Optional[datetime] = None
    display_date: str
    display_time: str
    home_registration_instruction: str
    registration_instruction: str
    max_registrations: Optional[int] = None
    registrations_count: int = 0
    ecard_image_url: Optional[str] = None
    ecard_image_remote_url: str = ""
    created_at: datetime
    updated_at: datetime
    auto_email_on_registration: bool = False
    email_template_registration: str = ""
    registration_email_subject: str = DEFAULT_REGISTRATION_EMAIL_SUBJECT
    registration_email_html: str = DEFAULT_REGISTRATION_EMAIL_HTML
    registration_email_cc_enabled: bool = False
    registration_email_cc_list: list[str] = Field(default_factory=list)
    enable_payment: bool = False
    payment_amount: int = 0
    auto_email_on_payment: bool = False
    email_template_payment: str = ""


class PublicConfigOut(BaseModel):
    project_id: str
    name: str
    published: bool
    title_part1: str
    title_part2: str
    place: str
    event_date: Optional[datetime] = None
    display_date: str
    display_time: str
    home_registration_instruction: str
    registration_instruction: str
    max_registrations: Optional[int] = None
    registrations_count: int = 0
    ecard_image_url: Optional[str] = None
    form_fields: list[FormFieldOut]


class RegistrationCreate(BaseModel):
    data: dict[str, Any]


class RegistrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    reg_id: str
    project_id: str
    data: dict[str, Any]
    created_at: datetime
    requires_payment: bool = False
    email_sent: bool = False
    email_status: str = "not_requested"


STAGE_OPTIONS = [
    "Interested",
    "Dropped",
    "Counselling",
    "Associate",
    "Course Acc",
    "Potential Batch",
    "QG",
    "Quantier",
    "QPM",
    "Ardentiar",
    "Organier",
    "Foreigner",
]


class BulkAssignRequest(BaseModel):
    task_ids: list[int]
    assigned_to: str


class BulkDeleteTasksRequest(BaseModel):
    task_ids: list[int]


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    assigned_to: Optional[str] = None  # None = unassigned lead, admin assigns later
    project_id: Optional[str] = None
    registration_id: Optional[int] = None
    customer_id: Optional[str] = None
    due_date: Optional[datetime] = None


class ManualLeadCreate(BaseModel):
    data: dict[str, Any]
    assigned_to: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    status: Optional[str] = None  # "pending" | "completed"
    due_date: Optional[datetime] = None
    # Follow-up form fields — an executive fills these in when completing a lead task
    full_name_update: Optional[str] = None
    location: Optional[str] = None
    profession: Optional[str] = None
    age: Optional[int] = None
    customer_problem: Optional[str] = None
    executive_remarks: Optional[str] = None
    stage: Optional[str] = None
    first_following_date: Optional[datetime] = None
    next_following_date: Optional[datetime] = None
    followup_reason: Optional[str] = None
    followup_extra_data: Optional[dict[str, Any]] = None
    call_received: Optional[bool] = None


class TaskOut(BaseModel):
    id: int
    title: str
    description: str
    assigned_to: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_image_url: str = ""
    created_by: Optional[str] = None
    creator_name: Optional[str] = None
    creator_image_url: str = ""
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    registration_id: Optional[int] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_image_url: str = ""
    status: str
    due_date: Optional[datetime] = None
    assigned_at: Optional[datetime] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    full_name_update: str = ""
    location: str = ""
    profession: str = ""
    age: Optional[int] = None
    customer_problem: str = ""
    executive_remarks: str = ""
    stage: str = ""
    first_following_date: Optional[datetime] = None
    next_following_date: Optional[datetime] = None
    followup_reason: str = ""
    followup_extra_data: dict[str, Any] = {}
    followup_id: Optional[int] = None
    registration_data: dict = {}
    


class ProjectRegistrationStat(BaseModel):
    project_id: str
    project_name: str
    registrations_yesterday: int
    registrations_today: int
    registrations_total: int


class ExecutiveStat(BaseModel):
    user_id: str
    name: str
    tasks_completed_yesterday: int
    tasks_completed_total: int
    tasks_pending: int


class DashboardTotals(BaseModel):
    registrations_yesterday: int
    registrations_today: int
    tasks_pending: int
    tasks_completed: int


class LeadBreakdownItem(BaseModel):
    name: str
    count: int


class DailyLeadBreakdown(BaseModel):
    date: str
    total: int
    sources: list[LeadBreakdownItem]
    stages: list[LeadBreakdownItem]


class ReportStageCount(BaseModel):
    stage: str
    count: int


class ReportStageConversion(BaseModel):
    from_stage: str
    to_stage: str
    count: int


class DashboardOverview(BaseModel):
    yesterday_date: str
    today_date: str
    projects: list[ProjectRegistrationStat]
    executives: list[ExecutiveStat]
    totals: DashboardTotals
    today_leads: DailyLeadBreakdown
    yesterday_leads: DailyLeadBreakdown
    today_stage_summary: list[ReportStageCount]
    today_stage_conversions: list[ReportStageConversion]
    stage_report_date: str


class CustomerFieldIn(BaseModel):
    key: str
    label: str
    type: str = "text"  # text | textarea | date | select
    options: list[str] = []


class CustomerFieldOut(CustomerFieldIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class CustomerCreate(BaseModel):
    full_name: str = ""
    mobile: str = ""
    email: str = ""
    location: str = ""
    profession: str = ""
    age: Optional[int] = None
    stage: str = ""
    customer_problem: str = ""
    executive_remarks: str = ""
    first_following_date: Optional[datetime] = None
    next_following_date: Optional[datetime] = None
    extra_data: dict[str, Any] = {}


class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    location: Optional[str] = None
    profession: Optional[str] = None
    age: Optional[int] = None
    stage: Optional[str] = None
    customer_problem: Optional[str] = None
    executive_remarks: Optional[str] = None
    first_following_date: Optional[datetime] = None
    next_following_date: Optional[datetime] = None
    extra_data: Optional[dict[str, Any]] = None


class CustomerFollowUpCreate(BaseModel):
    scheduled_at: datetime
    note: str = ""
    result: str = ""
    stage: str
    assigned_to: Optional[str] = None


class CustomerFollowUpUpdate(BaseModel):
    scheduled_at: Optional[datetime] = None
    note: Optional[str] = None
    result: Optional[str] = None
    stage: Optional[str] = None
    assigned_to: Optional[str] = None
    completed: Optional[bool] = None


class CustomerFollowUpOut(BaseModel):
    id: int
    customer_id: str
    assigned_to: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_image_url: str = ""
    created_by: Optional[str] = None
    creator_name: Optional[str] = None
    creator_image_url: str = ""
    scheduled_at: datetime
    note: str
    result: str
    stage: str
    completed: bool
    completed_at: Optional[datetime] = None
    created_at: datetime


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    full_name: str
    mobile: str
    email: str
    profile_image_url: str = ""
    location: str
    profession: str
    age: Optional[int] = None
    stage: str
    customer_problem: str
    executive_remarks: str
    first_following_date: Optional[datetime] = None
    next_following_date: Optional[datetime] = None
    last_assigned_comm_name: Optional[str] = None
    last_assigned_at: Optional[datetime] = None
    extra_data: dict[str, Any]
    programs_count: int = 0
    created_at: datetime
    updated_at: datetime


class TaskHistoryEntry(BaseModel):
    id: int
    context_id: int
    kind: str
    project_name: str = ""
    status: str
    consultant: str = ""
    created_by_name: str = ""
    stage: str = ""
    customer_problem: str = ""
    executive_remarks: str = ""
    followup_reason: str = ""
    extra_data: dict[str, Any] = {}
    lead_data: dict[str, Any] = {}
    due_date: Optional[datetime] = None
    next_following_date: Optional[datetime] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


class TaskHistoryDetail(BaseModel):
    task_id: int
    registration_data: dict[str, Any] = {}
    history: list[TaskHistoryEntry] = []


class CustomerRegistrationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    registration_id: int
    reg_id: str
    project_id: str
    project_name: str
    data: dict[str, Any]
    field_labels: dict[str, str] = {}
    created_at: datetime
    task_history: list[TaskHistoryEntry] = []


class CustomerDetailOut(CustomerOut):
    registrations: list[CustomerRegistrationSummary] = []
    lead_history: list[TaskHistoryEntry] = []


class CommunicationLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    customer_id: str
    task_id: Optional[int] = None
    executive_id: Optional[str] = None
    executive_name: Optional[str] = None
    full_name: str
    location: str
    profession: str
    age: Optional[int] = None
    customer_problem: str
    executive_remarks: str
    stage: str
    first_following_date: Optional[datetime] = None
    next_following_date: Optional[datetime] = None
    created_at: datetime


class SettingIn(BaseModel):
    key: str
    label: str
    category: str = "other"  # email | payment | other
    is_secret: bool = False
    value: str = ""  # for is_secret fields, blank on update means "keep existing"


class SettingOut(BaseModel):
    id: int
    key: str
    label: str
    category: str
    is_secret: bool
    value: str  # masked to "" for secrets — see has_value
    has_value: bool
    updated_at: datetime
    
class ReportFeedbackOut(BaseModel):
    id: int
    report_id: int
    admin_id: str
    admin_name: Optional[str] = None
    feedback: str
    created_at: datetime
    class Config: from_attributes = True

class ReportOut(BaseModel):
    id: int
    title: str
    summary: str
    report_date: datetime
    executive_id: str
    executive_name: Optional[str] = None
    created_at: datetime
    feedbacks: list[ReportFeedbackOut] = []
    class Config: from_attributes = True

class ReportCreate(BaseModel):
    title: str
    summary: str = ""
    report_date: datetime

class FeedbackCreate(BaseModel):
    feedback: str
    

class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    message: str
    type: str
    target_url: Optional[str] = None
    is_read: bool
    created_at: datetime
    

class DailyReportCreate(BaseModel):
    report_date: Optional[datetime] = None
    designation: str = ""
    mobile: str = ""
    center: str = ""
    purpose: str = ""
    specific_program: str = ""
    contact_target: str = ""
    time1_start: str = ""
    time1_end: str = ""
    time2_start: str = ""
    time2_end: str = ""
    time3_start: str = ""
    time3_end: str = ""
    meditation_before: str = ""
    prayer_after: str = ""
    positives: str = ""
    challenges: str = ""
    suggestions: str = ""


class DailyReportFeedback(BaseModel):
    admin_feedback: str


class DailyReportOut(DailyReportCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    executive_id: str
    executive_name: Optional[str] = None
    admin_feedback: str = ""
    created_at: datetime 
    stage_summary: list[ReportStageCount] = []
    stage_conversions: list[ReportStageConversion] = []
    
class EmailTemplateOut(BaseModel):
    id: int
    name: str
    subject: str
    html_body: str
    class Config: from_attributes = True
    
class EmailTemplateCreate(BaseModel):
    name: str
    subject: str = ""
    html_body: str = ""
    
class CallLogCreate(BaseModel):
    task_id: Optional[int] = None
    customer_id: Optional[str] = None
    phone_number: str = ""
    received: Optional[bool] = None
    duration_seconds: int = 0
    notes: str = ""
    provider: str = ""
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

class CallLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    task_id: Optional[int] = None
    customer_id: Optional[str] = None
    executive_id: Optional[str] = None
    executive_name: Optional[str] = None
    phone_number: str
    received: Optional[bool] = None
    duration_seconds: int
    notes: str
    provider: str = ""
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    
    
# backend/app/schemas.py — append

class SessionStartOut(BaseModel):
    session_id: int
    status: str


class ActivityLogCreate(BaseModel):
    activity_type: str
    customer_id: Optional[str] = None
    project_id: Optional[str] = None
    details: dict[str, Any] = {}


class CommunicationCreate(BaseModel):
    customer_id: str
    project_id: Optional[str] = None
    method: str = "call"
    communication_at: Optional[datetime] = None
    duration_minutes: int = 0
    outcome: str = "other"
    notes: str = ""
    follow_up_date: Optional[datetime] = None
    interest_level: str = ""
    joined_program: bool = False
    graduated: bool = False
    followup_completed: bool = False


class CommunicationOut(CommunicationCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    executive_id: str
    created_at: datetime


class TargetIn(BaseModel):
    period: str
    communication_target: int = 0
    interested_target: int = 0
    join_target: int = 0
    followup_target: int = 0
    graduate_target: int = 0
    productive_hour_target: int = 0
    point_target: int = 0


class TargetOut(TargetIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: str


class FeedbackIn(BaseModel):
    feedback: str


class FeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    executive_id: str
    admin_id: Optional[str] = None
    feedback: str
    created_at: datetime


class PerformanceSummary(BaseModel):
    user_id: str
    name: str
    status: str  # online | idle | offline
    last_active: Optional[datetime] = None
    active_hours: float
    productive_hours: float
    idle_hours: float
    total_contacted: int
    unique_contacted: int
    interested: int
    not_interested: int
    wants_to_join: int
    no_response: int
    followup_required: int
    joined: int
    graduated: int
    total_attempts: int
    avg_duration_minutes: float
    followup_completion_rate: float
    interest_conversion_rate: float
    join_conversion_rate: float
    graduation_conversion_rate: float
    response_rate: float
    total_points: float
    performance_score: float
    performance_category: str
    completed_tasks: int


class PollOptionOut(BaseModel):
    id: int
    label: str
    vote_count: int = 0

    class Config:
        from_attributes = True


class PostCommentCreate(BaseModel):
    content: str


class PostCommentOut(BaseModel):
    id: int
    author_id: str
    author_name: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class PostCreate(BaseModel):
    project_id: Optional[str] = None
    content: str
    title: Optional[str] = None
    description: Optional[str] = None
    post_type: str = "text"
    link_url: Optional[str] = None
    poll_options: Optional[list[str]] = None  # only for post_type == "poll"


class PostUpdate(BaseModel):
    content: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    link_url: Optional[str] = None
    post_type: Optional[str] = None


class PostOut(BaseModel):
    id: int
    project_id: Optional[str]
    author_id: str
    author_name: str
    author_role: str
    content: str
    post_type: str
    is_pinned: bool
    link_url: Optional[str]
    link_title: Optional[str]
    link_domain: Optional[str]
    reaction_count: int
    comment_count: int
    poll_options: Optional[list[PollOptionOut]] = None
    is_saved: bool = False
    is_hidden: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class FeedAdCreate(BaseModel):
    title: str
    description: str
    image_url: str
    website_url: str
    cta_text: str
    sponsor_name: str
    placement: str
    after_posts: Optional[int] = None
    is_active: bool = True

    @field_validator("placement")
    @classmethod
    def validate_placement(cls, value: str) -> str:
        if value not in {"first", "after", "banner"}:
            raise ValueError("placement must be 'first', 'after', or 'banner'")
        return value

    @field_validator("after_posts")
    @classmethod
    def validate_after_posts(cls, value: Optional[int], info) -> Optional[int]:
        placement = info.data.get("placement")
        if placement == "after" and (value is None or value < 1):
            raise ValueError("after_posts must be at least 1 when placement is 'after'")
        if placement in {"first", "banner"} and value is not None:
            raise ValueError("after_posts must be null when placement is 'first' or 'banner'")
        return value

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Image URL is required")
        if not value.lower().startswith(("http://", "https://")):
            raise ValueError("Image URL must start with http:// or https://")
        return value

    @field_validator("website_url")
    @classmethod
    def validate_website_url(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Website URL is required")
        if not value.lower().startswith(("http://", "https://")):
            raise ValueError("Website URL must start with http:// or https://")
        return value

    @model_validator(mode="after")
    def validate_placement_after_posts(self) -> "FeedAdCreate":
        if self.placement == "after" and (self.after_posts is None or self.after_posts < 1):
            raise ValueError("after_posts must be at least 1 when placement is 'after'")
        if self.placement == "first" and self.after_posts is not None:
            raise ValueError("after_posts must be null when placement is 'first'")
        return self


class FeedAdUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    website_url: Optional[str] = None
    cta_text: Optional[str] = None
    sponsor_name: Optional[str] = None
    placement: Optional[str] = None
    after_posts: Optional[int] = None
    is_active: Optional[bool] = None

    @field_validator("placement")
    @classmethod
    def validate_placement(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if value not in {"first", "after", "banner"}:
            raise ValueError("placement must be 'first', 'after', or 'banner'")
        return value

    @field_validator("after_posts")
    @classmethod
    def validate_after_posts(cls, value: Optional[int], info) -> Optional[int]:
        placement = info.data.get("placement")
        if placement == "after" and (value is None or value < 1):
            raise ValueError("after_posts must be at least 1 when placement is 'after'")
        if placement in {"first", "banner"} and value is not None:
            raise ValueError("after_posts must be null when placement is 'first' or 'banner'")
        return value


class FeedAdOut(BaseModel):
    id: int
    title: str
    description: str
    image_url: str
    website_url: str
    cta_text: str
    sponsor_name: str
    placement: str
    after_posts: Optional[int]
    is_active: bool
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
