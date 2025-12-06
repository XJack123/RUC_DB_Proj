from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from .. import models, schemas, database
from datetime import datetime

router = APIRouter(
    prefix="/tasks",
    tags=["tasks"],
    responses={404: {"description": "Not found"}},
)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=schemas.CollectionTask)
def create_task(
    name: str = Form(...),
    description: str = Form(None),
    deadline: str = Form(...),
    email_subject: str = Form(None),
    email_body: str = Form(None),
    teacher_ids: List[int] = Form([]),
    file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    import shutil
    import os
    from pathlib import Path
    
    # Save file if present
    template_path = None
    if file:
        base_dir = Path(__file__).resolve().parent.parent.parent
        storage_dir = base_dir / "storage"
        storage_dir.mkdir(exist_ok=True)
        
        filename = f"template_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
        file_path = storage_dir / filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        template_path = str(file_path)

    # Create Task
    db_task = models.CollectionTask(
        name=name,
        description=description,
        deadline=datetime.fromisoformat(deadline) if deadline else None,
        email_subject=email_subject,
        email_body=email_body,
        template_path=template_path
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # Assign Teachers
    if teacher_ids:
        teachers = db.query(models.Teacher).filter(models.Teacher.id.in_(teacher_ids)).all()
    else:
        teachers = db.query(models.Teacher).all()

    for teacher in teachers:
        submission = models.TaskSubmission(
            task_id=db_task.id,
            teacher_id=teacher.id,
            status="pending"
        )
        db.add(submission)
    
    # Log Activity
    log = models.ActivityLog(
        type="task",
        message=f"创建了新任务: {db_task.name}"
    )
    db.add(log)
    
    db.commit()
    
    return db_task

@router.get("/", response_model=List[schemas.CollectionTask])
def read_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    tasks = db.query(models.CollectionTask).offset(skip).limit(limit).all()
    return tasks

@router.get("/{task_id}", response_model=schemas.CollectionTask)
def read_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.CollectionTask).filter(models.CollectionTask.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

from ..services.email_service import email_service

@router.post("/{task_id}/remind")
def remind_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.CollectionTask).filter(models.CollectionTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    submissions = db.query(models.TaskSubmission).filter(
        models.TaskSubmission.task_id == task_id,
        func.lower(models.TaskSubmission.status) != "replied"
    ).all()
    
    success_count = 0
    failure_count = 0
    now = datetime.now()
    
    # Default email content if not set
    default_subject = f"Reminder: {task.name}"
    default_body = f"Dear Teacher,\n\nThis is a reminder to submit your data for the task: {task.name}.\nDeadline: {task.deadline}\n\nPlease reply to this email with your submission.\n\nBest regards,\nAdmin"
    
    subject = task.email_subject or default_subject
    body = task.email_body or default_body

    for sub in submissions:
        teacher = db.query(models.Teacher).filter(models.Teacher.id == sub.teacher_id).first()
        if teacher and teacher.email:
            try:
                email_service.send_email(teacher.email, subject, body, task.template_path)
                
                sub.last_reminded_at = now
                if not sub.sent_at:
                    sub.sent_at = now
                if (sub.status or "").lower() != "replied":
                    sub.status = "reminded"
                success_count += 1
            except Exception as e:
                print(f"Failed to send reminder to {teacher.email}: {e}")
                failure_count += 1
    
    db.commit()
    
    msg = f"Sent reminders to {success_count} teachers."
    if failure_count > 0:
        msg += f" Failed to send to {failure_count} teachers. Check server logs for details."
        
    return {
        "message": msg,
        "success_count": success_count,
        "failure_count": failure_count
    }

@router.get("/{task_id}/submissions", response_model=List[schemas.TaskSubmission])
def read_task_submissions(task_id: int, db: Session = Depends(get_db)):
    submissions = db.query(models.TaskSubmission).filter(models.TaskSubmission.task_id == task_id).all()
    return submissions

@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.CollectionTask).filter(models.CollectionTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Delete associated submissions first
    db.query(models.TaskSubmission).filter(models.TaskSubmission.task_id == task_id).delete()
    
    # Delete the task
    db.delete(task)
    db.commit()
    
    return {"message": "Task deleted successfully"}

@router.put("/{task_id}", response_model=schemas.CollectionTask)
def update_task(
    task_id: int,
    name: str = Form(None),
    description: str = Form(None),
    deadline: str = Form(None),
    email_subject: str = Form(None),
    email_body: str = Form(None),
    teacher_ids: List[int] = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    import shutil
    import os
    from pathlib import Path

    db_task = db.query(models.CollectionTask).filter(models.CollectionTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update fields if provided
    if name is not None: db_task.name = name
    if description is not None: db_task.description = description
    if deadline is not None: db_task.deadline = datetime.fromisoformat(deadline)
    if email_subject is not None: db_task.email_subject = email_subject
    if email_body is not None: db_task.email_body = email_body

    # Handle file update
    if file:
        base_dir = Path(__file__).resolve().parent.parent.parent
        storage_dir = base_dir / "storage"
        storage_dir.mkdir(exist_ok=True)
        
        filename = f"template_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
        file_path = storage_dir / filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        db_task.template_path = str(file_path)
    
    # Handle teacher_ids update if provided
    if teacher_ids is not None:
        new_teacher_ids = set(teacher_ids)
        
        # Get current submissions
        current_submissions = db.query(models.TaskSubmission).filter(models.TaskSubmission.task_id == task_id).all()
        current_teacher_ids = {sub.teacher_id for sub in current_submissions}
        
        # Determine teachers to add and remove
        teachers_to_add = new_teacher_ids - current_teacher_ids
        teachers_to_remove = current_teacher_ids - new_teacher_ids
        
        # Add new submissions
        for teacher_id in teachers_to_add:
            new_submission = models.TaskSubmission(
                task_id=task_id,
                teacher_id=teacher_id,
                status="pending"
            )
            db.add(new_submission)
            
        # Remove old submissions
        if teachers_to_remove:
            db.query(models.TaskSubmission).filter(
                models.TaskSubmission.task_id == task_id,
                models.TaskSubmission.teacher_id.in_(teachers_to_remove)
            ).delete(synchronize_session=False)

    db.commit()
    db.refresh(db_task)
    return db_task

@router.put("/submissions/{submission_id}", response_model=schemas.TaskSubmission)
def update_submission(submission_id: int, submission: schemas.TaskSubmissionUpdate, db: Session = Depends(get_db)):
    db_submission = db.query(models.TaskSubmission).filter(models.TaskSubmission.id == submission_id).first()
    if not db_submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission.status:
        db_submission.status = submission.status
        if submission.status == 'replied' and not db_submission.reply_received_at:
            db_submission.reply_received_at = datetime.now()
            
    if submission.attachment_path:
        db_submission.attachment_path = submission.attachment_path
    
    db.commit()
    db.refresh(db_submission)
    
    # Log Activity if status changed to replied
    if submission.status == 'replied':
        teacher_name = db_submission.teacher.name if db_submission.teacher else f"ID {db_submission.teacher_id}"
        log = models.ActivityLog(
            type="submission",
            message=f"标记 {teacher_name} 为已回复"
        )
        db.add(log)
        db.commit()
        
    return db_submission
