import { useEffect } from 'react';
import { useStore } from './store';
import { Header } from './ui/chat/Header';
import { MessageList } from './ui/chat/MessageList';
import { Composer } from './ui/chat/Composer';
import { Sidebar } from './ui/chat/Sidebar';
import { SettingsPanel } from './ui/settings/SettingsPanel';

export default function App() {
  const init = useStore((s) => s.init);
  const settings = useStore((s) => s.settings);
  const openSettings = useStore((s) => s.openSettings);

  useEffect(() => {
    void init();
    // Open settings auto on first run if no provider
    if (settings.providers.length === 0) {
      setTimeout(() => openSettings(), 150);
    }
  }, [init, settings.providers.length, openSettings]);

  return (
    <div className="h-screen flex bg-white text-zinc-900">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Header />
        <div className="flex-1 min-h-0">
          <MessageList />
        </div>
        <Composer />
      </main>
      <SettingsPanel />
    </div>
  );
}
