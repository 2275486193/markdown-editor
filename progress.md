# Progress Log

## Version Progress

| version | status | started | completed | notes |
|---------|--------|---------|-----------|-------|
| 0.1 | done | 2026-05-13 | 2026-05-14 | File open/save, Preview + Source modes, multi-theme |
| 0.2 | done | 2026-05-14 | 2026-05-14 | Outline nav, themes; Milkdown WYSIWYG cancelled |
| 0.3 | done | 2026-05-14 | 2026-05-14 | AI: Provider, Agent, Diff, Streaming, Selection edit |
| 0.4 | done | 2026-05-14 | 2026-05-14 | File watch, auto-save, recent files |
| 1.0 | done | 2026-05-15 | 2026-05-15 | Font size, word count |
| 1.1 | done | 2026-05-15 | 2026-05-15 | Tag completion, paper theme, immersive reading, exit-save prompt, file toolbar |
| 2.0 | done | 2026-05-19 | 2026-05-19 | Typora-style redesign: sidebar tabs, file browser, 5 themes, unified editing |
| 2.1 | done | 2026-05-19 | 2026-05-19 | ByteMD WYSIWYG; three-mode architecture (Preview/Source/WYSIWYG) |
| 3.0 | in_progress | 2026-05-23 | — | Self-built engine (hidden-textarea): C-01,C-03,C-05 done; C-02,C-04 in progress |

## Current State (v3.0)

Branch: `feat/text-styling`

C-01 (core loop), C-03 (keyboard), C-05 (inline format), C-06 (polish) — completed.
C-02 (block visual styles), C-04 (block-type editing behaviors) — in progress.

### 2026-05-29: 逐行段落模型

核心变更：废弃 remark 的段落合并语义，改为 Typora 式的逐行独立段落。
- parser.ts: `normalizeLines` 剥离末尾 `\n`，`splitParagraphLines` 将 remark paragraph 逐行拆分 + 空白行填充为可编辑空 paragraph
- sync.ts: `deleteLine` splice 删除单行，替代 `syncBlockEdit('')` 的空行删除恒等陷阱
- 标题/正文 Enter 统一用 `\n` 分隔符，去掉 `​` 占位
- 引用子 block 独立，不拆分为逐行段落
- 测试：新增 3 个逐行段落测试 + 1 个末尾 `\n` 测试，更新 5 个匹配新行为

## Decisions

| date | decision | reason |
|------|----------|--------|
| 2026-05-27 | Phase 1 cleanup: dead code + debug styles | Removed cursor-mapping.ts, 14 unused deps, fixed HiddenTextarea debug styles |
| 2026-05-27 | Phase 2 cleanup: deduplication | Unified slugify, replaceBlockText→syncBlockEdit, extracted getMarkerOpenLen shared constant |
| 2026-05-27 | Phase 3 cleanup: unused deps | Removed radix tooltip/dialog, rehype-stringify, remark-rehype; pnpm lint + test all pass |
| 2026-05-27 | Reposition via caret DOM element | Use `[data-caret="true"]` bounding rect for HiddenTextarea positioning; add dynamic height prop |
| 2026-05-13 | Tauri 2 over Electron | Windows pre-installed WebView2, ~5MB vs ~150MB bundle |
| 2026-05-13 | Agent single-round only | No multi-step planning; correction cost is low |
| 2026-05-13 | AI Provider: frontend direct call | WebView2 has no CORS; less Rust complexity |
| 2026-05-13 | Rust GNU toolchain over MSVC | No Visual Studio/link.exe; MinGW no-install |
| 2026-05-13 | subst drive mapping for dev | MinGW as/dlltool don't support paths with spaces |
| 2026-05-13 | Removed WYSIWYG (Milkdown) | Product decision: preview + source dual-mode is the core |
| 2026-05-25 | Killed contentEditable engine | Multi-round debugging didn't converge (Enter blank lines, cursor drift, React re-render conflicts) |
| 2026-05-25 | Switched to hidden-textarea | Typora-style: pure React read-only render, single hidden textarea for input, independent cursor |
| 2026-05-25 | Removed turndown, katex, rehype-katex, remark-math, mdast | Simplification: 6 deps removed |
| 2026-05-26 | Baseline simplification (C-03.5) | Deleted chaotic logic: renderer 223→55 lines, CSS -50 lines, removed TableEditor/updateSegMarkers/applyBlockCss |
| 2026-05-26 | C-05 inline format: inline.tsx | parseInline + InlineRenderer, replaces stripInline; all block components integrated |
| 2026-05-26 | C-03 keyboard completion done | Backspace empty-block merge, Delete, arrow column preservation |
| 2026-05-29 | 逐行段落模型 | 废弃 remark 段落合并，逐行独立 paragraph；空白行转可编辑空 paragraph；标题/正文 Enter 统一 \\n |
| 2026-05-29 | deleteLine 替代 syncBlockEdit('') | splice 单行删除，解决空行 Backspace 恒等陷阱 |
| 2026-05-29 | heading Enter 改用 \\n | 与 paragraph Enter 统一，去掉 ​ 占位 |

## Key Bug Fixes

| date | symptom | root cause | fix |
|------|---------|------------|-----|
| 2026-05-13 | CSS import fails from transitive dep | pnpm strict mode doesn't flatten node_modules | Add package as direct dependency (C4) |
| 2026-05-13 | Vite white screen on subst drive | Vite file resolver fails canonicalize on subst paths | `pushd D:\RealPath && pnpm dev` (C5) |
| 2026-05-19 | Ctrl+Z only undoes 1 character | Monaco `value` prop re-sets editor content, clearing undo | Use `defaultValue` (uncontrolled) (A5) |
| 2026-05-19 | Code block white overlay | rehype-highlight CSS incomplete in pnpm+Vite+WebView2 | Remove rehype-highlight; use Tailwind for code blocks (C4) |
| 2026-05-19 | Tag completion: duplicate `>` | Completion range didn't cover auto-closed bracket | Cover `<` + auto-closed `>` in range (C7) |
