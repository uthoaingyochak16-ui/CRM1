from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, hash_password, require_admin, validate_new_password
from ..database import get_db
from .notifications import notify

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(require_admin)])

VALID_ROLES = {"admin", "executive", "user"}


def _get_or_404(db: Session, user_id: str) -> models.User:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()


@router.post("", response_model=schemas.UserOut)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    username = payload.username.lower().strip()
    phone = payload.phone.strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Phone Number আবশ্যক")
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Role অবশ্যই admin, communicator অথবা user হতে হবে")
    validate_new_password(payload.password)
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে")
    if not username or not all(char.isalnum() or char in "._-" for char in username):
        raise HTTPException(status_code=400, detail="Username-এ শুধু letter, number, dot, underscore ও hyphen ব্যবহার করুন")
    if db.query(models.User).filter(models.User.username == username).first():
        raise HTTPException(status_code=400, detail="এই Username ইতিমধ্যে ব্যবহৃত হচ্ছে")

    user = models.User(
        name=payload.name,
        username=username,
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        phone=phone,
        designation=payload.designation.strip(),
        center=payload.center.strip(),
        can_manage_customers=payload.role == "user",
        can_manual_lead_entry=payload.role == "user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: str,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user = _get_or_404(db, user_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        data["name"] = (data["name"] or "").strip()
        if not data["name"]:
            raise HTTPException(status_code=400, detail="নাম খালি রাখা যাবে না")
    if "username" in data:
        data["username"] = (data["username"] or "").lower().strip()
        if not data["username"] or not all(char.isalnum() or char in "._-" for char in data["username"]):
            raise HTTPException(status_code=400, detail="Username-এ শুধু letter, number, dot, underscore ও hyphen ব্যবহার করুন")
        duplicate_username = db.query(models.User).filter(
            models.User.username == data["username"],
            models.User.id != user_id,
        ).first()
        if duplicate_username:
            raise HTTPException(status_code=400, detail="এই Username অন্য account-এ ব্যবহৃত হচ্ছে")
    if "email" in data:
        data["email"] = (data["email"] or "").lower().strip()
        if not data["email"] or "@" not in data["email"]:
            raise HTTPException(status_code=400, detail="সঠিক email address দিন")
        duplicate = (
            db.query(models.User)
            .filter(models.User.email == data["email"], models.User.id != user_id)
            .first()
        )
        if duplicate is not None:
            raise HTTPException(status_code=400, detail="এই email address অন্য account-এ ব্যবহৃত হচ্ছে")
    if "phone" in data:
        data["phone"] = (data["phone"] or "").strip()
        if not data["phone"]:
            raise HTTPException(status_code=400, detail="Phone Number আবশ্যক")
    if "role" in data and data["role"] not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Role অবশ্যই admin, communicator অথবা user হতে হবে")
    if "role" in data and data["role"] != user.role and not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="শুধু Super Admin account role পরিবর্তন করতে পারবেন")
    if user.is_super_admin and data.get("role") not in (None, "admin"):
        raise HTTPException(status_code=400, detail="Super Admin role পরিবর্তন করা যাবে না")
    if data.get("role") == "user":
        data["can_manage_customers"] = True
        data["can_manual_lead_entry"] = True
    for limit_field in ("daily_task_limit", "daily_followup_limit"):
        if limit_field in data and data[limit_field] is not None and data[limit_field] < 1:
            raise HTTPException(status_code=400, detail="Daily limit কমপক্ষে ১ হতে হবে, অথবা Limitless নির্বাচন করুন")
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/reset-password")
def reset_password(user_id: str, payload: schemas.UserResetPassword, db: Session = Depends(get_db)):
    user = _get_or_404(db, user_id)
    validate_new_password(payload.new_password)
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"ok": True}


@router.delete("/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db)):
    user = _get_or_404(db, user_id)
    db.delete(user)
    db.commit()
    return {"ok": True}


# ── Access control (per-project, per-feature permissions) ──


@router.get("/{user_id}/permissions", response_model=list[schemas.PermissionOut])
def list_permissions(user_id: str, db: Session = Depends(get_db)):
    _get_or_404(db, user_id)
    rows = (
        db.query(models.ProjectPermission)
        .filter(models.ProjectPermission.user_id == user_id)
        .all()
    )
    out = []
    for r in rows:
        item = schemas.PermissionOut.model_validate(r)
        item.project_name = r.project.name if r.project else None
        out.append(item)
    return out


@router.put("/{user_id}/permissions", response_model=list[schemas.PermissionOut])
def replace_permissions(user_id: str, payload: list[schemas.PermissionIn], db: Session = Depends(get_db)):
    user = _get_or_404(db, user_id)
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Admin অ্যাকাউন্টের জন্য access control প্রযোজ্য নয়, তারা সবসময় সব অ্যাকসেস পায়")

    db.query(models.ProjectPermission).filter(models.ProjectPermission.user_id == user_id).delete()
    for p in payload:
        db.add(models.ProjectPermission(user_id=user_id, **p.model_dump()))
        
    if payload:
        notify(db, user_id, "আপনার অ্যাকসেস পারমিশন আপডেট করা হয়েছে", "access_granted", "/admin/events")
    db.commit()

    rows = (
        db.query(models.ProjectPermission)
        .filter(models.ProjectPermission.user_id == user_id)
        .all()
    )
    out = []
    for r in rows:
        item = schemas.PermissionOut.model_validate(r)
        item.project_name = r.project.name if r.project else None
        out.append(item)
    return out
