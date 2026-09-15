from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/registrations", tags=["registrations"])


@router.get("/{registration_id}", response_model=schemas.RegistrationOut)
def get_registration(
    registration_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Get a single registration by its integer ID.
    """
    reg = db.query(models.Registration).filter(models.Registration.id == registration_id).first()
    if reg is None:
        raise HTTPException(status_code=404, detail="Registration not found")

    # Basic authorization: only admin or users with permission for the project can view
    if current_user.role != "admin":
        permission = (
            db.query(models.ProjectPermission)
            .filter(
                models.ProjectPermission.user_id == current_user.id,
                models.ProjectPermission.project_id == reg.project_id,
                models.ProjectPermission.can_view_registrations.is_(True),
            )
            .first()
        )
        if permission is None:
            raise HTTPException(status_code=403, detail="You do not have permission to view this registration.")

    return reg
