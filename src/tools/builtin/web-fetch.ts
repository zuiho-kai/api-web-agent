import type { ToolDefinition } from '../registry';

export const webFetch: ToolDefinition = {
  name: 'web_fetch',
  description:
    'Fetch a specific URL and return its content as cleaned Markdown. Use this to read web pages, articles, documentation, or any HTTP resource. The content is server-side rendered and converted, so SPAs work.',
  input_schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The full HTTP/HTTPS URL to fetch' },
    },
    required: ['url'],
  },
  async execute(input, ctx) {
    const url = String(input.url || '').trim();
    if (!url) return [{ type: 'error', message: 'url is required' }];
    if (!/^https?:\/\//i.test(url)) return [{ type: 'error', message: 'url must start with http:// or https://' }];

    const jinaUrl = `https://r.jina.ai/${url}`;
    try {
      const r = await fetch(jinaUrl, { signal: ctx.signal });
      if (!r.ok) {
        return [{ type: 'error', message: `Fetch failed: HTTP ${r.status}` }];
      }
      const text = await r.text();
      return [{ type: 'text', text: text.slice(0, 12000) }];
    } catch (e) {
      return [{ type: 'error', message: `Fetch error: ${(e as Error).message}` }];
    }
  },
};
