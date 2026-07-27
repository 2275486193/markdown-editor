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
| 3.0 | in_progress | 2026-05-23 | — | Self-built engine (hidden-textarea): C-01/02/03/04a/04b/04c/04d/05/06/07/09/10/M-01/M-02 done; C-08 pending |

## Current State (v3.0)

Branch: `feat/text-styling`

Completed: C-01 core loop, C-02 visual styles, C-03 keyboard completion, C-04a 段落/标题/引用 行为, C-05 inline format, C-06 polish, M-01 cleanup, **C-09 速记折叠**, **C-10 渲染增强**, **C-07 WYSIWYGMode 拆分**, **C-04b 列表行为**, **C-04d 代码块 Tab**, **C-04c 表格 cell 独立编辑**。
In progress: (无)。
Pending: C-08 引擎单测。

### 2026-07-13: v3.0 稳定性收口

- 修复 SourceMode A5 漂移:移除普通输入与外部 store 变更路径上的 Monaco `editor.setValue(content)` 同步,保持 `defaultValue` 非受控模式;外部内容变化通过 `key` 重挂载 Monaco。
- 完成 M-02:文件打开与外部 watcher reload 统一剪尾换行,并在 `markClean()` 后保持 `content/savedContent/isDirty` 一致。
- 补充 store/open/watch/source/parser/sync 关键回归测试,保护基础编辑与渲染输入。
- 同步清理低风险规则漂移:`App` 改 named export,`caret.ts`/`parser.ts` 去除局部 `any` 边界。
- 验证:`pnpm typecheck` 通过;`pnpm test` 22 文件 / 207 用例通过;`pnpm build` 通过(保留 Monaco 大 chunk 警告)。

### 2026-07-13: WYSIWYG 即时渲染与选区删除修复

- 修复 `# + 空格` 等结构化速记后的旧 blockId 光标问题:heading/quote/code/hr shortcut 改用 line target 重定位,避免 reparse 后光标丢失。
- 修复输入裸 `***`/`---` 第三个字符立即被解析为 `<hr>` 的问题:WYSIWYG parse 增加 `deferBareShortcutMarkers`,未按空格提交前保持 paragraph 可编辑。
- 修复 HR shortcut 后没有可编辑空行的问题:`---`/`***` 提交后生成 `marker + 空行 + 保留尾空行`,caret 指向第 2 行。
- 增加同块 DOM 选区映射与 Backspace/Delete 删除:支持鼠标框选同一块内长文本后删除,跨块结构化选区留待后续单独实现。
- 补充标题 marker 删除:空标题 `# ` 行首 Backspace 退回可编辑 `#` 段落;选中 heading raw marker 后 Backspace/Delete 可删除 `# ` 并退回普通段落。
- 修正激活标题的光标模型:Heading active 态改为 raw markdown offset,点击未激活标题时转换到 raw offset,聚焦后 `#` marker 可定位/可选中/可编辑。
- 修复字符速记分发漏接 line target:`handleChar` 现在会应用 `newCaretLineTarget`,避免 `> + 空格` 等结构转换后 caret 仍停留在旧 paragraph,导致删除被吞;同步修正 task-list fallback 的 line target。
- 验证:`pnpm typecheck` 通过;`pnpm test` 24 文件 / 219 用例通过;`pnpm build` 通过(保留 Monaco 大 chunk 警告)。

### 2026-07-23: WYSIWYG 视觉基线优化

- 默认 WYSIWYG 改为 Typora-like Focus 视觉方向:居中白底正文、低干扰激活态、轻量段落/标题/引用/表格/代码块节奏。
- 保留并优化 paper 暖色纸张风格:通过 `html.paper` 变量覆盖纸张背景、边框、代码块和表格颜色,避免删除现有主题。
- 预留 technical dark 方向:通过 `html.dark` / `data-theme="night"` 变量提供暗色技术风格,后续可扩展为完整多主题。
- `renderer.tsx` 从分散 Tailwind class 收敛为 `md-*` 语义 class,视觉集中到 `styles/index.css`;新增 renderer style contract 测试防止样式契约回退。

### 2026-06-11: C-04c 表格 cell 独立编辑完成

Phase 5 全部 11 任务上线,Typora 风格表格交互闭环:
- **engine/types.ts**:`BlockMeta` 加 `cells: string[][]`(含表头,不含对齐分隔行)+ `align: ('left'|'center'|'right'|null)[]` + `rowCount` + `colCount`;旧 `rows/cols` 保留 deprecated。
- **engine/parser.ts**:`parseTableMeta(markdown)` 字符级 walk 处理 `\|` 转义,派生 `cells`/`align`/`rowCount`/`colCount`(3 单测)。
- **engine/sync.ts**:`syncCellEdit(content, block, row, col, newCellText)`(row 0 = 表头, row >= 1 跳过对齐行);`addRowAfter` / `deleteRow`(row=0 守卫不删表头);`addColumnAfter` / `deleteColumn`(对齐分隔行用 `|` 不夹空格);`swapTableRow`(row=0 守卫)/ `swapTableColumn`(全行 incl 表头/对齐行)。
- **engine/caret.ts**:`pointFromCell(blockId, row, col, offset)` + `cellFromPoint(x, y)` 查 `data-cell-row`/`data-cell-col` 属性,Range/caretRangeFromPoint 走 cell 内 raw seg。
- **engine/renderer.tsx**:`BlockProps`/`RendererProps` 加 `activeCell?`,`TableBlock` 改用 `block.meta.cells`;`<th>`/`<td>` 加 `data-cell-row`/`data-cell-col` + 对齐 class,active cell 走 InlineEditable raw,非 active 走 InlineEditable 展示。
- **engine/keyboard/types.ts**:`KeyContext` 加 `caretCell: { row; col } | null`(必选);`Patch` 加 `newCaretCell?`。
- **engine/keyboard/table.ts**:新文件 `handleTableNav` 处理 Tab(末 cell auto addRowAfter)/Shift+Tab(行首回上行末 cell)/方向键(出表 null fallback 到 arrows 默认)/ Ctrl+Shift+方向行列交换。
- **engine/keyboard/{tab,arrows}.ts**:cell 路径优先转发 handleTableNav。
- **engine/keyboard/char.ts**:table cell 字符输入分支(走 syncCellEdit,在速记之前)。
- **engine/keyboard/enter.ts**:cell 内 Enter 插 `<br>`,offset+4。
- **engine/keyboard/backspace.ts**:`row=0 col=0 offset=0` 时 splice 整表。
- **components/editor/WYSIWYGMode.tsx**:模块级 `caretCell` + useState `activeCell`;`handleBlockClick` 加 table 分支(cellFromPoint 命中则进 cell);`reposition` 加 cell 优先(pointFromCell);6 处 KeyContext 构造统一加 `caretCell` 字段;arrows dispatch 应用 `newCaretCell` 时跨块跳出 table 自动清 caretCell。
- 测试:17 文件 / 160 用例全过(新增 18 = 3 parser + 8 sync helper(初始) + 3 sync swap + 7 table nav + 3 swap + 1 cell char + 2 backspace + 1 enter)。
- 已知:WYSIWYGMode 328 行(C-04c 加 cell 路径后涨,沿用 C-07 已有的 S3 例外)。

### 2026-06-11: C-04b/d 列表与代码块 Tab 行为完成

Phase 4 全部上线:
- **engine/keyboard/list.ts**:`renumberOrderedList(content, startLine, endLine)` — 按缩进层级独立计数,起始数字保留(纯函数,5 单测)。
- **list Enter**(enter.ts 顶部分支):非空末尾续同级项;有序列表插中间项 + renumberOrderedList;空项+顶层 indent='' 退出列表;空项+嵌套 indent>=2 降一级缩进;任务项续项默认 `[ ]` 未勾选。
- **list Tab/Shift+Tab**(tab.ts):基于 `displayText` 行起点 +2/-2 空格缩进;不足 2 空格 Shift+Tab 无操作。
- **code block Tab**(tab.ts):caret 处插 2 空格,`newCaretOffset += 2`;Shift+Tab 无操作。
- **list Backspace 重排**(backspace.ts 同块字符删除分支):删除 `\n` 后 maybeRenumber 调 renumberOrderedList,有序列表保持递增编号。
- 已知限制:`textToMarkdown` 总是生成 `'1. '` 前缀,起始数字 `5.` 等通过 displayText↔blockToMarkdown 往返不可恢复;`renumberOrderedList` 从 blockToMarkdown 输出的 `'1. ...\n1. ...'` 起算,产出连续 `1. 2. ...`。
- 测试:14 个文件 / 131 条用例全过(新增 5 list helper + 4 list Enter + 2 code/list Tab + 1 list Backspace = 12 条新单测)。

### 2026-06-11: C-07 WYSIWYGMode 拆分完成

handleKeyDown 中央枢纽逻辑全部抽离到纯函数 handler;WYSIWYGMode.tsx 666 → 272 行(满足 S3 ≤300)。
- **engine/keyboard/types.ts**:`Handler = (ctx, event) => Patch | null`,`KeyContext = { content, blocks, caretBlockId, caretOffset, caretLineTarget }`,`Patch = { newContent?, newCaretBlockId?, newCaretOffset?, newCaretLineTarget?, preventDefault, syncActiveOffset?, syncActiveBlockId?, repositionAfter? }`。
- **engine/blocks.ts**:9 个纯 helper(displayText / applyQuotePrefix / textToMarkdown / blockToMarkdown / findBlockRecursive / findParentQuote / flattenBlocks / findBlockAtLine / getNavigableBlocks)。
- **engine/keyboard/{enter,backspace,delete,arrows,tab,char}.ts**:六个键盘 handler;char 签名特殊(text 而非 KeyEventData),包含速记分派。
- **WYSIWYGMode**:仅保留模块级 caret state + 渲染 / 调度 / patch 应用骨架,所有键事件统一 `if(patch.X) ...` 应用流。
- 工程契约:Patch 增量演进(syncActiveOfsyncActiveBlockId / repositionAfter @ T3.6)未一次到位,避免过度设计。
- 测试:13 个测试文件 / 118 条用例全过;lint 0 错。
- 已知遗留:DRY 重构 shortcuts.ts 7 个触发器仍未抽 helper(延后到 C-04b 之后)。

### 2026-06-11: C-10 渲染增强完成

代码块与任务列表的非键盘渲染交互全部上线:
- **CodeBlock 头部条**:左语言 / 右复制按钮。语言点击 → input,blur/Enter 提交;复制按钮 clipboard 写 inner 内容,1.5s ✓ 反馈。两者均 `e.stopPropagation()` 不冒泡到块级 click。
- **ListBlock 任务行**:`renderItem` helper 检测 `/^(\s*)[-*+]\s+\[([ xX])\]\s+/`,渲染 `<button aria-label>` 含 ☐/☑。toggle 通过 `onContentEdit + fullContent` splice 单行 `[ ]↔[x]` 写回 SSOT。
- **测试基建**:新增 `src/test-setup.ts`(jest-dom matchers + afterEach cleanup),`vitest.config.ts` 加 `setupFiles`;9 条组件单测覆盖复制/语言/任务三组交互。
- **JSX 字符串陷阱**:实施过程发现 `fullContent="```js\n..."` 不处理 `\n` 转义,统一改成表达式形式 `fullContent={'...'}`。
- 工程契约:`BlockRenderer`/`BlockProps` 扩展 `onContentEdit?` + `fullContent?`,Quote 递归向下穿透;WYSIWYG 入口绑 `setContent` + `content`。

### 2026-06-11: C-09 速记折叠完成

7 类触发器全部上线(标题/无序/有序/引用/代码块/任务列表/水平线),21 条单测覆盖 happy path + 边界(前导空格 / blockTypes 守卫)。在 `WYSIWYGMode.handleChar` 入口分派:`text === ' ' && block.type === 'paragraph'` 时调 `tryTrigger`,命中即 `setContent` + 更新模块级 caret + 提前 return,不再把空格写入文本。
- 模块结构:`src/engine/shortcuts.ts` 单文件托管 7 类触发器 + `TRIGGERS[]` 注册表 + `tryTrigger(ctx)` 分派器。
- 顺序:`taskList*` 在 `unorderedList*` 之前,避免 `- [ ]` 被 `- ` 抢匹配。
- 已知限制:patch.newCaret.blockId 是 reparse 前的 id,reparse 后失效;依赖 E3 的 `pointFromCaret` 兜底重定位。
- 待办:DRY 重构(7 个触发器共享 `lines.split → 改 lineIdx → join` 模板),延后到 C-10 之后统一抽 helper。

### 2026-06-10: Harness 重构对齐

研究项目与 harness 后做了一次性对齐（仅 docs，不动代码）：
- `CLAUDE.md`：删除与 design-rules.md 重复的 Hard Constraints 段；File Map 补 `inline.tsx`、`HiddenTextarea.tsx`、`blocks.ts`；新增"Authoritative References"层级表；Bug 速查补 E3/E4 两条。
- `constraints/design-rules.md`：E4 改为"逐行段落模型 + 单 `\n` 分隔"；E5 补 quote child 分支说明；E6 改名 Block Type Dispatch，承认中央枢纽 switch 模式；删除 E7（转 feature_list M-02）；S3 加 WYSIWYGMode 已知例外，指向 C-07 拆分。
- `contracts/stores/editor.md`：明确 cursor/selection/scrollPosition/pendingSourceLine 仅服务 SourceMode/PreviewMode；WYSIWYG 引擎光标走 `caret.ts`。
- `constraints/non-functional.md`：新增 WYSIWYG 输入延迟/抖动指标。
- `feature_list.json`：C-04 拆为 C-04a/b/c/d；新增 C-07（WYSIWYGMode 拆分）、C-08（引擎单测）、M-02（首开剪尾换行）。

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
| 2026-06-10 | Harness 一次性对齐 | 文档与代码漂移：File Map 缺 inline/Hidblocks；E4 的 `\n\n` 与逐行模型矛盾；E6 禁止块类型分派与代码现状冲突；S3 文件大小限制需对 WYSIWYGMode 暂时让步并立 C-07 |
| 2026-06-10 | C-04 拆为 a/b/c/d 四个子任务 | C-04 范围过大、状态难以反映真实进度；段落/标题/引用（a）已完成，列表/代码块（b/d）进行中，表格（c）未开始 |
| 2026-06-10 | 新增 C-07 拆分 WYSIWYGMode | 单文件 650 行，违反 S3；C-04b/c/d 在此之上叠加会进一步膨胀，必须先拆 |
| 2026-06-10 | 新增 C-08 引擎单测 | 当前仅 parser + sync 两个测试；逐行段落模型与块类型分派复杂度上来后，无测试网托底易回归 |
| 2026-06-10 | M-02 取代旧 E7 | 旧 E7 把"待办功能"塞进规则文件不合适；改作 feature_list 条目 |
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
