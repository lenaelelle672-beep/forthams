# 工单审批流程系统规格指导文档

**文档编号**: SWARM-S5-001-SPEC  
**版本**: 1.0  
**迭代**: Iteration 1  
**状态**: 已批准  
**发布日期**: 2024年

---

## 1. 需求与背景

### 1.1 业务场景

某企业内部资产管理系统需要实现工单审批流程，涵盖从工单提交、审批流转到最终归档的完整生命周期管理。该系统面向企业资产管理人员、财务人员和高级审批人员三类主要用户角色。

资产管理员负责发起资产相关工单（如资产退役、转移、报废等）；财务人员负责审核资产折旧和价值变动相关的工单；高级审批人员拥有最终审批权限，对重要工单进行最终决策。

### 1.2 核心功能需求

本次Iteration 1实现以下三项核心功能：

| 功能模块 | 描述 |
|---------|------|
| **前端审批页面** | 为审批人员提供工单列表查看、详情浏览、一键审批/驳回操作界面，基于Vue 3 + Element Plus实现 |
| **后端状态机** | 实现工单状态的精确流转控制，确保状态变更的合法性与可追溯性，基于Python FastAPI实现 |
| **通知机制** | 在关键状态变更时自动触发通知，通知相关干系人当前工单的处理进展 |

### 1.3 技术栈约束

| 层级 | 技术选型 | 版本要求 |
|------|---------|----------|
| 前端框架 | Vue 3 | 3.4+ |
| 前端UI库 | Element Plus | 2.5+ |
| 前端状态管理 | Pinia | 2.1+ |
| 前端路由 | Vue Router | 4.2+ |
| 前端构建工具 | Vite | 5.0+ |
| 前端测试框架 | Playwright | 1.40+ |
| 前端单元测试 | Vitest | 1.0+ |
| 后端框架 | Python FastAPI | 0.109+ |
| 后端ORM | SQLAlchemy | 2.0+ |
| 数据库 | PostgreSQL | 15+ |
| 状态缓存 | Redis | 7.0+ |
| 后端测试框架 | pytest | 8.0+ |

### 1.4 业务规则

#### 1.4.1 工单状态定义

```python
class WorkOrderState(str, Enum):
    """工单状态枚举"""
    DRAFT = "draft"                    # 草稿/待提交
    PENDING_APPROVAL = "pending"       # 待审批
    APPROVING = "approving"            # 审批中
    APPROVED = "approved"              # 已通过
    REJECTED = "rejected"              # 已驳回
    ARCHIVED = "archived"              # 已归档
```

#### 1.4.2 状态流转矩阵

| 当前状态 | 允许目标状态 | 触发操作 | 操作权限 |
|---------|--------------|---------|---------|
| draft | pending | submit | 工单创建者 |
| pending | approving | accept | 审批接收人 |
| approving | approved | approve | 审批人 |
| approving | rejected | reject | 审批人 |
| approving | pending | return | 审批人 |
| approved | archived | archive | 系统/管理员 |
| rejected | draft | revise | 工单创建者 |
| rejected | pending | resubmit | 工单创建者 |

#### 1.4.3 审批规则

- 每个工单必须经过完整的审批流程才能归档
- 驳回操作必须填写驳回原因，驳回原因最小长度为10个字符
- 支持驳回至任意前置状态
- 同一工单同时只能有一个审批人处理
- 审批超时时间设定为72小时，超时后自动提醒

---

## 2. 当前Phase对应实施目标

### 2.1 Phase 1: 基础设施层 (Foundation)

**目标**: 构建工单审批系统的数据模型与基础后端框架

| 任务ID | 任务项 | 具体内容 | 交付物 | 依赖关系 |
|--------|--------|---------|--------|----------|
| T-1.1 | 数据库Schema设计 | 工单主表、审批记录表、状态变更日志表、通知记录表设计 | SQL Schema文件 | - |
| T-1.2 | 数据库Migrations | 编写Alembic migrations脚本 | migrations/*.py | T-1.1 |
| T-1.3 | 后端项目骨架 | FastAPI项目结构、依赖配置、中间件设置 | FastAPI应用框架 | - |
| T-1.4 | 状态机核心实现 | StateMachine基类、WorkOrderStateMachine实现 | state_machine.py | T-1.1 |

**交付标准**:
- 数据库表结构通过schema验证
- 所有API端点可正常启动
- 状态机可执行基础状态流转

### 2.2 Phase 2: 核心业务层 (Core Business)

**目标**: 实现工单CRUD与状态流转逻辑

| 任务ID | 任务项 | 具体内容 | 交付物 | 依赖关系 |
|--------|--------|---------|--------|----------|
| T-2.1 | 工单CRUD API | 创建、查询、更新、删除接口 | RESTful API Endpoints | T-1.3 |
| T-2.2 | 状态流转引擎 | 状态机规则引擎、合法性校验、权限校验 | TransitionEngine类 | T-1.4 |
| T-2.3 | 审批记录持久化 | 审批动作与理由的存储、审批历史查询 | 审批日志写入逻辑 | T-2.1, T-2.2 |
| T-2.4 | 并发控制 | 乐观锁机制、防并发审批 | 并发控制模块 | T-2.2 |

**交付标准**:
- 所有CRUD API通过单元测试
- 状态流转符合流转矩阵定义
- 并发场景下只有一个操作成功

### 2.3 Phase 3: 前端交互层 (UI Layer)

**目标**: 构建审批人员操作界面

| 任务ID | 任务项 | 具体内容 | 交付物 | 依赖关系 |
|--------|--------|---------|--------|----------|
| T-3.1 | 工单列表页 | 筛选、排序、分页列表展示 | WorkOrderList.vue | T-2.1 |
| T-3.2 | 工单详情页 | 完整信息展示、审批历史时间线 | WorkOrderDetailCard.tsx | T-2.3 |
| T-3.3 | 审批操作面板 | 批准/驳回按钮、原因输入框、审批历史 | ApprovalPanel组件 | T-2.2, T-3.2 |
| T-3.4 | 状态管理 | Pinia Store实现、API调用封装 | approvalStore.ts | T-3.1, T-3.3 |

**交付标准**:
- 页面通过Playwright E2E测试
- 用户操作响应时间<500ms
- 无审批权限用户界面不显示操作按钮

### 2.4 Phase 4: 通知机制层 (Notification Layer)

**目标**: 实现状态变更的自动通知

| 任务ID | 任务项 | 具体内容 | 交付物 | 依赖关系 |
|--------|--------|---------|--------|----------|
| T-4.1 | 通知事件触发器 | 状态变更事件的发布、事件总线 | EventPublisher | T-2.2 |
| T-4.2 | 站内通知服务 | 通知创建、存储、标记已读 | NotificationService | T-4.1 |
| T-4.3 | 通知API | 通知列表查询、标记已读接口 | Notification API | T-4.2 |

**交付标准**:
- 审批通过后触发通知事件
- 驳回操作包含驳回原因
- 通知事件payload格式正确

---

## 3. 边界约束

### 3.1 功能边界

| 约束类别 | 约束项 | 约束内容 |
|---------|--------|---------|
| 审批粒度 | 单级审批 | 本次迭代仅实现单级审批，不支持多级审批链 |
| 审批粒度 | 会签审批 | 不支持多人会签审批 |
| 通知渠道 | 站内通知 | 本次迭代仅实现站内通知，邮件通道作为扩展项待后续迭代 |
| 数据隔离 | 多租户 | 暂不考虑多租户场景，单租户实现 |
| 附件功能 | 文件上传 | 本次迭代不包含附件功能 |
| 撤回功能 | 工单撤回 | 本次迭代不支持审批中撤回 |

### 3.2 技术边界

| 约束类别 | 约束项 | 约束内容 |
|---------|--------|---------|
| API版本 | 版本控制 | v1固定为`/api/v1/workorders/*` |
| 前端路由 | 路由模式 | 使用Vue Router 4，路由模式为history |
| 认证机制 | Token认证 | 本次迭代使用简化的token认证，不对接SSO |
| 数据库 | ORM | 必须使用SQLAlchemy ORM，禁止裸SQL |
| 配置管理 | 环境配置 | 使用Pydantic Settings管理环境变量 |

### 3.3 性能约束

| 指标类型 | 指标项 | 目标值 | 测量条件 |
|---------|--------|--------|----------|
| 响应时间 | API响应(P95) | <200ms | 单次API调用 |
| 响应时间 | 列表查询 | <500ms | 1000条数据量 |
| 响应时间 | 详情查询 | <300ms | 单条记录 |
| 响应时间 | 前端首屏 | <2s | 首次加载 |
| 吞吐量 | API并发 | >100 QPS | 持续5分钟压力测试 |

### 3.4 安全约束

| 约束类别 | 约束项 | 约束内容 |
|---------|--------|---------|
| 输入校验 | 参数校验 | 所有API入参必须经过Pydantic校验 |
| SQL注入 | 数据库查询 | 使用ORM查询，禁止字符串拼接SQL |
| XSS | 数据渲染 | 前端渲染用户输入必须做转义处理 |
| CSRF | 接口防护 | API需要验证CSRF Token |
| 权限校验 | 后端校验 | 后端必须二次校验用户审批角色 |
| 敏感数据 | 日志脱敏 | 敏感字段在日志中需脱敏处理 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 数据库层测试

| 测试编号 | 测试项 | 测试输入 | 物理测试期待 | 优先级 |
|----------|--------|---------|--------------|--------|
| DB-001 | 工单表创建 | 执行migrations | 表结构符合Schema定义，包含所有必需字段 | P0 |
| DB-002 | 审批记录表创建 | 执行migrations | 审批记录表字段完整，外键约束生效 | P0 |
| DB-003 | 状态变更日志表创建 | 执行migrations | 日志表字段完整，变更时间自动记录 | P1 |
| DB-004 | 通知记录表创建 | 执行migrations | 通知表包含read_at字段，支持已读未读状态 | P1 |
| DB-005 | 索引创建验证 | 执行migrations | workorder_id和status字段索引存在 | P1 |

**测试脚本**:
```
tests/db/test_workorder_tables.py
```

### 4.2 ATB-2: 后端状态机测试

| 测试编号 | 测试项 | 测试输入 | 物理测试期待 | 优先级 |
|----------|--------|---------|--------------|--------|
| SM-001 | 合法流转-待提交→待审批 | 提交操作 | 状态机返回成功，新状态为pending | P0 |
| SM-002 | 合法流转-待审批→审批中 | 接收操作 | 状态机返回成功，新状态为approving | P0 |
| SM-003 | 合法流转-审批中→已通过 | 审批通过 | 审批通过后状态变更为approved | P0 |
| SM-004 | 合法流转-审批中→已驳回 | 驳回操作 | 状态变更为rejected，驳回原因已记录 | P0 |
| SM-005 | 非法流转-已归档→审批中 | 直接操作 | 状态机拒绝非法流转，抛出InvalidTransitionError | P0 |
| SM-006 | 非法流转-草稿→已通过 | 跳过审批 | 状态机拒绝，抛出ApprovalStepNotReachableError | P0 |
| SM-007 | 状态重复提交校验 | 同一状态重复提交 | 返回错误码DUPLICATE_TRANSITION | P1 |
| SM-008 | 审批权限校验-无权限 | 无审批权限用户调用审批接口 | 返回403 Forbidden | P0 |
| SM-009 | 审批权限校验-有权限 | 有审批权限用户调用审批接口 | 返回200，状态正常变更 | P0 |
| SM-010 | 驳回原因校验 | 驳回原因为空 | 返回422，提示驳回原因必填 | P1 |
| SM-011 | 驳回原因长度校验 | 驳回原因<10字符 | 返回422，提示驳回原因最少10字符 | P1 |

**测试脚本**:
```
tests/unit/test_workorder_state_machine.py
tests/backend/test_state_machine.py
```

### 4.3 ATB-3: 后端API测试

| 测试编号 | 测试项 | 测试输入 | 物理测试期待 | 优先级 |
|----------|--------|---------|--------------|--------|
| API-001 | 创建工单 | POST /api/v1/workorders | 返回201，body包含workorder_id | P0 |
| API-002 | 查询工单列表 | GET /api/v1/workorders | 返回分页数据，默认20条/页 | P0 |
| API-003 | 查询工单列表-分页 | GET /api/v1/workorders?page=2&size=10 | 返回第2页10条数据 | P1 |
| API-004 | 查询工单列表-筛选 | GET /api/v1/workorders?status=pending | 仅返回待审批工单 | P1 |
| API-005 | 查询工单详情 | GET /api/v1/workorders/{id} | 返回完整工单信息与审批历史 | P0 |
| API-006 | 更新工单-草稿 | PUT /api/v1/workorders/{id} | 仅草稿状态可更新 | P1 |
| API-007 | 更新工单-审批中 | PUT /api/v1/workorders/{id} | 审批中状态不可更新，返回409 | P1 |
| API-008 | 删除工单 | DELETE /api/v1/workorders/{id} | 仅草稿状态可删除 | P1 |
| API-009 | 提交审批 | POST /api/v1/workorders/{id}/submit | 触发状态流转至pending | P0 |
| API-010 | 接收审批 | POST /api/v1/workorders/{id}/accept | 触发状态流转至approving | P0 |
| API-011 | 执行批准 | POST /api/v1/workorders/{id}/approve | 返回200，工单状态更新 | P0 |
| API-012 | 执行驳回 | POST /api/v1/workorders/{id}/reject | 返回200，驳回原因已持久化 | P0 |
| API-013 | 获取审批历史 | GET /api/v1/workorders/{id}/history | 返回审批历史列表，按时间倒序 | P1 |
| API-014 | 参数校验失败 | 无效参数请求 | 返回422，响应体包含校验错误详情 | P0 |
| API-015 | 工单不存在 | 操作不存在的工单 | 返回404，提示工单不存在 | P0 |
| API-016 | 未授权访问 | 无效token | 返回401，提示认证失败 | P0 |

**测试脚本**:
```
tests/api/test_workorder_api.py
tests/backend/test_workorder_api.py
tests/integration/test_workorder_api.py
```

### 4.4 ATB-4: 前端UI测试 (Playwright)

| 测试编号 | 测试项 | 测试输入 | 物理测试期待 | 优先级 |
|----------|--------|---------|--------------|--------|
| UI-001 | 工单列表页加载 | 访问/workorders | 页面加载完成，工单列表正确渲染 | P0 |
| UI-002 | 工单列表数据一致性 | 对比API数据 | 列表数据条目数与API一致 | P1 |
| UI-003 | 工单列表筛选 | 更改筛选条件 | 列表数据正确过滤 | P1 |
| UI-004 | 工单列表分页 | 点击下一页 | 列表数据正确翻页 | P1 |
| UI-005 | 工单详情页跳转 | 点击工单行 | 跳转至详情页，URL包含工单ID | P0 |
| UI-006 | 审批操作-批准 | 点击批准按钮 | 工单状态变更为已通过，页面提示成功 | P0 |
| UI-007 | 审批操作-驳回 | 点击驳回按钮 | 弹出原因输入框，填写后提交成功 | P0 |
| UI-008 | 审批历史时间线 | 查看工单详情 | 正确渲染审批历史，按时间倒序排列 | P1 |
| UI-009 | 无权限状态隐藏 | 无审批权限用户登录 | 界面不显示审批操作按钮 | P1 |
| UI-010 | 审批成功通知 | 审批通过后 | 页面显示操作成功提示 | P1 |
| UI-011 | 审批失败处理 | 审批接口返回错误 | 页面显示错误提示，不跳转 | P1 |
| UI-012 | 加载状态显示 | 数据加载中 | 显示loading骨架屏 | P2 |
| UI-013 | 空列表状态 | 无工单数据 | 显示空状态提示 | P2 |

**测试脚本**:
```
tests/e2e/test_workorder_workflow.spec.ts
frontend/tests/e2e/approval.spec.ts
```

### 4.5 ATB-5: 前端单元测试 (Vitest)

| 测试编号 | 测试项 | 测试输入 | 物理测试期待 | 优先级 |
|----------|--------|---------|--------------|--------|
| UT-001 | approvalStore初始化 | 创建store实例 | state正确初始化 | P0 |
| UT-002 | fetchWorkOrders调用 | 调用fetchWorkOrders | 正确调用API并更新state | P0 |
| UT-003 | approveWorkOrder方法 | 调用approveWorkOrder | 正确调用API并更新state | P0 |
| UT-004 | rejectWorkOrder方法 | 调用rejectWorkOrder | 正确调用API并更新state | P1 |
| UT-005 | 状态映射正确性 | API返回数据 | state.workOrders正确映射 | P1 |
| UT-006 | 错误处理 | API返回错误 | 正确捕获并更新errorState | P1 |

**测试脚本**:
```
frontend/src/stores/approvalStore.test.ts
frontend/tests/unit/test_approval_chain.py
```

### 4.6 ATB-6: 通知机制测试

| 测试编号 | 测试项 | 测试输入 | 物理测试期待 | 优先级 |
|----------|--------|---------|--------------|--------|
| NOTIFY-001 | 审批通过通知触发 | 状态变更为approved | 触发通知事件，日志记录发送 | P0 |
| NOTIFY-002 | 工单驳回通知触发 | 状态变更为rejected | 触发通知事件，包含驳回原因 | P0 |
| NOTIFY-003 | 通知事件payload | 事件发布 | payload包含工单ID、变更前后状态、操作人、时间戳 | P0 |
| NOTIFY-004 | 通知记录存储 | 事件消费 | 通知记录正确写入数据库 | P1 |
| NOTIFY-005 | 通知查询API | GET /api/v1/notifications | 返回当前用户的通知列表 | P1 |
| NOTIFY-006 | 通知已读标记 | PATCH /api/v1/notifications/{id}/read | 正确更新read_at字段 | P2 |

**测试脚本**:
```
tests/unit/test_notification.py
backend/src/test/java/com/ams/service/NotificationServiceTest.java
```

### 4.7 ATB-7: 集成测试

| 测试编号 | 测试项 | 测试输入 | 物理测试期待 | 优先级 |
|----------|--------|---------|--------------|--------|
| INT-001 | 完整审批流程 | 创建→提交→审批→归档 | 全流程成功 | P0 |
| INT-002 | 完整驳回流程 | 创建→提交→驳回→修改→重提→审批 | 流程正常完成 | P1 |
| INT-003 | 并发审批防护 | 两个并发审批请求 | 仅一个成功，另一个返回409冲突 | P0 |
| INT-004 | 审批历史追溯 | 审批完成后查询 | 历史记录完整且顺序正确 | P1 |
| INT-005 | 前后端集成 | 前端操作→后端验证 | 数据一致性 | P0 |

**测试脚本**:
```
tests/integration/test_approval_operations.py
tests/e2e/test_workorder_workflow.spec.ts
```

### 4.8 ATB-8: 验收条件汇总

| AC编号 | 验收条件 | 验证方法 | 通过标准 | 优先级 |
|--------|---------|----------|---------|--------|
| AC-001 | 集成验证 | integration | 工单审批流程端到端可用 | P0 |
| AC-002 | 语法检查 | static_analysis | AST静态检查通过，无语法错误 | P0 |
| AC-003 | 文档完整性 | static_analysis | 所有修改函数包含docstring | P1 |
| AC-004 | 模块导入 | unit_test | 变更模块可正常import，无ImportError | P0 |

---

## 5. 开发切入层级序列

### 5.1 开发顺序规划

```
Phase 1: 基础设施层 (Foundation)
│
├── [1.1] 数据库Schema设计与Migrations
│   ├── 任务: 设计工单表、审批记录表、日志表结构
│   ├── 输出: alembic/versions/001_create_workorder_tables.py
│   └── 验收: DB-001 ~ DB-005
│
├── [1.2] FastAPI项目骨架搭建
│   ├── 任务: 配置应用结构、中间件、依赖注入
│   ├── 输出: backend/main.py, backend/api/v1/workorders.py
│   └── 验收: AC-004
│
└── [1.3] 状态机核心类实现
    ├── 任务: 实现StateMachine基类与WorkOrderStateMachine
    ├── 输出: src/domain/state_machine/retirement_state_machine.py
    └── 验收: SM-001 ~ SM-011

Phase 2: 核心业务层 (Core Business)
│
├── [2.1] 工单CRUD API实现
│   ├── 任务: 实现工单创建、查询、更新、删除接口
│   ├── 依赖: 1.2
│   ├── 输出: backend/services/workorder_service.py, backend/api/v1/workorders.py
│   └── 验收: API-001 ~ API-008
│
├── [2.2] 状态流转引擎与权限校验
│   ├── 任务: 实现状态流转引擎、审批权限校验
│   ├── 依赖: 1.3
│   ├── 输出: src/application/commands/approve_work_order.py等
│   └── 验收: API-009 ~ API-012, SM-008 ~ SM-011
│
└── [2.3] 审批记录持久化
    ├── 任务: 实现审批历史存储与查询
    ├── 依赖: 2.1, 2.2
    ├── 输出: backend/services/approval_service.py
    └── 验收: API-013

Phase 3: 前端交互层 (UI Layer)
│
├── [3.1] 工单列表页开发
│   ├── 任务: 实现列表页、筛选、排序、分页
│   ├── 依赖: 2.1
│   ├── 输出: frontend/src/pages/WorkOrder/components/WorkOrderList.vue
│   └── 验收: UI-001 ~ UI-004
│
├── [3.2] 工单详情页开发
│   ├── 任务: 实现详情展示、审批历史时间线
│   ├── 依赖: 2.3
│   ├── 输出: frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx
│   └── 验收: UI-005, UI-008
│
├── [3.3] 审批操作面板开发
│   ├── 任务: 实现批准/驳回操作界面
│   ├── 依赖: 2.2, 3.2
│   ├── 输出: frontend/src/components/approval/ApprovalPanel.vue
│   └── 验收: UI-006, UI-007, UI-009 ~ UI-011
│
└── [3.4] 前端状态管理与测试
    ├── 任务: Pinia Store实现、单元测试编写
    ├── 依赖: 3.1, 3.3
    ├── 输出: frontend/src/stores/approvalStore.ts
    └── 验收: UT-001 ~ UT-006

Phase 4: 通知机制层 (Notification Layer)
│
├── [4.1] 通知事件触发器
│   ├── 任务: 状态变更事件发布
│   ├── 依赖: 2.2
│   ├── 输出: src/notifications/events.py, src/application/services/notification_service.py
│   └── 验收: NOTIFY-001 ~ NOTIFY-003
│
└── [4.2] 站内通知服务
    ├── 任务: 通知存储、查询、已读标记
    ├── 依赖: 4.1
    ├── 输出: backend/src/main/java/com/ams/service/NotificationService.java
    └── 验收: NOTIFY-004 ~ NOTIFY-006

Phase 5: 测试与集成 (Testing & Integration)
│
├── [5.1] 后端测试
│   ├── 任务: 单元测试、集成测试编写
│   ├── 依赖: Phase 1, Phase 2
│   ├── 输出: tests/unit/*.py, tests/integration/*.py
│   └── 验收: DB-*, SM-*, API-*, NOTIFY-*, INT-*
│
├── [5.2] 前端E2E测试
│   ├── 任务: Playwright测试编写
│   ├── 依赖: Phase 3
│   ├── 输出: tests/e2e/*.spec.ts
│   └── 验收: UI-*
│
└── [5.3] 验收测试执行
    ├── 任务: 执行AC验收条件
    ├── 依赖: Phase 4
    └── 验收: AC-001 ~ AC-004
```

### 5.2 关键技术决策点

| 决策领域 | 决策项 | 选型方案 | 决策依据 |
|---------|--------|---------|----------|
| 状态存储 | 热数据存储 | Redis | 工单状态频繁查询，Redis加速读取 |
| 状态存储 | 冷数据存储 | PostgreSQL | 审批历史持久化，事务保障 |
| 状态变更 | 事件模式 | 观察者模式+AsyncEvent | 解耦通知逻辑，支持后续扩展消息队列 |
| 并发控制 | 锁策略 | 乐观锁(版本号) | 减少锁竞争，提高吞吐量 |
| 前端状态 | 状态管理库 | Pinia Store | Vue 3官方推荐，TypeScript支持良好 |
| 前端请求 | HTTP客户端 | Axios | 成熟稳定，拦截器支持 |
| 权限控制 | 双重校验 | 后端强制校验+前端路由守卫 | 双重保障，防止越权 |
| API风格 | RESTful | /api/v1/workorders/{id}/action | 语义清晰，标准规范 |

### 5.3 关键文件清单

| 文件路径 | 用途 | 所属Phase |
|---------|------|----------|
| `alembic/versions/001_create_workorder_tables.py` | 数据库迁移 | Phase 1 |
| `backend/api/v1/workorders.py` | 工单API路由 | Phase 1, 2 |
| `backend/services/workorder_service.py` | 工单业务逻辑 | Phase 2 |
| `backend/services/approval_service.py` | 审批业务逻辑 | Phase 2 |
| `src/domain/state_machine/retirement_state_machine.py` | 状态机实现 | Phase 1 |
| `src/application/commands/approve_work_order.py` | 审批命令 | Phase 2 |
| `src/application/commands/reject_work_order.py` | 驳回命令 | Phase 2 |
| `src/notifications/events.py` | 通知事件定义 | Phase 4 |
| `src/application/services/notification_service.py` | 通知服务 | Phase 4 |
| `frontend/src/pages/WorkOrder/components/WorkOrderDetailCard.tsx` | 详情卡片组件 | Phase 3 |
| `frontend/src/stores/approvalStore.ts` | 审批状态管理 | Phase 3 |
| `tests/e2e/test_workorder_workflow.spec.ts` | E2E测试 | Phase 5 |
| `frontend/tests/unit/test_approval_chain.py` | 单元测试 | Phase 5 |
| `frontend/tests/e2e/approval.spec.ts` | 前端E2E测试 | Phase 5 |

---

## 6. 附录

### 6.1 状态机状态定义

```python
# src/domain/entities/work_order.py
class WorkOrderState(str, Enum):
    """工单状态枚举"""
    DRAFT = "draft"                    # 草稿/待提交
    PENDING_APPROVAL = "pending"       # 待审批
    APPROVING = "approving"            # 审批中
    APPROVED = "approved"              # 已通过
    REJECTED = "rejected"              # 已驳回
    ARCHIVED = "archived"              # 已归档
```

### 6.2 状态流转矩阵(完整)

| 当前状态 | 可执行操作 | 目标状态 | 前置条件 |
|---------|-----------|---------|---------|
| draft | submit | pending | 工单必填字段已填写 |
| pending | accept | approving | 当前用户是待审批人 |
| pending | cancel | draft | 当前用户是创建者 |
| approving | approve | approved | 当前用户有审批权限 |
| approving | reject | rejected | 驳回原因已填写(≥10字符) |
| approving | return | pending | 退回给上一级审批人 |
| approved | archive | archived | 当前用户是管理员 |
| rejected | revise | draft | 当前用户是创建者 |
| rejected | resubmit | pending | 工单已修改 |

### 6.3 错误码定义

| 错误码 | 错误消息 | HTTP状态码 |
|--------|---------|------------|
| WORKORDER_NOT_FOUND | 工单不存在 | 404 |
| INVALID_STATE_TRANSITION | 非法状态流转 | 400 |
| DUPLICATE_TRANSITION | 重复状态提交 | 409 |
| APPROVAL_STEP_NOT_REACHABLE | 审批步骤不可达 | 400 |
| PERMISSION_DENIED | 权限不足 | 403 |
| REJECT_REASON_REQUIRED | 驳回原因必填 | 422 |
| REJECT_REASON_TOO_SHORT | 驳回原因最少10字符 | 422 |
| CONCURRENT_MODIFICATION | 并发修改冲突 | 409 |
| UNAUTHORIZED | 认证失败 | 401 |

### 6.4 通知事件类型

| 事件类型 | 触发时机 | 通知对象 |
|---------|---------|---------|
| WORKORDER_SUBMITTED | 工单提交审批 | 审批人 |
| WORKORDER_APPROVED | 工单审批通过 | 创建者 |
| WORKORDER_REJECTED | 工单被驳回 | 创建者 |
| WORKORDER_ARCHIVED | 工单已归档 | 创建者、审批人 |
| WORKORDER_TIMEOUT | 审批超时提醒 | 审批人 |

---

**文档结束**

*本规格文档为Iteration 1的完整技术指导，所有实现需严格遵循本文档定义的范围、边界和验收标准。*