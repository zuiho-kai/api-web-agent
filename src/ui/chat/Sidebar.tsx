import { useStore } from '@/store';

export function Sidebar() {
  const conversations = useStore((s) => s.conversations);
  const activeId = useStore((s) => s.activeId);
  const newConversation = useStore((s) => s.newConversation);
  const selectConversation = useStore((s) => s.selectConversation);
  const deleteConversation = useStore((s) => s.deleteConversation);
  const openSettings = useStore((s) => s.openSettings);

  return (
    <aside className="w-60 shrink-0 bg-zinc-50 border-r border-zinc-200 flex flex-col">
      <div className="p-3 border-b border-zinc-200">
        <button
          type="button"
          onClick={() => void newConversation()}
          className="w-full px-3 py-2 bg-zinc-900 text-white rounded text-sm hover:bg-zinc-700"
        >
          + 新对话
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-3 text-xs text-zinc-400">还没有对话</div>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              className={`group px-3 py-2 cursor-pointer text-sm flex items-center justify-between ${
                c.id === activeId ? 'bg-zinc-200' : 'hover:bg-zinc-100'
              }`}
              onClick={() => void selectConversation(c.id)}
            >
              <span className="truncate flex-1">{c.title || '新对话'}</span>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 ml-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('删除这个对话？')) void deleteConversation(c.id);
                }}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
      <div className="p-3 border-t border-zinc-200">
        <button
          type="button"
          onClick={openSettings}
          className="w-full px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 rounded text-left"
        >
          ⚙ 设置
        </button>
      </div>
    </aside>
  );
}
