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

- **Graphify 知识图谱**无匹配节点，需从零构建数据模型与流程引擎
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
| 进度追踪 API | `GET /retirements/{id}/progress` | P0 |
| 状态流转 API | `POST /retirements/{id}/transition` | P1 |
| Graphify 知识图谱节点生成 | 修复 "No matching nodes found" 问题 | P0 |

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

### ATB-006: Graphify 知识图谱节点生成

| 测试ID | 测试步骤 | 物理期待 | 测试类型 |
|--------|----------|----------|----------|
| ATB-006-01 | 正常调用 `convertAuditLogsToGraphifyNodes` | 返回非空 GraphifyNode 数组 | pytest |
| ATB-006-02 | 空 auditLogs 但有有效 assetId | 返回资产根节点 `[asset-{assetId}]` | pytest |
| ATB-006-03 | 空 auditLogs 且无 assetId | 返回空数组 `[]` | pytest |
| ATB-006-04 | 节点数组验证 `validateGraphifyNodes` | 空数组返回 true | pytest |
| ATB-006-05 | 异常输入（undefined/null）处理 | 防御性检查不抛异常 | pytest |
| ATB-006-06 | 资产详情页 Graphify 组件渲染 | 无 "No matching nodes found" 错误 | playwright |

### ATB-007: 边界条件

| 测试ID | 测试步骤 | 物理期待 | 测试类型 |
|--------|----------|----------|----------|
| ATB-007-01 | 超长理由文本提交 | 截断至 500 字符或返回 400 | pytest |
| ATB-007-02 | 并发审批冲突 | 第二个审批返回 409 | pytest (concurrent) |
| ATB-007-03 | 审批人同时为申请人 | 返回 403，错误码 `SELF_APPROVAL_FORBIDDEN` | pytest |

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

### Level 4: Graphify 知识图谱修复层（Day 9-10）

```
frontend/src/
├── hooks/
│   └── useAuditLog.ts                # convertAuditLogsToGraphifyNodes 修复
│
├── components/audit/
│   └── GraphifyKnowledgeGraph.tsx    # 知识图谱组件修复
│
└── utils/
    └── graphify-helpers.ts           # 节点生成辅助函数
```

**Graphify 问题修复策略**:

| 问题根因 | 修复方案 |
|----------|----------|
| 空数组未返回资产根节点 | 在 `convertAuditLogsToGraphifyNodes` 中增加资产根节点兜底逻辑 |
| 节点验证逻辑缺失 | 实现 `validateGraphifyNodes` 防御性检查 |
| 组件渲染错误处理缺失 | 添加 `No matching nodes` 容错显示 |

**修复代码片段示例**:

```typescript
// frontend/src/hooks/useAuditLog.ts
export function convertAuditLogsToGraphifyNodes(
  auditLogs: AuditLogEntry[] | undefined | null,
  assetId: string,
  options: ConvertOptions = {}
): GraphifyNode[] {
  // ATB-BC-001, ATB-BC-002: 防御性检查 - 处理空数组和 undefined 输入
  if (!auditLogs || auditLogs.length === 0) {
    // ATB-006-02: 即使 auditLogs 为空，也应返回资产根节点（如果 assetId 有效）
    if (assetId && assetId.trim() !== '') {
      return [{
        id: `asset-${assetId}`,
        type: 'asset',
        label: '资产',
        x: options.centerX ?? 400,
        y: options.centerY ?? 300,
        properties: { assetId }
      }];
    }
    return [];
  }
  // ... 原有转换逻辑
}
```

**验收标准**:
```bash
pytest frontend/tests/unit/audit/convertAuditLogsToGraphifyNodes.test.ts -v
playwright test frontend/tests/e2e/assetDetail.audit.spec.ts -g "graphify"
# 全部通过，无 "No matching nodes found" 错误
```

### Level 5: API 接口层（Day 11-12）

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

### Level 6: 前端集成层（Day 13-14）

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

### Level 7: 集成测试与验收（Day 15）

```bash
# 全量回归测试
pytest tests/ -v --tb=short

# E2E 验收测试
playwright test tests/e2e/ -g "retirement"

# ATB 覆盖率报告
pytest tests/ --atb-report=atb_coverage.json

# Graphify 组件测试
playwright test frontend/tests/e2e/ -g "graphify"
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

## 修改文件清单

本次迭代需修改的文件（参照 AC 验收标准）：

| 文件路径 | 修改内容 | 验收标准 |
|----------|----------|----------|
| `frontend/tests/unit/audit/convertAuditLogsToGraphifyNodes.test.ts` | 新增空数组处理测试用例 | AC-001, AC-003 |
| `frontend/src/styles/audit-highlight.css` | Graphify 组件样式优化 | AC-003 |
| `frontend/tests/unit/memory/index.ts` | Mock 函数增强 | AC-001, AC-003 |
| `frontend/src/components/audit/GraphifyKnowledgeGraph.tsx` | 错误处理和容错显示 | AC-001, AC-004 |
| `frontend/src/hooks/useAuditLog.ts` | 修复节点生成逻辑 | AC-001, AC-004 |

---

## 版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0.0 | 迭代开始 | Spec Engineer | 初始版本 |