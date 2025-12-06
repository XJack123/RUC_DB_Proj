import os
import json
import requests
import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy import text
from .. import models, database

class LLMService:
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "mock").lower()
        self.api_key = os.getenv("DEEPSEEK_API_KEY")
        self.api_base = "https://api.deepseek.com/v1"
        
        # System prompts
        self.sql_system_prompt = """
        You are a SQL expert. Convert the user's natural language query into a SQL query for a SQLite database.
        The database has the following schema:
        - departments (id, name)
        - teachers (id, name, email, title, department_id, is_active)
        - collection_tasks (id, name, description, deadline, status, template_path)
        - task_submissions (id, task_id, teacher_id, status, sent_at, last_reminded_at, reply_received_at, attachment_path)
        
        Return ONLY the SQL query. Do not include markdown formatting or explanations.
        Return ONLY the SQL query. Do not include markdown formatting or explanations.
        """
        self._load_config_from_db()

    def _load_config_from_db(self):
        try:
            db = database.SessionLocal()
            configs = db.query(models.SystemConfig).all()
            config_map = {c.key: c.value for c in configs}
            db.close()
            
            if "llm_provider" in config_map: self.provider = config_map["llm_provider"]
            if "api_key" in config_map: self.api_key = config_map["api_key"]
            
        except Exception as e:
            print(f"Failed to load config from DB: {e}")


    def process_query(self, query: str, db: Session) -> Dict[str, Any]:
        """
        Main entry point for Chat Interface.
        Determines intent and executes appropriate logic.
        """
        # Log the incoming query
        self._log(db, "INFO", "LLM", "Query Received", query, query)
        
        try:
            # 1. Intent Classification
            intent = self._classify_intent(query)
            
            if intent == "sql":
                return self._handle_text_to_sql(query, db)
            elif intent == "email_draft":
                return self._handle_email_draft(query, db)
            else:
                return {"type": "text", "content": "I'm not sure how to help with that yet. Try asking to 'list teachers' or 'draft an email'."}
                
        except Exception as e:
            self._log(db, "ERROR", "LLM", "Processing Error", str(e), query)
            return {"type": "error", "content": f"An error occurred: {str(e)}"}

    def analyze_reply(self, email_content: str, task_name: str) -> bool:
        """
        Analyze if an email content is a valid reply to the task.
        """
        if self.provider == "mock":
            # Simple keyword match for mock
            return task_name in email_content or "attachment" in email_content.lower()
        
        prompt = f"""
        Analyze the following email content and determine if it is a valid submission for the task '{task_name}'.
        Return JSON: {{"is_valid": true/false, "reason": "..."}}
        
        Email Content:
        {email_content[:500]}...
        """
        try:
            response = self._call_llm(prompt)
            data = json.loads(response)
            return data.get("is_valid", False)
        except:
            return False

    def _classify_intent(self, query: str) -> str:
        q = query.lower()
        if any(x in q for x in ["email", "draft", "write", "send", "remind"]):
            return "email_draft"
        return "sql"

    def _handle_text_to_sql(self, query: str, db: Session) -> Dict[str, Any]:
        if self.provider == "mock":
            sql = self._mock_text_to_sql(query)
        else:
            prompt = f"User Query: {query}"
            sql = self._call_llm(prompt, system_prompt=self.sql_system_prompt)
            # Clean up SQL (remove markdown code blocks if present)
            sql = sql.replace("```sql", "").replace("```", "").strip()
            
        self._log(db, "INFO", "LLM", "SQL Generated", sql, query)
        
        # Safety check
        if any(x in sql.lower() for x in ["delete", "drop", "update", "insert"]):
             return {
                "type": "confirmation",
                "action": "execute_sql",
                "sql": sql,
                "risk": "high",
                "message": "This operation modifies data. Please confirm."
            }

        # Execute read-only queries immediately for preview
        try:
            cursor = db.execute(text(sql))
            columns = cursor.keys()
            rows = cursor.fetchall()
            data = [dict(zip(columns, row)) for row in rows]
            
            return {
                "type": "data_view",
                "sql": sql,
                "data": data,
                "message": f"Found {len(data)} results."
            }
        except Exception as e:
             return {"type": "error", "content": f"SQL Execution failed: {str(e)}"}

    def _handle_email_draft(self, query: str, db: Session) -> Dict[str, Any]:
        if self.provider == "mock":
            subject = "Reminder: Annual Data Collection"
            body = "Dear Teacher,\n\nPlease submit your annual data by Friday.\n\nBest,\nAdmin"
        else:
            prompt = f"""
            Draft a professional email based on this request: "{query}".
            Return JSON: {{"subject": "...", "body": "..."}}
            """
            try:
                response = self._call_llm(prompt)
                data = json.loads(response)
                subject = data.get("subject", "No Subject")
                body = data.get("body", "No Body")
            except:
                subject = "Error generating email"
                body = "Could not generate email."

        return {
            "type": "email_draft",
            "subject": subject,
            "body": body,
            "recipients_count": 0 
        }

    def _call_llm(self, prompt: str, system_prompt: str = None) -> str:
        if not self.api_key:
            return ""
            
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        data = {
            "model": "deepseek-chat",
            "messages": messages,
            "temperature": 0.1
        }
        
        try:
            resp = requests.post(f"{self.api_base}/chat/completions", headers=headers, json=data, timeout=30)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"LLM Call Failed: {e}")
            return ""

    def _mock_text_to_sql(self, query: str) -> str:
        q = query.lower()
        if "teacher" in q:
            if "count" in q:
                return "SELECT count(*) as count FROM teachers WHERE is_active = 1"
            return "SELECT name, email, title FROM teachers WHERE is_active = 1 LIMIT 10"
        if "department" in q:
            return "SELECT * FROM departments"
        return "SELECT * FROM teachers LIMIT 5"

    def _log(self, db: Session, level: str, module: str, action: str, content: str, user_query: str = None):
        log_entry = models.SystemLog(
            level=level,
            module=module,
            action=action,
            content=str(content),
            user_query=user_query
        )
        db.add(log_entry)
        db.commit()

llm_service = LLMService()
# Config reloaded
