import { useState } from 'react';

interface Props {
  name: string;
  input?: Record<string, unknown>;
  result?: string;
  status: 'running' | 'done' | 'error';
}

export function ToolCallCard({ name, input, result, status }: Props) {
  const [open, setOpen] = useState(false);
  const summary =
    status === 'running'
      ? '运行中…'
      : status === 'error'
        ? '失败'
        : '完成';
  const color =
    status === 'running'
      ? 'border-blue-300 bg-blue-50'
      : status === 'error'
        ? 'border-red-300 bg-red-50'
        : 'border-zinc-300 bg-zinc-50';

  return (
    <div className={`my-2 rounded border ${color} text-xs`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-black/5"
      >
        <span className="flex items-center gap-2">
          <span className="font-mono font-semibold">⚙ {name}</span>
          <span className="text-zinc-500">{summary}</span>
          {input && typeof (input as Record<string, unknown>).query === 'string' && (
            <span className="text-zinc-600 truncate max-w-xs">
              "{(input as Record<string, string>).query}"
            </span>
          )}
          {input && typeof (input as Record<string, unknown>).url === 'string' && (
            <span className="text-zinc-600 truncate max-w-xs">
              {(input as Record<string, string>).url}
            </span>
          )}
        </span>
        <span className="text-zinc-400">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="px-3 pb-2 border-t border-zinc-200 space-y-2">
          <div>
            <div className="text-zinc-500 mt-2">Input:</div>
            <pre className="whitespace-pre-wrap break-words text-zinc-700">
              {JSON.stringify(input ?? {}, null, 2)}
            </pre>
          </div>
          {result !== undefined && (
            <div>
              <div className="text-zinc-500">Result:</div>
              <pre className="whitespace-pre-wrap break-words text-zinc-700 max-h-64 overflow-auto">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
