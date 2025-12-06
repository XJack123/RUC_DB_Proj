from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from .. import models, database

router = APIRouter(
    prefix="/stats",
    tags=["stats"],
)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/")
def get_stats(db: Session = Depends(get_db)):
    total_teachers = db.query(models.Teacher).count()
    active_tasks = db.query(models.CollectionTask).filter(func.lower(models.CollectionTask.status) == "active").count()
    
    # Count pending replies (submissions that are sent/reminded but not completed)
    pending_replies = db.query(models.TaskSubmission).filter(
        func.lower(models.TaskSubmission.status) != "replied",
        models.TaskSubmission.sent_at.isnot(None)
    ).count()
    
    # Count total emails sent (mock logic: sum of sent_at not null)
    emails_sent = db.query(models.TaskSubmission).filter(models.TaskSubmission.sent_at.isnot(None)).count()

    # Calculate Completion Rate
    total_submissions = db.query(models.TaskSubmission).count()
    replied_submissions = db.query(models.TaskSubmission).filter(func.lower(models.TaskSubmission.status) == "replied").count()
    
    completion_rate = 0
    if total_submissions > 0:
        completion_rate = int((replied_submissions / total_submissions) * 100)
    
    return {
        "total_teachers": total_teachers,
        "active_tasks": active_tasks,
        "pending_replies": pending_replies,
        "emails_sent": emails_sent,
        "completion_rate": completion_rate
    }

@router.get("/activity")
def get_recent_activity(db: Session = Depends(get_db)):
    logs = db.query(models.ActivityLog).order_by(models.ActivityLog.created_at.desc()).limit(10).all()
    
    activities = []
    for log in logs:
        activities.append({
            "action": log.message,
            "details": log.type.capitalize() if log.type else "System",
            "timestamp": log.created_at.isoformat()
        })
        
    return activities
