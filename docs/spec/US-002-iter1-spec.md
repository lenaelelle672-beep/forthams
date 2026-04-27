# US-002 规格指导文档

**版本**: v1.0  
**迭代**: Iteration 1  
**状态**: Active  
**创建日期**: 2024-12-19  
**责任团队**: 前端 / 后端 / 知识图谱

---

## 需求与背景

### 任务标识
- **User Story ID**: US-002
- **任务类型**: Bug Fix / Feature Enhancement
- **优先级**: P0 (Critical)
- **关联阻塞**: Graphify 知识图谱功能无法正常使用

### 业务背景

#### 问题描述
当前系统中的 Graphify 知识图谱功能存在严重缺陷，用户在尝试搜索或访问知识图谱节点时收到 "No matching nodes found" 错误，导致以下业务流程无法完成：

1. **资产详情查看** - 用户无法通过知识图谱查看资产间的关联关系
2. **工作流设计** - WorkflowDesigner 组件依赖图谱数据但无法加载
3. **自定义节点渲染** - CustomNodes 组件无法正确渲染图谱节点

#### 影响范围
- 影响所有需要知识图谱功能的页面和组件
- 阻塞资产管理系统核心业务流程
- 用户体验严重下降

#### 根本原因分析
根据代码分析，问题可能源于以下几个层面：

| 层级 | 文件 | 疑似问题点 |
|------|------|------------|
| 数据层 | `endless_daemon.py` | GraphifyNodeRegistry 初始化或查询逻辑异常 |
| 服务层 | `userService.ts` | Graphify API 调用参数不匹配 |
| 组件层 | `AssetDetailModal.tsx` | mockGraphifySearch 函数未正确实现 |
| 可视化层 | `CustomNodes.tsx` | 节点渲染逻辑缺失数据源 |
| 页面层 | `WorkflowDesigner.tsx` | 图谱数据未正确传递至子组件 |

### 功能摘要

本次迭代需要修复 Graphify 知识图谱的节点搜索和渲染功能，确保：
- 知识图谱节点可被正确初始化和注册
- 节点查询接口返回正确数据而非空结果
- 前端组件可正确接收和渲染图谱数据
- 整体响应时间符合性能基准（< 200ms）

---

## 当前 Phase 对应实施目标

### Phase 定位

| 字段 | 值 |
|------|-----|
| Phase 编号 | Phase 2 (Graphify Enhancement) |
| Phase 名称 | 知识图谱核心功能修复 |
| Phase 入口标准 | 后端 API 可正常启动，前端开发服务器可运行 |
| Phase 出口标准 | 所有 ATB 测试通过，知识图谱功能可正常使用 |

### 本次 Spec 覆盖范围

#### 纳入范围 (In Scope)

| 序号 | 功能模块 | 描述 | 负责文件 |
|------|----------|------|----------|
| 1 | 图谱节点注册 | 确保 GraphifyNodeRegistry 正确初始化默认节点 | `endless_daemon.py` |
| 2 | 节点类型查询 | 实现 `get_nodes_by_type` 方法并返回正确数据 | `endless_daemon.py` |
| 3 | 前端 API 服务 | 修复 userService 中的 Graphify 调用逻辑 | `userService.ts` |
| 4 | 资产详情弹窗 | 修复资产详情页面的图谱数据获取逻辑 | `AssetDetailModal.tsx` |
| 5 | 自定义节点渲染 | 确保 CustomNodes 组件正确接收和渲染节点 | `CustomNodes.tsx` |
| 6 | 工作流设计器 | 修复 WorkflowDesigner 的图谱集成逻辑 | `WorkflowDesigner.tsx` |

#### 排除范围 (Out of Scope)

| 序号 | 功能 | 排除原因 |
|------|------|----------|
| 1 | 多租户权限隔离 | 延至 Phase 3 |
| 2 | 图谱可视化交互增强 | 延至 Phase 3 |
| 3 | 图谱数据持久化 | 需要额外数据库设计 |
| 4 | 图谱性能优化 | 首期修复后再优化 |
| 5 | E2E 测试自动化 | 测试框架搭建 |

### 阶段目标清单

| 目标编号 | 描述 | 优先级 | 预估工时 | 负责人 |
|----------|------|--------|----------|--------|
| GO-002-01 | 修复后端 GraphifyNodeRegistry 节点注册逻辑 | P0 | 2h | Backend |
| GO-002-02 | 修复前端 userService.ts 的 Graphify API 调用 | P0 | 1h | Frontend |
| GO-002-03 | 修复 AssetDetailModal 图谱数据获取 | P0 | 1.5h | Frontend |
| GO-002-04 | 修复 CustomNodes 节点渲染逻辑 | P0 | 1.5h | Frontend |
| GO-002-05 | 修复 WorkflowDesigner 图谱集成 | P0 | 1h | Frontend |
| GO-002-06 | 验证所有 ATB 测试通过 | P0 | 1h | QA |

---

## 边界约束

### 技术边界

#### 后端约束

| 约束类型 | 约束条件 | 边界值 | 备注 |
|----------|----------|--------|------|
| 响应时间 | Graphify API 端到端延迟 | ≤ 200ms | 含网络延迟 |
| 数据规模 | 单次查询返回节点数 | ≤ 1000 条 | 防止过载 |
| 内存占用 | 节点注册表内存占用 | ≤ 50MB | 合理估计 |
| Python 版本 | 最低支持版本 | Python 3.8+ | typing 支持 |

#### 前端约束

| 约束类型 | 约束条件 | 边界值 | 备注 |
|----------|----------|--------|------|
| 框架版本 | React 版本 | 18.x | TypeScript 支持 |
| 状态管理 | 状态更新机制 | React Hooks | 性能考量 |
| 包管理 | Node 版本 | 18.x+ | NPM 支持 |
| 构建工具 | Vite 版本 | 5.x | 现代构建 |

### 架构边界

```
┌─────────────────────────────────────────────────────────────────────┐
│                        系统架构边界                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│   │   Frontend   │────▶│   Backend    │────▶│  Graphify    │       │
│   │   (React)    │     │  (Python)    │     │  Registry    │       │
│   └──────────────┘     └──────────────┘     └──────────────┘       │
│         │                    │                      │               │
│         ▼                    ▼                      ▼               │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│   │ CustomNodes  │     │ REST API     │     │ GraphNode    │       │
│   │ AssetDetail  │     │ Endpoints    │     │ In-Memory    │       │
│   │ WorkflowDes. │     │              │     │ Storage      │       │
│   └──────────────┘     └──────────────┘     └──────────────┘       │
│                                                                      │
│   变更边界: 仅修改虚线框内组件，外部接口保持兼容                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 数据边界

#### GraphNode 数据结构

```typescript
interface GraphNode {
  id: string;           // 节点唯一标识 (e.g., "asset-001")
  node_type: string;    // 节点类型 (e.g., "ASSET", "USER", "DEPT")
  label: string;        // 显示标签 (e.g., "Dell Laptop XPS 15")
  properties: {         // 节点属性
    [key: string]: any;
  };
  tenant_id: string;    // 租户标识 (default: "default")
}
```

#### 数据规模约束

| 数据域 | 最大记录数 | 保留周期 | 存储方式 |
|--------|------------|----------|----------|
| 图谱节点 | 10,000 | 进程生命周期 | 内存 |
| 节点关系 | 50,000 | 进程生命周期 | 内存 |
| 搜索缓存 | 1,000 | 5 分钟 | 内存 |

### API 约束

#### 后端 API 端点

| 端点 | 方法 | 描述 | 性能要求 |
|------|------|------|----------|
| `/api/graphify/nodes` | GET | 获取所有节点 | ≤ 100ms |
| `/api/graphify/nodes/{type}` | GET | 按类型获取节点 | ≤ 100ms |
| `/api/graphify/search` | POST | 搜索节点 | ≤ 200ms |
| `/api/graphify/nodes/{id}` | GET | 获取单个节点 | ≤ 50ms |

#### 前端 API 调用

```typescript
// userService.ts 中需要修复的接口
interface GraphNodeOptions {
  node_type?: string;
  tenant_id?: string;
  limit?: number;
  offset?: number;
}

interface GraphSearchResult {
  nodes: GraphNode[];
  total: number;
  query_time: number;  // 毫秒
}
```

---

## 验收测试基准 (ATB)

### ATB-002-01: 后端图谱节点注册验证

**功能描述**: 验证 GraphifyNodeRegistry 正确初始化并注册默认节点

| 测试步骤 | 操作描述 | 预期结果 | 物理测试命令/方法 |
|----------|----------|----------|-------------------|
| 1 | 初始化 GraphifyNodeRegistry | registry 实例创建成功 | `python -c "from endless_daemon import get_registry; r = get_registry(); print(r)"` |
| 2 | 调用 initialize_default_nodes() | 默认节点被添加到注册表 | `python -c "from endless_daemon import initialize_default_nodes; initialize_default_nodes(); ..."` |
| 3 | 查询所有节点 | 返回节点列表，非空数组 | `python -c "from endless_daemon import get_registry; r = get_registry(); print(len(r.get_all_nodes()))"` |
| 4 | 按类型查询 ASSET 节点 | 返回类型为 ASSET 的节点 | `python -c "from endless_daemon import get_registry, GraphNodeType; r = get_registry(); print(r.get_nodes_by_type(GraphNodeType.ASSET))"` |
| 5 | 搜索存在关键词 | 返回匹配的节点列表 | `python -c "from endless_daemon import get_registry; r = get_registry(); print(r.search_nodes('Dell'))"` |

**通过标准**: 
- 步骤 3 返回节点数 ≥ 3
- 步骤 4 返回至少 2 个 ASSET 类型节点
- 步骤 5 返回至少 1 个匹配节点

**测试脚本位置**: `backend/tests/test_graphify_registry.py`

---

### ATB-002-02: 后端 API 端点验证

**功能描述**: 验证 Graphify REST API 端点正常工作

| 测试步骤 | 操作描述 | 预期结果 | 物理测试命令/方法 |
|----------|----------|----------|-------------------|
| 1 | GET /api/graphify/nodes | 返回 200 状态码，body 包含 nodes 数组 | `curl -s http://localhost:8000/api/graphify/nodes \| jq '.nodes \| length'` |
| 2 | GET /api/graphify/nodes/ASSET | 返回 200 状态码，nodes 为非空数组 | `curl -s http://localhost:8000/api/graphify/nodes/ASSET \| jq '.nodes'` |
| 3 | POST /api/graphify/search 带关键词 | 返回 200 状态码，包含匹配结果 | `curl -s -X POST http://localhost:8000/api/graphify/search -H "Content-Type: application/json" -d '{"query": "Dell"}' \| jq '.nodes'` |

**通过标准**: 
- 所有端点返回 200 状态码
- 响应 body 包含非空的 nodes 数组
- 响应时间 ≤ 200ms

**测试脚本位置**: `backend/tests/test_graphify_api.py`

---

### ATB-002-03: 前端 userService.ts 集成验证

**功能描述**: 验证前端 userService 中 Graphify 相关 API 调用正确工作

| 测试步骤 | 操作描述 | 预期结果 | 物理测试命令/方法 |
|----------|----------|----------|-------------------|
| 1 | 导入 userService 模块 | 无 ImportError 抛出 | `python -c "from frontend.src.app.services.userService import *"` (TypeScript 需 ts-node) |
| 2 | 检查 mockGraphifySearch 函数存在 | 函数定义存在且可调用 | 静态代码分析 |
| 3 | 调用 mockGraphifySearch("Dell") | 返回包含匹配结果的 Promise | 单元测试 |
| 4 | 验证返回数据结构 | 包含 nodes, total, query_time 字段 | 单元测试 |

**通过标准**: 
- 模块可正常 import
- mockGraphifySearch 函数存在且类型正确
- 返回数据结构符合 GraphSearchResult 接口

**测试脚本位置**: `frontend/src/app/services/__tests__/userService.test.ts`

---

### ATB-002-04: AssetDetailModal 组件验证

**功能描述**: 验证资产详情弹窗正确获取和显示图谱数据

| 测试步骤 | 操作描述 | 预期结果 | 物理测试命令/方法 |
|----------|----------|----------|-------------------|
| 1 | 导入 AssetDetailModal 组件 | 无编译错误 | `tsc --noEmit frontend/src/app/components/AssetDetailModal.tsx` |
| 2 | 检查 mockGraphifySearch 调用 | 函数调用传入正确的参数 | 静态代码分析 |
| 3 | 模拟打开资产详情弹窗 | 图谱数据被请求且返回结果 | Playwright E2E 测试 |
| 4 | 验证资产详情数据加载 | 资产名称、序列号等属性正确显示 | Playwright E2E 测试 |

**通过标准**: 
- TypeScript 编译通过
- 组件不渲染 "No matching nodes found" 错误
- 资产详情正确显示

**测试脚本位置**: `frontend/src/app/components/__tests__/AssetDetailModal.test.tsx`

---

### ATB-002-05: CustomNodes 组件验证

**功能描述**: 验证自定义节点组件正确接收和渲染图谱节点

| 测试步骤 | 操作描述 | 预期结果 | 物理测试命令/方法 |
|----------|----------|----------|-------------------|
| 1 | 导入 CustomNodes 模块 | 无编译错误 | `tsc --noEmit frontend/src/app/components/flow/CustomNodes.tsx` |
| 2 | 检查节点类型处理 | AssetNode, DeptNode 等函数定义存在 | 静态代码分析 |
| 3 | 传入模拟节点数据 | 组件正确渲染节点 | 单元测试 with React Testing Library |
| 4 | 验证节点样式 | 节点样式与设计稿一致 | Visual Regression Test |

**通过标准**: 
- TypeScript 编译通过
- 节点组件可接收 GraphNode 类型数据
- 节点正确渲染，无空白或错误状态

**测试脚本位置**: `frontend/src/app/components/flow/__tests__/CustomNodes.test.tsx`

---

### ATB-002-06: WorkflowDesigner 页面验证

**功能描述**: 验证工作流设计器页面正确集成图谱功能

| 测试步骤 | 操作描述 | 预期结果 | 物理测试命令/方法 |
|----------|----------|----------|-------------------|
| 1 | 导入 WorkflowDesigner 组件 | 无编译错误 | `tsc --noEmit frontend/src/app/pages/WorkflowDesigner.tsx` |
| 2 | 检查图谱数据加载逻辑 | useEffect 或状态初始化正确 | 静态代码分析 |
| 3 | 访问工作流设计器页面 | 页面加载成功，无空白 | Playwright E2E 测试 |
| 4 | 验证图谱画布初始化 | 图谱画布正确渲染 | Playwright E2E 测试 |

**通过标准**: 
- TypeScript 编译通过
- 页面加载时间 ≤ 3s
- 图谱画布可见且可交互

**测试脚本位置**: `frontend/src/app/pages/__tests__/WorkflowDesigner.test.tsx`

---

### ATB-002-07: 性能基准验证

**功能描述**: 验证图谱功能满足性能要求

| 指标 | 阈值 | 测试方法 |
|------|------|----------|
| 后端 API P50 响应时间 | ≤ 50ms | `locust -f tests/perf/test_graphify.py --headless -t 60s --RPS 10` |
| 后端 API P95 响应时间 | ≤ 150ms | 同上 |
| 后端 API P99 响应时间 | ≤ 200ms | 同上 |
| 前端图谱加载时间 | ≤ 1s | Playwright `page.waitForSelector` 计时 |
| 错误率 | ≤ 0.1% | 同 locust 测试 |

---

### ATB-002-08: 安全基准验证

**功能描述**: 验证图谱功能无安全漏洞

| 检查项 | 标准 | 测试方法 |
|--------|------|----------|
| 输入验证 | 所有用户输入经过验证 | `pytest tests/security/test_input_validation.py` |
| 错误信息 | 不暴露敏感信息 | 手动检查错误响应 |
| TypeScript 严格模式 | 无 any 类型滥用 | `tsc --strict` |

---

## 开发切入层级序列

### 开发序列图

```
Phase 2.1: 后端图谱核心层
   │
   ├── Layer 2.1.1: GraphifyNodeRegistry 修复
   │       ├── 检查 __init__ 方法初始化逻辑
   │       ├── 检查 get_all_nodes 方法实现
   │       └── 交付物: endless_daemon.py 修复版本
   │
   └── Layer 2.1.2: 默认节点初始化
           ├── 实现 initialize_default_nodes 函数
           ├── 创建示例节点数据
           └── 交付物: 至少 5 个可查询节点

Phase 2.2: 前端服务层
   │
   ├── Layer 2.2.1: userService.ts 修复
   │       ├── 检查 mockGraphifySearch 函数实现
   │       ├── 修复返回数据结构
   │       └── 交付物: userService.ts 修复版本
   │
   └── Layer 2.2.2: 类型定义
           └── 交付物: flow.ts 类型定义完善

Phase 2.3: 组件层
   │
   ├── Layer 2.3.1: AssetDetailModal 修复
   │       ├── 检查 mockGraphifySearch 调用
   │       ├── 修复数据获取逻辑
   │       └── 交付物: AssetDetailModal.tsx 修复版本
   │
   ├── Layer 2.3.2: CustomNodes 修复
   │       ├── 检查节点渲染逻辑
   │       ├── 确保数据正确传递
   │       └── 交付物: CustomNodes.tsx 修复版本
   │
   └── Layer 2.3.3: WorkflowDesigner 修复
           ├── 检查图谱数据集成
           ├── 确保初始化逻辑正确
           └── 交付物: WorkflowDesigner.tsx 修复版本

Phase 2.4: 集成与验证
   │
   ├── Layer 2.4.1: 单元测试
   │       ├── 后端: pytest tests/test_graphify_*.py
   │       ├── 前端: jest src/app/**/*.test.ts(x)
   │       └── 覆盖率目标: ≥ 80%
   │
   ├── Layer 2.4.2: 集成测试
   │       └── API 端到端测试
   │
   └── Layer 2.4.3: E2E 测试
           └── Playwright E2E 测试
```

### 编码顺序指南

| 顺序 | 层级 | 关键检查点 | 依赖关系 |
|------|------|------------|----------|
| 1 | 后端图谱核心 | GraphifyNodeRegistry 实现正确 | 无 |
| 2 | 后端 API | REST 端点返回正确数据 | 依赖 1 |
| 3 | 前端服务 | userService API 调用正确 | 依赖 2 |
| 4 | 组件层 | 组件正确使用服务 | 依赖 3 |
| 5 | 集成验证 | 端到端功能正常 | 依赖 4 |

### 代码质量门禁

```yaml
quality_gates:
  # 静态分析
  sonarqube:
    bugs: 0
    vulnerabilities: 0
    code_smells: ≤ 5
  
  # 测试覆盖
  coverage:
    line_coverage: ≥ 80%
    branch_coverage: ≥ 70%
    critical_functions: 100%
  
  # 代码检查
  linting:
    python:
      tool: pylint
      score: ≥ 8.0
      violations: 0 (Critical/Blocker)
    typescript:
      tool: eslint
      violations: 0 (Critical/Blocker)
      warnings: ≤ 10
  
  # TypeScript 严格性
  typescript:
    strict_mode: true
    no_implicit_any: true
    strict_null_checks: true
```

### 关键文件修改清单

| 序号 | 文件路径 | 修改类型 | 修改内容摘要 |
|------|----------|----------|--------------|
| 1 | `endless_daemon.py` | Bug Fix | 修复 GraphifyNodeRegistry 初始化和查询逻辑 |
| 2 | `frontend/src/app/services/userService.ts` | Bug Fix | 修复 mockGraphifySearch 返回数据结构 |
| 3 | `frontend/src/app/components/AssetDetailModal.tsx` | Bug Fix | 修复图谱数据获取逻辑 |
| 4 | `frontend/src/app/components/flow/CustomNodes.tsx` | Bug Fix | 修复节点渲染数据源问题 |
| 5 | `frontend/src/app/pages/WorkflowDesigner.tsx` | Bug Fix | 修复图谱数据集成逻辑 |

---

## 附录

### 术语表

| 术语 | 定义 | 英文 |
|------|------|------|
| ATB | Acceptance Test Baseline，验收测试基准 | Acceptance Test Baseline |
| E2E | End-to-End，端到端测试 | End-to-End Testing |
| Graphify | 知识图谱模块名称 | Knowledge Graph Module |
| P50/P95/P99 | 百分位数延迟指标 | Percentile Latency |
| QPS | Queries Per Second，每秒查询数 | Queries Per Second |
| Registry | 注册表，用于管理节点 | Node Registry |

### 参考文档

| 文档 | 路径 | 版本 |
|------|------|------|
| 项目计划 | `/docs/plan.md` | v1.0 |
| 架构设计 | `/docs/architecture.md` | v1.0 |
| API 规范 | `/docs/api/openapi.yaml` | v1.0 |
| 测试规范 | `/docs/testing/README.md` | v1.0 |

### 相关用户故事

| 用户故事 | 关联描述 |
|----------|----------|
| US-001 | 系统基础架构搭建（前置依赖） |
| US-002 | Graphify 知识图谱核心功能修复（当前） |
| US-003 | 资产详情页面增强（依赖 US-002） |
| US-004 | 工作流设计器功能完善（依赖 US-002） |

### 问题追踪

| Issue ID | 描述 | 状态 |
|----------|------|------|
| GH-001 | Graphify 知识图谱 "No matching nodes found" | Open |
| GH-002 | AssetDetailModal 组件图谱数据加载失败 | Open |
| GH-003 | WorkflowDesigner 页面图谱无法渲染 | Open |

---

**文档状态**: Active  
**下次评审**: Iteration 1 完成后  
**变更历史**: 无