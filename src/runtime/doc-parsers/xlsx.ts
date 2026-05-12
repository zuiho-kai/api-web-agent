import * as XLSX from 'xlsx';

export interface XlsxParseResult {
  text: string;
  sheets: Array<{ name: string; csv: string }>;
}

export async function parseXlsx(file: File | Blob): Promise<XlsxParseResult> {
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: 'array' });
  const sheets = wb.SheetNames.map((name) => ({
    name,
    csv: XLSX.utils.sheet_to_csv(wb.Sheets[name]),
  }));
  const text = sheets.map((s) => `# Sheet: ${s.name}\n${s.csv}`).join('\n\n');
  return { text, sheets };
}
