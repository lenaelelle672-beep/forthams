# 资产报废/退役流程 - 规格指导文档 (Spec)

**版本**: 1.0  
**模块**: gsd (资产管理模块)  
**迭代**: Iteration 1  
**状态**: 已审核通过

---

## 1. 需求与背景

### 1.1 业务背景

随着企业资产规模持续扩大，资产全生命周期管理成为合规审计与运营效率的关键环节。当前系统缺乏标准化的资产报废/退役流程，导致以下问题：

- 资产报废依赖线下审批，缺乏电子化留痕
- 退役资产状态不透明，难以区分"在用/闲置/报废"
- 资产退役原因分散记录，无法形成结构化的追溯数据
- 审批链依赖人工传递，流程规范性不足

### 1.2 功能目标

本次 Iteration 实现资产报废/退役流程的端到端覆盖，包括：

| 目标 | 描述 |
|------|------|
| 报废申请发起 | 用户可为指定资产提交报废申请，附带原因与附件 |
| 审批链自动流转 | 根据资产类别/价值自动匹配审批规则，驱动多级审批 |
| 完整历史记录 | 所有状态变更、审批动作形成不可篡改的时间线 |
| 退役状态标注 | 审批通过后资产标记为"退役"状态 |
| 原因追溯 | 支持按资产、时间、原因类型进行多维度追溯查询 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解参照

| Phase | 名称 | 范围 | 本次迭代覆盖 |
|-------|------|------|--------------|
| Phase 1 | 基础模型与申请入口 | 数据模型变更、报废申请表单、API 基础接口 | ✅ 全量覆盖 |
| Phase 2 | 审批流程引擎 | 审批规则配置、流程引擎、消息通知 | ✅ 全量覆盖 |
| Phase 3 | 历史记录与追溯 | 审计日志、变更时间线、追溯查询 | ✅ 全量覆盖 |
| Phase 4 | 退役状态管理 | 退役标注、状态同步、仪表盘展示 | ✅ 全量覆盖 |

### 2.2 本次 Iteration 实施范围

本次 Iteration 1 覆盖全部 Phase 1-4 的 MVP（最小可行产品）功能集：

**不包含的远期能力**（Future Work）：

- 批量报废审批
- 报废资产处置（变卖/回收）跟踪
- 与财务系统对接自动账务处理
- 报废资产二维码/条码打印

### 2.3 后端服务已实现清单

| 服务类 | 路径 | 状态 |
|--------|------|------|
| RetirementService | `backend/src/main/java/com/ams/service/RetirementService.java` | ✅ 已实现 |
| ScrapService | `backend/src/main/java/com/ams/service/ScrapService.java` | ✅ 已实现 |
| ApprovalChainService | `backend/src/main/java/com/ams/service/ApprovalChainService.java` | ✅ 已实现 |
| StatusHistoryService | `backend/src/main/java/com/ams/service/AssetStatusHistoryService.java` | ✅ 已实现 |
| NotificationService | `backend/src/main/java/com/ams/service/NotificationService.java` | ✅ 已实现 |

---

## 3. 边界约束

### 3.1 数据约束

| 约束项 | 约束内容 |
|--------|----------|
| 资产类型 | 支持固定资产（设备/车辆/建筑物）及其子类 |
| 报废原因枚举 | `正常使用到期`、`意外损毁`、`技术落后`、`政策合规`、`其他` |
| 附件支持 | 仅支持 PDF/图片（JPG/PNG），单文件 ≤ 10MB，总数 ≤ 5 个 |
| 审批链深度 | 最小 1 级（直接主管），最大 4 级 |
| 历史记录保留 | 永久保留，不可物理删除，仅标记逻辑删除 |

### 3.2 业务约束

| 约束项 | 约束内容 |
|--------|----------|
| 申请前置条件 | 资产状态必须为 `在用` 或 `闲置` |
| 申请权限 | 仅 `资产管理员` 角色可发起 |
| 审批权限 | 审批人不得与申请人为同一人 |
| 撤回时限 | 仅在审批链全部完成前允许撤回 |
| 并发控制 | 同一资产同一时间仅允许一个有效的报废申请 |

### 3.3 技术约束

| 约束项 | 约束内容 |
|--------|----------|
| 响应时限 | API 响应时间 ≤ 200ms（P99） |
| 审批通知 | 消息推送延迟 ≤ 5 秒 |
| 数据一致性 | 状态变更使用乐观锁（version 字段） |
| API 版本 | v1，路径前缀 `/api/v1/assets/retirement` |
| 状态机实现 | 基于 `RetirementState` 枚举的状态流转控制 |

---

## 4. 验收测试基准 (ATB)

### 4.1 功能测试矩阵

| 序号 | 测试用例 ID | 功能描述 | 前置条件 | 测试步骤 | 物理测试期待 | 测试工具 |
|------|-------------|----------|----------|----------|--------------|----------|
| 1 | TC-RET-001 | 报废申请发起 | 存在 `在用` 状态资产 A，用户为资产管理员 | 1. 登录系统 → 2. 进入资产详情页 → 3. 点击"申请报废" → 4. 填写原因"技术落后"，上传 PDF 附件 → 5. 提交 | 1. 系统返回 `201 Created`；2. 报废申请记录创建成功；3. 资产状态变为 `报废审批中`；4. 审批链触发首级审批人收到通知 | Playwright (E2E) |
| 2 | TC-RET-002 | 审批链自动流转 | 存在待审批报废申请 B，配置为 2 级审批 | 1. 首级审批人登录 → 2. 进入待办列表 → 3. 审批通过 → 4. 二级审批人登录查看 | 1. 首级审批后，申请自动流转至二级；2. 二级审批人待办列表出现该申请；3. 审批记录包含完整链路信息 | Playwright (E2E) |
| 3 | TC-RET-003 | 审批拒绝回退 | 存在待审批报废申请 C | 1. 审批人进入申请详情 → 2. 点击"拒绝"，填写意见"需补充评估报告" → 3. 提交 | 1. 申请状态变为 `已拒绝`；2. 资产状态回退为 `在用`；3. 申请人收到拒绝通知 | Playwright (E2E) |
| 4 | TC-RET-004 | 申请撤回 | 存在 `审批中` 状态报废申请 D | 1. 申请人进入申请详情 → 2. 点击"撤回" → 3. 确认 | 1. 申请状态变为 `已撤回`；2. 审批链终止；3. 资产状态回退为 `在用` | Playwright (E2E) |
| 5 | TC-RET-005 | 报废审批通过 | 存在已完成全部审批的报废申请 E | 1. 审批链最后一級审批通过 → 2. 系统自动处理 | 1. 申请状态变为 `已退役`；2. 资产状态变为 `退役`；3. 历史记录包含完整审批时间线 | Playwright (E2E) |
| 6 | TC-RET-006 | 历史记录查询 | 存在多条报废记录的资产 F | 1. 进入资产 F 详情页 → 2. 切换至"历史记录"标签 → 3. 查询变更时间线 | 1. 时间线按时间倒序展示；2. 每条记录包含操作人、操作类型、时间戳；3. 记录不可篡改 | Playwright (E2E) |
| 7 | TC-RET-007 | 退役状态标注 | 存在 `退役` 状态资产 G | 1. 进入资产列表页 → 2. 查看资产 G 状态展示 | 1. 状态显示为 `退役`（红色标签）；2. 详情页显示退役日期与原因 | Playwright (E2E) |
| 8 | TC-RET-008 | 原因追溯查询 | 系统存在多个不同原因类型的退役资产 | 1. 进入资产管理 → 2. 使用筛选条件"报废原因=意外损毁" → 3. 执行查询 | 1. 返回结果仅包含匹配原因类型的资产；2. 导出 CSV 功能正常 | Playwright (E2E) + Pytest |

### 4.2 API 层单元测试

| 序号 | 测试用例 ID | 接口 | 测试场景 | Pytest 期待 |
|------|-------------|------|----------|-------------|
| 1 | UT-RET-001 | `POST /api/v1/assets/retirement/apply` | 正常提交报废申请 | 返回 `201`，包含 `application_id` |
| 2 | UT-RET-002 | `POST /api/v1/assets/retirement/apply` | 资产状态非 `在用`/`闲置` 时提交 | 返回 `400`，错误码 `ASSET_STATUS_INVALID` |
| 3 | UT-RET-003 | `POST /api/v1/assets/retirement/apply` | 资产已有待审批申请时重复提交 | 返回 `409`，错误码 `RETIREMENT_PENDING_EXISTS` |
| 4 | UT-RET-004 | `POST /api/v1/assets/retirement/{id}/approve` | 审批通过 | 返回 `200`，触发下一级或完成审批 |
| 5 | UT-RET-005 | `POST /api/v1/assets/retirement/{id}/reject` | 审批拒绝 | 返回 `200`，资产状态回退 |
| 6 | UT-RET-006 | `POST /api/v1/assets/retirement/{id}/withdraw` | 申请人撤回 | 返回 `200`，审批链终止 |
| 7 | UT-RET-007 | `GET /api/v1/assets/retirement/{id}/history` | 查询历史记录 | 返回按时间倒序的记录列表 |
| 8 | UT-RET-008 | `GET /api/v1/assets/retirement/trace` | 多维度追溯查询 | 返回过滤后的记录，支持分页 |

### 4.3 边界条件测试

| 序号 | 测试场景 | 期待行为 |
|------|----------|----------|
| BC-01 | 附件上传超过 10MB | 返回 `413 Payload Too Large` |
| BC-02 | 上传非允许格式附件 | 返回 `400 Bad Request`，提示格式错误 |
| BC-03 | 审批人试图审批自己发起的申请 | 返回 `403 Forbidden` |
| BC-04 | 并发操作：同一资产同时发起两个报废申请 | 第二个请求返回 `409 Conflict` |
| BC-05 | 审批链中途资产被删除 | 申请自动终止，状态标记为 `资产已删除` |

### 4.4 状态机流转测试

| 序号 | 测试场景 | 当前状态 | 触发事件 | 期待下一状态 |
|------|----------|----------|----------|--------------|
| SM-01 | 正常审批通过 | `PENDING` | `SUBMIT` | `APPROVING` |
| SM-02 | 单级审批通过 | `APPROVING` | `APPROVE` (最后一级) | `APPROVED` |
| SM-03 | 多级审批流转 | `APPROVING` | `APPROVE` (非最后一级) | `APPROVING` (level+1) |
| SM-04 | 审批拒绝 | `APPROVING` | `REJECT` | `REJECTED` |
| SM-05 | 申请人撤回 | `APPROVING` | `WITHDRAW` | `WITHDRAWN` |
| SM-06 | 退役完成 | `APPROVED` | `COMPLETE` | `RETIRED` |

---

## 5. 开发切入层级序列

### 5.1 层级依赖图

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 5: 前端交互层 (UI/UX)                                  │
│  - 报废申请表单 (Retirement/index.tsx)                        │
│  - 审批操作界面 (approvalStore.ts)                           │
│  - 历史时间线展示 (ProgressTracker.tsx)                      │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: 业务编排层 (Service)                                 │
│  - RetirementService (申请管理)                              │
│  - ScrapService (报废处理)                                   │
│  - ApprovalChainService (审批流程编排)                        │
│  - AssetStatusHistoryService (状态迁移)                       │
│  - NotificationService (消息通知)                             │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 领域逻辑层 (Domain)                                 │
│  - RetirementState (状态枚举)                                │
│  - RetirementStateMachine (状态机)                           │
│  - RetirementApplication (聚合根)                             │
│  - RetirementHistory (实体)                                  │
│  - ApprovalChain (值对象)                                    │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 数据访问层 (Repository)                             │
│  - RetirementApplicationMapper                               │
│  - RetirementHistoryMapper                                   │
│  - ApprovalRecordMapper                                      │
│  - AssetStatusHistoryMapper                                  │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 基础设施层 (Infrastructure)                          │
│  - 数据库表 (retirement_application, approval_chain 等)       │
│  - 消息队列集成 (审批通知)                                    │
│  - 文件存储集成 (附件)                                        │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 开发实施顺序

| 阶段 | 层级 | 任务 | 交付物 | 依赖关系 |
|------|------|------|--------|----------|
| **Phase 1.1** | Layer 1 | 数据库表设计与迁移 | Entity 类 + Mapper | 无 |
| **Phase 1.2** | Layer 2 | Repository 层实现 | RetirementApplicationMapper 等 | Phase 1.1 |
| **Phase 1.3** | Layer 3 | 领域模型实现 | RetirementState, RetirementStateMachine | Phase 1.2 |
| **Phase 1.4** | Layer 4 | Service 层业务逻辑 | RetirementService, ScrapService | Phase 1.3 |
| **Phase 2.1** | Layer 4 | 审批链编排 | ApprovalChainService | Phase 1.4 |
| **Phase 2.2** | Layer 4 | 消息通知集成 | NotificationService | Phase 2.1 |
| **Phase 3.1** | Layer 3-4 | 历史记录查询 | AssetStatusHistoryService | Phase 1.4 |
| **Phase 4.1** | Layer 4 | 退役状态同步 | 状态变更逻辑 | Phase 2.1 |
| **Phase 5.1** | Layer 5 | 前端申请表单 | `frontend/src/app/pages/Retirement/index.tsx` | Phase 1.4 |
| **Phase 5.2** | Layer 5 | 状态管理 | `frontend/src/stores/approvalStore.ts` | Phase 2.1 |
| **Phase 5.3** | Layer 5 | 进度追踪组件 | `frontend/src/components/ProgressTracker.tsx` | Phase 3.1 |
| **Phase 5.4** | Layer 5 | 类型定义更新 | `frontend/src/app/pages/Retirement/types/retirement.types.ts` | Phase 1.3 |
| **Phase 6** | - | E2E 测试覆盖 | `tests/e2e/retirement_user_journey.spec.ts` | Phase 5.1-5.3 |

### 5.3 数据库表结构概要

```sql
-- retirement_application: 报废申请表
CREATE TABLE retirement_application (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    asset_id        BIGINT NOT NULL,
    reason          VARCHAR(50) NOT NULL,
    reason_detail   VARCHAR(500),
    status          VARCHAR(20) NOT NULL,
    applicant_id    BIGINT NOT NULL,
    current_approval_level INT DEFAULT 0,
    version         INT NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL,
    updated_at      DATETIME NOT NULL,
    INDEX idx_asset_id (asset_id),
    INDEX idx_status (status)
);

-- approval_chain: 审批链配置表
CREATE TABLE approval_chain (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    asset_category  VARCHAR(50) NOT NULL,
    asset_value_range VARCHAR(20),
    approval_levels JSON NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE
);

-- approval_record: 审批记录表
CREATE TABLE approval_record (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    application_id  BIGINT NOT NULL,
    approver_id     BIGINT NOT NULL,
    approval_level  INT NOT NULL,
    action          VARCHAR(20) NOT NULL,
    comment         VARCHAR(500),
    created_at      DATETIME NOT NULL,
    INDEX idx_application_id (application_id)
);

-- asset_status_history: 资产状态历史表
CREATE TABLE asset_status_history (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    asset_id        BIGINT NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    operator_id     BIGINT NOT NULL,
    detail          JSON,
    created_at      DATETIME NOT NULL,
    is_deleted      BOOLEAN DEFAULT FALSE,
    INDEX idx_asset_id (asset_id),
    INDEX idx_event_type (event_type)
);

-- retirement_attachment: 报废附件表
CREATE TABLE retirement_attachment (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    application_id  BIGINT NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    file_size       BIGINT NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    uploaded_at     DATETIME NOT NULL,
    INDEX idx_application_id (application_id)
);
```

### 5.4 状态机定义

```
[在用/闲置] --申请报废(SUBMIT)--> [报废审批中: PENDING]
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
              [已拒绝]              [已撤回]           [审批中: APPROVING]
              (REJECTED)           (WITHDRAWN)               │
                                                          │
                                      ┌────────────────────┴────────────────────┐
                                      ▼                                         ▼
                              [已退役]                                  [审批中: APPROVING]
                              (RETIRED)                                 (level+1 继续)
```

---

## 附录

### A. 错误码定义

| 错误码 | 描述 | HTTP 状态码 |
|--------|------|-------------|
| `ASSET_NOT_FOUND` | 资产不存在 | 404 |
| `ASSET_STATUS_INVALID` | 资产状态不允许报废 | 400 |
| `RETIREMENT_PENDING_EXISTS` | 存在待审批的报废申请 | 409 |
| `RETIREMENT_NOT_FOUND` | 报废申请不存在 | 404 |
| `RETIREMENT_NOT_PENDING` | 申请状态不允许此操作 | 400 |
| `NOT_AUTHORIZED` | 无权限执行此操作 | 403 |
| `SELF_APPROVAL_FORBIDDEN` | 禁止自我审批 | 403 |
| `FILE_TYPE_INVALID` | 附件格式不支持 | 400 |
| `FILE_SIZE_EXCEEDED` | 附件大小超限 | 413 |

### B. 前端文件修改清单

| 文件路径 | 变更说明 |
|----------|----------|
| `tests/e2e/retirement_user_journey.spec.ts` | E2E 测试：完整用户流程验证 |
| `frontend/src/app/pages/Retirement/index.tsx` | 退役申请主页面 |
| `frontend/src/app/pages/Retirement/types/retirement.types.ts` | 类型定义对齐后端枚举 |
| `frontend/src/stores/approvalStore.ts` | 审批链状态管理 |
| `frontend/src/components/ProgressTracker.tsx` | 审批进度可视化组件 |

### C. 关键枚举定义

```typescript
// retirement.types.ts
enum RetirementStatus {
  PENDING = 'PENDING',           // 待提交
  APPROVING = 'APPROVING',        // 审批中
  APPROVED = 'APPROVED',          // 已批准
  REJECTED = 'REJECTED',          // 已拒绝
  WITHDRAWN = 'WITHDRAWN',        // 已撤回
  RETIRED = 'RETIRED'             // 已退役
}

enum RetirementReason {
  NORMAL_EXPIRY = '正常使用到期',
  ACCIDENT_DAMAGE = '意外损毁',
  TECH_OBSOLESCENCE = '技术落后',
  POLICY_COMPLIANCE = '政策合规',
  OTHER = '其他'
}
```

---

**文档结束**