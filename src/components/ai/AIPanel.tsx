import { useState, useMemo } from "react";
import { useAIStore } from "../../stores/ai";
import { useEditorStore } from "../../stores/editor";
import { executeAIEdit } from "../../services/agent";
import { diffLines } from "diff";
import type { OperationType } from "../../types/ai";

const OPERATIONS: { value: OperationType; label: string }[] = [
  { value: "rewrite", label: "改写" },
  { value: "expand", label: "扩写" },
  { value: "shrink", label: "缩写" },
  { value: "continue", label: "续写" },
  { value: "translate", label: "翻译" },
  { value: "fix", label: "纠错" },
  { value: "summarize", label: "总结" },
  { value: "custom", label: "自定义" },
];

export function AIPanel({ onClose }: { onClose: () => void }) {
  const activeProviderId = useAIStore((s) => s.activeProviderId);
  const providers = useAIStore((s) => s.providers);
  const status = useAIStore((s) => s.status);
  const streamedText = useAIStore((s) => s.streamedText);
  const content = useEditorStore((s) => s.content);
  const selection = useEditorStore((s) => s.selection);
  const setContent = useEditorStore((s) => s.setContent);

  const [instruction, setLocalInstruction] = useState("");
  const [operation, setLocalOperation] = useState<OperationType>("rewrite");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [original, setOriginal] = useState("");

  const diffChanges = useMemo(() => {
    if (!result || !original) return [];
    return diffLines(original, result);
  }, [result, original]);

  const provider = providers.find((p) => p.id === activeProviderId);

  async function handleExecute() {
    if (!provider) {
      setError("请先在 AI 配置中添加 Provider");
      return;
    }
    if (!provider.apiKey) {
      setError("请先配置 API Key");
      return;
    }
    setError("");
    setResult("");
    setOriginal(content);
    useAIStore.setState({ status: "generating", streamedText: "" });

    try {
      const r = await executeAIEdit(
        provider,
        {
          operation,
          instruction,
          fullContent: content,
          selectedText: selection?.text,
        },
        (token) => {
          useAIStore.getState().appendStreamingToken(token);
        },
      );
      setResult(r.modified);
      useAIStore.setState({ status: "diff-review" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "执行失败");
      useAIStore.setState({ status: "error" });
    }
  }

  function handleAccept() {
    if (result) {
      setContent(result);
    }
    useAIStore.setState({ status: "idle", streamedText: "" });
    setResult("");
    setLocalInstruction("");
  }

  function handleReject() {
    useAIStore.setState({ status: "idle", streamedText: "" });
    setResult("");
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h3 className="text-sm font-semibold">AI 助手</h3>
        <button
          className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {!provider ? (
        <div className="p-4 text-sm text-zinc-500">请先配置 AI Provider</div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
          <div className="text-xs text-zinc-500">
            当前: {provider.name} · {provider.model}
          </div>

          <div className="flex flex-wrap gap-1">
            {OPERATIONS.map((op) => (
              <button
                key={op.value}
                className={`rounded px-2 py-0.5 text-xs ${
                  operation === op.value
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
                onClick={() => setLocalOperation(op.value)}
              >
                {op.label}
              </button>
            ))}
          </div>

          <textarea
            className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            rows={3}
            placeholder="输入指令..."
            value={instruction}
            onChange={(e) => setLocalInstruction(e.target.value)}
          />

          {error && (
            <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
              {error}
            </div>
          )}

          {(status === "generating" || status === "streaming") && (
            <div className="flex-1 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
              <pre className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                {streamedText || "等待响应..."}
              </pre>
            </div>
          )}

          {status === "diff-review" && result && (
            <div className="flex flex-1 flex-col gap-2 overflow-hidden">
              <div className="text-xs font-semibold text-zinc-500">
                Diff 预览 ({diffChanges.length} 处变更)
              </div>
              <div className="flex-1 overflow-auto rounded border border-zinc-200 bg-zinc-50 font-mono text-xs leading-relaxed dark:border-zinc-800 dark:bg-zinc-950">
                {diffChanges.map((change, i) => (
                  <div
                    key={i}
                    className={`px-3 py-0.5 whitespace-pre-wrap ${
                      change.added
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                        : change.removed
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          : "text-zinc-500 dark:text-zinc-500"
                    }`}
                  >
                    {change.added ? "+ " : change.removed ? "- " : "  "}
                    {change.value}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-700"
                  onClick={handleAccept}
                >
                  接受
                </button>
                <button
                  className="rounded bg-zinc-200 px-4 py-1.5 text-xs text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-400"
                  onClick={handleReject}
                >
                  拒绝
                </button>
              </div>
            </div>
          )}

          <button
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={status === "generating"}
            onClick={handleExecute}
          >
            {status === "generating" ? "生成中..." : "执行"}
          </button>
        </div>
      )}
    </div>
  );
}
