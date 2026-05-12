import * as XLSX from 'xlsx';

export interface XlsxSheet {
  name: string;
  rows: number;
  cols: number;
  csv: string;
  truncated?: boolean;
}

export interface XlsxParseResult {
  /** Single text representation suitable for inline injection into a user message. */
  text: string;
  /** Per-sheet breakdown (full data, no truncation here — see `text` for trimmed). */
  sheets: XlsxSheet[];
}

const MAX_ROWS_PER_SHEET = 400;
const ROWS_KEEP_HEAD = 200;
const ROWS_KEEP_TAIL = 200;

export async function parseXlsx(file: File | Blob): Promise<XlsxParseResult> {
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: 'array' });

  const sheets: XlsxSheet[] = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: '' });
    const rows = aoa.length;
    const cols = aoa.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
    const csv = XLSX.utils.sheet_to_csv(ws);
    return { name, rows, cols, csv };
  });

  // Top metadata block — at-a-glance summary for the model
  const metaLine = sheets
    .map((s) => `${s.name} (${s.rows} rows × ${s.cols} cols)`)
    .join(', ');
  const header = `This XLSX contains ${sheets.length} sheet${sheets.length === 1 ? '' : 's'}: ${metaLine}.`;

  // Per-sheet text — each sheet wrapped, large sheets truncated head + tail
  const blocks = sheets.map((s) => {
    let body = s.csv;
    let trunc = false;
    if (s.rows > MAX_ROWS_PER_SHEET) {
      const lines = s.csv.split('\n');
      const head = lines.slice(0, ROWS_KEEP_HEAD + 1); // +1 for header row
      const tail = lines.slice(lines.length - ROWS_KEEP_TAIL);
      const skipped = lines.length - head.length - tail.length;
      body = [...head, `... [${skipped} rows truncated; ${s.rows} total] ...`, ...tail].join('\n');
      s.truncated = true;
      trunc = true;
    }
    return `<sheet name="${escapeAttr(s.name)}" rows="${s.rows}" cols="${s.cols}"${trunc ? ' truncated="true"' : ''}>\n${body}\n</sheet>`;
  });

  const text = `${header}\n\n${blocks.join('\n\n')}`;
  return { text, sheets };
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
