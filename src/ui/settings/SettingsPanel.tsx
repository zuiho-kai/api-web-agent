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

          <section>
            <h3 className="text-sm font-semibold mb-2">活跃配置</h3>
            <div className="space-y-2">
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
              <label className="block text-xs">
                <div className="text-zinc-600 mb-1">Model</div>
                <div className="flex gap-2">
                  <select
                    value={
                      PRESET_MODELS.some((m) => m.id === settings.activeModel)
                        ? settings.activeModel!
                        : '__custom__'
                    }
                    onChange={(e) => {
                      if (e.target.value === '__custom__') return;
                      updateSettings({ activeModel: e.target.value });
                    }}
                    className="border border-zinc-300 rounded px-2 py-1 text-sm font-mono"
                  >
                    <optgroup label="Claude">
                      {PRESET_MODELS.filter((m) => m.family === 'claude').map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="GPT">
                      {PRESET_MODELS.filter((m) => m.family === 'gpt').map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Grok">
                      {PRESET_MODELS.filter((m) => m.family === 'grok').map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </optgroup>
                    <option value="__custom__">— 自定义 —</option>
                  </select>
                  <input
                    value={settings.activeModel ?? ''}
                    onChange={(e) => updateSettings({ activeModel: e.target.value || null })}
                    placeholder="或自定义 model 名"
                    className="flex-1 border border-zinc-300 rounded px-2 py-1 text-sm font-mono"
                  />
                </div>
              </label>
              <p className="text-xs text-zinc-400">
                左侧下拉选预设模型，或在右侧输入自定义 model 名。
                以 <code>claude-</code> 开头自动走 Anthropic 协议，其余走 OpenAI 协议。
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
