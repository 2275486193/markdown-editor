import type { AIProviderConfig, OperationType, ChatMessage } from "../types/ai";
import { openAIProvider } from "./llm/openai";

const SYSTEM_PROMPT = `你是一个 Markdown 编辑助手，集成在编辑器中。
用户将提供完整文件内容和一条编辑指令。
你的任务是仅输出修改后的完整 Markdown 内容。

规则：
1. 仅输出 Markdown，不要包含任何解释、说明、代码块包裹
2. 尽量保持未涉及部分的原样（包括换行符风格）
3. 如果指令不合理，仍输出原文
4. 不要添加 "Here is the result" 等前缀后缀
5. 不要将 Markdown 用 \`\`\` 包裹`;

const OPERATION_INSTRUCTIONS: Record<OperationType, string> = {
  rewrite: "重写以下文本，保持原意但改进表达和可读性。",
  expand: "对以下文本进行扩写，增加细节和深度。",
  shrink: "精简以下文本，保留核心信息，删除冗余内容。",
  continue: "从光标位置续写内容，保持风格一致。",
  translate: "翻译以下文本。",
  fix: "修正以下文本中的拼写和语法错误。",
  summarize: "对以下文本生成摘要，提取关键信息。",
  custom: "",
};

interface ExecuteOptions {
  operation: OperationType;
  instruction: string;
  selectedText?: string;
  fullContent: string;
}

interface ExecuteResult {
  modified: string;
  original: string;
}

export async function executeAIEdit(
  config: AIProviderConfig,
  options: ExecuteOptions,
  onToken?: (token: string) => void,
): Promise<ExecuteResult> {
  const { operation, instruction, selectedText, fullContent } = options;

  const opPrompt = OPERATION_INSTRUCTIONS[operation];
  let userContent = `## 完整文件内容\n\n${fullContent}`;
  if (selectedText) {
    userContent += `\n\n## 选中的文本\n\n${selectedText}`;
  }
  userContent += `\n\n## 指令\n\n${opPrompt}${instruction}`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  let streamed = "";
  const generator = openAIProvider.chat(messages, {
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });

  for await (const token of generator) {
    streamed += token;
    onToken?.(token);
  }

  const modified = cleanMarkdownResponse(streamed);
  return { original: fullContent, modified };
}

function cleanMarkdownResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```markdown")) cleaned = cleaned.slice(12);
  else if (cleaned.startsWith("```md")) cleaned = cleaned.slice(6);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}
