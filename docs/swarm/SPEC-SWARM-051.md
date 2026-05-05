# SWARM-051 前端集成-资产详情页面开发规格文档

## 文档信息

| 属性 | 内容 |
|------|------|
| **任务编号** | SWARM-051 |
| **任务名称** | 前端集成-资产详情页面开发 |
| **文档版本** | v1.0 |
| **适用迭代** | Iteration 1 |
| **文档状态** | 已审核 |
| **创建日期** | 2025-01-20 |

---

## 1. 需求与背景

### 1.1 业务背景

Graphify 知识图谱平台资产管理系统已完成基础架构搭建，当前阶段需要实现资产详情页面的完整前端集成链路。资产详情页面是用户查看资产全量信息的核心入口，承载着资产属性展示与变更历史追溯的双重职责。

当前系统面临的核心痛点体现在以下方面：

- **资产详情展示缺失**：用户无法在界面上查看资产的完整属性信息、扩展元数据及关联关系图谱
- **审计日志断裂**：资产变更历史分散在后台日志中，前端缺乏可视化呈现手段
- **@Auditable 注解未绑定**：后端通过 `@Auditable` 注解标记的可审计字段变更无法在前端追溯
- **AuditService 未对接**：前端与服务层之间缺乏标准化的 API 调用规范

### 1.2 核心需求

本次前端集成任务需覆盖以下四个维度：

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| REQ-051-01 | 实现资产详情展示组件（AssetDetailPage），渲染资产基础属性、扩展属性及关联关系图谱 | P0 |
| REQ-051-02 | 集成审计日志展示模块（AuditLogPanel），支持操作记录的查询与展示 | P0 |
| REQ-051-03 | 绑定 @Auditable 注解数据可视化，高亮展示被审计字段的变更状态 | P1 |
| REQ-051-04 | 对接 AuditService 服务层，实现前后端标准 API 通信 | P0 |

### 1.3 关联上下文

本次任务涉及的核心文件及其职责：

| 文件路径 | 职责说明 | 相关度 |
|----------|----------|--------|
| `frontend/src/app/types/audit.types.ts` | 定义审计日志数据类型接口 | 高 |
| `frontend/src/app/components/flow/CustomNodes.tsx` | Graphify 知识图谱节点渲染组件 | 高 |
| `frontend/src/app/services/userService.ts` | 用户服务层（包含 AuditService 调用示例） | 中 |
| `frontend/src/app/services/auditApi.ts` | 审计 API 封装 | 待创建/完善 |
| `tests/test_audit_aspect.py` | 审计切面测试用例 | 中 |

---

## 2. 当前 Phase 对应实施目标

基于系统架构设计，本次 SWARM-051 任务在 Iteration 1 中分 5 个 Phase 实施，每个 Phase 均有明确的交付物与验收标准。

### Phase 1: 资产详情基础组件开发

| 属性 | 内容 |
|------|------|
| **目标** | 实现资产详情页面的基础框架与核心信息卡片组件 |
| **交付物** | `AssetDetailPage` 页面容器、`AssetInfoCard` 信息卡片组件 |
| **验收标准** | 页面正常加载，资产基础信息正确展示 |

### Phase 2: 数据绑定与状态管理

| 属性 | 内容 |
|------|------|
| **目标** | 对接 AssetService API，将资产数据纳入前端状态管理 |
| **交付物** | 数据服务层集成、TypeScript 类型完善、状态管理配置 |
| **验收标准** | API 调用成功，数据正确渲染，无控制台 Error |

### Phase 3: 审计日志模块集成

| 属性 | 内容 |
|------|------|
| **目标** | 实现 AuditLogPanel 面板组件，对接 AuditService API |
| **交付物** | `AuditLogPanel` 组件、`AuditLogItem` 单条日志组件 |
| **验收标准** | 审计日志列表正确展示，包含操作类型、时间、操作人 |

### Phase 4: @Auditable 字段可视化增强

| 属性 | 内容 |
|------|------|
| **目标** | 解析后端返回的 `auditableFields` 元数据，高亮展示变更追踪字段 |
| **交付物** | 高亮样式定义、变更前后值对比展示逻辑 |
| **验收标准** | @Auditable 标注字段具有可见的视觉标记 |

### Phase 5: 响应式与边界处理

| 属性 | 内容 |
|------|------|
| **目标** | 覆盖异常状态、Loading、Empty 等边界场景 |
| **交付物** | Loading Skeleton、Error State、Empty State 组件 |
| **验收标准** | 各类边界场景均有友好提示，不出现白屏或空白区域 |

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 限定条件 | 备注 |
|--------|----------|------|
| **支持资产类型** | 仅限 `Node`、`Relationship`、`Property` 三类资产 | 其他类型暂不纳入展示范围 |
| **审计日志范围** | 仅展示当前资产关联的审计记录 | 不支持跨资产联合查询 |
| **分页限制** | 默认 20 条/页，支持"加载更多" | 不设置最大页数限制 |
| **时间范围** | 默认查询最近 90 天数据 | 超出范围需手动调整筛选条件 |
| **操作类型过滤** | 支持 CREATE、UPDATE、DELETE、VIEW 四种类型 | 其他类型归入 UNKNOWN 分类 |

### 3.2 技术约束

| 约束项 | 限定条件 | 备注 |
|--------|----------|------|
| **前端框架** | Vue 3 Composition API 或 React 18+ Hooks | 依据现有技术栈选择 |
| **UI 组件库** | 平台统一 UI 库（Element Plus / Ant Design） | 保持视觉风格统一 |
| **状态管理** | 平台既有状态管理方案 | 不引入新的状态管理库 |
| **API 规范** | RESTful API，遵循统一 JSON Schema | 请求/响应格式标准化 |
| **环境隔离** | 通过环境变量切换 dev/test/staging | 禁止硬编码配置 |

### 3.3 数据约束

| 约束项 | 限定条件 | 备注 |
|--------|----------|------|
| **数据不可变性** | 审计日志仅支持展示与筛选 | 前端不可直接修改审计数据 |
| **敏感字段处理** | 密码、密钥等字段不得明文展示 | 后端需标记 sensitiveFields |
| **路由参数** | 必须携带 `assetId` 参数 | 格式：`/asset/detail/{assetId}` |
| **数据类型校验** | 严格遵循 TypeScript 接口定义 | 运行时类型错误需上报 |

### 3.4 已知问题约束

> ⚠️ **当前阻塞问题**：`[Graphify 知识图谱] No matching nodes found`
>
> 本次集成任务需同步解决 Graphify 节点渲染问题，确保资产关联图谱能够正确展示。根因分析与修复方案参见 `frontend/src/app/components/flow/CustomNodes.tsx` 中的节点工厂函数。

---

## 4. 验收测试基准 (ATB)

### 4.1 概述

本章节定义 SWARM-051 任务的物理测试验收基准，每一项 ATB 均对应具体的测试场景与期待结果。测试用例基于 Playwright/pytest 框架编写，可在 CI/CD 流水线中自动化执行。

### 4.2 测试用例矩阵

| ATB 编号 | 测试场景 | 验证方法 | 关键断言 |
|----------|----------|----------|----------|
| ATB-051-01 | 资产详情页面正常渲染 | E2E | 页面 title、资产名称卡片可见 |
| ATB-051-02 | 资产信息卡片数据展示 | E2E | 字段映射正确性 |
| ATB-051-03 | 审计日志面板展示 | E2E | 默认加载 20 条记录 |
| ATB-051-04 | @Auditable 字段高亮 | E2E | 高亮样式类存在 |
| ATB-051-05 | AuditService API 对接 | E2E + Mock | 请求参数、响应状态码 |
| ATB-051-06 | 分页加载功能 | E2E | 加载后记录数增加 |
| ATB-051-07 | 资产不存在边界处理 | E2E | 404 提示、面板隐藏 |
| ATB-051-08 | Loading 状态展示 | E2E | Skeleton 可见→消失 |

---

### 4.3 ATB-051-01: 资产详情页面正常渲染

**测试目的**：验证资产详情页面能够正常加载，核心 UI 元素按预期展示。

**前置条件**：
- 测试环境已启动（`http://localhost:5173`）
- 存在有效的测试资产数据（`assetId: test-asset-001`）

**测试步骤**：

```gherkin
Scenario: 资产详情页面正常渲染
  Given 用户已登录系统
  When 用户访问 "/asset/detail/test-asset-001"
  Then 页面应展示资产详情标题
  And 资产名称卡片应可见
  And 控制台无 Error 级别日志
```

**物理测试代码（Playwright）**：

```typescript
// frontend/tests/e2e/asset-detail.spec.ts
import { test, expect } from '@playwright/test';

test.describe('SWARM-051: 资产详情页面渲染', () => {
  test.beforeEach(async ({ page }) => {
    // Mock AuditService API
    await page.route('**/api/audit/logs/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          total: 0,
          pageSize: 20,
          currentPage: 1,
        }),
      });
    });
  });

  test('ATB-051-01: 资产详情页面正常渲染', async ({ page }) => {
    // Step 1: 导航至资产详情页
    await page.goto('/asset/detail/test-asset-001');

    // Step 2: 验证页面 title 或关键 heading 可见
    const heading = page.locator('h1, [data-testid="page-heading"]').first();
    await expect(heading).toBeVisible();

    // Step 3: 验证资产名称卡片加载完成
    const assetNameCard = page.locator('[data-testid="asset-name-card"]');
    await expect(assetNameCard).toBeVisible();

    // Step 4: 验证无控制台 Error 级别日志
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 等待页面完全加载
    await page.waitForLoadState('networkidle');
    expect(consoleErrors).toHaveLength(0);
  });
});
```

**验收标准**：
- ✅ 页面 HTTP 响应状态码为 200
- ✅ 资产名称卡片 `[data-testid="asset-name-card"]` 可见
- ✅ 控制台 Error 日志数量为 0

---

### 4.4 ATB-051-02: 资产信息卡片数据展示

**测试目的**：验证资产详情页中的信息卡片能够正确展示资产字段数据，字段映射准确无误。

**前置条件**：
- Mock API 返回有效的资产详情数据
- 资产包含完整的字段：name, type, createdAt, status, owner

**物理测试代码**：

```typescript
// frontend/tests/e2e/asset-detail.spec.ts
test('ATB-051-02: 资产信息卡片数据展示', async ({ page }) => {
  const mockAssetData = {
    id: 'test-asset-001',
    name: '服务器集群-A组',
    type: 'Node',
    status: 'ACTIVE',
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-01-18T14:22:00Z',
    owner: '张三',
    department: '基础设施部',
  };

  // Mock AssetService API
  await page.route('**/api/assets/test-asset-001', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAssetData),
    });
  });

  // Navigate to asset detail page
  await page.goto('/asset/detail/test-asset-001');

  // Verify field mapping correctness
  const nameField = page.locator('[data-testid="field-name"]');
  const typeField = page.locator('[data-testid="field-type"]');
  const statusField = page.locator('[data-testid="field-status"]');
  const createdAtField = page.locator('[data-testid="field-createdAt"]');
  const ownerField = page.locator('[data-testid="field-owner"]');

  await expect(nameField).toHaveText('服务器集群-A组');
  await expect(typeField).toHaveText('Node');
  await expect(statusField).toHaveText('ACTIVE');
  await expect(createdAtField).toContainText('2025-01-15');
  await expect(ownerField).toHaveText('张三');
});
```

**验收标准**：
- ✅ 资产名称字段值与 API 响应一致
- ✅ 资产类型字段值正确（`Node`/`Relationship`/`Property`）
- ✅ 创建时间格式化展示（不含 ISO 时区后缀）
- ✅ 所有必填字段均可见，无遗漏

---

### 4.5 ATB-051-03: 审计日志面板展示

**测试目的**：验证审计日志面板能够正确加载并展示资产的操作记录列表。

**前置条件**：
- Mock AuditService API 返回至少 20 条审计日志记录
- 每条记录包含 action, timestamp, operator, entityType, entityId

**物理测试代码**：

```typescript
test('ATB-051-03: 审计日志面板展示', async ({ page }) => {
  const mockAuditLogs = generateMockAuditLogs(25);

  await page.route('**/api/audit/logs/**', async (route) => {
    const url = route.request().url();
    const params = new URL(url).searchParams;
    const pageSize = parseInt(params.get('pageSize') || '20');
    const currentPage = parseInt(params.get('currentPage') || '1');

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: mockAuditLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize),
        total: mockAuditLogs.length,
        pageSize,
        currentPage,
      }),
    });
  });

  await page.goto('/asset/detail/test-asset-001');

  // Scroll to audit log panel
  const auditPanel = page.locator('[data-testid="audit-log-panel"]');
  await auditPanel.scrollIntoViewIfNeeded();
  await expect(auditPanel).toBeVisible();

  // Verify default load 20 records
  const logItems = page.locator('[data-testid="audit-log-item"]');
  await expect(logItems).toHaveCount(20);

  // Verify log item contains necessary fields
  const firstLog = logItems.first();
  await expect(firstLog.locator('[data-testid="log-action"]')).toBeVisible();
  await expect(firstLog.locator('[data-testid="log-timestamp"]')).toBeVisible();
  await expect(firstLog.locator('[data-testid="log-operator"]')).toBeVisible();
});
```

**验收标准**：
- ✅ 审计日志面板可见
- ✅ 默认加载 20 条记录
- ✅ 每条日志包含操作类型（action）、时间戳（timestamp）、操作人（operator）
- ✅ 列表按时间倒序排列

---

### 4.6 ATB-051-04: @Auditable 字段高亮展示

**测试目的**：验证后端通过 `@Auditable` 注解标记的字段变更能够在前端以高亮样式呈现。

**前置条件**：
- 后端返回数据包含 `metadata.auditableFields` 数组
- 前端已定义 `.auditable-highlight` CSS 类

**物理测试代码**：

```typescript
test('ATB-051-04: @Auditable 字段高亮展示', async ({ page }) => {
  const mockAssetData = {
    id: 'test-asset-001',
    name: '服务器集群-A组',
    type: 'Node',
    metadata: {
      auditableFields: ['name', 'status', 'owner'],
    },
  };

  await page.route('**/api/assets/test-asset-001', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAssetData),
    });
  });

  await page.goto('/asset/detail/test-asset-001');

  // Verify each auditable field has highlight class
  const auditableFields = ['name', 'status', 'owner'];
  for (const field of auditableFields) {
    const fieldSelector = `[data-testid="field-${field}"]`;
    const fieldElement = page.locator(fieldSelector);
    await expect(fieldElement).toBeVisible();

    const classAttribute = await fieldElement.getAttribute('class');
    expect(classAttribute).toContain('auditable-highlight');
  }

  // Verify non-auditable field does not have highlight
  const nonAuditableField = page.locator('[data-testid="field-type"]');
  const nonAuditableClass = await nonAuditableField.getAttribute('class');
  expect(nonAuditableClass).not.toContain('auditable-highlight');
});
```

**验收标准**：
- ✅ `auditableFields` 中的字段具有 `auditable-highlight` CSS 类
- ✅ 非 `@Auditable` 字段不具有高亮样式
- ✅ 高亮样式在 Light/Dark 主题下均可见（对比度 ≥ 4.5:1）

---

### 4.7 ATB-051-05: AuditService API 对接验证

**测试目的**：验证前端与 AuditService 服务层的 API 通信符合规范，请求参数与响应格式正确。

**前置条件**：
- 后端 AuditService 已部署
- Mock Server 可拦截并返回符合 Schema 的响应

**物理测试代码**：

```typescript
test('ATB-051-05: AuditService API 对接验证', async ({ page }) => {
  const apiRequests: Request[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/api/audit/')) {
      apiRequests.push(request);
    }
  });

  await page.goto('/asset/detail/test-asset-001');

  // Wait for audit API call
  await page.waitForResponse('**/api/audit/logs/**');

  // Verify at least one audit API call was made
  expect(apiRequests.length).toBeGreaterThan(0);

  // Verify request parameters
  const auditRequest = apiRequests[0];
  const requestUrl = auditRequest.url();

  expect(requestUrl).toContain('assetId=test-asset-001');
  expect(requestUrl).toContain('pageSize=20');

  // Verify request method
  expect(auditRequest.method()).toBe('GET');

  // Verify response status code
  const response = await auditRequest.response();
  expect(response?.status()).toBe(200);
});
```

**验收标准**：
- ✅ 发起 GET 请求至 `/api/audit/logs/{assetId}`
- ✅ URL 参数包含 `assetId`、`pageSize=20`、`currentPage=1`
- ✅ 响应状态码为 200
- ✅ 响应体符合 JSON Schema（包含 data, total, pageSize, currentPage）

---

### 4.8 ATB-051-06: 分页加载功能

**测试目的**：验证审计日志支持"加载更多"分页功能，加载后记录数正确累加。

**前置条件**：
- Mock AuditService 返回总数 ≥ 40 条日志
- UI 提供"加载更多"按钮

**物理测试代码**：

```typescript
test('ATB-051-06: 分页加载功能', async ({ page }) => {
  const mockAuditLogs = generateMockAuditLogs(50);

  await page.route('**/api/audit/logs/**', async (route) => {
    const url = route.request().url();
    const params = new URL(url).searchParams;
    const pageSize = parseInt(params.get('pageSize') || '20');
    const currentPage = parseInt(params.get('currentPage') || '1');

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: mockAuditLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize),
        total: mockAuditLogs.length,
        pageSize,
        currentPage,
      }),
    });
  });

  await page.goto('/asset/detail/test-asset-001');

  // Scroll to audit panel and verify initial count
  await page.locator('[data-testid="audit-log-panel"]').scrollIntoViewIfNeeded();
  const initialLogs = page.locator('[data-testid="audit-log-item"]');
  await expect(initialLogs).toHaveCount(20);

  // Click "Load More" button
  const loadMoreBtn = page.locator('[data-testid="load-more-btn"]');
  await expect(loadMoreBtn).toBeVisible();
  await loadMoreBtn.click();

  // Wait for second page to load
  await page.waitForResponse('**/api/audit/logs/**');

  // Verify log count increased to 40
  const updatedLogs = page.locator('[data-testid="audit-log-item"]');
  await expect(updatedLogs).toHaveCount(40);

  // Verify "Load More" button is still visible (more data available)
  await expect(loadMoreBtn).toBeVisible();
});
```

**验收标准**：
- ✅ 初始加载 20 条记录
- ✅ 点击"加载更多"后，记录数增加至 40
- ✅ 新请求携带 `currentPage=2` 参数
- ✅ 加载过程中显示 Loading 状态

---

### 4.9 ATB-051-07: 边界场景 - 资产不存在

**测试目的**：验证当资产 ID 不存在时，页面能够优雅降级，展示 404 提示而非崩溃。

**前置条件**：
- 后端返回 404 状态码
- 资产 ID 为无效值（如 `invalid-id-999`）

**物理测试代码**：

```typescript
test('ATB-051-07: 资产不存在边界处理', async ({ page }) => {
  await page.route('**/api/assets/invalid-id-999', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'ASSET_NOT_FOUND',
        message: '资产不存在或已被删除',
      }),
    });
  });

  await page.goto('/asset/detail/invalid-id-999');

  // Verify 404 error message is displayed
  const errorNotFound = page.locator('[data-testid="error-not-found"]');
  await expect(errorNotFound).toBeVisible();
  await expect(errorNotFound).toContainText('资产不存在');

  // Verify audit log panel is hidden
  const auditPanel = page.locator('[data-testid="audit-log-panel"]');
  await expect(auditPanel).toHaveCount(0);

  // Verify "Back" button is available
  const backBtn = page.locator('[data-testid="back-to-list-btn"]');
  await expect(backBtn).toBeVisible();
});
```

**验收标准**：
- ✅ 展示 404 错误提示（包含"资产不存在"文案）
- ✅ 审计日志面板不渲染
- ✅ 提供"返回列表"导航入口
- ✅ 控制台不抛出未捕获异常

---

### 4.10 ATB-051-08: Loading 状态展示

**测试目的**：验证页面加载过程中正确展示 Loading Skeleton，数据加载完成后自动切换。

**前置条件**：
- 网络请求模拟 1-2 秒延迟
- Loading Skeleton 组件已实现

**物理测试代码**：

```typescript
test('ATB-051-08: Loading 状态展示', async ({ page }) => {
  // Mock API with delay
  await page.route('**/api/assets/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'test-asset-001',
        name: '服务器集群-A组',
        type: 'Node',
      }),
    });
  });

  await page.goto('/asset/detail/test-asset-001');

  // Verify Loading Skeleton is visible initially
  const loadingSkeleton = page.locator('[data-testid="loading-skeleton"]');
  await expect(loadingSkeleton).toBeVisible();

  // Verify asset card is not visible during loading
  const assetCard = page.locator('[data-testid="asset-name-card"]');
  await expect(assetCard).not.toBeVisible();

  // Wait for loading to complete
  await page.waitForSelector('[data-testid="loading-skeleton"]', { state: 'hidden' });

  // Verify skeleton disappears after data loads
  await expect(loadingSkeleton).not.toBeVisible();

  // Verify asset card becomes visible
  await expect(assetCard).toBeVisible();
});
```

**验收标准**：
- ✅ Loading Skeleton 在数据加载前可见
- ✅ 数据加载完成后，Skeleton 自动消失（过渡动画时长 ≤ 300ms）
- ✅ 真实内容在 Skeleton 消失后正确渲染
- ✅ Skeleton 样式与实际内容布局一致

---

## 5. 开发切入层级序列

### 5.1 概述

本章节定义 SWARM-051 任务的技术实现路径，按照依赖关系从底层到上层划分为 6 个 Level，每个 Level 包含具体的任务清单。

### 5.2 层级依赖关系图

```
┌─────────────────────────────────────────────────────────────┐
│                      Level 6: 测试与集成                      │
│         (ATB 物理测试、端到端回归、接口联调)                     │
├─────────────────────────────────────────────────────────────┤
│                      Level 5: 样式与可视化                    │
│        (@Auditable 高亮、变更对比、响应式布局)                  │
├─────────────────────────────────────────────────────────────┤
│                      Level 4: 交互层                          │
│      (筛选器、分页加载、日志展开收起、错误处理)                  │
├─────────────────────────────────────────────────────────────┤
│                      Level 3: 组件层                          │
│  (AssetInfoCard、AuditLogPanel、AuditLogItem)                │
├─────────────────────────────────────────────────────────────┤
│                      Level 2: 数据层                          │
│      (TypeScript 接口、API 封装、数据 Mock)                    │
├─────────────────────────────────────────────────────────────┤
│                      Level 1: 基础设施层                      │
│         (路由配置、页面容器、环境变量)                          │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Level 1: 基础设施层

**目标**：搭建资产详情页面的基础架构，包括路由、页面容器与配置。

**任务清单**：

| 任务编号 | 任务描述 | 产出物 | 依赖方 |
|----------|----------|--------|--------|
| L1-01 | 配置路由 `/asset/detail/:assetId` | `frontend/src/app/routes.ts` 更新 | L2 |
| L1-02 | 创建页面容器组件 `AssetDetailPage` | `AssetDetailPage.tsx` | L3 |
| L1-03 | 配置环境变量 `VITE_API_BASE_URL` | `.env.development` | L2 |
| L1-04 | 安装必要依赖（React Router、Axios） | `package.json` 更新 | - |

**实现示例**：

```typescript
// frontend/src/app/routes.ts
export const routes: RouteConfig[] = [
  // ... existing routes
  {
    path: '/asset/detail/:assetId',
    component: () => import('./pages/asset/AssetDetailPage'),
    meta: {
      title: '资产详情',
      requiresAuth: true,
      breadcrumb: ['首页', '资产管理', '资产详情'],
    },
  },
];
```

### 5.4 Level 2: 数据层

**目标**：定义数据类型接口、封装 API 服务方法、实现开发阶段数据 Mock。

**任务清单**：

| 任务编号 | 任务描述 | 产出物 | 依赖方 |
|----------|----------|--------|--------|
| L2-01 | 完善 `audit.types.ts` 接口定义 | `AssetDetail`, `AuditLogEntry`, `AuditableField` 类型 | L1 |
| L2-02 | 封装 `getAssetDetail()` API 方法 | `assetService.ts` | L3 |
| L2-03 | 封装 `getAuditLogs()` API 方法 | `auditApi.ts` | L3 |
| L2-04 | 实现 MSW (Mock Service Worker) 数据 | `mocks/handlers.ts` | L1 |

**关键接口定义**：

```typescript
// frontend/src/app/types/audit.types.ts
/**
 * 资产详情数据类型
 * @description 包含资产的基础信息与可审计字段元数据
 */
export interface AssetDetail {
  id: string;
  name: string;
  type: 'Node' | 'Relationship' | 'Property';
  status: AssetStatus;
  createdAt: string;
  updatedAt: string;
  owner: string;
  department?: string;
  properties?: Record<string, string | number>;
  metadata?: {
    auditableFields: string[];
    sensitiveFields: string[];
    graphifyNodes?: GraphifyNodeData[];
  };
}

/**
 * 审计日志条目
 * @description 记录资产的操作变更历史
 */
export interface AuditLogEntry {
  id: string;
  entityType: 'Asset' | 'User' | 'Role';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW';
  userId: string;
  operator: string;
  timestamp: string;
  changes?: AuditChange[];
  metadata?: Record<string, unknown>;
}

/**
 * 审计变更记录
 * @description 记录字段变更前后的值
 */
export interface AuditChange {
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
  isAuditable: boolean;
}
```

### 5.5 Level 3: 组件层

**目标**：实现资产详情页的核心展示组件，包括信息卡片、审计日志面板。

**任务清单**：

| 任务编号 | 任务描述 | 产出物 | 依赖方 |
|----------|----------|--------|--------|
| L3-01 | 实现 `AssetInfoCard` 组件 | `components/asset/AssetInfoCard.tsx` | L2 |
| L3-02 | 实现 `AssetMetadataPanel` 组件 | `components/asset/AssetMetadataPanel.tsx` | L2 |
| L3-03 | 实现 `AuditLogPanel` 组件 | `components/audit/AuditLogPanel.tsx` | L2 |
| L3-04 | 实现 `AuditLogItem` 组件 | `components/audit/AuditLogItem.tsx` | L3 |
| L3-05 | 修复 Graphify 节点工厂函数 | `components/flow/CustomNodes.tsx` | 已知问题 |

**组件伪代码示例**：

```tsx
// frontend/src/app/components/audit/AuditLogPanel.tsx
/**
 * 审计日志面板组件
 * @description 展示资产的变更历史记录，支持分页加载与筛选
 * @param {string} assetId - 资产唯一标识
 * @param {AuditLogFilters} filters - 筛选条件
 */
export const AuditLogPanel: React.FC<AuditLogPanelProps> = ({
  assetId,
  filters,
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Fetch audit logs on mount or filter change
  useEffect(() => {
    fetchAuditLogs(assetId, { ...filters, page, pageSize: 20 })
      .then((response) => {
        setLogs((prev) => (page === 1 ? response.data : [...prev, ...response.data]));
        setHasMore(response.data.length === 20);
      })
      .finally(() => setLoading(false));
  }, [assetId, filters, page]);

  return (
    <section data-testid="audit-log-panel" className="audit-log-panel">
      <header className="panel-header">
        <h3>审计日志</h3>
        <AuditLogFiltersPanel filters={filters} onChange={handleFilterChange} />
      </header>
      <div className="log-list">
        {logs.map((log) => (
          <AuditLogItem key={log.id} log={log} />
        ))}
      </div>
      {hasMore && (
        <button
          data-testid="load-more-btn"
          onClick={() => setPage((p) => p + 1)}
          disabled={loading}
        >
          {loading ? '加载中...' : '加载更多'}
        </button>
      )}
    </section>
  );
};
```

### 5.6 Level 4: 交互层

**目标**：实现用户交互功能，包括筛选、分页、展开收起等。

**任务清单**：

| 任务编号 | 任务描述 | 产出物 | 依赖方 |
|----------|----------|--------|--------|
| L4-01 | 实现审计日志时间范围筛选器 | `components/audit/AuditLogFilters.tsx` | L3 |
| L4-02 | 实现操作类型筛选器 | `components/audit/ActionTypeFilter.tsx` | L4-01 |
| L4-03 | 实现分页/加载更多功能 | `AuditLogPanel.tsx` 更新 | L3 |
| L4-04 | 实现日志详情展开/收起 | `AuditLogItem.tsx` 更新 | L3 |
| L4-05 | 实现 Graphify 节点关联图谱交互 | `components/flow/CustomNodes.tsx` | L3 |

### 5.7 Level 5: 样式与可视化层

**目标**：定义视觉样式规范，确保 @Auditable 字段高亮、变更对比等可视化效果。

**任务清单**：

| 任务编号 | 任务描述 | 产出物 | 依赖方 |
|----------|----------|--------|--------|
| L5-01 | 定义 `@Auditable` 字段高亮样式 | `styles/audit.css` | L3 |
| L5-02 | 实现变更前后值对比展示 | `AuditLogItem.tsx` 更新 | L4 |
| L5-03 | 适配响应式布局 | `AssetDetailPage.tsx` 更新 | L3 |
| L5-04 | 适配 Light/Dark 主题 | CSS Variables | L5-01 |

**CSS 样式定义**：

```css
/* frontend/src/styles/audit.css */
/**
 * 审计日志样式表
 * @description 定义 @Auditable 字段高亮、变更对比等视觉样式
 */

/* @Auditable 字段高亮 */
.auditable-highlight {
  position: relative;
  background-color: var(--auditable-highlight-bg, rgba(255, 193, 7, 0.15));
  border-left: 3px solid var(--auditable-highlight-border, #ffc107);
  padding-left: 8px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.auditable-highlight::before {
  content: '🔍';
  position: absolute;
  left: -20px;
  font-size: 12px;
}

/* 变更值对比 */
.change-old-value {
  color: var(--change-old-color, #dc3545);
  text-decoration: line-through;
  opacity: 0.7;
}

.change-new-value {
  color: var(--change-new-color, #28a745);
  font-weight: 600;
}

/* 暗色主题适配 */
[data-theme="dark"] .auditable-highlight {
  background-color: rgba(255, 193, 7, 0.2);
}

[data-theme="dark"] .change-old-value {
  color: #f08080;
}

[data-theme="dark"] .change-new-value {
  color: #90ee90;
}
```

### 5.8 Level 6: 测试与集成

**目标**：完成端到端测试验证，确保与后端 AuditService 联调通过。

**任务清单**：

| 任务编号 | 任务描述 | 产出物 | 依赖方 |
|----------|----------|--------|--------|
| L6-01 | 编写 ATB 物理测试用例 | `tests/e2e/asset-detail.spec.ts` | L5 |
| L6-02 | 与后端 AuditService 接口联调 | 集成测试报告 | L2 |
| L6-03 | 端到端回归验证 | 测试报告 | L6-01 |
| L6-04 | 修复 Graphify 节点渲染问题 | `CustomNodes.tsx` 更新 | 已知问题 |

**Graphify 节点工厂函数修复**（已知问题）：

```tsx
// frontend/src/app/components/flow/CustomNodes.tsx
/**
 * Graphify 节点工厂函数
 * @description 根据节点类型创建对应的 React 组件
 * @param {GraphifyNodeData['nodeType']} nodeType - 节点类型
 * @returns {React.FC<NodeProps<GraphifyNodeData>>} 对应的节点组件
 * @throws {Error} 当节点类型未识别时，返回默认的 AssetNode
 */
export const GraphifyNodeFactory = (
  nodeType: GraphifyNodeData['nodeType']
): React.FC<NodeProps<GraphifyNodeData>> => {
  /**
   * 节点类型与组件的映射表
   * 用于根据传入的 nodeType 返回对应的节点组件
   */
  const nodeTypeComponentMap: Record<string, React.FC<NodeProps<GraphifyNodeData>>> = {
    [GraphifyNodeType.ASSET]: AssetNode,
    [GraphifyNodeType.DOCUMENT]: DocumentNode,
    [GraphifyNodeType.PROCESS]: ProcessNode,
    [GraphifyNodeType.METRIC]: MetricNode,
    [GraphifyNodeType.RELATIONSHIP]: RelationshipNode,
    // 修复: 添加对 'Node' 类型资产的处理
    // 解决 "No matching nodes found" 问题
    'Node': AssetNode,
    'Relationship': RelationshipNode,
    'Property': AssetNode,
  };

  /**
   * 根据节点类型查找对应的组件
   * 如果未找到匹配的节点类型，默认返回 AssetNode
   */
  const component = nodeTypeComponentMap[nodeType];
  
  if (!component) {
    console.warn(`[GraphifyNodeFactory] Unknown node type: ${nodeType}, defaulting to AssetNode`);
  }
  
  return component || AssetNode;
};
```

---

## 6. 附录

### 6.1 术语表

| 术语 | 英文 | 定义 |
|------|------|------|
| 资产详情页 | Asset Detail Page | 展示单个资产完整信息的页面 |
| 审计日志 | Audit Log | 记录资产操作变更历史的系统日志 |
| @Auditable | @Auditable | Java 注解，标记需要审计追踪的字段 |
| AuditService | Audit Service | 审计服务层，提供日志查询 API |
| Graphify | Graphify | 知识图谱可视化引擎 |

### 6.2 参考文档

| 文档名称 | 路径 |
|----------|------|
| 审计 API 接口规范 | `docs/api/audit-api-spec.md` |
| 资产管理系统设计文档 | `docs/design/asset-management-design.md` |
| 前端组件开发规范 | `docs/frontend/component-guidelines.md` |

### 6.3 变更记录

| 版本 | 日期 | 作者 | 变更描述 |
|------|------|------|----------|
| v1.0 | 2025-01-20 | SWARM Team | 初始版本创建 |

---

**文档结束**