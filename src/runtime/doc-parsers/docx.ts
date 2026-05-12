import mammoth from 'mammoth';
import TurndownService from 'turndown';

export interface DocxParseResult {
  /** Markdown representation (preserves headings, lists, tables, bold/italic). */
  text: string;
  /** Mammoth conversion warnings (e.g. unrecognized styles). */
  warnings: string[];
}

let turndownInstance: TurndownService | null = null;
function getTurndown(): TurndownService {
  if (turndownInstance) return turndownInstance;
  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
  });
  // GFM-style tables: turndown's default `table` rule produces ASCII tables.
  // We override with a Markdown-table converter.
  td.addRule('table', {
    filter: 'table',
    replacement(_content, node) {
      const table = node as HTMLTableElement;
      const rows = Array.from(table.rows);
      if (rows.length === 0) return '';
      const toCells = (row: HTMLTableRowElement) =>
        Array.from(row.cells).map((c) => (c.textContent || '').trim().replace(/\|/g, '\\|'));
      const header = toCells(rows[0]);
      const sep = header.map(() => '---');
      const body = rows.slice(1).map(toCells);
      const lines = [
        `| ${header.join(' | ')} |`,
        `| ${sep.join(' | ')} |`,
        ...body.map((cells) => `| ${cells.join(' | ')} |`),
      ];
      return `\n\n${lines.join('\n')}\n\n`;
    },
  });
  // Strip <img> (we don't carry inline images through this path; vision goes
  // via image_url blocks separately).
  td.addRule('image', {
    filter: 'img',
    replacement(_c, node) {
      const alt = (node as HTMLImageElement).alt || 'image';
      return `[${alt}]`;
    },
  });
  turndownInstance = td;
  return td;
}

export async function parseDocx(file: File | Blob): Promise<DocxParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  // mammoth's Node implementation only accepts `path` / `buffer` / `file`
  // options — NOT `arrayBuffer`. Its browser implementation accepts
  // `arrayBuffer`. Pick the right field by checking for Node's Buffer global.
  const NodeBuffer = (globalThis as { Buffer?: { from(ab: ArrayBuffer): unknown } }).Buffer;
  const opts = NodeBuffer
    ? { buffer: NodeBuffer.from(arrayBuffer) }
    : { arrayBuffer };
  const result = await mammoth.convertToHtml(opts as unknown as { arrayBuffer: ArrayBuffer });
  const md = getTurndown().turndown(result.value).trim();
  return {
    text: md,
    warnings: result.messages.map((m) => m.message),
  };
}
