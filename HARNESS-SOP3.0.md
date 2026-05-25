# Harness 工程方法论 — 标准作业程序 (SOP) v3.0

> 基于第一性原理，将"让 AI 完成一个功能"拆解为一组边界清晰、彼此隔离、可独立维护的职责：身份、上下文、任务、标准、输出格式、验证、记忆。
>
> 适用场景：新项目启动、旧项目规范化改造、AI 辅助开发的项目治理。
>
> 架构假设：**单 Agent**（同一时刻只有一个 Agent 执行任务）。以「人-Agent 协作闭环」为基本工作单元。

---

## 一、核心原则

### 原则 1：仓库即记录系统

> 不在仓库里的东西，对智能体不存在。

- 所有信息必须以**文件形式**存在于仓库中
- 外部链接、口述约定、记忆均视为不可靠
- 决策必须留下记录（`logs/`），否则 3 天后当没发生过
- 效果：Agent 拿到一个干净仓库即可独立工作，无需依赖外部上下文

### 原则 2：地图而非手册

> `CLAUDE.md` 是目录页，不是百科全书。

- 入口文件保持简洁（< 120 行），仅做**导航**
- 详细内容分散在各层文件中，通过路径引用连接
- 入口文件回答"这是什么项目 / 现在该做什么"，不展开细节
- **压缩策略**：当 CLAUDE.md 超限时，优先移出「列举型信息」（完整文件清单），保留「决策型信息」（核心约束、技术栈锁）
- 效果：Agent 在任何时刻都能快速定位目标文件，不被过载信息淹没

### 原则 3：机械化执行

> 文档会腐烂，规则不会。自动化检查比人工检查可靠。

- 约束文件中的每条规则必须**可检查**（有明确的是/否判定标准）
- 性能、体积、行数等目标必须**有数值**
- 不能用模糊词汇："尽量"、"尽可能"、"建议"
- **每条规则必须绑定自动化检查方式**（ESLint 规则、dependency-cruiser、TypeScript 编译器选项、测试用例），仅当自动化不可行时方可标注「手工检查」并写明原因
- 效果：每次 Code Review 可以对着约束文件逐条打勾，大部分检查由机器完成

### 原则 4：智能体可读性优先

> 为 Agent 的推理能力优化，而非人类的浏览体验。

- 选择成熟、稳定、Agent 训练数据中高频出现的技术栈
- 文件使用嵌套标题结构，Agent 可以通过标题层级快速定位
- 接口定义使用**项目主语言的类型系统**表达（TS 项目用 TS，Rust 项目用 struct/enum，Python 项目用 typing/Protocol）
- 避免表格嵌套、避免缩写、避免只在图表中表达关键信息
- 效果：Agent 的推理准确度、响应速度显著提升

### 原则 5：吞吐量改变合并理念

> 纠错成本低，等待成本高。

- 快速推进，出错后纠正——而不是花大量时间前置论证
- 单个任务粒度控制在 1-3 小时的编码量
- Agent 的 AI 编辑也遵循此原则：单轮指令 → Diff 确认 → 接受或重试
- 效果：开发吞吐量提升，避免"分析瘫痪"

### 原则 6：自动化测试是最后防线

> 在高吞吐的 Agentic 工作流中，自动化测试是唯一阻止回归的安全网。

- 编写业务代码前必须先写单元测试（TDD）
- 每个功能完成后必须执行 `npm test`（或等价命令），全部通过后方可标记 completed
- 关键路径必须有集成测试覆盖
- 效果：Agent 的快速迭代不会以破坏已有功能为代价

### 原则 7：熵管理 = 垃圾回收

> 技术债是高息贷款。定期重构、删除废弃代码和过时文档。

- **每次完成一个功能**后检查：是否有代码可以删除？是否有文档已过时？
- 禁止注释掉的代码（`// old implementation`）——发现即删除
- 禁止 `// TODO` 注释——转为 `feature_list.json` 条目
- 文件超过行数阈值（组件 300 行、Hook 150 行）强制拆分
- 效果：代码库熵值不累积，长期维护成本可控

### 原则 8：边界聚焦（需求不确定时主动收敛）

> 模糊的需求是最昂贵的浪费。Agent 在信息不足时必须主动提问，绝不能猜测后直接编码。

- 当用户需求缺少以下任一要素时，Agent **必须**暂停并提问：
  - **做什么**：功能的具体行为边界（正常路径 + 边界条件 + 错误路径）
  - **给谁用**：目标使用者（最终用户 / 其他模块 / 外部系统）
  - **怎么验证**：完成的判定标准（什么情况下算"做完"）
  - **不做什么**：明确排除的范围（比"做什么"同等重要）
- Agent 的提问必须是**选择题或多选题**，而非开放式问题——开放式问题把分析负担推回给用户
- 每轮澄清后，Agent 应将结论**写入 `specs/` 或 `feature_list.json` 的 acceptance 字段**，固化下来
- 效果：需求边界逐轮收窄，每次编码都聚焦在确定的目标上

---

## 二、层次架构总览

```
项目根目录/
│
├── CLAUDE.md              ← L0: Agent 入口导航（地图 + 压缩层）
│
├── feature_list.json       ← L1: 功能清单与状态机
├── logs/                   ← L1: 增量日志（每次任务一个文件）
│   ├── INDEX.md            ←     日志索引（Agent 检索入口）
│   ├── YYYY-MM-DD-F01-init.md
│   ├── YYYY-MM-DD-F02-editor.md
│   └── YYYY-MM-DD-decision-<slug>.md
│
├── specs/                  ← L2: 规格约束层 (What — 做什么 + 不做什么)
│   └── modules/
│       ├── <module-a>.md
│       └── <module-b>.md
│
├── constraints/            ← L2: 边界约束层 (Limits — 通用规则)
│   ├── design-rules.md
│   ├── non-functional.md
│   └── testing-protocol.md
│
├── contracts/              ← L3: 接口契约层 (How — 类型边界)
│   ├── ipc/
│   │   └── commands.md
│   ├── stores/
│   │   ├── <store-a>.md
│   │   └── <store-b>.md
│   └── components/         ← 可选
│       └── <component>.md
│
├── init.ps1                ← L4: 执行工具层（首次环境初始化）
│   或 init.sh
├── verify.ps1              ← L4: 持续校验工具（每次任务完成前执行）
│   或 verify.sh
│
├── docs/                   ← L5: 文档参考层（人类阅读，Agent 条件参考）
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   └── HARNESS-SOP.md      ← 本文件
│
└── schemas/                ← 可选：JSON Schema 定义
    └── feature_list.schema.json
```

### 第一性原理维度映射

```
┌──────────────────────┬──────────────────────────────────────┐
│ 第一性原理维度         │ Harness 分层                          │
├──────────────────────┼──────────────────────────────────────┤
│ 身份 (Identity)       │ L0 CLAUDE.md  项目定义 + 技术栈锁定   │
│ 上下文 (Context)      │ L0 CLAUDE.md  文件地图 + 核心约束     │
│                       │ L5 docs/      PRD + 架构文档         │
│ 任务状态 (Task)       │ L1 feature_list.json  状态机 + 依赖  │
│ 记忆 (Memory)         │ L1 logs/      增量日志 + INDEX.md    │
│ 成功标准 (Criteria)   │ L2 specs/     行为规格               │
│                       │ L2 constraints/  设计规则 + 门禁     │
│                       │ L1 feature_list.json  acceptance 字段│
│ 输出格式 (Output)     │ L3 contracts/ 类型签名 = 输出协议     │
│ 验证 (Verification)   │ L4 verify.ps1  自动化门禁            │
│                       │ L4 init.ps1    pre-commit hook      │
│ 安全边界 (Guardrails) │ L2 constraints/  禁止模式 + 规则     │
│ 压缩 (Compression)    │ L0 CLAUDE.md  < 120 行 + 压缩策略    │
└──────────────────────┴──────────────────────────────────────┘
```

### 层次关系

```
┌──────────┐
│  L0 入口  │  CLAUDE.md
│  导航层   │  技术栈锁定 · 文件地图 · 执行规则
└─────┬────┘
      │ 导航到
      ▼
┌──────────┐
│  L1 工程  │  feature_list.json    logs/
│  编排层   │  任务状态 · 依赖拓扑    增量日志 · INDEX.md
└─────┬────┘
      │ 定位任务
      ▼
┌──────────┐
│  L2 规格  │  specs/modules/       constraints/
│  约束层   │  行为规格(What)        边界规则(Limits) · 测试协议
└─────┬────┘
      │ 指导实现
      ▼
┌──────────┐
│  L3 接口  │  contracts/
│  契约层   │  IPC签名 · Store签名 · 组件Props签名
└─────┬────┘
      │ 类型落地
      ▼
┌──────────┐
│  源代码   │  src/  ·  src-tauri/
│          │  受 L2+L3 约束，按 L1 任务推进
└──────────┘

辅助层:
  L4 执行工具: init.ps1 (首次环境初始化) · verify.ps1 (每次完成任务前校验)
  L5 文档参考: docs/ (PRD · 架构 · SOP — 人类阅读，Agent 条件参考)
```

---

## 三、各层详细定义

---

### L0 — 入口导航层

#### CLAUDE.md

**定位**：Agent 对话的入口文件。Agent 在每次新对话中首先读取此文件。同时承担**压缩层**职责——所有信息的入口而非存放地。

**规模限制**：< 120 行。

**必须包含的节**：

```markdown
# <项目名> — Agent Harness

## 项目定义
一句话描述项目是什么。

## 技术栈 (锁定)
| 层 | 选型 | 版本 | 禁止替代 |
表格形式，列出所有核心技术选型。

## 文件地图
树形结构，列出所有关键文件路径及其一句话职责。
（超过 15 个文件时，只列一级目录 + 关键文件，其余通过 grep 发现）

## 核心约束
3-5 条最重要的架构约束。不够写则导航到 constraints/。

## 开发流程
步骤 1-10，描述 Agent 接到任务后的执行顺序。

## 执行规则
Agent 必须遵守的行为规则（何时读什么文件、何时更新状态、何时必须暂停提问）。
```

**压缩策略**（当接近行数上限时）：
1. **优先移出**：完整文件清单 → 只留一级目录 + 3 个关键文件路径；详细执行规则 → 注明"见 HARNESS-SOP.md 第 X 节"
2. **必须保留**：项目定义（1 行）、技术栈锁（表格）、核心约束（3-5 条）、文件地图的最小版本
3. **判断标准**：如果删除某行后 Agent 仍能通过文件地图找到它 → 可以删除；如果删除后 Agent 不会再知道这件事 → 必须保留

**编写原则**：
- 不写细节，只写**在哪能找到细节**
- 技术栈表必须标注"禁止替代"，防止 Agent 自行替换
- 文件地图中每个路径后附一句话职责
- 执行规则用**必须/禁止**，不用"建议"

---

### L1 — 工程编排层

#### feature_list.json

**定位**：机器可读的功能清单。Agent 通过查询此文件决定"下一个做什么"，以及"当前任务做完的标准是什么"。

**必须字段**：

```json
{
  "$schema": "...",
  "version": "0.1.0",
  "features": [
    {
      "id": "F-01",
      "name": "功能名称",
      "description": "一句话描述",
      "status": "pending",
      "priority": "P0",
      "version": "0.1",
      "spec": "specs/modules/<module>.md",
      "dependsOn": [],
      "acceptance": {
        "files": ["src/..."],
        "tests": ["src/.../_tests_/..."],
        "checklist": [
          "用户点击 X 后 Y 发生",
          "边界条件 Z 时显示错误提示",
          "不包含 W 行为"
        ]
      }
    }
  ],
  "clarifyLog": {
    "F-01": [
      {
        "date": "YYYY-MM-DD",
        "question": "Agent 提出的问题",
        "answer": "用户的选择",
        "impact": "写入 spec 的哪些字段"
      }
    ]
  },
  "statuses": {
    "pending":     { "label": "待开始",  "icon": "○" },
    "in_progress": { "label": "进行中",  "icon": "◉" },
    "completed":   { "label": "已完成",  "icon": "●" },
    "blocked":     { "label": "阻塞",    "icon": "⊘" },
    "cancelled":   { "label": "已取消",  "icon": "✕" }
  },
  "versions": {
    "0.1": { "label": "版本名称", "target": "版本目标描述" }
  }
}
```

**`acceptance` 字段说明**（任务级验收标准）：
- `files`：本次任务预计创建/修改的源文件列表（防止 Agent 扩散修改范围）
- `tests`：本次任务预计创建/修改的测试文件列表
- `checklist`：人可读的验收条目，每条回答"做完后观察什么现象可以判断成功"，以及"什么行为绝对不能出现"

**状态机**：

```
pending ──→ in_progress ──→ completed
  │              │
  └── cancelled  └── blocked ──→ in_progress (解除阻塞后)
                     │
                     ↑
              (如 verify.ps1 连续失败 3 次，自动标记 blocked，附失败摘要)
```

**编写原则**：
- 功能 ID 按模块分组（F-xx 文件、E-xx 编辑、A-xx AI、R-xx 阅读）
- `dependsOn` 定义任务执行顺序（单 Agent 环境下：先做 A 再做 B），必须准确
- 每个功能必须指向一个 `spec` 文件
- **`acceptance` 字段在任务从 pending 移入 in_progress 时必须已填写**。若用户原始需求中缺失，Agent 必须在标记 in_progress 之前通过澄清流程补全
- 版本拆分原则：每个版本应可独立交付

**Agent 使用方式**：

```
1. 读取 feature_list.json
2. 筛选 status=pending 且 dependsOn 全部满足
3. 同版本内按优先级排序（P0 > P1 > P2），同优先级按 ID 排序
4. 检查选中任务的 acceptance 字段是否完整：
   a. 完整 → 标记 in_progress，开始执行
   b. 不完整 → 暂停，执行「Agent 主动澄清协议」（见第五章）
5. 完成后：运行 verify.ps1 → 全部通过 → 标记 completed
```

#### logs/ 目录

**定位**：增量日志系统。每次任务完成后写入一个独立文件。

**目录结构**：

```
logs/
├── INDEX.md                              ← 日志索引（Agent 检索入口）
├── YYYY-MM-DD-F01-init-project.md        ← 任务日志
├── YYYY-MM-DD-F02-add-editor.md
├── YYYY-MM-DD-decision-rust-2024.md      ← 决策日志
├── YYYY-MM-DD-merge-v0.1.0.md            ← 合入日志
└── README.md
```

**日志检索策略**（让 Agent 不必全量读取所有文件）：

| 记忆热度 | 时间范围 | Agent 行为 |
|---------|---------|-----------|
| 热记忆 | 最近 3 天 | 全文读取对应日期的日志文件 |
| 温记忆 | 3-14 天 | 先读 `INDEX.md` 按关键词定位，再读取匹配的文件 |
| 冷记忆 | 14 天以前 | 仅在决策追溯时通过 `grep -l "<关键词>" logs/` 查找 |

**INDEX.md 格式**：

```markdown
# Logs Index

## 最近 7 天
| 日期 | 任务 | 文件 | 关键词 |
|------|------|------|--------|
| YYYY-MM-DD | F-03: 添加编辑器 | logs/YYYY-MM-DD-F03-editor.md | editor, store, tauri-command |

## 决策索引
| 日期 | Slug | 关键词 |
|------|------|--------|
| YYYY-MM-DD | rust-2024-edition | rust, edition, migrate |
```

**日志文件命名规则**：
- 任务日志: `YYYY-MM-DD-<task-id>.md`
- 决策日志: `YYYY-MM-DD-decision-<slug>.md`
- 合入日志: `YYYY-MM-DD-merge-<version>.md`

**每个日志文件必须包含的节**：

```markdown
# <task-id>: <summary>

- **日期**: YYYY-MM-DD
- **关联任务**: <task-id>（决策日志不强制）
- **产出**: <变更的文件列表或决策结论>
- **验收**: <acceptance checklist 逐条确认结果>
- **耗时**: <小时数（可选）>
- **备注**: <阻塞项、注意事项、遗留问题>
```

**编写原则**：
- 每个任务完成后**立即**写入独立日志文件，不可批量补录
- 决策记录写"为什么"，不写"是什么"（是什么在 specs/ 里）
- 每次写入日志后更新 `INDEX.md`
- Agent 读取历史时优先走 INDEX.md → 按需读取具体文件，禁止全量扫描

---

### L2 — 规格约束层 (What)

#### specs/modules/<module>.md

**定位**：单个模块的行为规格。定义状态、转移、边界。不涉及实现细节。**这是 Agent 实现前必读的"要做成什么样"的完整定义。**

**必须包含的节**：

```markdown
# <模块名> Module Specification

## 模块职责
一句话描述本模块的存在理由。

## 使用者
| 使用者 | 类型 | 使用场景 |
|--------|------|---------|
| <组件名 / 模块名 / 最终用户> | <UI组件 / Store / API消费者 / 人类> | <什么情况下调用本模块> |

## 状态定义
列出所有状态变量及其类型和含义。使用项目主语言的类型系统表达。

## 操作定义
| 操作 | 触发者 | 入参 | 出参 | 副作用 | 前置条件 |
|------|--------|------|------|--------|---------|

## 状态转移
描述状态之间的合法转移路径，附带条件。

## 范围边界
| 范围内（本模块做） | 范围外（本模块不做，由谁负责） |
|------------------|---------------------------|
| 处理 X 的校验逻辑  | 持久化 X → Store Y 负责    |

## 约束
| 约束项 | 值 | 检查方式 |
|--------|-----|---------|

## 错误处理
| 场景 | 行为 |
|------|------|

## 依赖
| 依赖项 | 类型 | 用途 |
|--------|------|------|
```

**编写原则**：
- 用项目主语言的类型系统描述状态结构
- **状态转移要覆盖所有合法路径和边界条件**
- 约束必须是可验证的（有数值或有明确判断标准）
- 「使用者」节是本模块契约的消费者，确保实现时知道"谁在用我，他们对我的期望是什么"
- 「范围边界」节是防止 Agent 过度实现的关键——明确"不做什么"和"做什么"同等重要
- 不写实现方式（用什么库、怎么调用）——那些在 contracts/ 里

#### constraints/design-rules.md

**定位**：编码规则，可作为 Code Review 检查清单。**每条规则必须指明其自动化检查方式。**

**必须包含的节**：

```markdown
# Design Rules

## 架构规则
### A1. <规则名>
- **规则**: <必须/禁止的具体行为>
- **原因**: <一句话>
- **检查方式**: <ESLint 规则名 / dependency-cruiser 规则 / tsc 选项 / 手工检查（附原因）>

## 组件规则
### C1. <规则名>
- **规则**: ...
- **检查方式**: ...

## <领域>规则
### D1. <规则名>
- **规则**: ...
- **检查方式**: ...

## 编码风格
### S1. <规则名>
- **规则**: ...
- **检查方式**: ...
```

**自动化检查速查表**：

| 规则类型 | 工具 | 示例 |
|---------|------|------|
| 禁止特定 import | ESLint no-restricted-imports | `"patterns": ["lodash"]` |
| 模块依赖方向 | dependency-cruiser | `depcruise --config .depcruiser.js src` |
| 文件大小限制 | ESLint max-lines | `"max-lines": ["warn", { "max": 300 }]` |
| 类型安全约束 | TypeScript strict mode | `"strict": true` |
| 禁止 TODO | ESLint no-warning-comments | `"terms": ["todo", "fixme"]` |

#### constraints/testing-protocol.md

**定位**：自动化测试的强制性协议。

```markdown
# Testing Protocol

## 测试层级

| 层级 | 框架 | 强制 | 覆盖率目标 |
|------|------|------|----------|
| 单元测试 | <Vitest/Jest> | 是 | ≥ 80% |
| 集成测试 | <Playwright/Cypress> | 是 | 核心路径覆盖 |
| E2E 测试 | <Playwright> | 条件 | 核心业务流程 |

## TDD 流程

1. **红**: 先写测试，确认失败
2. **绿**: 最小实现使测试通过
3. **重构**: 优化代码结构，测试仍通过

## 门禁

- `npm test` 全部通过后方可标记任务 completed
- 新增模块必须包含单元测试
- 修改业务逻辑必须更新对应测试
```

#### constraints/non-functional.md

**定位**：非功能需求门禁。版本发布前逐项检查。

**必须包含的节**：

```markdown
# Non-Functional Requirements

## 性能门禁
| 指标 | 目标 | 测量方式 |

## 安装包约束
| 指标 | 目标 |

## 兼容性
| 系统 | 版本 | 架构 |

## 可靠性
| 场景 | 行为 |

## 安全性
| 要求 | 实现 |

## 可维护性
| 指标 | 目标 |
```

---

### L3 — 接口契约层 (How)

#### contracts/

**定位**：定义模块间的精确类型边界。**这是 Agent 写代码时必须遵循的输出格式协议**——相当于 Aider 的 diff/patch 协议，规定代码输出必须符合的形状。

| 子目录 | 适用场景 | 内容 |
|--------|---------|------|
| `ipc/commands.md` | 前后端通信（Tauri/Electron/任意 IPC） | 后端签名 + 前端调用签名 + 错误契约，使用各自语言的原生类型语法 |
| `stores/<store>.md` | 状态管理（Zustand/Pinia/Redux） | Store 类型签名 + Action 行为契约 + 依赖关系 |
| `components/<component>.md` | 跨模块共享组件 | 可选，仅当 Props 类型复杂或被 3+ 模块使用时创建 |

**Store 契约格式**：

```markdown
# <Store> Store Contract

## Store 类型签名
```<类型语言>
interface <Name>Store {
  // State
  // Actions
  // Derived
}
```

## 行为契约
### <action_name>
- 触发条件
- 副作用
- 依赖的 Store

## 依赖关系
| 本 Store 被谁使用 | 使用场景 |
|-----------------|---------|
```

---

### L4 — 执行工具层

#### init.ps1 / init.sh

**定位**：首次环境初始化。新环境第一次运行时执行。

**功能**：
1. 环境检查（Node/Rust/WebView2 等版本检测）
2. 依赖安装（`pnpm install`）
3. 约束文件完整性校验（检查 L0-L3 所有文件是否存在）
4. 安装 Git hooks（pre-commit）

#### verify.ps1 / verify.sh

**定位**：持续校验脚本。Agent 在**每次任务宣称 completed 之前**必须执行并通过。

**功能**：
1. 运行 `npm run lint`（零警告零错误）
2. 运行 `npm test`（全部通过）
3. 运行 `npm run typecheck`（`tsc --noEmit` 通过）
4. 校验 `feature_list.json` 格式有效
5. 检查约束文件完整性（新增文件是否在 CLAUDE.md 文件地图中注册）
6. 检查禁止模式（`// TODO`、注释掉的代码、`.only` 测试）
7. 检查 `logs/INDEX.md` 是否包含本次任务的日志条目

**退出码**：
- `0`：所有检查通过，Agent 可以标记 completed
- 非 `0`：存在问题，Agent 必须修复后重新执行
- **连续 3 次失败**：Agent 必须将任务标记为 blocked，在日志中记录阻塞原因，通知用户介入

#### pre-commit hook

**定位**：在 `init.ps1` 中自动安装到 `.git/hooks/pre-commit`。

**检查项目**：
- `npm run lint` 通过
- `tsc --noEmit` 通过
- `feature_list.json` 格式有效

---

### L5 — 文档参考层

**定位**：人类阅读的文档。Agent 在执行涉及"为什么这样做"的决策时，条件参考 L5。

| 文件 | 内容 | Agent 何时读取 |
|------|------|--------------|
| `docs/PRD.md` | 产品需求文档：用户视角的功能描述、UI 布局、版本规划 | 首次进入项目 / 需要理解产品意图时 |
| `docs/ARCHITECTURE.md` | 技术架构：选型论证、架构图、模块划分、依赖清单 | 做架构决策 / 需要理解模块关系时 |
| `docs/HARNESS-SOP.md` | 本文件：Harness 方法论说明 | 需要理解约束体系本身时 |

---

## 四、Agent 主动澄清协议

> 本章是原则 8（边界聚焦）的操作化实现。Agent 必须在需求模糊时遵循此协议，不可跳过。

### 4.1 触发条件

Agent 在以下任一条件为真时，**必须暂停执行并启动澄清流程**：

| 缺失要素 | 判断方法 | 示例 |
|---------|---------|------|
| **行为边界不清** | spec 文件的「范围边界」节为空，或只有"做什么"没有"不做什么" | "添加文件导出功能"——导出什么格式？导出到哪？ |
| **使用者未定义** | spec 文件的「使用者」节为空 | "添加认证模块"——谁用？前端页面？CLI？API？ |
| **验收标准缺失** | feature_list.json 的 `acceptance.checklist` 为空或只有模糊描述 | "让应用更快"——从多少秒到多少秒？ |
| **错误路径遗漏** | spec 文件的「错误处理」节未覆盖异常场景 | "网络断开时怎么办？文件已存在时怎么办？" |
| **优先级冲突** | 两个 pending 任务涉及同一文件或模块，但 dependsOn 未声明 | "重构 Store A"和"在 Store A 上加新字段"同时存在 |

### 4.2 提问格式

Agent 的提问必须遵循以下格式——**每个问题必须是选择题，附带推荐选项和理由**：

```markdown
## 需求澄清：[功能名称]

我在 [spec 文件 / acceptance 字段] 中发现 [具体缺失的要素]。

### 问题 1：[具体问题]

| 选项 | 方案 | 影响 |
|------|------|------|
| A (推荐) | [具体方案描述] | [为什么推荐：匹配现有架构 / 实现成本低 / 风险小] |
| B | [替代方案描述] | [为什么是备选：可行但代价更大 / 与现有模式不一致] |
| C | [自定义] | 请描述你的方案 |

### 问题 2：[具体问题]
...

**请选择**：回复"A/B/C"即可，或直接描述你的方案。
```

### 4.3 澄清循环

```
用户提出模糊需求
      │
      ▼
┌─────────────────────────────┐
│ Agent 分析需求，检查四要素：   │
│ 做什么 / 给谁用 / 怎么验证 /  │
│ 不做什么                     │
└─────────────┬───────────────┘
              │
      ┌───────┴───────┐
      │               │
   四要素完整      四要素缺失
      │               │
      ▼               ▼
  直接执行    ┌─────────────────┐
             │ Agent 提出选择题  │
             │ (推荐选项 + 理由) │
             └────────┬────────┘
                      │
              ┌───────┴───────┐
              │               │
           用户回答         用户说"都行"
              │               │
              ▼               ▼
        ┌──────────┐   Agent 按推荐选项
        │ 记录澄清  │   执行（记录日志）
        │ 继续执行  │
        └──────────┘
              │
              ▼
      ┌───────────────┐
      │ 将澄清结论写入： │
      │ - specs/ 对应节 │
      │ - acceptance   │
      │ - clarifyLog   │
      └───────────────┘
```

### 4.4 澄清记录的固化

每次澄清完成后，Agent 必须：

1. **更新 `feature_list.json`** → `clarifyLog` 字段追加一条记录
2. **更新 `specs/modules/<module>.md`** → 将澄清结论写入「范围边界」「使用者」「错误处理」等对应节
3. **更新 `acceptance.checklist`** → 将验收标准补全为可观察的具体条目

### 4.5 澄清上限

- 同一任务最多进行 **2 轮**澄清。如果 2 轮后仍无法确定边界，Agent 应：
  1. 将任务标记为 `blocked`
  2. 在 `logs/` 中记录阻塞原因和已澄清的内容
  3. 建议人类在 `specs/` 中手动补充后再解除阻塞

---

## 五、Agent 执行模型

### 5.1 完整任务执行主循环

```
┌─────────────────────────────────────────────────────────────────┐
│                      Agent 任务执行主循环（单 Agent）             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① 读 L0                                                        │
│  ┌─ Read CLAUDE.md                                              │
│  │  获取: 项目定义、技术栈锁定、核心约束速览、文件地图              │
│  │  决定: 本项目是什么、能做什么、不能做什么                        │
│  └─────────────────────────────────────────────────────────────┘ │
│                         │                                        │
│                         ▼                                        │
│  ② 读 L1 + 选任务                                                │
│  ┌─ Read feature_list.json                                      │
│  │  筛选: status=pending AND dependsOn 全部满足                   │
│  │  选定: 优先级最高、ID 最小的任务                                │
│  │                                                              │
│  └─ Read logs/INDEX.md (首次任务或需历史上下文时)                  │
│  │  按热度策略读取相关日志文件                                     │
│  └─────────────────────────────────────────────────────────────┘ │
│                         │                                        │
│                         ▼                                        │
│  ③ 澄清检查 ★新增★                                              │
│  ┌─ 检查选中任务的四要素:                                        │
│  │   做什么 (specs/) · 给谁用 (使用者) · 怎么验证 (acceptance) ·   │
│  │   不做什么 (范围边界)                                          │
│  │                                                              │
│  │   ├─ 四要素完整 → 继续                                        │
│  │   └─ 四要素缺失 → 执行「主动澄清协议」(第四章)                  │
│  │       澄清完毕 → 更新 specs/ + feature_list.json              │
│  └─────────────────────────────────────────────────────────────┘ │
│                         │                                        │
│                         ▼                                        │
│  ④ 标记 in_progress                                             │
│  ┌─ feature_list.json: 任务 status → in_progress                │
│  └─────────────────────────────────────────────────────────────┘ │
│                         │                                        │
│                         ▼                                        │
│  ⑤ 读 L2                                                        │
│  ┌─ Read specs/modules/{X}.md (由 feature.spec 字段指定)          │
│  └─ Read constraints/design-rules.md (全文)                      │
│  └─ Read constraints/testing-protocol.md (全文)                   │
│  └─────────────────────────────────────────────────────────────┘ │
│                         │                                        │
│                         ▼                                        │
│  ⑥ 读 L3 (条件)                                                  │
│  ┌─ Read contracts/ipc/commands.md (如有 IPC 操作)                │
│  └─ Read contracts/stores/{X}.md (如有状态操作)                   │
│  └─────────────────────────────────────────────────────────────┘ │
│                         │                                        │
│                         ▼                                        │
│  ⑦ TDD 红阶段                                                   │
│  ┌─ 按 testing-protocol.md 编写测试                               │
│  │  确认: 测试失败（红）                                          │
│  └─────────────────────────────────────────────────────────────┘ │
│                         │                                        │
│                         ▼                                        │
│  ⑧ 实现                                                         │
│  ┌─ 按 L3 契约写类型签名，按 L2 规格写行为逻辑                     │
│  │  确认: 测试通过（绿）                                          │
│  │  重构: 优化代码，确认测试仍通过                                  │
│  │                                                              │
│  │  每完成一个文件后自检:                                         │
│  │    ✓ 是否违反 design-rules.md 中的任何规则?                    │
│  │    ✓ 是否使用了技术栈锁定之外的依赖?                            │
│  │    ✓ 文件是否超过行数阈值?                                     │
│  │    ✓ 是否超出了 specs/ 中定义的「范围边界」?                    │
│  └─────────────────────────────────────────────────────────────┘ │
│                         │                                        │
│                         ▼                                        │
│  ⑨ 自动化验证                                                    │
│  ┌─ 运行 ./verify.ps1                                           │
│  │                                                              │
│  │   ├─ 通过 (exit 0) → 继续                                     │
│  │   └─ 失败 (exit ≠ 0) → 修复 → 重新执行                        │
│  │       连续 3 次失败 → marked blocked, 通知用户                 │
│  └─────────────────────────────────────────────────────────────┘ │
│                         │                                        │
│                         ▼                                        │
│  ⑩ 更新状态                                                     │
│  ┌─ feature_list.json: 任务 status → completed                   │
│  │  logs/YYYY-MM-DD-<task-id>.md: 写入日志文件                    │
│  │  logs/INDEX.md: 追加索引条目                                   │
│  │  如有新决策 → logs/YYYY-MM-DD-decision-<slug>.md               │
│  │  检查: 是否有代码/文档需要删除? (原则 7)                        │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 各层读取规则

| 层 | 何时读取 | 读取方式 | 是否必读 |
|----|---------|---------|---------|
| L0 CLAUDE.md | 每次对话开始 | 全文 | **必读** |
| L1 feature_list.json | 每次选任务时 | 全文查询 | **必读** |
| L1 logs/ | 需要历史上下文时 | INDEX.md → 按需检索具体文件 | 条件必读 |
| L2 specs/{module}.md | 实现对应模块前 | 全文 | **必读** |
| L2 constraints/design-rules.md | 实现前 + 实现后逐条对照 | 全文 | **必读** |
| L2 constraints/testing-protocol.md | 实现前 | 全文 | **必读** |
| L2 constraints/non-functional.md | 版本发布前 | 全文 | 条件必读 |
| L3 contracts/ | 涉及对应接口时 | 按章节查找 | 条件必读 |
| L4 init.ps1 | 新环境首次初始化 | 执行 | 条件执行 |
| L4 verify.ps1 | **每次任务宣称 completed 前** | 执行 | **必执行** |
| L5 docs/* | 需要理解"为什么"时 | 全文 | 条件参考 |

### 5.3 文件更新规则

| 操作 | 更新的文件 |
|------|-----------|
| 任务开始 | `feature_list.json` → status → `in_progress` |
| 需求澄清 | `feature_list.json` → `clarifyLog`; `specs/{module}.md` → 补充边界/使用者/验收 |
| 任务完成 | `feature_list.json` → status → `completed`; `logs/YYYY-MM-DD-<task-id>.md`; `logs/INDEX.md` |
| 新增依赖 | `CLAUDE.md` 技术栈表; `constraints/design-rules.md` → 更新依赖约束 |
| 新模块 | `specs/modules/<new>.md`; `contracts/stores/<new>.md`; `CLAUDE.md` 文件地图 |
| 删除代码 | 同步删除对应的 spec/contract 引用；`CLAUDE.md` 文件地图 |
| 版本发布 | `logs/` 版本汇总; `constraints/non-functional.md` 逐项检查 |
| 发现过时文档 | 直接删除或更新，记录到 `logs/` + 更新 `INDEX.md` |

---

## 六、新项目初始化步骤

### 步骤 1：创建项目骨架

```bash
mkdir -p <project>/docs <project>/specs/modules <project>/constraints
mkdir -p <project>/contracts/ipc <project>/contracts/stores
mkdir -p <project>/logs
```

### 步骤 2：编写 L5 文档（先定义再约束）

1. 写 `docs/PRD.md` — 确定要做什么
2. 写 `docs/ARCHITECTURE.md` — 确定怎么做（技术选型）

### 步骤 3：创建 L0 入口

3. 写 `CLAUDE.md`（< 120 行）— 从 L5 中提取：技术栈锁、文件地图、核心约束

### 步骤 4：创建 L1 编排

4. 写 `feature_list.json` — 从 PRD 中拆解功能列表，每个功能填写 `acceptance` 字段
5. 创建 `logs/INDEX.md` 空索引文件

### 步骤 5：创建 L2 约束

6. 写 `constraints/design-rules.md` — 每条规则绑定自动化检查方式
7. 写 `constraints/non-functional.md` — 性能/安全/可靠性门禁
8. 写 `constraints/testing-protocol.md` — TDD 流程、测试层级、覆盖率门禁
9. 写 `specs/modules/*.md` — 每个模块必须包含「使用者」「范围边界」节

### 步骤 6：创建 L3 契约

10. 写 `contracts/ipc/commands.md`（如适用）
11. 写 `contracts/stores/*.md` — 标注"被谁使用"

### 步骤 7：创建 L4 工具

12. 写 `init.ps1` — 环境初始化 + Git hook 安装
13. 写 `verify.ps1` — lint + test + typecheck + 完整性检查 + INDEX.md 检查

### 步骤 8：配置自动化检查

14. 配置 ESLint（对应 design-rules.md 的每条规则）
15. 配置 dependency-cruiser（模块依赖约束）
16. 配置 `tsconfig.json` 的 strict 选项
17. 配置 pre-commit hook

### 步骤 9：验证

```bash
./init.ps1
./verify.ps1
```

---

## 七、增量采纳：从旧项目到 Harness 项目

并非所有项目都能从零开始。按以下优先级渐进式引入。

### 阶段 0：基线建立（第 1 天）

1. 创建 `CLAUDE.md`（最小版：项目定义 + 技术栈锁定，< 60 行）
2. 创建 `feature_list.json`（先只列当前正在做的 3-5 个功能，acceptance 字段必填）
3. 创建 `constraints/design-rules.md`（先只写 3-5 条最重要的规则，每条绑定自动化检查）
4. 创建 `verify.ps1`（最小版：只跑 `npm run lint` 和 `npm test`）

### 阶段 1：核心约束落地（第 1 周）

5. 逐步补充 `constraints/design-rules.md`，每加一条规则就配套一个自动化检查
6. 创建 `constraints/testing-protocol.md`，从新代码开始强制 TDD
7. 创建 `constraints/non-functional.md`，先只填已知的性能瓶颈
8. 将 `verify.ps1` 扩展为覆盖所有已有约束

### 阶段 2：规格追溯（第 1-2 周）

9. 为核心模块补写 `specs/modules/*.md`（逆向提取已有代码的真实行为；范围边界标注当前状态而非理想状态）
10. 为核心 Store 补写 `contracts/stores/*.md`

### 阶段 3：全面覆盖（按需要）

11. 补全剩余模块的 specs/ 和 contracts/
12. 历史代码逐步补充测试覆盖
13. `logs/` 从此刻开始积累，历史不补

### 关键原则

- **先约束新代码，再约束历史代码**：新功能完整走 Harness 循环，历史代码逐步改造
- **自动化检查优先于文档**：每创建一条规则，先配置自动化检查，再写文档描述
- **不做一次性全面改造**：按模块逐个纳入
- **澄清从第一个功能就开始**：即使只有 3 个功能，acceptance 字段也必须填写

---

## 八、关键文件模板

### CLAUDE.md 模板

```markdown
# <项目名> — Agent Harness

> 地图而非手册。详情分散在各约束文件中。

## 项目定义
<一句话描述>

## 技术栈 (锁定)

| 层 | 选型 | 版本 | 禁止替代 |
|---|------|------|---------|
| ... | ... | ... | ... |

## 文件地图
<一级目录 + 关键文件，超过 15 个文件时只列目录>

## 核心约束
<3-5 条最重要的规则，每条 1-2 行>

## 开发流程
1. 读取本文件
2. 读取 feature_list.json 确认任务
3. 检查 acceptance 是否完整，不完整则执行澄清协议
4. 阅读对应 specs/ 规格文件（使用者 / 范围边界 / 状态转移）
5. 阅读对应 contracts/ 契约文件
6. 编写测试（TDD 红阶段）
7. 编码实现（TDD 绿 + 重构阶段），每文件完成后自检
8. 运行 lint + test + verify
9. 写入 logs/ 日志文件 + 更新 INDEX.md
10. 更新 feature_list.json 状态

## 执行规则
- 必须遵守「主动澄清协议」：需求四要素不完整时禁止直接编码
- 禁止猜测用户意图
- 禁止使用技术栈锁定之外的依赖
- ...
```

### feature_list.json 模板

```json
{
  "$schema": "./schemas/feature_list.schema.json",
  "version": "0.1.0",
  "features": [
    {
      "id": "<PREFIX>-<NN>",
      "name": "<功能名>",
      "description": "<一句话>",
      "status": "pending",
      "priority": "P0",
      "version": "0.1",
      "spec": "specs/modules/<module>.md",
      "dependsOn": [],
      "acceptance": {
        "files": ["src/path/to/file.ts"],
        "tests": ["src/path/to/__tests__/file.test.ts"],
        "checklist": [
          "正常路径: 用户点击 X 后 Y 在 500ms 内出现",
          "边界条件: 输入为空时显示 '请填写内容'",
          "错误路径: 网络断开时显示 '连接失败，请重试'",
          "禁止: 不弹出系统原生对话框"
        ]
      }
    }
  ],
  "clarifyLog": {},
  "statuses": {
    "pending":     { "label": "待开始",  "icon": "○" },
    "in_progress": { "label": "进行中",  "icon": "◉" },
    "completed":   { "label": "已完成",  "icon": "●" },
    "blocked":     { "label": "阻塞",    "icon": "⊘" },
    "cancelled":   { "label": "已取消",  "icon": "✕" }
  },
  "versions": {
    "0.1": { "label": "<版本名>", "target": "<版本目标>" }
  }
}
```

### 模块规格模板 (specs/modules/<module>.md)

```markdown
# <模块名> Module Specification

## 模块职责
<一句话描述本模块的存在理由>

## 使用者
| 使用者 | 类型 | 使用场景 |
|--------|------|---------|
| <名称> | <UI组件 / Store / API消费者> | <什么情况下调用本模块的什么方法> |

## 状态定义
```<类型语言>
<状态变量及其类型和含义>
```

## 操作定义
| 操作 | 触发者 | 入参 | 出参 | 副作用 | 前置条件 |
|------|--------|------|------|--------|---------|

## 状态转移
<转移图或转移表，覆盖所有合法路径和边界条件>

## 范围边界
| 范围内 | 范围外 |
|--------|--------|
| <本模块负责> | <本模块不负责，由 X 负责> |

## 约束
| 约束项 | 值 | 检查方式 |
|--------|-----|---------|

## 错误处理
| 场景 | 行为 |
|------|------|

## 依赖
| 依赖项 | 类型 | 用途 |
|--------|------|------|
```

### 设计规则模板 (constraints/design-rules.md)

```markdown
# Design Rules

## 架构规则
### A1. <规则名>
- **规则**: <必须/禁止>
- **原因**: <一句话>
- **检查方式**: <工具:规则名>

## 组件规则
### C1. <规则名>
- **规则**: ...
- **检查方式**: ...

## 编码风格
### S1. <规则名>
- **规则**: ...
- **检查方式**: ...
```

### 日志文件模板 (logs/YYYY-MM-DD-<task-id>.md)

```markdown
# <task-id>: <summary>

- **日期**: YYYY-MM-DD
- **关联任务**: <task-id>
- **产出**: <变更的文件列表>
- **验收**: 
  - [x] <checklist 条目 1>
  - [x] <checklist 条目 2>
- **耗时**: <小时数>
- **决策**: <如有，简述原因和影响范围>
- **备注**: <阻塞项、遗留问题>
```

### INDEX.md 模板 (logs/INDEX.md)

```markdown
# Logs Index

## 最近 7 天
| 日期 | 任务 | 文件 | 关键词 |
|------|------|------|--------|

## 决策索引
| 日期 | Slug | 文件 | 关键词 |
|------|------|------|--------|
```

---

## 九、演进策略

### 何时创建新文件

| 场景 | 操作 |
|------|------|
| 新模块 | `specs/modules/<new>.md`（含使用者和范围边界）+ `contracts/stores/<new>.md` |
| 新 IPC 操作 | 追加到 `contracts/ipc/commands.md` |
| 新设计规则 | 追加到 `constraints/design-rules.md`，分配编号，**同时配置自动化检查** |
| 新功能 | 追加到 `feature_list.json`，**acceptance 字段必填**。不完整则触发澄清协议 |
| 重大决策 | 新建 `logs/YYYY-MM-DD-decision-<slug>.md` + 更新 `INDEX.md` |
| 依赖变更 | 更新 `CLAUDE.md` 技术栈表 + `constraints/design-rules.md` |

### 何时删除文件

| 场景 | 操作 |
|------|------|
| 模块废弃 | 删除 `specs/` 和 `contracts/` 中对应文件，更新 `CLAUDE.md` 文件地图 |
| 功能取消 | `feature_list.json` 中标记 `cancelled`（保留记录，不删除） |
| 规则过时 | 从 `constraints/design-rules.md` 中删除，移除对应自动化检查，编号不回收 |

### 版本关闭 Checklist

- [ ] `npm run lint` 零警告零错误
- [ ] `npm test` 全部通过
- [ ] `npm run typecheck` 通过
- [ ] `./verify.ps1` 全部门禁通过
- [ ] `constraints/non-functional.md` 全部门禁通过
- [ ] `feature_list.json` 中该版本所有 P0 功能 `completed`，且 `acceptance.checklist` 全部满足
- [ ] `CLAUDE.md` 无过时引用，行数 < 120
- [ ] 无注释掉的代码 / 无 `// TODO`
- [ ] pre-commit hook 处于活跃状态
- [ ] `logs/INDEX.md` 包含本版本所有任务的日志条目

---

## 十、Bug 固定链路 — 防重复犯错

> 基于 C-01~C-03 实战踩坑总结。同 bug ≥3 次未修复 → 说明方向错误，必须切换策略。

### 10.1 问题分类

| 类别 | 特征 | 正确策略 |
|------|------|---------|
| **竞态 (Race Condition)** | 现象间歇性、跟操作速度有关 | 画事件时序图，确认执行顺序 |
| **缓存 (Cache Staleness)** | 数据正确但 UI 不更新 | 检查数据来源（store vs memo vs ref） |
| **API 行为 (Platform Quirk)** | 同一逻辑在不同元素上表现不同 | 换 DOM API（`innerText` → `textContent`） |
| **渲染中断 (Render Bailout)** | 块完全消失或空白 | 检查所有渲染分支的条件，确保至少一条匹配 |

### 10.2 强制排查步骤（同 bug ≥3 次后执行）

```
Step 1: 停止编码
Step 2: 完整手写数据流追踪表（见 10.3）
Step 3: 在追踪表中标记「已验证」和「未验证」节点
Step 4: 从「未验证」节点中选最上游的作为突破口
Step 5: 单点修复，确认追踪表闭合后继续
```

### 10.3 数据流追踪表模板

每次排查渲染不回显时，填写此表。每条一行，逐一验证。

| # | 链路 | 示例问题 | 验证方法 |
|---|------|---------|---------|
| 1 | contentEditable.innerText 返回值是否包含 \n | WebView2 对含 `\|` 的文本 innerText 可能合并换行 | `console.log(JSON.stringify(ref.current.innerText))` |
| 2 | `syncBlockEdit` 是否正确替换 | — | 单元测试 |
| 3 | `newContent !== content` 判断是否通过 | Zustand setContent 内 `if (c === state.c) return` 短路 | 检查 `setContent` 实现 |
| 4 | store 更新后订阅者是否收到通知 | Zustand `Object.is` 相同值不通知 | 在 subscribe 中加 log |
| 5 | `useMemo` 是否返回旧缓存 | 依赖数组未变化 → 即使 store 更新也返回旧值 | 检查 deps |
| 6 | `React.memo` 是否跳过渲染 | props 浅比较通过 → 不渲染 | 临时去掉 memo |
| 7 | 渲染条件是否覆盖所有分支 | 某个分支的 if 条件全部为 false → 返回 null | 检查 switch/if 链条 |
| 8 | 事件触发顺序是否正确 | blur 前 setActiveBlock(null) → handleBlur 提前 return | 画事件时序 |

### 10.4 C-02/C-03 实战案例

#### 案例 1：`innerText` vs `textContent`

- **症状**：表格点击后 markdown 换行全部丢失
- **排查**：Step 1 "contentEditable 返回值是否包含 \n" — 发现 WebView2 的 `innerText` 对含 `|` 的多行文本合并为单行
- **修复**：全局替换 `innerText` → `textContent`（后者返回原始 DOM 文本，不触发布局计算）
- **规则**：内容编辑场景**禁止**使用 `innerText`，一律用 `textContent`

#### 案例 2：渲染分支缺失

- **症状**：代码块点击后直接消失
- **排查**：Step 7 "渲染条件是否覆盖所有分支" — 发现 `handleOuterClick` 错误设置 `activeSegRange`，导致三个渲染分支（逐段/display/编辑）全部跳过
- **修复**：按块类型分流，结构性块走全块激活
- **规则**：每个渲染组件必须保证所有可能的 state 组合都有对应 return 分支。用表格穷举 state × blockType 组合

#### 案例 3：Zustand 缓存一致性

- **症状**：退出编辑后 UI 不更新
- **排查**：Step 4-5 — Zustand `set()` 的 `Object.is` 判断 + `useMemo` 缓存
- **根因链**：
  1. `setContent` 内 `if (content === state.content) return` 使 store 不更新
  2. `useMemo([content])` 缓存旧 blocks → `setBlocks` 只执行一次
  3. `useBlockSync` 从 useMemo 缓存取 blocks → 不感知 store 的 force update
- **修复**：
  1. `useBlockSync` 从 `useBlocksStore(s => s.blocks)` 直接读 store
  2. 退出编辑时 `version++` → `<BlockRenderer key={version}>` 强制全树重挂（兜底）

### 10.5 防御性设计规则

| 规则 | 原因 | 检查方式 |
|------|------|---------|
| **D1. 禁止 innerText** | WebView2 对特定字符存在换行合并 bug | `grep 'innerText' src/` 不应出现在内容读写中 |
| **D2. 渲染分支穷举** | 缺少分支 → 组件返回 null → 块消失 | 每个组件必须有显式 fallback return |
| **D3. 事件时序文档化** | 竞态难以肉眼发现 | 涉及 blur/click/keydown 的交互必须写注释说明时序 |
| **D4. store 写入不依赖 Object.is** | Zustand 相同值不通知订阅者 | 关键路径用 `setContentNoHistory` 替换 `setContent`，或加版本号 |
| **D5. useMemo 不做副作用** | `setBlocks` 在 memo 内只执行一次，后续返回缓存 | 数据同步逻辑放在 `useEffect` 或 store middleware |

---

## 十一、无感编辑迁移 — 从多模式到统一 contentEditable+HTML

> 基于 C-03.5 实战：将段落/标题/引用/列表/代码 5 种块从各自独立的编辑模式统一为一条通路。

### 11.1 迁移前状态（问题）

```
段落 → contentEditable 源码模式（等宽字体、蓝框）
标题 → contentEditable 源码模式（等宽字体、蓝框）  
引用 → StructuralEditor 逐行源码模式
列表 → StructuralEditor 逐行源码模式
代码 → contentEditable 源码模式
```

每个块类型独立维护编辑逻辑，行为不一致，编辑态视觉效果与渲染态割裂。

### 11.2 迁移后状态（统一）

```
所有文本块 → <div contentEditable className="outline-none">
                <BlockDisplay block={block} />    ← 自研 React 组件渲染
              → 点击任意位置 → 光标自然落脚
              → 编辑 → blur → innerHTML
              → stripMdMeta(html) → turndown(html)
              → syncBlockEdit → store
```

**关键决策**：

| 决策 | 原因 |
|------|------|
| 删除所有自定义编辑模式 | 减少维护面，单一代码路径验证 |
| `contentEditable` 包裹 `BlockDisplay` | 渲染即编辑态，零模式切换 |
| `turndown` 做 HTML→markdown | 成熟库，覆盖所有块类型和内联格式 |
| `emDelimiter: '*'` | 避免 `_` 与 `__` 冲突导致 round-trip 变质 |
| 自定义 rules（del/mark/sub/sup） | turndown 原生不支持的 `<del>` → `~~` 等 |
| `onFocus` 不触发 React state | 避免重渲染打断浏览器光标 |
| `selectionchange` + `.md-active` | 逐段聚焦，仅光标所在段显示语法标记 |

### 11.3 数据流

```
block.markdown (SSOT)
  → parser → Block[] → BlockDisplay (React 渲染为 HTML)
  → contentEditable (用户编辑 HTML)
  → blur → innerHTML
  → stripMdMeta (清除视觉标记)
  → turndown (HTML → markdown)
  → syncBlockEdit → editorStore.content
  → 触发重新 parse → 刷新 BlockDisplay
```

### 11.4 防御规则（新增）

| 规则 | 内容 |
|------|------|
| **D6. turndown 自定义优先** | 所有非 `<strong>/<em>/<a>/<code>` 的格式化标签必须显式注册 turndown rule |
| **D7. emDelimiter 固定 `*`** | 禁止使用默认 `_` delimiter，避免 `**_` 被 inline parser 误解析 |
| **D8. 编辑态零 React 重渲染** | `onFocus`/点击不应触发 `setState`/`setActiveBlock`。浏览器原生 contentEditable 管理光标，React 只负责初始渲染和 blur 提交 |

---

## 十二、实时 Markdown 解析器 — 编辑中即时 DOM 转换

> 基于 C-03.5 Phase 1。在 contentEditable 的 `onInput` 事件中检测键入的 markdown 模式，直接在 DOM 中替换为格式化 HTML，无需等待 blur。

### 12.1 定位

turndown（HTML→markdown）在 blur 时运行。实时解析器在**每次击键**时运行，只操作 DOM，不触发 React 渲染。

```
键入 * → onInput → rt-parser → 检测 **text** 模式 → 替换文本节点
  → <span class="md-meta">**</span><strong>text</strong><span class="md-meta">**</span>
  → 用户即时看到粗体渲染
```

### 12.2 模块文件

| 文件 | 职责 |
|------|------|
| `rt-parser.ts` | `processInlinePatterns(el)` — 扫描光标周围文本，匹配完整模式并替换 DOM |
| `seg-focus.ts` | `registerSegFocus(el, fn)` — 全局 selectionchange 监听，逐段显示 md-meta |
| `md-converter.ts` | `htmlToMarkdown(html)` — blur 时 turndown 转换 |
| `inline.tsx` | `InlineContent` — React 初始渲染（含 md-meta 标记） |

### 12.3 实现阶段

| 阶段 | 功能 | 状态 |
|------|------|------|
| **Phase 1** | `**text**` → `<strong>`、`*text*` → `<em>`、`` `code` `` → `<code>`、`~~del~~` → `<del>`、`***text***` → `<em><strong>` | ✅ 完成 |
| **Phase 2** | 选中文本包 `*` → 包裹为 `<em>`；`> ` 实时 CSS 块引用（不重解析）；删除边界自动解除格式化 | ⬜ 待实现 |
| **Phase 3** | 自动配对：键入 `*` 自动补闭合 `*`，删除一侧同步删除另一侧 | ⬜ 待实现 |

### 12.4 关键约束

| 约束 | 值 | 原因 |
|------|-----|------|
| 解析范围 | 光标所在文本节点 | 全文扫描耗时且可能影响其他节点 |
| DOM 操作 | `insertBefore` + `removeChild` | 仅替换匹配文本节点 |
| 光标恢复 | `requestAnimationFrame` + `placeCursorAtEnd` | 避免 selectionchange 竞态 |
| 触发条件 | `onInput` 事件 | 每次文本变更触发 |
| React 交互 | 零 | 纯 DOM 操作，不触发 React 渲染 |

### 12.5 防御规则（新增）

| 规则 | 内容 |
|------|------|
| **D9. rt-parser 仅处理 TEXT_NODE** | `processInlinePatterns` 必须检查 `startContainer.nodeType === Node.TEXT_NODE`，避免操作元素节点 |
| **D10. 模式匹配用 indexOf 非 lastIndexOf** | 循环扫描所有开启位置，而非只取最后匹配（`**text**` 的闭合 `**` 也是 `**`） |
| **D11. rAF 包裹光标恢复** | `placeCursorAtEnd` 必须内部 `requestAnimationFrame`，避免 DOM 未完成时设置光标 |
