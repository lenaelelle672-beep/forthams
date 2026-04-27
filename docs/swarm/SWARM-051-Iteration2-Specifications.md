# SWARM-051 Iteration 2 - Specifications

## 资产详情页面开发规格指导文档

**版本**: v2.0  
**日期**: 2024  
**状态**: 已批准  

---

## 1. 需求与背景

### 1.1 业务背景

资产管理系统需提供资产详情查看能力，支持对资产操作行为的完整审计追溯。资产详情页面是用户核心交互入口，承载基础信息展示与操作审计双重职责。

当前 Phase 1 已完成资产详情页骨架与路由配置，本期（Phase 2）聚焦审计日志模块集成与 @Auditable 注解数据绑定。

### 1.2 功能需求

| 功能项 | 描述 | 优先级 |
|--------|------|--------|
| 资产详情展示组件 | 实现 `AssetDetailView` 组件，渲染资产基础信息 | P0 |
| 审计日志展示模块 | 实现 `AuditLogPanel` 组件，展示操作变更历史 | P0 |
| @Auditable 数据可视化 | 绑定被注解标记的字段变更轨迹 | P0 |
| AuditService 服务对接 | 对接后端 `AuditServiceImpl`，实现数据交互 | P0 |
| Graphify 知识图谱节点渲染 | 修复 "No matching nodes found" 问题 | P0 |

### 1.3 技术栈约束

| 层级 | 技术选型 |
|------|----------|
| 前端框架 | React 18 + TypeScript |
| UI 组件库 | 基于 `docs/figma/src/app/components/ui` 已实现的组件 |
| 路由 | React Router v6 |
| HTTP 客户端 | Axios |
| 图表/图谱 | ECharts + 自定义 Graphify 节点渲染器 |
| 单元测试 | Vitest |
| E2E 测试 | Playwright |

---

## 2. 当前 Phase 对应实施目标

### 2.1 SWARM-051 阶段拆分

| Phase | 描述 | 依赖状态 | 状态 |
|-------|------|----------|------|
| Phase 1 | 资产详情页骨架搭建与路由配置 | - | ✅ 已完成 |
| **Phase 2** | **审计日志模块集成与数据绑定** | Phase 1 | **本期目标** |
| Phase 3 | 可视化图表与交互优化 | Phase 2 | 待实施 |
| Phase 4 | 性能调优与集成测试 | Phase 3 | 待实施 |

### 2.2 Phase 2 实施目标清单

```
[ ] 修复 Graphify 知识图谱 "No matching nodes found" 问题
[ ] 实现 AuditLogPanel 组件
[ ] 对接 AuditServiceImpl 后端服务
[ ] 绑定 @Auditable 注解字段可视化
[ ] 完善 AssetMetadataPanel.tsx 元数据展示
[ ] 更新 flow.ts 类型定义
[ ] 补充缺失的 docstring 文档（11 个问题点）
```

---

## 3. 边界约束

### 3.1 范围边界

| 约束项 | 规定 |
|--------|------|
| 组件边界 | 仅涉及 `AssetDetailView`、`AuditLogPanel`、`AssetMetadataPanel`，不涉及其他业务模块 |
| 数据边界 | 仅处理资产详情与审计日志相关 API 响应，不包含外部数据源 |
| 可视化边界 | 仅展示 @Auditable 标记字段的操作轨迹图，不包含业务统计图表 |

### 3.2 技术边界

| 禁止项 | 说明 |
|--------|------|
| 禁止直接调用数据库 | 所有数据操作必须通过 Service 层 |
| 禁止在 UI 组件内处理业务逻辑 | 应委托 `AuditServiceImpl` 处理 |
| 禁止硬编码 API 路径 | 必须通过环境变量或配置中心获取 |

### 3.3 后端服务接口边界

#### AuditServiceImpl 接口定义

```java
// backend/src/main/java/com/ams/service/impl/AuditServiceImpl.java

public interface AuditService {
    /**
     * 获取资产审计日志分页列表
     * @param assetId 资产ID
     * @param page 页码
     * @param pageSize 每页数量
     * @return 审计日志分页结果
     */
    PageResult<AuditLog> getAuditLogs(String assetId, int page, int pageSize);
    
    /**
     * 获取资产的 @Auditable 标记字段列表
     * @param assetId 资产ID
     * @return 可审计字段列表
     */
    List<AuditableField> getAuditableFields(String assetId);
    
    /**
     * 导出审计日志
     * @param assetId 资产ID
     * @param format 导出格式 (csv/json)
     * @return 文件二进制流
     */
    byte[] exportAuditLog(String assetId, String format);
}
```

#### 数据模型约束

```typescript
// frontend/src/app/types/audit.types.ts

interface AuditLog {
  id: string;
  assetId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSFER' | 'MAINTENANCE';
  field: string;           // @Auditable 标记字段名
  oldValue: unknown;
  newValue: unknown;
  operator: string;
  timestamp: string;       // ISO 8601 格式
  ipAddress: string;
  userAgent: string;
}

interface AuditableField {
  fieldName: string;
  fieldLabel: string;      // 中文显示名称
  fieldType: 'STRING' | 'NUMBER' | 'DATE' | 'ENUM';
  currentValue: unknown;
  lastModifiedAt: string;
}
```

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-001：Graphify 知识图谱节点匹配测试

**测试文件**: `tests/test_asset_detail_e2e.spec.ts`

| 步骤 | 操作 | 期待结果 |
|------|------|----------|
| 1 | 访问资产详情页 `/assets/:id/detail` | Graphify 组件挂载完成 |
| 2 | 检查控制台无 "No matching nodes found" 错误 | 节点匹配逻辑正常执行 |
| 3 | 验证 `createGraphifyNodes` 函数返回有效节点数组 | 数组长度 > 0，节点包含必要属性 |
| 4 | 验证 `GraphifyNodeFactory` 正确映射节点类型 | AssetNode、DocumentNode 等组件正确渲染 |

**物理测试断言**:
```typescript
// Playwright E2E
test('Graphify 知识图谱节点正确渲染', async ({ page }) => {
  await page.goto('/assets/AST-2024-00001/detail');
  
  // 验证无 "No matching nodes found" 错误
  const errorLogs = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && msg.text().includes('No matching nodes')) {
      errorLogs.push(msg.text());
    }
  });
  
  await page.waitForSelector('[data-testid="graphify-container"]');
  expect(errorLogs).toHaveLength(0);
  
  // 验证节点数量
  const nodes = await page.locator('[data-testid="graphify-node"]').count();
  expect(nodes).toBeGreaterThan(0);
});
```

### 4.2 ATB-002：审计日志面板集成测试

**测试文件**: `frontend/tests/unit/auditLog.test.ts`

| 步骤 | 操作 | 期待结果 |
|------|------|----------|
| 1 | 调用 `getAuditLogs('A001', 1, 20)` | 发起 HTTP 请求，Loading 状态显示 |
| 2 | 模拟 API 返回 10 条审计日志 | 列表展示 10 条记录 |
| 3 | 验证 @Auditable 字段高亮 | 变更字段显示 `AuditableBadge` 徽章 |
| 4 | 分页切换至第 2 页 | 发起分页请求，列表更新 |

**物理测试断言**:
```typescript
// Vitest
vi.spyOn(auditApi, 'getAuditLogs').mockResolvedValue(mockAuditLogs);

render(<AuditLogPanel assetId="A001" />);

const items = screen.getAllByTestId('audit-log-item');
expect(items).toHaveLength(10);
expect(items[0]).toHaveAttribute('data-field', 'status');
expect(items[0].querySelector('[data-auditable-badge]')).not.toBeNull();
```

### 4.3 ATB-003：AuditServiceImpl 服务层测试

**测试文件**: `tests/test_service_integration.py`

| 步骤 | 操作 | 期待结果 |
|------|------|----------|
| 1 | 注入 `AuditServiceImpl` Bean | 服务实例化成功，无循环依赖 |
| 2 | 调用 `getAuditLogs('AST-001', 1, 20)` | 返回分页结果，数据结构正确 |
| 3 | 调用 `getAuditableFields('AST-001')` | 返回带 @Auditable 标记的字段列表 |
| 4 | 模拟 401 未授权 | 抛出 `UnauthorizedException` |
| 5 | 模拟 500 服务端错误 | 抛出 `ServerException`，记录日志 |

**物理测试断言**:
```python
# pytest
def test_audit_service_get_logs():
    service = AuditServiceImpl(auditEntryMapper, assetMapper)
    result = service.getAuditLogs('AST-001', 1, 20)
    
    assert result.items is not None
    assert result.total >= 0
    assert all(hasattr(item, 'field') for item in result.items)
```

### 4.4 ATB-004：@Auditable 可视化绑定测试

**测试文件**: `frontend/tests/unit/auditableBinding.test.ts`

| 步骤 | 操作 | 期待结果 |
|------|------|----------|
| 1 | 获取资产的 @Auditable 字段列表 | 返回字段包含 `status`, `location`, `custodian` |
| 2 | 渲染变更轨迹时间线 | ECharts 时间线展示操作节点 |
| 3 | 悬停节点显示 Tooltip | 展示变更前后值、操作人、IP |
| 4 | 点击节点跳转详情 | 滚动至对应审计日志行 |

### 4.5 ATB-005：文档完整性验证

**测试文件**: `tests/test_docstring_coverage.py`

| 步骤 | 操作 | 期待结果 |
|------|------|----------|
| 1 | 扫描所有修改的 TypeScript 文件 | 统计缺失 docstring 的函数数量 |
| 2 | 验证 `CustomNodes.tsx` 中的关键函数 | `createGraphifyNodes`、`GraphifyNodeFactory` 等必须有文档 |
| 3 | 验证 `AuditLogPanel.tsx` 中的函数 | 所有导出函数必须有 JSDoc |

**当前问题点（11 个）**:
```
tests/test_e2e_audit.py: 若干测试函数缺少 docstring
frontend/src/app/components/flow/CustomNodes.tsx: 部分函数缺少文档
```

---

## 5. 开发切入层级序列

### L1：后端服务层（AuditServiceImpl）

```
backend/src/main/java/com/ams/service/impl/
└── AuditServiceImpl.java        # 核心服务实现
```

**实施步骤**:

1. **修复 Graphify 数据源问题**（优先级：P0）

   检查 `AuditServiceImpl` 中 Graphify 节点查询逻辑：
   ```java
   // 确保节点查询条件与前端 GraphifyNodeType 枚举对齐
   @Override
   public List<GraphifyNode> getGraphifyNodes(String assetId) {
       // 修复：使用正确的字段名匹配 GraphifyNodeType
       List<Asset> assets = assetMapper.selectByAssetId(assetId);
       return assets.stream()
           .map(this::toGraphifyNode)
           .collect(Collectors.toList());
   }
   ```

2. **完善审计日志查询方法**

   确保分页查询正确返回 @Auditable 字段变更记录。

### L2：前端类型定义（flow.ts）

```
frontend/src/app/types/
└── flow.ts                      # Graphify 类型定义
```

**实施步骤**:

```typescript
// 修复 GraphifyNodeType 枚举值与后端对齐
export enum GraphifyNodeType {
  ASSET = 'ASSET',
  DOCUMENT = 'DOCUMENT', 
  PROCESS = 'PROCESS',
  METRIC = 'METRIC',
  RELATIONSHIP = 'RELATIONSHIP'
}

export interface GraphifyNodeData {
  id: string;
  label: string;
  nodeType: GraphifyNodeType;
  graphifyId?: string;
  position: { x: number; y: number };
  properties: Record<string, unknown>;
  relationships: GraphifyRelationship[];
  metadata?: Record<string, unknown>;
}
```

### L3：前端组件层

#### 3.1 CustomNodes.tsx 修复

```
frontend/src/app/components/flow/
└── CustomNodes.tsx              # 修复节点匹配问题
```

**关键函数修复**:

```typescript
/**
 * 获取匹配的 GraphifyNodeType 枚举值
 * 处理 API 返回的变体形式（如 'NODE', 'ASSET_NODE'）
 * 
 * @param nodeType - 输入的节点类型字符串
 * @returns 匹配的 GraphifyNodeType 枚举值，未找到则返回 ASSET
 */
const getMatchingNodeType = (nodeType: string): GraphifyNodeType => {
  const normalized = normalizeNodeType(nodeType);
  
  // 1. 尝试直接匹配枚举值
  for (const type of Object.values(GraphifyNodeType)) {
    if (type === normalized) {
      return type as GraphifyNodeType;
    }
  }
  
  // 2. 尝试别名匹配（处理 API 返回的变体形式）
  const aliasMap: Record<string, GraphifyNodeType> = {
    'NODE': GraphifyNodeType.ASSET,
    'ASSET_NODE': GraphifyNodeType.ASSET,
    'DOC': GraphifyNodeType.DOCUMENT,
    'PROCESS_NODE': GraphifyNodeType.PROCESS,
    'WORKFLOW': GraphifyNodeType.PROCESS,
    'METRICS': GraphifyNodeType.METRIC,
    'REL': GraphifyNodeType.RELATIONSHIP,
    'REL_NODE': GraphifyNodeType.RELATIONSHIP,
    'EDGE': GraphifyNodeType.RELATIONSHIP
  };
  
  return aliasMap[normalized] ?? GraphifyNodeType.ASSET;
};

/**
 * 创建 Graphify 节点数组
 * 
 * @param assets - 资产列表及位置信息
 * @returns 创建的图谱节点数组
 */
export const createGraphifyNodes = (
  assets: Array<{
    asset: AssetDetailForGraphify;
    position: { x: number; y: number };
  }>
): GraphifyNode[] => {
  return assets.map(({ asset, position }) =>
    createGraphifyNodeFromAsset(asset, position)
  );
};

/**
 * Graphify 节点工厂函数
 * 根据节点类型返回对应的 React 组件
 * 
 * @param nodeType - 节点类型
 * @returns 对应的 React 组件
 * @throws 当节点类型完全无法识别时，返回默认的 AssetNode
 */
export const GraphifyNodeFactory = (
  nodeType: GraphifyNodeData['nodeType']
): React.FC<NodeProps<GraphifyNodeData>> => {
  const nodeTypeComponentMap: Record<string, React.FC<NodeProps<GraphifyNodeData>>> = {
    [GraphifyNodeType.ASSET]: AssetNode,
    [GraphifyNodeType.DOCUMENT]: DocumentNode,
    [GraphifyNodeType.PROCESS]: ProcessNode,
    [GraphifyNodeType.METRIC]: MetricNode,
    [GraphifyNodeType.RELATIONSHIP]: RelationshipNode
  };
  
  const normalizedType = getMatchingNodeType(nodeType || '');
  return nodeTypeComponentMap[normalizedType] ?? AssetNode;
};
```

#### 3.2 AssetMetadataPanel.tsx 增强

```
frontend/src/app/components/asset/
└── AssetMetadataPanel.tsx       # 元数据面板增强
```

**实施要点**:

- 展示资产元数据字段
- 标记 @Auditable 字段并高亮显示
- 支持元数据展开/折叠

#### 3.3 新增审计日志相关组件

```
frontend/src/app/components/audit/
├── AuditLogPanel.tsx            # 审计日志面板
├── AuditLogItem.tsx             # 单条日志项
├── AuditTimeline.tsx            # 变更轨迹图
└── AuditableBadge.tsx           # @Auditable 标记徽章
```

### L4：路由与页面配置

```typescript
// frontend/src/app/routes.ts
{
  path: '/assets/:id/detail',
  name: 'AssetDetail',
  component: () => import('./components/asset/AssetDetailView'),
  meta: { 
    requiresAuth: true, 
    title: '资产详情',
    breadcrumbs: ['资产管理', '资产列表', '资产详情']
  }
}
```

### L5：测试覆盖要求

| 测试类型 | 文件路径 | 覆盖率目标 |
|----------|----------|------------|
| 单元测试 | `frontend/tests/unit/auditLog.test.ts` | ≥ 90% |
| 单元测试 | `frontend/tests/unit/auditableBinding.test.ts` | ≥ 85% |
| E2E 测试 | `tests/test_asset_detail_e2e.spec.ts` | 核心路径 100% |
| E2E 测试 | `tests/test_e2e_audit.py` | 完整流程覆盖 |

---

## 6. 交付物清单

| 交付物 | 文件路径 | 状态 |
|--------|----------|------|
| Graphify 节点匹配修复 | `frontend/src/app/components/flow/CustomNodes.tsx` | 🔴 待修复 |
| 类型定义更新 | `frontend/src/app/types/flow.ts` | 🟡 待更新 |
| 审计日志面板组件 | `frontend/src/app/components/audit/AuditLogPanel.tsx` | 🔴 待实现 |
| 元数据面板增强 | `frontend/src/app/components/asset/AssetMetadataPanel.tsx` | 🟡 待增强 |
| 单元测试 | `frontend/tests/unit/auditLog.test.ts` | 🟡 需补充 docstring |
| E2E 测试 | `tests/test_asset_detail_e2e.spec.ts` | 🟡 需补充 docstring |
| Python E2E 测试 | `tests/test_e2e_audit.py` | 🟡 需补充 docstring (11 处) |

---

## 7. 依赖前置确认

| 前置任务 | 负责人 | 完成状态 |
|----------|--------|----------|
| SWARM-042: AuditServiceImpl 基础架构 | Backend Team | ✅ 已完成 |
| SWARM-044: @Auditable 注解定义 | Backend Team | ✅ 已完成 |
| SWARM-049: 资产详情页骨架 | Frontend Team | ✅ 已完成 |
| SWARM-050: 资产详情页路由配置 | Frontend Team | ✅ 已完成 |

---

## 8. 已知问题与修复计划

### 8.1 问题 #1：Graphify "No matching nodes found"

**根因分析**:
- `CustomNodes.tsx` 中 `getMatchingNodeType` 函数未处理 API 返回的节点类型变体
- `GraphifyNodeFactory` 节点类型映射表不完整

**修复方案**:
1. 扩展 `aliasMap` 别名映射表
2. 添加降级策略：无法识别时返回默认 `AssetNode`
3. 添加类型守卫函数 `normalizeNodeType`

**修复验证**:
```bash
# 运行 E2E 测试
pnpm test:e2e --grep "Graphify"

# 预期：所有节点正确渲染，无 "No matching nodes found" 错误
```

### 8.2 问题 #2：11 处缺失 docstring

**受影响文件**:
- `tests/test_e2e_audit.py` - 若干测试函数
- `frontend/src/app/components/flow/CustomNodes.tsx` - 部分函数

**修复方案**:
为每个受影响的函数添加标准 JSDoc 文档块。

**验证方法**:
```bash
# 运行文档覆盖率测试
python tests/test_docstring_coverage.py

# 预期：通过率 100%
```

---

## 9. 后续迭代计划

| Phase | 目标 | 依赖 |
|-------|------|------|
| Phase 3 | 可视化图表与交互优化（ECharts 时间线增强） | Phase 2 完成 |
| Phase 4 | 性能调优与集成测试（缓存策略、懒加载） | Phase 3 完成 |

---

**文档结束**