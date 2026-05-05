# US-003 规格指导文档

**版本**: Iteration 1  
**状态**: Approved  
**创建日期**: 2024  

---

## 1. 需求与背景

### 1.1 任务概述

US-003 定义了 Graphify 知识图谱系统中节点查询与关系遍历的核心功能模块。本次迭代聚焦于修复知识图谱节点查询场景下的"No matching nodes found"缺陷，确保用户执行图谱查询时能够获得准确的匹配结果反馈。

### 1.2 业务背景

| 业务场景 | 描述 |
|----------|------|
| 资产关联查询 | 用户需通过知识图谱查询资产之间的关联关系 |
| 部门关系可视化 | 展示组织架构中部门与资产的所有权关系 |
| 故障传播分析 | 追踪资产故障在关联资产间的传播路径 |

### 1.3 技术背景

- **图数据库**: 基于 Neo4j/JanusGraph 的图存储引擎
- **查询层**: 自研 GraphQL 兼容查询接口
- **前端渲染**: React + TypeScript 图谱可视化组件

---

## 2. 当前 Phase 对应实施目标

**对应 Phase**: Phase 2.1 - 图谱查询核心功能修复

### 2.1 本次迭代目标

| 目标编号 | 描述 | 优先级 |
|----------|------|--------|
| OBJ-001 | 修复空结果集的标准化响应格式 | P0 |
| OBJ-002 | 实现节点查询的空值保护机制 | P0 |
| OBJ-003 | 补充查询结果的用户友好提示文案 | P1 |

### 2.2 交付物清单

| 交付物 | 文件路径 | 描述 |
|--------|----------|------|
| 资产详情弹窗组件 | `frontend/src/app/components/AssetDetailModal.tsx` | 展示资产节点详情，处理空数据场景 |
| 自定义图谱节点组件 | `frontend/src/app/components/flow/CustomNodes.tsx` | 知识图谱渲染节点组件 |
| 系统设置页面 | `frontend/src/app/pages/Settings.tsx` | 修复图谱配置项的空值处理 |
| 工作流设计器页面 | `frontend/src/app/pages/WorkflowDesigner.tsx` | 工作流图谱节点的查询逻辑 |
| 用户服务层 | `frontend/src/app/services/userService.ts` | 用户-资产关联查询接口 |

---

## 3. 边界约束

### 3.1 功能边界

```
✓ 支持节点 ID 精确查询
✓ 支持节点属性模糊匹配查询
✓ 支持关系类型过滤查询
✓ 支持查询结果为空时的标准化响应
✗ 不支持图谱的写操作（CRUD）—— 属于 US-005
✗ 不支持 Cypher/Gremlin 等原生图查询语言
✗ 不支持跨图数据库联邦查询
```

### 3.2 数据边界

| 约束项 | 限制值 | 说明 |
|--------|--------|------|
| 单次查询最大返回节点数 | 500 | 超出分页处理 |
| 查询超时时间 | 5000ms | 防止慢查询阻塞 |
| 支持的属性类型 | string, number, boolean, date | 复合类型需序列化 |
| 图数据库连接池 | 10 connections | 资源限制 |

### 3.3 错误边界

| 错误类型 | 用户可见文案 | HTTP 状态码 |
|----------|--------------|-------------|
| 无匹配节点 | "No matching nodes found. Try adjusting your search criteria." | 200 |
| 查询超时 | "Query timed out. Please try again later." | 408 |
| 数据库连接失败 | "Graph database unavailable. Please contact support." | 503 |
| 无效查询参数 | "Invalid query parameters provided." | 400 |

### 3.4 性能约束

- 图谱渲染首屏加载时间 < 2s
- 节点悬停响应延迟 < 100ms
- 500 节点图谱缩放/拖拽帧率 ≥ 30fps

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试层级

#### TC-US003-UT-01: 节点查询空结果处理

```typescript
// frontend/src/app/components/flow/CustomNodes.spec.ts
describe('CustomNodes', () => {
  it('should render empty state message when no nodes match', () => {
    // Given: 模拟查询返回空数组
    const mockNodes: GraphNode[] = [];
    
    // When: 调用节点渲染逻辑
    const result = renderEmptyState(mockNodes);
    
    // Then: 断言显示 "No matching nodes found" 文案
    expect(result).toContain('No matching nodes found');
  });
});
```

#### TC-US003-UT-02: 资产详情弹窗空数据渲染

```typescript
// frontend/src/app/components/AssetDetailModal.spec.ts
describe('AssetDetailModal', () => {
  it('should display placeholder when asset details are unavailable', () => {
    // Given: 资产数据为 null
    const mockAsset = null;
    
    // When: 渲染资产详情弹窗
    const wrapper = mount(AssetDetailModal, { props: { asset: mockAsset } });
    
    // Then: 断言显示空数据占位符
    expect(wrapper.find('[data-testid="empty-asset-placeholder"]')).toBeTruthy();
  });
});
```

#### TC-US003-UT-03: 用户服务层空响应处理

```typescript
// frontend/src/app/services/userService.spec.ts
describe('userService', () => {
  it('should return empty array on query failure', async () => {
    // Given: API 返回 404
    jest.spyOn(api, 'get').mockRejectedValue(new Error('Not Found'));
    
    // When: 调用 getUserAssets
    const result = await userService.getUserAssets('user-123');
    
    // Then: 断言返回空数组而非抛出异常
    expect(result).toEqual([]);
  });
});
```

### 4.2 集成测试层级

#### TC-US003-IT-01: 端到端图谱查询流程

```typescript
// frontend/src/e2e/graph-query.spec.ts
describe('Graph Query E2E', () => {
  it('should display "No matching nodes found" for empty result', async () => {
    // Given: 用户进入资产图谱页面
    await page.goto('/assets/graph');
    
    // When: 执行无匹配条件的查询
    await page.fill('[data-testid="search-input"]', 'NONEXISTENT_ASSET');
    await page.click('[data-testid="search-button"]');
    
    // Then: 断言页面显示空结果提示
    await expect(page.locator('.graph-empty-state')).toContainText(
      'No matching nodes found'
    );
  });
});
```

### 4.3 验收通过标准

| 验收项 | 通过条件 |
|--------|----------|
| AC-001 | 单元测试覆盖率 ≥ 80%，所有 TC 通过 |
| AC-002 | AST 静态分析无语法错误 |
| AC-003 | 所有导出函数/组件包含 JSDoc 文档注释 |
| AC-004 | 修改文件可被正常 import，无 ImportError |

---

## 5. 开发切入层级序列

### 5.1 Phase 1: 基础设施修复 (Day 1)

```
backend/
└── src/
    └── main/
        └── java/
            └── com/
                └── ams/
                    └── endless_daemon.py  ← 修复语法错误
```

**关键步骤**:
1. 修复 `endless_daemon.py` 第 1 行语法错误（当前硬阻塞）
2. 验证 Python 模块可被正常 import
3. 确认后端服务启动无异常

### 5.2 Phase 2: 前端组件修复 (Day 2-3)

```
frontend/src/app/
├── components/
│   ├── AssetDetailModal.tsx      ← 空数据处理修复
│   └── flow/
│       └── CustomNodes.tsx       ← 空节点状态渲染
├── pages/
│   ├── Settings.tsx              ← 图谱配置空值保护
│   └── WorkflowDesigner.tsx       ← 工作流节点查询修复
└── services/
    └── userService.ts            ← 用户关联查询异常处理
```

**关键步骤**:
1. 为所有组件函数添加 JSDoc 文档注释
2. 实现空结果集的标准化 UI 展示
3. 添加 TypeScript 类型守卫，防止 null/undefined 访问
4. 补充 React ErrorBoundary 组件

### 5.3 Phase 3: 单元测试补全 (Day 4)

```
frontend/src/
├── app/
│   ├── components/
│   │   ├── AssetDetailModal.spec.tsx
│   │   └── flow/
│   │       └── CustomNodes.spec.tsx
│   └── services/
│       └── userService.spec.ts
└── test/
    └── setup.ts  ← Jest/Vitest 配置
```

**关键步骤**:
1. 补充 `frontend/src/test/setup.ts` 测试脚手架
2. 为所有修改文件编写对应 `.spec.ts` 测试文件
3. 执行 `npm run test` 确保全部测试通过

### 5.4 Phase 4: 验收确认 (Day 5)

1. 执行 AST 静态分析，确认无语法错误
2. 运行单元测试，生成覆盖率报告
3. 执行集成冒烟测试
4. 提交 PR，触发 CI 流水线

---

## 附录

### A. 关键依赖

| 依赖项 | 版本 | 用途 |
|--------|------|------|
| React | ^18.x | UI 框架 |
| TypeScript | ^5.x | 类型检查 |
| Vitest | ^1.x | 单元测试 |
| @testing-library/react | ^14.x | React 组件测试 |
| Tailwind CSS | ^3.x | 样式框架 |

### B. 文件修改清单

| 文件名 | 修改类型 | 变更要点 |
|--------|----------|----------|
| `endless_daemon.py` | Bug Fix | 修复第 1 行语法错误 |
| `AssetDetailModal.tsx` | Enhancement | 添加空数据占位符 |
| `CustomNodes.tsx` | Enhancement | 实现空节点状态组件 |
| `Settings.tsx` | Enhancement | 添加配置项空值保护 |
| `WorkflowDesigner.tsx` | Enhancement | 修复工作流节点查询 |
| `userService.ts` | Enhancement | 补充异常处理逻辑 |

### C. 参考文档

- [Graphify 架构设计](./docs/architecture/graphify-design.md)
- [前端组件规范](./docs/frontend/component-guidelines.md)
- [单元测试模板](./docs/testing/templates/ComponentTestTemplate.tsx)