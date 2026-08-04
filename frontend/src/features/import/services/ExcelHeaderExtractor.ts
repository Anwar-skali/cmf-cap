/**
 * ExcelHeaderExtractor (Frontend)
 *
 * Client-side extraction of Excel column headers using the xlsx library.
 * Intelligently scans all worksheets to locate the main data worksheet (ignoring chart/summary tabs),
 * then finds the true header row with the maximum number of text columns.
 * Only headers are extracted — no row data is touched or retained.
 */
import * as XLSX from 'xlsx';

export interface ClientExtractedHeaders {
  headers: string[];
  sheetName: string;
  fileSize: number;
}

export class ExcelHeaderExtractor {
  /**
   * Reads an uploaded File and extracts column headers from the main data worksheet.
   */
  static async extractFromFile(file: File): Promise<ClientExtractedHeaders> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) throw new Error('Failed to read file content.');

          // Read top 20 rows of all sheets to locate main data sheet
          const workbook = XLSX.read(data, { type: 'array', sheetRows: 20 });
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('No worksheets found in the uploaded Excel file.');
          }

          let bestSheetName = workbook.SheetNames[0];
          let bestHeaderRow: any[] = [];
          let maxColumnCount = 0;

          // Iterate all sheets to find the worksheet with the most data columns
          for (const sName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sName];
            if (!sheet) continue;

            const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
            if (!rows || rows.length === 0) continue;

            for (let r = 0; r < Math.min(rows.length, 20); r++) {
              const row = rows[r] || [];
              const count = row.filter((cell: any) => cell != null && String(cell).trim() !== '').length;
              if (count > maxColumnCount) {
                maxColumnCount = count;
                bestSheetName = sName;
                bestHeaderRow = row;
              }
            }
          }

          // Extract headers from bestHeaderRow
          const headers: string[] = [];
          for (const cell of bestHeaderRow) {
            const val = cell != null ? String(cell).trim() : '';
            if (val !== '' || headers.length > 0) {
              headers.push(val);
            }
          }

          // Trim empty trailing items
          while (headers.length > 0 && headers[headers.length - 1] === '') {
            headers.pop();
          }

          resolve({ headers, sheetName: bestSheetName, fileSize: file.size });
        } catch (err: any) {
          reject(new Error(`Header extraction failed: ${err?.message ?? 'Unknown error'}`));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read the Excel file.'));
      reader.readAsArrayBuffer(file);
    });
  }
}
