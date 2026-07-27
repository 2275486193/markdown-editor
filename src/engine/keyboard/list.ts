/**
 * 重排有序列表的编号。
 * 同缩进层级独立计数(子列表自己重排)。
 * 起始数字 = 该层级第一项的原数字。
 *
 * @param content 完整 markdown(SSOT)
 * @param startLine 列表起始行号(1-based)
 * @param endLine 列表结束行号(1-based, inclusive)
 */
export function renumberOrderedList(content: string, startLine: number, endLine: number): string {
  const lines = content.split('\n');
  const counters: Map<number, number> = new Map();

  for (let i = startLine - 1; i < endLine && i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(\s*)(\d+)\.\s/);
    if (!m) continue;
    const indent = m[1].length;
    const origNum = parseInt(m[2], 10);

    let next = counters.get(indent);
    if (next === undefined) {
      next = origNum;
    }
    lines[i] = m[1] + next + '. ' + line.slice(m[0].length);
    counters.set(indent, next + 1);
  }

  return lines.join('\n');
}
