import sqlite3
import os

DB_PATH = "./sql_app.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print("Database file not found. It will be created by the app.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Add is_active to teachers
    try:
        cursor.execute("ALTER TABLE teachers ADD COLUMN is_active INTEGER DEFAULT 1")
        print("Added is_active to teachers")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("is_active already exists in teachers")
        else:
            print(f"Error adding is_active: {e}")

    # 2. Add template_path to collection_tasks
    try:
        cursor.execute("ALTER TABLE collection_tasks ADD COLUMN template_path VARCHAR")
        print("Added template_path to collection_tasks")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("template_path already exists in collection_tasks")
        else:
            print(f"Error adding template_path: {e}")

    # 3. Add email_subject to collection_tasks
    try:
        cursor.execute("ALTER TABLE collection_tasks ADD COLUMN email_subject VARCHAR")
        print("Added email_subject to collection_tasks")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("email_subject already exists in collection_tasks")
        else:
            print(f"Error adding email_subject: {e}")

    # 4. Add email_body to collection_tasks
    try:
        cursor.execute("ALTER TABLE collection_tasks ADD COLUMN email_body VARCHAR")
        print("Added email_body to collection_tasks")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("email_body already exists in collection_tasks")
        else:
            print(f"Error adding email_body: {e}")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
