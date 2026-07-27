# 引用块 (Quote Block) 渲染与编辑设计

日期: 2026-05-27 | 分支: feat/text-styling | 聚焦模块: Quote Block

## 1. 目标

完成引用块的渲染和编辑逻辑，行为对齐 Typora。后续在新对话中逐个实现其余模块（列表、任务、表格、代码块），每个模块参照本文档格式。

## 2. 架构决策

### 2.1 引用块是容器块

```
Block.type = 'quote'
Block.children = [Paragraph | List | Table | Code | Quote(嵌套)]
```

- 整个引用是一个 Block，Enter **不拆分**它（与代码块一致）。
- 内部子块（children）各自独立可点击、可聚焦、可编辑。
- 嵌套引用：child 本身又是一个 `Block.type='quote'`，天然递归。

### 2.2 Parser 剥离引用前缀（方案 B）

Parser 的职责：将 remark AST 的子节点转换为 Block 时，剥离每行的 `> ` 前缀。

```ts
// BlockMeta 新增字段
interface BlockMeta {
  // ... 现有字段 ...
  quoteDepth?: number; // 引用嵌套深度，1=一层引用，2=嵌套引用
}
```

- Parser 在 `convertNode('blockquote')` 时，对每个 child 的 markdown 剥离一行 `> ` 前缀。
- `quoteDepth` 存入 child 的 meta，用于 `textToMarkdown` 加回前缀。
- `displayText(block)` 拿到的就是干净文本，无需感知引用。
- `textToMarkdown(text, block)` 根据 `block.meta.quoteDepth` 决定加几层 `> ` 前缀。

### 2.3 引用内的混合内容

如 test.md 中：
```
> **粗体** [链接](url)
> | 表头 |
> |------|
> | 值   |
```

Remark AST 将 `> | 表头 |` 解析为 table 类型的子节点。Parser 当前已有 convertNodes 处理 blockquote.children，但 child markdown 带有 `> ` 前缀。方案 B 改后，子块的 markdown 是干净的表格/列表源码。

## 3. 渲染层设计

### 3.1 QuoteBlock 组件

**弃用**当前 split('\n') + 逐行正则剥离的渲染方式。

**改为**递归渲染 children：

```tsx
function QuoteBlock({ block, onClick, isActive, caretOffset }: BlockProps) {
  return (
    <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 my-1
                          text-zinc-600 dark:text-zinc-400">
      <BlockRenderer
        blocks={block.children ?? []}
        onBlockClick={onClick}
        activeBlockId={activeBlockId}
        activeOffset={activeOffset}
      />
    </blockquote>
  );
}
```

- `BlockRenderer` 递归渲染子块。子段落用 `ParagraphBlock`，子列表用 `ListBlock`，子引用用 `QuoteBlock`（嵌套）。
- 每个子块保留 `data-block-id`，可独立点击聚焦。
- 嵌套引用视觉：外层 `<blockquote>` 包裹内层 `<blockquote>`，左侧多层边框自然呈现。

### 3.2 嵌套引用视觉

```
┃ 一层引用
┃ ┃ 嵌套引用（二层）
┃ ┃ 继续二层
┃ 回到一层
```

CSS 通过 `.border-l-4` 叠加实现，无需额外代码。

## 4. 编辑层设计

### 4.1 displayText / textToMarkdown

子块本身是 paragraph/list/table 等普通类型，`displayText` 和 `textToMarkdown` **不需要修改**。

因为 parser 已经剥离了 `> ` 前缀，子块的 markdown 是干净的，现有的 `displayText`/`textToMarkdown` 逻辑直接适用。

唯一需要的是：当 `textToMarkdown` 产生的 markdown 写回整个 quote 块时，需要按 `quoteDepth` 给每行加回 `> ` 前缀。这个逻辑放在 **WYSIWYGMode 的 quote 分支**中，不侵入子块的函数。

### 4.2 Enter 键

引用块内的光标永远在某个子块内。Enter 行为由**当前子块类型**决定，WYSIWYGMode 的 handleKeyDown 已有各类型的 Enter 逻辑。

**新增逻辑 - 引用 Exit 检测：**

在 handleKeyDown 的 Enter 分支中，增加后置检测：

```
// 伪代码
if (当前块所在引用 && 当前子块 displayText 为空) {
  // 在引用内空子块按 Enter → 退出引用（或退出一层嵌套）
  找到包含该子块的 quote 祖先
  在 content 中将该空的子块行替换为普通段落
  re-parse → caret 移到新段落
}
```

具体实现分两种情况：

| 场景 | 当前状态 | Enter 行为 |
|------|----------|------------|
| 引用内非空段落 | `> text\|` | 在当前段落后创建新的空段落子块（保留在引用内） |
| 引用内空段落（唯一子块） | `> \|`（无其他子块） | **完全退出**：整个引用块替换为普通空段落 |
| 引用内空段落（多个子块） | `> para1` / `> \|` / `> para2` | **该行退出引用**：空行 `> ` 变为无前缀空行，引用块在此处断为两截。具体：上方内容保留为一个引用块，下方内容变回普通段落（或新引用块，参考 Typora 实测决定） |
| 嵌套引用内空段落 | `> > \|` | **退出一层**：`> > ` → `> `（回到一层引用），该行保留在引用内 |
| 引用内空段落（在开头） | `> \|` / `> text` | 删除空行，下方内容保留在引用内 |

### 4.3 Backspace 键

| 场景 | 行为 |
|------|------|
| 引用内子块有内容，offset>0 | 正常删除字符 |
| 引用内子块 offset=0 且非空 | 尝试与前一子块合并（当前 Backspace 已有合并逻辑） |
| 引用内子块 offset=0 且为空 | 删除该空子块。若引用无子块则退出引用（替换为普通段落） |
| 引用内子块 offset=0 且为首个子块 | 去掉该行的 `> ` 前缀（在 markdown 层面删除 `> `）→ 该子块退出引用变为普通段落 |

### 4.4 方向键

| 操作 | 行为 |
|------|------|
| ← 在子块 offset=0 | 跳转到前一个子块的末尾 |
| → 在子块 offset=max | 跳转到后一个子块的开头 |
| ↑ 在子块第一行 | 跳转到上一个子块，保持列位置 |
| ↓ 在子块最后一行 | 跳转到下一个子块，保持列位置 |

这需要在 handleKeyDown 的方向键分支中感知子块边界。当前 ↑/↓ 是块级别跳转，需要改为感知"父容器内的兄弟子块"。

### 4.5 点击聚焦

- 点击 `<blockquote>` 的子块 → `handleBlockClick` → 通过 `data-block-id` 获取子块 id
- `segFromPoint` 定位子块内的 inline segment 和 offset
- `caretBlockId` = 子块 id（不是 quote 容器 id）

## 5. 数据流

```
用户输入字符
  ↓
HiddenTextarea.onChar(text)
  ↓
caretBlockId → findBlock → 子块（如 paragraph-12）
  ↓
displayText(子块) → 干净文本（parser 已剥离 > 前缀）
  ↓
字符插入、光标偏移
  ↓
textToMarkdown(新文本, 子块) → 干净 markdown（子块类型决定格式，如列表加 - ）
  ↓
按 quoteDepth 给每行加回 > 前缀 → 得到该子块的源 markdown
  ↓
syncBlockEdit(content, 子块.sourceStartLine, 子块.sourceEndLine, 带前缀的新markdown)
  ↓  （只替换该子块在原内容中对应的行，不影响引用块的其他行）
setContent → re-parse → BlockRenderer 重渲染（含 QuoteBlock 递归）
  ↓
reposition textarea
```

**关键点：**
- 子块的 `sourceStartLine`/`sourceEndLine` 指向原内容中的行号（parser 剥离前缀不改行号）
- 每个子块独立 sync：修改一个子块只替换其对应的源行，不需重建整个引用块
- 引用前缀的加减在 WYSIWYGMode 层处理，不侵入子块自身的 displayText/textToMarkdown

## 6. 影响的文件

| 文件 | 改动 |
|------|------|
| `src/engine/types.ts` | BlockMeta 新增 `quoteDepth?: number` |
| `src/engine/parser.ts` | convertNode('blockquote') 剥离子块 markdown 的 `> ` 前缀，设置 quoteDepth |
| `src/engine/renderer.tsx` | QuoteBlock 重写为 children 递归渲染 |
| `src/components/editor/WYSIWYGMode.tsx` | Enter/Backspace/方向键 新增引用块感知逻辑；displayText/textToMarkdown 新增 quote 类型分支（按 quoteDepth 加/去前缀） |
| `src/engine/sync.ts` | 无需改动（line-precise 替换不变） |
| `src/engine/caret.ts` | 可能需要适配子块内的 caret 定位 |

## 7. 验收检查

- [ ] 单层引用 `> text` 正确渲染（左竖线 + 缩进 + 灰色文字）
- [ ] 嵌套引用 `> > text` 正确渲染（双层竖线 + 更深缩进）
- [ ] 引用内段落可点击聚焦编辑
- [ ] 引用内粗体/斜体/链接/代码等内联格式正确渲染
- [ ] 引用内列表 `> - item` 正确渲染为 ul/ol
- [ ] 引用内表格正确渲染
- [ ] Enter 在引用非空行：保留在引用内，创建新空行
- [ ] Enter 在引用空行：退出引用（或退出一层嵌套）
- [ ] Backspace 在空行：删除空行
- [ ] ←/→ 在子块边界正确跨子块
- [ ] ↑/↓ 正确跨子块
- [ ] `pnpm lint` 通过

## 8. 交接说明

本文档作为 `feat/text-styling` 分支上**引用块**模块的权威设计。后续开发者应当：

1. 阅读本文档理解架构决策（方案 B：Parser 剥离前缀）
2. 阅读 `test.md` 中 ## 引用块 部分了解目标行为
3. 阅读现有 parser/renderer/WYSIWYG 代码了解实现上下文
4. 按第 7 节验收检查逐项验证
5. 实现完成后将此文档的 checkboxes 勾选，提交 commit
