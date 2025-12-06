from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..services.llm_service import llm_service

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
)

class ChatRequest(BaseModel):
    query: str

class GenerateRequest(BaseModel):
    prompt: str

@router.post("/")
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    return llm_service.process_query(request.query, db)

@router.post("/generate")
def generate_text(request: GenerateRequest, db: Session = Depends(get_db)):
    """
    Simple text generation endpoint for UI helpers (e.g., slash commands).
    """
    try:
        # Use a simple direct call to LLM service
        response = llm_service._call_llm(request.prompt)
        return {"content": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
