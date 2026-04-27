# SWARM-002 资产报废/退役流程 规格指导文档

> **版本**: v1.0  
> **创建日期**: 2025-01-25  
> **迭代周期**: Iteration 1 / Phase 1-2

---

## 1. 需求与背景

### 1.1 业务场景

资产在生命周期终结时需退出在役状态，传统流程依赖人工操作，存在以下问题：

| 问题维度 | 具体表现 | 影响 |
|----------|----------|------|
| 流程透明度 | 审批状态不透明，难以追踪当前节点 | 业务效率低 |
| 数据一致性 | 状态变更无自动校验 | 数据不一致 |
| 审计追溯 | 历史记录分散于多系统 | 合规风险 |

### 1.2 核心功能需求

本规格覆盖以下四个核心功能：

1. **报废申请发起 (ATB-1)**
   - 用户对指定资产提交报废/退役申请
   - 支持原因代码选择、预估残值设置、附件上传
   - API 端点: `POST /api/v1/assets/{id}/retire`

2. **状态自动流转 (ATB-2)**
   - 系统根据预设规则驱动资产状态转换
   - 状态枚举: `ACTIVE` → `PENDING_RETIREMENT` → `RETIRED`
   - 使用乐观锁 (`version` 字段) 防止竞态写入

3. **审批链控制 (ATB-3)**
   - 基于资产类别/金额阈值的分级审批流
   - 支持驳回、加签、转交操作
   - 审批规则由 `config/approval_rules.json` 驱动

4. **历史归档 (ATB-4)**
   - 所有状态变更事件写入 `retirement_history` 表
   - Append-only 模式，禁止 UPDATE/DELETE
   - 支持审计导出 (CSV 格式)

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解对齐表

| Phase | 描述 | SWARM-002 本次覆盖范围 |
|-------|------|------------------------|
| **Phase 1** | 基础状态机与 API 端点 | ✅ 实现状态枚举、流转引擎、`/api/v1/assets/{id}/retire` 端点 |
| **Phase 2** | 审批流引擎集成 | ✅ 实现分级审批链、驳回/加签、历史记录写入 |
| **Phase 3** | 前端 UI 与用户交互 | 🔲 延期至下个 Iteration |
| **Phase 4** | 审计与报告导出 | 🔲 延期至下个 Iteration |

### 2.2 本次 Iteration 目标 (Iteration 1)

> **范围边界**: 仅完成后端 API 与核心业务逻辑，交付可通过 pytest 验证的 RESTful 接口。

**交付物清单**:

| # | 文件路径 | 变更类型 | 核心职责 |
|---|---------|----------|----------|
| 1 | `src/application/commands/reject_retirement.py` | 新建 | 驳回退役申请命令处理 |
| 2 | `src/domain/entities/retirement_request.py` | 新建 | 退役申请实体定义 |
| 3 | `src/domain/state_machine/retirement_state_machine.py` | 新建 | 状态机引擎 |
| 4 | `src/infrastructure/database/migrations/003_add_retirement_fields.py` | 新建 | 数据库迁移 |
| 5 | `tests/api/test_retirement_api.py` | 新建 | ATB 集成测试 |

---

## 3. 边界约束

### 3.1 功能边界

| 约束维度 | 具体限制 | 违反时行为 |
|----------|----------|------------|
| **适用资产类型** | 仅支持 `fixed_asset`（固定资产） | 返回 422 + `UNSUPPORTED_ASSET_TYPE` |
| **状态互斥** | 已 `RETIRED`/`DISPOSED` 状态不可再次申请 | 返回 409 + `RETIREMENT_ALREADY_EXISTS` |
| **审批前置阈值** | 金额 > 50,000 CNY 需二级审批 | 自动增加审批步骤 |
| **残值下限** | 不允许预估残值为负数 | 返回 422 + `NEGATIVE_RESIDUAL_VALUE` |
| **撤销窗口** | 仅 `PENDING_RETIREMENT` 状态且审批未开始时可撤销 | 返回 403 + `REVOKE_NOT_ALLOWED` |
| **并发控制** | 乐观锁 `version` 字段 | 冲突时返回 409 + `VERSION_CONFLICT` |

### 3.2 技术边界

| 边界项 | 约束说明 |
|--------|----------|
| **API 协议** | 仅 REST API (GraphQL/gRPC 本期不支持) |
| **配置驱动** | 审批规则存储于 `config/approval_rules.json` |
| **事务边界** | 状态流转与历史写入必须在同一事务内完成 |
| **历史表模式** | Append-only，禁止 UPDATE/DELETE |

### 3.3 已知限制 (Out of Scope)

- ❌ 不支持批量报废申请
- ❌ 不支持移动端离线审批
- ❌ 不集成财务系统凭证自动生成
- ❌ 无形资产/租金资产暂不支持

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 报废申请创建

**测试文件**: `tests/api/test_asset_retirement.py::TestRetirementApplication`

| 编号 | 测试用例 | 物理测试期待 (pytest) | 预期结果 |
|------|----------|---------------------|----------|
| ATB-1.1 | 正常资产提交报废申请 | `POST /api/v1/assets/{valid_asset_id}/retire` | 返回 201 + `application_id` |
| ATB-1.2 | 已退役资产重复申请 | `POST /api/v1/assets/{retired_asset_id}/retire` | 返回 409 Conflict |
| ATB-1.3 | 不存在的资产 ID | `POST /api/v1/assets/99999/retire` | 返回 404 |
| ATB-1.4 | 残值为负 | payload 含 `estimated_residual_value: -100` | 返回 422 Validation Error |
| ATB-1.5 | 缺少必填字段 reason_code | payload 省略 `reason_code` | 返回 422 + "reason_code is required" |

### 4.2 ATB-2: 状态自动流转

**测试文件**: `tests/domain/test_retirement_state_machine.py::TestStateTransitions`

| 编号 | 测试用例 | 物理测试期待 (pytest) | 预期结果 |
|------|----------|---------------------|----------|
| ATB-2.1 | 申请创建后状态变为 PENDING | 查询资产 `retirement_status` 字段 | 值 = `PENDING_RETIREMENT` |
| ATB-2.2 | 审批通过后状态变为 RETIRED | `POST .../approve` | 状态流转至 `RETIRED` |
| ATB-2.3 | 审批驳回后状态回滚 ACTIVE | `POST .../reject` | 状态恢复为 `ACTIVE` |
| ATB-2.4 | 非法流转 ACTIVE→RETIRED | 直接调用内部流转方法 | 抛出 `InvalidStateTransitionError` |
| ATB-2.5 | 并发申请同一资产 | 两个并发 POST 请求 | 仅一个成功，另一个返回 409 |

### 4.3 ATB-3: 审批链控制

**测试文件**: `tests/approval/test_approval_chain.py::TestApprovalChain`

| 编号 | 测试用例 | 物理测试期待 (pytest) | 预期结果 |
|------|----------|---------------------|----------|
| ATB-3.1 | 金额 ≤50k 走一级审批 | `approval_steps_required` | 值为 1 |
| ATB-3.2 | 金额 >50k 走二级审批 | payload 含 `asset_value: 80000` | `approval_steps_required` = 2 |
| ATB-3.3 | 第一审批人未通过时阻止第二级 | `POST step-2/approve` | 返回 403 |
| ATB-3.4 | 审批人被加签 | `POST .../delegate` | 审批人字段更新 |
| ATB-3.5 | 配置文件加载异常 | mock `approval_rules.json` 读取失败 | 返回 500 + 回滚事务 |

### 4.4 ATB-4: 历史记录归档

**测试文件**: `tests/persistence/test_retirement_history.py::TestHistoryArchive`

| 编号 | 测试用例 | 物理测试期待 (pytest) | 预期结果 |
|------|----------|---------------------|----------|
| ATB-4.1 | 申请创建时写入历史 | 查询 `retirement_history` 表 | 存在 `EVENT_TYPE='APPLICATION_CREATED'` 记录 |
| ATB-4.2 | 审批通过时写入历史 | 查询历史表 | 存在 `EVENT_TYPE='RETIREMENT_APPROVED'` 记录 |
| ATB-4.3 | 历史记录不可修改 | 对历史表执行 UPDATE | 数据库层报错或 ORM 过滤 |
| ATB-4.4 | 审计导出 CSV | `GET /api/v1/audit/retirement-history` | 返回合规 CSV |
| ATB-4.5 | 时间范围筛选 | `?start_date=2024-01-01&end_date=2024-12-31` | 仅返回该区间内记录 |

---

## 5. 开发切入层级序列

### 5.1 Layer 1: 数据模型与持久化 (Day 1-2)

```
src/
├── domain/
│   ├── entities/
│   │   ├── asset.py                    # 新增 retirement_status 字段
│   │   ├── retirement_request.py       # 退役申请实体
│   │   └── retirement_history.py       # 历史记录实体
│   └── value_objects/
│       └── approval_rule.py            # 审批规则值对象
├── infrastructure/
│   ├── database/
│   │   ├── repositories/
│   │   │   ├── asset_repository.py
│   │   │   └── retirement_application_repository.py
│   │   └── migrations/
│   │       └── 003_add_retirement_fields.py
```

**关键任务**:
- [ ] 数据库迁移脚本添加 `retirement_status` (ENUM)、`version` (乐观锁)
- [ ] 创建 `retirement_applications` 表
- [ ] 创建 `retirement_history` 表 (append-only + 防修改触发器)

### 5.2 Layer 2: 核心业务逻辑 (Day 3-5)

```
src/
├── domain/
│   ├── state_machine/
│   │   └── retirement_state_machine.py   # 状态机引擎
│   └── services/
│       └── retirement_service.py         # 应用服务编排
├── application/
│   └── commands/
│       ├── create_retirement_application.py
│       ├── approve_retirement_step.py
│       ├── reject_retirement.py          # ⭐ 本次核心实现
│       └── delegate_approval.py
```

**关键任务**:
- [ ] 实现 `RetirementStateMachine` 状态流转规则校验
- [ ] 实现 `RetirementService` 命令处理，含事务边界控制
- [ ] 审批流规则 JSON Schema 定义

### 5.3 Layer 3: API 层 (Day 6-8)

```
src/
├── api/
│   ├── routes/
│   │   └── retirement_routes.py
│   ├── schemas/
│   │   ├── retirement_request.py       # Pydantic Request Schemas
│   │   └── retirement_response.py      # Pydantic Response Schemas
│   └── middleware/
│       └── idempotency_check.py        # 幂等性中间件
```

**关键任务**:
- [ ] `POST /api/v1/assets/{id}/retire` - 创建报废申请
- [ ] `GET /api/v1/retirement-applications/{id}` - 查询申请详情
- [ ] `POST /api/v1/retirement-applications/{id}/approve` - 审批通过
- [ ] `POST /api/v1/retirement-applications/{id}/reject` - 审批驳回 ⭐
- [ ] `POST /api/v1/retirement-applications/{id}/delegate` - 加签
- [ ] `GET /api/v1/audit/retirement-history` - 审计导出

### 5.4 Layer 4: 集成验证 (Day 9-10)

**关键任务**:
- [ ] 使用 `pytest` + `pytest-asyncio` 执行全部 ATB 测试用例
- [ ] 使用 `playwright` 编写 E2E smoke test
- [ ] 性能基准: 单资产报废流程 < 500ms (p95)

### 5.5 依赖关系图

```
[Layer 1: DB Schema/Migrations]
            ↓
[Layer 2: Domain Logic + State Machine]
            ↓
[Layer 3: API Endpoints]
            ↓
[Layer 4: Integration Tests (pytest) + E2E (playwright)]
```

---

## 附录

### A. 状态枚举定义

```python
class AssetRetirementStatus(str, Enum):
    """资产退役状态枚举"""
    
    ACTIVE = "ACTIVE"
    """资产处于正常在役状态"""
    
    PENDING_RETIREMENT = "PENDING_RETIREMENT"
    """退役申请已提交，等待审批"""
    
    RETIRED = "RETIRED"
    """退役审批通过，资产已退役"""
    
    DISPOSED = "DISPOSED"
    """资产已完成处置"""
```

### B. 审批规则配置示例

```json
{
  "retirement": {
    "tier_thresholds": {
      "1": 50000,
      "2": null
    },
    "allowed_reason_codes": [
      "DAMAGED",
      "OBSOLETE",
      "END_OF_LIFE",
      "DISMANTLED"
    ],
    "history_retention_days": 2555
  }
}
```

### C. 错误码规范

| HTTP Status | 错误码 | 含义 |
|-------------|--------|------|
| 404 | `ASSET_NOT_FOUND` | 资产不存在 |
| 409 | `RETIREMENT_ALREADY_INITIATED` | 退役流程已存在 |
| 409 | `VERSION_CONFLICT` | 乐观锁版本冲突 |
| 422 | `INVALID_STATE_TRANSITION` | 非法状态流转 |
| 422 | `NEGATIVE_RESIDUAL_VALUE` | 残值不能为负 |
| 422 | `UNSUPPORTED_ASSET_TYPE` | 不支持的资产类型 |
| 403 | `APPROVAL_STEP_NOT_REACHABLE` | 当前步骤不可达 |
| 403 | `REVOKE_NOT_ALLOWED` | 不允许撤销 |

### D. 事件类型枚举

```python
class RetirementEventType(str, Enum):
    """退役流程事件类型"""
    
    APPLICATION_CREATED = "APPLICATION_CREATED"
    APPROVAL_STEP_STARTED = "APPROVAL_STEP_STARTED"
    APPROVAL_STEP_COMPLETED = "APPROVAL_STEP_COMPLETED"
    RETIREMENT_APPROVED = "RETIREMENT_APPROVED"
    RETIREMENT_REJECTED = "RETIREMENT_REJECTED"
    RETIREMENT_REVOKED = "RETIREMENT_REVOKED"
    DELEGATION_OCCURRED = "DELEGATION_OCCURRED"
```

---

## 修订历史

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2025-01-25 | 初始版本创建 | SWARM Team |