import { useRef, useState } from 'react';
import { useStore } from '@/store';

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

  return (
    <div className="border-t border-zinc-200 bg-white p-3">
      <div className="max-w-3xl mx-auto">
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span key={i} className="text-xs px-2 py-1 bg-zinc-100 rounded flex items-center gap-1">
                📎 {f.name}
                <button
                  type="button"
                  className="text-zinc-400 hover:text-zinc-700"
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
            className="px-3 py-2 text-zinc-600 hover:bg-zinc-100 rounded text-sm"
            title="上传文档"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.xls,.txt,.md"
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
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
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
