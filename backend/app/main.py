from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from fastapi.staticfiles import StaticFiles
import os

load_dotenv()

from .database import engine, Base, get_db
from . import models, crud, schemas
from .routers import teachers, chat, tasks, stats, actions, config

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Data Aggregation Tool")

# Ensure storage directory exists
os.makedirs("storage", exist_ok=True)
app.mount("/storage", StaticFiles(directory="storage"), name="storage")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://10.47.93.106:5173",
        "http://10.47.93.106:8000",
        "http://192.168.0.177:5173",
        "http://1.92.67.161:5173",
        "http://1.92.67.161:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(teachers.router)
app.include_router(tasks.router)
app.include_router(stats.router)
app.include_router(actions.router)
app.include_router(config.router)
app.include_router(chat.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to the Data Aggregation Tool API"}


@app.post("/init_db")
def init_db(db: Session = Depends(get_db)):
    """
    Seed departments with the full list if the table is empty.
    """
    if not crud.get_departments(db):
        deps = [
            "\u9a6c\u514b\u601d\u4e3b\u4e49\u5b66\u9662",
            "\u7eaa\u68c0\u76d1\u5bdf\u5b66\u9662",
            "\u4e2d\u5171\u515a\u53f2\u515a\u5efa\u5b66\u9662",
            "\u5916\u56fd\u8bed\u5b66\u9662",
            "\u54f2\u5b66\u9662",
            "\u56fd\u5b66\u9662",
            "\u5386\u53f2\u5b66\u9662",
            "\u6587\u5b66\u9662",
            "\u827a\u672f\u5b66\u9662",
            "\u56fd\u9645\u6587\u5316\u4ea4\u6d41\u5b66\u9662",
            "\u52b3\u52a8\u4eba\u4e8b\u5b66\u9662",
            "\u8d22\u653f\u91d1\u878d\u5b66\u9662",
            "\u7ecf\u6d4e\u5b66\u9662",
            "\u751f\u6001\u73af\u5883\u5b66\u9662",
            "\u5e94\u7528\u7ecf\u6d4e\u5b66\u9662",
            "\u548c\u5e73\u4e0e\u53d1\u5c55\u5b66\u9662",
            "\u6cd5\u5b66\u9662\uff08\u77e5\u8bc6\u4ea7\u6743\u5b66\u9662\u3001\u5f8b\u5e08\u5b66\u9662\uff09",
            "\u65b0\u95fb\u5b66\u9662",
            "\u56fd\u9645\u5173\u7cfb\u5b66\u9662",
            "\u793e\u4f1a\u5b66\u9662",
            "\u4eba\u53e3\u4e0e\u5065\u5eb7\u5b66\u9662",
            "\u5546\u5b66\u9662",
            "\u516c\u5171\u7ba1\u7406\u5b66\u9662",
            "\u4fe1\u606f\u8d44\u6e90\u7ba1\u7406\u5b66\u9662",
            "\u519c\u4e1a\u4e0e\u519c\u6751\u53d1\u5c55\u5b66\u9662",
            "\u6559\u80b2\u5b66\u9662",
            "\u5fc3\u7406\u5b66\u7cfb",
            "\u4fe1\u606f\u5b66\u9662",
            "\u9ad8\u74fd\u4eba\u5de5\u667a\u80fd\u5b66\u9662",
            "\u7edf\u8ba1\u5b66\u9662",
            "\u7edf\u8ba1\u4e0e\u5927\u6570\u636e\u7814\u7a76\u9662",
            "\u7269\u7406\u5b66\u9662",
            "\u6570\u5b66\u5b66\u9662",
            "\u5316\u5b66\u4e0e\u751f\u547d\u8d44\u6e90\u5b66\u9662",
        ]
        for d in deps:
            crud.create_department(db, schemas.DepartmentCreate(name=d))
    return {"message": "Database initialized"}
