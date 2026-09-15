import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import require_admin
from ..config import settings
from ..database import get_db

router = APIRouter(prefix="/api/settings", tags=["settings"], dependencies=[Depends(require_admin)])
public_router = APIRouter(prefix="/api/public/appearance", tags=["public"])

LOGIN_PANEL_IMAGE_KEY = "login_panel_image_url"
LOGIN_PANEL_TITLE_KEY = "login_panel_title"
LOGIN_PANEL_SUBTITLE_KEY = "login_panel_subtitle"
LOGIN_APPEARANCE_KEYS = {LOGIN_PANEL_IMAGE_KEY, LOGIN_PANEL_TITLE_KEY, LOGIN_PANEL_SUBTITLE_KEY}


class EmailTestRequest(BaseModel):
    email: str


class LoginImageUrlRequest(BaseModel):
    url: str


class LoginPanelTextRequest(BaseModel):
    title: str
    subtitle: str


def _to_out(s: models.AppSetting) -> schemas.SettingOut:
    return schemas.SettingOut(
        id=s.id,
        key=s.key,
        label=s.label,
        category=s.category,
        is_secret=s.is_secret,
        value="" if s.is_secret else (s.value or ""),
        has_value=bool(s.value),
        updated_at=s.updated_at,
    )


@router.get("", response_model=list[schemas.SettingOut])
def list_settings(db: Session = Depends(get_db)):
    rows = db.query(models.AppSetting).order_by(models.AppSetting.category, models.AppSetting.label).all()
    return [_to_out(s) for s in rows]


@router.put("", response_model=list[schemas.SettingOut])
def replace_settings(
    payload: list[schemas.SettingIn],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    if any(item.key in LOGIN_APPEARANCE_KEYS for item in payload) and not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="শুধু Super Admin login appearance পরিবর্তন করতে পারবেন")
    existing = {s.key: s for s in db.query(models.AppSetting).all()}

    for item in payload:
        row = existing.get(item.key)
        # For secret fields, a blank value means "leave the stored secret alone".
        new_value = item.value
        if item.is_secret and not item.value and row is not None:
            new_value = row.value

        if row is None:
            row = models.AppSetting(
                key=item.key, label=item.label, category=item.category, is_secret=item.is_secret, value=new_value
            )
            db.add(row)
        else:
            row.label = item.label
            row.category = item.category
            row.is_secret = item.is_secret
            row.value = new_value

    db.commit()
    rows = db.query(models.AppSetting).order_by(models.AppSetting.category, models.AppSetting.label).all()
    return [_to_out(s) for s in rows]


@public_router.get("/login")
def get_login_appearance(db: Session = Depends(get_db)):
    rows = {
        row.key: row.value or ""
        for row in db.query(models.AppSetting).filter(models.AppSetting.key.in_(LOGIN_APPEARANCE_KEYS)).all()
    }
    return {
        "panel_image_url": rows.get(LOGIN_PANEL_IMAGE_KEY, ""),
        "panel_title": rows.get(LOGIN_PANEL_TITLE_KEY, ""),
        "panel_subtitle": rows.get(LOGIN_PANEL_SUBTITLE_KEY, ""),
    }


@router.post("/login-image")
async def upload_login_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    if not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="শুধু Super Admin login image পরিবর্তন করতে পারবেন")

    allowed_types = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    extension = allowed_types.get(file.content_type or "")
    if not extension:
        raise HTTPException(status_code=400, detail="JPG, PNG অথবা WEBP image দিন")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="খালি image file upload করা যাবে না")
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Login image সর্বোচ্চ 8 MB হতে পারবে")

    os.makedirs(settings.upload_dir, exist_ok=True)
    filename = f"login_panel_{uuid.uuid4().hex[:12]}{extension}"
    destination = os.path.join(settings.upload_dir, filename)
    with open(destination, "wb") as output:
        output.write(content)

    image_url = f"/{settings.upload_dir}/{filename}"
    row = db.query(models.AppSetting).filter(models.AppSetting.key == LOGIN_PANEL_IMAGE_KEY).first()
    old_filename = os.path.basename(row.value or "") if row else ""
    if row is None:
        row = models.AppSetting(
            key=LOGIN_PANEL_IMAGE_KEY,
            label="Login Panel Image",
            category="appearance",
            is_secret=False,
            value=image_url,
        )
        db.add(row)
    else:
        row.value = image_url
        row.label = "Login Panel Image"
        row.category = "appearance"
        row.is_secret = False
    db.commit()

    if old_filename.startswith("login_panel_"):
        old_path = os.path.join(settings.upload_dir, old_filename)
        if old_path != destination and os.path.isfile(old_path):
            os.remove(old_path)

    return {"panel_image_url": image_url}


@router.put("/login-image-url")
def set_login_image_url(
    payload: LoginImageUrlRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    if not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="শুধু Super Admin login image পরিবর্তন করতে পারবেন")

    image_url = payload.url.strip()
    if not image_url.lower().startswith(("https://", "http://")):
        raise HTTPException(status_code=400, detail="সঠিক http:// অথবা https:// image URL দিন")

    row = db.query(models.AppSetting).filter(models.AppSetting.key == LOGIN_PANEL_IMAGE_KEY).first()
    old_filename = os.path.basename(row.value or "") if row else ""
    if row is None:
        row = models.AppSetting(
            key=LOGIN_PANEL_IMAGE_KEY,
            label="Login Panel Image",
            category="appearance",
            is_secret=False,
            value=image_url,
        )
        db.add(row)
    else:
        row.value = image_url
        row.label = "Login Panel Image"
        row.category = "appearance"
        row.is_secret = False
    db.commit()

    if old_filename.startswith("login_panel_"):
        old_path = os.path.join(settings.upload_dir, old_filename)
        if os.path.isfile(old_path):
            os.remove(old_path)

    return {"panel_image_url": image_url}


@router.put("/login-panel-text")
def set_login_panel_text(
    payload: LoginPanelTextRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    if not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="শুধু Super Admin login text পরিবর্তন করতে পারবেন")

    title = payload.title.strip()
    subtitle = payload.subtitle.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Login card title খালি রাখা যাবে না")
    if len(title) > 160 or len(subtitle) > 240:
        raise HTTPException(status_code=400, detail="Title অথবা subtitle অনেক বড়")

    values = {
        LOGIN_PANEL_TITLE_KEY: ("Login Panel Title", title),
        LOGIN_PANEL_SUBTITLE_KEY: ("Login Panel Subtitle", subtitle),
    }
    existing = {
        row.key: row
        for row in db.query(models.AppSetting).filter(models.AppSetting.key.in_(values)).all()
    }
    for key, (label, value) in values.items():
        row = existing.get(key)
        if row is None:
            db.add(models.AppSetting(key=key, label=label, category="appearance", is_secret=False, value=value))
        else:
            row.label = label
            row.category = "appearance"
            row.is_secret = False
            row.value = value
    db.commit()
    return {"panel_title": title, "panel_subtitle": subtitle}


@router.post("/email/test")
def send_test_email(payload: EmailTestRequest):
    # Local import avoids coupling application startup to the public router.
    from .public import _send_email_detailed

    recipient = payload.email.strip()
    if not recipient or "@" not in recipient:
        raise HTTPException(status_code=400, detail="একটি সঠিক test recipient email লিখুন।")

    sent, error = _send_email_detailed(
        recipient,
        "Quantum CRM — SMTP Test Successful",
        """
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px">
          <h2 style="color:#155EEF">SMTP সংযোগ সফল হয়েছে</h2>
          <p>Quantum CRM থেকে এই test email সফলভাবে পাঠানো হয়েছে।</p>
        </div>
        """,
    )
    if not sent:
        raise HTTPException(status_code=400, detail=error)
    return {"sent": True, "message": "Test email সফলভাবে পাঠানো হয়েছে।"}
