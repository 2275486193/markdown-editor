export type AIStatus =
  | "idle"
  | "generating"
  | "streaming"
  | "diff-review"
  | "error";

export type OperationType =
  | "rewrite"
  | "expand"
  | "shrink"
  | "continue"
  | "translate"
  | "fix"
  | "summarize"
  | "custom";

export type ProviderKind = "openai" | "anthropic" | "ollama" | "custom";

export interface AIProviderConfig {
  id: string;
  name: string;
  provider: ProviderKind;
  apiKey: string;
  endpoint: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface DiffHunk {
  originalStart: number;
  originalLines: number;
  modifiedStart: number;
  modifiedLines: number;
  lines: DiffLine[];
}

export type DiffLine =
  | { type: "equal"; text: string }
  | { type: "add"; text: string }
  | { type: "remove"; text: string };

export interface DiffResult {
  original: string;
  modified: string;
  hunks: DiffHunk[];
}

export interface LLMConfig {
  apiKey: string;
  endpoint: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  chat(
    messages: ChatMessage[],
    config: LLMConfig,
    signal?: AbortSignal,
  ): AsyncGenerator<string>;
  validateConfig(config: LLMConfig): string | null;
}

export const PROVIDER_PRESETS: Record<
  ProviderKind,
  { name: string; endpoint: string; defaultModel: string }
> = {
  openai: {
    name: "OpenAI",
    endpoint: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
  },
  anthropic: {
    name: "Anthropic",
    endpoint: "https://api.anthropic.com",
    defaultModel: "claude-sonnet-4-6",
  },
  ollama: {
    name: "Ollama",
    endpoint: "http://localhost:11434",
    defaultModel: "llama3",
  },
  custom: {
    name: "Custom",
    endpoint: "",
    defaultModel: "",
  },
};
