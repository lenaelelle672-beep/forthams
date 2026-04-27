# 资产报废/退役流程 - 规格指导文档 (Spec)

**版本**: 1.0
**模块**: gsd (资产管理模块)
**迭代**: Iteration 1
**状态**: 已通过 AC 审核

---

## 1. 需求与背景

### 1.1 业务背景

随着企业资产规模持续扩大，资产全生命周期管理成为合规审计与运营效率的关键环节。当前系统缺乏标准化的资产报废/退役流程，导致以下问题：

| 问题类型 | 具体表现 |
|----------|----------|
| 流程不规范 | 资产报废依赖线下审批，缺乏电子化留痕 |
| 状态不透明 | 退役资产状态不明确，难以区分"在用/闲置/报废" |
| 数据分散 | 资产退役原因分散记录，无法形成结构化的追溯数据 |
| 效率低下 | 审批链依赖人工传递，流程规范性不足 |

### 1.2 功能目标

本次 Iteration 实现资产报废/退役流程的端到端覆盖：

| 目标 | 描述 | 对应 AC |
|------|------|---------|
| 报废申请发起 | 用户可为指定资产提交报废申请，附带原因与附件 | AC-001 |
| 审批链自动流转 | 根据资产类别/价值自动匹配审批规则，驱动多级审批 | AC-001 |
| 完整历史记录 | 所有状态变更、审批动作形成不可篡改的时间线 | AC-001 |
| 退役状态标注 | 审批通过后资产标记为"退役"状态 | AC-001 |
| 原因追溯 | 支持按资产、时间、原因类型进行多维度追溯查询 | AC-001 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解

> **注**: 参照 plan.md 中 Phase 拆解定义。

| Phase | 名称 | 范围 | 覆盖状态 |
|-------|------|------|----------|
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

---

## 5. 开发切入层级序列

### 5.1 层级依赖图

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 5: 前端交互层 (UI/UX)                                 │
│  - 报废申请表单                                               │
│  - 审批操作界面                                               │
│  - 历史时间线展示                                             │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: 业务编排层 (Service)                                │
│  - RetirementApplicationService (申请管理)                   │
│  - ApprovalWorkflowService (审批流程编排)                     │
│  - AssetStatusTransitionService (状态迁移)                    │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 领域逻辑层 (Domain)                                 │
│  - RetirementApplication (聚合根)                            │
│  - ApprovalChain (值对象)                                    │
│  - RetirementReason (值对象)                                 │
│  - RetirementHistory (实体)                                  │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 数据访问层 (Repository)                             │
│  - RetirementApplicationRepository                           │
│  - ApprovalRecordRepository                                   │
│  - AssetRetirementHistoryRepository                          │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 基础设施层 (Infrastructure)                          │
│  - 数据库迁移 (Flyway/Liquibase)                              │
│  - 消息队列集成 (审批通知)                                    │
│  - 文件存储集成 (附件)                                        │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 开发实施顺序

| 阶段 | 层级 | 任务 | 交付物 | 预计工时 |
|------|------|------|--------|----------|
| **Phase 1.1** | Layer 1 | 数据库表设计与迁移脚本 | `V1__add_retirement_tables.sql` | 0.5d |
| **Phase 1.2** | Layer 2 | Repository 接口与实现 | `*Repository.java` + 单元测试 | 1d |
| **Phase 1.3** | Layer 3 | 领域模型编写 | 聚合根、值对象、领域事件 | 1d |
| **Phase 1.4** | Layer 4 | Service 层业务逻辑 | `RetirementApplicationService` 等 | 2d |
| **Phase 2.1** | Layer 2 | 审批链数据访问 | `ApprovalRecordRepository` | 0.5d |
| **Phase 2.2** | Layer 3 | 审批规则引擎（内存实现） | `ApprovalRuleEngine` | 1d |
| **Phase 2.3** | Layer 4 | 审批流程编排 | `ApprovalWorkflowService` | 1.5d |
| **Phase 3.1** | Layer 2 | 历史记录存储查询 | `HistoryRepository` | 0.5d |
| **Phase 3.2** | Layer 3-4 | 历史记录查询服务 | `HistoryQueryService` | 1d |
| **Phase 4.1** | Layer 4 | 退役状态同步逻辑 | `AssetStatusTransitionService` | 0.5d |
| **Phase 5.1** | Layer 4 | REST API 控制器 | `RetirementController` | 1d |
| **Phase 5.2** | Layer 5 | 前端页面开发 | 申请表单、审批界面、历史时间线 | 3d |
| **Phase 6** | - | 集成测试与 ATB 执行 | 测试报告 | 1.5d |

### 5.3 数据库表结构概要

```sql
-- retirement_application: 报废申请表
CREATE TABLE retirement_application (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    asset_id        BIGINT NOT NULL,
    reason          VARCHAR(50) NOT NULL,  -- 枚举值
    reason_detail   VARCHAR(500),
    status          VARCHAR(20) NOT NULL,  -- PENDING/APPROVING/APPROVED/REJECTED/WITHDRAWN/RETIRED
    applicant_id    BIGINT NOT NULL,
    current_approval_level INT DEFAULT 0,
    version         INT NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL,
    updated_at      DATETIME NOT NULL
);

-- approval_chain: 审批链配置表
CREATE TABLE approval_chain (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    asset_category  VARCHAR(50) NOT NULL,
    asset_value_range VARCHAR(20),  -- e.g., "<100000", "100000-500000", ">500000"
    approval_levels JSON NOT NULL,  -- 审批人 ID 列表
    is_active       BOOLEAN DEFAULT TRUE
);

-- approval_record: 审批记录表
CREATE TABLE approval_record (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    application_id  BIGINT NOT NULL,
    approver_id     BIGINT NOT NULL,
    approval_level  INT NOT NULL,
    action          VARCHAR(20) NOT NULL,  -- APPROVE/REJECT
    comment         VARCHAR(500),
    created_at      DATETIME NOT NULL
);

-- asset_retirement_history: 资产退役历史表
CREATE TABLE asset_retirement_history (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    asset_id        BIGINT NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    operator_id     BIGINT NOT NULL,
    detail          JSON,
    created_at      DATETIME NOT NULL,
    is_deleted      BOOLEAN DEFAULT FALSE
);

-- retirement_attachment: 报废附件表
CREATE TABLE retirement_attachment (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    application_id  BIGINT NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    file_size       BIGINT NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    uploaded_at     DATETIME NOT NULL
);
```

---

## 附录

### A. 错误码定义

| 错误码 | 描述 |
|--------|------|
| `ASSET_NOT_FOUND` | 资产不存在 |
| `ASSET_STATUS_INVALID` | 资产状态不允许报废 |
| `RETIREMENT_PENDING_EXISTS` | 存在待审批的报废申请 |
| `RETIREMENT_NOT_FOUND` | 报废申请不存在 |
| `RETIREMENT_NOT_PENDING` | 申请状态不允许此操作 |
| `NOT_AUTHORIZED` | 无权限执行此操作 |
| `SELF_APPROVAL_FORBIDDEN` | 禁止自我审批 |
| `FILE_TYPE_INVALID` | 附件格式不支持 |
| `FILE_SIZE_EXCEEDED` | 附件大小超限 |

### B. 状态机定义

```
[在用/闲置] --申请报废--> [报废审批中]
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
        [已拒绝]        [已撤回]      [审批中: N/N级]
                                             │
                            ┌────────────────┴────────────────┐
                            ▼                                 ▼
                    [已退役]                          [审批中: N+1/N级]
                                                             │
                                                             ▼
                                                       (循环或完成)
```

### C. AC 验收标准状态

| AC ID | 验收标准 | 验证方式 | 状态 |
|-------|----------|----------|------|
| AC-001 | 验证资产报废/退役流程完整用户旅程 | unit_test | ✅ 已通过审核 |
| AC-002 | 代码变更不引入新的语法错误（AST 静态检查通过） | static_analysis | ✅ 已通过审核 |
| AC-003 | 所有修改的函数包含 docstring 文档注释 | static_analysis | ✅ 已通过审核 |
| AC-004 | 变更后的模块可被正常 import 不抛出 ImportError | unit_test | ✅ 已通过审核 |

### D. 涉及文件清单

| 文件路径 | 描述 | 修改状态 |
|----------|------|----------|
| `tests/e2e/retirement_user_journey.spec.ts` | E2E 测试文件 | 待修改 |
| `frontend/src/app/pages/Retirement/index.tsx` | 退役页面主组件 | 待修改 |
| `frontend/src/app/pages/Retirement/types/retirement.types.ts` | 类型定义 | 待修改 |
| `frontend/src/stores/approvalStore.ts` | 审批状态管理 | 待修改 |
| `frontend/src/components/ProgressTracker.tsx` | 进度追踪组件 | 待修改 |

---

**文档结束**