import { useState } from 'react';
import { useStore } from '@/store';
import type { ProviderConfig } from '@/providers/base';
import { PRESET_MODELS } from '@/providers/preset-models';
import { LOCKED_PROVIDER } from '@/config';
import { ProviderForm } from './ProviderForm';

export function SettingsPanel() {
  const open = useStore((s) => s.settingsOpen);
  const close = useStore((s) => s.closeSettings);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const addOrUpdate = useStore((s) => s.addOrUpdateProvider);
  const removeP = useStore((s) => s.removeProviderById);

  const [editing, setEditing] = useState<ProviderConfig | null>(null);
  const [creating, setCreating] = useState(false);

  const activeProvider = settings.providers.find((p) => p.id === settings.activeProviderId) ?? null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={close}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold">设置</h2>
          <button
            type="button"
            onClick={close}
            className="text-zinc-400 hover:text-zinc-700 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!LOCKED_PROVIDER.enabled && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Providers</h3>
              {!LOCKED_PROVIDER.enabled && (
                <button
                  type="button"
                  onClick={() => {
                    setCreating(true);
                    setEditing(null);
                  }}
                  className="text-xs px-2 py-1 bg-zinc-900 text-white rounded hover:bg-zinc-700"
                >
                  + 新增
                </button>
              )}
            </div>
            {LOCKED_PROVIDER.enabled ? (
              <p className="text-xs text-zinc-500 mb-2">
                此部署锁定到 <span className="font-mono">{LOCKED_PROVIDER.name}</span>。
                只能填写自己的 API key，不能更改 Base URL 或添加其他 provider。
                Key 存在 LocalStorage（明文，仅你的浏览器）。
              </p>
            ) : (
              <p className="text-xs text-zinc-500 mb-2">
                API key 存在 LocalStorage（明文）。清除站点数据即丢失。
              </p>
            )}

            {creating && !LOCKED_PROVIDER.enabled && (
              <div className="mb-3">
                <ProviderForm
                  onSave={(p) => {
                    addOrUpdate(p);
                    if (!settings.activeProviderId) {
                      updateSettings({ activeProviderId: p.id });
                    }
                    setCreating(false);
                  }}
                  onCancel={() => setCreating(false)}
                />
              </div>
            )}

            <div className="space-y-2">
              {settings.providers.length === 0 && !creating && (
                <div className="text-xs text-zinc-400 italic">还没有 provider</div>
              )}
              {settings.providers.map((p) =>
                editing?.id === p.id ? (
                  <ProviderForm
                    key={p.id}
                    initial={editing}
                    onSave={(updated) => {
                      addOrUpdate(updated);
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 border border-zinc-200 rounded text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-zinc-500 font-mono truncate">{p.baseURL}</div>
                      <div className="text-xs text-zinc-400">
                        {p.protocol ? `protocol: ${p.protocol}` : 'protocol: 自动'}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditing(p)}
                        className="text-xs px-2 py-1 hover:bg-zinc-100 rounded"
                      >
                        编辑
                      </button>
                      {!LOCKED_PROVIDER.enabled && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`删除 ${p.name}？`)) removeP(p.id);
                          }}
                          className="text-xs px-2 py-1 hover:bg-red-50 text-red-600 rounded"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </section>
          )}

          <section>
            <h3 className="text-sm font-semibold mb-2">
              {LOCKED_PROVIDER.enabled ? '配置' : '活跃配置'}
            </h3>
            <div className="space-y-3">
              {LOCKED_PROVIDER.enabled ? (
                <div className="text-xs text-zinc-600 px-3 py-2 bg-zinc-50 rounded border border-zinc-200">
                  <div>
                    <span className="font-semibold">🔒 {LOCKED_PROVIDER.name}</span>
                  </div>
                  <div className="font-mono text-zinc-400 truncate mt-0.5">
                    {LOCKED_PROVIDER.baseURL}
                  </div>
                </div>
              ) : (
                <label className="block text-xs">
                  <div className="text-zinc-600 mb-1">Provider</div>
                  <select
                    value={settings.activeProviderId ?? ''}
                    onChange={(e) => updateSettings({ activeProviderId: e.target.value || null })}
                    className="w-full border border-zinc-300 rounded px-2 py-1 text-sm"
                  >
                    <option value="">— 选择 —</option>
                    {settings.providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block text-xs">
                <div className="text-zinc-600 mb-1">API Key</div>
                <input
                  type="password"
                  value={activeProvider?.apiKey ?? ''}
                  onChange={(e) => {
                    if (!activeProvider) return;
                    addOrUpdate({ ...activeProvider, apiKey: e.target.value });
                  }}
                  disabled={!activeProvider}
                  placeholder={activeProvider ? 'sk-…' : '请先选 Provider'}
                  className="w-full border border-zinc-300 rounded px-2 py-1 text-sm font-mono disabled:bg-zinc-50"
                />
                <p className="text-[10px] text-zinc-400 mt-1">
                  存在 LocalStorage（明文，仅你的浏览器）
                </p>
              </label>

              <div className="block text-xs">
                <div className="text-zinc-600 mb-2">Model</div>
                <div className="space-y-2">
                  {(['claude', 'gpt', 'grok'] as const).map((fam) => (
                    <div key={fam}>
                      <div className="text-[10px] text-zinc-400 uppercase mb-1">{fam}</div>
                      <div className="flex flex-wrap gap-1">
                        {PRESET_MODELS.filter((m) => m.family === fam).map((m) => {
                          const active = settings.activeModel === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => updateSettings({ activeModel: m.id })}
                              className={`px-2 py-1 rounded text-xs font-mono border ${
                                active
                                  ? 'bg-zinc-900 text-white border-zinc-900'
                                  : 'bg-white border-zinc-300 hover:bg-zinc-100'
                              }`}
                            >
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      setTimeout(() => {
                        const el = document.getElementById(
                          'header-model-input',
                        ) as HTMLInputElement | null;
                        el?.focus();
                        el?.select();
                      }, 50);
                    }}
                    className="text-xs px-2 py-1 border border-zinc-300 border-dashed rounded hover:bg-zinc-50"
                  >
                    + 新建模型（去顶部输入）
                  </button>
                  {settings.activeModel &&
                    !PRESET_MODELS.some((m) => m.id === settings.activeModel) && (
                      <span className="text-xs text-zinc-500 font-mono">
                        当前自定义: {settings.activeModel}
                      </span>
                    )}
                </div>
                <p className="text-[10px] text-zinc-400 mt-2">
                  以 <code>claude-</code> 开头自动走 Anthropic 协议，其余走 OpenAI 协议。
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
