# SWARM-002 资产报废退役流程 - 规格指导文档

**版本**: v1.0  
**Task ID**: SWARM-002  
**Iteration**: 1  
**状态**: 规格评审中

---

## 需求与背景

### 业务场景

资产管理生命周期中，资产从采购入库开始经历使用、维护、最终面临报废或退役处置。当前系统缺失资产报废退役的标准化流程，导致：

- 资产报废缺乏统一审批机制
- 报废状态不可追溯
- 历史资产数据无法闭环管理

### 核心需求

| 需求项 | 描述 |
|--------|------|
| RQ-001 | 用户可提交资产报废申请，关联目标资产及报废原因 |
| RQ-002 | 报废申请按审批链自动路由至责任人 |
| RQ-003 | 审批人可批准或驳回报废申请 |
| RQ-004 | 用户可实时跟踪报废申请的审批进度 |
| RQ-005 | 审批完成后资产状态自动流转至"已报废" |

### 关键实体

```
Asset (资产)
├── id: UUID
├── asset_code: String (唯一编码)
├── name: String
├── status: Enum [IN_USE, PENDING_RETIREMENT, RETIRED, SCRAPPED]
└── ... (现有字段)

RetirementRequest (报废申请)
├── id: UUID
├── asset_id: FK -> Asset
├── applicant_id: FK -> User
├── reason: RetirementReason (报废原因枚举)
├── description: Text
├── status: Enum [DRAFT, PENDING, APPROVED, REJECTED]
├── current_approver_id: FK -> User
└── created_at, updated_at

ApprovalChain (审批链)
├── id: UUID
├── request_id: FK -> RetirementRequest
├── approver_id: FK -> User
├── sequence: Integer (审批顺序)
├── decision: Enum [PENDING, APPROVED, REJECTED]
├── comment: String
└── decided_at
```

---

## 当前 Phase 对应实施目标

### Phase 2: 报废申请与审批基础流程（本次 Iteration）

参照整体计划，Phase 2 聚焦于**最小可行审批流程**的实现：

```
Phase 1 (已完成): 资产状态枚举扩展
     ↓
Phase 2 (本次): 报废申请提交 → 单级审批 → 状态更新 ← [当前]
     ↓
Phase 3: 审批链可视化 + 多级审批
     ↓
Phase 4: 批量报废 + 导出报表
```

### 本次 Iteration 交付范围

| 交付物 | 说明 |
|--------|------|
| 后端 API | 报废申请 CRUD、审批操作接口 |
| 数据模型 | RetirementRequest, ApprovalChain 表结构 |
| 状态机 | 资产状态流转逻辑 (IN_USE → PENDING_RETIREMENT → SCRAPPED) |
| 前端页面 | 报废申请表单 + 审批进度跟踪 |

---

## 边界约束

### 功能边界

| 约束项 | 描述 |
|--------|------|
| BC-001 | **单级审批**: 本次 Iteration 仅支持单一审批人，不支持会签或多级审批链 |
| BC-002 | **单资产申请**: 一次报废申请仅关联一个资产，不支持批量报废 |
| BC-003 | **状态限制**: 仅 `IN_USE` 状态的资产可发起报废申请 |
| BC-004 | **操作权限**: 申请人不可审批自己的申请 |
| BC-005 | **草稿状态**: 申请提交前可保存草稿，提交后不可修改 |

### 非功能边界

| 约束项 | 描述 |
|--------|------|
| NB-001 | 暂不实现附件上传功能 |
| NB-002 | 暂不实现消息通知（邮件/站内信） |
| NB-003 | 暂不实现报废资产的后续处置跟踪 |

### 技术约束

| 约束项 | 描述 |
|--------|------|
| TC-001 | 后端使用 Django REST Framework / Spring Boot |
| TC-002 | 前端使用 React + TypeScript |
| TC-003 | 数据库事务保证审批状态更新的原子性 |

---

## 验收测试基准 (ATB)

### 后端 API 测试

使用 `pytest` + `pytest-django` 执行，测试文件: `tests/api/test_retirement.py`

#### ATB-001: 报废申请创建

```python
# Test Case: ATB-001
def test_create_retirement_request_success(api_client, asset_in_use, user):
    """
    Given: 存在 IN_USE 状态的资产
    When:  用户提交有效的报废申请
    Then:  返回 201 Created
          RetirementRequest.status == 'PENDING'
          Asset.status 自动变更为 'PENDING_RETIREMENT'
          审批链自动创建单条记录
    """
```

**物理测试期待**:
- `POST /api/v1/retirements/` 返回 201
- 数据库 `retirement_requests` 表插入 1 条记录
- 数据库 `assets` 表对应记录 `status` 变更为 `PENDING_RETIREMENT`
- 数据库 `approval_chains` 表插入 1 条审批记录

#### ATB-002: 申请状态校验

```python
# Test Case: ATB-002
def test_create_retirement_invalid_asset_status(api_client, asset_not_in_use):
    """
    Given: 资产状态不为 IN_USE
    When:  提交报废申请
    Then:  返回 400 Bad Request
          错误信息包含 "资产状态不允许报废申请"
    """
```

**物理测试期待**:
- `POST /api/v1/retirements/` 返回 400
- 数据库无新记录插入

#### ATB-003: 审批通过

```python
# Test Case: ATB-003
def test_approve_retirement_request(api_client, retirement_request, approver_user):
    """
    Given: 存在 PENDING 状态的报废申请
    When:  审批人批准申请
    Then:  返回 200 OK
          RetirementRequest.status == 'APPROVED'
          Asset.status 变更为 'SCRAPPED'
          ApprovalChain.decision == 'APPROVED'
    """
```

**物理测试期待**:
- `POST /api/v1/retirements/{id}/approve/` 返回 200
- 资产状态最终为 `SCRAPPED`

#### ATB-004: 审批驳回

```python
# Test Case: ATB-004
def test_reject_retirement_request(api_client, retirement_request, approver_user):
    """
    Given: 存在 PENDING 状态的报废申请
    When:  审批人驳回申请
    Then:  返回 200 OK
          RetirementRequest.status == 'REJECTED'
          Asset.status 回退为 'IN_USE'
    """
```

**物理测试期待**:
- `POST /api/v1/retirements/{id}/reject/` 返回 200
- 资产状态恢复为 `IN_USE`

#### ATB-005: 进度查询

```python
# Test Case: ATB-005
def test_get_retirement_progress(api_client, user, retirement_request):
    """
    Given: 存在报废申请
    When:  申请人查询进度
    Then:  返回包含当前审批状态和审批历史的完整对象
    """
```

**物理测试期待**:
- `GET /api/v1/retirements/{id}/progress/` 返回 200
- 响应包含 `status`, `current_approver`, `approval_history` 字段

### 前端功能测试

使用 Playwright 执行，测试文件: `e2e/retirement.spec.ts`

#### ATB-006: 报废申请页面渲染

```typescript
// Test Case: ATB-006
test('retirement application page loads correctly', async ({ page }) => {
  await page.goto('/assets/retirement/new');
  await expect(page.locator('form')).toBeVisible();
  await expect(page.locator('#asset-selector')).toBeVisible();
  await expect(page.locator('#reason-select')).toBeVisible();
});
```

**物理测试期待**: 页面加载成功，关键表单元素可见

#### ATB-007: 提交申请流程

```typescript
// Test Case: ATB-007
test('submit retirement application', async ({ page }) => {
  await page.goto('/assets/retirement/new');
  await page.selectOption('#asset-selector', 'AST-001');
  await page.selectOption('#reason-select', 'DAMAGED');
  await page.fill('#description', '设备老化严重');
  await page.click('button[type="submit"]');
  
  await expect(page.locator('.toast-success')).toBeVisible();
  await expect(page).toHaveURL(/\/retirement\/\w+\/progress/);
});
```

**物理测试期待**: 
- 表单提交成功
- 显示成功提示
- 跳转至进度跟踪页面

#### ATB-008: 审批进度可视化

```typescript
// Test Case: ATB-008
test('view approval progress', async ({ page }) => {
  await page.goto('/retirement/RET-001/progress');
  
  await expect(page.locator('.status-badge')).toContainText('审批中');
  await expect(page.locator('.approver-name')).toContainText('张经理');
  await expect(page.locator('.timeline')).toBeVisible();
});
```

**物理测试期待**: 进度页面展示当前状态、审批人、时间线

---

## 开发切入层级序列

### 层级 1: 数据模型层 (Day 1)

```
1.1 创建数据库迁移
    - retirement_requests 表
    - approval_chains 表
    
1.2 定义 Django Models / JPA Entities
    - RetirementRequest
    - ApprovalChain
    
1.3 编写 Model 层单元测试
```

### 层级 2: 服务层 (Day 1-2)

```
2.1 RetirementService
    - create_retirement_request()
    - approve_request()
    - reject_request()
    
2.2 AssetStateMachine
    - validate_transition()
    - execute_transition()
    
2.3 业务规则校验
    - 资产状态校验
    - 权限校验
```

### 层级 3: API 层 (Day 2)

```
3.1 Serializers / DTOs
    - RetirementRequestSerializer
    - ApprovalChainSerializer
    - RetirementProgressSerializer
    
3.2 ViewSets / Controllers
    - RetirementRequestViewSet / RetirementController
      - POST /retirements/ (创建)
      - GET /retirements/{id}/progress/ (进度)
      - POST /retirements/{id}/approve/ (批准)
      - POST /retirements/{id}/reject/ (驳回)
      
3.3 URL 路由配置
```

### 层级 4: 前端组件层 (Day 3)

```
4.1 页面组件
    - RetirementApplicationPage (申请表单)
    - RetirementProgressPage (进度跟踪)
    
4.2 共享组件
    - AssetSelector
    - StatusBadge
    - ApprovalTimeline
    
4.3 状态管理
    - retirementSlice (Redux Toolkit / Zustand)
```

### 层级 5: 集成与验收 (Day 3-4)

```
5.1 端到端测试
    - Playwright E2E 测试
    - 用户操作流程覆盖
    
5.2 API 集成测试
    - pytest 完整覆盖
    
5.3 手动验收检查
    - 实际资产状态流转验证
```

---

## 前端类型定义 (frontend/src/types/retirement.types.ts)

### 核心类型

```typescript
/**
 * 资产报废退役流程类型定义
 * @description 定义报废申请、审批链、状态流转相关的 TypeScript 类型
 * @module retirement.types
 */

/**
 * 报废原因枚举
 */
export enum RetirementReason {
  DAMAGED = 'DAMAGED',           // 设备损坏
  OBSOLETE = 'OBSOLETE',         // 技术淘汰
  MAINTENANCE_COST = 'MAINTENANCE_COST', // 维护成本过高
  UPGRADE = 'UPGRADE',           // 升级换代
  OTHER = 'OTHER'                // 其他原因
}

/**
 * 报废申请状态枚举
 */
export enum RetirementStatus {
  DRAFT = 'DRAFT',               // 草稿
  PENDING = 'PENDING',           // 待审批
  APPROVED = 'APPROVED',         // 已批准
  REJECTED = 'REJECTED'          // 已驳回
}

/**
 * 资产报废状态枚举
 */
export enum AssetRetirementStatus {
  IN_USE = 'IN_USE',                         // 使用中
  PENDING_RETIREMENT = 'PENDING_RETIREMENT', // 报废待审批
  RETIRED = 'RETIRED',                       // 已退役
  SCRAPPED = 'SCRAPPED'                     // 已报废
}

/**
 * 审批决策枚举
 */
export enum ApprovalDecision {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

/**
 * 报废申请基础信息
 */
export interface RetirementRequestBase {
  /** 资产ID */
  assetId: string;
  /** 报废原因 */
  reason: RetirementReason;
  /** 详细描述 */
  description?: string;
}

/**
 * 创建报废申请请求
 */
export interface CreateRetirementRequest extends RetirementRequestBase {
  // 继承 RetirementRequestBase 所有字段
}

/**
 * 报废申请响应
 */
export interface RetirementRequestResponse {
  /** 申请ID */
  id: string;
  /** 资产ID */
  assetId: string;
  /** 资产名称 */
  assetName: string;
  /** 申请人ID */
  applicantId: string;
  /** 申请人姓名 */
  applicantName: string;
  /** 报废原因 */
  reason: RetirementReason;
  /** 详细描述 */
  description?: string;
  /** 当前状态 */
  status: RetirementStatus;
  /** 当前审批人ID */
  currentApproverId?: string;
  /** 当前审批人姓名 */
  currentApproverName?: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 审批链节点
 */
export interface ApprovalChainNode {
  /** 审批人ID */
  approverId: string;
  /** 审批人姓名 */
  approverName: string;
  /** 审批顺序 */
  sequence: number;
  /** 审批决策 */
  decision: ApprovalDecision;
  /** 审批意见 */
  comment?: string;
  /** 审批时间 */
  decidedAt?: string;
}

/**
 * 审批进度响应
 */
export interface RetirementProgressResponse {
  /** 申请ID */
  requestId: string;
  /** 当前状态 */
  status: RetirementStatus;
  /** 资产状态 */
  assetStatus: AssetRetirementStatus;
  /** 审批链 */
  approvalChain: ApprovalChainNode[];
  /** 历史记录 */
  history: RetirementHistoryEntry[];
}

/**
 * 报废历史记录条目
 */
export interface RetirementHistoryEntry {
  /** 操作类型 */
  action: 'CREATE' | 'SUBMIT' | 'APPROVE' | 'REJECT';
  /** 操作人ID */
  operatorId: string;
  /** 操作人姓名 */
  operatorName: string;
  /** 操作时间 */
  operatedAt: string;
  /** 备注 */
  remark?: string;
}

/**
 * 批准报废请求
 */
export interface ApproveRetirementRequest {
  /** 审批意见 */
  comment?: string;
}

/**
 * 驳回报废请求
 */
export interface RejectRetirementRequest {
  /** 驳回原因 */
  reason: string;
}

/**
 * 报废申请列表查询参数
 */
export interface RetirementListQuery {
  /** 状态筛选 */
  status?: RetirementStatus;
  /** 资产ID */
  assetId?: string;
  /** 申请人ID */
  applicantId?: string;
  /** 开始日期 */
  startDate?: string;
  /** 结束日期 */
  endDate?: string;
  /** 页码 */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
}

/**
 * 报废申请列表响应
 */
export interface RetirementListResponse {
  /** 申请列表 */
  items: RetirementRequestResponse[];
  /** 总数 */
  total: number;
  /** 页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
}

/**
 * 报废原因选项（用于前端下拉框）
 */
export interface RetirementReasonOption {
  /** 原因值 */
  value: RetirementReason;
  /** 显示文本 */
  label: string;
}

/**
 * 报废原因映射表
 */
export const RETIREMENT_REASON_OPTIONS: RetirementReasonOption[] = [
  { value: RetirementReason.DAMAGED, label: '设备损坏' },
  { value: RetirementReason.OBSOLETE, label: '技术淘汰' },
  { value: RetirementReason.MAINTENANCE_COST, label: '维护成本过高' },
  { value: RetirementReason.UPGRADE, label: '升级换代' },
  { value: RetirementReason.OTHER, label: '其他原因' }
];

/**
 * 状态映射表
 */
export const RETIREMENT_STATUS_LABELS: Record<RetirementStatus, string> = {
  [RetirementStatus.DRAFT]: '草稿',
  [RetirementStatus.PENDING]: '待审批',
  [RetirementStatus.APPROVED]: '已批准',
  [RetirementStatus.REJECTED]: '已驳回'
};

/**
 * 资产状态映射表
 */
export const ASSET_RETIREMENT_STATUS_LABELS: Record<AssetRetirementStatus, string> = {
  [AssetRetirementStatus.IN_USE]: '使用中',
  [AssetRetirementStatus.PENDING_RETIREMENT]: '报废待审批',
  [AssetRetirementStatus.RETIRED]: '已退役',
  [AssetRetirementStatus.SCRAPPED]: '已报废'
};
```

---

## 附录

### API 规范摘要

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/v1/retirements/` | 创建报废申请 |
| GET | `/api/v1/retirements/` | 列表查询 |
| GET | `/api/v1/retirements/{id}/` | 详情 |
| GET | `/api/v1/retirements/{id}/progress/` | 审批进度 |
| POST | `/api/v1/retirements/{id}/approve/` | 批准 |
| POST | `/api/v1/retirements/{id}/reject/` | 驳回 |

### 状态机定义

```
Asset Status Transitions:
┌─────────┐     submit      ┌─────────────────────┐
│ IN_USE  │ ──────────────→│ PENDING_RETIREMENT  │
└─────────┘                └──────────┬──────────┘
      ↑                               │
      │         reject                │ approve
      └───────────────────────────────┘
      
RetirementRequest Status:
DRAFT → PENDING → APPROVED
                → REJECTED
```

### 相关文件清单

**后端 (Python/Django)**:
- `src/models/asset_retirement.py` - 资产报废模型
- `src/schemas/retirement_request.py` - 请求/响应模式
- `src/services/retirement_service.py` - 报废服务
- `src/services/approval_chain_service.py` - 审批链服务
- `src/api/routers/retirement_router.py` - 路由
- `tests/api/test_retirement_api.py` - API 测试

**后端 (Java/Spring)**:
- `backend/src/main/java/com/ams/entity/RetirementRequest.java`
- `backend/src/main/java/com/ams/entity/RetirementApplication.java`
- `backend/src/main/java/com/ams/service/RetirementService.java`
- `backend/src/main/java/com/ams/service/impl/RetirementServiceImpl.java`
- `backend/src/main/java/com/ams/controller/RetirementController.java`
- `tests/api/test_retirement_api.py`

**前端 (React/TypeScript)**:
- `frontend/src/types/retirement.types.ts` - 类型定义
- `frontend/src/composables/useApprovalPermission.ts` - 审批权限
- `frontend/src/stores/approvalStore.ts` - 审批状态管理
- `frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css` - 样式
- `frontend/src/app/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` - 筛选器样式
- `frontend/src/app/pages/OperationLogDashboard/components/TrendChart.tsx` - 趋势图组件
- `frontend/tests/e2e/retirement_flow.spec.ts` - E2E 测试

---

**文档版本历史**:
- v1.0 (2024-01-15): 初始版本，定义 Phase 2 实施规格