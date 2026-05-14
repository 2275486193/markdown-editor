import { useState } from "react";
import { useAIStore } from "../../stores/ai";
import { PROVIDER_PRESETS } from "../../types/ai";
import type { ProviderKind, AIProviderConfig } from "../../types/ai";

const PROVIDER_OPTIONS: { value: ProviderKind; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "ollama", label: "Ollama" },
  { value: "custom", label: "自定义" },
];

function ProviderForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: AIProviderConfig;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [provider, setProvider] = useState<ProviderKind>(
    initial?.provider ?? "openai",
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [endpoint, setEndpoint] = useState(
    initial?.endpoint ?? PROVIDER_PRESETS.openai.endpoint,
  );
  const [model, setModel] = useState(
    initial?.model ?? PROVIDER_PRESETS.openai.defaultModel,
  );
  const [temperature, setTemperature] = useState(
    initial?.temperature ?? 0.7,
  );
  const [maxTokens, setMaxTokens] = useState(initial?.maxTokens ?? 4096);

  const addProvider = useAIStore((s) => s.addProvider);
  const updateProvider = useAIStore((s) => s.updateProvider);

  function handleProviderChange(kind: ProviderKind) {
    setProvider(kind);
    setEndpoint(PROVIDER_PRESETS[kind].endpoint);
    setModel(PROVIDER_PRESETS[kind].defaultModel);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (initial) {
      await updateProvider(initial.id, {
        name,
        provider,
        apiKey,
        endpoint,
        model,
        temperature,
        maxTokens,
      });
    } else {
      await addProvider({
        name: name || PROVIDER_PRESETS[provider].name,
        provider,
        apiKey,
        endpoint,
        model,
        temperature,
        maxTokens,
      });
    }
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">
          Provider
        </label>
        <div className="flex gap-2">
          {PROVIDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`rounded px-3 py-1 text-xs ${
                provider === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
              onClick={() => handleProviderChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">
          名称
        </label>
        <input
          className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`我的 ${PROVIDER_OPTIONS.find((o) => o.value === provider)?.label} 账号`}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">
          API Key
        </label>
        <input
          type="password"
          className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">
          Endpoint
        </label>
        <input
          className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">
          Model
        </label>
        <input
          className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Temperature ({temperature})
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Max Tokens
          </label>
          <input
            type="number"
            min="256"
            max="32768"
            step="256"
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          className="rounded px-4 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
          onClick={onCancel}
        >
          取消
        </button>
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          {initial ? "保存" : "添加"}
        </button>
      </div>
    </form>
  );
}

export function AIProviderDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const providers = useAIStore((s) => s.providers);
  const activeProviderId = useAIStore((s) => s.activeProviderId);
  const setActiveProvider = useAIStore((s) => s.setActiveProvider);
  const removeProvider = useAIStore((s) => s.removeProvider);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (editingId) {
    const provider = providers.find((p) => p.id === editingId);
    if (provider) {
      return (
        <div className="p-4">
          <h3 className="mb-4 text-sm font-semibold">编辑 Provider</h3>
          <ProviderForm
            initial={provider}
            onSave={() => setEditingId(null)}
            onCancel={() => setEditingId(null)}
          />
        </div>
      );
    }
  }

  if (adding) {
    return (
      <div className="p-4">
        <h3 className="mb-4 text-sm font-semibold">添加 Provider</h3>
        <ProviderForm
          onSave={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">AI Provider 配置</h3>
        <button
          className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {providers.length === 0 ? (
        <p className="text-sm text-zinc-500">尚未配置 Provider</p>
      ) : (
        <ul className="space-y-1">
          {providers.map((p) => (
            <li
              key={p.id}
              className={`flex items-center gap-2 rounded px-3 py-2 cursor-pointer ${
                p.id === activeProviderId
                  ? "bg-blue-50 dark:bg-blue-950"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
              }`}
              onClick={() => setActiveProvider(p.id)}
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {p.name || p.provider}
                </div>
                <div className="text-xs text-zinc-500">
                  {p.model} · {p.endpoint}
                </div>
              </div>
              {p.id === activeProviderId && (
                <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">
                  当前
                </span>
              )}
              <button
                className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:text-zinc-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(p.id);
                }}
              >
                编辑
              </button>
              <button
                className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  removeProvider(p.id);
                }}
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        className="mt-4 w-full rounded border border-dashed border-zinc-400 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-900"
        onClick={() => setAdding(true)}
      >
        + 添加 Provider
      </button>
    </div>
  );
}
