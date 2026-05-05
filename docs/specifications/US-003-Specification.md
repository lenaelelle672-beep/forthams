# US-003 Specifications 规格指导文档

**任务标识:** US-003  
**任务名称:** Graphify 知识图谱节点查询修复  
**迭代周期:** Iteration 1  
**文档版本:** 1.0.0  
**创建日期:** 2025-01-20  
**文档状态:** 已审核

---

## 1. 需求与背景

### 1.1 任务标识

| 属性 | 值 |
|------|-----|
| User Story ID | US-003 |
| 任务类型 | Bug Fix / Feature Enhancement |
| 优先级 | P0 (Critical) |
| 影响范围 | Graphify 知识图谱核心功能 |

### 1.2 业务背景

Graphify 知识图谱是资产管理系统中用于可视化管理资产、设备和人员关联关系的核心组件。系统当前出现 **"No matching nodes found"** 错误，导致用户无法正常查询和展示知识图谱节点，严重影响工作流程的正常执行。

**问题根因分析:**

根据 `endless_daemon.py` 中的 `GraphifyNodeRegistry` 实现，错误可能源于以下环节：

- **索引缺失**: `_index_by_type` 未正确建立节点类型索引
- **租户隔离逻辑缺陷**: `tenant_id` 过滤条件过于严格，导致跨租户查询失败
- **数据初始化失败**: `initialize_default_nodes()` 未被正确调用或初始化数据不完整
- **查询参数解析错误**: `get_nodes_by_type()` 方法参数传递存在问题

### 1.3 关联依赖

| 依赖类型 | 依赖项 | 状态 | 说明 |
|---------|--------|------|------|
| 前置依赖 | US-001, US-002 | ✅ 完成 | 基础架构搭建 |
| 数据依赖 | Mock 数据源 | ⚠️ 待验证 | 需确认测试数据完整性 |
| 外部依赖 | 无 | - | 本次为内部修复 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 定位

根据 plan.md 的 Phase 拆解，本任务属于 **Phase 1: 核心功能修复**，目标是解决 Graphify 知识图谱的节点查询异常问题。

### 2.2 功能范围定义

#### 2.2.1 问题节点 (In Scope)

| 功能点 ID | 描述 | 当前状态 | 目标状态 |
|-----------|------|----------|----------|
| F-001 | 节点类型索引构建 | 索引可能为空 | 正确构建 Type → NodeIds 映射 |
| F-002 | 租户隔离查询 | 过滤逻辑异常 | 支持 `tenant_id="default"` 正确查询 |
| F-003 | 默认节点初始化 | 可能未执行 | `initialize_default_nodes()` 正常执行 |
| F-004 | 前端节点展示 | "No matching nodes found" | 正确渲染节点卡片 |
| F-005 | 资产详情弹窗 | 数据加载失败 | 正确显示资产详情信息 |

#### 2.2.2 排除范围 (Out of Scope)

| 功能点 | 说明 |
|--------|------|
| 非指定文件修改 | 仅修改 AC 审核通过的文件 |
| CI/CD 流水线 | 不涉及部署配置 |
| 生产环境部署 | 仅修复代码逻辑 |

### 2.3 技术目标

| 指标类别 | 指标名称 | 当前基线 | 目标值 | 度量方式 |
|----------|----------|----------|--------|----------|
| 功能性 | 节点查询成功率 | 0% | ≥95% | 自动化测试 |
| 功能性 | 默认数据加载 | 失败 | 成功 | 单元测试 |
| 性能 | Graphify 搜索延迟 | N/A | ≤200ms | API 响应监控 |
| 质量 | 单元测试覆盖率 | N/A | ≥80% | Coverage Report |

---

## 3. 边界约束

### 3.1 技术约束

```
┌─────────────────────────────────────────────────────────────┐
│                    技术边界约束                              │
├─────────────────────────────────────────────────────────────┤
│  后端 (endless_daemon.py)                                   │
│  ├── Python 3.11+                                           │
│  ├── 类型注解: GraphNodeType, GraphNode, Optional[List]     │
│  ├── 日志框架: logging (logger.error, logger.info)          │
│  └── 异常处理: GraphifyError, NodeNotFoundError             │
├─────────────────────────────────────────────────────────────┤
│  前端 (React + TypeScript)                                  │
│  ├── React 18+ / TypeScript 5.x                            │
│  ├── 状态管理: React hooks (useState, useEffect)            │
│  ├── API 调用: async/await + Promise                       │
│  └── 模拟数据: mockGraphifySearch (L90)                    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 数据约束

| 约束项 | 约束值 | 说明 |
|--------|--------|------|
| 默认租户 ID | `"default"` | 所有测试节点使用此值 |
| 默认节点数量 | ≥5 | `initialize_default_nodes()` 初始化数量 |
| 节点类型枚举 | `GraphNodeType` | ASSET, PERSON, LOCATION, DOCUMENT |
| 搜索延迟上限 | 200ms | 模拟网络延迟基准 |

### 3.3 范围边界

```
Phase 1 实施边界
═══════════════════════════════════════════════════════════════

                    ┌─────────────────┐
                    │   需求分析       │
                    │   (已完成)       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   AC 审核        │
                    │   (已通过)       │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
┌────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
│ 后端修复         │ │ 前端修复         │ │ 集成验证         │
│ endless_daemon  │ │ CustomNodes     │ │ 跨端联调         │
│ - 索引构建       │ │ AssetDetail     │ │ - API 对接       │
│ - 租户隔离       │ │ WorkflowDesgnr  │ │ - 数据流验证     │
│ - 初始化逻辑     │ │ userService     │ │                  │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────▼────────┐
                    │   验收测试       │
                    │   (ATB)         │
                    └─────────────────┘

═══════════════════════════════════════════════════════════════
```

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试 (Unit Tests)

#### 4.1.1 后端单元测试

| 测试用例 ID | 测试目标 | 输入参数 | 预期输出 | 验证方法 |
|-------------|----------|----------|----------|----------|
| UT-001 | `GraphifyNodeRegistry` 初始化 | 默认构造 | Registry 实例创建成功 | `assert registry is not None` |
| UT-002 | `initialize_default_nodes()` | 无参数 | 默认节点数量 ≥ 5 | `assert len(nodes) >= 5` |
| UT-003 | `get_nodes_by_type()` 查询 | `GraphNodeType.ASSET` | 返回 ASSET 类型节点列表 | `assert len(results) > 0` |
| UT-004 | 租户隔离 | `tenant_id="default"` | 仅返回 default 租户节点 | `assert all(n.tenant_id == "default")` |
| UT-005 | 空结果处理 | 不存在的 node_id | 返回空数组 (非异常) | `assert results == []` |

**执行命令:**

```bash
# 后端单元测试 (需 pytest)
cd backend
pytest tests/unit/test_graphify.py -v --cov=src --cov-report=html
```

**通过标准:** 所有用例通过，覆盖率 ≥ 80%

#### 4.1.2 前端单元测试

| 测试用例 ID | 测试目标 | 组件/函数 | 验证点 |
|-------------|----------|-----------|--------|
| UT-101 | `mockGraphifySearch` 函数 | AssetDetailModal.tsx:90 | 返回 Promise, 延迟 < 200ms |
| UT-102 | 节点卡片渲染 | CustomNodes.tsx | AssetNode 组件正常渲染 |
| UT-103 | 搜索结果处理 | mockGraphifySearch | 返回 `GraphSearchResult` 结构 |

**执行命令:**

```bash
# 前端单元测试 (需 vitest)
cd frontend
npm run test -- --run --coverage
```

**通过标准:** 所有用例通过，覆盖率 ≥ 70%

---

### 4.2 集成测试 (Integration Tests)

#### 4.2.1 后端集成测试

| 测试用例 ID | 测试目标 | 触发方式 | 验证点 |
|-------------|----------|----------|--------|
| IT-001 | Registry 与 API 端点对接 | HTTP GET `/api/graph/nodes` | 返回 200 + 节点数组 |
| IT-002 | 类型过滤查询 | HTTP GET `/api/graph/nodes?type=ASSET` | 仅返回 ASSET 节点 |
| IT-003 | 租户参数传递 | HTTP GET `/api/graph/nodes?tenant=default` | 正确过滤租户数据 |

**执行命令:**

```bash
# 后端集成测试
cd backend
pytest tests/integration/test_graphify_api.py -v --tb=short
```

**通过标准:** 所有集成测试通过，API 响应正常

#### 4.2.2 前端集成测试

| 测试用例 ID | 测试目标 | 用户操作 | 预期结果 |
|-------------|----------|----------|----------|
| IT-101 | 资产详情弹窗加载 | 点击资产节点 | 弹窗显示资产信息 |
| IT-102 | 工作流设计器节点渲染 | 进入设计器页面 | 显示所有默认节点 |
| IT-103 | 用户服务数据获取 | 调用 `userService` | 返回用户数据结构 |

**执行命令:**

```bash
# 前端集成测试
cd frontend
npm run test:integration
```

**通过标准:** 所有前端集成测试通过

---

### 4.3 E2E 测试 (End-to-End)

| 测试用例 ID | 用户操作流 | 预期结果 | 验证方式 |
|-------------|------------|----------|----------|
| E2E-001 | 打开资产管理系统 → 进入工作流设计器 | 正确显示知识图谱 | Playwright 截图验证 |
| E2E-002 | 点击任意资产节点 → 查看详情 | 弹出资产详情 Modal | 文本断言 |
| E2E-003 | 搜索 "Dell" 资产 | 显示匹配的资产卡片 | 列表长度 ≥ 1 |

**执行命令:**

```bash
# E2E 测试 (需 Playwright)
cd frontend
npx playwright test --project=chromium tests/e2e/graphify.spec.ts
```

**通过标准:** 所有 E2E 场景通过率 100%

---

### 4.4 性能基准测试

| 指标 | 基线值 | 目标值 | 测试工具 |
|------|--------|--------|----------|
| Graphify 搜索延迟 (P50) | N/A | ≤100ms | k6 / Lighthouse |
| Graphify 搜索延迟 (P99) | N/A | ≤200ms | k6 / Lighthouse |
| 节点渲染时间 (100 节点) | N/A | ≤500ms | Performance API |
| 内存峰值 | N/A | ≤150MB | Chrome DevTools |

**执行命令:**

```bash
# 性能测试
k6 run tests/performance/graphify_load.js
```

---

## 5. 开发切入层级序列

### 5.1 实现顺序

```
US-003 实现层级序列
═══════════════════════════════════════════════════════════════

层级 1: 后端核心修复 (优先级: P0)
├── 1.1 修复 GraphifyNodeRegistry 初始化
│   └── 文件: endless_daemon.py:157-180
├── 1.2 修复 get_nodes_by_type 索引逻辑
│   └── 文件: endless_daemon.py:344-370
├── 1.3 验证 initialize_default_nodes 执行
│   └── 文件: endless_daemon.py:470-510
└── 1.4 验证租户隔离逻辑
    └── 文件: endless_daemon.py:360-365

层级 2: 前端数据层修复 (优先级: P0)
├── 2.1 修复 mockGraphifySearch 实现
│   └── 文件: AssetDetailModal.tsx:90-130
├── 2.2 修复 CustomNodes 节点渲染逻辑
│   └── 文件: CustomNodes.tsx (L1-100)
└── 2.3 修复 userService 数据获取
    └── 文件: userService.ts

层级 3: 前端业务层修复 (优先级: P1)
├── 3.1 修复 WorkflowDesigner 节点加载
│   └── 文件: WorkflowDesigner.tsx
└── 3.2 修复 AssetDetailModal 数据展示
    └── 文件: AssetDetailModal.tsx

层级 4: 测试验证 (优先级: P1)
├── 4.1 后端单元测试编写
├── 4.2 前端单元测试编写
├── 4.3 集成测试编写
└── 4.4 E2E 测试补充

═══════════════════════════════════════════════════════════════
```

### 5.2 代码审查检查点

| 检查点 | 检查项 | 验收标准 | 工具 |
|--------|--------|----------|------|
| 代码规范 | Python PEP8 | 0 errors, 0 warnings | `flake8`, `pylint` |
| 代码规范 | TypeScript ESLint | 0 errors | `eslint` |
| 类型检查 | Python mypy | 0 errors | `mypy endless_daemon.py` |
| 类型检查 | TypeScript tsc | 0 errors | `tsc --noEmit` |
| 安全扫描 | 依赖漏洞扫描 | 0 critical/high | `safety`, `npm audit` |
| 覆盖率 | 测试覆盖率 | ≥80% (后端), ≥70% (前端) | `coverage`, `vitest --coverage` |

---

## 6. 关键代码位置索引

### 6.1 后端关键位置

| 文件 | 行号 | 代码片段 | 说明 |
|------|------|----------|------|
| `endless_daemon.py` | 121-128 | `class GraphifyError` | 自定义异常基类 |
| `endless_daemon.py` | 131-138 | `class NodeNotFoundError` | 节点未找到异常 |
| `endless_daemon.py` | 141-200 | `class GraphifyNodeRegistry` | 核心注册表类 |
| `endless_daemon.py` | 344-370 | `def get_nodes_by_type` | 按类型查询方法 (疑似问题点) |
| `endless_daemon.py` | 470-510 | `def initialize_default_nodes` | 默认节点初始化 |
| `endless_daemon.py` | 117-119 | `class GraphNode` | 节点数据结构 |

### 6.2 前端关键位置

| 文件 | 行号 | 代码片段 | 说明 |
|------|------|----------|------|
| `AssetDetailModal.tsx` | 90-130 | `mockGraphifySearch` | 模拟搜索函数 (疑似问题点) |
| `CustomNodes.tsx` | L1-100 | `AssetNode`, `PersonNode` | 自定义节点组件 |
| `WorkflowDesigner.tsx` | L1-100 | 主组件 | 工作流设计器页面 |
| `userService.ts` | L1-50 | 用户服务接口 | 用户数据获取 |

---

## 7. 附录

### 7.1 术语表

| 术语 | 定义 |
|------|------|
| Graphify | 知识图谱模块名称 |
| GraphNodeRegistry | 节点注册表，负责管理所有图谱节点 |
| NodeNotFoundError | 节点查询失败时抛出的异常 |
| tenant_id | 租户隔离标识，用于多租户数据分离 |
| `_index_by_type` | 节点类型到节点 ID 的内存索引 |

### 7.2 参考文档

| 文档 | 路径 | 说明 |
|------|------|------|
| AC 审核记录 | 任务详情页 | AC-001 至 AC-004 审核结果 |
| 架构设计文档 | docs/architecture/ | 系统整体架构 |
| API 接口规范 | docs/api/ | Graphify API 定义 |

### 7.3 待确认项

| 项号 | 问题 | 负责人 | 状态 |
|------|------|--------|------|
| 1 | 确认 `tenant_id` 默认值是否确实为 `"default"` | @TBD | 待确认 |
| 2 | 确认 Mock 数据源结构是否与 `GraphNode` 类型匹配 | @TBD | 待确认 |
| 3 | 确认 `GraphNodeType` 枚举的完整值列表 | @TBD | 待确认 |

---

**文档审核状态:** ✅ 已通过技术评审  
**下次更新:** 任务完成后更新实际修复结果
