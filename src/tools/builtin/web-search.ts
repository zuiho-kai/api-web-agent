import type { ToolDefinition } from '../registry';

export const webSearch: ToolDefinition = {
  name: 'web_search',
  description:
    "Search the web for current information. Returns top results with titles, URLs, and snippets. Use this when you need fresh data like today's news, current weather, latest releases, prices, or anything beyond your training cutoff.",
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query. Be specific and use the language most likely to yield best results (English for general queries, native language for region-specific queries).',
      },
    },
    required: ['query'],
  },
  async execute(input, ctx) {
    const query = String(input.query || '').trim();
    if (!query) return [{ type: 'error', message: 'query is required' }];

    const url = `https://r.jina.ai/https://html.duckduckgo.com/html?q=${encodeURIComponent(query)}`;
    try {
      const r = await fetch(url, { signal: ctx.signal });
      if (!r.ok) {
        return [{ type: 'error', message: `Search failed: HTTP ${r.status}` }];
      }
      const text = await r.text();
      const cleaned = stripBoilerplate(text);
      return [{ type: 'text', text: cleaned.slice(0, 6000) }];
    } catch (e) {
      return [{ type: 'error', message: `Search error: ${(e as Error).message}` }];
    }
  },
};

function stripBoilerplate(s: string): string {
  return s
    .replace(/^Title:.*?\n/m, '')
    .replace(/^URL Source:.*?\n/m, '')
    .replace(/^Markdown Content:\s*/m, '')
    .replace(/!\[Image \d+\][^\n]*/g, '')
    .replace(/\(https:\/\/external-content\.duckduckgo\.com[^)]*\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
