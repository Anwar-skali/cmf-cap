import sqlite3, json
conn = sqlite3.connect("cmf.db")
c = conn.cursor()
c.execute("SELECT code, name, data FROM projects WHERE template_id='3f155fe6d85845a49baab090582e2f58' AND deleted_at IS NOT NULL LIMIT 5")
print("=== SAMPLE SOFT-DELETED CMF_K0 projects ===")
for code, name, data in c.fetchall():
    print("code:", code, "| name:", name)
    if data:
        if isinstance(data, str):
            data = json.loads(data)
        print("  data keys:", list(data.keys())[:15])
        print("  part_number:", data.get("part_number"), "| index:", data.get("index"), "| description:", str(data.get("description"))[:40])
    else:
        print("  data: None")
    print()
# how many NON-deleted CMF_K0 projects exist now?
c.execute("SELECT COUNT(*) FROM projects WHERE template_id='3f155fe6d85845a49baab090582e2f58'")
print("CMF_K0 projects (any):", c.fetchone()[0])
c.execute("SELECT COUNT(*) FROM projects WHERE template_id='3f155fe6d85845a49baab090582e2f58' AND deleted_at IS NULL")
print("CMF_K0 projects (live):", c.fetchone()[0])
conn.close()