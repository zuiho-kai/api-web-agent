export interface ParsedDocument {
  name: string;
  mime: string;
  text: string;
  meta?: Record<string, unknown>;
}

// Parsers are dynamic-imported on first use so heavy deps (pdfjs,
// mammoth+turndown, xlsx) stay out of the initial bundle.
export async function parseDocument(file: File): Promise<ParsedDocument> {
  const name = file.name;
  const lower = name.toLowerCase();
  const mime = file.type;

  if (lower.endsWith('.pdf') || mime === 'application/pdf') {
    const { parsePDF } = await import('./pdf');
    const r = await parsePDF(file);
    return { name, mime: 'application/pdf', text: r.text, meta: { pages: r.pages.length } };
  }
  if (lower.endsWith('.docx')) {
    const { parseDocx } = await import('./docx');
    const r = await parseDocx(file);
    return {
      name,
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      text: r.text,
    };
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const { parseXlsx } = await import('./xlsx');
    const r = await parseXlsx(file);
    return {
      name,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      text: r.text,
      meta: { sheets: r.sheets.length },
    };
  }
  // Fallback: text/markdown
  const text = await file.text();
  return { name, mime: mime || 'text/plain', text };
}
