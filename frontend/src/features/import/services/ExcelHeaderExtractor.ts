/**
 * ExcelHeaderExtractor (Frontend)
 *
 * Client-side worksheet and header extraction using the xlsx library.
 * Scans ALL worksheets in a workbook independently:
 *   - Scores worksheets based on project domain keywords, column/row count, text ratio
 *   - Penalizes dashboard, chart, pivot table, KPI, and summary sheet names/contents
 *   - Calculates percentage confidence for worksheet selection and header row (1-20)
 *   - Supports instant client-side switching of worksheet or header row without re-uploading
 */
import * as XLSX from 'xlsx';

const HEADER_KEYWORDS = new Set([
  'unique_id', 'unique id', 'supplier_name', 'supplier name', 'part_number', 'part number',
  'part_name', 'part name', 'apqp', 'weekly_capacity', 'weekly capacity', 'sqe', 'sqm',
  'cat1', 'cat2', 'cat3', 'capacity', 'supplier', 'project', 'code', 'status', 'title',
  'name', 'description', 'target', 'unit', 'quantity', 'date', 'type', 'category',
  'email', 'phone', 'address', 'version', 'id',
]);

const PENALTY_REGEX = /\b(dashboard|chart|charts|graph|pivot|pivot table|pivot tables|summary|overview|cover|index|kpi|kpi summary|kpi carry-over|report|template|readme|guide|instruction|legend|info|master|lookup|reference|ref|drop|dropdown|list|validation|config|sqd list|run scheduling|gst|grand total|row labels|status summary)\b/i;

export interface RowPreview {
  rowNumber: number;
  score: number;
  confidence: number;
  nonEmptyCount: number;
  preview: string[];
}

export interface WorksheetScore {
  sheetName: string;
  score: number;
  confidence: number; // 0 - 100%
  populatedRows: number;
  maxColumns: number;
  keywordHits: number;
  isDashboardName: boolean;
  preview: string[];
}

export interface ClientExtractedHeaders {
  headers: string[];
  sheetName: string;
  sheetConfidence: number; // 0 - 100%
  fileSize: number;
  detectedHeaderRow: number;
  headerConfidence: number; // 0 - 100%
  sheetScores: WorksheetScore[];
  rowPreviews: RowPreview[];
}

function scoreRow(row: any[], extraKeywords?: Set<string>): { score: number; confidence: number } {
  const nonEmpty = row.filter((c) => c != null && String(c).trim() !== '').map((c) => String(c).trim());
  if (nonEmpty.length === 0) return { score: 0, confidence: 0 };

  let score = nonEmpty.length;
  let keywordHits = 0;
  const allKeywords = extraKeywords ? new Set([...HEADER_KEYWORDS, ...extraKeywords]) : HEADER_KEYWORDS;
  let numericCount = 0;

  for (const val of nonEmpty) {
    const cleanV = val.toLowerCase().replace(/_/g, ' ').trim();

    if (allKeywords.has(cleanV)) {
      score += 10;
      keywordHits++;
    } else {
      for (const kw of allKeywords) {
        if (kw.length >= 3 && (kw.includes(cleanV) || cleanV.includes(kw))) {
          score += 4;
          keywordHits++;
          break;
        }
      }
    }

    if (/^\d+(\.\d+)?$/.test(val) || /^\d{4}-\d{2}-\d{2}/.test(val)) {
      numericCount++;
    }
  }

  if (nonEmpty.length > 0 && numericCount / nonEmpty.length > 0.4) {
    score -= 20;
  }

  const rawScore = Math.max(score, 0);
  const confidence = rawScore > 0
    ? Math.min(100, Math.max(10, Math.round((keywordHits / Math.max(nonEmpty.length, 1)) * 70 + (nonEmpty.length / 30) * 30)))
    : 0;

  return { score: Math.round(rawScore * 100) / 100, confidence };
}

function scoreWorksheet(sheet: XLSX.WorkSheet, sheetName: string, extraKeywords?: Set<string>): WorksheetScore {
  const isDashboardName = PENALTY_REGEX.test(sheetName);
  const namePenalty = isDashboardName ? -60 : 0;

  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  let populatedRows = 0;
  let maxColumns = 0;
  let keywordHits = 0;
  let penaltyContentHits = 0;

  const allKeywords = extraKeywords ? new Set([...HEADER_KEYWORDS, ...extraKeywords]) : HEADER_KEYWORDS;

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] || [];
    const nonEmpty = row.filter((c) => c != null && String(c).trim() !== '').map((c) => String(c).trim());
    if (nonEmpty.length > 0) {
      populatedRows++;
      maxColumns = Math.max(maxColumns, nonEmpty.length);
      for (const val of nonEmpty) {
        const clean = val.toLowerCase().replace(/_/g, ' ').trim();
        if (PENALTY_REGEX.test(clean)) penaltyContentHits++;
        if (allKeywords.has(clean)) {
          keywordHits++;
        } else {
          for (const kw of allKeywords) {
            if (kw.length >= 3 && (kw.includes(clean) || clean.includes(kw))) {
              keywordHits++;
              break;
            }
          }
        }
      }
    }
  }

  const rowScore = Math.min(populatedRows, 20) * 1.5;
  const colScore = Math.min(maxColumns, 60) * 2.5;
  const kwScore = Math.min(keywordHits, 30) * 6.0;
  const contentPenalty = Math.min(penaltyContentHits, 10) * -15;

  const rawScore = rowScore + colScore + kwScore + namePenalty + contentPenalty;
  const maxBenchmark = 360;

  let confidence = 5;
  if (rawScore > 0) {
    confidence = Math.min(99, Math.max(5, Math.round((rawScore / maxBenchmark) * 100)));
  } else if (isDashboardName) {
    confidence = 5;
  } else {
    confidence = 12;
  }

  let preview: string[] = [];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i] || [];
    const cells = row.filter((c) => c != null && String(c).trim() !== '').map((c) => String(c).trim());
    if (cells.length > preview.length) {
      preview = cells.slice(0, 8);
    }
  }

  return {
    sheetName,
    score: Math.round(rawScore * 100) / 100,
    confidence,
    populatedRows,
    maxColumns,
    keywordHits,
    isDashboardName,
    preview,
  };
}

export class ExcelHeaderExtractor {
  /**
   * Scans ALL worksheets in workbook, scores each sheet, and extracts headers from target sheet and row.
   */
  static async extractFromFile(
    file: File,
    specifiedHeaderRow?: number,
    specifiedSheetName?: string,
    extraKeywords?: Set<string>,
  ): Promise<ClientExtractedHeaders> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) throw new Error('Failed to read file content.');

          const workbook = XLSX.read(data, { type: 'array', sheetRows: 20 });
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('No worksheets found in the uploaded Excel file.');
          }

          const sheetScores: WorksheetScore[] = [];
          let bestSheetName = workbook.SheetNames[0];
          let bestSheetScore = -9999;

          for (const sName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sName];
            if (!sheet) continue;
            const scoreInfo = scoreWorksheet(sheet, sName, extraKeywords);
            sheetScores.push(scoreInfo);
            if (scoreInfo.score > bestSheetScore) {
              bestSheetScore = scoreInfo.score;
              bestSheetName = sName;
            }
          }

          const targetSheetName =
            specifiedSheetName && workbook.SheetNames.includes(specifiedSheetName)
              ? specifiedSheetName
              : bestSheetName;

          const targetSheetInfo = sheetScores.find((s) => s.sheetName === targetSheetName);
          const sheetConfidence = targetSheetInfo?.confidence ?? 85;

          const targetSheet = workbook.Sheets[targetSheetName];
          if (!targetSheet) throw new Error(`Worksheet '${targetSheetName}' could not be loaded.`);

          const rows: any[][] = XLSX.utils.sheet_to_json(targetSheet, { header: 1, defval: null });

          const rowPreviews: RowPreview[] = [];
          let bestRowIdx = 1;
          let bestRowScore = -999;
          let bestRowConf = 0;

          for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const row = rows[i] || [];
            const { score, confidence } = scoreRow(row, extraKeywords);
            const nonEmptyCells = row
              .filter((c: any) => c != null && String(c).trim() !== '')
              .map((c: any) => String(c).trim());

            rowPreviews.push({
              rowNumber: i + 1,
              score,
              confidence,
              nonEmptyCount: nonEmptyCells.length,
              preview: nonEmptyCells.slice(0, 8),
            });

            if (score > bestRowScore) {
              bestRowScore = score;
              bestRowIdx = i + 1;
              bestRowConf = confidence;
            }
          }

          const targetRowIdx =
            specifiedHeaderRow && specifiedHeaderRow >= 1 && specifiedHeaderRow <= rows.length
              ? specifiedHeaderRow
              : bestRowIdx;

          const headerConfidence = rowPreviews[targetRowIdx - 1]?.confidence ?? bestRowConf;
          const targetRow = rows[targetRowIdx - 1] || [];

          const headers: string[] = [];
          for (const cell of targetRow) {
            const val = cell != null ? String(cell).trim() : '';
            if (val !== '' || headers.length > 0) {
              headers.push(val);
            }
          }

          while (headers.length > 0 && headers[headers.length - 1] === '') {
            headers.pop();
          }

          resolve({
            headers,
            sheetName: targetSheetName,
            sheetConfidence,
            fileSize: file.size,
            detectedHeaderRow: targetRowIdx,
            headerConfidence,
            sheetScores,
            rowPreviews,
          });
        } catch (err: any) {
          reject(new Error(`Header extraction failed: ${err?.message ?? 'Unknown error'}`));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read the Excel file.'));
      reader.readAsArrayBuffer(file);
    });
  }
}
