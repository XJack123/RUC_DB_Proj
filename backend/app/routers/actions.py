from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
from email.utils import parseaddr
from pathlib import Path
from ..services.email_service import EmailService
from ..services.excel_service import ExcelService
from ..services.llm_service import llm_service
from .. import database, models
from sqlalchemy.orm import Session
from sqlalchemy import func


def _normalize_sender(sender: str) -> str:
    """Extract plain email address and normalize."""
    return parseaddr(sender)[1].lower()


def _resolve_path(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    p = Path(path)
    if not p.is_absolute():
        base_dir = Path(__file__).resolve().parent.parent.parent
        p = base_dir / path
    return str(p)

router = APIRouter(
    prefix="/actions",
    tags=["actions"],
)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

class EmailRequest(BaseModel):
    recipient_email: Optional[str] = None
    task_id: Optional[int] = None
    subject: str
    body: str
    department_id: Optional[int] = None  # If sending to a whole department
    attachment_path: Optional[str] = None

class MergeRequest(BaseModel):
    task_id: int
    output_filename: str = "merged_output.xlsx"

class CheckRepliesRequest(BaseModel):
    task_id: int
    task_name: Optional[str] = None
    reminder_subject: Optional[str] = None
    reminder_body: Optional[str] = None

@router.post("/send_email")
def send_email(request: EmailRequest, db: Session = Depends(get_db)):
    email_service = EmailService()

    task = None
    if request.task_id:
        task = db.query(models.CollectionTask).filter(models.CollectionTask.id == request.task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

    # Resolve recipients
    targets: List[models.Teacher] = []
    if request.department_id:
        # Send to all teachers in department
        teachers = db.query(models.Teacher).filter(models.Teacher.department_id == request.department_id).all()
        if not teachers:
            raise HTTPException(status_code=404, detail="No teachers found in department")
        targets = teachers
    elif request.recipient_email:
        teacher = db.query(models.Teacher).filter(models.Teacher.email == request.recipient_email).first()
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found for provided email")
        targets = [teacher]
    else:
        # Send to everyone when neither email nor department is specified
        targets = db.query(models.Teacher).all()

    attach_path = _resolve_path(request.attachment_path)
    now = datetime.now()
    for teacher in targets:
        email_service.send_email(teacher.email, request.subject, request.body, attach_path)
        if task:
            submission = db.query(models.TaskSubmission).filter(
                models.TaskSubmission.task_id == task.id,
                models.TaskSubmission.teacher_id == teacher.id
            ).first()
            if not submission:
                submission = models.TaskSubmission(
                    task_id=task.id,
                    teacher_id=teacher.id,
                )
                db.add(submission)
            submission.status = "sent"
            submission.sent_at = now
    if task:
        db.commit()
    
    # Log Activity
    log = models.ActivityLog(
        type="email",
        message=f"发送邮件 '{request.subject}' 给 {len(targets)} 位教师"
    )
    db.add(log)
    db.commit()
    
    return {"message": f"Emails sent to {len(targets)} teacher(s)"}

@router.post("/merge_excel")
def merge_excel(request: MergeRequest, db: Session = Depends(get_db)):
    excel_service = ExcelService()

    # Gather attachment paths from submissions for the given task
    submissions = db.query(models.TaskSubmission).filter(
        models.TaskSubmission.task_id == request.task_id,
        models.TaskSubmission.attachment_path.isnot(None)
    ).all()

    file_paths = []
    for sub in submissions:
        resolved = _resolve_path(sub.attachment_path) if sub.attachment_path else None
        if resolved and os.path.exists(resolved):
            file_paths.append(resolved)
    if not file_paths:
        raise HTTPException(status_code=404, detail="No valid attachments found to merge")

    output_path = excel_service.merge_excels(file_paths, request.output_filename)
    if not output_path:
        raise HTTPException(status_code=500, detail="Failed to merge Excel files")

    # Construct download URL
    filename = os.path.basename(output_path)
    download_url = f"/storage/{filename}"

    # Log Activity
    log = models.ActivityLog(
        type="merge",
        message=f"合并了 {len(file_paths)} 个文件 (任务ID: {request.task_id})"
    )
    db.add(log)
    db.commit()

    return {
        "message": f"Merged {len(file_paths)} files into {output_path}", 
        "output_path": output_path,
        "download_url": download_url
    }

from ..services.email_service import email_service

@router.post("/check_replies")
def check_replies(request: CheckRepliesRequest, db: Session = Depends(get_db)):
    # email_service is imported globally
    task = db.query(models.CollectionTask).filter(models.CollectionTask.id == request.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task_name = request.task_name or task.name or ""

    replies = email_service.check_replies(task_name)
    
    # Filter replies using LLM Semantic Analysis
    valid_replies = []
    for r in replies:
        # If there is an attachment, we assume it's valid (strong signal)
        # If no attachment, we check the body with LLM
        if r.get("attachment_path"):
            valid_replies.append(r)
        else:
            # Simple keyword check instead of LLM
            # User requested: check if "汇总" is in subject or body
            subject = r.get("subject", "")
            body = r.get("body", "")
            if "汇总" in subject or "汇总" in body:
                valid_replies.append(r)

    reply_map = {}
    for r in valid_replies:
        sender = _normalize_sender(r["email"])
        if sender not in reply_map:
            reply_map[sender] = r
        else:
            # Prefer reply with attachment if current one doesn't have it
            if not reply_map[sender].get("attachment_path") and r.get("attachment_path"):
                reply_map[sender] = r

    updated = 0
    for sender_email, payload in reply_map.items():
        submission = db.query(models.TaskSubmission).join(models.Teacher).filter(
            models.TaskSubmission.task_id == request.task_id,
            func.lower(models.Teacher.email) == sender_email
        ).first()
        if submission:
            submission.status = "replied"
            submission.reply_received_at = payload.get("received_at", datetime.now())
            if payload.get("attachment_path"):
                submission.attachment_path = payload["attachment_path"]
            updated += 1
    db.commit()

    # Log Activity
    if updated > 0:
        log = models.ActivityLog(
            type="check",
            message=f"检查回复 '{task_name}': 发现 {updated} 条新回复"
        )
        db.add(log)
        db.commit()
    
    all_subs = db.query(models.TaskSubmission).join(models.Teacher).filter(
        models.TaskSubmission.task_id == request.task_id
    ).all()

    missing_emails = [sub.teacher.email for sub in all_subs if (sub.status or "").lower() != "replied"]
    reminders_sent = 0
    now = datetime.now()
    if request.reminder_subject and request.reminder_body:
        for sub in all_subs:
            if (sub.status or "").lower() != "replied":
                if sub.teacher and sub.teacher.email:
                    try:
                        email_service.send_email(sub.teacher.email, request.reminder_subject, request.reminder_body)
                        sub.status = "reminded"
                        sub.last_reminded_at = now
                        reminders_sent += 1
                    except Exception as e:
                        print(f"Failed to send reminder to {sub.teacher.email}: {e}")
        
        # Log Activity
        if reminders_sent > 0:
            log = models.ActivityLog(
                type="email",
                message=f"发送催办邮件给 {reminders_sent} 位教师 (任务: '{task_name}')"
            )
            db.add(log)
        db.commit()

    return {
        "received": updated,
        "missing": len(missing_emails),
        "missing_emails": missing_emails,
        "updated_count": updated,
        "reminders_sent": reminders_sent
    }


class ExecuteSQLRequest(BaseModel):
    sql: str


@router.post("/execute_sql")
def execute_sql(request: ExecuteSQLRequest, db: Session = Depends(get_db)):
    """
    Execute SQL operations after user confirmation.
    Allows data operations (SELECT, INSERT, UPDATE, DELETE) but blocks dangerous structural operations.
    """
    import re
    from sqlalchemy import text
    
    sql = request.sql.strip()
    
    # Block dangerous operations that modify database structure
    dangerous_patterns = [
        r'\bDROP\b',
        r'\bTRUNCATE\b',
        r'\bALTER\b',
        r'\bCREATE\b',
        r'\bRENAME\b',
        r'\bGRANT\b',
        r'\bREVOKE\b',
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, sql, re.IGNORECASE):
            operation_name = pattern.strip(r'\b')
            raise HTTPException(
                status_code=403, 
                detail=f"Operation not allowed: {operation_name} commands are blocked for security reasons."
            )
    
    # Execute the SQL
    try:
        result = db.execute(text(sql))
        db.commit()
        
        # Try to get row count for DML operations
        rowcount = result.rowcount if hasattr(result, 'rowcount') else 0
        
        # For SELECT queries, fetch results
        if sql.strip().upper().startswith('SELECT'):
            rows = result.fetchall()
            return {
                "success": True,
                "message": f"Query executed successfully. {len(rows)} rows returned.",
                "data": [dict(row._mapping) for row in rows] if rows else []
            }
        else:
            # For INSERT, UPDATE, DELETE
            operation = sql.strip().split()[0].upper()
            return {
                "success": True,
                "message": f"{operation} executed successfully. {rowcount} row(s) affected."
            }
            
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"SQL execution failed: {str(e)}")

