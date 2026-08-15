import sqlite3, json
conn = sqlite3.connect("cmf.db")
c = conn.cursor()
c.execute("SELECT id, code, name, schema_json FROM templates WHERE code IN ('CMF_K0','K0','CMF_SF')")
for tid, code, name, schema in c.fetchall():
    print("=== TEMPLATE", code, name, tid, "===")
    if not schema:
        print("  (no schema)")
        continue
    if isinstance(schema, str):
        schema = json.loads(schema)
    secs = schema.get("sections", [])
    print("  sections:", [(s.get("id"), len(s.get("groups", []))) for s in secs])
    fields = []
    for s in secs:
        for g in s.get("groups", []):
            for f in g.get("fields", []):
                fields.append(f.get("internalName"))
    print("  field count:", len(fields))
    print("  fields:", fields[:50])
    print()
conn.close()