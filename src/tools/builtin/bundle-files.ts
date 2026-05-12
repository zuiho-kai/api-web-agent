import type { ToolDefinition } from '../registry';

export const bundleFiles: ToolDefinition = {
  name: 'bundle_files',
  description:
    'Package one or more text files into a .zip archive and trigger a browser download for the user. ' +
    'Use this when the user asks for code spanning multiple files (a small project, a feature scaffold, etc.) ' +
    'or whenever you would otherwise produce 3+ code blocks. Prefer this over emitting many separate code blocks.',
  input_schema: {
    type: 'object',
    properties: {
      archive_name: {
        type: 'string',
        description: 'Filename of the resulting zip without the .zip suffix. Defaults to "bundle".',
      },
      files: {
        type: 'array',
        description: 'List of files to include. Path may include nested directories (e.g. "src/foo.ts").',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Relative path inside the zip' },
            content: { type: 'string', description: 'UTF-8 text content' },
          },
          required: ['path', 'content'],
        },
      },
    },
    required: ['files'],
  },
  async execute(input) {
    const files = input.files as Array<{ path: string; content: string }>;
    if (!Array.isArray(files) || files.length === 0) {
      return [{ type: 'error', message: 'files must be a non-empty array' }];
    }
    const rawName = String(input.archive_name ?? 'bundle').trim() || 'bundle';
    const archiveName = rawName.endsWith('.zip') ? rawName : `${rawName}.zip`;

    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      for (const f of files) {
        const path = String(f.path || '').replace(/^[\\/]+/, '');
        const content = String(f.content ?? '');
        if (!path) continue;
        zip.file(path, content);
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

      // Trigger browser download (only in DOM environments — Node tests skip).
      const hasDOM =
        typeof document !== 'undefined' && typeof URL?.createObjectURL === 'function';
      if (hasDOM) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = archiveName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }

      const list = files.map((f) => `- ${f.path}`).join('\n');
      return [
        {
          type: 'text',
          text: `✓ Created ${archiveName} with ${files.length} file(s) and triggered download:\n${list}`,
        },
      ];
    } catch (e) {
      return [{ type: 'error', message: `Bundle failed: ${(e as Error).message}` }];
    }
  },
};
