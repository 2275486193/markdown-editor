import type { Block } from './types';

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

/**
 * 修改表格 cell 文本,返回新 content。
 * row 0 = 表头行;row >= 1 = 数据行(对齐分隔行始终在 markdown 第 2 行,不参与编号)。
 */
export function syncCellEdit(
  content: string,
  block: Block,
  row: number,
  col: number,
  newCellText: string,
): string {
  const lines = content.split('\n');
  const lineIdx = block.sourceStartLine - 1 + (row === 0 ? 0 : row + 1);
  const line = lines[lineIdx] ?? '';

  const trimmed = line.replace(/^\||\|$/g, '');
  const parts: string[] = [];
  let buf = '';
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '\\' && trimmed[i + 1] === '|') {
      buf += '\\|';
      i++;
    } else if (trimmed[i] === '|') {
      parts.push(buf);
      buf = '';
    } else {
      buf += trimmed[i];
    }
  }
  parts.push(buf);

  const finalParts = parts.map((p, i) => (i === col ? newCellText.trim() : p.trim()));
  lines[lineIdx] = '| ' + finalParts.join(' | ') + ' |';

  return lines.join('\n');
}

export function splitRow(line: string): string[] {
  const trimmed = line.replace(/^\||\|$/g, '');
  const parts: string[] = [];
  let buf = '';
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '\\' && trimmed[i + 1] === '|') {
      buf += '\\|';
      i++;
    } else if (trimmed[i] === '|') {
      parts.push(buf.trim());
      buf = '';
    } else {
      buf += trimmed[i];
    }
  }
  parts.push(buf.trim());
  return parts;
}

export function joinRow(cells: string[]): string {
  return '| ' + cells.join(' | ') + ' |';
}

export function addRowAfter(content: string, block: Block, row: number): string {
  const lines = content.split('\n');
  const colCount = block.meta?.colCount ?? 1;
  const newRow = joinRow(new Array(colCount).fill(''));
  const insertAfterIdx = block.sourceStartLine - 1 + (row === 0 ? 1 : row + 1);
  lines.splice(insertAfterIdx + 1, 0, newRow);
  return lines.join('\n');
}

export function deleteRow(content: string, block: Block, row: number): string {
  if (row === 0) return content;
  const lines = content.split('\n');
  const lineIdx = block.sourceStartLine - 1 + (row + 1);
  lines.splice(lineIdx, 1);
  return lines.join('\n');
}

export function addColumnAfter(content: string, block: Block, col: number): string {
  const lines = content.split('\n');
  const startIdx = block.sourceStartLine - 1;
  const endIdx = block.sourceEndLine - 1;
  for (let i = startIdx; i <= endIdx; i++) {
    const line = lines[i];
    if (i === startIdx + 1) {
      const cells = splitRow(line);
      cells.splice(col + 1, 0, '---');
      lines[i] = '|' + cells.map((c) => c || '---').join('|') + '|';
    } else {
      const cells = splitRow(line);
      cells.splice(col + 1, 0, '');
      lines[i] = joinRow(cells);
    }
  }
  return lines.join('\n');
}

export function deleteColumn(content: string, block: Block, col: number): string {
  const lines = content.split('\n');
  const startIdx = block.sourceStartLine - 1;
  const endIdx = block.sourceEndLine - 1;
  for (let i = startIdx; i <= endIdx; i++) {
    const line = lines[i];
    if (i === startIdx + 1) {
      const cells = splitRow(line);
      cells.splice(col, 1);
      lines[i] = '|' + cells.map((c) => c || '---').join('|') + '|';
    } else {
      const cells = splitRow(line);
      cells.splice(col, 1);
      lines[i] = joinRow(cells);
    }
  }
  return lines.join('\n');
}

/**
 * 交换两行(行下标按 cells[] 索引,row=0 是表头,不允许参与交换)。
 */
export function swapTableRow(content: string, block: Block, rowA: number, rowB: number): string {
  if (rowA === 0 || rowB === 0) return content;
  const lines = content.split('\n');
  const idxA = block.sourceStartLine - 1 + (rowA + 1);
  const idxB = block.sourceStartLine - 1 + (rowB + 1);
  if (idxA >= lines.length || idxB >= lines.length) return content;
  [lines[idxA], lines[idxB]] = [lines[idxB], lines[idxA]];
  return lines.join('\n');
}

/**
 * 交换两列。
 */
export function swapTableColumn(content: string, block: Block, colA: number, colB: number): string {
  const lines = content.split('\n');
  const startIdx = block.sourceStartLine - 1;
  const endIdx = block.sourceEndLine - 1;
  for (let i = startIdx; i <= endIdx; i++) {
    const cells = splitRow(lines[i]);
    if (colA >= cells.length || colB >= cells.length) continue;
    [cells[colA], cells[colB]] = [cells[colB], cells[colA]];
    if (i === startIdx + 1) {
      lines[i] = '|' + cells.map((c) => c || '---').join('|') + '|';
    } else {
      lines[i] = joinRow(cells);
    }
  }
  return lines.join('\n');
}
