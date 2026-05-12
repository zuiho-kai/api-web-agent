import { useStore } from '@/store';

export function UsageBar() {
  const messages = useStore((s) => s.messages);
  const isStreaming = useStore((s) => s.isStreaming);

  // Most recent assistant message holds the usage from the last completed turn.
  let usage: { inputTokens?: number; outputTokens?: number; cachedTokens?: number } | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant' && messages[i].usage) {
      usage = messages[i].usage;
      break;
    }
  }

  return (
    <div className="px-3 py-1 border-t border-zinc-100 bg-zinc-50 text-[11px] text-zinc-600 flex items-center justify-end gap-4 font-mono">
      {isStreaming && <span className="text-blue-500 animate-pulse">● 流式中</span>}
      {usage ? (
        <>
          <span title="本轮 input tokens（含已被缓存的部分）">
            📥 输入 {fmt(usage.inputTokens)}
          </span>
          {(usage.cachedTokens ?? 0) > 0 && (
            <span title="命中 prompt cache 的 token 数（按 10% 计费）" className="text-green-700">
              ⚡ 缓存 {fmt(usage.cachedTokens)}
            </span>
          )}
          <span title="本轮 output tokens（含 thinking）">
            📤 输出 {fmt(usage.outputTokens)}
          </span>
        </>
      ) : (
        <span className="text-zinc-400">尚无统计</span>
      )}
    </div>
  );
}

function fmt(n?: number): string {
  if (n === undefined || n === null) return '-';
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}k`;
}
