from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models, schemas
from ..auth import require_admin
from ..database import get_db

router = APIRouter(prefix="/api/email-templates", tags=["email_templates"], dependencies=[Depends(require_admin)])

@router.get("", response_model=list[schemas.EmailTemplateOut])
def list_templates(db: Session = Depends(get_db)):
    return db.query(models.EmailTemplate).order_by(models.EmailTemplate.name).all()

@router.post("", response_model=schemas.EmailTemplateOut)
def create_template(payload: schemas.EmailTemplateCreate, db: Session = Depends(get_db)):
    t = models.EmailTemplate(**payload.model_dump())
    db.add(t); db.commit(); db.refresh(t)
    return t

@router.patch("/{tid}", response_model=schemas.EmailTemplateOut)
def update_template(tid: int, payload: schemas.EmailTemplateCreate, db: Session = Depends(get_db)):
    t = db.query(models.EmailTemplate).filter(models.EmailTemplate.id == tid).first()
    if not t: from fastapi import HTTPException; raise HTTPException(404)
    for k, v in payload.model_dump().items(): setattr(t, k, v)
    db.commit(); db.refresh(t); return t

@router.delete("/{tid}")
def delete_template(tid: int, db: Session = Depends(get_db)):
    t = db.query(models.EmailTemplate).filter(models.EmailTemplate.id == tid).first()
    if t: db.delete(t); db.commit()
    return {"ok": True}