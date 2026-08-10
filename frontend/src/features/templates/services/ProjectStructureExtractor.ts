import * as XLSX from 'xlsx';
import { ExcelHeaderExtractor, OrientationMode } from '@/features/import/services/ExcelHeaderExtractor';
import { CMFTemplate, TemplateSection, TemplateField, FieldType } from '@/types/template';

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
    return 'number';
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
  ): Promise<StructureExtractResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) throw new Error('Failed to read Excel file payload.');

          const workbook = XLSX.read(data, { type: 'array', sheetRows: 100 });
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('No worksheets found in uploaded file.');
          }

          const targetSheetName = workbook.SheetNames[0];
          const targetSheet = workbook.Sheets[targetSheetName];
          if (!targetSheet) throw new Error(`Worksheet '${targetSheetName}' not found.`);

          const rows: any[][] = XLSX.utils.sheet_to_json(targetSheet, { header: 1, defval: null });
          if (!rows || rows.length === 0) {
            throw new Error('Worksheet contains no populated rows.');
          }

          // Orientation detection
          const orientInfo = ExcelHeaderExtractor.detectOrientation(rows, undefined, specifiedOrientation);
          const isVertical = orientInfo.orientation === 'VERTICAL';

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
            description: `Custom Project Structure extracted from file '${file.name}' (${orientInfo.orientation} mode).`,
            orientation: orientInfo.orientation,
            sections,
            detectedFieldCount: detectedFields.length,
            detectedModuleCount: sections.length,
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
   */
  static extractFromJson(jsonContent: string | object, fileFileName?: string): StructureExtractResult {
    const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    const rawSections = parsed.sections || parsed.schema_json?.sections || [];
    let detectedFieldsCount = 0;

    const sections: TemplateSection[] = (rawSections || []).map((sec: any, secIdx: number) => ({
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
            type: f.type || 'text',
            required: Boolean(f.required),
            placeholder: f.placeholder,
            helpText: f.helpText,
            order: f.order || fIdx + 1,
            visible: f.visible !== false,
            editable: f.editable !== false,
            options: f.options || [],
          };
        }),
      })),
    }));

    // Fallback if no sections exist
    if (sections.length === 0) {
      const fallbackFields: TemplateField[] = [];
      const keys = Object.keys(parsed);
      keys.forEach((k, idx) => {
        if (!['code', 'name', 'version', 'status', 'description'].includes(k)) {
          const internalName = toInternalName(k);
          fallbackFields.push({
            id: `fld_${internalName}`,
            internalName,
            label: k,
            type: inferFieldType(parsed[k]),
            required: isRequiredByName(internalName),
            order: idx + 1,
            visible: true,
            editable: true,
          });
        }
      });

      if (fallbackFields.length > 0) {
        sections.push({
          id: 'sec_general',
          name: 'General Information',
          order: 1,
          groups: [
            {
              id: 'grp_attributes',
              name: 'Structure Attributes',
              order: 1,
              fields: fallbackFields,
            },
          ],
        });
        detectedFieldsCount = fallbackFields.length;
      }
    }

    const code = (parsed.code || (fileFileName ? fileFileName.replace(/\.[^/.]+$/, '') : 'JSON_STRUCT')).toUpperCase();
    const name = parsed.name || (fileFileName ? fileFileName.replace(/\.[^/.]+$/, '') : 'JSON Structure');

    return {
      code,
      name,
      version: parsed.version || '1.0',
      status: parsed.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
      description: parsed.description || 'Project structure imported from JSON schema.',
      orientation: 'VERTICAL',
      sections,
      detectedFieldCount: detectedFieldsCount,
      detectedModuleCount: sections.length,
    };
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
}
