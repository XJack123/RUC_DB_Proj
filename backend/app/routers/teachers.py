from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from .. import crud, models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/teachers",
    tags=["teachers"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=schemas.Teacher)
def create_teacher(teacher: schemas.TeacherCreate, db: Session = Depends(get_db)):
    db_teacher = crud.get_teacher_by_email(db, email=teacher.email)
    if db_teacher:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    department_id = teacher.department_id
    if not department_id and teacher.department_name:
        # create or fetch by name
        dept = crud.get_department_by_name(db, teacher.department_name)
        if not dept:
            dept = crud.create_department(db, schemas.DepartmentCreate(name=teacher.department_name))
        department_id = dept.id
    if not department_id:
        raise HTTPException(status_code=400, detail="Department is required")
    
    teacher.department_id = department_id
    new_teacher = crud.create_teacher(db=db, teacher=teacher)
    
    # Log Activity
    log = models.ActivityLog(
        type="teacher",
        message=f"添加了新教师: {new_teacher.name}"
    )
    db.add(log)
    db.commit()
    
    return new_teacher

@router.get("/", response_model=List[schemas.Teacher])
def read_teachers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    teachers = crud.get_teachers(db, skip=skip, limit=limit)
    return teachers

@router.put("/{teacher_id}", response_model=schemas.Teacher)
def update_teacher(teacher_id: int, teacher: schemas.TeacherUpdate, db: Session = Depends(get_db)):
    db_teacher = crud.get_teacher(db, teacher_id=teacher_id)
    if db_teacher is None:
        raise HTTPException(status_code=404, detail="Teacher not found")
    # Email uniqueness check if changing email
    if teacher.email and teacher.email != db_teacher.email:
        if crud.get_teacher_by_email(db, email=teacher.email):
            raise HTTPException(status_code=400, detail="Email already registered")
    updated = crud.update_teacher(db, teacher_id=teacher_id, teacher=teacher)
    return updated

@router.delete("/{teacher_id}")
def delete_teacher(teacher_id: int, db: Session = Depends(get_db)):
    db_teacher = crud.get_teacher(db, teacher_id=teacher_id)
    if db_teacher is None:
        raise HTTPException(status_code=404, detail="Teacher not found")
    crud.delete_teacher(db, teacher_id=teacher_id)
    return {"message": "Teacher deleted"}

@router.post("/upload")
async def upload_teachers(file: UploadFile = File(...), db: Session = Depends(get_db)):
    import pandas as pd
    import io
    
    contents = await file.read()
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Invalid file format")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")

    # Expected columns: name, email, department, title
    required_cols = ['name', 'email', 'department']
    for col in required_cols:
        if col not in df.columns:
             raise HTTPException(status_code=400, detail=f"Missing column: {col}")

    count = 0
    errors = []
    for index, row in df.iterrows():
        try:
            # Find or create department
            dept_name = row['department']
            dept = crud.get_department_by_name(db, dept_name)
            if not dept:
                dept = crud.create_department(db, schemas.DepartmentCreate(name=dept_name))
            
            # Create teacher
            teacher_data = schemas.TeacherCreate(
                name=row['name'],
                email=row['email'],
                title=row.get('title', ''),
                department_id=dept.id
            )
            # Check if exists
            if not crud.get_teacher_by_email(db, row['email']):
                crud.create_teacher(db, teacher_data)
                count += 1
        except Exception as e:
            errors.append(f"Row {index}: {str(e)}")
            
    # Log Activity
    if count > 0:
        log = models.ActivityLog(
            type="teacher",
            message=f"批量导入了 {count} 位教师"
        )
        db.add(log)
        db.commit()

    return {"message": f"Successfully imported {count} teachers", "errors": errors}

@router.get("/export")
def export_teachers(db: Session = Depends(get_db)):
    # In a real app, this would return a file stream
    # For now, we return JSON which frontend can convert to CSV
    teachers = crud.get_teachers(db)
    data = []
    for t in teachers:
        data.append({
            "name": t.name,
            "email": t.email,
            "department": t.department.name if t.department else "",
            "title": t.title,
            "status": "Active" if getattr(t, 'is_active', 1) else "Inactive"
        })
    return data

@router.get("/departments", response_model=List[schemas.Department])
def list_departments(db: Session = Depends(get_db)):
    return crud.get_departments(db)

@router.get("/{teacher_id}", response_model=schemas.Teacher)
def read_teacher(teacher_id: int, db: Session = Depends(get_db)):
    db_teacher = crud.get_teacher(db, teacher_id=teacher_id)
    if db_teacher is None:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return db_teacher
