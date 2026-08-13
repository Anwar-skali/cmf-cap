import * as XLSX from 'xlsx';
import {
  ExcelHeaderExtractor,
  OrientationMode,
  WorksheetScore,
} from '@/features/import/services/ExcelHeaderExtractor';
import { TemplateSection, TemplateField, FieldGroup, FieldType, DropdownOption, PermissionRule } from '@/types/template';

export interface StructureRelationship {
  from: string;
  to: string;
  type?: string;
}

export interface StructureExtractResult {
  code: string;
  name: string;
  version: string;
  status: 'DRAFT' | 'PUBLISHED';
  description: string;
  orientation: 'VERTICAL' | 'HORIZONTAL';
  sections: TemplateSection[];
  detectedFieldCount: number;
  detectedModuleCount: number;
  detectedTableCount?: number;
  detectedRelationshipCount?: number;
  relationships?: StructureRelationship[];
  sheetScores?: WorksheetScore[];
  detectedSheet?: string;
}

/** Helper: normalize raw strings into clean internalName keys (e.g. "Part Name" -> "part_name") */
function toInternalName(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Helper: infer field type from sample cell values */
function inferFieldType(val: any): FieldType {
  if (val == null) return 'text';
  const str = String(val).trim();
  if (str === '') return 'text';

  if (/^(true|false|yes|no|oui|non)$/i.test(str)) {
    return 'boolean';
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str) || /^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    return 'date';
  }
  if (/^-?\d+$/.test(str)) {
    return 'integer';
  }
  if (/^-?\d+\.\d+$/.test(str)) {
    return 'decimal';
  }
  if (str.length > 80 || str.includes('\n')) {
    return 'textarea';
  }
  return 'text';
}

/** Helper: check if a field is required by default */
function isRequiredByName(name: string): boolean {
  const norm = name.toLowerCase();
  return (
    norm.includes('unique_id') ||
    norm.includes('part_number') ||
    norm.includes('part_name') ||
    norm.includes('supplier') ||
    norm === 'code' ||
    norm === 'id'
  );
}

/** Maps common JSON schema field types onto the CMF FieldType vocabulary. */
const JSON_FIELD_TYPE_MAP: Record<string, FieldType> = {
  string: 'text',
  text: 'text',
  textarea: 'textarea',
  longtext: 'textarea',
  integer: 'integer',
  int: 'integer',
  number: 'decimal',
  float: 'decimal',
  double: 'decimal',
  decimal: 'decimal',
  money: 'currency',
  currency: 'currency',
  date: 'date',
  datetime: 'date',
  time: 'date',
  week: 'week',
  boolean: 'boolean',
  bool: 'boolean',
  email: 'email',
  phone: 'phone',
  telephone: 'phone',
  dropdown: 'dropdown',
  enum: 'dropdown',
  select: 'dropdown',
  multiselect: 'multiselect',
  checkbox: 'checkbox',
  radio: 'radio',
  status: 'status',
  cat_status: 'cat_status',
  percentage: 'percentage',
  file: 'file_upload',
  file_upload: 'file_upload',
  attachment: 'file_upload',
  user: 'user',
  supplier: 'supplier',
  project: 'project',
  calculated: 'calculated',
  readonly: 'readonly',
};

function normalizeJsonFieldType(type: any): FieldType {
  if (type == null) return 'text';
  const key = String(type).trim().toLowerCase();
  return JSON_FIELD_TYPE_MAP[key] || 'text';
}

function isRecord(value: any): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalizes the JSON structure `options` property onto the canonical CMF
 * DropdownOption shape ({value, label, order?}). Accepts string arrays,
 * object arrays, or a comma-separated string.
 */
function normalizeFieldOptions(raw: any): DropdownOption[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    const options: DropdownOption[] = [];
    raw.forEach((opt: any, i: number) => {
      if (isRecord(opt)) {
        const value = opt.value ?? opt.label;
        if (value == null) return;
        options.push({
          value: String(value),
          label: String(opt.label ?? value),
          order: typeof opt.order === 'number' ? opt.order : i + 1,
        });
      } else if (opt != null && String(opt).trim() !== '') {
        const text = String(opt).trim();
        options.push({ value: text, label: text, order: i + 1 });
      }
    });
    return options.length ? options : undefined;
  }
  if (typeof raw === 'string') {
    const parts = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length ? parts.map((p, i) => ({ value: p, label: p, order: i + 1 })) : undefined;
  }
  return undefined;
}

/** Canonical CMF property for a field's initial value; honors `default` from JSON structures. */
function normalizeFieldDefault(f: any): any {
  return f.defaultValue !== undefined ? f.defaultValue : f.default !== undefined ? f.default : undefined;
}

/** Canonical role name, e.g. 'CAPACITY MANAGER' -> 'capacity_manager'. */
function canonicalRole(value: any): 'buyer' | 'capacity_manager' | 'sqd' | null {
  if (value == null) return null;
  const v = String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (v === 'buyer' || v === 'purchasing') return 'buyer';
  if (v === 'capacity_manager' || v === 'capacity' || v === 'capacitymanager') return 'capacity_manager';
  if (v === 'sqd' || v === 'quality' || v === 'quality_lead' || v === 'sqd_team') return 'sqd';
  return null;
}

const ALL_ROLES = ['buyer', 'capacity_manager', 'sqd'];
const ROLE_VIEW_ROLES = ['buyer', 'capacity_manager', 'sqd', 'admin', 'viewer'];

/**
 * Preserves explicit role/permission metadata from a source field so the
 * imported structure retains the role distinction required by Manuel Project.
 */
function normalizeFieldPermissions(f: any): PermissionRule | undefined {
  const perms: PermissionRule = {};
  const raw = f?.permissions;
  if (isRecord(raw)) {
    if (Array.isArray(raw.rolesAllowedToEdit)) perms.rolesAllowedToEdit = raw.rolesAllowedToEdit;
    if (Array.isArray(raw.rolesAllowedToView)) perms.rolesAllowedToView = raw.rolesAllowedToView;
  }
  const role = canonicalRole(f?.role ?? f?.fieldRole ?? f?.owner);
  if (role) {
    if (!perms.rolesAllowedToEdit) perms.rolesAllowedToEdit = [role, 'admin'];
    if (!perms.rolesAllowedToView) perms.rolesAllowedToView = [...ROLE_VIEW_ROLES];
  }
  return perms.rolesAllowedToEdit || perms.rolesAllowedToView ? perms : undefined;
}

/**
 * Classifies a normalized field onto the business role responsible for it.
 * Precedence: explicit permissions -> keyword match on name/label -> 'general'.
 */
function classifyFieldRole(f: TemplateField): 'buyer' | 'capacity_manager' | 'sqd' | 'general' {
  const edit = f.permissions?.rolesAllowedToEdit ?? [];
  const roles = edit.filter((r) => (ALL_ROLES as string[]).includes(r));
  if (roles.length === 1) return roles[0] as 'buyer' | 'capacity_manager' | 'sqd';

  const name = (f.internalName || '').toLowerCase();
  const label = (f.label || '').toLowerCase();
  const buyerName = ['buyer', 'part', 'supplier', 'package', 'rfq', 'price', 'currency'];
  const buyerLabel = ['buyer', 'part', 'supplier'];
  const capName = ['capacity', 'volume', 'weekly', 'shift', 'tooling'];
  const capLabel = ['capacity', 'volume'];
  const sqdName = ['sqd', 'sqe', 'sqm', 'apqp', 'ppap', 'quality', 'audit', 'eval', 'cat'];
  const sqdLabel = ['quality', 'apqp', 'eval'];

  if (buyerName.some((k) => name.includes(k)) || buyerLabel.some((k) => label.includes(k))) return 'buyer';
  if (capName.some((k) => name.includes(k)) || capLabel.some((k) => label.includes(k))) return 'capacity_manager';
  if (sqdName.some((k) => name.includes(k)) || sqdLabel.some((k) => label.includes(k))) return 'sqd';
  return 'general';
}

/**
 * Maps a hierarchical project-structure JSON (structure / modules -> tables ->
 * fields / relationships) onto the existing sections -> groups -> fields shape.
 * Generic — works for K0, K9, and arbitrary future structures.
 * Returns null when the JSON is not in this layout.
 */
function extractHierarchicalStructure(parsed: any): {
  sections: TemplateSection[];
  fieldCount: number;
  tableCount: number;
  relationships: StructureRelationship[];
} | null {
  const modules: any[] = Array.isArray(parsed.modules) ? parsed.modules : [];
  if (modules.length === 0) return null;

  const sections: TemplateSection[] = [];
  let fieldCount = 0;
  let tableCount = 0;

  modules.forEach((mod, modIdx) => {
    const groups: FieldGroup[] = [];

    // 1. Direct fields under module (e.g. mod.fields)
    if (Array.isArray(mod.fields) && mod.fields.length > 0) {
      tableCount += 1;
      const modName = mod.name || mod.code || `Module ${modIdx + 1}`;
      const fields: TemplateField[] = mod.fields.map((f: any, fIdx: number) => {
        fieldCount += 1;
        const rawName = toInternalName(f.name || f.internalName || f.label || `field_${fIdx + 1}`);
        const label = f.label || f.name || f.internalName || `Field ${fIdx + 1}`;
        return {
          id: f.id || `fld_${rawName}`,
          internalName: rawName,
          label,
          type: normalizeJsonFieldType(f.type),
          required: Boolean(f.required),
          placeholder: f.placeholder || undefined,
          helpText: f.helpText || f.description || undefined,
          order: typeof f.order === 'number' ? f.order : fIdx + 1,
          visible: f.visible !== false,
          editable: f.editable !== false,
          options: normalizeFieldOptions(f.options),
          defaultValue: normalizeFieldDefault(f),
          permissions: normalizeFieldPermissions(f),
        };
      });

      groups.push({
        id: `grp_${toInternalName(modName)}`,
        name: modName,
        order: 1,
        fields,
      });
    }

    // 2. Tables under module (e.g. mod.tables)
    const tables: any[] = Array.isArray(mod.tables) ? mod.tables : [];
    tables.forEach((tbl, tblIdx) => {
      tableCount += 1;
      const fields: TemplateField[] = (Array.isArray(tbl.fields) ? tbl.fields : []).map((f: any, fIdx: number) => {
        fieldCount += 1;
        const rawName = toInternalName(f.name || f.internalName || f.label || `field_${fIdx + 1}`);
        const label = f.label || f.name || f.internalName || `Field ${fIdx + 1}`;
        return {
          id: f.id || `fld_${rawName}`,
          internalName: rawName,
          label,
          type: normalizeJsonFieldType(f.type),
          required: Boolean(f.required),
          placeholder: f.placeholder || undefined,
          helpText: f.helpText || f.description || undefined,
          order: typeof f.order === 'number' ? f.order : fIdx + 1,
          visible: f.visible !== false,
          editable: f.editable !== false,
          options: normalizeFieldOptions(f.options),
          defaultValue: normalizeFieldDefault(f),
          permissions: normalizeFieldPermissions(f),
        };
      });

      groups.push({
        id: tbl.id || `grp_${toInternalName(tbl.name || tbl.title || `table_${tblIdx + 1}`)}`,
        name: tbl.name || tbl.title || `Table ${tblIdx + 1}`,
        order: typeof tbl.order === 'number' ? tbl.order : groups.length + 1,
        fields,
      });
    });

    sections.push({
      id: mod.id || `sec_${toInternalName(mod.code || mod.name || `module_${modIdx + 1}`)}`,
      name: mod.name || mod.code || `Module ${modIdx + 1}`,
      order: typeof mod.order === 'number' ? mod.order : modIdx + 1,
      description: mod.description || '',
      groups,
    });
  });

  const relationships: StructureRelationship[] = (Array.isArray(parsed.relationships) ? parsed.relationships : [])
    .filter((r: any) => isRecord(r) && (r.from || r.to))
    .map((r: any) => ({
      from: String(r.from || ''),
      to: String(r.to || ''),
      type: r.type != null ? String(r.type) : undefined,
    }));

  return { sections, fieldCount, tableCount, relationships };
}

export class ProjectStructureExtractor {
  /**
   * Analyzes an uploaded Excel file to discover and build a NEW Project Structure.
   * Supports VERTICAL (Col A = Field, Col B = Value) and HORIZONTAL (Row 1 = Headers) orientation.
   * Does NOT map to existing K0/K9 templates.
   */
  static async extractFromExcel(
    file: File,
    specifiedOrientation: OrientationMode = 'AUTO',
    customName?: string,
    customCode?: string,
    specifiedSheetName?: string,
  ): Promise<StructureExtractResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          if (!data) throw new Error('Failed to read Excel file payload.');

          // Reuse the existing workbook-analysis service to obtain per-sheet
          // scores, the recommended worksheet, and the resolved orientation.
          // This is the SAME scoring engine used by the project import wizard —
          // no duplicate analysis logic is introduced here.
          let sheetScores: WorksheetScore[] = [];
          let detectedSheetName = '';

          try {
            const pre = await ExcelHeaderExtractor.extractFromFile(
              file,
              undefined,
              specifiedSheetName,
              undefined,
              specifiedOrientation,
            );
            sheetScores = pre.sheetScores || [];
            detectedSheetName = pre.sheetName;
          } catch (scanErr) {
            console.warn('[STRUCTURE] Fallback workbook scan failed, using first sheet.', scanErr);
          }

          const workbook = XLSX.read(data, { type: 'array', sheetRows: 100 });
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('No worksheets found in uploaded file.');
          }

          const targetSheetName =
            specifiedSheetName && workbook.SheetNames.includes(specifiedSheetName)
              ? specifiedSheetName
              : detectedSheetName || workbook.SheetNames[0];
          const targetSheet = workbook.Sheets[targetSheetName];
          if (!targetSheet) throw new Error(`Worksheet '${targetSheetName}' not found.`);

          const rows: any[][] = XLSX.utils.sheet_to_json(targetSheet, { header: 1, defval: null });
          if (!rows || rows.length === 0) {
            throw new Error('Worksheet contains no populated rows.');
          }

          // Orientation detection (existing engine, honors user override)
          const orientationInfo = ExcelHeaderExtractor.detectOrientation(
            rows,
            undefined,
            specifiedOrientation,
          );
          const isVertical =
            specifiedOrientation === 'VERTICAL' ||
            (specifiedOrientation !== 'HORIZONTAL' && orientationInfo.orientation === 'VERTICAL');
          const resolvedOrientation = (isVertical ? 'VERTICAL' : 'HORIZONTAL') as
            | 'VERTICAL'
            | 'HORIZONTAL';

          const detectedFields: TemplateField[] = [];

          if (isVertical) {
            // ── VERTICAL MODE: Col A = Field Name, Col B = Sample Value ──
            const seenKeys = new Set<string>();

            for (let i = 0; i < rows.length; i++) {
              const r = rows[i] || [];
              const rawLabel = r[0] != null ? String(r[0]).trim() : '';
              const sampleVal = r[1] != null ? String(r[1]).trim() : '';
              if (!rawLabel) continue;

              const internalName = toInternalName(rawLabel);
              if (!internalName || seenKeys.has(internalName)) continue;
              seenKeys.add(internalName);

              const type = inferFieldType(sampleVal);
              const required = isRequiredByName(internalName);

              detectedFields.push({
                id: `fld_${internalName}`,
                internalName,
                label: rawLabel,
                type,
                required,
                placeholder: sampleVal ? `e.g. ${sampleVal}` : undefined,
                order: detectedFields.length + 1,
                visible: true,
                editable: true,
              });
            }
          } else {
            // ── HORIZONTAL MODE: Row 1 = Headers, Row 2+ = Sample Data ──
            const headerRow = rows[0] || [];
            const sampleDataRow = rows[1] || [];
            const seenKeys = new Set<string>();

            for (let c = 0; c < headerRow.length; c++) {
              const rawLabel = headerRow[c] != null ? String(headerRow[c]).trim() : '';
              if (!rawLabel) continue;

              const internalName = toInternalName(rawLabel);
              if (!internalName || seenKeys.has(internalName)) continue;
              seenKeys.add(internalName);

              const sampleVal = sampleDataRow[c] != null ? String(sampleDataRow[c]).trim() : '';
              const type = inferFieldType(sampleVal);
              const required = isRequiredByName(internalName);

              detectedFields.push({
                id: `fld_${internalName}`,
                internalName,
                label: rawLabel,
                type,
                required,
                placeholder: sampleVal ? `e.g. ${sampleVal}` : undefined,
                order: detectedFields.length + 1,
                visible: true,
                editable: true,
              });
            }
          }

          if (detectedFields.length === 0) {
            throw new Error('No valid field structures could be extracted from the file.');
          }

          // Build Module Sections (e.g. Buyer, Capacity, SQD, or General)
          const sections = ProjectStructureExtractor.groupFieldsIntoSections(detectedFields);

          const baseName = customName || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          const formattedName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
          const baseCode = customCode || toInternalName(baseName).toUpperCase() || 'CUSTOM_STRUCT';

          resolve({
            code: baseCode,
            name: formattedName,
            version: '1.0',
            status: 'PUBLISHED',
            description: `Custom Project Structure extracted from file '${file.name}' (${resolvedOrientation} mode).`,
            orientation: resolvedOrientation,
            sections,
            detectedFieldCount: detectedFields.length,
            detectedModuleCount: sections.length,
            sheetScores,
            detectedSheet: targetSheetName,
          });
        } catch (err: any) {
          reject(new Error(`Structure extraction failed: ${err?.message || 'Unknown error'}`));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read Excel file.'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Parse a JSON schema file into a Project Structure.
   * Recognizes the hierarchical layout (structure / modules -> tables -> fields /
   * relationships) as well as an already-normalized CMF template (sections).
   * Throws a structured error for unrecognized JSON shapes — it never flattens
   * arbitrary top-level keys into fields.
   */
  static extractFromJson(jsonContent: string | object, fileFileName?: string): StructureExtractResult {
    const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    if (!isRecord(parsed)) {
      throw new Error('Invalid Project Structure JSON: expected a JSON object.');
    }

    // ── 1. Hierarchical layout: modules -> tables -> fields ──────────────
    const hierarchical = extractHierarchicalStructure(parsed);
    if (hierarchical) {
      const meta = isRecord(parsed.structure) ? parsed.structure : parsed;
      const code = String(meta.code || parsed.code || (fileFileName ? fileFileName.replace(/\.[^/.]+$/, '') : 'JSON_STRUCT')).toUpperCase();
      const name = meta.name || parsed.name || (fileFileName ? fileFileName.replace(/\.[^/.]+$/, '') : 'JSON Structure');
      const rawOrient = meta.orientation || parsed.orientation;
      const orientation: 'VERTICAL' | 'HORIZONTAL' =
        rawOrient === 'VERTICAL' || rawOrient === 'HORIZONTAL' ? rawOrient : 'HORIZONTAL';

      return {
        code,
        name,
        version: String(meta.version || parsed.version || '1.0'),
        status: (meta.status || parsed.status) === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
        description: meta.description || parsed.description || `Project structure imported from JSON with ${hierarchical.fieldCount} fields.`,
        orientation,
        // Bucket fields into the role sections the Manuel Project workflow
        // renders (Buyer / Capacity Manager / SQD), preserving the role info.
        sections: ProjectStructureExtractor.bucketIntoRoleSections(hierarchical.sections),
        detectedFieldCount: hierarchical.fieldCount,
        detectedModuleCount: hierarchical.sections.length,
        detectedTableCount: hierarchical.tableCount,
        detectedRelationshipCount: hierarchical.relationships.length,
        relationships: hierarchical.relationships,
      };
    }

    // ── 2. Already-normalized CMF template: sections / schema_json ───────
    const rawSections = parsed.sections || parsed.schema_json?.sections;
    if (Array.isArray(rawSections)) {
      let detectedFieldsCount = 0;

      const sections: TemplateSection[] = rawSections.map((sec: any, secIdx: number) => ({
        id: sec.id || `sec_${secIdx + 1}`,
        name: sec.name || `Module ${secIdx + 1}`,
        order: sec.order || secIdx + 1,
        description: sec.description || '',
        groups: (sec.groups || []).map((grp: any, grpIdx: number) => ({
          id: grp.id || `grp_${grpIdx + 1}`,
          name: grp.name || `Group ${grpIdx + 1}`,
          order: grp.order || grpIdx + 1,
          description: grp.description || '',
          fields: (grp.fields || []).map((f: any, fIdx: number) => {
            detectedFieldsCount++;
            return {
              id: f.id || `fld_${toInternalName(f.label || f.internalName || `field_${fIdx + 1}`)}`,
              internalName: toInternalName(f.internalName || f.label || `field_${fIdx + 1}`),
              label: f.label || f.internalName || `Field ${fIdx + 1}`,
              type: normalizeJsonFieldType(f.type),
              required: Boolean(f.required),
              placeholder: f.placeholder,
              helpText: f.helpText,
              order: f.order || fIdx + 1,
              visible: f.visible !== false,
              editable: f.editable !== false,
              options: normalizeFieldOptions(f.options),
              defaultValue: normalizeFieldDefault(f),
            };
          }),
        })),
      }));

      const code = (parsed.code || (fileFileName ? fileFileName.replace(/\.[^/.]+$/, '') : 'JSON_STRUCT')).toUpperCase();
      const name = parsed.name || (fileFileName ? fileFileName.replace(/\.[^/.]+$/, '') : 'JSON Structure');

      const relationships: StructureRelationship[] = (Array.isArray(parsed.relationships) ? parsed.relationships : [])
        .filter((r: any) => isRecord(r) && (r.from || r.to))
        .map((r: any) => ({
          from: String(r.from || ''),
          to: String(r.to || ''),
          type: r.type != null ? String(r.type) : undefined,
        }));

      const rawOrient = parsed.orientation || parsed.schema_json?.orientation;
      const orientation: 'VERTICAL' | 'HORIZONTAL' =
        rawOrient === 'VERTICAL' || rawOrient === 'HORIZONTAL' ? rawOrient : 'VERTICAL';

      return {
        code,
        name,
        version: parsed.version || '1.0',
        status: parsed.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
        description: parsed.description || 'Project structure imported from JSON schema.',
        orientation,
        sections,
        detectedFieldCount: detectedFieldsCount,
        detectedModuleCount: sections.length,
        detectedTableCount: sections.reduce((acc, sec) => acc + sec.groups.length, 0),
        detectedRelationshipCount: relationships.length,
        relationships,
      };
    }

    // ── 3. Unrecognized shape → structured error, never flat fields ──────
    throw new Error(
      'Invalid Project Structure JSON: expected a "modules" array (modules → tables → fields) or a "sections" array. Got: ' +
        Object.keys(parsed).join(', '),
    );
  }

  /**
   * Automatically groups extracted fields into logical business modules / sections.
   */
  static groupFieldsIntoSections(fields: TemplateField[]): TemplateSection[] {
    const buyerFields: TemplateField[] = [];
    const capacityFields: TemplateField[] = [];
    const sqdFields: TemplateField[] = [];
    const generalFields: TemplateField[] = [];

    fields.forEach((f) => {
      const name = f.internalName.toLowerCase();
      const label = f.label.toLowerCase();

      if (
        name.includes('buyer') ||
        name.includes('supplier') ||
        name.includes('package') ||
        name.includes('rfq') ||
        name.includes('price') ||
        name.includes('currency') ||
        label.includes('buyer') ||
        label.includes('supplier')
      ) {
        buyerFields.push(f);
      } else if (
        name.includes('capacity') ||
        name.includes('volume') ||
        name.includes('weekly') ||
        name.includes('shift') ||
        name.includes('tooling') ||
        label.includes('capacity') ||
        label.includes('volume')
      ) {
        capacityFields.push(f);
      } else if (
        name.includes('sqd') ||
        name.includes('sqe') ||
        name.includes('sqm') ||
        name.includes('apqp') ||
        name.includes('ppap') ||
        name.includes('quality') ||
        name.includes('audit') ||
        label.includes('quality') ||
        label.includes('apqp')
      ) {
        sqdFields.push(f);
      } else {
        generalFields.push(f);
      }
    });

    const sections: TemplateSection[] = [];
    let secOrder = 1;

    if (generalFields.length > 0 || (buyerFields.length === 0 && capacityFields.length === 0 && sqdFields.length === 0)) {
      const allGen = generalFields.length > 0 ? generalFields : fields;
      sections.push({
        id: 'sec_general',
        name: 'General Baseline',
        order: secOrder++,
        description: 'General identification, part numbers, and project baseline information.',
        groups: [
          {
            id: 'grp_general_info',
            name: 'General Information',
            order: 1,
            fields: allGen.slice(0, Math.ceil(allGen.length / 2)),
          },
          ...(allGen.length > 1
            ? [
                {
                  id: 'grp_part_spec',
                  name: 'Part Specifications',
                  order: 2,
                  fields: allGen.slice(Math.ceil(allGen.length / 2)),
                },
              ]
            : []),
        ],
      });
    }

    if (buyerFields.length > 0) {
      sections.push({
        id: 'sec_buyer',
        name: 'Buyer Module',
        order: secOrder++,
        description: 'Purchasing, RFQ packages, and commercial attributes.',
        groups: [
          {
            id: 'grp_buyer_data',
            name: 'Purchasing Attributes',
            order: 1,
            fields: buyerFields,
          },
        ],
      });
    }

    if (capacityFields.length > 0) {
      sections.push({
        id: 'sec_capacity',
        name: 'Capacity Manager Module',
        order: secOrder++,
        description: 'Weekly capacity, volume requirements, and tooling assessment.',
        groups: [
          {
            id: 'grp_capacity_data',
            name: 'Capacity Requirements',
            order: 1,
            fields: capacityFields,
          },
        ],
      });
    }

    if (sqdFields.length > 0) {
      sections.push({
        id: 'sec_sqd',
        name: 'SQD Quality Module',
        order: secOrder++,
        description: 'Supplier quality development, APQP status, and quality ratings.',
        groups: [
          {
            id: 'grp_sqd_data',
            name: 'Quality & SQD Metrics',
            order: 1,
            fields: sqdFields,
          },
        ],
      });
    }

    return sections;
  }

  /**
   * Reorganizes hierarchical (modules -> tables -> fields) sections into the CMF
   * role sections the Manuel Project workflow expects: Buyer, Capacity Manager,
   * SQD, plus a General section for unclassified fields. Field-level role and
   * permissions metadata is preserved and takes precedence over name heuristics.
   */
  static bucketIntoRoleSections(sections: TemplateSection[]): TemplateSection[] {
    const buckets: Record<string, Record<string, TemplateField[]>> = {};
    (sections || []).forEach((sec) => {
      (sec.groups || []).forEach((grp) => {
        const gname = grp.name || 'General';
        (grp.fields || []).forEach((fld) => {
          const role = classifyFieldRole(fld);
          buckets[role] = buckets[role] || {};
          buckets[role][gname] = buckets[role][gname] || [];
          buckets[role][gname].push(fld);
        });
      });
    });

    const specs: Array<{
      role: string;
      id: string;
      name: string;
      description: string;
    }> = [
      { role: 'buyer', id: 'sec_buyer', name: 'Buyer', description: 'Purchasing, RFQ packages, and commercial attributes.' },
      { role: 'capacity_manager', id: 'sec_capacity_manager', name: 'Capacity Manager', description: 'Weekly capacity, volume requirements, and tooling assessment.' },
      { role: 'sqd', id: 'sec_sqd', name: 'SQD', description: 'Supplier quality development, APQP status, and quality ratings.' },
    ];

    const result: TemplateSection[] = [];
    specs.forEach((spec) => {
      const groupsByName = buckets[spec.role];
      if (!groupsByName) return;
      const groups: FieldGroup[] = [];
      let gidx = 0;
      Object.entries(groupsByName).forEach(([gname, fields]) => {
        if (!fields.length) return;
        gidx += 1;
        groups.push({ id: `grp_${spec.role}_${gidx}`, name: gname, order: gidx, fields });
      });
      result.push({
        id: spec.id,
        name: spec.name,
        order: result.length + 1,
        description: spec.description,
        permissions: {
          rolesAllowedToEdit: [spec.role, 'admin'],
          rolesAllowedToView: [...ROLE_VIEW_ROLES],
        },
        groups,
      });
    });

    const generalGroups = buckets['general'];
    if (generalGroups) {
      const groups: FieldGroup[] = [];
      let gidx = 0;
      Object.entries(generalGroups).forEach(([gname, fields]) => {
        if (!fields.length) return;
        gidx += 1;
        groups.push({ id: `grp_general_${gidx}`, name: gname, order: gidx, fields });
      });
      result.push({
        id: 'sec_general',
        name: 'General',
        order: result.length + 1,
        description: 'General information not assigned to a specific role.',
        groups,
      });
    }

    return result;
  }
}
