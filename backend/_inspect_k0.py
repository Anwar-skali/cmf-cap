import json
with open("app/domain/k0_template.json", encoding="utf-8") as f:
    data = json.load(f)
print("TOP KEYS:", list(data.keys()))
print("code:", data.get("code"), "| name:", data.get("name"))
sections = data.get("sections", [])
print("num sections:", len(sections))
total_fields = 0
for sec in sections:
    groups = sec.get("groups", [])
    sec_fields = 0
    for g in groups:
        flds = g.get("fields", [])
        sec_fields += len(flds)
    total_fields += sec_fields
    print("SECTION:", sec.get("id"), sec.get("name"), "| groups:", len(groups), "| fields:", sec_fields)
print("TOTAL FIELDS:", total_fields)
print("\n=== FIELD KEYS (name, type, required) ===")
keys = []
for sec in sections:
    for g in sec.get("groups", []):
        for f in g.get("fields", []):
            keys.append((f.get("internalName"), f.get("type"), f.get("required")))
for k in keys:
    print(k)
