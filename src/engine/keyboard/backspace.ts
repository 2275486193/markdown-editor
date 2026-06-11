// src/engine/keyboard/backspace.ts
import type { Handler, Patch } from './types';
import {
  displayText,
  blockToMarkdown,
  findBlockRecursive,
  findParentQuote,
  flattenBlocks,
  findEnclosingListItem,
  findParentList,
} from '../blocks';
import { syncBlockEdit, deleteLine } from '../sync';
import { renumberOrderedList } from './list';
import { mergeListItemBackward, dedentListItem, exitListToParagraph } from './list-ops';

function maybeRenumber(content: string, block: { type: string; meta?: { ordered?: boolean }; sourceStartLine: number; sourceEndLine: number }, deltaLines = 0): string {
  if (block.type !== 'list' || !block.meta?.ordered) return content;
  return renumberOrderedList(content, block.sourceStartLine, block.sourceEndLine + deltaLines);
}

export const handleBackspace: Handler = (ctx) => {
  const { content, blocks, caretBlockId, caretOffset } = ctx;
  if (!caretBlockId) return null;
  const block = findBlockRecursive(blocks, caretBlockId);
  if (!block) return null;

  // table cell:在表头第一 cell 行首按 Backspace 删除整张表
  if (
    block.type === 'table' &&
    ctx.caretCell?.row === 0 &&
    ctx.caretCell?.col === 0 &&
    ctx.caretOffset === 0
  ) {
    const lines = ctx.content.split('\n');
    const startIdx = block.sourceStartLine - 1;
    const endIdx = block.sourceEndLine - 1;
    lines.splice(startIdx, endIdx - startIdx + 1);
    return {
      newContent: lines.join('\n'),
      newCaretBlockId: null,
      newCaretCell: null,
      newCaretOffset: 0,
      newCaretLineTarget: Math.max(1, startIdx),
      preventDefault: true,
    };
  }

  const dtext = displayText(block);

  if (caretOffset === 0) {
    // ── list (structural):caret 在 listItem 内 paragraph 上(或空 item 自身) ──
    const enclosingItem = findEnclosingListItem(blocks, caretBlockId);
    if (enclosingItem) {
      const parentList = findParentList(blocks, enclosingItem.id);
      if (parentList) {
        const itemText = displayText(enclosingItem);
        const indent = enclosingItem.meta?.indent ?? 0;
        if (itemText !== '') {
          return mergeListItemBackward(ctx, enclosingItem, parentList);
        }
        return indent > 0
          ? dedentListItem(ctx, enclosingItem, parentList)
          : exitListToParagraph(ctx, enclosingItem, parentList);
      }
    }

    // ── quote child specific ──
    if (block.meta?.quoteDepth) {
      const parentQuote = findParentQuote(blocks, block.id);
      const siblings = parentQuote?.children ?? [];
      const siblingIdx = siblings.findIndex((c) => c.id === block.id);

      if (dtext === '') {
        // Empty block: delete this child, caret to previous line
        const newContent = deleteLine(content, block.sourceStartLine);
        if (newContent !== content) {
          const patch: Patch = {
            newContent,
            newCaretBlockId: null,
            preventDefault: true,
          };
          if (siblingIdx > 0) {
            const prev = siblings[siblingIdx - 1];
            patch.newCaretLineTarget = prev.sourceEndLine;
            patch.newCaretOffset = displayText(prev).length;
          } else if (parentQuote) {
            patch.newCaretLineTarget = parentQuote.sourceStartLine - 1;
            patch.newCaretOffset = 0;
          } else {
            patch.newCaretLineTarget = block.sourceStartLine - 1;
            patch.newCaretOffset = 0;
          }
          return patch;
        }
        return { preventDefault: true };
      }

      if (siblingIdx === 0) {
        // First child with content: strip prefix → exit quote, stay on same line
        const newContent = syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, block.markdown);
        if (newContent !== content) {
          return {
            newContent,
            newCaretLineTarget: block.sourceStartLine,
            newCaretOffset: 0,
            newCaretBlockId: null,
            preventDefault: true,
          };
        }
        return { preventDefault: true };
      }

      // Not first child: merge with previous sibling
      const prevSibling = siblings[siblingIdx - 1];
      const prevText = displayText(prevSibling);
      const merged = prevText + dtext;
      const mergedMd = blockToMarkdown(merged, prevSibling);
      const newContent = syncBlockEdit(content, prevSibling.sourceStartLine, block.sourceEndLine, mergedMd);
      if (newContent !== content) {
        return {
          newContent,
          newCaretLineTarget: prevSibling.sourceEndLine,
          newCaretOffset: prevText.length,
          newCaretBlockId: null,
          preventDefault: true,
        };
      }
      return { preventDefault: true };
    }

    // ── top-level merge ──
    const flat = flattenBlocks(blocks);
    const idx = flat.findIndex((b) => b.id === caretBlockId);
    if (idx < 0) return { preventDefault: true };
    if (idx === 0) {
      if (dtext !== '') return { preventDefault: true };
      if (flat.length === 1) return { preventDefault: true };
      const newContent2 = deleteLine(content, block.sourceStartLine);
      if (newContent2 !== content) {
        return {
          newContent: newContent2,
          newCaretLineTarget: block.sourceStartLine,
          newCaretOffset: 0,
          newCaretBlockId: null,
          preventDefault: true,
        };
      }
      return { preventDefault: true };
    }
    const prevBlock = flat[idx - 1];
    const prevText = displayText(prevBlock);

    if (prevText === '' && block.type === 'heading') {
      const newContent = deleteLine(content, prevBlock.sourceStartLine);
      if (newContent !== content) {
        return {
          newContent,
          newCaretLineTarget: block.sourceStartLine - 1,
          newCaretOffset: 0,
          newCaretBlockId: null,
          preventDefault: true,
        };
      }
      return { preventDefault: true };
    }

    if (dtext === '') {
      const newContent = deleteLine(content, block.sourceStartLine);
      if (newContent !== content) {
        return {
          newContent,
          newCaretLineTarget: prevBlock.sourceEndLine,
          newCaretOffset: prevText.length,
          newCaretBlockId: null,
          preventDefault: true,
        };
      }
      return { preventDefault: true };
    } else {
      const merged = prevText + dtext;
      const mergedMd = blockToMarkdown(merged, prevBlock);
      const newContent = syncBlockEdit(content, prevBlock.sourceStartLine, block.sourceEndLine, mergedMd);
      if (newContent !== content) {
        return {
          newContent,
          newCaretLineTarget: prevBlock.sourceEndLine,
          newCaretOffset: prevText.length,
          newCaretBlockId: null,
          preventDefault: true,
        };
      }
      return { preventDefault: true };
    }
  }

  // Normal character deletion (same block)
  const newText = dtext.slice(0, caretOffset - 1) + dtext.slice(caretOffset);
  const newMd = blockToMarkdown(newText, block);
  let newContent = syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, newMd);
  if (newContent !== content) {
    const removedNewline = dtext[caretOffset - 1] === '\n';
    newContent = maybeRenumber(newContent, block, removedNewline ? -1 : 0);
    return {
      newContent,
      newCaretOffset: Math.max(0, caretOffset - 1),
      syncActiveOffset: true,
      preventDefault: true,
    };
  }
  return { preventDefault: true };
};
