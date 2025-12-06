from sqlalchemy.orm import Session
from . import models, schemas

def get_teacher(db: Session, teacher_id: int):
    return db.query(models.Teacher).filter(models.Teacher.id == teacher_id).first()

def get_teacher_by_email(db: Session, email: str):
    return db.query(models.Teacher).filter(models.Teacher.email == email).first()

def get_teachers(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Teacher).offset(skip).limit(limit).all()

def create_teacher(db: Session, teacher: schemas.TeacherCreate):
    db_teacher = models.Teacher(
        name=teacher.name,
        email=teacher.email,
        title=teacher.title,
        department_id=teacher.department_id
    )
    db.add(db_teacher)
    db.commit()
    db.refresh(db_teacher)
    return db_teacher

def update_teacher(db: Session, teacher_id: int, teacher: schemas.TeacherUpdate):
    db_teacher = get_teacher(db, teacher_id)
    if not db_teacher:
        return None
    if teacher.name is not None:
        db_teacher.name = teacher.name
    if teacher.email is not None:
        db_teacher.email = teacher.email
    if teacher.title is not None:
        db_teacher.title = teacher.title
    if teacher.department_id is not None:
        db_teacher.department_id = teacher.department_id
    if teacher.is_active is not None:
        db_teacher.is_active = teacher.is_active
    db.commit()
    db.refresh(db_teacher)
    return db_teacher

def delete_teacher(db: Session, teacher_id: int):
    db_teacher = get_teacher(db, teacher_id)
    if not db_teacher:
        return False
    db.delete(db_teacher)
    db.commit()
    return True

def get_departments(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Department).offset(skip).limit(limit).all()

def get_department_by_name(db: Session, name: str):
    return db.query(models.Department).filter(models.Department.name == name).first()

def create_department(db: Session, department: schemas.DepartmentCreate):
    db_department = models.Department(name=department.name)
    db.add(db_department)
    db.commit()
    db.refresh(db_department)
    return db_department

def get_submission(db: Session, submission_id: int):
    return db.query(models.TaskSubmission).filter(models.TaskSubmission.id == submission_id).first()

def update_submission(db: Session, submission_id: int, status: str):
    db_sub = get_submission(db, submission_id)
    if not db_sub:
        return None
    db_sub.status = status
    if status == 'replied':
        from datetime import datetime
        db_sub.reply_received_at = datetime.now()
    db.commit()
    db.refresh(db_sub)
    return db_sub
