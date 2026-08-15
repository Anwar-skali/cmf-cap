import sqlite3, json
conn = sqlite3.connect("cmf.db")
c = conn.cursor()
c.execute("SELECT schema_json FROM templates WHERE code='CMF_K0'")
schema = json.loads(c.fetchone()[0])
print("=== CMF_K0 field metadata ===")
for s in schema.get("sections", []):
    print("SECTION", s.get("id"), s.get("name"))
    for g in s.get("groups", []):
        for f in g.get("fields", []):
            print("  ", f.get("internalName"), "| type:", f.get("type"), "| required:", f.get("required"))
conn.close()