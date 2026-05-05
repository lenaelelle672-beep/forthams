# SWARM-002 资产报废/退役流程 Specifications

## 需求与背景

### 业务目标
建立标准化的资产报废/退役流程，实现以下核心能力：
- 支持用户发起资产报废请求
- 定义明确的状态流转规则
- 建立多级审批链路
- 完整记录变更历史
- 提供审批进度实时追踪能力

### 现状分析
- Graphify 知识图谱无匹配节点，需从零构建数据模型与流程引擎
- 无现有报废审批流程定义
- 缺乏状态历史追踪机制

### 技术驱动因素
- 资产全生命周期管理闭环需求
- 合规审计追踪要求
- 审批效率可视化需求

---

## 当前 Phase 对应实施目标

### 参照 plan.md Phase 拆解
- **对准 Phase**: Phase 1 - 基础流程框架构建
- **Scope**: 仅涵盖标准报废流程（单一资产、线性审批链）

### 本次迭代交付物
| 交付项 | 描述 | 优先级 |
|--------|------|--------|
| `AssetRetirementRequest` 数据模型 | 报废请求核心实体 | P0 |
| 状态机 `StatusStateMachine` | 6状态流转引擎 | P0 |
| 审批链 `ApprovalChain` | 线性三级审批链路 | P0 |
| 历史记录 `RetirementHistory` | 不可变审计日志 | P0 |
| 进度追踪 API | GET /retirements/{id}/progress | P0 |
| 状态流转 API | POST /retirements/{id}/transition | P1 |

### 不在本次 Scope
- 批量资产报废
- 并行审批节点
- 自动化工单触发
- 第三方系统集成

---

## 边界约束

### 硬性约束（Hard Constraints）

| 约束ID | 描述 | 验证规则 |
|--------|------|----------|
| HC-001 | 报废请求提交后不可直接进入 `DISPOSED` 状态 | 状态机强制校验 |
| HC-002 | 审批链配置后不可修改已激活的链路 | 版本号校验 |
| HC-003 | 历史记录仅支持 Append，不允许 Delete/Update | 写权限控制 |
| HC-004 | 单次审批操作原子性保证 | 数据库事务约束 |
| HC-005 | 资产状态为 `RETIRED` 后不可逆向操作 | 不可逆状态锁定 |

### 软性约束（Soft Constraints）

| 约束ID | 描述 | 建议 |
|--------|------|------|
| SC-001 | 审批超时自动提醒（72h） | 消息队列定时任务 |
| SC-002 | 单次请求最多关联资产数量 ≤ 10 | 前端表单校验 |

### 领域边界

```
输入边界：
  - UserRole: [ADMIN, ASSET_MANAGER, REQUESTER]
  - AssetStatus: [ACTIVE, MAINTENANCE, RETIRED]
  - AssetValue: [LOW(<10000), MEDIUM(10000-50000), HIGH(>50000)]

处理边界：
  - 状态机实例数：无限制
  - 并发审批处理：支持
  - 单请求历史记录条数：无上限

输出边界：
  - API Response: JSON
  - 进度状态: [PENDING_APPROVAL_L1, PENDING_APPROVAL_L2, PENDING_APPROVAL_L3, APPROVED, REJECTED]
```

---

## 验收测试基准 (ATB)

### ATB-001: 报废请求创建

| 测试ID | 测试步骤 | 物理期待 | 测试类型 |
|--------|----------|----------|----------|
| ATB-001-01 | 用户提交报废请求（资产ID + 理由） | `POST /retirements` 返回 201，状态为 `DRAFT` | pytest |
| ATB-001-02 | 提交后检查状态机初始状态 | `GET /retirements/{id}` 返回 `current_status: DRAFT` | pytest |
| ATB-001-03 | 非法资产ID提交请求 | 返回 400，错误码 `INVALID_ASSET_ID` | pytest |
| ATB-001-04 | 已退役资产重复提交 | 返回 409，错误码 `ASSET_ALREADY_RETIRED` | pytest |

### ATB-002: 状态流转引擎

| 测试ID | 测试步骤 | 物理期待 | 测试类型 |
|--------|----------|----------|----------|
| ATB-002-01 | DRAFT → SUBMITTED 流转 | `transition(action="SUBMIT")` 返回 `current_status: SUBMITTED` | pytest |
| ATB-002-02 | SUBMITTED → PENDING_L1 流转 | 触发审批链，状态变为 `PENDING_APPROVAL_L1` | pytest |
| ATB-002-03 | 非法流转尝试（如 DRAFT → APPROVED） | 返回 422，错误码 `INVALID_TRANSITION` | pytest |
| ATB-002-04 | 已锁定状态 `RETIRED` 流转 | 返回 422，错误码 `STATE_LOCKED` | pytest |
| ATB-002-05 | 并发流转操作 | 事务冲突检测，仅一条成功 | pytest (concurrent) |

### ATB-003: 审批链执行

| 测试ID | 测试步骤 | 物理期待 | 测试类型 |
|--------|----------|----------|----------|
| ATB-003-01 | L1 审批通过 | `POST /retirements/{id}/approve` L1 → L2 pending | pytest |
| ATB-003-02 | L1 审批拒绝 | 状态变为 `REJECTED`，通知REQUESTER | pytest |
| ATB-003-03 | L2 审批通过 | L2 → L3 pending | pytest |
| ATB-003-04 | L3 最终审批通过 | 状态变为 `APPROVED`，可进入 DISPOSED | pytest |
| ATB-003-05 | 跨级审批尝试（如 L1 审批 L3 节点） | 返回 403，错误码 `UNAUTHORIZED_APPROVER` | pytest |
| ATB-003-06 | 重复审批同一节点 | 返回 409，错误码 `ALREADY_APPROVED` | pytest |
| ATB-003-07 | 资产高价值（>50000）触发增强审批 | `GET /retirements/{id}` 显示 `approval_tier: HIGH` | pytest |

### ATB-004: 历史记录

| 测试ID | 测试步骤 | 物理期待 | 测试类型 |
|--------|----------|----------|----------|
| ATB-004-01 | 状态变更记录 | `GET /retirements/{id}/history` 包含状态变更条目 | pytest |
| ATB-004-02 | 审批操作记录 | 历史记录包含审批人、时间、结果 | pytest |
| ATB-004-03 | 历史记录不可修改 | `PUT /retirements/{id}/history` 返回 405 | pytest |
| ATB-004-04 | 历史记录防删除 | `DELETE /retirements/{id}/history` 返回 405 | pytest |
| ATB-004-05 | 完整变更链追溯 | 从创建到退役所有操作均可查 | pytest |

### ATB-005: 进度追踪

| 测试ID | 测试步骤 | 物理期待 | 测试类型 |
|--------|----------|----------|----------|
| ATB-005-01 | 查询当前进度 | `GET /retirements/{id}/progress` 返回当前审批节点 | playwright |
| ATB-005-02 | 进度可视化数据结构 | 返回包含 `current_step`, `total_steps`, `pending_approvers` | pytest |
| ATB-005-03 | 已完成请求进度 | `progress_status: COMPLETED`，所有步骤标记完成 | playwright |
| ATB-005-04 | 被拒绝请求进度 | `progress_status: REJECTED`，显示拒绝原因 | playwright |

### ATB-006: 边界条件

| 测试ID | 测试步骤 | 物理期待 | 测试类型 |
|--------|----------|----------|----------|
| ATB-006-01 | 超长理由文本提交 | 截断至 500 字符或返回 400 | pytest |
| ATB-006-02 | 并发审批冲突 | 第二个审批返回 409 | pytest (concurrent) |
| ATB-006-03 | 审批人同时为申请人 | 返回 403，错误码 `SELF_APPROVAL_FORBIDDEN` | pytest |

---

## 开发切入层级序列

### Level 1: 数据模型层（Day 1-2）

```
src/
├── models/
│   ├── asset_retirement.py      # AssetRetirementRequest 实体
│   ├── approval_chain.py        # ApprovalChain, ApprovalStep 实体
│   ├── retirement_history.py    # RetirementHistory 实体
│   └── enums.py                 # RetirementStatus, ApprovalAction 枚举
│
└── schemas/
    ├── retirement_request.py    # Pydantic 请求/响应 schemas
    └── approval.py              # 审批相关 schemas
```

**验收标准**: 所有模型可通过 `Model.metadata.create_all()` 正确创建

### Level 2: 状态机引擎层（Day 3-5）

```
src/
├── state_machine/
│   ├── retirement_state_machine.py  # 状态机核心实现
│   ├── transitions.py               # 流转规则定义
│   └── guards.py                    # 流转条件守卫
│
└── services/
    └── retirement_service.py        # 状态流转业务逻辑
```

**验收标准**: 
```bash
pytest tests/state_machine/test_retirement_sm.py -v
# 全部通过
```

### Level 3: 审批链服务层（Day 6-8）

```
src/
├── services/
│   ├── approval_chain_service.py    # 审批链执行引擎
│   ├── notification_service.py       # 审批通知（预留接口）
│   └── asset_service.py             # 资产状态更新
│
└── repositories/
    └── retirement_repository.py      # 报废请求持久化
```

**验收标准**:
```bash
pytest tests/services/test_approval_chain.py -v
pytest tests/services/test_retirement_service.py -v
# 全部通过
```

### Level 4: API 接口层（Day 9-11）

```
src/
├── api/
│   ├── routers/
│   │   └── retirement_router.py      # 报废流程 API 路由
│   ├── deps/
│   │   └── auth.py                   # 权限依赖注入
│   └── middleware/
│       └── audit_logger.py          # 操作日志中间件
│
└── main.py                          # FastAPI 应用入口
```

**验收标准**:
```bash
pytest tests/api/test_retirement_api.py -v
playwright test tests/e2e/retirement_flow.spec.ts
# 全部通过
```

### Level 5: 前端集成层（Day 12-14）

```
frontend/
├── pages/
│   └── retirement/
│       ├── index.tsx                # 报废申请列表页
│       ├── new.tsx                  # 新建报废申请页
│       └── [id].tsx                 # 申请详情页（含进度追踪）
│
└── components/
    ├── StatusBadge.tsx
    ├── ProgressTracker.tsx          # 审批进度组件
    └── ApprovalChain.tsx            # 审批链可视化
```

**验收标准**:
```bash
playwright test tests/e2e/retirement_user_journey.spec.ts
# 完整用户旅程测试通过
```

### Level 6: 集成测试与验收（Day 15）

```bash
# 全量回归测试
pytest tests/ -v --tb=short

# E2E 验收测试
playwright test tests/e2e/ -g "retirement"

# ATB 覆盖率报告
pytest tests/ --atb-report=atb_coverage.json
```

---

## 附录：核心状态流转图

```
DRAFT → SUBMITTED → PENDING_L1 → PENDING_L2 → PENDING_L3 → APPROVED → DISPOSED
                         ↓              ↓              ↓
                      REJECTED      REJECTED       REJECTED
```

**流转条件**:
- `SUBMIT`: REQUESTER 提交申请
- `APPROVE_L1`: ASSET_MANAGER_L1 审批通过
- `APPROVE_L2`: ASSET_MANAGER_L2 审批通过
- `APPROVE_L3`: ADMIN 最终审批通过
- `DISPOSE`: 执行实际退役操作（资产状态更新为 RETIRED）
- `REJECT`: 任意审批节点拒绝，整个流程终止

---

## 附录：Frontend 类型定义（frontend/src/types/approval.ts）

```typescript
/**
 * 资产报废/退役流程类型定义
 * @module approval
 * @version SWARM-002
 * @since Iteration-1
 */

/**
 * 报废请求状态枚举
 * @description 定义资产报废流程的完整生命周期状态
 */
export enum RetirementStatus {
  /** 草稿状态 - 用户创建请求但未提交 */
  DRAFT = 'DRAFT',
  /** 已提交 - 请求已提交，等待 L1 审批 */
  SUBMITTED = 'SUBMITTED',
  /** 等待 L1 审批 */
  PENDING_APPROVAL_L1 = 'PENDING_APPROVAL_L1',
  /** 等待 L2 审批 */
  PENDING_APPROVAL_L2 = 'PENDING_APPROVAL_L2',
  /** 等待 L3 审批 */
  PENDING_APPROVAL_L3 = 'PENDING_APPROVAL_L3',
  /** 已批准 - 所有审批通过，等待执行退役 */
  APPROVED = 'APPROVED',
  /** 已拒绝 - 审批流程被拒绝 */
  REJECTED = 'REJECTED',
  /** 已退役 - 资产已正式退役 */
  DISPOSED = 'DISPOSED',
}

/**
 * 审批操作动作枚举
 */
export enum ApprovalAction {
  /** 提交申请 */
  SUBMIT = 'SUBMIT',
  /** L1 审批通过 */
  APPROVE_L1 = 'APPROVE_L1',
  /** L1 拒绝 */
  REJECT_L1 = 'REJECT_L1',
  /** L2 审批通过 */
  APPROVE_L2 = 'APPROVE_L2',
  /** L2 拒绝 */
  REJECT_L2 = 'REJECT_L2',
  /** L3 最终审批通过 */
  APPROVE_L3 = 'APPROVE_L3',
  /** L3 拒绝 */
  REJECT_L3 = 'REJECT_L3',
  /** 执行退役操作 */
  DISPOSE = 'DISPOSE',
}

/**
 * 审批层级枚举
 */
export enum ApprovalLevel {
  /** L1 审批 - 资产经理审批 */
  L1 = 'L1',
  /** L2 审批 - 部门主管审批 */
  L2 = 'L2',
  /** L3 审批 - 管理员最终审批 */
  L3 = 'L3',
}

/**
 * 审批层级配置
 * @description 根据资产价值确定审批层级
 */
export enum ApprovalTier {
  /** 低价值资产（<10000）- 仅 L1 审批 */
  LOW = 'LOW',
  /** 中价值资产（10000-50000）- L1 + L2 审批 */
  MEDIUM = 'MEDIUM',
  /** 高价值资产（>50000）- 完整三级审批 */
  HIGH = 'HIGH',
}

/**
 * 报废请求创建参数
 */
export interface RetirementRequestCreate {
  /** 资产ID */
  assetId: string;
  /** 报废理由 */
  reason: string;
  /** 预期退役日期 */
  expectedDisposalDate?: string;
  /** 预估残值 */
  estimatedResidualValue?: number;
  /** 附件列表 */
  attachments?: string[];
}

/**
 * 报废请求响应
 */
export interface RetirementRequestResponse {
  /** 报废请求ID */
  id: string;
  /** 资产ID */
  assetId: string;
  /** 资产名称 */
  assetName: string;
  /** 当前状态 */
  status: RetirementStatus;
  /** 审批层级 */
  approvalTier: ApprovalTier;
  /** 报废理由 */
  reason: string;
  /** 申请人ID */
  requesterId: string;
  /** 申请人名称 */
  requesterName: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 预期退役日期 */
  expectedDisposalDate?: string;
  /** 预估残值 */
  estimatedResidualValue?: number;
  /** 当前审批节点 */
  currentApprovalStep?: ApprovalStepInfo;
  /** 审批进度百分比 */
  progressPercentage: number;
}

/**
 * 审批步骤信息
 */
export interface ApprovalStepInfo {
  /** 步骤序号 */
  stepNumber: number;
  /** 审批层级 */
  level: ApprovalLevel;
  /** 审批人ID */
  approverId?: string;
  /** 审批人名称 */
  approverName?: string;
  /** 状态 */
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
  /** 完成时间 */
  completedAt?: string;
  /** 审批意见 */
  comment?: string;
}

/**
 * 审批链信息
 */
export interface ApprovalChainInfo {
  /** 审批链ID */
  id: string;
  /** 审批链名称 */
  name: string;
  /** 审批层级 */
  tier: ApprovalTier;
  /** 审批步骤列表 */
  steps: ApprovalStepInfo[];
  /** 创建时间 */
  createdAt: string;
}

/**
 * 报废历史记录条目
 */
export interface RetirementHistoryEntry {
  /** 历史记录ID */
  id: string;
  /** 报废请求ID */
  retirementId: string;
  /** 操作类型 */
  action: ApprovalAction | 'CREATE' | 'UPDATE';
  /** 操作人ID */
  operatorId: string;
  /** 操作人名称 */
  operatorName: string;
  /** 操作时间 */
  operatedAt: string;
  /** 操作前状态 */
  previousStatus?: RetirementStatus;
  /** 操作后状态 */
  newStatus?: RetirementStatus;
  /** 审批层级（如适用） */
  approvalLevel?: ApprovalLevel;
  /** 审批意见 */
  comment?: string;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 进度追踪响应
 */
export interface RetirementProgressResponse {
  /** 报废请求ID */
  retirementId: string;
  /** 当前状态 */
  currentStatus: RetirementStatus;
  /** 当前步骤序号 */
  currentStep: number;
  /** 总步骤数 */
  totalSteps: number;
  /** 进度百分比 */
  progressPercentage: number;
  /** 进度状态描述 */
  progressStatus: 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  /** 待审批人列表 */
  pendingApprovers: Array<{
    level: ApprovalLevel;
    roleName: string;
  }>;
  /** 当前审批节点信息 */
  currentApprovalNode?: ApprovalStepInfo;
  /** 下一步操作提示 */
  nextActionHint?: string;
  /** 预计完成时间（如有） */
  estimatedCompletionTime?: string;
}

/**
 * 状态流转请求参数
 */
export interface RetirementTransitionRequest {
  /** 操作动作 */
  action: ApprovalAction;
  /** 审批意见/备注 */
  comment?: string;
  /** 附件列表（如有） */
  attachments?: string[];
}

/**
 * 状态流转响应
 */
export interface RetirementTransitionResponse {
  /** 是否成功 */
  success: boolean;
  /** 新的状态 */
  newStatus: RetirementStatus;
  /** 消息 */
  message: string;
  /** 更新后的报废请求信息 */
  retirement: RetirementRequestResponse;
  /** 触发的事件列表 */
  events?: Array<{
    type: string;
    payload: unknown;
  }>;
}

/**
 * 报废请求列表查询参数
 */
export interface RetirementListQuery {
  /** 状态筛选 */
  status?: RetirementStatus[];
  /** 申请人ID */
  requesterId?: string;
  /** 资产ID */
  assetId?: string;
  /** 创建时间范围 - 开始 */
  createdAtFrom?: string;
  /** 创建时间范围 - 结束 */
  createdAtTo?: string;
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/**
 * 报废请求列表响应
 */
export interface RetirementListResponse {
  /** 总数 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 数据列表 */
  items: RetirementRequestResponse[];
}

/**
 * 错误响应格式
 */
export interface RetirementErrorResponse {
  /** 错误码 */
  errorCode: string;
  /** 错误消息 */
  message: string;
  /** 详细错误信息 */
  details?: string;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 审批动作权限映射
 * @description 定义各角色可执行的审批动作
 */
export const APPROVAL_ACTION_PERMISSIONS: Record<string, ApprovalLevel[]> = {
  REQUESTER: [ApprovalAction.SUBMIT],
  ASSET_MANAGER_L1: [ApprovalAction.APPROVE_L1, ApprovalAction.REJECT_L1],
  ASSET_MANAGER_L2: [ApprovalAction.APPROVE_L2, ApprovalAction.REJECT_L2],
  ADMIN: [ApprovalAction.APPROVE_L3, ApprovalAction.REJECT_L3, ApprovalAction.DISPOSE],
};

/**
 * 状态流转规则定义
 * @description 定义有效的状态流转路径
 */
export const RETIREMENT_STATUS_TRANSITIONS: Record<RetirementStatus, RetirementStatus[]> = {
  [RetirementStatus.DRAFT]: [RetirementStatus.SUBMITTED],
  [RetirementStatus.SUBMITTED]: [RetirementStatus.PENDING_APPROVAL_L1],
  [RetirementStatus.PENDING_APPROVAL_L1]: [RetirementStatus.PENDING_APPROVAL_L2, RetirementStatus.REJECTED],
  [RetirementStatus.PENDING_APPROVAL_L2]: [RetirementStatus.PENDING_APPROVAL_L3, RetirementStatus.REJECTED],
  [RetirementStatus.PENDING_APPROVAL_L3]: [RetirementStatus.APPROVED, RetirementStatus.REJECTED],
  [RetirementStatus.APPROVED]: [RetirementStatus.DISPOSED],
  [RetirementStatus.REJECTED]: [],
  [RetirementStatus.DISPOSED]: [],
};

/**
 * 审批层级阈值配置
 */
export const APPROVAL_TIER_THRESHOLDS = {
  LOW_MAX_VALUE: 10000,
  MEDIUM_MAX_VALUE: 50000,
};

/**
 * 根据资产价值确定审批层级
 * @param assetValue - 资产价值
 * @returns 对应的审批层级
 */
export function determineApprovalTier(assetValue: number): ApprovalTier {
  if (assetValue < APPROVAL_TIER_THRESHOLDS.LOW_MAX_VALUE) {
    return ApprovalTier.LOW;
  } else if (assetValue < APPROVAL_TIER_THRESHOLDS.MEDIUM_MAX_VALUE) {
    return ApprovalTier.MEDIUM;
  }
  return ApprovalTier.HIGH;
}

/**
 * 获取指定审批层级所需的步骤数
 * @param tier - 审批层级
 * @returns 所需审批步骤数
 */
export function getApprovalStepCount(tier: ApprovalTier): number {
  switch (tier) {
    case ApprovalTier.LOW:
      return 1;
    case ApprovalTier.MEDIUM:
      return 2;
    case ApprovalTier.HIGH:
      return 3;
  }
}

/**
 * 验证状态流转是否合法
 * @param currentStatus - 当前状态
 * @param targetStatus - 目标状态
 * @returns 是否允许流转
 */
export function isValidTransition(currentStatus: RetirementStatus, targetStatus: RetirementStatus): boolean {
  const allowedTransitions = RETIREMENT_STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions?.includes(targetStatus) ?? false;
}