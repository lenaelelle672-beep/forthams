# SWARM-ASSET-RETIRE 资产报废退役流程规格指导文档

**文档版本**: 1.0.0  
**任务标识**: SWARM-ASSET-RETIRE  
**迭代周期**: Iteration 1  
**生效日期**: 2025-XX-XX

---

## 1. 需求与背景

### 1.1 业务场景描述

资产报废退役（Asset Retirement）是资产全生命周期管理的终态环节。当资产因物理损坏、技术淘汰、租赁到期、盘亏等原因需要退出生产环境时，必须通过规范化流程确保：

- **合规性保障**：资产状态变更符合企业内控要求
- **权责分离**：审批链与执行操作分离，避免单人操作风险
- **数据一致性**：财务账面与实物状态保持同步
- **可追溯性**：完整保留资产全生命周期的操作历史

### 1.2 现有系统能力

当前 SWARM 系统已具备以下基础设施：

| 模块 | 能力说明 |
|------|----------|
| 资产管理 | 资产基础信息 CRUD、状态模型（采购/在用/维护/报废四级） |
| 审批框架 | 通用审批链配置引擎、节点流转逻辑 |
| 审计日志 | 操作行为记录、变更追溯机制 |
| 状态机 | 通用状态机引擎，支持状态转换规则定义 |

### 1.3 需求缺口

| 缺口项 | 当前状态 | 期望状态 |
|--------|----------|----------|
| 报废申请提交 | 缺乏结构化界面 | 提供规范化表单与校验 |
| 差异化审批 | 通用审批链 | 根据资产价值/类型触发不同审批层级 |
| 退役状态转换 | 手动变更 | 审批通过后自动转换 |
| 退役资产视图 | 与在用资产混排 | 独立查询与统计入口 |
| 退役历史记录 | 分散存储 | 统一归档、不可篡改 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 分层规划

| Phase | 范围定义 | 状态 |
|-------|----------|------|
| **Phase 1（本次）** | 单条资产报废全链路：申请 → 审批 → 退役 → 记录 | 进行中 |
| Phase 2 | 批量退役、处置关联、统计增强 | 待规划 |
| Phase 3 | 财务系统对接、上下游事件推送 | 待规划 |

### 2.2 Phase 1 核心目标

本次迭代聚焦 **单条资产报废流程端到端打通**，具体目标如下：

#### 2.2.1 申请提交

- 用户可通过资产详情页发起报废申请
- 表单必填项：报废原因（枚举）、期望退役日期
- 表单选填项：申请人备注、附件（最多 5 个，单文件 ≤10MB）
- 系统校验：资产当前状态、是否存在进行中申请

#### 2.2.2 审批链流转

- **L1（资产价值 < 10,000）**：部门主管单级审批
- **L2（10,000 ≤ 资产价值 < 100,000）**：部门主管 → 资产管理员
- **L3（资产价值 ≥ 100,000）**：部门主管 → 资产管理员 → 财务总监
- 支持审批通过 / 驳回操作
- 驳回后资产状态恢复原值

#### 2.2.3 状态变更

- 审批完成后触发资产状态自动变更为 `RETIRED`
- 状态变更与历史记录写入在同一事务内完成
- 退役后资产不可逆向转回在用状态

#### 2.2.4 历史记录

- 完整记录：申请信息、审批节点、状态变更
- 写入后不可删除、不可修改
- 支持按资产 ID、时间范围查询

#### 2.2.5 退役资产视图

- 提供退役资产独立列表查询
- 支持按退役原因、退役时间范围筛选

### 2.3 非本次目标（明确范围外）

```
❌ 批量报废操作
❌ 物理处置记录（拆卸/转售/销毁）
❌ 财务系统凭证同步
❌ 报废前技术评估流程
❌ 退役资产恢复（逆向转回）
```

---

## 3. 边界约束

### 3.1 功能边界

| 约束编号 | 约束描述 | 违规处理 |
|----------|----------|----------|
| F-001 | 资产当前状态必须为 `IN_SERVICE` 或 `MAINTENANCE` 方可发起报废申请 | 返回错误码 `ASSET_NOT_IN_SERVICE` |
| F-002 | 同一资产在同一时刻只允许存在一条 `PENDING_APPROVAL` 状态的申请 | 返回错误码 `RETIRE_APPLICATION_EXISTS` |
| F-003 | 退役状态为终态，不可通过本流程逆向变更 | 返回错误码 `RETIRED_IS_TERMINAL_STATE` |
| F-004 | 审批节点超时（默认 72 小时）后触发配置的自动动作 | 发送通知告警 |
| F-005 | 驳回操作必须填写驳回原因（≥10 字符） | 返回校验错误 |

### 3.2 数据边界

| 约束编号 | 约束描述 |
|----------|----------|
| D-001 | 所有操作记录写入后不可删除、不可修改（物理删除禁止） |
| D-002 | 单次报废申请附件上限：5 个文件，单文件 ≤ 10MB |
| D-003 | 报废原因枚举：`PHYSICAL_DAMAGE`、`TECH_OBSOLETE`、`LEASE_EXPIRED`、`INVENTORY_LOSS`、`OTHER` |
| D-004 | 历史记录保留期限：永久（无到期清理策略） |

### 3.3 技术边界

| 约束编号 | 约束描述 |
|----------|----------|
| T-001 | 使用乐观锁机制防止并发提交（`version` 字段） |
| T-002 | 状态变更与历史记录写入必须在同一数据库事务内完成 |
| T-003 | 审批节点转换时通过消息队列异步发送通知（不阻塞主流程） |
| T-004 | API 响应时间：单条申请提交 ≤ 500ms，列表查询 ≤ 200ms |

### 3.4 前置条件

| 条件 | 说明 |
|------|------|
| 用户已登录 | JWT Token 有效 |
| 用户具有 `ASSET_RETIRE_APPLY` 权限 | 发起报废申请 |
| 用户具有 `ASSET_RETIRE_APPROVE` 权限 | 执行审批操作 |
| 目标资产存在且可访问 | 用户对资产所属部门有查看权限 |

---

## 4. 验收测试基准 (ATB)

### 4.1 测试环境要求

```yaml
测试环境:
  名称: swarms-test
  Python: "3.11+"
  Node.js: "20+"
  数据库: PostgreSQL 14+
  消息队列: Redis 7+

测试框架:
  后端: pytest 7.0+ / pytest-asyncio
  前端: Playwright 1.40+
  API: requests / httpx

覆盖率要求:
  后端: ≥ 80%
  前端: 核心流程 E2E 覆盖
```

### 4.2 ATB-001：报废申请提交

| 测试ID | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|----------|--------|
| TC-001-01 | 正常提交报废申请 | 资产A状态为 `IN_SERVICE`，用户有申请权限 | `POST /api/v1/assets/{id}/retire/` | 返回 201，body 包含 `retire_id`，状态为 `PENDING_APPROVAL` | P0 |
| TC-001-02 | 对采购状态资产提交申请 | 资产B状态为 `PURCHASED` | `POST /api/v1/assets/{id}/retire/` | 返回 400，错误码 `ASSET_NOT_IN_SERVICE` | P0 |
| TC-001-03 | 对已退役资产重复提交 | 资产C状态为 `RETIRED` | `POST /api/v1/assets/{id}/retire/` | 返回 400，错误码 `ASSET_ALREADY_RETIRED` | P0 |
| TC-001-04 | 提交时存在进行中申请 | 资产D已存在 `PENDING_APPROVAL` 申请 | `POST /api/v1/assets/{id}/retire/` | 返回 409，错误码 `RETIRE_APPLICATION_EXISTS` | P0 |
| TC-001-05 | 必填字段缺失 | 仅传入 `reason`，未传 `expected_retire_date` | `POST /api/v1/assets/{id}/retire/` | 返回 422，校验错误详情 | P1 |
| TC-001-06 | 报废原因枚举校验 | `reason` 传入非枚举值 | `POST /api/v1/assets/{id}/retire/` | 返回 400，错误码 `INVALID_REASON` | P1 |
| TC-001-07 | 附件数量超限 | 上传 6 个附件 | `POST /api/v1/assets/{id}/retire/` | 返回 400，错误码 `ATTACHMENT_LIMIT_EXCEEDED` | P2 |
| TC-001-08 | 前端申请表单提交 | 用户登录，进入资产详情页 | 点击"申请报废"按钮，填写表单，提交 | 页面跳转至申请详情，状态显示审批中 | P0 |

### 4.3 ATB-002：审批链流转

| 测试ID | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|----------|----------|
| TC-002-01 | L1审批通过 | 资产价值 < 10,000，申请处于 `PENDING_APPROVAL`，审批人为部门主管 | 审批人执行 `POST /api/v1/retire-applications/{id}/approve/` | 返回 200，状态变更为 `APPROVED`，发送通知事件 | P0 |
| TC-002-02 | L2二级审批通过 | 资产价值 ≥ 10,000，一级已通过，二级为资产管理员 | 二级审批人执行 approve | 返回 200，状态变更为 `APPROVED` | P0 |
| TC-002-03 | L3三级审批通过 | 资产价值 ≥ 100,000，前两级已通过 | 三级审批人执行 approve | 返回 200，状态变更为 `APPROVED` | P0 |
| TC-002-04 | 审批驳回 | 存在 `PENDING_APPROVAL` 申请，审批人填写驳回原因 | 审批人执行 `POST /api/v1/retire-applications/{id}/reject/` | 返回 200，状态变更为 `REJECTED`，申请人收到通知 | P0 |
| TC-002-05 | 驳回原因过短 | 驳回原因仅 5 个字符 | 审批人执行 reject | 返回 400，错误码 `REJECT_REASON_TOO_SHORT` | P1 |
| TC-002-06 | 非审批人权限校验 | 当前用户不在审批链中 | 尝试执行 approve/reject | 返回 403，错误码 `PERMISSION_DENIED` | P0 |
| TC-002-07 | 审批顺序校验 | 多级审批链，第二节点先于第一节点操作 | 二级审批人先执行 approve | 返回 400，错误码 `APPROVAL_SEQUENCE_INVALID` | P0 |
| TC-002-08 | 重复审批校验 | 申请已处于 `APPROVED` 状态 | 审批人再次执行 approve | 返回 400，错误码 `ALREADY_PROCESSED` | P1 |
| TC-002-09 | 前端审批操作 | 审批人登录，进入审批列表 | 点击"通过"按钮，确认操作 | 页面状态更新，显示已通过 | P0 |

### 4.4 ATB-003：状态变更与历史记录

| 测试ID | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|----------|----------|
| TC-003-01 | 审批通过后状态自动变更 | 申请已 APPROVED，关联资产状态为 `IN_SERVICE` | 审批完成触发状态变更 | 资产状态变更为 `RETIRED`，`retired_at` 时间戳记录 | P0 |
| TC-003-02 | 事务原子性验证 | 网络异常模拟（状态变更后、历史写入前中断） | 触发状态变更后强制抛异常 | 数据库回滚，资产状态保持不变，异常被捕获 | P0 |
| TC-003-03 | 历史记录完整性 | 存在完整审批流程的退役申请 | `GET /api/v1/assets/{id}/history/` | 返回包含 `retire_application`、`approvals`、`status_changes` 完整链 | P0 |
| TC-003-04 | 历史记录不可篡改 | 存在退役记录 | `PUT /api/v1/assets/{id}/history/{record_id}` 或 `DELETE` | 返回 405，方法不允许 | P0 |
| TC-003-05 | 驳回后状态恢复 | 申请驳回前资产状态为 `IN_SERVICE` | 审批人驳回申请 | 资产状态保持 `IN_SERVICE` 不变 | P1 |
| TC-003-06 | 并发提交乐观锁 | 同一资产同时发起两个申请 | 双线程并发 POST | 仅一个请求成功，另一个返回 409 | P0 |

### 4.5 ATB-004：退役资产查询

| 测试ID | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|----------|----------|
| TC-004-01 | 退役资产列表查询 | 数据库存在多条退役资产 | `GET /api/v1/assets/?status=retired` | 返回分页列表，包含资产基础信息与退役时间 | P0 |
| TC-004-02 | 退役资产详情查询 | 存在退役资产E | `GET /api/v1/assets/{id}/` | 返回资产详情，`retired_at`、`retire_reason` 字段存在 | P0 |
| TC-004-03 | 按退役原因筛选 | 存在不同原因退役的资产 | `GET /api/v1/assets/?status=retired&retire_reason=PHYSICAL_DAMAGE` | 仅返回物理损坏原因的退役资产 | P1 |
| TC-004-04 | 按时间范围筛选 | 存在多个时间退役的资产 | `GET /api/v1/assets/?status=retired&retired_from=2024-01-01&retired_to=2024-06-30` | 仅返回该时间范围内的退役资产 | P1 |
| TC-004-05 | 退役资产分页 | 退役资产数量 > 每页限制 | `GET /api/v1/assets/?status=retired&page=2&page_size=20` | 返回第二页数据，包含 `total_pages`、`has_next` | P0 |

### 4.6 ATB-005：错误码清单

| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| `ASSET_NOT_IN_SERVICE` | 400 | 资产状态不允许发起报废 |
| `ASSET_ALREADY_RETIRED` | 400 | 资产已退役，不可重复提交 |
| `RETIRE_APPLICATION_EXISTS` | 409 | 存在进行中的报废申请 |
| `RETIRED_IS_TERMINAL_STATE` | 400 | 退役状态不可逆向变更 |
| `INVALID_REASON` | 400 | 报废原因不在枚举范围内 |
| `APPROVAL_SEQUENCE_INVALID` | 400 | 审批顺序不符合审批链定义 |
| `ALREADY_PROCESSED` | 400 | 申请已处理完毕 |
| `REJECT_REASON_TOO_SHORT` | 400 | 驳回原因长度不足 |
| `ATTACHMENT_LIMIT_EXCEEDED` | 400 | 附件数量超过限制 |
| `PERMISSION_DENIED` | 403 | 用户无操作权限 |

### 4.7 测试执行命令

```bash
# 后端单元测试
pytest tests/services/test_retirement_service.py -v --tb=short

# 后端 API 测试
pytest tests/api/test_retirement_api.py -v --tb=short

# 状态机测试
pytest tests/state_machine/test_retirement_sm.py -v

# 前端 E2E 测试
npx playwright test tests/e2e/retirement_flow.spec.ts --project=chromium

# 覆盖率报告
pytest --cov=src --cov-report=html --cov-report=term-missing --cov-fail-under=80

# AST 静态检查（AC-003）
python -m py_compile src/services/retirement_service.py
python -m py_compile src/state_machine/retirement_state_machine.py

# Import 可用性检查（AC-005）
python -c "from src.services.retirement_service import RetirementService"
python -c "from src.api.routers.retirement_router import router"
```

---

## 5. 开发切入层级序列

### 5.1 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  [API Routers] [Views] [Serializers] [Forms] [E2E Tests]     │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                            │
│  [RetirementService] [ApprovalService] [NotificationService] │
├─────────────────────────────────────────────────────────────┤
│                    Domain Layer                              │
│  [StateMachine] [Entities] [ValueObjects] [DomainEvents]     │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                      │
│  [Repositories] [MessageQueue] [ExternalServices]            │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 交付物文件清单

| 层级 | 文件路径 | 变更类型 | 依赖前置 |
|------|----------|----------|----------|
| Domain | `src/state_machine/retirement_state_machine.py` | 已存在 | 无 |
| Domain | `src/models/asset_retirement.py` | 已存在 | 无 |
| Domain | `src/models/retirement_history.py` | 已存在 | 无 |
| Domain | `src/notifications/events.py` | 已存在 | 无 |
| Service | `src/services/retirement_service.py` | 已存在 | Domain 层 |
| Service | `src/services/approval_service.py` | 已存在 | Domain 层 |
| Service | `src/services/notification_service.py` | 已存在 | Domain 层 |
| Repository | `src/repositories/retirement_repository.py` | 已存在 | Domain 层 |
| API | `src/api/routers/retirement_router.py` | 已存在 | Service 层 |
| Schema | `src/schemas/retirement_request.py` | 已存在 | 无 |
| **Frontend** | **`frontend/src/app/utils/permissionHooks.ts`** | **修改** | **API 就绪** |
| **Frontend** | **`frontend/src/app/components/AssetDetailModal.tsx`** | **修改** | **API 就绪** |
| **Frontend** | **`frontend/src/app/hooks/useDepreciation.ts`** | **修改** | **业务逻辑** |
| **E2E** | **`tests/e2e/retirement_flow.spec.ts`** | **修改** | **全链路就绪** |
| **E2E** | **`tests/e2e/retirement_user_journey.spec.ts`** | **修改** | **全链路就绪** |

### 5.3 开发任务序列

#### 序列 1：权限钩子修改（`permissionHooks.ts`）

**优先级：P0**  
**依赖：API Router 已部署**

```typescript
// 需添加的权限检查函数
export function useRetirementPermission(): RetirementPermission {
  // 检查用户是否可发起报废申请
  // 检查用户是否可审批报废申请
  // 检查用户是否为当前审批节点处理人
}
```

#### 序列 2：资产详情弹窗增强（`AssetDetailModal.tsx`）

**优先级：P0**  
**依赖：permissionHooks 修改完成**

- 添加"申请报废"按钮（条件：资产状态为 `IN_SERVICE`/`MAINTENANCE`，无进行中申请）
- 按钮点击触发报废申请表单弹窗
- 申请提交后刷新资产状态显示

#### 序列 3：折旧计算钩子调整（`useDepreciation.ts`）

**优先级：P1**  
**依赖：退役状态已定义**

- 退役状态资产不参与折旧计算
- 退役日期作为折旧计算截止日期

#### 序列 4：E2E 测试修改（`retirement_flow.spec.ts`）

**优先级：P0**  
**依赖：前端 UI 完成**

```typescript
// 需覆盖的核心场景
test('用户可提交报废申请并完成审批流程', async ({ page }) => {
  // 1. 登录
  // 2. 进入资产详情页
  // 3. 点击"申请报废"
  // 4. 填写报废原因、期望日期
  // 5. 提交申请
  // 6. 审批人登录
  // 7. 进入审批列表
  // 8. 审批通过
  // 9. 验证资产状态变为"退役"
  // 10. 验证历史记录存在
});
```

#### 序列 5：用户旅程测试修改（`retirement_user_journey.spec.ts`）

**优先级：P1**  
**依赖：E2E Flow 测试通过**

- 覆盖完整用户旅程（申请 → 审批 → 驳回重提 → 通过）
- 边界场景覆盖

### 5.4 关键实现要点

#### 5.4.1 状态机配置

```python
# src/state_machine/retirement_state_machine.py
RETIREMENT_TRANSITIONS = {
    AssetState.IN_SERVICE: {
        RetirementEvent.REQUEST: AssetState.PENDING_RETIRE,
        RetirementEvent.MAINTAIN: AssetState.MAINTENANCE,
    },
    AssetState.MAINTENANCE: {
        RetirementEvent.REQUEST: AssetState.PENDING_RETIRE,
        RetirementEvent.RESUME: AssetState.IN_SERVICE,
    },
    AssetState.PENDING_RETIRE: {
        RetirementEvent.APPROVE: AssetState.RETIRED,
        RetirementEvent.REJECT: AssetState.IN_SERVICE,  # 驳回恢复原状态
    },
    # 退役为终态，无转出
}
```

#### 5.4.2 事务边界控制

```python
# src/services/retirement_service.py
@Transactional(isolation=Isolation.SERIALIZABLE)
def approve_and_retire(self, application_id: str, approver_id: str) -> RetirementResult:
    """
    审批通过并触发退役状态变更
    事务边界：申请状态更新 + 资产状态变更 + 历史记录写入
    """
    # Step 1: 更新申请状态为 APPROVED
    # Step 2: 变更资产状态为 RETIRED
    # Step 3: 写入 RetirementHistory 记录
    # Step 4: 发布 RetirementCompletedEvent
    # 以上均在同一事务内，任何失败均回滚
```

#### 5.4.3 乐观锁防并发

```python
# src/models/asset_retirement.py
class RetirementApplication(BaseModel):
    id: str
    asset_id: str
    status: RetirementStatus
    version: int  # 乐观锁版本号
    
    def approve(self, expected_version: int) -> None:
        if self.version != expected_version:
            raise OptimisticLockError("Retirement application has been modified")
        self.status = RetirementStatus.APPROVED
        self.version += 1
```

#### 5.4.4 前端权限钩子

```typescript
// frontend/src/app/utils/permissionHooks.ts
export interface RetirementPermission {
  canApply: boolean;
  canApprove: boolean;
  isCurrentApprover: boolean;
}

export function useRetirementPermission(
  assetId: string,
  applicationId?: string
): RetirementPermission {
  // 实现权限校验逻辑
  // 依赖后端 /api/v1/permissions/check 接口
}
```

---

## 6. API 端点规格

| 方法 | 端点 | 描述 | 权限要求 |
|------|------|------|----------|
| `POST` | `/api/v1/assets/{asset_id}/retire/` | 提交报废申请 | `ASSET_RETIRE_APPLY` |
| `GET` | `/api/v1/assets/{asset_id}/retire/` | 查询报废申请详情 | `ASSET_VIEW` |
| `POST` | `/api/v1/retire-applications/{id}/approve/` | 审批通过 | `ASSET_RETIRE_APPROVE` |
| `POST` | `/api/v1/retire-applications/{id}/reject/` | 审批驳回 | `ASSET_RETIRE_APPROVE` |
| `GET` | `/api/v1/assets/?status=retired` | 退役资产列表 | `ASSET_VIEW` |
| `GET` | `/api/v1/assets/{id}/history/` | 资产操作历史 | `ASSET_VIEW` |
| `GET` | `/api/v1/permissions/check` | 权限校验 | 已登录 |

---

## 7. 数据模型

### 7.1 RetirementApplication

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `asset_id` | UUID | 关联资产 ID |
| `reason` | Enum | 报废原因 |
| `expected_retire_date` | Date | 期望退役日期 |
| `applicant_id` | UUID | 申请人 ID |
| `status` | Enum | 申请状态 |
| `approval_chain_id` | UUID | 审批链 ID |
| `attachments` | JSON | 附件列表 |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |
| `version` | Integer | 乐观锁版本 |

### 7.2 RetirementHistory

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `application_id` | UUID | 关联申请 ID |
| `asset_id` | UUID | 关联资产 ID |
| `event_type` | Enum | 事件类型 |
| `operator_id` | UUID | 操作人 ID |
| `details` | JSON | 事件详情 |
| `created_at` | DateTime | 创建时间（不可修改） |

### 7.3 枚举定义

```python
class RetirementStatus(str, Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"

class RetirementReason(str, Enum):
    PHYSICAL_DAMAGE = "PHYSICAL_DAMAGE"
    TECH_OBSOLETE = "TECH_OBSOLETE"
    LEASE_EXPIRED = "LEASE_EXPIRED"
    INVENTORY_LOSS = "INVENTORY_LOSS"
    OTHER = "OTHER"

class HistoryEventType(str, Enum):
    APPLICATION_CREATED = "APPLICATION_CREATED"
    APPROVAL_NODE_PASSED = "APPROVAL_NODE_PASSED"
    APPROVAL_COMPLETED = "APPROVAL_COMPLETED"
    ASSET_RETIRED = "ASSET_RETIRED"
    APPLICATION_REJECTED = "APPLICATION_REJECTED"
```

---

## 8. 附录

### 8.1 审批链配置规则

| 资产价值范围 | 审批层级 | 节点定义 |
|--------------|----------|----------|
| `< 10,000` | L1 | 部门主管 |
| `10,000 ~ 100,000` | L2 | 部门主管 → 资产管理员 |
| `≥ 100,000` | L3 | 部门主管 → 资产管理员 → 财务总监 |

### 8.2 消息队列事件

| 事件 | Topic | Payload | 消费者 |
|------|-------|---------|--------|
| `RetirementRequestedEvent` | `retirement.requests` | `{application_id, asset_id, applicant_id}` | 通知服务 |
| `ApprovalCompletedEvent` | `retirement.approvals` | `{application_id, approver_id, result}` | 通知服务、状态机 |
| `AssetRetiredEvent` | `retirement.status` | `{asset_id, retired_at, history_id}` | 折旧服务（停止计算） |

### 8.3 修改文件清单汇总

| 序号 | 文件路径 | 修改说明 |
|------|----------|----------|
| 1 | `frontend/src/app/utils/permissionHooks.ts` | 添加 `useRetirementPermission` 钩子 |
| 2 | `frontend/src/app/components/AssetDetailModal.tsx` | 添加报废申请入口按钮 |
| 3 | `frontend/src/app/hooks/useDepreciation.ts` | 退役资产不参与折旧计算 |
| 4 | `tests/e2e/retirement_flow.spec.ts` | 端到端流程测试 |
| 5 | `tests/e2e/retirement_user_journey.spec.ts` | 用户旅程测试 |

---

**文档结束**
