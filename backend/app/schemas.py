from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import List, Optional
from datetime import datetime

class DepartmentBase(BaseModel):
    name: str

class DepartmentCreate(DepartmentBase):
    pass

class Department(DepartmentBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class TeacherBase(BaseModel):
    name: str
    email: EmailStr
    title: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    is_active: int = 1

class TeacherCreate(TeacherBase):
    pass

class TeacherUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    title: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[int] = None

class Teacher(TeacherBase):
    id: int
    department: Department
    model_config = ConfigDict(from_attributes=True)

class TaskSubmissionBase(BaseModel):
    status: str = "pending"

class TaskSubmissionCreate(TaskSubmissionBase):
    task_id: int
    teacher_id: int

class TaskSubmission(TaskSubmissionBase):
    id: int
    task_id: Optional[int] = None
    teacher_id: Optional[int] = None
    sent_at: Optional[datetime]
    last_reminded_at: Optional[datetime]
    reply_received_at: Optional[datetime]
    attachment_path: Optional[str]
    
    teacher: Optional[Teacher] = None

    model_config = ConfigDict(from_attributes=True)

class TaskSubmissionUpdate(BaseModel):
    status: Optional[str] = None
    attachment_path: Optional[str] = None

class CollectionTaskBase(BaseModel):
    name: str
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    status: str = "active"

class CollectionTaskCreate(CollectionTaskBase):
    template_path: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    teacher_ids: Optional[List[int]] = None # For selecting specific teachers

class CollectionTask(CollectionTaskBase):
    id: int
    template_path: Optional[str]
    email_subject: Optional[str]
    email_body: Optional[str]
    submissions: List[TaskSubmission] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
