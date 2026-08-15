import sqlite3
conn = sqlite3.connect("cmf.db")
c = conn.cursor()
c.execute("SELECT id, entity_type, file_name, total_rows, imported_count, updated_count, skipped_count, failed_count, mode, strategy, status, created_at FROM import_history ORDER BY created_at DESC LIMIT 15")
print("=== IMPORT HISTORY (last 15) ===")
for r in c.fetchall():
    print(r)
conn.close()