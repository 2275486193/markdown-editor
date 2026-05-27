# 光标追踪与对齐 — 设计文档

日期：2026-05-27 | 分支：feat/text-styling

## 目标

1. 可见光标闪烁指示器 — 在活跃 block 内渲染闪烁竖线
2. 字体自适应对齐 — 光标高度匹配不同 block 类型的实际行高（h1/paragraph/quote/list/code）
3. 内联标记偏移处理 — 进入/离开 inline 格式区段时，标记（`*`/`**`/`~`等）出现/消失，光标视觉位置跟随
4. HiddenTextarea 精确定位 — textarea 始终覆盖在光标元素上方

## 架构

```
InlineEditable (渲染层)
  → 在活跃 segment 的 raw 文本中插入 <span data-caret="true" />
  → 自然继承该 block 的 font-size / line-height / vertical-align

WYSIWYGMode.reposition (定位层)
  → 优先查 DOM 中 [data-caret] 元素 → getBoundingClientRect()
  → 用 rect 的 x, y, height 设置 HiddenTextarea 的 fixed 坐标
  → 回退：pointFromCaret（Range API，用于 code block 等无 caret 场景）

HiddenTextarea (输入层)
  → 覆盖在 caret 元素上方，接收键盘输入
  → height 匹配 caret 元素的 rect.height
```

所有坐标追踪仍用源坐标 `{blockId, offset}`，`caret.ts` 中的 `segFromPoint` / `pointFromCaret` 逻辑不变。

## 详细设计

### 1. Caret 元素渲染 (inline.tsx)

修改 `InlineEditable`：当 `isActive` 为 true 时，找到活跃区段，将区段的 raw 文本在 cursor 偏移处拆分，插入 `<span data-caret="true" />`。

渲染逻辑：
- 遍历 segments，找到包含 `offset` 的活跃区段（即 `activeIndices` 中的成员）
- 对于活跃区段：`rawText = segToMarkdown(seg)`，`localOffset = offset - segmentStart`
- 拆分 raw 文本为 `before_cursor + after_cursor`
- 渲染：`{before_cursor}<span data-caret="true" class="caret-blink" />{after_cursor}`
- 对于非活跃区段：正常 renderSeg

Caret 样式 (Tailwind)：
```
inline-block w-0 border-l-2 border-current h-[1em] align-text-bottom
```

CSS 闪烁动画（添加到全局 CSS 或 Tailwind config）：
```css
@keyframes caret-blink {
  0%, 100% { border-color: currentColor; }
  50% { border-color: transparent; }
}
.caret-blink { animation: caret-blink 1s step-end infinite; }
```

### 2. reposition 双路径定位 (WYSIWYGMode.tsx)

```
reposition():
  1. 查找 [data-caret="true"] → getBoundingClientRect()
     有 → left=rect.x, top=rect.y, height=rect.height
  2. 无 → pointFromCaret(caretBlockId, caretOffset)
     有 → left=rect.x, top=rect.y, height=16 (默认)
  3. setTaPos({x, y})
  4. setTaVisible(true)
```

### 3. HiddenTextarea 动态高度

Props 增加 `height: number`，替换写死的 `1em`：
```
style={{ ..., height, ... }}
```

### 4. 内联标记偏移机制

Caret 位于 `data-seg-raw="1"` 区段的 raw 文本内部，标记展开/收缩时：
- 进入格式化区段：标记出现 → 文本向右移 → caret 跟随 raw 文本中的标记
- 离开格式化区段：标记消失 → 文本向左缩 → caret 在新位置渲染
- 边界处理：已有的 `activeIndices` 边界逻辑（inline.tsx L203-228）无需改动，caret 利用现有 active set

### 5. 回退路径

- Code block：无 InlineEditable，无 caret 元素 → `pointFromCaret` 定位
- HR / 非文本 block：无 caret → 回退到 block 左上角

## 修改文件

| 文件 | 改动 |
|------|------|
| `src/engine/inline.tsx` | InlineEditable: 在活跃区段中拆分 raw 文本，插入 caret 元素；添加 CSS 动画 |
| `src/components/editor/WYSIWYGMode.tsx` | reposition: 优先用 [data-caret] 定位；传递 height 给 HiddenTextarea |
| `src/components/editor/HiddenTextarea.tsx` | 新增 `height` prop，替换固定值 |

## 不变项

- `caret.ts` — `segFromPoint`、`pointFromCaret`、`caretFromPoint` 签名和行为不变
- `editorStore` / `blocksStore` — 数据流不变
- `BlockRenderer` / 各 block 组件 — 接口不变
- `sync.ts` / `parser.ts` — 不变
- 键盘处理逻辑 — Enter/Backspace/Delete/Arrow 逻辑不变
