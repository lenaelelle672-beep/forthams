# SWARM-WO-002 资产报废流程规格指导文档

## 1. 需求与背景

### 1.1 业务场景

资产报废流程是企业固定资产管理的核心环节。当资产因损坏、老化、技术淘汰或自然灾害等原因无法继续使用时，需通过规范化流程完成资产报废审批，确保资产管理闭环。

### 1.2 核心诉求

| 角色 | 诉求 |
|------|------|
| 资产管理员 | 发起报废申请，追踪审批进度，查看报废历史 |
| 部门主管 | 审批本部门资产报废请求 |
| 财务/高层 | 最终审批重要资产报废，审核残值回收 |
| 审计人员 | 追溯报废记录，合规性审查 |

### 1.3 关键实体

| 实体 | 说明 |
|------|------|
| RetirementRequest | 报废申请表，存储报废申请基本信息 |
| RetirementHistory | 报废历史记录，不可变日志 |
| ApprovalChain | 审批链定义 |
| ApprovalStage | 审批节点记录 |
| AssetRetirementStatus | 状态枚举定义 |

---

## 2. 当前 Phase 对应实施目标

**参照 Plan.md Phase 拆解**：

| Phase | 范围 | 本次 Spec 覆盖 |
|-------|------|----------------|
| Phase 1 | 基础数据模型与 CRUD | RetirementRequest 表结构定义 |
| Phase 2 | 工作流引擎集成 | 报废审批链状态机实现 |
| Phase 3 | 前端交互界面 | 报废申请表单与状态追踪页面 |
| Phase 4 | 通知与日志 | 审批节点通知触发 |

**本次迭代目标**：完成 Phase 1-3 的端到端实现，实现报废申请发起 → 审批流转 → 记录归档的完整链路。

---

## 3. 边界约束

### 3.1 技术栈约束

```
前端: Vue 3 + Element Plus + Pinia + Playwright
后端: Python FastAPI + SQLAlchemy + PostgreSQL + Pydantic
状态机: 自定义 FSM (states.py + transitions.py)
```

### 3.2 功能边界

```
✓ 允许: 发起报废申请、审批通过/驳回、状态查询、历史记录
✗ 禁止: 跨系统资产同步、自动残值评估（Phase 5）
✗ 禁止: 批量报废审批（本期单条处理）
```

### 3.3 数据边界

```
报废单状态枚举: initiated → approved/rejected/cancelled → archived
每张报废单关联: 1个资产 + N个审批节点
```

### 3.4 审批层级约束

```
L1: 部门主管审批（残值 < 10,000）
L2: 财务总监审批（残值 >= 10,000）
```

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 报废申请表单功能

| 测试编号 | 测试描述 | 输入 | 期待结果 | 测试工具 |
|----------|----------|------|----------|----------|
| ATB-1.1 | 正常提交报废申请 | asset_id=AST001, reason=设备老化, residual_value=500 | 返回 retirement_id, status=initiated | pytest |
| ATB-1.2 | 提交不含必填项 | 缺失报废原因 | HTTP 422, 字段校验错误提示 | pytest |
| ATB-1.3 | 提交已报废资产 | asset_id=AST001(status=RETIRED) | HTTP 400, 资产状态不允许报废 | pytest |
| ATB-1.4 | 前端表单渲染 | 访问 /asset/retirement/apply | 页面加载, 表单字段完整展示 | Playwright |

**pytest 伪代码**:
```python
def test_submit_retirement_application():
    """ATB-1.1: 正常提交报废申请"""
    response = client.post("/api/v1/retirement", json={
        "asset_id": "AST001",
        "reason": "设备老化",
        "residual_value": 500.00,
        "description": "使用年限超过10年"
    })
    assert response.status_code == 201
    assert response.json()["status"] == "initiated"
    assert "retirement_id" in response.json()
```

### 4.2 ATB-2: 审批链状态流转

| 测试编号 | 测试描述 | 输入操作 | 期待状态变更 | 测试工具 |
|----------|----------|----------|--------------|----------|
| ATB-2.1 | 申请人提交草稿 | PUT /retirement/{id}/submit | draft → initiated | pytest |
| ATB-2.2 | 部门主管审批通过 | PUT /retirement/{id}/approve | initiated → approved | pytest |
| ATB-2.3 | 部门主管驳回申请 | PUT /retirement/{id}/reject | initiated → rejected | pytest |
| ATB-2.4 | 非法状态转换 | 对已归档单据审批 | HTTP 400, 状态不允许操作 | pytest |
| ATB-2.5 | 审批后资产状态更新 | 审批通过 | 关联资产状态→RETIRED | pytest + DB验证 |

**状态机规则验证**:
```python
def test_valid_state_transition():
    """ATB-2.1-2.3: 有效转换链验证"""
    record = create_retirement_record()
    assert record.status == "draft"
    
    record.submit()
    assert record.status == "initiated"
    
    record.approve()
    assert record.status == "approved"
    assert get_asset(record.asset_id).status == "RETIRED"
```

### 4.3 ATB-3: 报废历史记录查询

| 测试编号 | 测试描述 | 查询条件 | 期待结果 | 测试工具 |
|----------|----------|----------|----------|----------|
| ATB-3.1 | 按资产ID查询 | asset_id=AST001 | 返回该资产所有报废记录 | pytest |
| ATB-3.2 | 按申请人查询 | applicant_id=USER001 | 返回该用户所有申请 | pytest |
| ATB-3.3 | 按状态筛选 | status=approved | 仅返回已批准记录 | pytest |
| ATB-3.4 | 分页查询 | page=2, page_size=10 | 返回第11-20条记录 | pytest |
| ATB-3.5 | 前端历史列表 | 访问 /retirement/history | 表格展示分页数据 | Playwright |

### 4.4 ATB-4: 审批链完整性

| 测试编号 | 测试描述 | 输入 | 期待结果 | 测试工具 |
|----------|----------|------|----------|----------|
| ATB-4.1 | 两级审批链执行 | 提交→L1审批→L2审批 | 状态按序流转, 记录审批人 | pytest |
| ATB-4.2 | 跳过审批节点 | 尝试从initiated直接approved | HTTP 400, 必须按链路审批 | pytest |
| ATB-4.3 | 审批人权限校验 | 非审批人执行approve | HTTP 403, 权限不足 | pytest |

---

## 5. 开发切入层级序列

### Layer 1: 数据库层（Day 1）

```
1.1 创建 RetirementRequest 模型
    - retirement_id (PK, UUID)
    - asset_id (FK → Asset.asset_id)
    - applicant_id (FK → User.user_id)
    - reason (VARCHAR 500)
    - residual_value (DECIMAL 12,2)
    - status (ENUM: draft/initiated/approved/rejected/cancelled/archived)
    - created_at, updated_at (TIMESTAMP)
    - approved_at, approver_id (NULLABLE)

1.2 创建 RetirementHistory 表（审批链路日志）
    - history_id (PK)
    - retirement_id (FK)
    - approver_id (FK)
    - action (ENUM: SUBMIT/APPROVE/REJECT)
    - comment (TEXT, NULLABLE)
    - action_at (TIMESTAMP)
```

### Layer 2: 服务层（Day 2-3）

```
2.1 RetirementService
    - create_retirement(application_data) → RetirementRequest
    - submit_for_approval(retirement_id) → bool
    - approve(retirement_id, approver_id, comment) → bool
    - reject(retirement_id, approver_id, comment) → bool
    - archive(retirement_id) → bool
    - get_retirement_history(filters, pagination) → List[RetirementRequest]

2.2 RetirementStateMachine
    - 定义状态转换规则
    - 校验转换合法性
    - 触发状态钩子（如资产状态变更）
```

### Layer 3: API 层（Day 3-4）

```
POST   /api/v1/retirement           # 创建报废申请
GET    /api/v1/retirement/{id}      # 查询单条记录
GET    /api/v1/retirement/history   # 查询历史（支持分页/筛选）
PUT    /api/v1/retirement/{id}/submit   # 提交审批
PUT    /api/v1/retirement/{id}/approve  # 审批通过
PUT    /api/v1/retirement/{id}/reject   # 审批驳回
```

### Layer 4: 前端页面（Day 4-6）

```
4.1 报废申请页 /retirement/apply
    - 资产选择器（仅显示在用资产）
    - 报废原因输入框
    - 残值预估输入
    - 附件上传（支持PDF/图片）
    - 提交/保存草稿按钮

4.2 审批待办页 /retirement/pending
    - 待审批列表
    - 快捷审批操作（通过/驳回）

4.3 报废历史页 /retirement/history
    - 筛选栏（日期范围/状态/资产/申请人）
    - 数据表格（分页）
    - 详情查看抽屉

4.4 报废单详情页 /retirement/{id}
    - 完整信息展示
    - 审批流程时间线
    - 操作按钮（根据状态动态渲染）
```

### Layer 5: 集成验证（Day 7）

```
5.1 端到端流程测试
    - 完整模拟：申请→提交→L1审批→L2审批→归档

5.2 异常场景测试
    - 网络中断恢复
    - 并发审批冲突
    - 资产状态一致性校验
```

---

## 6. 附录：数据模型

### 6.1 RetirementRequest ERD

```
┌─────────────────────────────────────────────────────────┐
│                   RetirementRequest                      │
├─────────────────────────────────────────────────────────┤
│ retirement_id    UUID (PK)                              │
│ asset_id         UUID (FK → Asset)                      │
│ applicant_id    UUID (FK → User)                       │
│ reason           VARCHAR(500) NOT NULL                   │
│ residual_value  DECIMAL(12,2) DEFAULT 0                 │
│ description      TEXT                                    │
│ status           ENUM('draft','initiated','approved',    │
│                     'rejected','cancelled','archived')   │
│ created_at       TIMESTAMP                               │
│ updated_at       TIMESTAMP                               │
│ approved_at      TIMESTAMP (NULLABLE)                   │
│ archived_at      TIMESTAMP (NULLABLE)                   │
└─────────────────────────────────────────────────────────┘
                           │
                           │ 1:N
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    RetirementHistory                     │
├─────────────────────────────────────────────────────────┤
│ history_id       SERIAL (PK)                            │
│ retirement_id    UUID (FK)                              │
│ approver_id      UUID (FK → User)                       │
│ action           ENUM('SUBMIT','APPROVE','REJECT')      │
│ comment          TEXT (NULLABLE)                        │
│ action_at        TIMESTAMP                               │
└─────────────────────────────────────────────────────────┘
```

### 6.2 AssetRetirementStatus 枚举

```python
class AssetRetirementStatus(str, Enum):
    """资产报废状态枚举"""
    DRAFT = "draft"                    # 草稿
    INITIATED = "initiated"            # 已提交待审批
    APPROVED = "approved"              # 已批准
    REJECTED = "rejected"              # 已驳回
    CANCELLED = "cancelled"            # 已取消
    ARCHIVED = "archived"              # 已归档
```

### 6.3 状态流转图

```
     ┌──────────┐
     │  DRAFT   │◄─────────────┐
     └────┬─────┘              │
          │ submit            │ cancel
          ▼                   │
  ┌───────────────┐            │
  │  INITIATED    │────────────┘
  └───────┬───────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌─────────┐ ┌──────────┐
│APPROVED │ │ REJECTED │
└────┬────┘ └──────────┘
     │
     ▼
┌──────────┐
│ ARCHIVED │
└──────────┘
```