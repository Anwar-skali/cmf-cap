/**
 * OllamaMappingService (Frontend)
 *
 * Calls the backend RAG endpoint to generate semantic column mappings
 * using local Ollama. Provides status checking and result normalization.
 */
import {
  generateOllamaMapping,
  type OllamaMappingResult,
  type OllamaMappingItem,
} from '@/api/endpoints/importApi';

export interface MappingEntry {
  /** Database field key */
  fieldKey: string;
  /** Matched Excel column header or null */
  excelHeader: string | null;
  /** Confidence score 0.0–1.0 */
  confidence: number;
  /** Match source attribution */
  source: OllamaMappingItem['source'];
}

export class OllamaMappingService {
  /**
   * Calls the backend /import/ollama-map endpoint with the selected template
   * and extracted Excel headers. Returns the full OllamaMappingResult.
   *
   * @param templateIdentifier - Template code (e.g. 'K9'), UUID, or entity type
   * @param excelHeaders - List of Excel column header strings
   * @param file - Optional uploaded file (backend can extract headers from file)
   */
  static async generateMapping(
    templateIdentifier: string,
    excelHeaders: string[],
    file?: File,
    headerRow?: number,
    sheetName?: string,
    orientation?: string,
  ): Promise<OllamaMappingResult> {
    return generateOllamaMapping(templateIdentifier, excelHeaders, file, headerRow, sheetName, orientation);
  }


  /**
   * Converts the mapping result into a flat db_field_key -> excel_header dict
   * suitable for the wizard state and the import execute API.
   */
  static toWizardMapping(result: OllamaMappingResult): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    for (const [fieldKey, item] of Object.entries(result.mapping)) {
      out[fieldKey] = item.excel ?? null;
    }
    return out;
  }

  /**
   * Converts the wizard mapping (db_field_key -> excel_header) to the
   * format expected by the execute API (excel_header -> db_field_key).
   */
  static toExecuteMapping(wizardMapping: Record<string, string | null>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [fieldKey, excelHeader] of Object.entries(wizardMapping)) {
      if (excelHeader && excelHeader !== '__ignore__') {
        out[excelHeader] = fieldKey;
      }
    }
    return out;
  }

  /**
   * Returns a summary of the mapping for display.
   */
  static getSummary(result: OllamaMappingResult): {
    total: number;
    mapped: number;
    highConf: number;
    medConf: number;
    lowConf: number;
    noMatch: number;
  } {
    const items = Object.values(result.mapping);
    const mapped = items.filter((i) => i.excel && i.confidence > 0).length;
    return {
      total: items.length,
      mapped,
      highConf: items.filter((i) => i.confidence >= 0.9 && i.excel).length,
      medConf: items.filter((i) => i.confidence >= 0.7 && i.confidence < 0.9 && i.excel).length,
      lowConf: items.filter((i) => i.confidence > 0 && i.confidence < 0.7 && i.excel).length,
      noMatch: items.filter((i) => !i.excel || i.confidence === 0).length,
    };
  }
}
