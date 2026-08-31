/**
 * TemplateContextService (Frontend)
 *
 * Retrieves and normalizes project template definitions for use in the import wizard.
 * Extracts field metadata from the full template schema (sections -> groups -> fields).
 */
import { templatesApi } from '@/api/templates';
import type { CMFTemplate, TemplateField } from '@/types/template';

export interface NormalizedField {
  key: string;
  label: string;
  description: string;
  required: boolean;
  type: string;
  aliases: string[];
}

export interface NormalizedTemplateContext {
  templateId: string;
  templateCode: string;
  templateName: string;
  description: string;
  version: string;
  fields: NormalizedField[];
}

export class TemplateContextService {
  /**
   * Fetches all published templates from the API.
   */
  static async getPublishedTemplates(): Promise<CMFTemplate[]> {
    const result = await templatesApi.getTemplates();
    return (result.items || []).filter((t) => t.status === 'PUBLISHED');
  }

  /**
   * Fetches a single template by code and returns a normalized context.
   */
  static async getTemplateContext(code: string): Promise<NormalizedTemplateContext> {
    const tmpl = await templatesApi.getTemplateByCode(code);
    return TemplateContextService.normalizeTemplate(tmpl);
  }

  /**
   * Normalizes a CMFTemplate into a flat list of field definitions
   * by recursively extracting from sections -> groups -> fields.
   */
  static normalizeTemplate(tmpl: CMFTemplate): NormalizedTemplateContext {
    const fields: NormalizedField[] = [];

    const sections = tmpl.sections ?? tmpl.schema_json?.sections ?? [];
    for (const section of sections) {
      for (const group of section.groups ?? []) {
        for (const field of group.fields ?? []) {
          fields.push(TemplateContextService.normalizeField(field));
        }
      }
    }

    return {
      templateId: tmpl.id,
      templateCode: tmpl.code,
      templateName: tmpl.name,
      description: tmpl.description ?? '',
      version: tmpl.version,
      fields,
    };
  }

  private static readonly DEFAULT_COMMON_ALIASES: Record<string, string[]> = {
    unique_id: ['project code', 'code', 'unique id', 'unique_id', 'ref', 'project ref', 'id piece', 'id'],
    part_name: ['part name', 'project name', 'name', 'title', 'designation', 'part designation'],
    part_number: ['part number', 'part_number', 'pn', 'part no', 'part n', 'ref piece'],
    supplier_name: ['supplier', 'supplier name', 'company', 'vendor', 'fournisseur', 'supplier_name'],
    manufacturing_cofor: ['manufacturing cofor', 'cofor', 'supplier cofor', 'cofor code', 'buyer cofor', 'manufacturing_cofor', 'code cofor'],
    production_location: ['production location', 'plant location', 'location', 'factory location', 'production_location', 'plant'],
    use_case: ['use case', 'application', 'usecase', 'use_case', 'vehicle application'],
    apqp: ['apqp', 'apqp phase', 'apqp status', 'apqp_phase'],
    contracted_capacity: ['contracted capacity', 'capacity contracted', 'contract capacity', 'contracted_capacity'],
    capacity_standard: ['capacity standard', 'standard capacity', 'capacity standard parts week', 'capacity_standard'],
    technical_manager: ['technical manager', 'sqd technical manager', 'tech manager', 'responsable technique', 'technical_manager'],
    k9_sck: ['k9 sck', 'sck', 'k9_sck', 'sqd k9 sck', 'sqd sck', 'supplier capacity checklist'],
    cat1_forecast_date_cw: [
      'cat1 forecast date cw',
      'cat1 forecasted date cw',
      'cat1 forecasted date',
      'cat1 forecast date',
      'cat1 forecast',
      'cat1 cw',
      'cat 1 forecast date cw',
      'cat 1 forecasted date cw',
      'cat 1 forecasted date',
      'cat 1 forecast date',
      'cat 1 forecast',
      'cat 1 cw',
      'sqd cat1 forecast date cw',
      'sqd cat1 forecasted date cw',
      'sqd cat1 forecasted date',
      'sqd cat1 forecast date',
      'sqd cat 1 forecast date cw',
      'sqd cat 1 forecasted date cw',
      'sqd cat 1 forecasted date',
      'sqd cat 1 forecast date',
      'cat1_forecast_date_cw',
    ],
    cat2_forecast_date: [
      'cat2 forecast date',
      'cat2 forecasted date',
      'cat2 forecast',
      'cat 2 forecast date',
      'cat 2 forecasted date',
      'cat 2 forecast',
      'sqd cat2 forecast date',
      'sqd cat2 forecasted date',
      'sqd cat 2 forecast date',
      'sqd cat 2 forecasted date',
      'cat2_forecast_date',
    ],
    cat3_forecast_date: [
      'cat3 forecast date',
      'cat3 forecasted date',
      'cat3 forecast',
      'cat 3 forecast date',
      'cat 3 forecasted date',
      'cat 3 forecast',
      'sqd cat3 forecast date',
      'sqd cat3 forecasted date',
      'sqd cat 3 forecast date',
      'sqd cat 3 forecasted date',
      'cat3_forecast_date',
    ],
    cat1_2_3_type: [
      'cat1 2 3 type',
      'cat type',
      'cat1 2 3',
      'cat audit type',
      'sqd cat1 2 3 type',
      'sqd cat type',
      'cat 1 2 3 type',
      'cat1_2_3_type',
    ],
    weekly_capacity_measured: [
      'weekly capacity measured',
      'measured weekly capacity',
      'capacity measured',
      'sqd weekly capacity measured',
      'weekly capacity',
      'measured capacity',
      'weekly_capacity_measured',
    ],
    cat_evaluation: [
      'gor',
      'cat',
      'cat evaluation',
      'cat_evaluation',
      'cat1 2 3 evaluation',
      'sqd evaluation',
      'cat 1 2 3 evaluation',
      'evaluation cat',
      'evaluation sqd',
    ],
    comments: ['comments', 'sqd comments', 'auditor comments', 'notes', 'observations'],
    sqe: ['sqe', 'supplier quality engineer', 'sqd engineer', 'sqe name'],
    sqm: ['sqm', 'supplier quality manager', 'sqd manager', 'sqm name'],
    team: ['team', 'sqd team', 'responsible team', 'equipe'],
    family_multiplier: ['family multiplier', 'family factor', 'multiplier', 'family_multiplier'],
  };

  private static normalizeField(field: TemplateField): NormalizedField {
    // Collect aliases from excel mapping or from an 'aliases' custom property
    const aliases: string[] = [];
    if (field.excel?.importAlias) aliases.push(field.excel.importAlias);
    if (field.excel?.columnName) aliases.push(field.excel.columnName);
    // Some fields may have an `aliases` prop (not in base type, but extensible)
    const anyField = field as any;
    if (Array.isArray(anyField.aliases)) {
      aliases.push(...anyField.aliases);
    }

    const key = field.internalName || field.id;
    if (TemplateContextService.DEFAULT_COMMON_ALIASES[key]) {
      aliases.push(...TemplateContextService.DEFAULT_COMMON_ALIASES[key]);
    }

    return {
      key,
      label: field.label,
      description: field.helpText ?? '',
      required: field.required ?? false,
      type: field.type,
      aliases: [...new Set(aliases)],
    };
  }
}
