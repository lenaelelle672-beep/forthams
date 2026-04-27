# SWARM-051 规格指导文档

**任务**: 前端集成-资产详情页面开发
**版本**: Iteration 1
**状态**: Approved

---

## 1. 需求与背景

### 1.1 业务背景

资产管理系统需要对数字化资产提供完整的生命周期追踪能力。资产详情页面作为用户操作的核心入口，承担以下职责：

- 展示资产的完整元数据信息
- 提供资产状态可视化呈现
- 集成审计日志以满足合规审计要求
- 支持 @Auditable 注解标记字段的变更追踪可视化

### 1.2 技术栈约束

| 层级 | 技术选型 |
|------|----------|
| 前端框架 | React 18.x + TypeScript 5.x |
| 状态管理 | Zustand |
| HTTP Client | Axios + React Query |
| UI 组件库 | Ant Design 5.x |
| 路由 | React Router v6 |
| 图表 | ECharts 5.x |
| 单元测试 | Vitest + React Testing Library |
| E2E 测试 | Playwright |

### 1.3 外部依赖

- AuditService (REST API) - 审计日志数据源
- AssetService (REST API) - 资产元数据
- AuthService - 当前用户上下文
- Graphify Service - 知识图谱节点数据

### 1.4 已知问题

**⚠️ 阻塞问题**: [Graphify 知识图谱] 返回 "No matching nodes found"

**根因分析**:
1. `AssetDetailPage.tsx` 未正确调用 `getGraphifyNodesForAssetDetail` 获取节点数据
2. `CustomNodes.tsx` 中节点类型映射可能与实际数据不匹配
3. `assetDetail.mock.ts` 中 mock 数据与真实 API 响应结构不一致

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 定位

参照项目计划文档，本次迭代对应 **Phase 2: 核心功能开发** 中的 **P2.3 资产详情页集成**。

### 2.2 迭代目标

| 目标编号 | 目标描述 | 交付物 |
|----------|----------|--------|
| OBJ-051-1 | 实现资产详情主展示区域 | `<AssetDetailCard />` 组件 |
| OBJ-051-2 | 实现审计日志时间线组件 | `<AuditLogTimeline />` 组件 |
| OBJ-051-3 | 实现 @Auditable 字段变更高亮展示 | `<AuditableFieldTracker />` 组件 |
| OBJ-051-4 | 对接 AuditService 获取审计数据 | `useAuditLogs` Hook |
| OBJ-051-5 | 修复 Graphify 知识图谱节点匹配问题 | 节点数据链路修复 |
| OBJ-051-6 | 响应式布局适配 | 移动端/桌面端适配 |

### 2.3 本次迭代排除范围

- 资产编辑功能（归属 P2.4）
- 资产删除功能（归属 P2.5）
- 审计日志导出功能（归属 P3.2）
- 多语言国际化（归属 P3.1）

---

## 3. 边界约束

### 3.1 数据边界

```
Asset Detail Page Data Flow:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ AssetService │───▶│   Frontend   │◀───│ AuditService │   │
│  │  GET /assets │    │    Store     │    │GET /audits/* │   │
│  │  /{id}       │    │   (Zustand)  │    └──────────────┘   │
│  └──────────────┘    └──────────────┘                       │
│                            │                                 │
│                            ▼                                 │
│                   ┌─────────────────┐                        │
│                   │ AssetDetailPage │                        │
│                   │  (Route: /assets│                        │
│                   │   /:id)         │                        │
│                   └─────────────────┘                        │
│                            │                                 │
│                            ▼                                 │
│                   ┌─────────────────┐                        │
│                   │  Graphify Graph │                        │
│                   │  (Knowledge Map)│                        │
│                   └─────────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 API 接口约束

#### GET /api/assets/{id}

**Response Schema (仅列出关键字段)**

```typescript
interface AssetResponse {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  metadata: Record<string, unknown>;
  graphifyId: string;
  position: { x: number; y: number };
  properties: Record<string, unknown>;
  relationships: Array<{ targetId: string; type: string }>;
  createdAt: string;
  updatedAt: string;
  // @Auditable 标记的字段
  auditableFields: {
    owner: string;
    classification: string;
    riskLevel: string;
  };
}
```

#### GET /api/audits?entityType=asset&entityId={id}

**Response Schema**

```typescript
interface AuditLogResponse {
  items: Array<{
    id: string;
    timestamp: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW';
    userId: string;
    userName: string;
    changes: Array<{
      field: string;
      oldValue: string | null;
      newValue: string | null;
      isAuditable: boolean;
    }>;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}
```

### 3.3 Graphify 节点数据约束

```typescript
// 节点类型枚举 (GraphifyNodeType)
enum GraphifyNodeType {
  ASSET = 'ASSET',
  DOCUMENT = 'DOCUMENT',
  PROCESS = 'PROCESS',
  METRIC = 'METRIC',
  RELATIONSHIP = 'RELATIONSHIP'
}

// 节点数据结构 (GraphifyNodeData)
interface GraphifyNodeData {
  id: string;
  label: string;
  nodeType: GraphifyNodeType;
  graphifyId: string;
  position: { x: number; y: number };
  properties: Record<string, unknown>;
  relationships: Array<{ targetId: string; type: string }>;
  metadata: Record<string, unknown>;
  assetData?: AssetDetailForGraphify;
}
```

### 3.4 性能约束

| 指标 | 阈值 |
|------|------|
| 首屏加载时间 (LCP) | ≤ 2.5s |
| 审计日志首次请求 | ≤ 500ms (API) |
| 组件渲染时间 | ≤ 100ms |
| 内存占用峰值 | ≤ 150MB |

### 3.5 安全约束

- 审计日志仅展示当前用户有权限查看的记录
- 敏感字段（如密码、私钥）不得在前端明文展示
- 所有 API 调用必须携带有效的 Bearer Token

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试 (Vitest)

#### ATB-051-UT-01: AssetDetailCard 组件渲染

```typescript
// tests/unit/components/AssetDetailCard.test.tsx
describe('AssetDetailCard', () => {
  it('should render asset name correctly', async () => {
    const mockAsset = {
      id: 'asset-001',
      name: 'Production Database',
      type: 'DATABASE',
      status: 'ACTIVE',
    };
    
    render(<AssetDetailCard asset={mockAsset} />);
    
    expect(screen.getByText('Production Database')).toBeInTheDocument();
    expect(screen.getByText('DATABASE')).toBeInTheDocument();
  });
  
  it('should display correct status badge color', () => {
    const activeAsset = { ...mockAsset, status: 'ACTIVE' };
    render(<AssetDetailCard asset={activeAsset} />);
    
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveClass('ant-tag-green');
  });
});
```

**期待结果**: 所有断言通过，组件正确渲染资产信息。

#### ATB-051-UT-02: useAuditLogs Hook 数据获取

```typescript
// tests/unit/hooks/useAuditLogs.test.ts
describe('useAuditLogs', () => {
  it('should fetch audit logs for given asset ID', async () => {
    const mockAuditData = {
      items: [
        { id: 'audit-001', action: 'UPDATE', field: 'owner' },
      ],
      pagination: { page: 1, pageSize: 20, total: 1 },
    };
    
    vi.spyOn(axios, 'get').mockResolvedValue({ data: mockAuditData });
    
    const { result } = renderHook(() => useAuditLogs('asset-001'));
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
  });
});
```

**期待结果**: Hook 正确调用 API 并返回结构化审计数据。

#### ATB-051-UT-03: AuditableFieldTracker 高亮展示

```typescript
// tests/unit/components/AuditableFieldTracker.test.tsx
describe('AuditableFieldTracker', () => {
  it('should highlight auditable field changes', () => {
    const changes = [
      { field: 'owner', oldValue: 'Alice', newValue: 'Bob', isAuditable: true },
      { field: 'description', oldValue: 'Old desc', newValue: 'New desc', isAuditable: false },
    ];
    
    render(<AuditableFieldTracker changes={changes} />);
    
    const auditableRow = screen.getByTestId('auditable-change-owner');
    expect(auditableRow).toHaveClass('audit-highlight');
    
    const nonAuditableRow = screen.getByTestId('auditable-change-description');
    expect(nonAuditableRow).not.toHaveClass('audit-highlight');
  });
});
```

**期待结果**: 仅 @Auditable 标记的字段变更获得视觉高亮。

#### ATB-051-UT-04: Graphify 节点创建

```typescript
// tests/unit/components/GraphifyNodeFactory.test.ts
describe('GraphifyNodeFactory', () => {
  it('should create ASSET node correctly', () => {
    const mockAsset: AssetDetailForGraphify = {
      id: 'AST-2024-00001',
      name: 'Dell PowerEdge R740 服务器',
      type: 'SERVER',
      status: 'ACTIVE',
      // ... other required fields
    };
    
    const node = createGraphifyNodeFromAsset(mockAsset, { x: 400, y: 300 });
    
    expect(node.id).toBe('AST-2024-00001');
    expect(node.nodeType).toBe(GraphifyNodeType.ASSET);
    expect(node.label).toBe('Dell PowerEdge R740 服务器');
  });
  
  it('should handle unknown node type with fallback', () => {
    const nodeType = 'UNKNOWN_TYPE';
    const Factory = GraphifyNodeFactory(nodeType);
    
    // Should fallback to ASSET node
    expect(Factory).toBe(AssetNode);
  });
});
```

**期待结果**: 节点工厂正确处理各种节点类型，UNKNOWN 类型 fallback 到 ASSET。

### 4.2 集成测试 (React Testing Library)

#### ATB-051-IT-01: 资产详情页面完整加载

```typescript
// tests/integration/AssetDetailPage.test.tsx
describe('AssetDetailPage Integration', () => {
  it('should load and display all sections', async () => {
    setupMockServer(handlers);
    
    render(<AssetDetailPage />, { route: '/assets/asset-001' });
    
    // 主信息区
    await waitFor(() => {
      expect(screen.getByTestId('asset-detail-card')).toBeInTheDocument();
    });
    
    // 审计日志区
    await waitFor(() => {
      expect(screen.getByTestId('audit-log-timeline')).toBeInTheDocument();
    });
    
    // Auditable 字段追踪区
    await waitFor(() => {
      expect(screen.getByTestId('auditable-field-tracker')).toBeInTheDocument();
    });
    
    // Graphify 图谱区
    await waitFor(() => {
      expect(screen.getByTestId('graphify-container')).toBeInTheDocument();
    });
  });
});
```

**期待结果**: 页面完整渲染四个核心区域，无崩溃、无 loading 状态残留。

#### ATB-051-IT-02: Graphify 节点匹配验证

```typescript
// tests/integration/GraphifyNodeMatching.test.tsx
describe('Graphify Node Matching', () => {
  it('should display nodes when asset has graphifyId', async () => {
    const mockAssetWithGraphify = {
      id: 'AST-2024-00001',
      graphifyId: 'graphify-AST-2024-00001',
      // ... other fields
    };
    
    render(<AssetDetailPage asset={mockAssetWithGraphify} />);
    
    await waitFor(() => {
      const graphifyContainer = screen.getByTestId('graphify-container');
      expect(graphifyContainer).toContainElement(
        screen.getByTestId('graphify-node-AST-2024-00001')
      );
    });
  });
  
  it('should handle "No matching nodes found" gracefully', async () => {
    const mockAssetWithoutGraphify = {
      id: 'AST-2024-99999',
      graphifyId: null,
      // ... other fields
    };
    
    render(<AssetDetailPage asset={mockAssetWithoutGraphify} />);
    
    await waitFor(() => {
      // Should show empty state, not crash
      expect(screen.getByTestId('graphify-empty-state')).toBeInTheDocument();
    });
  });
});
```

**期待结果**: 图谱正确展示节点，空状态正确处理。

### 4.3 E2E 测试 (Playwright)

#### ATB-051-E2E-01: 资产详情页面完整流程

```typescript
// tests/e2e/asset-detail.spec.ts
import { test, expect } from '@playwright/test';

test('asset detail page complete flow', async ({ page }) => {
  await page.goto('/assets/asset-001');
  
  // 等待页面加载完成
  await expect(page.getByTestId('asset-detail-card')).toBeVisible({ timeout: 10000 });
  
  // 验证资产名称展示
  await expect(page.locator('.asset-name')).toContainText('Production Database');
  
  // 验证审计日志时间线加载
  await expect(page.getByTestId('audit-log-timeline')).toBeVisible();
  
  // 验证至少有一条审计记录
  const auditItems = page.locator('[data-testid="audit-item"]');
  await expect(auditItems.first()).toBeVisible();
  
  // 验证 Auditable 字段变更高亮
  await expect(page.locator('.audit-highlight').first()).toBeVisible();
  
  // 验证 Graphify 图谱加载（修复后的关键验证）
  await expect(page.getByTestId('graphify-container')).toBeVisible();
  await expect(page.locator('[data-testid^="graphify-node-"]').first()).toBeVisible();
  
  // 验证响应式布局（移动端）
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.getByTestId('mobile-menu-button')).toBeVisible();
});
```

**期待结果**: 完整用户流程顺畅执行，所有关键元素可见，无控制台错误。

---

## 5. 开发切入层级序列

### 5.1 依赖层级图

```
Level 0: Types & Interfaces (基础类型定义)
    │
    ▼
Level 1: API Client Layer (Axios 实例配置)
    │
    ▼
Level 2: Custom Hooks (useAssetDetail, useAuditLogs)
    │
    ▼
Level 3: Atomic Components (单个 UI 组件)
    │   ├── StatusBadge
    │   ├── FieldRow
    │   ├── AuditItemCard
    │   └── TimelineConnector
    │
    ▼
Level 4: Composite Components (组合组件)
    │   ├── AssetDetailCard
    │   ├── AuditLogTimeline
    │   ├── AuditableFieldTracker
    │   └── GraphifyVisualization
    │
    ▼
Level 5: Page Component (页面容器)
    │
    ▼
Level 6: Route Integration (路由挂载)
```

### 5.2 实施顺序

| 顺序 | 层级 | 交付物 | 预估工时 |
|------|------|--------|----------|
| 1 | L0 | `src/types/asset.ts`, `src/types/audit.ts`, `src/types/flow.ts` | 0.5d |
| 2 | L1 | `src/api/axiosInstance.ts`, `src/api/assetApi.ts`, `src/api/auditApi.ts` | 0.5d |
| 3 | L2 | `src/hooks/useAssetDetail.ts`, `src/hooks/useAuditLogs.ts` | 1d |
| 4 | L3 | `src/components/atoms/*` | 1d |
| 5 | L4 | `src/components/organisms/*` | 2d |
| 6 | L4.1 | `GraphifyVisualization` 组件集成 | 1d |
| 7 | L5 | `src/pages/AssetDetailPage.tsx` | 1d |
| 8 | L6 | `src/routes/index.tsx` 路由配置 | 0.5d |
| 9 | L7 | 测试编写 (UT + IT + E2E) | 2d |
| **总计** | | | **9.5d** |

### 5.3 代码位置约定

```
src/
├── api/
│   ├── axiosInstance.ts      # Axios 全局配置
│   ├── assetApi.ts           # 资产 API 调用
│   └── auditApi.ts           # 审计 API 调用
├── components/
│   ├── atoms/                # 原子组件
│   │   ├── StatusBadge.tsx
│   │   ├── FieldRow.tsx
│   │   ├── AuditItemCard.tsx
│   │   └── TimelineConnector.tsx
│   ├── organisms/            # 组合组件
│   │   ├── AssetDetailCard.tsx
│   │   ├── AuditLogTimeline.tsx
│   │   ├── AuditableFieldTracker.tsx
│   │   └── GraphifyVisualization.tsx
│   └── pages/
│       └── AssetDetailPage.tsx
├── hooks/
│   ├── useAssetDetail.ts
│   └── useAuditLogs.ts
├── types/
│   ├── asset.ts
│   ├── audit.ts
│   └── flow.ts
└── routes/
    └── index.tsx
```

### 5.4 Graphify 节点匹配修复方案

#### 问题根因

"No matching nodes found" 错误的根因是：
1. `AssetDetailPage` 未调用 `getGraphifyNodesForAssetDetail` 或调用方式错误
2. 节点 ID 与 graphifyId 映射不一致
3. 节点类型标准化逻辑缺失

#### 修复策略

```typescript
// frontend/src/app/pages/AssetDetailPage.tsx

/**
 * 资产详情页面组件
 * 
 * 功能说明：
 * - 展示资产的完整元数据信息
 * - 集成审计日志以满足合规审计要求
 * - 支持 @Auditable 注解标记字段的变更追踪可视化
 * - 集成 Graphify 知识图谱可视化
 * 
 * @remarks
 * 本组件通过 useAssetDetail Hook 获取资产数据，
 * 通过 useAuditLogs Hook 获取审计日志，
 * 并调用 getGraphifyNodesForAssetDetail 生成图谱节点数据。
 * 
 * @returns 资产详情页面 React 组件
 */
export const AssetDetailPage: React.FC<AssetDetailPageProps> = ({ assetId }) => {
  // 获取资产详情数据
  const { data: asset, isLoading: assetLoading, error: assetError } = useAssetDetail(assetId);
  
  // 获取审计日志数据
  const { data: auditLogs, isLoading: auditLoading } = useAuditLogs(assetId);
  
  // 生成 Graphify 节点数据 - 修复关键点
  const graphifyNodes = useMemo(() => {
    if (!asset) return [];
    
    // 修复: 正确调用 getGraphifyNodesForAssetDetail
    // 并确保传入正确的 assetId 参数
    const nodes = getGraphifyNodesForAssetDetail(asset.id);
    
    // 验证节点匹配 - 修复: 节点 ID 必须与 asset.id 一致
    if (nodes.length === 0) {
      console.warn(`[AssetDetailPage] No matching nodes found for asset: ${asset.id}`);
    }
    
    return nodes;
  }, [asset]);
  
  // ... 其他逻辑
};
```

#### 节点类型标准化

```typescript
// frontend/src/app/components/flow/CustomNodes.tsx

/**
 * 获取匹配的节点类型枚举值
 * 
 * 功能说明：
 * - 标准化输入的节点类型字符串
 * - 支持别名映射以处理 API 返回的变体形式
 * - 未识别类型默认返回 ASSET
 * 
 * @param nodeType - 输入的节点类型字符串
 * @returns 匹配的 GraphifyNodeType 枚举值
 * 
 * @example
 * ```typescript
 * getMatchingNodeType('ASSET') // => GraphifyNodeType.ASSET
 * getMatchingNodeType('NODE') // => GraphifyNodeType.ASSET (别名映射)
 * getMatchingNodeType('UNKNOWN') // => GraphifyNodeType.ASSET (默认值)
 * ```
 */
const getMatchingNodeType = (nodeType: string): GraphifyNodeType => {
  const normalized = normalizeNodeType(nodeType);

  // 尝试直接匹配
  for (const type of Object.values(GraphifyNodeType)) {
    if (type === normalized) {
      return type as GraphifyNodeType;
    }
  }

  // 尝试别名匹配（处理 API 返回的变体形式）
  const aliasMap: Record<string, GraphifyNodeType> = {
    'NODE': GraphifyNodeType.ASSET,
    'ASSET_NODE': GraphifyNodeType.ASSET,
    'DOC': GraphifyNodeType.DOCUMENT,
    'DOCUMENT_NODE': GraphifyNodeType.DOCUMENT,
    'PROCESS_NODE': GraphifyNodeType.PROCESS,
    'WORKFLOW': GraphifyNodeType.PROCESS,
    'METRICS': GraphifyNodeType.METRIC,
    'REL': GraphifyNodeType.RELATIONSHIP,
    'REL_NODE': GraphifyNodeType.RELATIONSHIP,
    'EDGE': GraphifyNodeType.RELATIONSHIP
  };

  return aliasMap[normalized] || GraphifyNodeType.ASSET;
};
```

---

## 附录

### A. Mock Server Handler 示例

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/assets/:id', () => {
    return HttpResponse.json({
      id: 'asset-001',
      name: 'Production Database',
      type: 'DATABASE',
      status: 'ACTIVE',
      graphifyId: 'graphify-asset-001',
      position: { x: 400, y: 300 },
      auditableFields: {
        owner: 'Alice',
        classification: 'CONFIDENTIAL',
        riskLevel: 'HIGH',
      },
    });
  }),
  
  http.get('/api/audits', ({ request }) => {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    
    return HttpResponse.json({
      items: [
        {
          id: `audit-${page}-001`,
          timestamp: new Date().toISOString(),
          action: 'UPDATE',
          userId: 'user-001',
          userName: 'Bob',
          changes: [
            { field: 'owner', oldValue: 'Alice', newValue: 'Bob', isAuditable: true },
          ],
        },
      ],
      pagination: { page: Number(page), pageSize: 20, total: 45 },
    });
  }),
];
```

### B. 状态管理接口

```typescript
// src/store/assetStore.ts
interface AssetStore {
  currentAsset: AssetResponse | null;
  auditLogs: AuditLogResponse['items'];
  pagination: AuditLogResponse['pagination'];
  graphifyNodes: GraphifyNodeData[];
  isLoading: boolean;
  error: Error | null;
  
  fetchAsset: (id: string) => Promise<void>;
  fetchAuditLogs: (id: string, page: number) => Promise<void>;
  clearAsset: () => void;
}
```

---

**文档结束**