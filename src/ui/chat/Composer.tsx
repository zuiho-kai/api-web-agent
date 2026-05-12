import { useRef, useState } from 'react';
import { useStore } from '@/store';

const ACCEPT =
  '.pdf,.docx,.xlsx,.xls,.txt,.md,.csv,.json,image/png,image/jpeg,image/webp,image/gif';

function mimeIcon(file: File): string {
  const t = file.type;
  if (t.startsWith('image/')) return '🖼';
  const n = file.name.toLowerCase();
  if (n.endsWith('.pdf')) return '📄';
  if (n.endsWith('.docx') || n.endsWith('.doc')) return '📝';
  if (n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.csv')) return '📊';
  if (n.endsWith('.md')) return '📔';
  if (n.endsWith('.json')) return '⚙';
  return '📎';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function Composer() {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isStreaming = useStore((s) => s.isStreaming);
  const send = useStore((s) => s.sendMessage);
  const stop = useStore((s) => s.stop);

  function submit() {
    const t = text.trim();
    if ((!t && files.length === 0) || isStreaming) return;
    void send(t, files);
    setText('');
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pasted: File[] = [];
    for (const it of items) {
      if (it.kind === 'file') {
        const f = it.getAsFile();
        if (f) pasted.push(f);
      }
    }
    if (pasted.length > 0) {
      e.preventDefault();
      setFiles((prev) => [...prev, ...pasted]);
    }
  }

  return (
    <div className="border-t border-zinc-200 bg-white p-3">
      <div className="max-w-3xl mx-auto">
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 bg-zinc-100 rounded flex items-center gap-1"
                title={`${f.name} (${formatSize(f.size)})`}
              >
                <span>{mimeIcon(f)}</span>
                <span className="max-w-[200px] truncate">{f.name}</span>
                <span className="text-zinc-400 text-[10px]">{formatSize(f.size)}</span>
                <button
                  type="button"
                  className="text-zinc-400 hover:text-zinc-700 ml-1"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 w-10 h-10 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-700 rounded text-xl"
            title="上传文档或图片（PDF / DOCX / XLSX / 图片）"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files ? [...e.target.files] : [];
              setFiles((prev) => [...prev, ...selected]);
            }}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder="输入消息 · 可粘贴图片或文件 · 点 📎 上传 · Enter 发送 · Shift+Enter 换行"
            rows={2}
            className="flex-1 resize-none border border-zinc-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={stop}
              className="px-4 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600"
            >
              停止
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim() && files.length === 0}
              className="px-4 py-2 bg-zinc-900 text-white rounded text-sm hover:bg-zinc-700 disabled:opacity-40"
            >
              发送
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
