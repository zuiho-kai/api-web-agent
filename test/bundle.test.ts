import { describe, it, expect } from 'vitest';
import { bundleFiles } from '@/tools/builtin/bundle-files';
import { ToolRegistry } from '@/tools/registry';
import { runAgent, type AgentEvent } from '@/agent/loop';
import { OpenAIAdapter } from '@/providers/openai';
import { AnthropicAdapter } from '@/providers/anthropic';
import { chatMode } from '@/modes/chat';
import { PROXY_LEGACY } from './helpers';

const TIMEOUT = 120000;

describe('bundle_files — unit', () => {
  it(
    'packages files (returns success receipt, no DOM needed in Node)',
    async () => {
      const result = await bundleFiles.execute(
        {
          archive_name: 'test-bundle',
          files: [
            { path: 'src/foo.ts', content: 'export const foo = 1;\n' },
            { path: 'README.md', content: '# Hello\n' },
          ],
        },
        { signal: undefined },
      );
      const text = result.find((r) => r.type === 'text');
      console.log(`\n[bundle_files unit] result:\n${text && text.type === 'text' ? text.text : '(none)'}`);
      expect(text).toBeDefined();
      if (text?.type !== 'text') throw new Error('expected text result');
      expect(text.text).toContain('test-bundle.zip');
      expect(text.text).toContain('src/foo.ts');
      expect(text.text).toContain('README.md');
    },
    TIMEOUT,
  );

  it(
    'errors gracefully on empty files',
    async () => {
      const result = await bundleFiles.execute({ files: [] }, { signal: undefined });
      const err = result.find((r) => r.type === 'error');
      expect(err).toBeDefined();
    },
    TIMEOUT,
  );

  it(
    'normalizes leading slashes in path',
    async () => {
      const result = await bundleFiles.execute(
        {
          archive_name: 'norm',
          files: [{ path: '/leading/slash.txt', content: 'x' }],
        },
        { signal: undefined },
      );
      const text = result.find((r) => r.type === 'text');
      if (text?.type !== 'text') throw new Error('expected text');
      // path output displays whatever model passed; tool just strips leading slash internally
      console.log(`\n[bundle_files norm] ${text.text}`);
      expect(text.text).toContain('norm.zip');
    },
    TIMEOUT,
  );
});

describe('Agent loop — model calls bundle_files for multi-file output', () => {
  async function runWithAdapter(adapter: OpenAIAdapter | AnthropicAdapter, model: string) {
    const registry = new ToolRegistry();
    registry.register(bundleFiles);

    const events: AgentEvent[] = [];
    let bundleStart: AgentEvent & { type: 'tool_exec_start' } | null = null;
    let bundleDone: AgentEvent & { type: 'tool_exec_done' } | null = null;

    for await (const ev of runAgent({
      adapter,
      registry,
      request: {
        model,
        messages: [
          {
            role: 'user',
            content:
              'Generate a tiny Vite + React + TypeScript starter as 3 short files: ' +
              '`package.json` (just name + 2 deps + 1 script), ' +
              '`vite.config.ts` (minimal), ' +
              '`src/main.tsx` (renders <h1>Hello</h1>). ' +
              'You MUST package them by calling the bundle_files tool. ' +
              'Set archive_name to "tiny-app". Do not paste the full file content in the chat.',
          },
        ],
        max_tokens: 4000,
      },
      maxIterations: 3,
    })) {
      events.push(ev);
      if (ev.type === 'tool_exec_start' && ev.name === 'bundle_files') {
        bundleStart = ev;
      }
      if (ev.type === 'tool_exec_done' && ev.name === 'bundle_files') {
        bundleDone = ev;
      }
    }

    return { events, bundleStart, bundleDone };
  }

  it(
    'Claude Sonnet 4.6 (OpenAI proto) calls bundle_files with valid file list',
    async () => {
      const adapter = new OpenAIAdapter(PROXY_LEGACY);
      const r = await runWithAdapter(adapter, 'claude-sonnet-4-6');

      console.log(`\n[bundle_files e2e] tool_exec_start: ${r.bundleStart ? '✓' : '✗'}`);
      console.log(`[bundle_files e2e] tool_exec_done:  ${r.bundleDone ? '✓' : '✗'}`);
      if (r.bundleStart) {
        const input = (r.bundleStart as Extract<AgentEvent, { type: 'tool_exec_start' }>).input;
        const files = (input.files as Array<{ path: string }>) || [];
        console.log(`[bundle_files e2e] archive_name: ${input.archive_name}`);
        console.log(`[bundle_files e2e] files (${files.length}):`);
        for (const f of files) console.log(`  - ${f.path}`);
      }
      if (r.bundleDone) {
        const content = (r.bundleDone as Extract<AgentEvent, { type: 'tool_exec_done' }>).content;
        console.log(`[bundle_files e2e] result:\n${content}`);
      }

      expect(r.bundleStart, 'model should have invoked bundle_files').toBeTruthy();
      expect(r.bundleDone, 'tool execution should have completed').toBeTruthy();
      const input = (r.bundleStart as Extract<AgentEvent, { type: 'tool_exec_start' }>).input;
      const files = input.files as Array<{ path: string; content: string }> | undefined;
      expect(Array.isArray(files)).toBe(true);
      expect((files ?? []).length).toBeGreaterThanOrEqual(2);
      const allPaths = (files ?? []).map((f) => f.path).join(',');
      expect(allPaths).toMatch(/package\.json|vite|main\.tsx/);
    },
    TIMEOUT,
  );
});

describe('System-prompt boundary — bundle_files only when warranted', () => {
  async function probe(userPrompt: string): Promise<{
    calledBundle: boolean;
    finalText: string;
    bundleFileCount: number;
  }> {
    const adapter = new OpenAIAdapter(PROXY_LEGACY);
    const registry = new ToolRegistry();
    registry.register(bundleFiles);

    let calledBundle = false;
    let bundleFileCount = 0;
    let finalText = '';

    for await (const ev of runAgent({
      adapter,
      registry,
      request: {
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: userPrompt }],
        system: chatMode.buildSystemPrompt(),
        max_tokens: 3000,
      },
      maxIterations: 3,
    })) {
      if (ev.type === 'tool_exec_start' && ev.name === 'bundle_files') {
        calledBundle = true;
        const files = (ev.input.files as Array<unknown>) ?? [];
        bundleFileCount = files.length;
      }
      if (ev.type === 'text_delta') finalText += ev.text;
    }
    return { calledBundle, finalText, bundleFileCount };
  }

  it(
    'short snippet (one function) → markdown code block, NO bundle_files',
    async () => {
      const r = await probe(
        'Write a short Python function `is_prime(n)` that returns True/False. ' +
          'Just the function, nothing else.',
      );
      console.log(`\n[short snippet] called bundle? ${r.calledBundle} (file count ${r.bundleFileCount})`);
      console.log(`[short snippet] text preview: ${r.finalText.slice(0, 200)}`);
      expect(r.calledBundle).toBe(false);
      expect(r.finalText).toMatch(/```|def is_prime|return/i);
    },
    TIMEOUT,
  );

  it(
    'single doc file (resume.md) → markdown code block, NO bundle_files',
    async () => {
      const r = await probe(
        'Generate a tiny example resume.md (just a name, 1 job, 2 bullet points). ' +
          'I will copy it from the chat.',
      );
      console.log(`\n[single md] called bundle? ${r.calledBundle}`);
      console.log(`[single md] text preview: ${r.finalText.slice(0, 200)}`);
      expect(r.calledBundle).toBe(false);
    },
    TIMEOUT,
  );

  it(
    'multi-file project (3+ files) → MUST call bundle_files',
    async () => {
      const r = await probe(
        'Scaffold a minimal Express server with these 3 files: ' +
          'package.json, server.js (1 GET / route), README.md (one paragraph). ' +
          'Make them runnable.',
      );
      console.log(`\n[multi-file] called bundle? ${r.calledBundle} (file count ${r.bundleFileCount})`);
      expect(r.calledBundle).toBe(true);
      expect(r.bundleFileCount).toBeGreaterThanOrEqual(2);
    },
    TIMEOUT,
  );

  it(
    'user explicitly says "打包" → call bundle_files (even for 1 file)',
    async () => {
      const r = await probe(
        '生成一个 hello.py 文件（print "hello world"），打包成 zip 给我下载。',
      );
      console.log(`\n[explicit zip] called bundle? ${r.calledBundle} (file count ${r.bundleFileCount})`);
      expect(r.calledBundle).toBe(true);
    },
    TIMEOUT,
  );
});
