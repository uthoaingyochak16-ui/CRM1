import os
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, require_admin, require_event_create_access, require_permission
from ..config import settings
from ..database import get_db
from ..email_defaults import DEFAULT_REGISTRATION_EMAIL_HTML, DEFAULT_REGISTRATION_EMAIL_SUBJECT

router = APIRouter(prefix="/api/projects", tags=["projects"])

PROFESSION_OPTIONS = ["Student", "Teacher", "Doctor", "Engineer", "Lawyer", "Officer", "Police", "Banker", "Scientist", "Accountant", "Artist", "Journalist", "Businessman", "Housewife", "Retiree", "Other"]

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or uuid.uuid4().hex[:8]


def _unique_slug(db: Session, base: str) -> str:
    slug = base
    i = 2
    while db.query(models.Project).filter(models.Project.slug == slug).first() is not None:
        slug = f"{base}-{i}"
        i += 1
    return slug


def _to_out(db: Session, p: models.Project) -> schemas.ProjectOut:
    ecard_url = (
        p.ecard_image_remote_url
        or (f"{settings.public_base_url}/{p.ecard_image_path}" if p.ecard_image_path else None)
    )
    count = db.query(models.Registration).filter(models.Registration.project_id == p.id).count()
    return schemas.ProjectOut(
        id=p.id,
        name=p.name,
        slug=p.slug,
        published=p.published,
        title_part1=p.title_part1,
        title_part2=p.title_part2,
        place=p.place,
        event_date=p.event_date,
        display_date=p.display_date,
        display_time=p.display_time,
        home_registration_instruction=p.home_registration_instruction or "",
        registration_instruction=p.registration_instruction,
        max_registrations=p.max_registrations,
        registrations_count=count,
        ecard_image_url=ecard_url,
        ecard_image_remote_url=p.ecard_image_remote_url or "",
        created_at=p.created_at,
        updated_at=p.updated_at,
        enable_payment=bool(p.enable_payment),
        payment_amount=int(p.payment_amount or 0),
        auto_email_on_registration=bool(p.auto_email_on_registration),
        auto_email_on_payment=bool(p.auto_email_on_payment),
        email_template_registration=p.email_template_registration or "",
        registration_email_subject=p.registration_email_subject or DEFAULT_REGISTRATION_EMAIL_SUBJECT,
        registration_email_html=p.registration_email_html or DEFAULT_REGISTRATION_EMAIL_HTML,
        registration_email_cc_enabled=bool(p.registration_email_cc_enabled),
        registration_email_cc_list=list(p.registration_email_cc_list or []),
        email_template_payment=p.email_template_payment or "",
    )


def _get_or_404(db: Session, project_id: str) -> models.Project:
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("", response_model=list[schemas.ProjectOut])
def list_projects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == "admin":
        projects = db.query(models.Project).order_by(models.Project.created_at.desc()).all()
    else:
        allowed_ids = [
            p.project_id
            for p in db.query(models.ProjectPermission)
            .filter(models.ProjectPermission.user_id == current_user.id, models.ProjectPermission.can_view.is_(True))
            .all()
        ]
        projects = (
            db.query(models.Project)
            .filter(models.Project.id.in_(allowed_ids))
            .order_by(models.Project.created_at.desc())
            .all()
            if allowed_ids
            else []
        )
    return [_to_out(db, p) for p in projects]


@router.post("", response_model=schemas.ProjectOut)
def create_project(
    payload: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_event_create_access),
):
    slug = _unique_slug(db, _slugify(payload.name))
    project = models.Project(name=payload.name, slug=slug)
    db.add(project)
    db.commit()
    db.refresh(project)

    # Seed the default field set used by the original registration form
    defaults = [
        ("full_name", "Full Name / পূর্ণ নাম", "text", "আপনার পূর্ণ নাম লিখুন", True, []),
        ("mobile", "Phone Number / ফোন নাম্বার", "tel", "01XXXXXXXXX", True, []),
        ("email", "Email / ইমেইল", "email", "example@email.com", False, []),
        ("date_of_birth", "Date of Birth / জন্ম তারিখ", "date", "", False, []),
        ("profession", "Profession / পেশা", "select", "পেশা নির্বাচন করুন", False, PROFESSION_OPTIONS),
        ("location", "Present Location / বর্তমান অবস্থান", "text", "আপনার বর্তমান অবস্থান লিখুন", False, []),
        ("remark", "Remark / মন্তব্য", "textarea", "আপনার মন্তব্য লিখুন", False, []),
    ]
    for i, (key, label, ftype, placeholder, required, options) in enumerate(defaults):
        db.add(
            models.FormField(
                project_id=project.id,
                key=key,
                label=label,
                type=ftype,
                placeholder=placeholder,
                required=required,
                options=options,
                position=i,
            )
        )
    db.commit()
    db.refresh(project)
    if current_user.role != "admin":
        db.add(models.ProjectPermission(
            user_id=current_user.id,
            project_id=project.id,
            can_view=True,
            can_view_registrations=True,
            can_edit_event=True,
            can_edit_fields=True,
            can_publish=True,
            can_export=True,
            can_manage_tasks=True,
        ))
        db.commit()
    return _to_out(db, project)


@router.get("/{project_id}", response_model=schemas.ProjectOut, dependencies=[Depends(require_permission("can_view"))])
def get_project(project_id: str, db: Session = Depends(get_db)):
    return _to_out(db, _get_or_404(db, project_id))


@router.patch("/{project_id}/rename", response_model=schemas.ProjectOut, dependencies=[Depends(require_admin)])
def rename_project(project_id: str, payload: schemas.ProjectRename, db: Session = Depends(get_db)):
    project = _get_or_404(db, project_id)
    project.name = payload.name
    db.commit()
    db.refresh(project)
    return _to_out(db, project)


@router.patch(
    "/{project_id}/event",
    response_model=schemas.ProjectOut,
    dependencies=[Depends(require_permission("can_edit_event"))],
)
def update_event(project_id: str, payload: schemas.ProjectEventUpdate, db: Session = Depends(get_db)):
    project = _get_or_404(db, project_id)
    for field, value in payload.model_dump().items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return _to_out(db, project)


@router.patch(
    "/{project_id}/publish",
    response_model=schemas.ProjectOut,
    dependencies=[Depends(require_permission("can_publish"))],
)
def toggle_publish(project_id: str, db: Session = Depends(get_db)):
    project = _get_or_404(db, project_id)
    project.published = not project.published
    db.commit()
    db.refresh(project)
    return _to_out(db, project)


@router.delete("/{project_id}", dependencies=[Depends(require_admin)])
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = _get_or_404(db, project_id)
    for registration in project.registrations:
        exists = db.query(models.ArchivedLead).filter(
            models.ArchivedLead.original_registration_id == registration.id
        ).first()
        if exists is None:
            db.add(models.ArchivedLead(
                original_registration_id=registration.id,
                reg_id=registration.reg_id or "",
                event_id=project.id,
                event_name=project.name,
                customer_id=registration.customer_id,
                data=dict(registration.data or {}),
                registered_at=registration.created_at,
            ))
    db.flush()
    if project.ecard_image_path:
        path = os.path.join(settings.upload_dir, os.path.basename(project.ecard_image_path))
        if os.path.exists(path):
            os.remove(path)
    db.delete(project)
    db.commit()
    return {"ok": True}


@router.post(
    "/{project_id}/ecard",
    response_model=schemas.ProjectOut,
    dependencies=[Depends(require_permission("can_edit_event"))],
)
async def upload_ecard(project_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    project = _get_or_404(db, project_id)
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    os.makedirs(settings.upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".png"
    filename = f"{project_id}-{uuid.uuid4().hex[:8]}{ext}"
    dest = os.path.join(settings.upload_dir, filename)
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)

    if project.ecard_image_path:
        old_path = os.path.join(settings.upload_dir, os.path.basename(project.ecard_image_path))
        if os.path.exists(old_path):
            os.remove(old_path)

    project.ecard_image_path = f"{settings.upload_dir}/{filename}"
    project.ecard_image_remote_url = None
    db.commit()
    db.refresh(project)
    return _to_out(db, project)


@router.delete(
    "/{project_id}/ecard",
    response_model=schemas.ProjectOut,
    dependencies=[Depends(require_permission("can_edit_event"))],
)
def remove_ecard(project_id: str, db: Session = Depends(get_db)):
    project = _get_or_404(db, project_id)
    if project.ecard_image_path:
        path = os.path.join(settings.upload_dir, os.path.basename(project.ecard_image_path))
        if os.path.exists(path):
            os.remove(path)
        project.ecard_image_path = None
    project.ecard_image_remote_url = None
    db.commit()
    db.refresh(project)
    return _to_out(db, project)


# ── Form fields ──


@router.get(
    "/{project_id}/fields",
    response_model=list[schemas.FormFieldOut],
    dependencies=[Depends(require_permission("can_view"))],
)
def list_fields(project_id: str, db: Session = Depends(get_db)):
    project = _get_or_404(db, project_id)
    return project.form_fields


@router.put(
    "/{project_id}/fields",
    response_model=list[schemas.FormFieldOut],
    dependencies=[Depends(require_permission("can_edit_fields"))],
)
def replace_fields(project_id: str, fields: list[schemas.FormFieldIn], db: Session = Depends(get_db)):
    project = _get_or_404(db, project_id)

    keys = [f.key for f in fields]
    if len(keys) != len(set(keys)):
        raise HTTPException(status_code=400, detail="Field key duplicate করা যাবে না")

    db.query(models.FormField).filter(models.FormField.project_id == project_id).delete()
    for i, f in enumerate(fields):
        db.add(
            models.FormField(
                project_id=project_id,
                key=f.key,
                label=f.label,
                type=f.type,
                placeholder=f.placeholder,
                required=f.required,
                options=f.options,
                position=i,
            )
        )
    db.commit()
    project = _get_or_404(db, project_id)
    return project.form_fields


# ── Registrations ──


@router.get(
    "/{project_id}/registrations",
    response_model=list[schemas.RegistrationOut],
    dependencies=[Depends(require_permission("can_view_registrations"))],
)
def list_registrations(project_id: str, db: Session = Depends(get_db)):
    _get_or_404(db, project_id)
    return (
        db.query(models.Registration)
        .filter(models.Registration.project_id == project_id)
        .order_by(models.Registration.created_at.desc())
        .all()
    )


@router.delete(
    "/{project_id}/registrations/{registration_id}",
    dependencies=[Depends(require_permission("can_view_registrations"))],
)
def delete_registration(project_id: str, registration_id: int, db: Session = Depends(get_db)):
    reg = (
        db.query(models.Registration)
        .filter(models.Registration.project_id == project_id, models.Registration.id == registration_id)
        .first()
    )
    if reg is None:
        raise HTTPException(status_code=404, detail="Registration not found")
    db.delete(reg)
    db.commit()
    return {"ok": True}
