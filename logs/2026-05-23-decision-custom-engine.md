# Decision: 自研编辑器引擎架构

- **日期**: 2026-05-23
- **决策**: 自研基于 remark + contentEditable 的块级编辑器引擎，替代 ByteMD (T-05)
- **原因**:
  1. ByteMD/Milkdown/Vditor 均为第三方 WYSIWYG 编辑器，无法满足块级动态编辑的精确控制需求
  2. 自研引擎可充分利用现有 remark 依赖，与编辑器 Store 架构深度耦合
  3. contentEditable 方案在 Typora 等产品中验证可行
  4. 单块编辑 + React.memo 可控制渲染性能
- **影响范围**: 
  - `src/engine/` 目录 (6 模块)
  - `blocksStore` (新 Zustand store)
  - `EditorMode` 扩展 `wysiwyg`
  - AppShell 三模式条件渲染
  - 未来可移除 milkdown/vditor 等未使用的 WYSIWYG 依赖
- **替代方案考虑**:
  - Milkdown/ProseMirror: 太重，API 复杂，与现有 Zustand 架构集成成本高
  - 继续 ByteMD: 不支持块级编辑模式，只是完整文档的富文本编辑器
- **关键技术点**:
  - remark MDAST → Block[] 转换 (parser.ts)
  - 行号映射回写 (sync.ts)
  - React.memo 防非活跃块重渲染 (E5)
  - 光标字符偏移保存/恢复 (E4)
  - IME composition 保护 (E3)
