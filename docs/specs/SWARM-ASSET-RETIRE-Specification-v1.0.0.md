# SWARM-ASSET-RETIRE 资产报废退役流程规格指导文档

**版本**: 1.0.0  
**生效日期**: 2025-XX-XX  
**迭代**: Iteration 1

---

## 1. 需求与背景

### 1.1 业务场景

资产报废退役（Asset Retirement）是资产管理全生命周期中的关键终态环节。当资产因物理损坏、技术淘汰、租赁到期、盘亏等原因需要退出生产环境时，需通过规范化流程确保：

- 资产状态变更的合规性与可追溯性
- 审批流程的透明化与权责分离
- 财务账面与实物状态的一致性
- 历史操作记录的完整保留

### 1.2 现有系统能力

当前 SWARM 资产管理系统已具备：

- 资产基础信息管理（CRUD）
- 资产状态模型（采购、在用、维护、报废四级状态）
- 基础审批流程框架
- 操作审计日志机制

### 1.3 缺失能力

- 缺乏结构化的报废申请提交界面
- 缺乏针对报废场景的审批链配置
- 缺乏退役状态转换的业务规则校验
- 缺乏退役资产的独立查询与统计

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 定位

| Phase | 范围 | 状态 |
|-------|------|------|
| Phase 1（本次） | 核心报废流程：申请提交 → 审批流转 → 状态变更 → 基础记录 | 进行中 |
| Phase 2 | 高级特性：批量报废、报废评估、处置关联、统计分析增强 | 待规划 |
| Phase 3 | 集成扩展：与财务系统对接、上下游系统事件推送 | 待规划 |

### 2.2 Phase 1 核心目标

本次实施聚焦于 **单条资产报废的全链路打通**，具体目标：

1. **申请提交**：支持用户选择资产并填写报废原因、期望退役日期
2. **审批流转**：基于资产价值/类型触发差异化审批链
3. **状态变更**：审批通过后自动将资产状态由"在用"变更为"退役"
4. **历史记录**：生成包含申请信息、审批意见、状态变更的完整操作链
5. **退役查询**：提供退役资产的独立列表视图

### 2.3 非本次目标（边界外）

- 批量报废操作
- 报废资产的物理处置记录（如拆卸、转售、销毁）
- 与财务系统的凭证同步
- 报废前的技术评估流程
- 资产恢复（退役状态逆向转回）

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 描述 |
|--------|------|
| 申请前置条件 | 资产当前状态必须为"在用"或"维护"，处于"采购"或已"退役"状态的资产不可发起报废 |
| 互斥约束 | 同一资产在同一时刻只允许存在一条进行中的报废申请 |
| 审批时效 | 审批链各节点默认超时时间为 72 小时，超时后可配置自动通过或自动驳回 |
| 状态回退 | 退役状态为终态，不可通过本流程逆向变更回其他状态 |
| 必填字段 | 报废原因（枚举选型）、期望退役日期、申请人备注（非必填） |

### 3.2 数据边界

| 约束项 | 描述 |
|--------|------|
| 历史不可篡改 | 所有报废相关操作记录写入后不可删除、不可修改 |
| 附件限制 | 单次申请最多上传 5 个附件，单文件最大 10MB |
| 原因枚举 | 物理损坏、技术淘汰、租赁到期、盘亏、其他（需填写说明） |

### 3.3 技术约束

| 约束项 | 描述 |
|--------|------|
| 并发控制 | 使用乐观锁机制防止同一资产的竞态申请 |
| 事务边界 | 状态变更与历史记录写入必须在同一事务内完成 |
| 异步通知 | 审批节点转换时通过消息队列异步发送通知 |

---

## 4. 验收测试基准 (ATB)

### 4.1 测试环境要求

```
测试环境: swarms-test
数据库: PostgreSQL 14+
Python: 3.11+
测试框架: pytest 7.0+
API测试: pytest-django + requests
前端测试: Playwright
```

### 4.2 功能点与测试用例

#### 4.2.1 ATB-001: 报废申请提交

| 测试ID | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 |
|--------|----------|----------|----------|----------|----------|
| TC-001-01 | 正常提交报废申请 | 存在状态为"在用"的资产A，申请人具有提交权限 | POST /api/v1/assets/{id}/retire/ 提交报废原因、日期 | 返回201，retire_id生成，状态为pending_approval | pytest |
| TC-001-02 | 对"采购"状态资产提交申请 | 存在状态为"采购"的资产B | POST /api/v1/assets/{id}/retire/ | 返回400，错误码ASSET_NOT_IN_SERVICE | pytest |
| TC-001-03 | 对已"退役"资产提交申请 | 存在状态为"退役"的资产C | POST /api/v1/assets/{id}/retire/ | 返回400，错误码ASSET_ALREADY_RETIRED | pytest |
| TC-001-04 | 对已有进行中申请的资产提交 | 资产D已存在pending_approval的报废申请 | POST /api/v1/assets/{id}/retire/ | 返回409，错误码RETIRE_APPLICATION_EXISTS | pytest |
| TC-001-05 | 提交时必填字段缺失 | 仅填写部分必填项 | POST /api/v1/assets/{id}/retire/ | 返回422，校验错误详情 | pytest |
| TC-001-06 | 前端UI提交流程 | 用户登录，选择资产，点击报废按钮 | 填写表单，提交 | 页面跳转至申请详情，状态显示审批中 | Playwright |

#### 4.2.2 ATB-002: 审批链流转

| 测试ID | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 |
|--------|----------|----------|----------|----------|----------|
| TC-002-01 | 低价值资产单级审批 | 报废申请A（资产价值<10000） | 审批人登录，点击通过 | 返回200，申请状态变更为approved，消息队列收到通知事件 | pytest |
| TC-002-02 | 高价值资产多级审批 | 报废申请B（资产价值>=10000） | 一级审批人通过 → 二级审批人通过 | 一级通过后状态为partial_approved，二级通过后为approved | pytest |
| TC-002-03 | 审批驳回 | 存在pending_approval的申请C | 审批人点击驳回，填写驳回原因 | 返回200，申请状态变更为rejected，申请人收到通知 | pytest |
| TC-002-04 | 审批人权限校验 | 当前用户非审批链中的审批人 | 尝试审批操作 | 返回403，错误码PERMISSION_DENIED | pytest |
| TC-002-05 | 审批顺序校验 | 多级审批链，第二节点审批人先于第一节点操作 | 第二节点审批人尝试通过 | 返回400，错误码APPROVAL_SEQUENCE_INVALID | pytest |

#### 4.2.3 ATB-003: 状态变更与历史记录

| 测试ID | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 |
|--------|----------|----------|----------|----------|----------|
| TC-003-01 | 审批通过后状态自动变更 | 申请已approved，关联资产状态为在用 | 审批完成触发状态变更 | 资产状态变更为retired，变更时间戳记录 | pytest |
| TC-003-02 | 状态变更与记录原子性 | 网络异常发生于状态变更后、历史记录写入前 | 模拟异常场景 | 数据库回滚，资产状态保持不变，异常被捕获 | pytest |
| TC-003-03 | 历史记录完整性 | 存在完整审批流程的退役申请 | 查询 /api/v1/assets/{id}/history/ | 返回包含retire_application、approvals、status_changes的完整链 | pytest |
| TC-003-04 | 历史记录不可篡改 | 存在退役记录 | 尝试PUT/DELETE历史记录接口 | 返回405，方法不允许 | pytest |

#### 4.2.4 ATB-004: 退役资产查询

| 测试ID | 测试场景 | 前置条件 | 测试步骤 | 预期结果 | 测试类型 |
|--------|----------|----------|----------|----------|----------|
| TC-004-01 | 退役资产列表查询 | 数据库中存在多条退役资产 | GET /api/v1/assets/?status=retired | 返回分页列表，包含资产基础信息与退役时间 | pytest |
| TC-004-02 | 退役资产详情查询 | 存在退役资产E | GET /api/v1/assets/{id}/ | 返回资产详情，retired_at、retire_reason字段存在 | pytest |
| TC-004-03 | 退役资产筛选 | 存在多条退役资产，含不同原因 | GET /api/v1/assets/?status=retired&retire_reason=physical_damage | 仅返回物理损坏原因的退役资产 | pytest |

### 4.3 ATB 执行命令

```bash
# 后端API测试
pytest tests/api/v1/test_asset_retire.py -v --tb=short

# 前端E2E测试
pytest tests/e2e/test_retire_flow.py --browser=chromium

# 覆盖率要求
pytest --cov=apps.asset --cov-report=html --cov-fail-under=80
```

---

## 5. 开发切入层级序列

### 5.1 分层架构

```
┌─────────────────────────────────────────────────────┐
│                   Presentation Layer                │
│  (API Routes / Views / Serializers / Forms)         │
├─────────────────────────────────────────────────────┤
│                   Service Layer                     │
│  (Business Logic / State Machine / Workflow)         │
├─────────────────────────────────────────────────────┤
│                   Domain Layer                      │
│  (Entities / Value Objects / Domain Events)          │
├─────────────────────────────────────────────────────┤
│                   Infrastructure Layer               │
│  (Repository / Message Queue / Notification)          │
└─────────────────────────────────────────────────────┘
```

### 5.2 开发顺序与依赖关系

| 序号 | 开发层级 | 具体任务 | 依赖前置 | 交付物 |
|------|----------|----------|----------|--------|
| 1 | Domain | 资产退役聚合根设计（RetireApplication实体） | 无 | `domain/entities/retire_application.py` |
| 2 | Domain | 资产状态机定义（状态枚举、转换规则） | 1 | `domain/state_machine/asset_state.py` |
| 3 | Domain | 领域事件定义（RetireRequested、RetireApproved等） | 1 | `domain/events/retire_events.py` |
| 4 | Infrastructure | 报废申请Repository实现 | 1 | `infrastructure/repositories/retire_repo.py` |
| 5 | Infrastructure | 消息队列生产者（通知事件） | 3 | `infrastructure/messaging/retire_producer.py` |
| 6 | Service | 报废申请服务（提交、查询） | 2,4 | `services/retire_service.py` |
| 7 | Service | 审批链服务（流转、校验） | 2,6 | `services/approval_service.py` |
| 8 | Service | 状态变更服务（退役转换、事务控制） | 3,7 | `services/state_transition_service.py` |
| 9 | Presentation | API路由定义 | 6,7,8 | `api/v1/urls.py` |
| 10 | Presentation | Serializer定义 | 9 | `api/v1/serializers/retire_serializer.py` |
| 11 | Presentation | ViewSet实现 | 10 | `api/v1/views/retire_viewset.py` |
| 12 | Frontend | 报废申请表单组件 | 11(API就绪) | `frontend/components/RetireForm.vue` |
| 13 | Frontend | 审批流程UI | 11 | `frontend/pages/approval/retire.vue` |
| 14 | Integration | 端到端流程测试 | 11,12,13 | `tests/e2e/test_retire_flow.py` |

### 5.3 关键实现要点

#### 5.3.1 状态机配置

```python
# domain/state_machine/asset_state.py
STATE_TRANSITIONS = {
    State.IN_SERVICE: {
        Event.REQUEST_RETIRE: State.PENDING_RETIRE,
    },
    State.PENDING_RETIRE: {
        Event.APPROVE_RETIRE: State.RETIRED,
        Event.REJECT_RETIRE: State.IN_SERVICE,  # 驳回可恢复
    },
}
```

#### 5.3.2 事务边界

```python
# services/state_transition_service.py
@Transactional(isolation=Isolation.SERIALIZABLE)
def transition_to_retired(self, retire_id: str):
    # 1. 更新资产状态为退役
    # 2. 写入状态变更历史
    # 3. 发布领域事件
    # 以上三者必须在同一事务内完成
```

#### 5.3.3 乐观锁防止并发

```python
# RetireApplication 模型
class Meta:
    unique_together = ['asset_id', 'status']
    # status = 'pending_approval' 时唯一
```

---

## 6. 附录

### 6.1 错误码定义

| 错误码 | 描述 |
|--------|------|
| ASSET_NOT_IN_SERVICE | 资产状态不允许发起报废 |
| ASSET_ALREADY_RETIRED | 资产已退役 |
| RETIRE_APPLICATION_EXISTS | 存在进行中的报废申请 |
| APPROVAL_SEQUENCE_INVALID | 审批顺序错误 |
| PERMISSION_DENIED | 无审批权限 |

### 6.2 API端点清单

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | /api/v1/assets/{id}/retire/ | 提交报废申请 |
| GET | /api/v1/assets/{id}/retire/ | 查询报废申请详情 |
| POST | /api/v1/retire-applications/{id}/approve/ | 审批通过 |
| POST | /api/v1/retire-applications/{id}/reject/ | 审批驳回 |
| GET | /api/v1/assets/?status=retired | 退役资产列表 |

### 6.3 审批链配置规则

| 条件 | 审批层级 | 审批人角色 |
|------|----------|------------|
| 资产价值 < 10,000 | L1 | 部门主管 |
| 10,000 <= 资产价值 < 100,000 | L2 | 部门主管 → 资产管理员 |
| 资产价值 >= 100,000 | L3 | 部门主管 → 资产管理员 → 财务总监 |

---

**文档结束**