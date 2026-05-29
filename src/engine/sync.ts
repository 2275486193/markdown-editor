export function syncBlockEdit(
  content: string,
  startLine: number,
  endLine: number,
  newText: string
): string {
  const lines = content.split('\n');

  const startIdx = startLine - 1;
  const endIdx = endLine;

  const before = lines.slice(0, startIdx);
  const after = lines.slice(endIdx);

  const newLines = newText.split('\n');

  return [...before, ...newLines, ...after].join('\n');
}

export function deleteLine(content: string, line: number): string {
  const lines = content.split('\n');
  lines.splice(line - 1, 1);
  return lines.join('\n');
}
