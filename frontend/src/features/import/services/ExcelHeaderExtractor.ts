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

export type OrientationMode = 'AUTO' | 'HORIZONTAL' | 'VERTICAL';

export interface OrientationInfo {
  orientation: 'HORIZONTAL' | 'VERTICAL';
  confidence: number;       // 0–100
  fieldColumn: string;      // e.g. 'A' — only for VERTICAL
  valueColumn: string;      // e.g. 'B' — only for VERTICAL
  reason: string;
  // Vertical-specific stats (populated for VERTICAL mode)
  detectedFields?: number;       // Col A non-empty field names
  projectFieldMatches?: number;  // Col A values matching domain keywords
  valueFillCount?: number;       // Col B non-empty where Col A is non-empty
}

export interface WorksheetScore {
  sheetName: string;
  score: number;
  confidence: number;
  populatedRows: number;
  maxColumns: number;
  keywordHits: number;
  isDashboardName: boolean;
  classification: 'PROJECT_DATA' | 'SUMMARY' | 'PIVOT_TABLE' | 'KPI' | 'REFERENCE_DATA' | 'EMPTY' | 'UNKNOWN';
  pivotIndicators: number;
  projectFieldMatches: number;
  structureSimilarity: number;
  preview: string[];
}

export interface ClientExtractedHeaders {
  headers: string[];
  sheetName: string;
  sheetConfidence: number;
  fileSize: number;
  detectedHeaderRow: number;
  headerConfidence: number;
  sheetScores: WorksheetScore[];
  rowPreviews: RowPreview[];
  orientationInfo: OrientationInfo;
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

function classifyWorksheet(
  sheetName: string,
  populatedRows: number,
  maxCols: number,
  pivotIndicators: number,
  projectFieldMatches: number,
  isDashboardName: boolean
): 'PROJECT_DATA' | 'SUMMARY' | 'PIVOT_TABLE' | 'KPI' | 'REFERENCE_DATA' | 'EMPTY' | 'UNKNOWN' {
  if (populatedRows < 2) return 'EMPTY';
  if (isDashboardName) {
    const cleanName = sheetName.toLowerCase();
    if (cleanName.includes('kpi')) return 'KPI';
    if (cleanName.includes('pivot')) return 'PIVOT_TABLE';
    if (cleanName.includes('lookup') || cleanName.includes('ref') || cleanName.includes('guide')) return 'REFERENCE_DATA';
    return 'SUMMARY';
  }
  if (pivotIndicators >= 2) return 'PIVOT_TABLE';
  if (maxCols <= 5 && pivotIndicators >= 1) return 'SUMMARY';
  if (maxCols <= 5 && projectFieldMatches < 3) return 'KPI';
  if (projectFieldMatches >= 3 || maxCols >= 10) return 'PROJECT_DATA';
  return 'UNKNOWN';
}

function scoreWorksheet(sheet: XLSX.WorkSheet, sheetName: string, extraKeywords?: Set<string>): WorksheetScore {
  const isDashboardName = PENALTY_REGEX.test(sheetName);
  const namePenalty = isDashboardName ? -60 : 0;

  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  let populatedRows = 0;
  let maxColumns = 0;
  let keywordHits = 0;
  let pivotIndicators = 0;
  let projectFieldMatches = 0;

  const allKeywords = extraKeywords ? new Set([...HEADER_KEYWORDS, ...extraKeywords]) : HEADER_KEYWORDS;
  const pivotRegex = /\b(grand total|row labels|count of|nombre de|total|kpi|sum of|average of|count|kpi summary)\b/i;

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] || [];
    const nonEmpty = row.filter((c) => c != null && String(c).trim() !== '').map((c) => String(c).trim());
    if (nonEmpty.length > 0) {
      populatedRows++;
      maxColumns = Math.max(maxColumns, nonEmpty.length);
      for (const val of nonEmpty) {
        const clean = val.toLowerCase().replace(/_/g, ' ').trim();
        if (pivotRegex.test(clean)) pivotIndicators++;
        if (allKeywords.has(clean)) {
          keywordHits++;
          projectFieldMatches++;
        } else {
          for (const kw of allKeywords) {
            if (kw.length >= 3 && (kw.includes(clean) || clean.includes(kw))) {
              keywordHits++;
              projectFieldMatches++;
              break;
            }
          }
        }
      }
    }
  }

  const classification = classifyWorksheet(
    sheetName,
    populatedRows,
    maxColumns,
    pivotIndicators,
    projectFieldMatches,
    isDashboardName
  );

  const colScore = Math.min(maxColumns, 80) * 4.0;
  const rowScore = Math.min(populatedRows, 20) * 1.5;
  const kwDensity = Math.min((keywordHits / Math.max(maxColumns, 1)) * 40.0, 100.0);

  let structureSimilarity = 0;
  if (extraKeywords && extraKeywords.size > 0) {
    let matchCount = 0;
    const topRowsStr = JSON.stringify(rows.slice(0, 5)).toLowerCase();
    for (const kw of extraKeywords) {
      if (topRowsStr.includes(kw.toLowerCase())) matchCount++;
    }
    structureSimilarity = Math.min(1.0, matchCount / Math.max(extraKeywords.size, 1));
  }
  const structBonus = structureSimilarity * 60.0;

  let classificationPenalty = 0;
  if (classification === 'PIVOT_TABLE') classificationPenalty = -100;
  else if (classification === 'KPI') classificationPenalty = -120;
  else if (classification === 'SUMMARY') classificationPenalty = -80;
  else if (classification === 'REFERENCE_DATA') classificationPenalty = -40;

  const pivotPenalty = Math.min(pivotIndicators, 10) * -15;
  const narrowPenalty = maxColumns < 6 ? -25 : 0;

  const rawScore = colScore + rowScore + kwDensity + structBonus + namePenalty + classificationPenalty + pivotPenalty + narrowPenalty;
  const maxBenchmark = 510;

  let confidence = 5;
  if (rawScore > 0) {
    confidence = Math.min(99, Math.max(5, Math.round((rawScore / maxBenchmark) * 100)));
  } else if (isDashboardName || classification !== 'PROJECT_DATA') {
    confidence = 5;
  } else {
    confidence = 10;
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
    classification,
    pivotIndicators,
    projectFieldMatches,
    structureSimilarity: Math.round(structureSimilarity * 100),
    preview,
  };
}

/**
 * Orientation-aware scorer for VERTICAL (key-value) worksheets.
 * Col A = field names, Col B = values.
 * Score is driven by: field/value pair count, domain keyword matches in Col A,
 * value fill ratio, and dashboard name penalty.
 */
function scoreWorksheetVertical(sheet: XLSX.WorkSheet, sheetName: string, extraKeywords?: Set<string>): WorksheetScore {
  const isDashboardName = PENALTY_REGEX.test(sheetName);
  const namePenalty = isDashboardName ? -60 : 0;

  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const allKw = extraKeywords ? new Set([...HEADER_KEYWORDS, ...extraKeywords]) : HEADER_KEYWORDS;

  let fieldPairs = 0;   // rows where Col A is non-empty
  let fieldMatches = 0; // Col A matches domain keywords
  let valueFills = 0;   // Col A non-empty AND Col B non-empty
  const preview: string[] = [];

  for (const row of rows) {
    const colA = row[0] != null ? String(row[0]).trim() : '';
    const colB = row[1] != null ? String(row[1]).trim() : '';
    if (!colA) continue;
    fieldPairs++;
    if (colB) valueFills++;
    const norm = colA.toLowerCase().replace(/_/g, ' ');
    if (allKw.has(norm) || norm.includes('id') || norm.includes('name') || norm.includes('date')) {
      fieldMatches++;
    }
    if (preview.length < 4) {
      preview.push(colB ? `${colA}: ${colB}` : colA);
    }
  }

  const fillRatio = fieldPairs > 0 ? valueFills / fieldPairs : 0;
  const matchRatio = fieldPairs > 0 ? fieldMatches / fieldPairs : 0;

  // Score: field matches contribute most, fill ratio and count secondary
  const rawScore = fieldMatches * 15.0 + fieldPairs * 2.0 + fillRatio * 30.0 + namePenalty;
  const confidence = fieldPairs >= 3
    ? Math.min(99, Math.max(5, Math.round(matchRatio * 70 + fillRatio * 20 + Math.min(fieldPairs / 20, 1) * 10)))
    : 5;

  const classification: WorksheetScore['classification'] =
    fieldMatches >= 4 ? 'PROJECT_DATA' :
    fieldPairs >= 3 ? 'UNKNOWN' : 'EMPTY';

  return {
    sheetName,
    score: Math.round(rawScore * 100) / 100,
    confidence,
    populatedRows: fieldPairs,        // reused: number of valid Col A rows
    maxColumns: 2,                     // always 2 columns (A, B)
    keywordHits: fieldMatches,
    isDashboardName,
    classification,
    pivotIndicators: 0,
    projectFieldMatches: fieldMatches,
    structureSimilarity: Math.round(fillRatio * 100), // value fill % as structure similarity
    preview,
  };
}

export class ExcelHeaderExtractor {
  /**
   * Detect the orientation of a worksheet given its raw rows and optional keyword hint.
   * Returns VERTICAL when Column A contains many domain field names and Column B has matching values.
   */
  static detectOrientation(
    rows: any[][],
    extraKeywords?: Set<string>,
    specifiedOrientation?: OrientationMode,
  ): OrientationInfo {
    // ── Always compute vertical stats (needed for the Step 2 banner) ─────────
    const sample = rows.slice(0, 80);
    const allKw = new Set([
      'unique_id', 'unique id', 'supplier_name', 'supplier name', 'part_number', 'part number',
      'part_name', 'part name', 'apqp', 'weekly_capacity', 'weekly capacity', 'sqe', 'sqm',
      'cat1', 'cat2', 'cat3', 'capacity', 'supplier', 'project', 'code', 'status', 'title',
      'name', 'description', 'target', 'unit', 'quantity', 'date', 'type', 'category', 'id',
      ...(extraKeywords ? [...extraKeywords] : []),
    ]);

    let detectedFields = 0;
    let fieldMatches = 0;
    let valueFillCount = 0;

    for (const row of sample) {
      const colA = row[0] != null ? String(row[0]).trim() : '';
      const colB = row[1] != null ? String(row[1]).trim() : '';
      if (!colA) continue;
      detectedFields++;
      if (colB) valueFillCount++;
      const norm = colA.toLowerCase().replace(/_/g, ' ');
      if (allKw.has(norm) || norm.includes('id') || norm.includes('name') || norm.includes('date')) {
        fieldMatches++;
      }
    }

    // ── User hard-overrides (with stats injected) ─────────────────────────────
    if (specifiedOrientation === 'VERTICAL') {
      console.log('[IMPORT] Orientation selected: VERTICAL');
      console.log('[IMPORT] Orientation source: USER');
      console.log(`[IMPORT] Detected vertical fields: ${detectedFields}, Matched: ${fieldMatches}, Value fills: ${valueFillCount}`);
      return {
        orientation: 'VERTICAL',
        confidence: 100,
        fieldColumn: 'A',
        valueColumn: 'B',
        reason: 'User-specified Vertical.',
        detectedFields,
        projectFieldMatches: fieldMatches,
        valueFillCount,
      };
    }
    if (specifiedOrientation === 'HORIZONTAL') {
      console.log('[IMPORT] Orientation selected: HORIZONTAL');
      console.log('[IMPORT] Orientation source: USER');
      return {
        orientation: 'HORIZONTAL',
        confidence: 100,
        fieldColumn: '',
        valueColumn: '',
        reason: 'User-specified Horizontal.',
      };
    }

    // ── Auto-detect heuristics ────────────────────────────────────────────────
    const colA: string[] = sample
      .map((r) => (r[0] != null ? String(r[0]).trim() : ''))
      .filter(Boolean);
    const colB: string[] = sample
      .map((r) => (r[1] != null ? String(r[1]).trim() : ''));
    const colBPopulated = colB.filter(Boolean).length;

    if (colA.length < 3) {
      return { orientation: 'HORIZONTAL', confidence: 80, fieldColumn: '', valueColumn: '', reason: 'Too few Column A values.' };
    }

    const matchRatio = fieldMatches / colA.length;
    const colBFillRatio = colBPopulated / Math.max(colA.length, 1);

    if (matchRatio >= 0.3 && colBFillRatio >= 0.5) {
      const conf = Math.min(95, Math.round(matchRatio * 60 + colBFillRatio * 40));
      console.log(`[IMPORT] Auto-detected VERTICAL (conf: ${conf}%, fields: ${detectedFields}, matches: ${fieldMatches})`);
      return {
        orientation: 'VERTICAL',
        confidence: conf,
        fieldColumn: 'A',
        valueColumn: 'B',
        reason: `${fieldMatches}/${colA.length} Col-A cells match domain fields (${Math.round(matchRatio * 100)}%), Col-B fill ${Math.round(colBFillRatio * 100)}%.`,
        detectedFields,
        projectFieldMatches: fieldMatches,
        valueFillCount: colBPopulated,
      };
    }

    console.log(`[IMPORT] Auto-detected HORIZONTAL (field match ratio: ${Math.round(matchRatio * 100)}%)`);
    return {
      orientation: 'HORIZONTAL',
      confidence: 70,
      fieldColumn: '',
      valueColumn: '',
      reason: `Only ${fieldMatches}/${colA.length} Col-A field matches (${Math.round(matchRatio * 100)}%) or Col-B fill too low (${Math.round(colBFillRatio * 100)}%).`,
    };
  }

  /**
   * Scans ALL worksheets in workbook, scores each sheet, and extracts headers from target sheet and row.
   * Supports automatic and manual orientation detection (HORIZONTAL vs VERTICAL).
   */
  static async extractFromFile(
    file: File,
    specifiedHeaderRow?: number,
    specifiedSheetName?: string,
    extraKeywords?: Set<string>,
    specifiedOrientation?: OrientationMode,
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
          const useVerticalScoring = specifiedOrientation === 'VERTICAL';

          console.log(`[IMPORT] Worksheet: scoring ${workbook.SheetNames.length} sheets using ${useVerticalScoring ? 'VERTICAL' : 'HORIZONTAL'} algorithm`);

          for (const sName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sName];
            if (!sheet) continue;
            const scoreInfo = useVerticalScoring
              ? scoreWorksheetVertical(sheet, sName, extraKeywords)
              : scoreWorksheet(sheet, sName, extraKeywords);
            sheetScores.push(scoreInfo);
          }

          // Two-stage selection: Stage A (filter PROJECT_DATA candidates) & Stage B (rank)
          const projectDataCandidates = sheetScores.filter(
            (s) => s.classification === 'PROJECT_DATA' || s.classification === 'UNKNOWN'
          );
          const candidatesToRank = projectDataCandidates.length > 0 ? projectDataCandidates : sheetScores;
          
          let bestSheetName = candidatesToRank[0]?.sheetName || workbook.SheetNames[0];
          let bestSheetScore = -9999;

          for (const s of candidatesToRank) {
            if (s.score > bestSheetScore) {
              bestSheetScore = s.score;
              bestSheetName = s.sheetName;
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

          // Read more rows for orientation detection (no sheetRows cap here)
          const workbookFull = XLSX.read(data, { type: 'array', sheetRows: 100 });
          const fullRows: any[][] = XLSX.utils.sheet_to_json(
            workbookFull.Sheets[targetSheetName] || targetSheet,
            { header: 1, defval: null }
          );

          // ── Orientation Detection ────────────────────────────────────────────
          const orientationInfo = ExcelHeaderExtractor.detectOrientation(
            fullRows,
            extraKeywords,
            specifiedOrientation,
          );

          // ── VERTICAL PATH ───────────────────────────────────────────────────
          if (orientationInfo.orientation === 'VERTICAL') {
            // Column A = field names, Column B = values
            const fieldHeaders: string[] = [];
            const vertRowPreviews: RowPreview[] = [];

            for (let i = 0; i < fullRows.length; i++) {
              const row = fullRows[i] || [];
              const fieldName = row[0] != null ? String(row[0]).trim() : '';
              const value = row[1] != null ? String(row[1]).trim() : '';
              if (!fieldName) continue;
              fieldHeaders.push(fieldName);
              vertRowPreviews.push({
                rowNumber: i + 1,
                score: 0,
                confidence: 80,
                nonEmptyCount: value !== '' ? 1 : 0,
                preview: [fieldName, value].filter(Boolean),
              });
            }

            const matched = orientationInfo.projectFieldMatches ?? 0;
            const unmapped = fieldHeaders.length - matched;
            console.log(`[IMPORT] Orientation selected: ${orientationInfo.orientation}`);
            console.log(`[IMPORT] Orientation source: ${specifiedOrientation && specifiedOrientation !== 'AUTO' ? 'USER' : 'AUTO'}`);
            console.log(`[IMPORT] Worksheet: ${targetSheetName}`);
            console.log(`[IMPORT] Field column: A`);
            console.log(`[IMPORT] Value column: B`);
            console.log(`[IMPORT] Detected vertical fields: ${fieldHeaders.length}`);
            console.log(`[IMPORT] Matched fields: ${matched}`);
            console.log(`[IMPORT] Unmapped fields: ${unmapped}`);

            resolve({
              headers: fieldHeaders,
              sheetName: targetSheetName,
              sheetConfidence,
              fileSize: file.size,
              detectedHeaderRow: 1,
              headerConfidence: orientationInfo.confidence,
              sheetScores,
              rowPreviews: vertRowPreviews,
              orientationInfo,
            });
            return;
          }

          // ── HORIZONTAL PATH ─────────────────────────────────────────────────
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
            orientationInfo,
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
