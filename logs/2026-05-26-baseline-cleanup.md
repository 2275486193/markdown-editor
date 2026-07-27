# C-03.5: Phase 2/3 尝试 + 基线精简

- **日期**: 2026-05-26
- **关联任务**: C-03.5
- **产出**:
  - Phase 2/3: auto-pair, select-wrap, delete-unwrap, Enter续前缀, 实时块CSS — 后因逻辑混沌+buffer溢出全部删除
  - **基线精简**: renderer.tsx 223→55行, CSS 精简, 删除 TableEditor/updateSegMarkers/applyBlockCss/seg-focus依赖
  - 当前回路: contentEditable + BlockDisplay + processInlinePatterns + textContent sync
  - 86 tests, verify.ps1 全绿
- **决策**:
  - 逐段聚焦删除（改为`[contenteditable]:focus .md-meta`全显）
  - textContent 替代 turndown 作为 blur 提交
  - 保留 processInlinePatterns (rt-parser.ts) 作为实时内联基础
- **备注**: C-03.5 待后续对话从精简基线重启开发
