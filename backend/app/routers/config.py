from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .. import database, models
from typing import Dict, Any

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

class SettingsUpdate(BaseModel):
    settings: Dict[str, str]

@router.get("/")
def get_settings(db: Session = Depends(get_db)):
    configs = db.query(models.SystemConfig).all()
    return {c.key: c.value for c in configs}

@router.post("/")
def update_settings(update: SettingsUpdate, db: Session = Depends(get_db)):
    for key, value in update.settings.items():
        config = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
        if config:
            config.value = value
        else:
            config = models.SystemConfig(key=key, value=value)
            db.add(config)
    db.commit()
    return {"message": "Settings updated successfully"}
