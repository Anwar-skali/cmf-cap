import json, openpyxl, glob

def inspect_k9_template():
    with open('app/infrastructure/persistence/seeds/seed_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    for t in data.get('templates', []):
        if t.get('code') == 'K9':
            schema = json.loads(t['schema_json']) if isinstance(t['schema_json'], str) else t['schema_json']
            print('K9 Template:', schema.get('name'))
            for sec in schema.get('sections', []):
                print(f" Section: {sec.get('name')}")
                for grp in sec.get('groups', []):
                    print(f"   Group: {grp.get('name')}")
                    for fld in grp.get('fields', []):
                        req = fld.get('required', False)
                        aliases = fld.get('aliases', [])
                        print(f"     {fld.get('internalName'):25s} | req={str(req):5s} | type={fld.get('type'):10s} | label={fld.get('label'):30s} | aliases={aliases}")

def inspect_file():
    fn = '../CMF_K9_12.5K_DEX.xlsm'
    wb = openpyxl.load_workbook(fn, data_only=True)
    print("\nWorkbook Sheets:", wb.sheetnames)
    for sname in wb.sheetnames:
        ws = wb[sname]
        print(f"\n--- Sheet '{sname}' (max_row={ws.max_row}, max_col={ws.max_column}) ---")
        for r in range(1, min(10, ws.max_row + 1)):
            row_vals = [ws.cell(r, c).value for c in range(1, min(15, ws.max_column + 1))]
            non_empty = [v for v in row_vals if v is not None and str(v).strip() != '']
            if non_empty:
                print(f"  Row {r}: {row_vals[:8]}")

if __name__ == '__main__':
    inspect_k9_template()
    inspect_file()
