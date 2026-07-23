import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

export const exportToPDF = (
  title: string,
  metrics: { label: string; value: string | number }[],
  data: Record<string, any[]>
) => {
  const doc = new jsPDF();
  let yPos = 20;

  // Title
  doc.setFontSize(22);
  doc.setTextColor(30, 58, 138); // Primary color
  doc.text(title, 20, yPos);
  yPos += 15;

  // Metrics
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Key Metrics Summary', 20, yPos);
  yPos += 10;
  
  doc.setFontSize(11);
  metrics.forEach((m) => {
    doc.text(`${m.label}: ${m.value}`, 25, yPos);
    yPos += 8;
  });
  
  yPos += 10;

  // Note on Charts
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('* Interactive visual charts are available in the web dashboard.', 20, yPos);
  yPos += 15;

  // Append simple data tables if needed, or summary sentences
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  Object.keys(data).forEach((key) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(`${key} Data Summary`, 20, yPos);
    yPos += 10;
    
    const items = data[key];
    doc.setFontSize(10);
    doc.text(`Total Records: ${items.length}`, 25, yPos);
    yPos += 15;
    doc.setFontSize(14);
  });

  doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportToExcel = (
  title: string,
  dataSheets: { sheetName: string; data: any[] }[]
) => {
  const wb = XLSX.utils.book_new();

  dataSheets.forEach(({ sheetName, data }) => {
    // If data is empty, add a dummy row so the sheet isn't completely empty
    const sheetData = data.length > 0 ? data : [{ Message: 'No data available' }];
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31)); // Max length for sheet names is 31
  });

  XLSX.writeFile(wb, `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
};
