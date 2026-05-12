import { useState } from 'react';
import type { ProviderConfig, ProviderProtocol } from '@/providers/base';
import { uuid } from '@/storage/db';

interface Props {
  initial?: ProviderConfig;
  onSave(p: ProviderConfig): void;
  onCancel(): void;
}

export function ProviderForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [baseURL, setBaseURL] = useState(initial?.baseURL ?? '');
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? '');
  const [protocol, setProtocol] = useState<ProviderProtocol | ''>(initial?.protocol ?? '');

  function save() {
    if (!name.trim() || !baseURL.trim() || !apiKey.trim()) {
      alert('请填写 name / baseURL / apiKey');
      return;
    }
    onSave({
      id: initial?.id ?? uuid(),
      name: name.trim(),
      baseURL: baseURL.trim().replace(/\/$/, ''),
      apiKey: apiKey.trim(),
      protocol: protocol || undefined,
    });
  }

  return (
    <div className="border border-zinc-200 rounded p-3 space-y-2">
      <Field label="名称">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：My Proxy"
          className="w-full border border-zinc-300 rounded px-2 py-1 text-sm"
        />
      </Field>
      <Field label="Base URL">
        <input
          value={baseURL}
          onChange={(e) => setBaseURL(e.target.value)}
          placeholder="https://api.openai.com 或 https://api.anthropic.com"
          className="w-full border border-zinc-300 rounded px-2 py-1 text-sm font-mono"
        />
      </Field>
      <Field label="API Key">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="w-full border border-zinc-300 rounded px-2 py-1 text-sm font-mono"
        />
      </Field>
      <Field label="协议（可选）">
        <select
          value={protocol}
          onChange={(e) => setProtocol(e.target.value as ProviderProtocol | '')}
          className="w-full border border-zinc-300 rounded px-2 py-1 text-sm"
        >
          <option value="">自动（按 model 名）</option>
          <option value="openai">OpenAI /v1/chat/completions</option>
          <option value="anthropic">Anthropic /v1/messages</option>
        </select>
      </Field>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={save}
          className="px-3 py-1 bg-zinc-900 text-white rounded text-sm hover:bg-zinc-700"
        >
          保存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 text-zinc-700 hover:bg-zinc-100 rounded text-sm"
        >
          取消
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-zinc-600 mb-1">{label}</div>
      {children}
    </label>
  );
}
