# Markdown Editor

Windows 原生 Markdown 编辑器，支持预览、WYSIWYG、源码三种编辑模式，内置 AI 辅助编辑。

## 技术栈

| 层 | 选型 |
|---|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 18 + TypeScript 5 |
| 构建 | Vite 6 + Tailwind CSS 4 |
| 状态管理 | Zustand 5 |
| 预览渲染 | react-markdown + remark-gfm + rehype-highlight |
| WYSIWYG | Milkdown |
| 源码编辑 | Monaco Editor |

## 开发环境

- Node.js >= 20
- Rust 1.78+ (需 MinGW-w64，或 Visual Studio Build Tools)
- pnpm

```bash
# 安装依赖
pnpm install

# 启动开发
.\dev.ps1

# 仅前端开发
pnpm dev

# 构建
pnpm tauri build
```

> **注意：** 项目路径不能包含空格（MinGW 工具链限制）。若路径含空格，`dev.ps1` 会自动通过 subst 映射盘符处理。

## 项目结构

```
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   │   ├── common/         # 通用组件 (Welcome, FileDropZone)
│   │   ├── editor/         # 编辑器 (Preview, WYSIWYG, Source)
│   │   └── layout/         # 布局 (AppShell, Toolbar, Sidebar)
│   ├── hooks/              # 自定义 Hooks
│   ├── services/           # Tauri IPC 桥接
│   ├── stores/             # Zustand 状态管理
│   ├── styles/             # 样式
│   └── types/              # TypeScript 类型定义
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── main.rs         # 入口
│   │   ├── lib.rs          # Tauri Builder 配置
│   │   └── commands.rs     # IPC Commands
│   └── Cargo.toml
├── package.json
└── vite.config.ts
```
