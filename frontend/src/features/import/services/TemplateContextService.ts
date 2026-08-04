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

    return {
      key: field.internalName || field.id,
      label: field.label,
      description: field.helpText ?? '',
      required: field.required ?? false,
      type: field.type,
      aliases: [...new Set(aliases)],
    };
  }
}
