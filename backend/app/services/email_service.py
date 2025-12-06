import os
import smtplib
import imaplib
import email
import socket
import re
from email.header import decode_header
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email import encoders
from typing import List, Optional
from datetime import datetime, timedelta
from pathlib import Path
import mimetypes

# 假设你的项目结构中有这些模块，如果报错请调整引用
from .. import database, models

class EmailService:
    """
    Email helper. Mock mode writes files locally; real mode uses SMTP/IMAP.
    """

    def __init__(self, mock_mode: Optional[bool] = None):
        env_mock = str(os.getenv("EMAIL_MOCK", "true")).lower() == "true"
        self.mock_mode = env_mock if mock_mode is None else mock_mode

        # Paths
        base_dir = Path(__file__).resolve().parent.parent.parent
        storage_dir = base_dir / "storage"
        storage_dir.mkdir(exist_ok=True)
        mock_dir = base_dir / "mock_email_server"
        self.mock_inbox = mock_dir / "inbox"
        self.mock_sent = mock_dir / "sent"

        if self.mock_mode:
            self.mock_inbox.mkdir(parents=True, exist_ok=True)
            self.mock_sent.mkdir(parents=True, exist_ok=True)

        # SMTP/IMAP config (strip quotes if present)
        self.smtp_host = self._clean_env(os.getenv("SMTP_HOST"))
        self.smtp_port = int(os.getenv("SMTP_PORT", "465"))
        self.smtp_user = self._clean_env(os.getenv("SMTP_USER"))
        self.smtp_pass = self._clean_env(os.getenv("SMTP_PASS"))

        self.imap_host = self._clean_env(os.getenv("IMAP_HOST"))
        self.imap_port = int(os.getenv("IMAP_PORT", "993"))
        self.imap_user = self._clean_env(os.getenv("IMAP_USER")) or self.smtp_user
        self.imap_pass = self._clean_env(os.getenv("IMAP_PASS")) or self.smtp_pass

        self.download_dir = storage_dir
        
        # Load from DB
        self._load_config_from_db()

    def _load_config_from_db(self):
        try:
            db = database.SessionLocal()
            configs = db.query(models.SystemConfig).all()
            config_map = {c.key: c.value for c in configs}
            db.close()
            
            if "smtp_server" in config_map: self.smtp_host = config_map["smtp_server"]
            if "smtp_port" in config_map: self.smtp_port = int(config_map["smtp_port"])
            if "email_user" in config_map: self.smtp_user = config_map["email_user"]
            if "email_password" in config_map: self.smtp_pass = config_map["email_password"]
            
            # Update IMAP as well if needed, or assume same credentials
            self.imap_user = self.smtp_user
            self.imap_pass = self.smtp_pass
            
        except Exception as e:
            print(f"Failed to load config from DB: {e}")

    # ---------- Sending ----------
    def send_email(self, to_email: str, subject: str, body: str, attachment_path: Optional[str] = None):
        # Always reload config from DB to ensure we have the latest credentials
        self._load_config_from_db()

        if self.mock_mode:
            print(f"[MOCK EMAIL] Sending to {to_email}: {subject}")
            filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{to_email}.txt"
            with open(self.mock_sent / filename, "w", encoding="utf-8") as f:
                f.write(f"To: {to_email}\nSubject: {subject}\nBody: {body}\nAttachment: {attachment_path}")
            return True

        if not all([self.smtp_host, self.smtp_user, self.smtp_pass]):
            raise RuntimeError("SMTP configuration is missing. Please set SMTP_HOST/SMTP_USER/SMTP_PASS.")

        msg = MIMEMultipart()
        msg["From"] = self.smtp_user
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain", "utf-8"))

        if attachment_path and os.path.exists(attachment_path):
            from email.header import Header
            
            ctype, encoding = mimetypes.guess_type(attachment_path)
            if ctype is None or encoding is not None:
                ctype = 'application/octet-stream'
            
            maintype, subtype = ctype.split('/', 1)
            
            if maintype == 'text':
                with open(attachment_path) as f:
                    part = MIMEText(f.read(), _subtype=subtype)
            else:
                part = MIMEBase(maintype, subtype)
                with open(attachment_path, "rb") as f:
                    part.set_payload(f.read())
                encoders.encode_base64(part)
            
            filename = Path(attachment_path).name
            encoded_filename = Header(filename, 'utf-8').encode()
            
            part.add_header("Content-Disposition", "attachment", filename=encoded_filename)
            msg.attach(part)

        def _send_tls(port: int):
            print(f"[EMAIL] Connecting via TLS to {self.smtp_host}:{port}...")
            with smtplib.SMTP(self.smtp_host, port, timeout=30) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(self.smtp_user, self.smtp_pass)
                server.sendmail(self.smtp_user, [to_email], msg.as_string())

        def _send_ssl(port: int):
            print(f"[EMAIL] Connecting via SSL to {self.smtp_host}:{port}...")
            import ssl
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(self.smtp_host, port, context=context, timeout=30) as server:
                server.ehlo()
                server.login(self.smtp_user, self.smtp_pass)
                server.sendmail(self.smtp_user, [to_email], msg.as_string())

        try:
            use_tls = self.smtp_port == 587 or str(os.getenv("SMTP_USE_TLS", "")).lower() == "true"
            if use_tls:
                _send_tls(self.smtp_port)
            else:
                try:
                    _send_ssl(self.smtp_port)
                except Exception as ssl_err:
                    print(f"[EMAIL WARN] SSL failed ({ssl_err}), retrying with TLS on 587...")
                    _send_tls(587)
        except smtplib.SMTPResponseException as e:
            print(f"[EMAIL WARN] smtp response error (ignored): {e}")
            return True
        except smtplib.SMTPServerDisconnected as e:
             if "EOF" in str(e) or "violation of protocol" in str(e):
                 print("[EMAIL WARN] Treating EOF/Disconnect as success (User Request)")
                 return True
             raise RuntimeError(f"SMTP Connection Failed: {e}")
        except Exception as e:
            if "EOF" in str(e) or "violation of protocol" in str(e):
                 print(f"[EMAIL WARN] SSL EOF Error ignored: {e}")
                 return True
            print(f"[EMAIL ERROR] sending to {to_email}: {e}")
            raise
        return True

    # ---------- Reading (Optimized) ----------
    def check_replies(self, task_name: str) -> List[dict]:
        """
        Scans inbox for emails with subject containing task_name (e.g., 'xxx汇总').
        Returns list of {email, attachment_path, received_at}
        """
        if self.mock_mode:
            return self._check_replies_mock(task_name)

        if not all([self.imap_host, self.imap_user, self.imap_pass]):
            raise RuntimeError("IMAP configuration is missing. Please set IMAP_HOST/IMAP_USER/IMAP_PASS.")

        matches = []
        mail = None
        try:
            # Set global timeout to avoid hanging indefinitely
            socket.setdefaulttimeout(30)
            
            print(f"[IMAP] Connecting to {self.imap_host}...")
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port)
            mail.login(self.imap_user, self.imap_pass)
            mail.select("INBOX")

            # Search for emails received in the last 30 days
            since_date = (datetime.now() - timedelta(days=30)).strftime("%d-%b-%Y")
            criteria = f'(SINCE "{since_date}")'.encode("utf-8")
            
            # IMAP Search returns IDs
            status, data = mail.search("UTF-8", criteria)
            if status != "OK" or not data[0]:
                return matches

            msg_ids = data[0].split()
            print(f"[IMAP] Found {len(msg_ids)} emails since {since_date}. Scanning last 200...")

            # Limit to last 200 emails to avoid timeout (newest first)
            msg_ids_to_check = list(reversed(msg_ids))[:200]
            
            for num in msg_ids_to_check:
                try:
                    # --- STEP 1: Fetch HEADER ONLY first (Fast) ---
                    # BODY.PEEK[HEADER] prevents marking as read and only downloads headers
                    status, header_data = mail.fetch(num, "(BODY.PEEK[HEADER])")
                    if status != "OK":
                        continue

                    msg_header = email.message_from_bytes(header_data[0][1])
                    
                    # Check Subject
                    subject_raw = msg_header.get("Subject", "")
                    subject = self._decode_header_safe(subject_raw)
                    
                    # Filter: If subject doesn't match, SKIP downloading body/attachment
                    # User requirement: Must contain the full task name. "汇总" alone is not enough.
                    if task_name and task_name not in subject:
                        continue

                    print(f"[IMAP] Match found: '{subject}'. Downloading full content...")

                    # --- STEP 2: Fetch FULL content only if matched (Slower but necessary) ---
                    try:
                        # Set a shorter timeout for this specific fetch
                        socket.setdefaulttimeout(15)
                        status, msg_data = mail.fetch(num, "(RFC822)")
                        socket.setdefaulttimeout(30)  # Reset to default
                        
                        if status != "OK":
                            print(f"[IMAP] Fetch returned {status}, skipping...")
                            continue
                    except socket.timeout:
                        print(f"[IMAP] Fetch timeout for message {num}, skipping...")
                        socket.setdefaulttimeout(30)
                        continue

                    msg = email.message_from_bytes(msg_data[0][1])
                    sender = self._decode_header_safe(msg.get("From", ""))
                    received_ts = self._get_internal_date(mail, num) or datetime.now()

                    # Extract Body
                    body = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            if part.get_content_type() == "text/plain" and "attachment" not in str(part.get_content_disposition()):
                                try:
                                    body = part.get_payload(decode=True).decode(errors='ignore')
                                    break
                                except: pass
                    else:
                        try:
                            body = msg.get_payload(decode=True).decode(errors='ignore')
                        except: pass

                    # Extract Attachment
                    attachment_path = None
                    for part in msg.walk():
                        if part.get_content_disposition() and "attachment" in part.get_content_disposition():
                            filename = part.get_filename()
                            if filename:
                                filename = self._decode_header_safe(filename)
                                # Sanitize filename to prevent OS errors
                                safe_name = self._sanitize_filename(filename)
                                unique_name = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{safe_name}"
                                filepath = self.download_dir / unique_name
                                
                                with open(filepath, "wb") as f:
                                    f.write(part.get_payload(decode=True))
                                attachment_path = str(filepath)
                                break # Assuming we only need one attachment

                    matches.append({
                        "email": sender,
                        "attachment_path": attachment_path,
                        "received_at": received_ts,
                        "body": body,
                        "subject": subject
                    })

                except Exception as e:
                    print(f"[IMAP ERROR] Skipping message {num}: {e}")
                    continue

        except Exception as e:
            print(f"[IMAP ERROR] Check replies failed: {e}")
        finally:
            if mail:
                try:
                    mail.close()
                    mail.logout()
                except:
                    pass
        
        return matches

    # ---------- Helpers ----------
    def _decode_header_safe(self, value: str) -> str:
        if not value:
            return ""
        try:
            decoded = decode_header(value)
            decoded_parts = []
            for text, charset in decoded:
                if isinstance(text, bytes):
                    decoded_parts.append(text.decode(charset or "utf-8", errors="ignore"))
                else:
                    decoded_parts.append(str(text))
            return "".join(decoded_parts)
        except Exception:
            return str(value)

    def _sanitize_filename(self, filename: str) -> str:
        # Remove illegal characters for file paths
        return re.sub(r'[\\/*?:"<>|]', "", filename).strip()

    def _get_internal_date(self, mail: imaplib.IMAP4_SSL, msg_num: bytes) -> Optional[datetime]:
        try:
            status, data = mail.fetch(msg_num, "(INTERNALDATE)")
            if status == "OK":
                internal_date = data[0].decode()
                # Parse regex roughly for "23-Nov-2025 10:00:00 +0800"
                match = re.search(r'(\d{1,2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2})', internal_date)
                if match:
                    ts_str = match.group(1)
                    # Try parsing with timezone agnostic, as internaldate format varies slightly
                    dt = datetime.strptime(ts_str, "%d-%b-%Y %H:%M:%S")
                    return dt
        except Exception:
            pass
        return None

    def _check_replies_mock(self, task_name: str) -> List[dict]:
        replies = []
        if not self.mock_inbox.exists():
            return replies
            
        for filename in os.listdir(self.mock_inbox):
            filepath = self.mock_inbox / filename
            if filepath.is_file():
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                        sender = ""
                        subject = ""
                        attachment = ""
                        for line in content.split("\n"):
                            if line.startswith("From:"): sender = line.replace("From:", "").strip()
                            if line.startswith("Subject:"): subject = line.replace("Subject:", "").strip()
                            if line.startswith("Attachment:"): attachment = line.replace("Attachment:", "").strip()

                        if task_name in subject:
                            replies.append({
                                "email": sender,
                                "attachment_path": attachment,
                                "received_at": datetime.fromtimestamp(filepath.stat().st_mtime),
                                "subject": subject,
                                "body": content
                            })
                except Exception:
                    continue
        return replies

    def _clean_env(self, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if len(value) >= 2 and ((value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'"))):
            return value[1:-1]
        return value

email_service = EmailService()