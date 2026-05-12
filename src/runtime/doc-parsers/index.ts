import { parseDocx } from './docx';
import { parsePDF } from './pdf';
import { parseXlsx } from './xlsx';

export interface ParsedDocument {
  name: string;
  mime: string;
  text: string;
  meta?: Record<string, unknown>;
}

export async function parseDocument(file: File): Promise<ParsedDocument> {
  const name = file.name;
  const lower = name.toLowerCase();
  const mime = file.type;

  if (lower.endsWith('.pdf') || mime === 'application/pdf') {
    const r = await parsePDF(file);
    return { name, mime: 'application/pdf', text: r.text, meta: { pages: r.pages.length } };
  }
  if (lower.endsWith('.docx')) {
    const r = await parseDocx(file);
    return { name, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', text: r.text };
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const r = await parseXlsx(file);
    return { name, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', text: r.text, meta: { sheets: r.sheets.length } };
  }
  // Fallback: text/markdown
  const text = await file.text();
  return { name, mime: mime || 'text/plain', text };
}
