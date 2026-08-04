/**
 * MappingCacheService (Frontend)
 *
 * Persists user-confirmed header-to-field mappings in localStorage and
 * also synchronizes to the server-side mapping memory cache endpoint.
 * Serves as the foundation for future AI mapping memory features.
 */
import { saveMappingMemory } from '@/api/endpoints/importApi';

const CACHE_KEY_PREFIX = 'cmf_mapping_cache_';

export class MappingCacheService {
  /**
   * Save mapping to localStorage under the given template code.
   * mapping format: { db_field_key: excel_header }
   */
  static saveLocally(templateCode: string, mapping: Record<string, string | null>): void {
    try {
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(mapping)) {
        if (v && v !== '__ignore__') cleaned[k] = v;
      }
      localStorage.setItem(`${CACHE_KEY_PREFIX}${templateCode.toUpperCase()}`, JSON.stringify(cleaned));
    } catch (_) {
      // Storage quota exceeded or unavailable — fail silently
    }
  }

  /**
   * Load locally cached mapping for a template code.
   * Returns null if nothing is cached.
   */
  static loadLocally(templateCode: string): Record<string, string> | null {
    try {
      const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${templateCode.toUpperCase()}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  /**
   * Saves the confirmed mapping to the server-side mapping memory endpoint.
   * Does not block the import flow — errors are swallowed gracefully.
   */
  static async syncToServer(
    templateCode: string,
    mapping: Record<string, string | null>,
  ): Promise<void> {
    try {
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(mapping)) {
        if (v && v !== '__ignore__') cleaned[k] = v;
      }
      if (Object.keys(cleaned).length > 0) {
        await saveMappingMemory(templateCode, cleaned);
        MappingCacheService.saveLocally(templateCode, mapping);
      }
    } catch (_) {
      // Non-blocking — import flow should never fail due to caching errors
    }
  }

  /**
   * Clears the local cache for a template code.
   */
  static clearLocal(templateCode: string): void {
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${templateCode.toUpperCase()}`);
  }
}
