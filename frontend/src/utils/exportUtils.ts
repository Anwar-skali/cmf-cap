import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

export interface ReportMetric {
  label: string;
  value: string | number;
}

export interface ReportTableSection {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

/**
 * Generates a styled executive PDF report with headers, metrics, and structured tables.
 */
export const exportToPDF = (
  title: string,
  metrics: ReportMetric[],
  sections: Record<string, { headers: string[]; rows: (string | number)[][] }>
) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 15;

  // ── Header Banner ──
  doc.setFillColor(15, 23, 42); // Slate-900 header
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('STELLANTIS | CMF PLATFORM', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text(`${title} — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 20);

  yPos = 38;

  // ── Executive Summary KPI Metrics Box ──
  doc.setFillColor(248, 250, 252); // Slate-50 background
  doc.setDrawColor(226, 232, 240); // Slate-200 border
  doc.roundedRect(14, yPos, pageWidth - 28, 26, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text('EXECUTIVE KPI SUMMARY', 18, yPos + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const colWidth = (pageWidth - 40) / Math.max(1, metrics.length);
  metrics.forEach((m, idx) => {
    const xPos = 18 + idx * colWidth;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // Blue-600
    doc.text(String(m.value), xPos, yPos + 15);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(m.label, xPos, yPos + 21);
  });

  yPos += 34;

  // ── Data Sections & Formatted Tables ──
  Object.entries(sections).forEach(([sectionName, sectionData]) => {
    const { headers, rows } = sectionData;

    // Check page space for section title + header
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 20;
    }

    // Section Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(sectionName, 14, yPos);
    yPos += 5;

    // Table Header Row
    doc.setFillColor(30, 41, 59); // Dark header
    doc.rect(14, yPos, pageWidth - 28, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    const numCols = headers.length;
    const tableColWidth = (pageWidth - 28) / numCols;

    headers.forEach((headerText, i) => {
      doc.text(headerText.toUpperCase(), 16 + i * tableColWidth, yPos + 5);
    });

    yPos += 7;

    // Table Data Rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    if (rows.length === 0) {
      doc.setTextColor(148, 163, 184);
      doc.text('No records recorded for this section.', 16, yPos + 5);
      yPos += 9;
    } else {
      rows.forEach((row, rowIndex) => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
          // Re-print header on new page
          doc.setFillColor(30, 41, 59);
          doc.rect(14, yPos, pageWidth - 28, 7, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          headers.forEach((headerText, i) => {
            doc.text(headerText.toUpperCase(), 16 + i * tableColWidth, yPos + 5);
          });
          yPos += 7;
          doc.setFont('helvetica', 'normal');
        }

        // Alternating row background
        if (rowIndex % 2 === 1) {
          doc.setFillColor(241, 245, 249);
          doc.rect(14, yPos, pageWidth - 28, 6, 'F');
        }

        doc.setTextColor(30, 41, 59);
        row.forEach((cellValue, colIndex) => {
          const cellStr = String(cellValue ?? '-');
          // Truncate long strings for table width
          const truncated = cellStr.length > 28 ? cellStr.substring(0, 25) + '...' : cellStr;
          doc.text(truncated, 16 + colIndex * tableColWidth, yPos + 4.5);
        });

        yPos += 6;
      });
    }

    yPos += 8;
  });

  // Footer Page Numbers
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 25, pageHeight - 8);
    doc.text('Confidential — Stellantis Capacity Management Platform (CMF)', 14, pageHeight - 8);
  }

  doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Exports data into a multi-sheet formatted Excel workbook with auto column sizing.
 */
export const exportToExcel = (
  title: string,
  dataSheets: { sheetName: string; data: Record<string, any>[] }[]
) => {
  const wb = XLSX.utils.book_new();

  dataSheets.forEach(({ sheetName, data }) => {
    const sheetData = data.length > 0 ? data : [{ Info: 'No records available' }];
    const ws = XLSX.utils.json_to_sheet(sheetData);

    // Auto-compute column widths based on maximum content length
    if (data.length > 0) {
      const colWidths = Object.keys(data[0]).map((key) => {
        const maxLen = Math.max(
          key.length,
          ...data.map((row) => String(row[key] ?? '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
      });
      ws['!cols'] = colWidths;
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  });

  XLSX.writeFile(wb, `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * Exports data array to standard CSV file format.
 */
export const exportToCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
  if (!rows.length) return;
  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${filename.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
