import { useState } from "react";
import { useEditorStore } from "../../stores/editor";
import { useUiStore, type ThemeMode } from "../../stores/ui";
import { useFileSave } from "../../hooks/useFileSave";
import { useKeyboard } from "../../hooks/useKeyboard";
import { AIProviderDialog } from "../settings/AIProviderDialog";
import { ProjectMenu } from "./ProjectMenu";
import type { EditorMode } from "../../types/editor";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "☀ 亮色" },
  { value: "dark", label: "☾ 暗色" },
  { value: "paper", label: "📜 书页" },
  { value: "system", label: "⇅ 跟随系统" },
  { value: "github", label: "GitHub" },
  { value: "newsprint", label: "Newsprint" },
  { value: "night", label: "Night" },
  { value: "pixyll", label: "Pixyll" },
  { value: "whitey", label: "Whitey" },
];

function themeLabel(theme: ThemeMode): string {
  const map: Record<string, string> = {
    light: "☀", dark: "☾", paper: "📜", system: "⇅",
    github: "G", newsprint: "N", night: "🌙", pixyll: "P", whitey: "W",
  };
  return map[theme] ?? "?";
}

export function TitleBar({
  onToggleAI,
  onNewProject,
  onOpenProject,
  onCloseProject,
}: {
  onToggleAI: () => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onCloseProject: () => void;
}) {
  const fileName = useEditorStore((s) => s.fileName);
  const isDirty = useEditorStore((s) => s.isDirty);
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const { save, saveAs } = useFileSave();
  const [aiOpen, setAiOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  const revertToSaved = () => {
    const { savedContent } = useEditorStore.getState();
    useEditorStore.getState().setContentNoHistory(savedContent);
  };

  useKeyboard([
    { key: "s", ctrl: true, handler: save },
    { key: "s", ctrl: true, shift: true, handler: saveAs },
  ]);

  const modes: { mode: EditorMode; label: string }[] = [
    { mode: "wysiwyg", label: "所见即所得" },
    { mode: "preview", label: "预览" },
    { mode: "source", label: "源码" },
  ];

  return (
    <div className="flex h-9 items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 dark:border-zinc-800 dark:bg-zinc-950 paper:border-[#c4b6a4] paper:bg-[#cfc3b0]">
      <ProjectMenu
        onNewProject={onNewProject}
        onOpenProject={onOpenProject}
        onSave={save}
        onSaveAs={saveAs}
        onCloseProject={onCloseProject}
        hasFile={!!fileName}
      />

      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 min-w-0 truncate">
        {fileName || "未命名"}
      </span>
      {isDirty && (
        <span className="text-amber-500 text-xs shrink-0" title="未保存">●</span>
      )}

      <div className="flex-1" />

      {/* Mode switch */}
      {fileName && (
        <div className="flex items-center gap-0.5 rounded bg-zinc-200/50 p-0.5 dark:bg-zinc-800">
          {modes.map(({ mode: m, label }) => (
            <button
              key={m}
              className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
                mode === m
                  ? "bg-white text-zinc-800 shadow-sm dark:bg-zinc-700 dark:text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
              onClick={() => setMode(m)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* AI toggle */}
      {fileName && (
        <button
          className="rounded px-2 py-0.5 text-xs font-medium text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950"
          onClick={onToggleAI}
        >
          AI
        </button>
      )}

      {/* Revert */}
      {isDirty && (
        <button
          className="rounded px-2 py-0.5 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-950"
          onClick={revertToSaved}
          title="放弃所有修改"
        >
          还原
        </button>
      )}

      {/* Theme selector */}
      <div className="relative">
        <button
          className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          onClick={() => setThemeOpen(!themeOpen)}
          title="主题"
        >
          {themeLabel(theme)}
        </button>
        {themeOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setThemeOpen(false)} />
            <div className="absolute right-0 top-7 z-50 w-36 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                    theme === opt.value ? "font-semibold text-blue-600 dark:text-blue-400" : "text-zinc-600 dark:text-zinc-300"
                  }`}
                  onClick={() => { setTheme(opt.value); setThemeOpen(false); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* AI Settings */}
      <button
        className="rounded px-1 py-0.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        onClick={() => setAiOpen(true)}
        title="AI 配置"
      >
        ⚙
      </button>
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-96 max-h-[80vh] overflow-auto rounded-lg bg-white shadow-xl dark:bg-zinc-900">
            <AIProviderDialog onClose={() => setAiOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
