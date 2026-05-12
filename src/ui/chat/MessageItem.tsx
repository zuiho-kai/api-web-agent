import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { UIMessage } from '@/store';
import { ToolCallCard } from './ToolCallCard';

interface Props {
  message: UIMessage;
}

export function MessageItem({ message }: Props) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const [thinkingOpen, setThinkingOpen] = useState(false);

  const text = extractText(message);
  const toolBlocks = extractToolUseBlocks(message);
  const imageBlocks = extractImageBlocks(message);

  return (
    <div className={`group ${isUser ? 'bg-zinc-50' : 'bg-white'} border-b border-zinc-100`}>
      <div className="max-w-3xl mx-auto px-4 py-4 flex gap-3">
        <div
          className={`shrink-0 w-7 h-7 rounded flex items-center justify-center text-xs font-semibold ${
            isUser ? 'bg-zinc-900 text-white' : 'bg-orange-500 text-white'
          }`}
        >
          {isUser ? 'U' : 'AI'}
        </div>
        <div className="flex-1 min-w-0">
          {message.thinking && message.thinking.length > 0 && (
            <div className="my-2 rounded border border-purple-200 bg-purple-50 text-xs">
              <button
                type="button"
                onClick={() => setThinkingOpen((v) => !v)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-purple-100"
              >
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-purple-700">🧠 思考过程</span>
                  <span className="text-purple-500 text-[10px]">
                    {message.thinking.length} 字{message.streaming ? ' · 推理中…' : ''}
                  </span>
                </span>
                <span className="text-purple-400">{thinkingOpen ? '−' : '+'}</span>
              </button>
              {thinkingOpen && (
                <div className="px-3 pb-2 border-t border-purple-200">
                  <pre className="whitespace-pre-wrap break-words text-purple-900 text-[11px] max-h-72 overflow-auto pt-2">
                    {message.thinking}
                  </pre>
                </div>
              )}
            </div>
          )}
          {message.toolExecs &&
            Object.entries(message.toolExecs).map(([id, exec]) => (
              <ToolCallCard
                key={id}
                name={exec.name}
                input={exec.input}
                result={exec.result}
                status={exec.status}
              />
            ))}
          {/* Fallback: render tool_use blocks that didn't go through toolExecs */}
          {toolBlocks.length > 0 &&
            !message.toolExecs &&
            toolBlocks.map((tb) => (
              <ToolCallCard
                key={tb.id}
                name={tb.name}
                input={tb.input}
                status="done"
              />
            ))}
          {imageBlocks.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {imageBlocks.map((src, i) => (
                <a
                  key={i}
                  href={src}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-block"
                  title="点击查看原图"
                >
                  <img
                    src={src}
                    alt={`image-${i}`}
                    className="max-h-40 max-w-xs rounded border border-zinc-200"
                  />
                </a>
              ))}
            </div>
          )}
          {text && (
            <div className="prose prose-zinc prose-sm max-w-none">
              {isAssistant ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                >
                  {text}
                </ReactMarkdown>
              ) : (
                <div className="whitespace-pre-wrap break-words">{text}</div>
              )}
            </div>
          )}
          {message.streaming && !text && Object.keys(message.toolExecs || {}).length === 0 && (
            <div className="text-zinc-400 text-sm">…</div>
          )}
        </div>
      </div>
    </div>
  );
}

function extractText(m: UIMessage): string {
  if (typeof m.content === 'string') return m.content;
  return m.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

function extractImageBlocks(m: UIMessage): string[] {
  if (typeof m.content === 'string') return [];
  return m.content
    .filter((b): b is { type: 'image_url'; image_url: { url: string } } => b.type === 'image_url')
    .map((b) => b.image_url.url);
}

function extractToolUseBlocks(m: UIMessage) {
  if (typeof m.content === 'string') return [] as Array<{ id: string; name: string; input: Record<string, unknown> }>;
  return m.content
    .filter(
      (b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        b.type === 'tool_use',
    )
    .map((b) => ({ id: b.id, name: b.name, input: b.input }));
}
