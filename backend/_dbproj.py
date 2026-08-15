import sqlite3
conn = sqlite3.connect("cmf.db")
c = conn.cursor()
# projects created around that time / with CMF_K0 template
c.execute("SELECT id, code, name, status, deleted_at, template_id, template_version, created_at FROM projects WHERE template_id IN (SELECT id FROM templates WHERE code IN ('CMF_K0','K0')) ORDER BY created_at")
rows = c.fetchall()
print("=== PROJECTS with K0/CMF_K0 template (count=%d) ===" % len(rows))
for r in rows[:10]:
    print(r)
print("...")
# recreate the code list
c.execute("SELECT id, code FROM templates WHERE code IN ('CMF_K0','K0')")
print("K0/CMF_K0 template rows:", c.fetchall())
# Any projects whose data.part_number matches K0 pattern? Just show a few with template_id NULL
c.execute("SELECT COUNT(*) FROM projects WHERE template_id IS NULL")
print("projects with template_id NULL:", c.fetchone()[0])
conn.close()