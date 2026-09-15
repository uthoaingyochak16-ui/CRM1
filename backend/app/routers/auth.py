from datetime import datetime
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import (
    create_access_token, create_password_reset_token, decode_password_reset_token,
    get_current_user, hash_password, password_fingerprint, validate_new_password, verify_password,
)
from ..database import get_db
from ..config import settings
from ..rate_limit import rate_limiter

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/forgot-password")
def forgot_password(payload: schemas.ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    rate_limiter.check(
        request, scope="forgot-password", limit=settings.reset_rate_limit,
        window_seconds=settings.reset_rate_window_seconds,
    )
    email = payload.email.lower().strip()
    user = db.query(models.User).filter(models.User.email == email, models.User.is_active.is_(True)).first()
    if user:
        from .public import _send_email_detailed
        token = create_password_reset_token(user)
        frontend_url = (settings.cors_origin_list[0] if settings.cors_origin_list else settings.public_base_url).rstrip("/")
        reset_url = f"{frontend_url}/reset-password?token={token}"
        _send_email_detailed(
            user.email,
            "Quantum CRM — Password Reset",
            f"""
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#344054">
              <h2 style="color:#2554C7">Password reset করুন</h2>
              <p>আপনার Quantum CRM account-এর নতুন password সেট করতে নিচের button-এ click করুন।</p>
              <p style="margin:28px 0"><a href="{reset_url}" style="background:#2554C7;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">নতুন Password সেট করুন</a></p>
              <p style="font-size:12px;color:#667085">এই link ৩০ মিনিট পর্যন্ত কার্যকর থাকবে। আপনি এই request না করলে emailটি উপেক্ষা করুন।</p>
            </div>
            """,
        )
    return {"message": "এই email-এ account থাকলে password reset link পাঠানো হয়েছে।"}


@router.post("/reset-password")
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    validate_new_password(payload.new_password)
    token_data = decode_password_reset_token(payload.token)
    user = db.query(models.User).filter(models.User.id == token_data.get("sub"), models.User.is_active.is_(True)).first()
    if not user or token_data.get("pwd") != password_fingerprint(user.password_hash):
        raise HTTPException(status_code=400, detail="Reset linkটি invalid অথবা ইতিমধ্যে ব্যবহার করা হয়েছে।")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password সফলভাবে পরিবর্তন হয়েছে। এখন login করুন।"}


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    rate_limiter.check(
        request, scope="login", limit=settings.login_rate_limit,
        window_seconds=settings.login_rate_window_seconds, record=False,
    )
    login_id = (payload.username or payload.email or "").lower().strip()
    user = db.query(models.User).filter(
        or_(models.User.username == login_id, models.User.email == login_id),
    ).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        rate_limiter.check(
            request, scope="login", limit=settings.login_rate_limit,
            window_seconds=settings.login_rate_window_seconds,
        )
        raise HTTPException(status_code=401, detail="Email/username অথবা password ভুল")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="এই অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে")

    if user.role == "executive":
        now = datetime.utcnow()
        open_sessions = (
            db.query(models.ExecutiveSession)
            .filter(
                models.ExecutiveSession.user_id == user.id,
                models.ExecutiveSession.logout_at.is_(None),
            )
            .all()
        )
        for session in open_sessions:
            session.logout_at = session.last_heartbeat_at or now
        db.add(
            models.ExecutiveSession(
                user_id=user.id,
                login_at=now,
                last_heartbeat_at=now,
            )
        )
        db.commit()

    token = create_access_token(user.id, user.role)
    rate_limiter.reset(request, scope="login")
    return schemas.TokenResponse(access_token=token, user=user)


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.patch("/profile", response_model=schemas.UserOut)
def update_own_profile(
    payload: schemas.OwnProfileUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = payload.name.strip()
    email = payload.email.lower().strip()
    if not name:
        raise HTTPException(status_code=400, detail="Full name লিখুন")
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="সঠিক email address লিখুন")
    phone = payload.phone.strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Phone Number আবশ্যক")
    duplicate = (
        db.query(models.User)
        .filter(models.User.email == email, models.User.id != current_user.id)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="এই email দিয়ে অন্য account আছে")

    current_user.name = name
    current_user.email = email
    current_user.phone = phone
    current_user.designation = payload.designation.strip()
    current_user.center = payload.center.strip()
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/profile-image", response_model=schemas.UserOut)
async def upload_own_profile_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allowed_types = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    extension = allowed_types.get(file.content_type or "")
    if not extension:
        raise HTTPException(status_code=400, detail="JPG, PNG, WEBP অথবা GIF image দিন")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Profile image সর্বোচ্চ 5 MB হতে পারবে")

    os.makedirs(settings.upload_dir, exist_ok=True)
    filename = f"profile_{current_user.id}_{uuid.uuid4().hex[:10]}{extension}"
    destination = os.path.join(settings.upload_dir, filename)
    with open(destination, "wb") as output:
        output.write(content)

    old_filename = os.path.basename(current_user.profile_image_url or "")
    current_user.profile_image_url = f"/{settings.upload_dir}/{filename}"
    db.commit()
    db.refresh(current_user)

    if old_filename.startswith(f"profile_{current_user.id}_"):
        old_path = os.path.join(settings.upload_dir, old_filename)
        if old_path != destination and os.path.isfile(old_path):
            os.remove(old_path)
    return current_user


@router.post("/logout")
def logout(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    open_sessions = db.query(models.ExecutiveSession).filter(
        models.ExecutiveSession.user_id == current_user.id,
        models.ExecutiveSession.logout_at.is_(None),
    ).all()
    for session in open_sessions:
        session.logout_at = session.last_heartbeat_at or datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/change-password")
def change_own_password(
    payload: schemas.ChangeOwnPasswordRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="বর্তমান পাসওয়ার্ড ভুল")
    validate_new_password(payload.new_password)
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"ok": True}
