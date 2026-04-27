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
| ATB-001-01 | 用户提交报废请求（资产ID + 理由） | `POST /disposals` 返回 201，状态为 `DRAFT` | pytest |
| ATB-001-02 | 提交后检查状态机初始状态 | `GET /disposals/{id}` 返回 `current_status: DRAFT` | pytest |
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
| ATB-003-01 | L1 审批通过 | `POST /disposals/{id}/approve` L1 → L2 pending | pytest |
| ATB-003-02 | L1 审批拒绝 | 状态变为 `REJECTED`，通知REQUESTER | pytest |
| ATB-003-03 | L2 审批通过 | L2 → L3 pending | pytest |
| ATB-003-04 | L3 最终审批通过 | 状态变为 `APPROVED`，可进入 DISPOSED | pytest |
| ATB-003-05 | 跨级审批尝试（如 L1 审批 L3 节点） | 返回 403，错误码 `UNAUTHORIZED_APPROVER` | pytest |
| ATB-003-06 | 重复审批同一节点 | 返回 409，错误码 `ALREADY_APPROVED` | pytest |
| ATB-003-07 | 资产高价值（>50000）触发增强审批 | `GET /disposals/{id}` 显示 `approval_tier: HIGH` | pytest |

### ATB-004: 历史记录

| 测试ID | 测试步骤 | 物理期待 | 测试类型 |
|--------|----------|----------|----------|
| ATB-004-01 | 状态变更记录 | `GET /disposals/{id}/history` 包含状态变更条目 | pytest |
| ATB-004-02 | 审批操作记录 | 历史记录包含审批人、时间、结果 | pytest |
| ATB-004-03 | 历史记录不可修改 | `PUT /disposals/{id}/history` 返回 405 | pytest |
| ATB-004-04 | 历史记录防删除 | `DELETE /disposals/{id}/history` 返回 405 | pytest |
| ATB-004-05 | 完整变更链追溯 | 从创建到退役所有操作均可查 | pytest |

### ATB-005: 进度追踪

| 测试ID | 测试步骤 | 物理期待 | 测试类型 |
|--------|----------|----------|----------|
| ATB-005-01 | 查询当前进度 | `GET /disposals/{id}/progress` 返回当前审批节点 | playwright |
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
backend/src/main/java/com/ams/
├── entity/
│   ├── DisposalRequest.java           # 报废请求核心实体
│   ├── DisposalApprovalChain.java      # 审批链配置实体
│   ├── DisposalApprovalStep.java      # 审批步骤实体
│   ├── DisposalHistory.java            # 历史记录实体
│   └── enums/
│       ├── DisposalStatus.java         # 状态枚举
│       └── ApprovalAction.java         # 审批动作枚举
│
└── dto/
    ├── DisposalCreateDTO.java          # 创建请求 DTO
    ├── DisposalProgressDTO.java        # 进度查询响应 DTO
    └── DisposalHistoryDTO.java         # 历史记录响应 DTO
```

**验收标准**: 所有模型可通过 JPA/MyBatis 正确创建表结构

### Level 2: 状态机引擎层（Day 3-5）

```
backend/src/main/java/com/ams/
├── statemachine/
│   ├── DisposalStateMachine.java       # 状态机核心实现
│   ├── DisposalTransition.java         # 流转规则定义
│   ├── TransitionGuard.java            # 流转条件守卫
│   └── TransitionEvent.java            # 流转事件定义
│
└── service/
    └── DisposalStateService.java       # 状态流转业务逻辑
```

**验收标准**: 
```bash
# 单元测试
mvn test -Dtest=DisposalStateMachineTest
# 全部通过
```

### Level 3: 审批链服务层（Day 6-8）

```
backend/src/main/java/com/ams/
├── service/
│   ├── DisposalApprovalService.java    # 审批链执行引擎
│   ├── DisposalNotificationService.java # 审批通知（预留接口）
│   └── DisposalAssetService.java       # 资产状态更新服务
│
└── repository/
    ├── DisposalRequestRepository.java   # 报废请求持久化
    ├── DisposalApprovalChainRepository.java
    └── DisposalHistoryRepository.java
```

**验收标准**:
```bash
mvn test -Dtest=DisposalApprovalServiceTest
mvn test -Dtest=DisposalServiceTest
# 全部通过
```

### Level 4: API 接口层（Day 9-11）

```
backend/src/main/java/com/ams/
├── controller/
│   └── DisposalController.java          # 报废流程 API 路由
│
├── security/
│   └── DisposalPermissionEvaluator.java # 权限校验
│
└── config/
    └── DisposalAuditConfig.java         # 审计日志配置
```

**API 端点定义**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/disposals | 创建报废请求 |
| GET | /api/disposals/{id} | 获取报废请求详情 |
| POST | /api/disposals/{id}/submit | 提交报废请求 |
| POST | /api/disposals/{id}/approve | 审批通过 |
| POST | /api/disposals/{id}/reject | 审批拒绝 |
| GET | /api/disposals/{id}/progress | 获取审批进度 |
| GET | /api/disposals/{id}/history | 获取历史记录 |
| POST | /api/disposals/{id}/dispose | 执行退役操作 |

**验收标准**:
```bash
mvn test -Dtest=DisposalControllerTest
# 全部通过
```

### Level 5: 前端集成层（Day 12-14）

```
frontend/src/
├── pages/
│   └── disposal/
│       ├── index.tsx                   # 报废申请列表页
│       ├── new.tsx                     # 新建报废申请页
│       └── [id].tsx                    # 申请详情页（含进度追踪）
│
├── components/
│   ├── DisposalStatusBadge.tsx
│   ├── DisposalProgressTracker.tsx     # 审批进度组件
│   └── DisposalApprovalChain.tsx       # 审批链可视化
│
└── hooks/
    └── useDisposalProgress.ts          # 进度追踪 Hook
```

**验收标准**:
```bash
playwright test tests/e2e/disposal_flow.spec.ts
# 完整用户旅程测试通过
```

### Level 6: 集成测试与验收（Day 15）

```bash
# 全量回归测试
mvn test
npm run test:e2e

# ATB 覆盖率报告
./scripts/generate_atb_coverage.sh
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

## 参考实现文件

### 后端核心文件
- `backend/src/main/java/com/ams/controller/DisposalController.java` - API 控制器
- `backend/src/main/java/com/ams/service/DisposalService.java` - 服务层实现

### 前端核心文件
- `frontend/src/hooks/useAuditLog.ts` - 审计日志 Hook（含 Graphify 节点转换）
- `frontend/src/components/audit/GraphifyKnowledgeGraph.tsx` - 知识图谱组件
- `frontend/src/styles/audit-highlight.css` - 审计高亮样式