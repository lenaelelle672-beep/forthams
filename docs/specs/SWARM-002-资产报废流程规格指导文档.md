# SWARM-002 [资产报废流程] 规格指导文档

---

## 1. 需求与背景

### 1.1 业务场景

资产管理系统需覆盖资产全生命周期管理。资产在完成使用寿命周期或因故障损毁无法修复后，需经过规范化的报废审批流程，标记为报废状态并从在役资产台账中移出。

### 1.2 业务价值

- 建立标准化的资产退役机制，防止已报废资产继续在系统中流转
- 保留完整的资产状态变更历史，满足审计追溯要求
- 实时同步资产台账数据，确保账实一致

### 1.3 依赖前置条件

- 资产台账基础数据已建立（参见 SWARM-001）
- 用户认证与权限体系已就绪
- 后端报废服务 API 已部署并可用

---

## 2. 当前 Phase 对应实施目标

### 2.1 参照 plan.md Phase 拆解

| Phase ID | Phase 名称 | 状态 | 说明 |
|----------|-----------|------|------|
| Phase 1 | 资产台账基础管理 | 已完成 | 资产CRUD、基础查询 |
| **Phase 2** | **资产报废流程** | **本次迭代** | **SWARM-002 实施范围** |
| Phase 3 | 资产调拨流程 | 待实施 | - |
| Phase 4 | 资产维保流程 | 待实施 | - |

### 2.2 本次 Phase 2 实施目标

本次迭代为 **Iteration-1**，聚焦前端界面适配与 API 对接：

| 目标编号 | 目标描述 | 交付物 |
|----------|----------|--------|
| F-001 | 审计仪表盘样式优化 | `AuditDashboard.module.css` |
| F-002 | 筛选组件样式优化 | `FilterBar/FilterBar.module.css` |
| F-003 | 审计数据 Hook 增强 | `useAuditData.ts` |
| F-004 | 报废 API 服务层对接 | `retirementApi.ts` |
| F-005 | 报废流程类型定义完善 | `retirement.types.ts` |

### 2.3 后端 API 能力（已就绪）

以下 API 端点由后端提供，前端需对接：

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/assets/{asset_id}/scrap-requests` | POST | 提交报废申请 |
| `/api/scrap-requests/{request_id}/approve` | PUT | 审批通过 |
| `/api/scrap-requests/{request_id}/reject` | PUT | 审批驳回 |
| `/api/assets/{asset_id}/status-history` | GET | 查询状态变更历史 |

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 具体约束 |
|--------|----------|
| 申请前置状态 | 仅允许状态为"退役"的资产提交报废申请 |
| 申请人权限 | 需具备 `asset:apply_retire` 权限 |
| 审批人权限 | 需具备 `asset:approve_scrap` 权限 |
| 审批方式 | 单级审批，不支持多级会签 |
| 不可逆约束 | 报废状态为终态，不可变更回退役或在役 |
| 数据完整性 | 报废操作必须原子性完成，否则事务回滚 |

### 3.2 前端约束

| 约束项 | 具体约束 |
|--------|----------|
| 框架版本 | React 18+ / TypeScript 4.9+ |
| 样式方案 | CSS Modules |
| 状态管理 | React Query / Zustand |
| API 调用 | 基于 axios 封装的 http 客户端 |
| 响应式 | 需适配 1280px+ 桌面端 |

### 3.3 非功能约束

- 单次报废申请处理响应时间 ≤ 2s（后端）
- 状态变更历史查询支持按资产编号、时间范围筛选
- 系统需记录操作人、操作时间、操作类型、变更前后状态

### 3.4 外部依赖

- 依赖通知服务发送审批结果通知（可降级处理）

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 报废申请提交

| 测试编号 | 测试描述 | 物理测试方法 | 预期结果 |
|----------|----------|--------------|----------|
| ATB-1.1 | 正常提交报废申请 | POST `/api/assets/{asset_id}/scrap-requests` | 返回 201，生成 scrap_request 记录，状态为 pending |
| ATB-1.2 | 对非退役状态资产提交申请 | POST `/api/assets/{asset_id}/scrap-requests`（资产状态为"在役"） | 返回 400，错误码 `ASSET_STATUS_INVALID` |
| ATB-1.3 | 重复提交报废申请 | 同一资产两次 POST | 返回 409，错误码 `SCRAP_REQUEST_DUPLICATE` |
| ATB-1.4 | 提交时自动生成状态变更历史 | POST 后查询 `/api/assets/{asset_id}/status-history` | 新增 type="SCRAP_APPLY", from_status="retired", to_status="pending" 记录 |
| ATB-1.5 | 无权限用户提交申请 | 以无 `asset:apply_retire` 权限用户请求 | 返回 403 |

### 4.2 ATB-2: 审批流程

| 测试编号 | 测试描述 | 物理测试方法 | 预期结果 |
|----------|----------|--------------|----------|
| ATB-2.1 | 审批通过 | PUT `/api/scrap-requests/{request_id}/approve` | 返回 200，request 状态更新为 approved |
| ATB-2.2 | 审批驳回 | PUT `/api/scrap-requests/{request_id}/reject` | 返回 200，request 状态更新为 rejected |
| ATB-2.3 | 驳回时可选填写理由 | PUT with `reject_reason` | 返回 200，驳回理由被记录 |
| ATB-2.4 | 重复审批同一申请 | 同一 request 两次 approve | 第二次返回 409，错误码 `REQUEST_ALREADY_PROCESSED` |
| ATB-2.5 | 无权限用户审批 | 以无 `asset:approve_scrap` 权限用户请求 | 返回 403 |

### 4.3 ATB-3: 资产状态同步

| 测试编号 | 测试描述 | 物理测试方法 | 预期结果 |
|----------|----------|--------------|----------|
| ATB-3.1 | 审批通过后资产状态变更为已报废 | approve 后 GET `/api/assets/{asset_id}` | asset.status == "scrapped" |
| ATB-3.2 | 审批通过后生成状态变更历史 | approve 后查询 status-history | 新增 type="SCRAP_APPROVED" 记录 |
| ATB-3.3 | 审批通过为原子操作 | approve 操作开启事务，注入失败 | 事务回滚，资产状态不变更 |
| ATB-3.4 | 驳回后资产状态保持退役 | reject 后 GET asset | asset.status == "retired"（未变更） |

### 4.4 ATB-4: 状态变更历史查询

| 测试编号 | 测试描述 | 物理测试方法 | 预期结果 |
|----------|----------|--------------|----------|
| ATB-4.1 | 按资产编号查询历史 | GET `/api/assets/{asset_id}/status-history` | 返回该资产的完整变更记录列表 |
| ATB-4.2 | 按时间范围筛选 | GET with `?start_time=&end_time=` | 仅返回指定时间范围内的记录 |
| ATB-4.3 | 分页查询 | GET with `?page=&page_size=` | 返回分页结果，包含 total, page, page_size |
| ATB-4.4 | 历史记录包含操作人信息 | 查询结果检查 | 每条记录包含 operator, operated_at 字段 |

### 4.5 ATB-5: 边界条件验证

| 测试编号 | 测试描述 | 物理测试方法 | 预期结果 |
|----------|----------|--------------|----------|
| ATB-5.1 | 报废状态不可逆变更 | 尝试将报废资产状态改回其他状态 | API 返回 400，错误码 `SCRAPPED_STATUS_IMMUTABLE` |
| ATB-5.2 | 资产不存在时的错误处理 | 对不存在的 asset_id 操作 | 返回 404，错误码 `ASSET_NOT_FOUND` |
| ATB-5.3 | 申请不存在时的审批处理 | 对不存在的 request_id 审批 | 返回 404，错误码 `REQUEST_NOT_FOUND` |

---

## 5. 开发切入层级序列

### 5.1 Level 1: 类型定义层 (`retirement.types.ts`)

```
步骤 1.1: 扩展 AssetStatus 枚举
├── 新增值: "scrapped"
└── 导出: AssetStatus

步骤 1.2: 定义 ScrapRequest 类型
├── 字段: id, assetId, applicantId, reason, status, rejectReason, createdAt, updatedAt
├── 状态: ScrapRequestStatus (pending | approved | rejected)
└── 导出: ScrapRequest, ScrapRequestStatus

步骤 1.3: 定义 StatusHistory 类型
├── 字段: id, assetId, type, fromStatus, toStatus, operatorId, operatedAt, extraData
├── 类型枚举: StatusHistoryType
└── 导出: StatusHistory, StatusHistoryType

步骤 1.4: 定义 API 请求/响应类型
├── ScrapRequestCreateDto
├── ScrapRequestResponseDto
├── ScrapApproveDto
├── ScrapRejectDto
└── StatusHistoryQueryDto
```

### 5.2 Level 2: API 服务层 (`retirementApi.ts`)

```
步骤 2.1: 配置 API 基础路径
├── BASE_URL: '/api'
└── RETIREMENT_ENDPOINT: '/assets/{assetId}/scrap-requests'

步骤 2.2: 实现提交报废申请 API
├── submitScrapRequest(assetId, reason) → Promise<ScrapRequest>
└── 错误处理: ASSET_NOT_FOUND, ASSET_STATUS_INVALID, SCRAP_REQUEST_DUPLICATE

步骤 2.3: 实现审批相关 API
├── approveScrapRequest(requestId) → Promise<ScrapRequest>
├── rejectScrapRequest(requestId, reason?) → Promise<ScrapRequest>
└── 错误处理: REQUEST_NOT_FOUND, REQUEST_ALREADY_PROCESSED, PERMISSION_DENIED

步骤 2.4: 实现状态历史查询 API
├── getStatusHistory(assetId, params?) → Promise<PaginatedResult<StatusHistory>>
└── 参数: startTime?, endTime?, page?, pageSize?
```

### 5.3 Level 3: Hook 层 (`useAuditData.ts`)

```
步骤 3.1: 定义 Hook 返回类型
├── useAuditData return type
│   ├── auditLogs: AuditLog[]
│   ├── isLoading: boolean
│   ├── error: Error | null
│   ├── refetch: () => void
│   └── pagination: PaginationState
│
步骤 3.2: 实现数据获取逻辑
├── useQuery 封装 API 调用
├── 支持手动刷新
└── 错误边界处理

步骤 3.3: 实现筛选状态管理
├── filters: FilterState
├── setFilters: (filters) => void
└── resetFilters: () => void
```

### 5.4 Level 4: UI 样式层 (CSS Modules)

#### 5.4.1 `AuditDashboard.module.css`

```
步骤 4.1.1: 定义仪表盘容器样式
├── .dashboardContainer
│   ├── display: flex
│   ├── flexDirection: column
│   └── gap: 24px
│
步骤 4.1.2: 定义 KPI 卡片区域样式
├── .kpiSection
│   └── grid / flex layout
│
步骤 4.1.3: 定义主内容区样式
├── .mainContent
│   └── responsive grid
│
步骤 4.1.4: 定义表格区域样式
├── .tableSection
│   └── overflow handling
```

#### 5.4.2 `FilterBar/FilterBar.module.css`

```
步骤 4.2.1: 定义筛选栏容器
├── .filterBar
│   ├── display: flex
│   ├── gap: 16px
│   └── alignItems: center
│
步骤 4.2.2: 定义筛选项样式
├── .filterItem
│   └── width constraints
│
步骤 4.2.3: 定义按钮样式
├── .filterButton
│   ├── primary variant
│   └── secondary variant
│
步骤 4.2.4: 定义响应式断点
└── @media (maxWidth: 1024px)
```

---

## 6. 数据模型变更摘要

### 6.1 前端类型变更 (`retirement.types.ts`)

```typescript
// AssetStatus 新增枚举值
enum AssetStatus {
  ACTIVE = 'active',
  IDLE = 'idle',
  RETIRED = 'retired',
  SCRAPPED = 'scrapped',  // 新增
}

// ScrapRequest 状态
enum ScrapRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// 状态变更历史类型
enum StatusHistoryType {
  SCRAP_APPLY = 'SCRAP_APPLY',
  SCRAP_APPROVED = 'SCRAP_APPROVED',
  SCRAP_REJECTED = 'SCRAP_REJECTED',
}
```

### 6.2 API 响应数据结构

#### ScrapRequest 响应

```json
{
  "id": "uuid",
  "assetId": "uuid",
  "applicantId": "uuid",
  "reason": "string",
  "status": "pending|approved|rejected",
  "rejectReason": "string|null",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

#### StatusHistory 响应

```json
{
  "id": "uuid",
  "assetId": "uuid",
  "type": "SCRAP_APPLY|SCRAP_APPROVED|SCRAP_REJECTED",
  "fromStatus": "string",
  "toStatus": "string",
  "operatorId": "uuid",
  "operatedAt": "ISO8601",
  "extraData": {}
}
```

#### 错误响应

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "details": {}
}
```

---

## 7. 错误码对照表

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| ASSET_NOT_FOUND | 404 | 资产不存在 |
| ASSET_STATUS_INVALID | 400 | 资产状态不满足操作前置条件 |
| SCRAPPED_STATUS_IMMUTABLE | 400 | 报废状态不可变更 |
| REQUEST_NOT_FOUND | 404 | 报废申请不存在 |
| SCRAP_REQUEST_DUPLICATE | 409 | 存在待处理的报废申请 |
| REQUEST_ALREADY_PROCESSED | 409 | 申请已被处理，不可重复操作 |
| PERMISSION_DENIED | 403 | 权限不足 |

---

## 8. 文件变更清单

| 文件路径 | 变更类型 | 变更描述 |
|----------|----------|----------|
| `frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css` | 修改 | 审计仪表盘样式优化 |
| `frontend/src/app/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` | 修改 | 筛选组件样式优化 |
| `frontend/src/app/pages/AuditDashboard/hooks/useAuditData.ts` | 修改 | 审计数据 Hook 增强 |
| `frontend/src/api/retirementApi.ts` | 修改 | 报废 API 服务层对接 |
| `frontend/src/pages/retirement/types/retirement.types.ts` | 修改 | 报废流程类型定义完善 |

---

## 9. 附录：E2E 测试用例摘要

### 9.1 报废申请提交流程 (`retirement_flow.spec.ts`)

```typescript
describe('报废申请提交流程', () => {
  it('AC-001: 用户可对退役资产提交报废申请', async () => {
    // 1. 登录系统
    // 2. 进入资产列表页面
    // 3. 选择状态为"退役"的资产
    // 4. 点击"提交报废申请"按钮
    // 5. 填写报废原因
    // 6. 确认提交
    // 7. 验证申请状态为"待审批"
  });
});
```

### 9.2 审批流程 (`approval.spec.ts`)

```typescript
describe('报废审批流程', () => {
  it('AC-002: 审批人可审批报废申请', async () => {
    // 1. 审批人登录系统
    // 2. 进入报废申请审批页面
    // 3. 选择待审批的报废申请
    // 4. 点击"通过"按钮
    // 5. 验证资产状态变更为"已报废"
  });
});
```

---

**文档版本**: v1.0  
**创建日期**: 2024  
**审核状态**: ✅ 已审核通过  
**关联迭代**: SWARM-002 Iteration-1