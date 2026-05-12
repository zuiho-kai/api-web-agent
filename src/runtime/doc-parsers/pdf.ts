import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export interface PDFParseResult {
  text: string;
  pages: Array<{ page: number; text: string }>;
}

export async function parsePDF(file: File | Blob): Promise<PDFParseResult> {
  const ab = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: ab }).promise;
  const pages: Array<{ page: number; text: string }> = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const text = tc.items
      .map((it) => ('str' in it ? (it as { str: string }).str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push({ page: i, text });
  }
  return {
    text: pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n'),
    pages,
  };
}
