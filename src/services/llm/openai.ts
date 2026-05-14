import type { LLMProvider, LLMConfig, ChatMessage } from "../../types/ai";

export class OpenAIProvider implements LLMProvider {
  readonly name = "OpenAI Compatible";
  readonly defaultModel = "gpt-4o";

  validateConfig(config: LLMConfig): string | null {
    if (!config.apiKey) return "API Key is required";
    if (!config.endpoint) return "Endpoint is required";
    if (!config.model) return "Model is required";
    return null;
  }

  async *chat(
    messages: ChatMessage[],
    config: LLMConfig,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const response = await fetch(`${config.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new Error("API Key 无效");
      }
      throw new Error(`API 错误 (${response.status}): ${body}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("无法读取响应流");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip unparseable lines
        }
      }
    }
  }
}

export const openAIProvider = new OpenAIProvider();
