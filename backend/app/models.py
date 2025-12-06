from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .database import Base
import datetime

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

    teachers = relationship("Teacher", back_populates="department")

class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    title = Column(String)
    department_id = Column(Integer, ForeignKey("departments.id"))
    is_active = Column(Integer, default=1) # 1=Active, 0=Inactive

    department = relationship("Department", back_populates="teachers")
    submissions = relationship("TaskSubmission", back_populates="teacher")

class CollectionTask(Base):
    __tablename__ = "collection_tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String)
    deadline = Column(DateTime)
    status = Column(String, default="active") # active, completed
    template_path = Column(String, nullable=True)
    email_subject = Column(String, nullable=True)
    email_body = Column(String, nullable=True)

    submissions = relationship("TaskSubmission", back_populates="task")

class TaskSubmission(Base):
    __tablename__ = "task_submissions"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("collection_tasks.id"))
    teacher_id = Column(Integer, ForeignKey("teachers.id"))
    status = Column(String, default="pending") # pending, sent, replied, reminded
    sent_at = Column(DateTime, nullable=True)
    last_reminded_at = Column(DateTime, nullable=True)
    reply_received_at = Column(DateTime, nullable=True)
    attachment_path = Column(String, nullable=True)

    task = relationship("CollectionTask", back_populates="submissions")
    teacher = relationship("Teacher", back_populates="submissions")

class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.now)
    level = Column(String, default="INFO") # INFO, WARN, ERROR
    module = Column(String) # e.g., "LLM", "Email", "System"
    action = Column(String) # e.g., "Text-to-SQL", "Send Email"
    content = Column(String) # JSON or text details
    user_query = Column(String, nullable=True) # Original user prompt if applicable

class SystemConfig(Base):
    __tablename__ = "system_config"

    key = Column(String, primary_key=True, index=True)
    value = Column(String)

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String) # task, email, teacher, system
    message = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.now)
