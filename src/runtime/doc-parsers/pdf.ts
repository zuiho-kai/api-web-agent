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

/** Read a file's raw bytes as base64 (no `data:...;base64,` prefix). */
export async function fileToBase64(file: File | Blob): Promise<string> {
  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)),
    );
  }
  return btoa(binary);
}

/**
 * Render each PDF page to a PNG data URL using pdfjs + a canvas. Caps at
 * `maxPages` to bound memory and token cost. Used when the active model is
 * vision-capable but doesn't accept raw PDF bytes (OpenAI-style providers).
 */
export async function renderPdfPagesAsImages(
  file: File | Blob,
  maxPages = 20,
  scale = 1.5,
): Promise<string[]> {
  const ab = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: ab }).promise;
  const pageCount = Math.min(pdf.numPages, maxPages);
  const urls: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    await page.render({ canvasContext: ctx, viewport }).promise;
    urls.push(canvas.toDataURL('image/png'));
  }
  return urls;
}
