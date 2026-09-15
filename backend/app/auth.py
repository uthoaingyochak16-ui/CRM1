from datetime import datetime, timedelta, timezone
import hashlib
from zoneinfo import ZoneInfo
# dhaka_time = expire.astimezone(ZoneInfo("Asia/Dhaka"))
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import models
from .config import settings
from .database import get_db

bearer_scheme = HTTPBearer(auto_error=False)


def validate_new_password(password: str) -> None:
    if len(password) < settings.password_min_length:
        raise HTTPException(
            status_code=400,
            detail=f"Password কমপক্ষে {settings.password_min_length} অক্ষরের হতে হবে।",
        )
    if not any(char.isalpha() for char in password) or not any(char.isdigit() for char in password):
        raise HTTPException(status_code=400, detail="Password-এ অন্তত একটি letter এবং একটি number থাকতে হবে।")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_password_reset_token(user: models.User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=30)
    fingerprint = hashlib.sha256(user.password_hash.encode("utf-8")).hexdigest()[:20]
    payload = {"sub": user.id, "purpose": "password_reset", "pwd": fingerprint, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_password_reset_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=400, detail="Reset linkটি invalid অথবা মেয়াদ শেষ।") from exc
    if payload.get("purpose") != "password_reset":
        raise HTTPException(status_code=400, detail="Reset linkটি invalid।")
    return payload


def password_fingerprint(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode("utf-8")).hexdigest()[:20]


def _decode_token(credentials: HTTPAuthorizationCredentials | None) -> dict:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        return jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired, please log in again")


def get_user_from_token(token: str, db: Session) -> models.User:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc
    user = db.query(models.User).filter(models.User.id == payload.get("sub")).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found or deactivated")
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    payload = _decode_token(credentials)
    return get_user_from_token(credentials.credentials, db)


def require_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def require_customer_access(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Customer profiles span every program, so access is a single global
    flag rather than a per-project permission. Admins always pass."""
    if current_user.role in {"admin", "user"} or current_user.can_manage_customers:
        return current_user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Client তালিকা দেখার অনুমতি আপনার নেই")


def require_customer_edit_access(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role == "admin" or (
        current_user.role != "user" and current_user.can_manage_customers
    ):
        return current_user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Client profile পরিবর্তনের অনুমতি আপনার নেই")


def require_event_create_access(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if current_user.role == "admin" or current_user.can_create_events:
        return current_user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Event তৈরি করার অনুমতি নেই")


PERMISSION_FEATURES = {
    "can_view",
    "can_view_registrations",
    "can_edit_event",
    "can_edit_fields",
    "can_publish",
    "can_export",
    "can_manage_tasks",
}


def require_permission(feature: str):
    """Dependency factory. Admins always pass. Executives need a
    ProjectPermission row for the `project_id` path param with `feature` set True."""
    assert feature in PERMISSION_FEATURES, f"Unknown permission feature: {feature}"

    def dependency(
        project_id: str,
        current_user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> models.User:
        if current_user.role == "admin":
            return current_user
        perm = (
            db.query(models.ProjectPermission)
            .filter(
                models.ProjectPermission.user_id == current_user.id,
                models.ProjectPermission.project_id == project_id,
            )
            .first()
        )
        if not perm or not getattr(perm, feature, False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="এই কাজের অনুমতি আপনার নেই")
        return current_user

    return dependency
