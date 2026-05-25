# Markdown 全语法测试

## 文本样式

普通段落。**粗体**、*斜体*、***粗斜体***、~~删除线~~、`行内代码`。

## 标题层级

# h1 一级
## h2 二级
### h3 三级
#### h4 四级
##### h5 五级
###### h6 六级

## 链接

[GitHub](https://github.com) · 自动链接 https://www.example.com

## 图片

![Markdown](https://commonmark.org/help/images/favicon.png)

## 引用块

> 一层引用，可以有任意多行。当你编辑这一段时，textarea 会包含整个引用块的 markdown 源码。
>
> > 嵌套引用 — 点击试试编辑它。
>
> 回到一层。

## 列表

### 无序
- 第一项
- 第二项
  - 嵌套 A
  - 嵌套 B
- 第三项

### 有序
1. 第一步
2. 第二步
   1. 子步骤
   2. 子步骤
3. 第三步

### 任务
- [x] 已完成
- [ ] 待办事项
- [ ] 另一项

## 表格

| 左对齐 | 居中 | 右对齐 |
|:-------|:----:|-------:|
| 单元格 | 数据 | 12345 |
| 长内容 abcdef | 短 | 999 |
| **粗体格** | `代码格` | 普通 |

## 代码块

### JavaScript
```javascript
function fib(n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}
console.log(fib(10));
```

### Python
```python
def greet(name: str) -> str:
    return f"Hello, {name}!"

print(greet("World"))
```

### 纯文本
```
命令行输出示例
$ echo done
```

## HTML 混写

<details>
<summary>点击展开</summary>
折叠内容，内含 **Markdown** 语法。
</details>

<kbd>Ctrl</kbd> + <kbd>S</kbd> 保存

<mark>高亮文本</mark>

## 水平线

上面

---

下面

## 转义与实体

\*不是斜体\*  ·  &copy; 2026  ·  &lt;div&gt;

## 混合场景

> **引用中**包含多种元素：`代码`、[链接](https://example.com)、
> | 表头 |
> |------|
> | 值   |

1. 列表中：
   ```bash
   npm install
   ```
2. 列表中：
   > 嵌套引用
3. 列表中：
   - [ ] 任务在列表中

---

**涵盖**：标题 · 粗体 · 斜体 · 粗斜体 · 删除线 · 行内代码 · 链接 · 图片 · 引用(嵌套) · 无序列表 · 有序列表 · 任务列表 · 表格(对齐) · 代码块 · HTML · 水平线 · 转义 · 实体 · 混合嵌套
