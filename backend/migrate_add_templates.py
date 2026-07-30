"""
Migration script: Add templates table + template columns to projects table.
Run once while the backend server is NOT running:
    python migrate_add_templates.py
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "cmf.db")

TEMPLATES_DDL = """
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL DEFAULT '1.0',
    status TEXT NOT NULL DEFAULT 'DRAFT',
    schema_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);
"""

TEMPLATE_VERSIONS_DDL = """
CREATE TABLE IF NOT EXISTS template_versions (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES templates(id),
    version TEXT NOT NULL,
    schema_json TEXT NOT NULL DEFAULT '{}',
    change_log TEXT,
    published_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


def column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def table_exists(cursor, table: str) -> bool:
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    )
    return cursor.fetchone() is not None


def main() -> None:
    if not os.path.exists(DB_PATH):
        print(f"[ERROR] Database not found at: {DB_PATH}")
        print("Please start the backend once to create it, then re-run this script.")
        return

    print(f"Migrating: {DB_PATH}")

    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()

        # 1. Create templates table
        if not table_exists(c, "templates"):
            print("  + Creating 'templates' table...")
            c.execute(TEMPLATES_DDL)
        else:
            print("  [OK] 'templates' table already exists")

        # 2. Create template_versions table
        if not table_exists(c, "template_versions"):
            print("  + Creating 'template_versions' table...")
            c.execute(TEMPLATE_VERSIONS_DDL)
        else:
            print("  [OK] 'template_versions' table already exists")

        # 3. Add template_id column to projects
        if not column_exists(c, "projects", "template_id"):
            print("  + Adding 'template_id' column to 'projects'...")
            c.execute("ALTER TABLE projects ADD COLUMN template_id TEXT REFERENCES templates(id)")
        else:
            print("  [OK] 'projects.template_id' already exists")

        # 4. Add template_version column to projects
        if not column_exists(c, "projects", "template_version"):
            print("  + Adding 'template_version' column to 'projects'...")
            c.execute("ALTER TABLE projects ADD COLUMN template_version TEXT")
        else:
            print("  [OK] 'projects.template_version' already exists")

        # 5. Add data column to projects
        if not column_exists(c, "projects", "data"):
            print("  + Adding 'data' column to 'projects'...")
            c.execute("ALTER TABLE projects ADD COLUMN data TEXT DEFAULT '{}'")
        else:
            print("  [OK] 'projects.data' already exists")

        conn.commit()
        print("\nMigration completed successfully!")


if __name__ == "__main__":
    main()
