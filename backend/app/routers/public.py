from typing import Any
from html import escape
import re
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..database import get_db
from ..email_defaults import DEFAULT_REGISTRATION_EMAIL_HTML, DEFAULT_REGISTRATION_EMAIL_SUBJECT
router = APIRouter(prefix="/api/public", tags=["public"])
email_executor = ThreadPoolExecutor(max_workers=5, thread_name_prefix="registration-email")


def _find_project(db: Session, project_ref: str) -> models.Project:
    project = (
        db.query(models.Project)
        .filter((models.Project.id == project_ref) | (models.Project.slug == project_ref))
        .first()
    )
    if project is None:
        raise HTTPException(status_code=404, detail="ইভেন্ট পাওয়া যায়নি")
    return project


def _registration_count(db: Session, project_id: str) -> int:
    return db.query(models.Registration).filter(models.Registration.project_id == project_id).count()


@router.get("/config/{project_ref}", response_model=schemas.PublicConfigOut)
def get_public_config(project_ref: str, db: Session = Depends(get_db)):
    project = _find_project(db, project_ref)
    ecard_url = (
        project.ecard_image_remote_url
        or (f"{settings.public_base_url}/{project.ecard_image_path}" if project.ecard_image_path else None)
    )
    return schemas.PublicConfigOut(
        project_id=project.id,
        name=project.name,
        published=bool(project.published),
        title_part1=project.title_part1 or "",
        title_part2=project.title_part2 or "",
        place=project.place or "",
        event_date=project.event_date,
        display_date=project.display_date or "",
        display_time=project.display_time or "",
        home_registration_instruction=project.home_registration_instruction or "",
        registration_instruction=project.registration_instruction or "",
        max_registrations=project.max_registrations,
        registrations_count=_registration_count(db, project.id),
        ecard_image_url=ecard_url,
        form_fields=list(project.form_fields),
        enable_payment=bool(project.enable_payment),
        payment_amount=int(project.payment_amount or 0),
    )


def _find_or_create_customer(db: Session, data: dict[str, Any]) -> models.Customer | None:
    mobile = str(data.get("mobile") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    full_name = str(data.get("full_name") or "").strip()

    if not mobile and not email:
        return None

    query = db.query(models.Customer)
    conditions = []
    if mobile:
        conditions.append(models.Customer.mobile == mobile)
    if email:
        conditions.append(models.Customer.email == email)
    customer = query.filter(or_(*conditions)).first() if conditions else None

    def stable_value(*keys: str):
        normalized = {
            "".join(character for character in str(key).lower() if character.isalnum()): value
            for key, value in data.items()
            if value not in (None, "")
        }
        for key in keys:
            value = normalized.get("".join(character for character in key.lower() if character.isalnum()))
            if value not in (None, ""):
                return value
        return ""

    location = stable_value("location", "address", "present_address", "ঠিকানা")
    profession = stable_value("profession", "occupation", "পেশা")
    age_value = stable_value("age", "client_age", "বয়স", "বয়স")
    date_of_birth = stable_value("date_of_birth", "dob", "birth_date", "জন্ম তারিখ")
    try:
        age = int(float(str(age_value).strip())) if age_value not in (None, "") else None
    except (TypeError, ValueError):
        age = None

    if customer is not None:
        if full_name and not customer.full_name:
            customer.full_name = full_name
        if mobile and not customer.mobile:
            customer.mobile = mobile
        if email and not customer.email:
            customer.email = email
        if location and not customer.location:
            customer.location = str(location)
        if profession and not customer.profession:
            customer.profession = str(profession)
        if age is not None and customer.age is None:
            customer.age = age
        if date_of_birth and not (customer.extra_data or {}).get("date_of_birth"):
            customer.extra_data = {**(customer.extra_data or {}), "date_of_birth": date_of_birth}
        return customer

    customer = models.Customer(
        full_name=full_name,
        mobile=mobile,
        email=email,
        location=str(location or ""),
        profession=str(profession or ""),
        age=age,
        extra_data={"date_of_birth": date_of_birth} if date_of_birth else {},
    )
    db.add(customer)
    db.flush()  # get customer.id without committing yet
    return customer


@router.post("/registrations/{project_ref}", response_model=schemas.RegistrationOut)
def submit_registration(project_ref: str, payload: schemas.RegistrationCreate, db: Session = Depends(get_db)):
    project = _find_project(db, project_ref)

    if project.max_registrations is not None and project.max_registrations > 0:
        current_count = _registration_count(db, project.id)
        if current_count >= project.max_registrations:
            raise HTTPException(status_code=400, detail="দুঃখিত, রেজিস্ট্রেশনের নির্ধারিত সংখ্যা পূর্ণ হয়ে গেছে।")

    fields = project.form_fields
    cleaned: dict[str, Any] = {}
    for field in fields:
        value = payload.data.get(field.key, "")
        if (field.required or field.type == "tel") and not str(value).strip():
            raise HTTPException(status_code=400, detail=f'"{field.label}" ফিল্ডটি আবশ্যক')
        cleaned[field.key] = value

    customer = _find_or_create_customer(db, cleaned)

    registration = models.Registration(project_id=project.id, data=cleaned, customer_id=customer.id if customer else None)
    db.add(registration)
    db.flush()  # get registration.id before the task references it

    lead_name = cleaned.get("full_name") or (customer.full_name if customer else "") or "Unknown"
    task = models.Task(
        title=f"New registration — {lead_name} ({project.name})",
        description="",
        assigned_to=None,  # empty -> unassigned (DB schema may be non-nullable)
        created_by=None,
        project_id=project.id,
        registration_id=registration.id,
        customer_id=customer.id if customer else None,
    )
    db.add(task)

    db.commit()
    db.refresh(registration)

    email_sent = False
    email_status = "not_requested"
    if project.auto_email_on_registration and customer and customer.email:
        subject = project.registration_email_subject or DEFAULT_REGISTRATION_EMAIL_SUBJECT
        html = project.registration_email_html or DEFAULT_REGISTRATION_EMAIL_HTML
        if project.email_template_registration:
            try:
                template_id = int(project.email_template_registration)
                template = db.query(models.EmailTemplate).filter(
                    models.EmailTemplate.id == template_id
                ).first()
                if template:
                    subject = template.subject
                    html = template.html_body
            except (ValueError, TypeError):
                pass
        rendered_subject = _render_template(
            subject,
            customer,
            project,
            registration,
            include_registration_details=False,
        )
        rendered_html = _render_template(html, customer, project, registration)
        cc_list = (
            list(project.registration_email_cc_list or [])
            if project.registration_email_cc_enabled
            else []
        )
        registration.email_status = "pending"
        registration.email_error = ""
        db.commit()
        email_status = "pending"
        email_executor.submit(
            _deliver_registration_email,
            registration.id,
            customer.email,
            rendered_subject,
            rendered_html,
            cc_list,
        )

    return {
        "id": registration.id,
        "reg_id": registration.reg_id,
        "project_id": registration.project_id,
        "data": registration.data,
        "created_at": registration.created_at,
        "requires_payment": bool(project.enable_payment),
        "email_sent": email_sent,
        "email_status": email_status,
    }


@router.get("/registrations/{project_ref}/{reg_id}/email-status")
def registration_email_status(
    project_ref: str, reg_id: str, db: Session = Depends(get_db)
):
    project = _find_project(db, project_ref)
    registration = (
        db.query(models.Registration)
        .filter(
            models.Registration.project_id == project.id,
            models.Registration.reg_id == reg_id,
        )
        .first()
    )
    if registration is None:
        raise HTTPException(status_code=404, detail="Registration not found")
    status = registration.email_status or "not_requested"
    return {"status": status, "email_sent": status == "sent"}


def _deliver_registration_email(
    registration_id: int,
    to: str,
    subject: str,
    html: str,
    cc: list[str],
) -> None:
    sent, error = _send_email_detailed(to, subject, html, cc)
    db = SessionLocal()
    try:
        registration = (
            db.query(models.Registration)
            .filter(models.Registration.id == registration_id)
            .first()
        )
        if registration is not None:
            registration.email_status = "sent" if sent else "failed"
            registration.email_error = "" if sent else error[:1000]
            db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to update registration email status")
    finally:
        db.close()

def _render_template(
    html: str,
    customer,
    project,
    registration,
    include_registration_details: bool = True,
) -> str:
    field_labels = {field.key: field.label for field in project.form_fields}
    details = [("Registration ID", registration.reg_id or "")]
    for key, value in (registration.data or {}).items():
        details.append((field_labels.get(key) or _titleize(key), value))
    details.append(("Registered On", registration.created_at or ""))

    detail_rows = []
    for index, (label, value) in enumerate(details):
        border = "border-bottom:1px solid #e2e8f0;" if index < len(details) - 1 else ""
        safe_value = ", ".join(map(str, value)) if isinstance(value, list) else str(value or "—")
        detail_rows.append(
            "<tr>"
            f'<td style="padding:10px 0;color:#64748b;vertical-align:top;{border}">{escape(str(label))}</td>'
            f'<td align="right" style="padding:10px 0 10px 16px;font-weight:bold;color:#334155;'
            f'word-break:break-word;vertical-align:top;{border}">{escape(safe_value)}</td>'
            "</tr>"
        )

    details_html = "".join(detail_rows)
    legacy_default_markers = (
        "{{reg_id}}",
        "{{customer_name}}",
        "{{event_title}}",
        "{{event_date}}",
        "{{event_place}}",
    )
    if (
        include_registration_details
        and "{{registration_details}}" not in html
        and all(marker in html for marker in legacy_default_markers)
    ):
        html = re.sub(
            r'(<table[^>]*style="[^"]*font-size:14px[^"]*"[^>]*>).*?(</table>)',
            r"\1{{registration_details}}\2",
            html,
            count=1,
            flags=re.IGNORECASE | re.DOTALL,
        )

    # Every registration email must contain the event's current form fields.
    # Custom/library templates do not need to add the placeholder manually.
    if include_registration_details and "{{registration_details}}" not in html:
        automatic_details = (
            '<div style="margin:24px 0;padding:18px;border:1px solid #e2e8f0;'
            'border-radius:14px;background:#ffffff">'
            '<h2 style="margin:0 0 10px;color:#0f172a;font-size:16px">'
            "Registration Details</h2>"
            '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
            'style="font-size:14px">'
            f"{details_html}</table></div>"
        )
        closing_body = html.lower().rfind("</body>")
        html = (
            html[:closing_body] + automatic_details + html[closing_body:]
            if closing_body >= 0
            else html + automatic_details
        )

    replacements = {
        "{{customer_name}}": customer.full_name or "",
        "{{mobile}}": customer.mobile or "",
        "{{email}}": customer.email or "",
        "{{event_title}}": f"{project.title_part1} {project.title_part2}".strip(),
        "{{event_date}}": str(project.display_date or project.event_date or ""),
        "{{event_place}}": project.place or "",
        "{{reg_id}}": registration.reg_id or "",
        "{{slip_no}}": registration.reg_id or "",
        "{{amount}}": "",
        "{{registration_details}}": details_html,
    }
    for k, v in replacements.items():
        html = html.replace(k, v)
    return html


def _titleize(key: str) -> str:
    return str(key or "").replace("_", " ").title()

import logging
import smtplib
import ssl
from email.utils import formataddr
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from ..database import SessionLocal

logger = logging.getLogger(__name__)

def _send_email(to: str, subject: str, html: str, cc: list[str] | None = None) -> bool:
    sent, _ = _send_email_detailed(to, subject, html, cc)
    return sent


def _send_email_detailed(
    to: str, subject: str, html: str, cc: list[str] | None = None
) -> tuple[bool, str]:
    db = SessionLocal()
    try:
        smtp_host = _get_setting(db, "email_smtp_host")
        smtp_port = int(_get_setting(db, "email_smtp_port") or "587")
        smtp_user = _get_setting(db, "email_smtp_user")
        smtp_pass = _get_setting(db, "email_smtp_password")
        from_name = _get_setting(db, "email_from_name") or "Quantum Method"
        if not smtp_host or not smtp_user or not smtp_pass:
            return False, "SMTP Host, User এবং Password—সবগুলো পূরণ করুন।"
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = formataddr((from_name, smtp_user))
        msg["To"] = to
        clean_cc = list(dict.fromkeys(
            email.strip().lower()
            for email in (cc or [])
            if email and email.strip() and email.strip().lower() != to.strip().lower()
        ))
        if clean_cc:
            msg["Cc"] = ", ".join(clean_cc)
        msg.attach(MIMEText(html, "html"))

        context = ssl.create_default_context()
        if smtp_port == 465:
            smtp = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20, context=context)
        else:
            smtp = smtplib.SMTP(smtp_host, smtp_port, timeout=20)
        with smtp as s:
            if smtp_port != 465:
                s.ehlo()
                s.starttls(context=context)
                s.ehlo()
            s.login(smtp_user, smtp_pass)
            s.sendmail(smtp_user, [to, *clean_cc], msg.as_string())
        return True, ""
    except smtplib.SMTPAuthenticationError:
        message = "SMTP login ব্যর্থ। Email/User এবং App Password সঠিক কি না দেখুন।"
        logger.warning("Registration email SMTP authentication failed for %s", to)
        return False, message
    except (smtplib.SMTPException, OSError, ValueError) as exc:
        logger.warning("Registration email delivery failed for %s: %s", to, exc)
        return False, f"SMTP connection/send ব্যর্থ: {exc}"
    finally:
        db.close()

def _get_setting(db, key: str) -> str:
    s = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
    return s.value if s else ""
