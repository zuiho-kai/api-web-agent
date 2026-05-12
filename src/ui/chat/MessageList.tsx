import { useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { MessageItem } from './MessageItem';

export function MessageList() {
  const messages = useStore((s) => s.messages);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-400 text-sm">
        发起对话开始
      </div>
    );
  }

  return (
    <div ref={ref} className="h-full overflow-y-auto">
      {messages.map((m) => (
        <MessageItem key={m.rowId} message={m} />
      ))}
    </div>
  );
}
