import { useStore } from '@/store';
import { detectProtocol } from '@/providers/router';
import { PRESET_MODELS } from '@/providers/preset-models';
import { THINKING_LEVELS, type ThinkingLevel } from '@/providers/base';
import { LOCKED_PROVIDER } from '@/config';

export function Header() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const activeProvider = settings.providers.find((p) => p.id === settings.activeProviderId);
  const protocol = activeProvider && settings.activeModel
    ? detectProtocol(settings.activeModel, activeProvider.protocol)
    : null;

  return (
    <header className="border-b border-zinc-200 bg-white px-4 py-2 flex items-center justify-between">
      <div className="text-sm font-semibold">api-web-agent</div>
      <div className="flex items-center gap-2 text-xs">
        {LOCKED_PROVIDER.enabled ? (
          <span
            className="px-2 py-1 rounded bg-zinc-100 text-zinc-600"
            title={LOCKED_PROVIDER.baseURL}
          >
            🔒 {LOCKED_PROVIDER.name}
          </span>
        ) : (
          <select
            value={settings.activeProviderId ?? ''}
            onChange={(e) => updateSettings({ activeProviderId: e.target.value || null })}
            className="border border-zinc-300 rounded px-2 py-1 text-xs"
          >
            <option value="">— Provider —</option>
            {settings.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <input
          id="header-model-input"
          list="model-presets-header"
          value={settings.activeModel ?? ''}
          onChange={(e) => updateSettings({ activeModel: e.target.value || null })}
          placeholder="输入 model"
          className="border border-zinc-300 rounded px-2 py-1 text-xs w-56 font-mono"
        />
        <datalist id="model-presets-header">
          {PRESET_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </datalist>
        <select
          value={settings.thinkingLevel}
          onChange={(e) => updateSettings({ thinkingLevel: e.target.value as ThinkingLevel })}
          className="border border-zinc-300 rounded px-2 py-1 text-xs"
          title="思考等级"
        >
          {THINKING_LEVELS.map((lvl) => (
            <option key={lvl.id} value={lvl.id} title={lvl.note}>
              🧠 {lvl.label}
            </option>
          ))}
        </select>
        {protocol && (
          <span className="text-zinc-400">
            → {protocol}
          </span>
        )}
      </div>
    </header>
  );
}
