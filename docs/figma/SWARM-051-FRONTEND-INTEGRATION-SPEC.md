# SWARM-051 资产详情页面开发规格指导文档

**版本**: Iteration 3  
**状态**: 正式规格  
**日期**: 2024  
**责任人**: 前端集成团队  

---

## 1. 需求与背景

### 1.1 业务上下文

资产管理系统需要对资产全生命周期进行透明化追踪。资产详情页面作为核心交互节点，承担两项关键职责：

1. **资产信息展示**: 展示资产的完整属性信息，包括基础属性、关联关系、状态流转
2. **审计轨迹呈现**: 展示该资产关联的所有审计日志，支持变更追溯与合规审计

### 1.2 核心功能需求

| 功能编号 | 描述 | 优先级 | 验收标准 |
|---------|------|--------|---------|
| F-01 | 资产基础信息展示（名称、类型、状态、归属部门、创建时间） | P0 | 所有字段正确渲染，支持 Loading/Error 状态 |
| F-02 | 资产关联审计日志实时加载与分页展示 | P0 | 分页数据正确，加载状态可见 |
| F-03 | `@Auditable` 注解标记字段变更的高亮可视化 | P0 | 审计字段橙色高亮，非审计字段默认样式 |
| F-04 | 审计日志筛选（按操作类型、时间范围、操作人） | P1 | 筛选条件正确追加到请求 URL |
| F-05 | 审计记录详情折叠展开 | P1 | 详情抽屉正确弹出，完整变更明细展示 |

### 1.3 技术约束

```typescript
// 技术栈版本约束
frontend_framework: "React 18 + TypeScript 4.9"
state_management: "Zustand"
http_client: "Axios"
ui_component_library: "Ant Design 5.x"
test_framework: "Vitest + React Testing Library + Playwright"
backend_protocol: "RESTful API (JSON)"
```

### 1.4 交付物清单

| 序号 | 文件路径 | 描述 | 状态 |
|------|---------|------|------|
| 1 | `frontend/src/app/components/flow/CustomNodes.tsx` | Graphify 知识图谱节点组件 | 待实现 |
| 2 | `tests/test_asset_detail_e2e.spec.ts` | 资产详情 E2E 测试 | 待实现 |
| 3 | `frontend/tests/unit/auditLog.test.ts` | 审计日志单元测试 | 待实现 |
| 4 | `frontend/src/app/types/flow.ts` | 流程图类型定义 | 待实现 |
| 5 | `frontend/src/app/components/asset/AssetMetadataPanel.tsx` | 资产元数据面板组件 | 待实现 |
| 6 | `frontend/src/app/types/audit.types.ts` | 审计日志类型定义 | 待实现 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 3 定位

参照 `plan.md` Phase 拆解，本迭代对应 **Phase 3: 前端集成与数据绑定**。

```
Phase 1 (已完成): 后端 AuditService 服务层实现与 @Auditable 注解机制
Phase 2 (已完成): AuditLog 数据模型与 Repository 层
Phase 3 (当前):   前端资产详情页集成、审计日志组件开发、数据可视化绑定
Phase 4 (待实施): 权限控制与数据隔离
```

### 2.2 本次 Spec 覆盖范围

```
✓ 资产详情展示组件 <AssetDetailView>
✓ 审计日志展示模块 <AuditLogPanel>
✓ @Auditable 字段变更可视化
✓ AuditService 前端 SDK 封装
✓ 前端分页、筛选、详情展开交互
✓ Graphify 知识图谱节点组件集成
✗ 后端 AuditService 实现（Phase 1 已完成）
✗ 权限控制与数据隔离（Phase 4 范畴）
✗ 移动端适配（独立任务）
```

---

## 3. 边界约束

### 3.1 输入边界

| 约束项 | 规格 | 示例 |
|--------|------|------|
| 资产 ID 输入 | UUID 格式，32 位十六进制字符串 | `a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4` |
| 分页参数 | `page` (默认 1), `pageSize` (默认 20, 上限 100) | `{ page: 1, pageSize: 20 }` |
| 时间范围筛选 | ISO 8601 格式，区间最大 90 天 | `2024-01-01T00:00:00Z/2024-03-31T23:59:59Z` |
| 操作类型枚举 | `CREATE`, `UPDATE`, `DELETE`, `VIEW`, `EXPORT` | `UPDATE` |

### 3.2 输出边界

| 约束项 | 规格 |
|--------|------|
| 响应格式 | JSON，包含 `data`, `pagination`, `timestamp` 字段 |
| 错误码 | HTTP 4xx/5xx 对应业务错误码 |
| 超时限制 | API 请求超时 30 秒 |

### 3.3 组件边界

```typescript
// 文件结构规范
src/
├── components/
│   ├── AssetDetailView/           // 资产详情主视图
│   │   ├── index.tsx             // 主组件入口
│   │   ├── AssetInfoCard.tsx      // 资产基础信息卡片
│   │   ├── AssetMetadataPanel.tsx // 资产元数据面板
│   │   └── AuditLogPanel.tsx      // 审计日志面板
│   ├── flow/                      // 知识图谱流程组件
│   │   └── CustomNodes.tsx        // Graphify 节点组件
│   └── AuditLogModule/            // 审计日志复用模块
│       ├── AuditTable.tsx         // 审计日志表格
│       ├── AuditFilter.tsx        // 筛选器
│       └── AuditDetailDrawer.tsx  // 详情抽屉
├── hooks/
│   ├── useAuditLog.ts             // 审计日志数据 hook
│   └── useAuditableFields.ts      // @Auditable 字段 hook
├── services/
│   └── auditService.ts            // AuditService 前端 SDK
└── types/
    ├── audit.types.ts             // TypeScript 类型定义
    └── flow.ts                    // 流程图类型定义
```

---

## 4. 验收测试基准 (ATB)

### ATB-01: 资产信息渲染验证

**测试目标**: 资产基础信息卡片正确渲染后端返回数据

**测试用例编号**: TC-AssetDetail-001

```typescript
// src/components/AssetDetailView/__tests__/AssetInfoCard.test.tsx
describe('AssetInfoCard', () => {
  /**
   * @description 验证资产信息卡片渲染所有字段
   * @see F-01
   */
  it('should render asset name, type, status, department and creation time', () => {
    const mockAsset: Asset = {
      id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      name: 'Dell PowerEdge R750',
      type: 'SERVER',
      status: 'ACTIVE',
      department: 'IT Infrastructure',
      createdAt: '2024-01-15T08:30:00Z'
    };
    
    render(<AssetInfoCard asset={mockAsset} />);
    
    expect(screen.getByText('Dell PowerEdge R750')).toBeInTheDocument();
    expect(screen.getByText('SERVER')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('IT Infrastructure')).toBeInTheDocument();
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
  });
  
  /**
   * @description 验证 Loading 状态骨架屏显示
   */
  it('should display skeleton loader while loading', () => {
    render(<AssetInfoCard asset={null} isLoading={true} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'loading');
  });
  
  /**
   * @description 验证 Error 状态提示信息显示
   */
  it('should show error state when asset fetch fails', () => {
    render(<AssetInfoCard error={new Error('Asset not found')} />);
    expect(screen.getByText(/资产信息加载失败/)).toBeInTheDocument();
  });
});
```

**通过标准**: 
- ✅ 所有字段正确渲染
- ✅ Loading 状态骨架屏可见
- ✅ Error 状态提示信息显示

---

### ATB-02: 审计日志列表加载验证

**测试目标**: AuditLogPanel 正确加载并展示审计日志分页数据

**测试用例编号**: TC-AssetDetail-002

```typescript
// src/components/AssetDetailView/__tests__/AuditLogPanel.test.tsx
describe('AuditLogPanel', () => {
  const mockAuditLogs: AuditLog[] = [
    {
      id: 'log-001',
      assetId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      operation: 'UPDATE',
      operator: 'zhang.san',
      timestamp: '2024-02-20T14:30:00Z',
      changes: [{ field: 'status', oldValue: 'INACTIVE', newValue: 'ACTIVE' }]
    }
  ];

  /**
   * @description 验证审计日志分页加载
   * @see F-02
   */
  it('should load and display audit logs with pagination', async () => {
    const mockResponse = {
      data: mockAuditLogs,
      pagination: { page: 1, pageSize: 20, total: 1 },
      timestamp: Date.now()
    };
    
    vi.spyOn(auditService, 'getLogsByAssetId').mockResolvedValue(mockResponse);
    
    render(<AuditLogPanel assetId="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4" />);
    
    await waitFor(() => {
      expect(screen.getByText('UPDATE')).toBeInTheDocument();
      expect(screen.getByText('zhang.san')).toBeInTheDocument();
    });
    
    expect(screen.getByText('第 1 / 1 页')).toBeInTheDocument();
  });
  
  /**
   * @description 验证空审计日志状态
   */
  it('should handle empty audit log state', async () => {
    vi.spyOn(auditService, 'getLogsByAssetId').mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
      timestamp: Date.now()
    });
    
    render(<AuditLogPanel assetId="empty-asset-id" />);
    
    await waitFor(() => {
      expect(screen.getByText(/暂无审计记录/)).toBeInTheDocument();
    });
  });
});
```

**通过标准**:
- ✅ 日志列表正确渲染
- ✅ 分页信息准确显示
- ✅ 空状态提示正常展示

---

### ATB-03: @Auditable 字段变更高亮验证

**测试目标**: 带有 `@Auditable` 注解的字段变更在 UI 层高亮显示

**测试用例编号**: TC-AssetDetail-003

```typescript
// src/hooks/__tests__/useAuditableFields.test.ts
describe('useAuditableFields', () => {
  /**
   * @description 验证 @Auditable 字段高亮显示
   * @see F-03
   */
  it('should highlight @Auditable annotated field changes', () => {
    const changes: FieldChange[] = [
      { field: 'status', oldValue: 'INACTIVE', newValue: 'ACTIVE', auditable: true },
      { field: 'internalNote', oldValue: 'old', newValue: 'new', auditable: false }
    ];
    
    const { getAuditableHighlight } = renderHook(() => useAuditableFields());
    
    const highlighted = getAuditableHighlight(changes);
    
    expect(highlighted[0]).toMatchObject({
      field: 'status',
      highlight: true,
      badgeColor: 'orange'
    });
    
    expect(highlighted[1]).toMatchObject({
      field: 'internalNote',
      highlight: false
    });
  });
  
  /**
   * @description 验证批量变更高亮处理
   */
  it('should handle multiple auditable fields in batch', () => {
    const changes: FieldChange[] = [
      { field: 'status', auditable: true },
      { field: 'location', auditable: true },
      { field: 'description', auditable: false }
    ];
    
    const { getAuditableHighlight } = renderHook(() => useAuditableFields());
    const highlighted = getAuditableHighlight(changes);
    
    expect(highlighted.filter(f => f.highlight)).toHaveLength(2);
  });
});
```

**通过标准**:
- ✅ `@Auditable=true` 的字段显示橙色高亮标记
- ✅ 非审计字段保持默认样式
- ✅ 批量变更正确分类

---

### ATB-04: 审计日志筛选功能验证

**测试目标**: 操作类型、时间范围、操作人筛选正常工作

**测试用例编号**: TC-AssetDetail-004

```typescript
// e2e/audit-filter.spec.ts
import { test, expect } from '@playwright/test';

/**
 * @description 审计日志筛选功能 E2E 测试
 * @see F-04
 */
test('audit log filter functionality', async ({ page }) => {
  await page.goto('/assets/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
  
  // 操作类型筛选
  await page.locator('[data-testid="operation-filter"]').click();
  await page.locator('.ant-select-item').filter({ hasText: 'UPDATE' }).click();
  
  // 验证筛选请求参数
  await expect(page).toHaveURL(/operationType=UPDATE/);
  
  // 时间范围筛选
  await page.locator('[data-testid="date-range-picker"]').click();
  await page.locator('.ant-picker-cell').first().click();
  await page.locator('.ant-picker-cell').last().click();
  
  // 验证表格数据更新
  await expect(page.locator('.ant-table-tbody tr')).toHaveCount(2);
  
  // 操作人筛选
  await page.locator('[data-testid="operator-input"]').fill('zhang.san');
  await page.locator('[data-testid="search-button"]').click();
  
  await expect(
    page.locator('.ant-table-tbody tr td').filter({ hasText: 'zhang.san' })
  ).toBeVisible();
  
  // 清除筛选
  await page.locator('[data-testid="clear-filters"]').click();
  await expect(page).toHaveURL(/\/assets\/[a-z0-9-]+$/);
});
```

**通过标准**:
- ✅ 筛选条件正确追加到请求 URL
- ✅ 筛选后数据正确更新
- ✅ 筛选条件可清除/重置

---

### ATB-05: AuditService SDK 集成验证

**测试目标**: 前端 SDK 正确封装并处理 API 响应

**测试用例编号**: TC-AssetDetail-005

```typescript
// src/services/__tests__/auditService.test.ts
describe('auditService', () => {
  beforeEach(() => {
    vi.spyOn(axios, 'create').mockReturnValue(mockAxiosInstance);
  });

  describe('getLogsByAssetId', () => {
    /**
     * @description 验证 GET 请求参数正确性
     */
    it('should call GET /api/assets/{assetId}/audit-logs with correct params', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockResponse });
      
      await auditService.getLogsByAssetId('asset-123', {
        page: 1,
        pageSize: 20,
        operationType: 'UPDATE'
      });
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/assets/asset-123/audit-logs',
        { params: { page: 1, pageSize: 20, operationType: 'UPDATE' } }
      );
    });
    
    /**
     * @description 验证错误响应转换为 AuditServiceError
     */
    it('should throw AuditServiceError on API failure', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 404, data: { code: 'AUDIT_001', message: 'Asset not found' } }
      });
      
      await expect(auditService.getLogsByAssetId('invalid-id'))
        .rejects.toThrow(AuditServiceError);
    });
    
    /**
     * @description 验证请求超时处理
     */
    it('should handle request timeout', async () => {
      mockAxiosInstance.get.mockRejectedValue(new axios.Cancel('timeout'));
      
      await expect(auditService.getLogsByAssetId('asset-123'))
        .rejects.toThrow(/请求超时/);
    });
  });
});
```

**通过标准**:
- ✅ API 请求路径、参数正确
- ✅ 错误响应正确转换为 `AuditServiceError`
- ✅ 请求超时正确处理

---

### ATB-06: Graphify 知识图谱节点验证

**测试目标**: Graphify 知识图谱节点组件正确渲染与交互

**测试用例编号**: TC-AssetDetail-006

```typescript
// src/components/flow/__tests__/CustomNodes.test.tsx
describe('CustomNodes', () => {
  /**
   * @description 验证 Graphify 节点工厂函数
   * @see AC-001
   */
  describe('GraphifyNodeFactory', () => {
    it('should return correct node component for ASSET type', () => {
      const NodeComponent = GraphifyNodeFactory(GraphifyNodeType.ASSET);
      expect(NodeComponent).toBe(AssetNode);
    });
    
    it('should return correct node component for DOCUMENT type', () => {
      const NodeComponent = GraphifyNodeFactory(GraphifyNodeType.DOCUMENT);
      expect(NodeComponent).toBe(DocumentNode);
    });
    
    it('should handle node type alias mappings', () => {
      // 测试别名映射
      expect(GraphifyNodeFactory('NODE' as any)).toBe(AssetNode);
      expect(GraphifyNodeFactory('DOC' as any)).toBe(DocumentNode);
    });
  });
  
  /**
   * @description 验证节点类型标准化
   */
  describe('normalizeNodeType', () => {
    it('should normalize lowercase node types', () => {
      expect(normalizeNodeType('asset')).toBe(GraphifyNodeType.ASSET);
    });
    
    it('should trim whitespace from node types', () => {
      expect(normalizeNodeType('  ASSET  ')).toBe(GraphifyNodeType.ASSET);
    });
  });
  
  /**
   * @description 验证从资产创建图节点
   */
  describe('createGraphifyNodeFromAsset', () => {
    it('should create graphify node with correct structure', () => {
      const asset = createMockAssetDetail();
      const position = { x: 100, y: 200 };
      
      const node = createGraphifyNodeFromAsset(asset, position);
      
      expect(node).toMatchObject({
        id: asset.id,
        label: asset.name,
        nodeType: GraphifyNodeType.ASSET,
        position: position,
        properties: expect.any(Object),
        relationships: expect.any(Array)
      });
    });
  });
});
```

**通过标准**:
- ✅ 节点类型与组件映射正确
- ✅ 别名映射兼容性处理
- ✅ 节点数据结构完整

---

### ATB-07: 资产元数据面板验证

**测试目标**: AssetMetadataPanel 正确展示资产元数据与审计绑定

**测试用例编号**: TC-AssetDetail-007

```typescript
// src/components/asset/__tests__/AssetMetadataPanel.test.tsx
describe('AssetMetadataPanel', () => {
  /**
   * @description 验证元数据字段绑定
   */
  it('should display all metadata fields with correct labels', () => {
    const metadata = {
      manufacturer: 'Dell',
      model: 'PowerEdge R750',
      serialNumber: 'SN123456',
      purchaseDate: '2023-01-15',
      warrantyExpiry: '2026-01-15'
    };
    
    render(<AssetMetadataPanel metadata={metadata} />);
    
    expect(screen.getByText('制造商')).toBeInTheDocument();
    expect(screen.getByText('Dell')).toBeInTheDocument();
    expect(screen.getByText('型号')).toBeInTheDocument();
    expect(screen.getByText('PowerEdge R750')).toBeInTheDocument();
  });
  
  /**
   * @description 验证 @Auditable 字段高亮显示
   */
  it('should highlight auditable metadata fields', () => {
    const auditableFields = ['serialNumber', 'purchaseDate'];
    
    render(
      <AssetMetadataPanel 
        metadata={mockMetadata}
        auditableFields={auditableFields}
      />
    );
    
    const serialNumberField = screen.getByTestId('metadata-serialNumber');
    expect(serialNumberField).toHaveClass(/auditable-highlight/);
  });
});
```

**通过标准**:
- ✅ 元数据字段正确渲染
- ✅ @Auditable 字段高亮显示
- ✅ 字段标签本地化

---

## 5. 开发切入层级序列

### 5.1 层级依赖关系图

```
┌─────────────────────────────────────────────────────────────┐
│  L5: 集成测试层 (Integration Tests)                         │
│      - Playwright E2E scenarios                             │
│      - Vitest 单元测试                                      │
├─────────────────────────────────────────────────────────────┤
│  L4: 组件集成层 (Component Integration)                      │
│      - <AssetDetailView> 主视图                             │
│      - <AssetMetadataPanel> 元数据面板                      │
│      - <AuditLogPanel> 日志面板                             │
├─────────────────────────────────────────────────────────────┤
│  L3: 组件实现层 (Component Implementation)                   │
│      - <AuditTable> 表格组件                               │
│      - <AuditFilter> 筛选组件                              │
│      - <AuditDetailDrawer> 详情抽屉                        │
│      - <AssetNode> 资产节点组件                            │
│      - <DocumentNode> 文档节点组件                         │
├─────────────────────────────────────────────────────────────┤
│  L2: Hooks 层 (Business Logic Hooks)                        │
│      - useAuditLog 审计日志数据                            │
│      - useAuditableFields @Auditable 字段                  │
│      - useAssetById 资产数据                               │
├─────────────────────────────────────────────────────────────┤
│  L1: 服务层 (Service Layer)                                 │
│      - auditService.ts SDK                                 │
│      - assetService.ts 资产服务                            │
├─────────────────────────────────────────────────────────────┤
│  L0: 类型定义层 (Type Definitions)                          │
│      - audit.types.ts 审计类型                             │
│      - flow.ts 流程图类型                                  │
│      - asset.types.ts 资产类型                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 实施顺序

| 步骤 | 层级 | 交付物 | 依赖前置 | 预计工时 |
|------|------|--------|---------|---------|
| 1 | L0 | `audit.types.ts` 类型定义 | 无 | 2h |
| 2 | L0 | `flow.ts` 类型定义 | 无 | 1h |
| 3 | L1 | `auditService.ts` SDK 封装 | L0 | 4h |
| 4 | L2 | `useAuditLog.ts` 数据 hook | L1 | 3h |
| 5 | L2 | `useAuditableFields.ts` 可视化 hook | L1 | 2h |
| 6 | L3 | `AuditTable.tsx` 表格组件 | L2 | 4h |
| 7 | L3 | `AuditFilter.tsx` 筛选组件 | L2 | 3h |
| 8 | L3 | `AuditDetailDrawer.tsx` 详情抽屉 | L2 | 3h |
| 9 | L3 | `AssetNode.tsx` 资产节点 | L2 | 2h |
| 10 | L3 | `DocumentNode.tsx` 文档节点 | L2 | 2h |
| 11 | L3 | `ProcessNode.tsx` 流程节点 | L2 | 2h |
| 12 | L3 | `GraphifyNodeFactory.tsx` 工厂函数 | L3 (9,10,11) | 2h |
| 13 | L4 | `AssetInfoCard.tsx` 信息卡片 | L2 | 2h |
| 14 | L4 | `AssetMetadataPanel.tsx` 元数据面板 | L2, L3 | 4h |
| 15 | L4 | `AuditLogPanel.tsx` 日志面板 | L3 (6,7,8) | 3h |
| 16 | L4 | `AssetDetailView/index.tsx` 主视图 | L13, L14, L15 | 4h |
| 17 | L4 | `CustomNodes.tsx` 节点组件整合 | L12, L3 | 3h |
| 18 | L5 | Vitest 单元测试 (auditLog.test.ts) | L1-L4 | 6h |
| 19 | L5 | Playwright E2E 测试 (test_asset_detail_e2e.spec.ts) | L4 组件完成 | 8h |
| 20 | L5 | AST 静态检查 | 所有代码 | 1h |

**总预计工时**: 58h

### 5.3 关键实现要点

#### L0 - Type Definitions

```typescript
// frontend/src/app/types/audit.types.ts

/**
 * 审计日志操作类型枚举
 * @description 定义所有支持的审计操作类型
 */
export enum AuditOperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  EXPORT = 'EXPORT'
}

/**
 * 字段变更记录
 * @description 记录单个字段的变更详情
 */
export interface FieldChange {
  /** 字段名称 */
  field: string;
  /** 变更前值 */
  oldValue: string | null;
  /** 变更后值 */
  newValue: string | null;
  /** 是否为 @Auditable 标记字段 */
  auditable: boolean;
}

/**
 * 审计日志条目
 * @description 单条审计记录的数据结构
 */
export interface AuditLog {
  /** 审计记录唯一标识 */
  id: string;
  /** 关联资产 ID */
  assetId: string;
  /** 操作类型 */
  operation: AuditOperationType;
  /** 操作人用户名 */
  operator: string;
  /** 操作时间 */
  timestamp: string;
  /** 变更明细 */
  changes: FieldChange[];
  /** 附加元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 分页响应结构
 * @description API 分页响应的标准化格式
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  data: T[];
  /** 分页信息 */
  pagination: {
    /** 当前页码 */
    page: number;
    /** 每页条数 */
    pageSize: number;
    /** 总记录数 */
    total: number;
  };
  /** 响应时间戳 */
  timestamp: number;
}

/**
 * 审计日志筛选参数
 * @description 查询审计日志的可选筛选条件
 */
export interface AuditLogFilter {
  /** 操作类型 */
  operationType?: AuditOperationType;
  /** 开始时间 */
  startDate?: string;
  /** 结束时间 */
  endDate?: string;
  /** 操作人 */
  operator?: string;
}

/**
 * 高亮字段配置
 * @description @Auditable 字段高亮显示配置
 */
export interface HighlightedField extends FieldChange {
  /** 是否高亮 */
  highlight: boolean;
  /** 高亮颜色 */
  badgeColor?: 'orange' | 'blue' | 'red';
}
```

```typescript
// frontend/src/app/types/flow.ts

/**
 * Graphify 节点类型枚举
 * @description 知识图谱支持的节点类型
 */
export enum GraphifyNodeType {
  ASSET = 'ASSET',
  DOCUMENT = 'DOCUMENT',
  PROCESS = 'PROCESS',
  METRIC = 'METRIC',
  RELATIONSHIP = 'RELATIONSHIP'
}

/**
 * Graphify 节点数据
 * @description 知识图谱中节点的标准化数据结构
 */
export interface GraphifyNodeData {
  /** 节点唯一标识 */
  id: string;
  /** 节点显示标签 */
  label: string;
  /** 节点类型 */
  nodeType: GraphifyNodeType;
  /** Graphify 平台 ID */
  graphifyId: string;
  /** 节点位置坐标 */
  position: { x: number; y: number };
  /** 节点属性 */
  properties: Record<string, unknown>;
  /** 节点关系 */
  relationships: RelationshipEdge[];
  /** 节点元数据 */
  metadata: Record<string, unknown>;
  /** 关联资产数据（仅 ASSET 类型） */
  assetData?: AssetDetailForGraphify;
}

/**
 * 关系边数据
 * @description 节点之间的关系连接
 */
export interface RelationshipEdge {
  /** 目标节点 ID */
  targetId: string;
  /** 关系类型 */
  relationshipType: string;
  /** 关系标签 */
  label: string;
}

/**
 * 资产图数据
 * @description 用于 Graphify 的资产数据结构
 */
export interface AssetDetailForGraphify {
  /** 资产 ID */
  id: string;
  /** 资产名称 */
  name: string;
  /** 资产类型 */
  type: string;
  /** 资产状态 */
  status: string;
  /** Graphify ID */
  graphifyId: string;
  /** 位置坐标 */
  position?: { x: number; y: number };
  /** 资产属性 */
  properties: Record<string, unknown>;
  /** 资产关系 */
  relationships: RelationshipEdge[];
  /** 资产元数据 */
  metadata: Record<string, unknown>;
}
```

#### L1 - Service Layer

```typescript
// frontend/src/app/services/auditService.ts

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  AuditLog,
  AuditLogFilter,
  PaginatedResponse,
  AuditOperationType
} from '../types/audit.types';

/**
 * AuditService 配置接口
 */
interface AuditServiceConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
}

/**
 * AuditService 错误类
 * @description 封装 API 错误响应
 */
export class AuditServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AuditServiceError';
  }
}

/**
 * AuditService SDK
 * @description 前端审计日志服务封装
 */
export const auditService = (() => {
  let instance: AxiosInstance;
  let config: AuditServiceConfig;

  const init = (cfg: AuditServiceConfig) => {
    config = {
      baseURL: cfg.baseURL || '/api',
      timeout: cfg.timeout || 30000,
      retryAttempts: cfg.retryAttempts || 3
    };

    instance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout
    });

    // 响应拦截器
    instance.interceptors.response.use(
      (response) => {
        if (!response.data?.timestamp) {
          throw new AuditServiceError('INVALID_RESPONSE', 'Response missing timestamp');
        }
        return response;
      },
      (error: AxiosError) => {
        if (error.response) {
          const { status, data } = error.response as any;
          throw new AuditServiceError(
            data?.code || 'UNKNOWN_ERROR',
            data?.message || error.message,
            status
          );
        }
        if (error.code === 'ECONNABORTED') {
          throw new AuditServiceError('TIMEOUT', '请求超时');
        }
        throw new AuditServiceError('NETWORK_ERROR', '网络错误');
      }
    );

    return instance;
  };

  return {
    /**
     * 初始化服务
     */
    initialize: init,

    /**
     * 获取资产的审计日志
     * @param assetId - 资产 ID
     * @param page - 页码
     * @param pageSize - 每页条数
     * @param filter - 筛选条件
     */
    getLogsByAssetId: async (
      assetId: string,
      params: {
        page?: number;
        pageSize?: number;
        operationType?: AuditOperationType;
        startDate?: string;
        endDate?: string;
        operator?: string;
      } = {}
    ): Promise<PaginatedResponse<AuditLog>> => {
      const { page = 1, pageSize = 20, ...filters } = params;
      
      const response = await instance.get(
        `/assets/${assetId}/audit-logs`,
        { params: { page, pageSize, ...filters } }
      );
      
      return response.data;
    },

    /**
     * 获取单条审计日志详情
     * @param logId - 审计日志 ID
     */
    getLogById: async (logId: string): Promise<AuditLog> => {
      const response = await instance.get(`/audit-logs/${logId}`);
      return response.data.data;
    }
  };
})();
```

#### L2 - Hooks Layer

```typescript
// frontend/src/app/hooks/useAuditLog.ts

import { useState, useEffect, useCallback } from 'react';
import { auditService, AuditServiceError } from '../services/auditService';
import type { AuditLog, AuditLogFilter, PaginatedResponse } from '../types/audit.types';

/**
 * 审计日志缓存配置
 */
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface UseAuditLogOptions {
  assetId: string;
  page?: number;
  pageSize?: number;
  filter?: AuditLogFilter;
  autoFetch?: boolean;
}

interface UseAuditLogResult {
  data: AuditLog[];
  pagination: { page: number; pageSize: number; total: number };
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setPage: (page: number) => void;
  setFilter: (filter: AuditLogFilter) => void;
}

/**
 * 审计日志数据 Hook
 * @description 管理审计日志的获取、缓存、筛选状态
 */
export function useAuditLog({
  assetId,
  page = 1,
  pageSize = 20,
  filter = {},
  autoFetch = true
}: UseAuditLogOptions): UseAuditLogResult {
  const [data, setData] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentPage, setCurrentPage] = useState(page);
  const [currentFilter, setCurrentFilter] = useState<AuditLogFilter>(filter);

  const fetchData = useCallback(async () => {
    if (!assetId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response: PaginatedResponse<AuditLog> = await auditService.getLogsByAssetId(
        assetId,
        {
          page: currentPage,
          pageSize,
          ...currentFilter
        }
      );
      
      setData(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof AuditServiceError ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [assetId, currentPage, pageSize, currentFilter]);

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);

  const setPage = useCallback((newPage: number) => {
    setCurrentPage(newPage);
  }, []);

  const setFilter = useCallback((newFilter: AuditLogFilter) => {
    setCurrentFilter(newFilter);
    setCurrentPage(1); // 重置页码
  }, []);

  return {
    data,
    pagination,
    isLoading,
    error,
    refetch: fetchData,
    setPage,
    setFilter
  };
}
```

```typescript
// frontend/src/app/hooks/useAuditableFields.ts

import { useMemo } from 'react';
import type { FieldChange, HighlightedField } from '../types/audit.types';

/**
 * @Auditable 字段高亮颜色映射
 */
const HIGHLIGHT_COLORS: Record<string, 'orange' | 'blue' | 'red'> = {
  status: 'orange',
  location: 'blue',
  owner: 'orange',
  securityLevel: 'red'
};

/**
 * useAuditableFields Hook 配置
 */
interface UseAuditableFieldsOptions {
  /** 字段变更列表 */
  changes: FieldChange[];
  /** 自定义高亮颜色映射 */
  customColors?: Record<string, 'orange' | 'blue' | 'red'>;
}

/**
 * useAuditableFields Hook 返回值
 */
interface UseAuditableFieldsResult {
  /** 高亮后的字段列表 */
  highlightedFields: HighlightedField[];
  /** 获取单个字段的高亮配置 */
  getFieldHighlight: (field: string) => HighlightedField | undefined;
  /** 是否存在 @Auditable 字段变更 */
  hasAuditableChanges: boolean;
  /** @Auditable 字段变更数量 */
  auditableCount: number;
}

/**
 * @Auditable 字段 Hook
 * @description 处理 @Auditable 注解字段的高亮显示逻辑
 */
export function useAuditableFields({
  changes,
  customColors = {}
}: UseAuditableFieldsOptions = {}): UseAuditableFieldsResult {
  const highlightedFields = useMemo(() => {
    const colorMap = { ...HIGHLIGHT_COLORS, ...customColors };
    
    return changes.map(change => ({
      ...change,
      highlight: change.auditable,
      badgeColor: change.auditable ? (colorMap[change.field] || 'orange') : undefined
    }));
  }, [changes, customColors]);

  const hasAuditableChanges = useMemo(
    () => changes.some(c => c.auditable),
    [changes]
  );

  const auditableCount = useMemo(
    () => changes.filter(c => c.auditable).length,
    [changes]
  );

  const getFieldHighlight = (field: string): HighlightedField | undefined => {
    return highlightedFields.find(f => f.field === field);
  };

  return {
    highlightedFields,
    getFieldHighlight,
    hasAuditableChanges,
    auditableCount
  };
}
```

#### L4 - Component Integration

```typescript
// frontend/src/app/components/asset/AssetMetadataPanel.tsx

import React from 'react';
import { Card, Descriptions, Tag, Spin } from 'antd';
import { useAuditableFields } from '../../hooks/useAuditableFields';
import './AssetMetadataPanel.css';

interface AssetMetadata {
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  [key: string]: unknown;
}

interface AssetMetadataPanelProps {
  /** 资产元数据 */
  metadata: AssetMetadata;
  /** @Auditable 标记的字段列表 */
  auditableFields?: string[];
  /** 加载状态 */
  isLoading?: boolean;
}

/**
 * 资产元数据面板组件
 * @description 展示资产详细元数据信息，支持 @Auditable 字段高亮
 * @see F-01, F-03
 */
export const AssetMetadataPanel: React.FC<AssetMetadataPanelProps> = ({
  metadata,
  auditableFields = [],
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <Card>
        <Spin tip="加载元数据..." />
      </Card>
    );
  }

  const isFieldAuditable = (field: string) => auditableFields.includes(field);

  const getFieldValue = (key: string, value: unknown) => {
    if (isFieldAuditable(key) && value) {
      return (
        <Tag color="orange" className="auditable-tag">
          {String(value)}
        </Tag>
      );
    }
    return String(value ?? '-');
  };

  const fieldLabels: Record<string, string> = {
    manufacturer: '制造商',
    model: '型号',
    serialNumber: '序列号',
    purchaseDate: '采购日期',
    warrantyExpiry: '保修到期'
  };

  const items = Object.entries(metadata)
    .filter(([key]) => key in fieldLabels)
    .map(([key, value]) => ({
      key,
      label: fieldLabels[key],
      children: getFieldValue(key, value)
    }));

  return (
    <Card title="资产元数据" className="asset-metadata-panel">
      <Descriptions items={items} column={2} bordered />
    </Card>
  );
};

export default AssetMetadataPanel;
```

---

## 6. Mock Server 配置

### 6.1 开发/测试环境 Mock 配置

```yaml
# mock/audit-api.yaml
- request:
    method: GET
    path: /api/assets/:assetId/audit-logs
  response:
    status: 200
    body:
      data:
        - id: "log-001"
          assetId: "{{ params.assetId }}"
          operation: "UPDATE"
          operator: "zhang.san"
          timestamp: "2024-02-20T14:30:00Z"
          changes:
            - field: "status"
              oldValue: "INACTIVE"
              newValue: "ACTIVE"
              auditable: true
            - field: "location"
              oldValue: "Building A"
              newValue: "Building B"
              auditable: true
          metadata:
            ipAddress: "192.168.1.100"
            userAgent: "Mozilla/5.0"
      pagination:
        page: 1
        pageSize: 20
        total: 1
      timestamp: 1708432200000

- request:
    method: GET
    path: /api/assets/:assetId
  response:
    status: 200
    body:
      data:
        id: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
        name: "Dell PowerEdge R750"
        type: "SERVER"
        status: "ACTIVE"
        department: "IT Infrastructure"
        createdAt: "2024-01-15T08:30:00Z"
        metadata:
          manufacturer: "Dell"
          model: "PowerEdge R750"
          serialNumber: "SN123456"
          purchaseDate: "2023-01-15"
          warrantyExpiry: "2026-01-15"
      timestamp: 1708432200000
```

---

## 7. 验收 Checklist

### 7.1 代码质量检查

- [ ] 所有新增函数包含 docstring 文档注释
- [ ] TypeScript 类型定义完整，无 `any` 类型滥用
- [ ] 组件 props 接口定义清晰
- [ ] 错误处理覆盖所有 API 调用路径
- [ ] 单元测试覆盖核心业务逻辑

### 7.2 功能验收检查

- [ ] 资产详情页面正确渲染
- [ ] 审计日志列表正确加载与分页
- [ ] @Auditable 字段高亮显示
- [ ] 筛选功能正常工作
- [ ] 详情抽屉正确展开
- [ ] Graphify 知识图谱节点正确渲染

### 7.3 集成验收检查

- [ ] AST 静态检查通过，无语法错误
- [ ] 所有模块可正常 import
- [ ] E2E 测试全部通过
- [ ] 单元测试覆盖率 ≥ 80%

---

**文档结束**

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|---------|
| 1.0 | 2024 | 前端集成团队 | 初始版本 |