# SWARM-ASSET-RETIRE 资产报废退役流程规格指导文档

**版本**: 1.0.0  
**任务ID**: SWARM-ASSET-RETIRE  
**迭代周期**: Iteration 1  
**生效日期**: 2025-01-20

---

## 1. 需求与背景

### 1.1 业务场景描述

资产报废退役（Asset Retirement）是资产全生命周期管理的终态环节。当资产因物理损坏、技术淘汰、租赁到期、盘亏等原因需要退出生产环境时，必须通过规范化流程确保：

| 维度 | 约束要求 |
|------|----------|
| 合规性 | 资产状态变更符合企业内控要求 |
| 可追溯性 | 完整的操作链路与审批记录 |
| 财务一致性 | 账面价值与实物状态同步 |
| 权责分离 | 申请人与审批人角色隔离 |

### 1.2 现有系统能力

当前 SWARM 系统已具备以下基础设施：

| 层级 | 组件 | 状态 |
|------|------|------|
| Entity | `RetirementApplication`, `RetirementHistory`, `RetirementRequest` | ✅ 就绪 |
| Schema | `retirement_request.py` | ✅ 就绪 |
| Service | `RetirementService`, `ApprovalChainService`, `NotificationService` | ✅ 就绪 |
| Router | `retirement_router.py` | ✅ 就绪 |
| State Machine | `retirement_state_machine.py` | ✅ 就绪 |
| Frontend Routes | `/asset/retire`, `/retirement/*` | ✅ 就绪 |

### 1.3 缺失能力

| 序号 | 缺失项 | 影响范围 |
|------|--------|----------|
| 1 | 前端报废申请表单与提交流程 | 用户无法发起报废 |
| 2 | 前端审批流程UI | 审批人无法处理申请 |
| 3 | 前端资产退役状态展示 | 退役资产无独立视图 |
| 4 | 端到端用户旅程测试 | 流程质量无保障 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 定位

| Phase | 范围边界 | 状态 | 关键交付物 |
|-------|----------|------|------------|
| **Phase 1（本次）** | 核心报废流程单链路打通 | 进行中 | 申请→审批→退役→历史记录 |
| Phase 2 | 批量报废、报废评估、处置关联 | 待规划 | - |
| Phase 3 | 财务系统对接、上下游事件推送 | 待规划 | - |

### 2.2 Phase 1 实施范围

#### 2.2.1 功能范围

| 功能模块 | 子功能 | 描述 |
|----------|--------|------|
| 报废申请 | 申请提交 | 用户选择资产，填写报废原因、期望退役日期，提交申请 |
| 报废申请 | 申请查询 | 用户查看自己提交的报废申请列表与详情 |
| 审批流转 | 审批处理 | 审批人查看待审批列表，对申请进行通过/驳回操作 |
| 审批流转 | 审批链路由 | 根据资产价值触发差异化审批链（L1/L2/L3） |
| 状态变更 | 自动退役 | 审批通过后资产状态自动由"在用"变更为"退役" |
| 历史记录 | 完整链路 | 生成包含申请信息、审批意见、状态变更的不可篡改记录 |
| 前端展示 | 退役资产视图 | 提供退役资产的独立列表与筛选能力 |

#### 2.2.2 非本次目标（边界外）

- ❌ 批量报废操作
- ❌ 报废资产的物理处置记录（拆卸、转售、销毁）
- ❌ 与财务系统的凭证同步
- ❌ 报废前的技术评估流程
- ❌ 退役状态逆向转回（恢复）在本次迭代范围外

### 2.3 本次修改文件清单

| 序号 | 文件路径 | 修改类型 | 核心变更 |
|------|----------|----------|----------|
| 1 | `tests/e2e/retirement_user_journey.spec.ts` | 修改 | 用户旅程端到端测试 |
| 2 | `tests/e2e/retirement_flow.spec.ts` | 修改 | 核心流程场景测试 |
| 3 | `frontend/src/app/utils/permissionHooks.ts` | 修改 | 报废相关权限钩子 |
| 4 | `frontend/src/app/components/AssetDetailModal.tsx` | 修改 | 资产详情退役操作入口 |
| 5 | `frontend/src/app/hooks/useDepreciation.ts` | 修改 | 退役时折旧计算联动 |

---

## 3. 边界约束

### 3.1 功能边界约束

| 约束项 | 约束规则 | 违规处理 |
|--------|----------|----------|
| 申请前置条件 | 资产当前状态必须为 `IN_SERVICE` 或 `MAINTENANCE` | 返回 `ASSET_NOT_IN_SERVICE` |
| 互斥约束 | 同一资产同一时刻只允许一条 `PENDING_APPROVAL` 状态的申请 | 返回 `RETIRE_APPLICATION_EXISTS` |
| 状态互斥 | 已退役 (`RETIRED`) 资产不可重复发起 | 返回 `ASSET_ALREADY_RETIRED` |
| 审批顺序 | 多级审批必须按节点顺序执行 | 返回 `APPROVAL_SEQUENCE_INVALID` |
| 权限校验 | 当前用户必须在审批链节点中 | 返回 `PERMISSION_DENIED` |

### 3.2 数据边界约束

| 约束项 | 约束规则 |
|--------|----------|
| 必填字段 | `reason` (枚举)、`expectedRetirementDate` (日期)、`applicantId` (用户ID) |
| 选填字段 | `remarks` (备注，最多500字符) |
| 附件限制 | 单次申请最多上传 5 个附件，单文件最大 10MB |
| 原因枚举 | `PHYSICAL_DAMAGE`, `TECHNICAL_OBSOLESCENCE`, `LEASE_EXPIRY`, `INVENTORY_LOSS`, `OTHER` |
| 历史不可篡改 | 所有报废操作记录 `写入后不可删除、不可修改` |

### 3.3 技术边界约束

| 约束项 | 约束规则 |
|--------|----------|
| 并发控制 | 使用乐观锁机制防止同一资产的竞态申请 |
| 事务边界 | 状态变更与历史记录写入必须在同一事务内完成 |
| 异步通知 | 审批节点转换时通过消息队列异步发送通知 |
| API版本 | 本次使用 `v1` 版本前缀 |

### 3.4 审批链配置规则

| 条件 | 审批层级 | 审批节点序列 |
|------|----------|--------------|
| 资产价值 < 10,000 | L1 | 部门主管 |
| 10,000 ≤ 资产价值 < 100,000 | L2 | 部门主管 → 资产管理员 |
| 资产价值 ≥ 100,000 | L3 | 部门主管 → 资产管理员 → 财务总监 |

---

## 4. 验收测试基准 (ATB)

### 4.1 测试环境要求

```
测试环境: SWARM-TEST
数据库: PostgreSQL 14+
Node.js: 18+
Python: 3.11+
后端测试框架: pytest 7.0+
前端E2E框架: Playwright 1.40+
```

### 4.2 功能点与物理测试用例

#### 4.2.1 ATB-001: 报废申请提交

| TC-ID | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 |
|-------|----------|----------|----------|----------|----------|
| TC-001-01 | 正常提交报废申请 | 存在状态为 `IN_SERVICE` 的资产A，申请人已登录 | 点击资产操作菜单→选择"申请报废"→填写报废原因与日期→提交 | 返回 201，生成 retireApplicationId，状态为 `PENDING_APPROVAL` | pytest |
| TC-001-02 | 对采购状态资产提交申请 | 资产B状态为 `PURCHASED` | 同 TC-001-01 操作 | 返回 400，errorCode=`ASSET_NOT_IN_SERVICE` | pytest |
| TC-001-03 | 对已退役资产重复提交 | 资产C状态为 `RETIRED` | 同 TC-001-01 操作 | 返回 400，errorCode=`ASSET_ALREADY_RETIRED` | pytest |
| TC-001-04 | 对已有进行中申请的资产提交 | 资产D已存在 `PENDING_APPROVAL` 申请 | 同 TC-001-01 操作 | 返回 409，errorCode=`RETIRE_APPLICATION_EXISTS` | pytest |
| TC-001-05 | 必填字段缺失校验 | 仅填写部分必填项 | 提交不完整表单 | 返回 422，详细字段校验错误列表 | pytest |
| TC-001-06 | 前端UI申请表单渲染 | 用户进入资产详情页 | 页面加载 | 申请报废按钮可见，表单字段完整 | Playwright |
| TC-001-07 | 前端申请提交成功流程 | 填写完整表单数据 | 点击提交按钮 | 页面跳转至申请详情，Toast提示"提交成功" | Playwright |

#### 4.2.2 ATB-002: 审批链流转

| TC-ID | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 |
|-------|----------|----------|----------|----------|----------|
| TC-002-01 | L1审批通过 | 报废申请A（资产价值<10000）已提交，审批人登录 | 进入审批列表→点击申请→点击"通过" | 返回 200，申请状态变更为 `APPROVED`，MQ收到通知事件 | pytest |
| TC-002-02 | L2审批流转 | 报废申请B（资产价值>=10000,<100000）已提交 | 一级审批人登录→通过 → 二级审批人登录→通过 | 一级通过后状态为 `PARTIAL_APPROVED`，二级通过后为 `APPROVED` | pytest |
| TC-002-03 | L3审批流转 | 报废申请C（资产价值>=100000）已提交 | 按序执行三级审批 | 每级通过后状态递增，最终为 `APPROVED` | pytest |
| TC-002-04 | 审批驳回 | 存在 `PENDING_APPROVAL` 的申请，审批人填写驳回原因 | 点击"驳回"→填写原因→确认 | 返回 200，申请状态变更为 `REJECTED`，申请人收到通知 | pytest |
| TC-002-05 | 审批顺序校验 | L2审批链，二级审批人先于一级操作 | 二级审批人尝试通过 | 返回 400，errorCode=`APPROVAL_SEQUENCE_INVALID` | pytest |
| TC-002-06 | 非审批人权限校验 | 当前用户不在审批链中 | 尝试对申请进行审批操作 | 返回 403，errorCode=`PERMISSION_DENIED` | pytest |
| TC-002-07 | 前端审批列表加载 | 审批人有待处理申请 | 进入审批工作台 | 显示待审批卡片，包含资产名称、申请人、提交时间 | Playwright |
| TC-002-08 | 前端审批通过操作 | 存在待审批申请 | 点击通过→确认 | 申请从列表消失，Toast提示"审批已通过" | Playwright |

#### 4.2.3 ATB-003: 状态变更与历史记录

| TC-ID | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 |
|-------|----------|----------|----------|----------|----------|
| TC-003-01 | 审批通过后状态自动变更 | 申请已 APPROVED，关联资产状态为 `IN_SERVICE` | 审批完成触发状态变更 | 资产状态变更为 `RETIRED`，变更时间戳精确到毫秒 | pytest |
| TC-003-02 | 状态变更与记录原子性 | 模拟网络异常于状态变更后、历史写入前 | 注入异常 | 数据库完整回滚，资产状态保持 `IN_SERVICE`，异常被捕获 | pytest |
| TC-003-03 | 历史记录完整性验证 | 存在完整审批流程的退役申请 | 查询 `GET /api/v1/assets/{id}/history/` | 返回包含 `retireApplication`、`approvals`、`statusChanges` 的完整链 | pytest |
| TC-003-04 | 历史记录不可篡改 | 存在退役记录 | 发起 PUT 或 DELETE 请求修改历史 | 返回 405 Method Not Allowed | pytest |
| TC-003-05 | 前端历史记录展示 | 资产已退役 | 进入资产详情→点击"操作历史" | 退役申请记录、审批节点、状态变更时间轴完整展示 | Playwright |

#### 4.2.4 ATB-004: 退役资产查询

| TC-ID | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 |
|-------|----------|----------|----------|----------|----------|
| TC-004-01 | 退役资产列表查询 | 数据库中存在 ≥3 条退役资产 | `GET /api/v1/assets/?status=RETIRED&page=1&pageSize=20` | 返回分页列表，每项包含资产名称、编号、退役时间 | pytest |
| TC-004-02 | 退役资产详情查询 | 存在退役资产E | `GET /api/v1/assets/{id}/` | 资产详情中 `retiredAt`、`retireReason`、`retireApplicationId` 字段存在且非空 | pytest |
| TC-004-03 | 退役资产筛选-按原因 | 存在多条退役资产，含不同原因 | `GET /api/v1/assets/?status=RETIRED&retireReason=PHYSICAL_DAMAGE` | 仅返回物理损坏原因的退役资产 | pytest |
| TC-004-04 | 退役资产筛选-按部门 | 退役资产分布于多个部门 | `GET /api/v1/assets/?status=RETIRED&deptId=DEPT001` | 仅返回指定部门的退役资产 | pytest |
| TC-004-05 | 前端退役资产视图 | 用户进入资产管理模块 | 点击"退役资产"Tab | 显示退役资产列表，支持筛选与导出 | Playwright |

#### 4.2.5 ATB-005: 前端权限与交互

| TC-ID | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 |
|-------|----------|----------|----------|----------|----------|
| TC-005-01 | 普通用户可见申请入口 | 用户角色为普通员工 | 进入资产详情页 | "申请报废"按钮可见 | Playwright |
| TC-005-02 | 审批人可见审批入口 | 用户角色为部门主管 | 进入工作台 | 显示报废审批任务卡片 | Playwright |
| TC-005-03 | 非相关人员无审批权限 | 用户既非申请人亦非审批链成员 | 尝试访问审批详情页 | 页面显示 403 或无数据 | Playwright |
| TC-005-04 | 退役资产详情页展示 | 资产已退役 | 进入退役资产详情页 | 状态标签显示"已退役"，历史记录完整 | Playwright |

### 4.3 ATB 执行命令

```bash
# 后端单元测试
pytest tests/api/test_retirement_api.py -v --tb=short

# 后端服务集成测试
pytest tests/services/test_retirement_service.py -v --cov=src/services/retirement_service

# 前端E2E测试-用户旅程
npx playwright test tests/e2e/retirement_user_journey.spec.ts --project=chromium

# 前端E2E测试-核心流程
npx playwright test tests/e2e/retirement_flow.spec.ts --project=chromium

# 覆盖率要求
pytest --cov=src --cov-report=html --cov-fail-under=80

# AST静态检查
python scripts/ast_dead_code_check.py --target=src/services/retirement_service.py
```

### 4.4 验收门槛

| AC-ID | 验收标准 | 验证方法 | 门槛值 |
|-------|----------|----------|--------|
| AC-001 | 用户任务完成度 | E2E测试通过率 | 100% |
| AC-002 | 功能覆盖度 | TC覆盖需求比率 | ≥95% |
| AC-003 | 代码质量 | AST静态检查 | 0 错误 |
| AC-004 | 文档完整性 | Docstring覆盖率 | ≥90% |
| AC-005 | 模块可导入性 | Import测试 | 0 ImportError |

---

## 5. 开发切入层级序列

### 5.1 分层架构

```
┌────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  [API Routers] → [Controllers] → [Serializers] → [Views]    │
├────────────────────────────────────────────────────────────┤
│                     Service Layer                           │
│  [RetirementService] → [ApprovalChainService] → [NotificationService]
├────────────────────────────────────────────────────────────┤
│                    Domain Layer                             │
│  [RetirementApplication] ← [Asset] ← [ApprovalProcess]       │
├────────────────────────────────────────────────────────────┤
│                 Infrastructure Layer                        │
│  [Repository] → [MessageQueue] → [AuditLogger]              │
└────────────────────────────────────────────────────────────┘
```

### 5.2 后端开发顺序（已完成）

| 序号 | 层级 | 组件 | 状态 | 依赖 |
|------|------|------|------|------|
| 1 | Domain | `RetirementApplication` 实体 | ✅ 完成 | 无 |
| 2 | Domain | `RetirementHistory` 实体 | ✅ 完成 | 1 |
| 3 | Domain | 状态机 `retirement_state_machine.py` | ✅ 完成 | 1 |
| 4 | Schema | `RetirementRequestDTO` | ✅ 完成 | 1 |
| 5 | Infrastructure | `RetirementRepository` | ✅ 完成 | 1 |
| 6 | Infrastructure | 消息队列生产者 | ✅ 完成 | 3 |
| 7 | Service | `RetirementService` | ✅ 完成 | 4,5 |
| 8 | Service | `ApprovalChainService` | ✅ 完成 | 3,7 |
| 9 | API | `RetirementController` | ✅ 完成 | 7,8 |
| 10 | Frontend Routes | 路由配置 | ✅ 完成 | - |

### 5.3 前端开发顺序（本次迭代）

| 序号 | 层级 | 组件 | 状态 | 依赖 | 交付物 |
|------|------|------|------|------|--------|
| 11 | Hooks | `permissionHooks.ts` | 待修改 | 10, AC-005 | 报废权限判断逻辑 |
| 12 | Hooks | `useDepreciation.ts` | 待修改 | AC-004 | 退役时折旧计算 |
| 13 | Component | `AssetDetailModal.tsx` | 待修改 | 11,12 | 退役操作入口 |
| 14 | E2E | `retirement_flow.spec.ts` | 待修改 | 13 | 核心流程测试 |
| 15 | E2E | `retirement_user_journey.spec.ts` | 待修改 | 14 | 完整旅程测试 |

### 5.4 关键实现要点

#### 5.4.1 状态机转换规则

```python
# retirement_state_machine.py
class RetirementState(Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    PARTIAL_APPROVED = "PARTIAL_APPROVED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    RETIRED = "RETIRED"

# 合法的状态转换
STATE_TRANSITIONS = {
    RetirementState.DRAFT: [RetirementState.PENDING_APPROVAL],
    RetirementState.PENDING_APPROVAL: [RetirementState.PARTIAL_APPROVED, RetirementState.APPROVED, RetirementState.REJECTED],
    RetirementState.PARTIAL_APPROVED: [RetirementState.APPROVED, RetirementState.REJECTED],
    RetirementState.APPROVED: [RetirementState.RETIRED],
}
```

#### 5.4.2 事务边界控制

```python
# RetirementService.java (伪代码)
@Transactional(isolation = Isolation.SERIALIZABLE)
public void completeRetirement(Long retireApplicationId) {
    // 1. 验证申请状态为 APPROVED
    // 2. 更新资产状态为 RETIRED
    // 3. 写入 RetirementHistory
    // 4. 发布 RetirementCompletedEvent
    // 以上必须原子执行
}
```

#### 5.4.3 乐观锁防并发

```java
// RetirementApplication.java
@Entity
public class RetirementApplication {
    @Version
    private Long version;
    
    // 同一资产同时只允许一个 PENDING_APPROVAL 申请
    @UniqueConstraint(columns = {"asset_id", "status"})
    private String status;
}
```

---

## 6. API 端点清单

| 方法 | 端点 | 描述 | 认证要求 |
|------|------|------|----------|
| POST | `/api/v1/assets/{assetId}/retire/` | 提交报废申请 | 登录用户 |
| GET | `/api/v1/retire-applications/{id}/` | 查询申请详情 | 申请人/审批人 |
| POST | `/api/v1/retire-applications/{id}/approve/` | 审批通过 | 审批链成员 |
| POST | `/api/v1/retire-applications/{id}/reject/` | 审批驳回 | 审批链成员 |
| GET | `/api/v1/assets/?status=RETIRED` | 退役资产列表 | 登录用户 |
| GET | `/api/v1/assets/{assetId}/history/` | 资产操作历史 | 登录用户 |
| GET | `/api/v1/approval/tasks/?type=RETIREMENT` | 待审批任务列表 | 审批人 |

---

## 7. 错误码定义

| 错误码 | HTTP状态码 | 描述 | 处理建议 |
|--------|------------|------|----------|
| `ASSET_NOT_IN_SERVICE` | 400 | 资产状态不允许发起报废 | 检查资产当前状态 |
| `ASSET_ALREADY_RETIRED` | 400 | 资产已退役 | 无需重复操作 |
| `RETIRE_APPLICATION_EXISTS` | 409 | 存在进行中的报废申请 | 查询现有申请进度 |
| `APPROVAL_SEQUENCE_INVALID` | 400 | 审批顺序错误 | 按正确顺序审批 |
| `PERMISSION_DENIED` | 403 | 无审批权限 | 联系管理员 |
| `RETIREMENT_NOT_FOUND` | 404 | 报废申请不存在 | 检查申请ID |
| `INVALID_RETIREMENT_REASON` | 422 | 无效的报废原因枚举值 | 使用枚举列表中的值 |

---

## 8. 附录

### 8.1 领域事件列表

| 事件名 | 触发时机 | 消费者 |
|--------|----------|--------|
| `RetirementApplicationCreated` | 申请提交成功 | NotificationService, AuditService |
| `RetirementApproved` | 审批通过（单节点或多级最后一节点） | NotificationService, RetirementService |
| `RetirementRejected` | 审批驳回 | NotificationService |
| `AssetRetired` | 资产状态变更为退役 | NotificationService, AuditService, DashboardService |

### 8.2 前端组件依赖关系

```
AssetDetailModal.tsx
├── useDepreciation.ts (获取折旧信息)
├── permissionHooks.ts (权限判断)
│   └── useApprovalPermission.ts
└── retirementService.ts (报废API调用)
```

### 8.3 测试数据准备

```typescript
// 退役测试资产模板
const retirementTestAsset = {
  id: "AST-RETIRE-001",
  name: "测试退役资产-笔记本",
  status: "IN_SERVICE",
  purchaseDate: "2020-01-15",
  purchasePrice: 8500,
  currentValue: 3400,
  deptId: "DEPT-IT",
  categoryId: "CAT-EQUIPMENT"
};
```

---

**文档结束**

*本规格文档为 SWARM-ASSET-RETIRE 任务 Iteration 1 的实施指导，所有变更必须严格遵循上述边界约束。*