# SWARM-502 资产报废退役流程 - 规格指导文档

**版本**: 1.0  
**迭代**: Iteration 1  
**状态**: Draft  
**创建日期**: 2024  

---

## 1. 需求与背景

### 1.1 业务背景

企业资产管理中，资产报废退役是重要的生命周期终结环节。传统模式下，资产报废依赖线下审批，存在以下问题：

- **审批流程不透明**：进度难以追踪，申请人无法实时了解当前审批节点
- **状态变更历史分散**：无法形成完整审计链，异常追溯困难
- **审批链责任界定不清**：多级审批节点配置不灵活，审批人规则硬编码
- **数据一致性风险**：状态变更与历史记录可能不同步，缺乏事务保障

### 1.2 功能需求

| 需求 ID | 描述 | 优先级 |
|---------|------|--------|
| REQ-502-01 | 用户可发起资产报废申请，包含资产选择、报废原因、预估残值等信息 | P0 |
| REQ-502-02 | 系统自动记录每次状态变更的时间、操作人、新旧状态 | P0 |
| REQ-502-03 | 支持审批链可视化展示，展示当前审批节点、待审批人、历史审批记录 | P0 |
| REQ-502-04 | 支持审批链配置化管理，可定义多级审批节点及审批人规则 | P1 |

### 1.3 关键业务规则

| 规则 ID | 描述 |
|---------|------|
| BR-502-01 | 资产报废申请提交后进入"待审批"状态 (PENDING_RETIREMENT) |
| BR-502-02 | 审批通过后资产状态变更为"已报废" (RETIRED) |
| BR-502-03 | 审批拒绝后可选择修改重新提交或终止流程 |
| BR-502-04 | 状态变更记录不可删除，仅可追加 |
| BR-502-05 | 状态变更与历史记录须在同一事务内完成 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解总览

| Phase | 范围 | 交付物 | 目标迭代 |
|-------|------|--------|----------|
| Phase 1 | 核心流程基础建设 | 报废申请表单、基础状态机、数据库模型 | Iteration 1 |
| Phase 2 | 审批链追踪功能 | 审批链配置、状态流转历史记录、API 接口 | Iteration 2 |
| Phase 3 | 前端交互与可视化 | 申请页面、审批进度展示、历史记录查看 | Iteration 2 |

### 2.2 本次迭代目标 (Iteration 1)

**Phase 1: 核心流程基础建设**

| 子任务 | 交付物 | 优先级 | 状态 |
|--------|--------|--------|------|
| SUB-502-01 | 资产报废申请表单模型定义 | P0 | 待开发 |
| SUB-502-02 | 资产状态枚举与初始状态机 | P0 | 待开发 |
| SUB-502-03 | 报废申请提交 API 实现 | P0 | 待开发 |
| SUB-502-04 | 状态流转历史记录表结构设计 | P1 | 待开发 |

**本次迭代不涵盖**：
- 审批链配置管理界面
- 多级审批逻辑实现
- 可视化审批流组件

---

## 3. 边界约束

### 3.1 功能边界

| 约束 ID | 描述 | 说明 |
|----------|------|------|
| SC-01 | 单次报废申请仅支持单条资产 | 不支持批量报废，后续迭代扩展 |
| SC-02 | 报废申请提交后不允许直接删除 | 仅可取消或被拒绝 |
| SC-03 | 状态流转历史仅记录状态变更 | 不记录字段级变更明细 |
| SC-04 | 本次迭代仅支持单级审批流程 | 多级审批在后续迭代实现 |

### 3.2 技术边界

| 约束 ID | 描述 |
|----------|------|
| TC-01 | 后端技术栈：Python/FastAPI + PostgreSQL |
| TC-02 | 前端技术栈：React + TypeScript + Ant Design |
| TC-03 | API 设计遵循 RESTful 规范，JSON 格式交互 |
| TC-04 | 数据库事务确保状态变更与历史记录原子性写入 |

### 3.3 数据边界

| 约束 ID | 描述 |
|----------|------|
| DC-01 | 资产主数据来源于外部系统，本次迭代不实现资产 CRUD |
| DC-02 | 用户认证信息来源于 SSO 系统，本迭代使用 mock 用户数据 |
| DC-03 | 审批人规则硬编码为申请人所属部门主管，后续迭代配置化 |

### 3.4 性能边界

| 约束 ID | 描述 |
|----------|------|
| PC-01 | API 响应时间 P95 < 500ms |
| PC-02 | 状态流转历史查询支持分页，单页最大 100 条 |

---

## 4. 验收测试基准 (ATB)

### 4.1 物理测试用例

#### TC-502-01: 报废申请提交

**测试文件**: `tests/api/test_retirement_api.py`

```python
class TestRetirementApplication:
    def test_submit_retirement_application_success(self, client, mock_asset):
        """
        Given: 存在一条可用状态的资产记录
        When:  用户提交报废申请（包含报废原因、预估残值）
        Then: 返回 201 状态码，申请记录创建成功
              资产状态变更为 PENDING_RETIREMENT
              返回申请单 ID
        """
        
    def test_submit_retirement_with_invalid_asset_id(self, client):
        """
        Given: 资产 ID 不存在
        When:  用户提交报废申请
        Then: 返回 404 状态码，错误信息 "Asset not found"
        """
        
    def test_submit_retirement_with_already_retired_asset(self, client, retired_asset):
        """
        Given: 资产状态已为 RETIRED
        When:  用户提交报废申请
        Then: 返回 400 状态码，错误信息 "Asset already retired"
        """
```

**期待结果**: 
```
pytest tests/api/test_retirement_api.py::TestRetirementApplication::test_submit_retirement_application_success -v
PASSED
```

---

#### TC-502-02: 状态流转历史记录

**测试文件**: `tests/api/test_status_history.py`

```python
class TestStatusHistory:
    def test_status_history_recorded_on_application(self, client, mock_asset):
        """
        Given: 资产状态为 AVAILABLE
        When:  用户提交报废申请
        Then: 状态流转历史表中存在 1 条记录
              from_status = AVAILABLE
              to_status = PENDING_RETIREMENT
              operator_id = 当前用户 ID
              created_at = 当前时间戳
        """
        
    def test_status_history_immutable(self, client, history_record):
        """
        Given: 存在一条状态流转历史记录
        When:  尝试更新或删除该记录
        Then: 数据库操作抛出异常或返回 403
              记录内容未改变
        """
```

**期待结果**:
```
pytest tests/api/test_status_history.py -v
PASSED
```

---

#### TC-502-03: 审批链追踪查询

**测试文件**: `tests/api/test_approval_api.py`

```python
class TestApprovalChain:
    def test_get_approval_chain_by_application_id(self, client, retirement_application):
        """
        Given: 存在一条报废申请记录
        When:  调用 GET /retirement/applications/{id}/approval-chain
        Then: 返回 200 状态码
              响应包含: current_node, approval_history, application_info
        """
        
    def test_approval_chain_structure(self, client, retirement_application):
        """
        Given: 存在一条报废申请记录
        When:  获取审批链详情
        Then: 响应结构符合 ApprovalChainSchema
        """
```

**期待结果**:
```
pytest tests/api/test_approval_api.py -v
PASSED
```

---

#### TC-502-04: E2E 报废申请流程

**测试文件**: `tests/e2e/retirement_user_journey.spec.ts`

```typescript
describe('Retirement User Journey', () => {
  it('AC-001: should complete retirement workflow', async ({ page }) => {
    // Step 1: 用户登录系统
    await loginUser(page, testCredentials);
    
    // Step 2: 进入资产报废申请页面
    await page.goto('/retirement/apply');
    
    // Step 3: 选择目标资产
    await page.selectAsset(mockAsset.id);
    
    // Step 4: 填写报废原因（字符长度 10-500）
    await page.fillReason('Test retirement reason for asset');
    
    // Step 5: 填写预估残值（数值 >= 0）
    await page.fillResidualValue('1000');
    
    // Step 6: 点击提交按钮
    await page.clickSubmit();
    
    // Step 7: 页面显示申请成功提示
    await expect(page.locator('.success-message')).toBeVisible();
    
    // Step 8: 跳转至审批链追踪页面
    await expect(page).toHaveURL(/\/retirement\/.*\/approval-chain/);
    
    // Step 9: 审批链页面展示当前状态为"待审批"
    await expect(page.locator('.status-badge')).toHaveText('待审批');
    
    // Step 10: 审批链页面展示申请人信息正确
    await expect(page.locator('.applicant-name')).toHaveText('Test User');
  });
});
```

**期待结果**:
```
playwright test tests/e2e/retirement_user_journey.spec.ts --project=chromium
PASSED
```

---

### 4.2 ATB 覆盖率矩阵

| 功能点 | API 测试 | 单元测试 | E2E 测试 | 覆盖状态 |
|--------|----------|----------|----------|----------|
| 报废申请提交 | TC-502-01 ✓ | ✓ | ✓ | ✓ 已覆盖 |
| 状态流转历史记录 | TC-502-02 ✓ | ✓ | - | ✓ 已覆盖 |
| 审批链追踪查询 | TC-502-03 ✓ | ✓ | ✓ | ✓ 已覆盖 |
| 报废审批通过 | TC-502-04 ✓ | - | ✓ | ✓ 已覆盖 |

---

## 5. 开发切入层级序列

### 5.1 层级依赖关系

```
[Layer 0: Database Schema]          ← 底层基础设施
         ↓
[Layer 1: Domain Models & Enums]   ← 领域实体定义
         ↓
[Layer 2: Repository Layer]        ← 数据访问层
         ↓
[Layer 3: Service Layer]            ← 业务逻辑层
         ↓
[Layer 4: API Endpoints]            ← 接口层
         ↓
[Layer 5: Frontend Components]      ← 前端展示层
```

### 5.2 开发任务序列

#### Phase 1.1: 数据库层 (Day 1)

| 任务 ID | 任务描述 | 产出物 | 前置依赖 |
|---------|----------|--------|----------|
| DEV-502-11 | 设计并创建 `retirement_applications` 表 | DDL 脚本 | - |
| DEV-502-12 | 设计并创建 `retirement_status_history` 表 | DDL 脚本 | - |
| DEV-502-13 | 设计并创建 `approval_chain_nodes` 表 | DDL 脚本 | - |
| DEV-502-14 | 执行数据库迁移 | 迁移记录 | DEV-502-11~13 |

**验收标准**: `pytest tests/db/test_migrations.py -v` 通过

---

#### Phase 1.2: 领域模型层 (Day 2)

| 任务 ID | 任务描述 | 产出物 | 前置依赖 |
|---------|----------|--------|----------|
| DEV-502-21 | 定义 AssetStatus 枚举 | `src/models/enums.py` | - |
| DEV-502-22 | 定义 RetirementApplication 模型 | `src/models/asset_retirement.py` | DEV-502-11 |
| DEV-502-23 | 定义 StatusHistory 模型 | `src/models/retirement_history.py` | DEV-502-12 |
| DEV-502-24 | 定义 ApprovalChain 模型 | `src/models/approval_chain.py` | DEV-502-13 |

**验收标准**: `pytest tests/unit/test_domain_models.py -v` 通过

---

#### Phase 1.3: 仓储层 (Day 2-3)

| 任务 ID | 任务描述 | 产出物 | 前置依赖 |
|---------|----------|--------|----------|
| DEV-502-31 | 实现 RetirementApplicationRepository | `src/repositories/retirement_repository.py` | DEV-502-22 |
| DEV-502-32 | 实现 StatusHistoryRepository | `src/repositories/retirement_repository.py` | DEV-502-23 |
| DEV-502-33 | 编写 Repository 层单元测试 | `tests/unit/test_repositories.py` | DEV-502-31~32 |

**验收标准**: `pytest tests/unit/test_repositories.py -v` 通过

---

#### Phase 1.4: 服务层 (Day 3-4)

| 任务 ID | 任务描述 | 产出物 | 前置依赖 |
|---------|----------|--------|----------|
| DEV-502-41 | 实现 RetirementService.submit_application() | `src/services/retirement_service.py` | DEV-502-31~32 |
| DEV-502-42 | 实现状态机自动记录逻辑（事务内） | `src/state_machine/retirement_state_machine.py` | DEV-502-41 |
| DEV-502-43 | 实现 ApprovalChainService.get_chain() | `src/services/approval_chain_service.py` | DEV-502-23 |
| DEV-502-44 | 编写 Service 层单元测试 | `tests/unit/test_services.py` | DEV-502-41~43 |

**验收标准**: `pytest tests/unit/test_services.py -v` 通过

---

#### Phase 1.5: API 层 (Day 4-5)

| 任务 ID | 任务描述 | 产出物 | 前置依赖 |
|---------|----------|--------|----------|
| DEV-502-51 | 实现 POST /api/v1/retirement/applications | `src/api/routers/retirement_router.py` | DEV-502-41 |
| DEV-502-52 | 实现 GET /api/v1/retirement/applications/{id}/approval-chain | `src/api/routers/retirement_router.py` | DEV-502-43 |
| DEV-502-53 | 实现 GET /api/v1/retirement/applications/{id}/history | `src/api/routers/retirement_router.py` | DEV-502-32 |
| DEV-502-54 | API 层集成测试 | `tests/api/test_retirement_api.py` | DEV-502-51~53 |

**验收标准**: `pytest tests/api/ -v` 通过

---

#### Phase 1.6: 前端层 (Day 5-6)

| 任务 ID | 任务描述 | 产出物 | 前置依赖 |
|---------|----------|--------|----------|
| DEV-502-61 | 实现报废申请表单组件 | `frontend/src/app/components/RetirementForm.tsx` | DEV-502-51 |
| DEV-502-62 | 实现审批链追踪展示组件 | `frontend/src/app/components/ApprovalChain.tsx` | DEV-502-52 |
| DEV-502-63 | 实现申请提交成功跳转逻辑 | `frontend/src/app/pages/RetirementApply.tsx` | DEV-502-61 |
| DEV-502-64 | E2E 测试覆盖 | `tests/e2e/retirement_user_journey.spec.ts` | DEV-502-61~63 |

**验收标准**: `playwright test tests/e2e/retirement_user_journey.spec.ts` 通过

---

### 5.3 里程碑检查点

| 检查点 | 触发条件 | 通过标准 | 负责人 |
|--------|----------|----------|--------|
| CP-1 | Phase 1.3 完成后 | 数据库操作测试 100% 通过 | Backend Dev |
| CP-2 | Phase 1.4 完成后 | 业务逻辑测试覆盖率 > 80% | Backend Dev |
| CP-3 | Phase 1.5 完成后 | API 测试 100% 通过，P95 < 500ms | Backend Dev |
| CP-4 | Phase 1.6 完成后 | E2E 流程测试通过率 100% | Frontend Dev |

---

## 6. 附录

### 6.1 状态枚举定义

```python
class AssetStatus(str, Enum):
    """资产状态枚举"""
    AVAILABLE = "AVAILABLE"               # 可用
    PENDING_RETIREMENT = "PENDING_RETIREMENT"  # 待审批报废
    RETIRED = "RETIRED"                   # 已报废


class ApprovalResult(str, Enum):
    """审批结果枚举"""
    PENDING = "PENDING"       # 待审批
    APPROVED = "APPROVED"     # 已批准
    REJECTED = "REJECTED"     # 已拒绝
```

### 6.2 数据模型 ERD 概览

```
┌─────────────────────────────────┐      ┌──────────────────────────────────────┐
│    retirement_applications       │      │     retirement_status_history        │
├─────────────────────────────────┤      ├──────────────────────────────────────┤
│ id (PK, UUID)                   │──┐   │ id (PK, UUID)                        │
│ asset_id (FK)                   │  │   │ application_id (FK)                 │─┐
│ applicant_id                    │  │   │ from_status                          │ │
│ reason                          │  │   │ to_status                            │ │
│ estimated_residual_value        │  │   │ operator_id                          │ │
│ status                          │  │   │ created_at                          │ │
│ created_at                      │  │   └──────────────────────────────────────┘ │
│ updated_at                      │  │                                                  │
└─────────────────────────────────┘  │   ┌──────────────────────────────────────┐ │
                                    │   │       approval_chain_nodes           │ │
                                    │   ├──────────────────────────────────────┤ │
                                    │   │ id (PK, UUID)                        │ │
                                    │   │ application_id (FK)                  │─┤
                                    │   │ node_name                            │ │
                                    └────│ approver_id                         │ │
                                         │ result                              │ │
                                         │ comment                             │ │
                                         │ acted_at                            │ │
                                         └──────────────────────────────────────┘
```

### 6.3 修改文件清单

| 文件路径 | 修改说明 | 关联任务 |
|----------|----------|----------|
| `src/main.py` | 添加 RetirementRouter 路由注册 | DEV-502-51 |
| `src/application/commands/approve_work_order.py` | 集成 RetirementService 调用 | DEV-502-41 |
| `src/application/services/notification_service.py` | 添加报废审批通知逻辑 | DEV-502-42 |
| `frontend/src/app/types/retirement.types.ts` | 定义 RetirementType 类型 | DEV-502-22 |
| `tests/e2e/retirement_user_journey.spec.ts` | E2E 测试覆盖 | DEV-502-64 |

### 6.4 API 接口规范

#### POST /api/v1/retirement/applications

**Request Body**:
```json
{
  "asset_id": "uuid",
  "reason": "string (10-500 chars)",
  "estimated_residual_value": "number (>= 0)"
}
```

**Response** (201):
```json
{
  "id": "uuid",
  "asset_id": "uuid",
  "status": "PENDING_RETIREMENT",
  "created_at": "datetime"
}
```

#### GET /api/v1/retirement/applications/{id}/approval-chain

**Response** (200):
```json
{
  "application_id": "uuid",
  "current_status": "PENDING_RETIREMENT",
  "current_node": {
    "node_name": "部门主管审批",
    "approver_id": "uuid",
    "approver_name": "string",
    "expected_at": "datetime"
  },
  "approval_history": [
    {
      "node_name": "string",
      "approver_id": "uuid",
      "result": "PENDING|APPROVED|REJECTED",
      "comment": "string|null",
      "acted_at": "datetime|null"
    }
  ]
}
```

---

**文档结束**

*本文档由规格执行工程师编制，用于指导 SWARM-502 资产报废退役流程 Iteration 1 的开发工作*