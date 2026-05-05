# SWARM-002 资产报废退役流程 - 规格指导文档

**版本**: v1.0  
**Task ID**: SWARM-002  
**Iteration**: 1  
**状态**: 规格评审中  
**最后更新**: 2024-01-15

---

## 目录

1. [需求与背景](#1-需求与背景)
2. [当前 Phase 对应实施目标](#2-当前-phase-对应实施目标)
3. [边界约束](#3-边界约束)
4. [验收测试基准-atb](#4-验收测试基准-atb)
5. [开发切入层级序列](#5-开发切入层级序列)
6. [API 规范摘要](#6-api-规范摘要)
7. [状态机定义](#7-状态机定义)
8. [附录](#8-附录)

---

## 1. 需求与背景

### 1.1 业务场景

资产管理生命周期中，资产从采购入库开始经历使用、维护、最终面临报废或退役处置。当前系统缺失资产报废退役的标准化流程，导致以下问题：

| 问题 | 影响 |
|------|------|
| 报废缺乏统一审批机制 | 资产处置随意，无法追溯 |
| 报废状态不可追溯 | 审批历史缺失，责任不清 |
| 历史资产数据无法闭环管理 | 资产账实不符 |

### 1.2 核心需求

| 需求项 | 描述 | 优先级 |
|--------|------|--------|
| RQ-001 | 用户可提交资产报废申请，关联目标资产及报废原因 | P0 |
| RQ-002 | 报废申请按审批链自动路由至责任人 | P0 |
| RQ-003 | 审批人可批准或驳回报废申请 | P0 |
| RQ-004 | 用户可实时跟踪报废申请的审批进度 | P1 |
| RQ-005 | 审批完成后资产状态自动流转至"已报废" | P0 |

### 1.3 关键实体

```
Asset (资产)
├── id: Long
├── assetCode: String (唯一编码)
├── name: String
├── status: AssetStatus
└── ... (现有字段)

RetirementRequest (报废申请)
├── id: Long
├── assetId: Long (FK -> Asset)
├── applicantId: Long (FK -> User)
├── reason: RetirementReason (报废原因枚举)
├── description: String
├── status: RetirementStatus
├── currentApproverId: Long (FK -> User)
├── createdAt: LocalDateTime
└── updatedAt: LocalDateTime

ApprovalRecord (审批记录)
├── id: Long
├── requestId: Long (FK -> RetirementRequest)
├── approverId: Long (FK -> User)
├── decision: ApprovalDecision [PENDING, APPROVED, REJECTED]
├── comment: String
├── decidedAt: LocalDateTime
└── sequence: Integer (审批顺序)
```

### 1.4 报废原因枚举

```java
public enum RetirementReason {
    DAMAGED("设备损坏"),
    EXPIRED("使用年限到期"),
    OBSOLETE("技术淘汰"),
    UNDERMAINTAINED("维护不当"),
    OTHER("其他原因");
}
```

---

## 2. 当前 Phase 对应实施目标

### 2.1 整体计划回顾

| Phase | 描述 | 状态 |
|-------|------|------|
| Phase 1 | 资产状态枚举扩展 | ✅ 已完成 |
| Phase 2 | 报废申请提交 → 单级审批 → 状态更新 | 🔄 本次 Iteration |
| Phase 3 | 审批链可视化 + 多级审批 | ⏳ 待开发 |
| Phase 4 | 批量报废 + 导出报表 | ⏳ 待开发 |

### 2.2 本次 Iteration 交付范围

| 交付物 | 说明 | 文件变更 |
|--------|------|----------|
| 后端 API | 报废申请 CRUD、审批操作接口 | `RetirementController.java` |
| 数据模型 | RetirementRequest, ApprovalRecord 表结构 | `RetirementRequest.java`, `ApprovalRecord.java` |
| 服务层 | 报废申请逻辑、审批状态机 | `RetirementService.java`, `ApprovalService.java` |
| 状态机 | 资产状态流转逻辑 | `AssetStateMachine.java` |
| 前端页面 | 报废申请表单 + 审批进度跟踪 | `useApprovalPermission.ts`, `approvalStore.ts` |
| 样式文件 | 仪表盘样式调整 | `AuditDashboard.module.css`, `FilterBar.module.css` |
| 图表组件 | 操作日志趋势图 | `TrendChart.tsx` |

### 2.3 需要修改的文件清单

#### 后端文件

| 文件路径 | 修改内容 |
|----------|----------|
| `backend/src/main/java/com/ams/mapper/ApprovalRecordMapper.java` | 新增报废审批记录查询方法 |
| `backend/src/main/java/com/ams/entity/RetirementRequest.java` | 实体定义 |
| `backend/src/main/java/com/ams/entity/ApprovalRecord.java` | 审批记录实体 |
| `backend/src/main/java/com/ams/service/RetirementService.java` | 报废申请服务 |
| `backend/src/main/java/com/ams/controller/RetirementController.java` | REST API 控制器 |

#### 前端文件

| 文件路径 | 修改内容 |
|----------|----------|
| `frontend/src/composables/useApprovalPermission.ts` | 审批权限校验逻辑 |
| `frontend/src/stores/approvalStore.ts` | 审批状态管理 |
| `frontend/src/app/pages/OperationLogDashboard/components/TrendChart.tsx` | 趋势图表组件 |
| `frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css` | 仪表盘样式 |
| `frontend/src/app/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` | 筛选栏样式 |

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 描述 | 备注 |
|--------|------|------|
| BC-001 | **单级审批**: 本次 Iteration 仅支持单一审批人 | 不支持会签或多级审批链 |
| BC-002 | **单资产申请**: 一次报废申请仅关联一个资产 | 不支持批量报废 |
| BC-003 | **状态限制**: 仅 `IN_USE` 状态的资产可发起报废申请 | PENDING_RETIREMENT/SCRAPPED 状态不可申请 |
| BC-004 | **操作权限**: 申请人不可审批自己的申请 | 审批人必须是其他用户 |
| BC-005 | **草稿状态**: 申请提交前可保存草稿，提交后不可修改 | 已提交的申请为只读 |

### 3.2 非功能边界

| 约束项 | 描述 | 备注 |
|--------|------|------|
| NB-001 | 暂不实现附件上传功能 | 后续 Phase 处理 |
| NB-002 | 暂不实现消息通知（邮件/站内信） | 后续 Phase 处理 |
| NB-003 | 暂不实现报废资产的后续处置跟踪 | 后续 Phase 处理 |

### 3.3 技术约束

| 约束项 | 描述 |
|--------|------|
| TC-001 | 后端使用 Spring Boot + MyBatis-Plus |
| TC-002 | 前端使用 React + TypeScript |
| TC-003 | 数据库事务保证审批状态更新的原子性 |
| TC-004 | API 遵循 RESTful 规范 |

---

## 4. 验收测试基准 (ATB)

### 4.1 后端 API 测试

测试文件: `tests/api/test_retirement_api.py`

#### ATB-001: 报废申请创建

```python
# Test Case: ATB-001
def test_create_retirement_request_success(api_client, asset_in_use, user):
    """
    Given: 存在 IN_USE 状态的资产
    When:  用户提交有效的报废申请
    Then:  返回 201 Created
          RetirementRequest.status == 'PENDING'
          Asset.status 自动变更为 'PENDING_RETIREMENT'
          审批记录自动创建
    """
    # Arrange
    asset = asset_in_use
    user = user
    
    # Act
    response = api_client.post('/api/v1/retirements/', data={
        'assetId': asset.id,
        'reason': 'DAMAGED',
        'description': '设备老化严重'
    })
    
    # Assert
    assert response.status_code == 201
    assert response.json()['status'] == 'PENDING'
```

**物理测试期待**:
- `POST /api/v1/retirements/` 返回 201
- 数据库 `retirement_requests` 表插入 1 条记录
- 数据库 `assets` 表对应记录 `status` 变更为 `PENDING_RETIREMENT`
- 数据库 `approval_records` 表插入 1 条审批记录

#### ATB-002: 申请状态校验

```python
# Test Case: ATB-002
def test_create_retirement_invalid_asset_status(api_client, asset_not_in_use):
    """
    Given: 资产状态不为 IN_USE
    When:  提交报废申请
    Then:  返回 400 Bad Request
          错误信息包含 "资产状态不允许报废申请"
    """
```

**物理测试期待**:
- `POST /api/v1/retirements/` 返回 400
- 数据库无新记录插入

#### ATB-003: 审批通过

```python
# Test Case: ATB-003
def test_approve_retirement_request(api_client, retirement_request, approver_user):
    """
    Given: 存在 PENDING 状态的报废申请
    When:  审批人批准申请
    Then:  返回 200 OK
          RetirementRequest.status == 'APPROVED'
          Asset.status 变更为 'SCRAPPED'
          ApprovalRecord.decision == 'APPROVED'
    """
```

**物理测试期待**:
- `POST /api/v1/retirements/{id}/approve/` 返回 200
- 资产状态最终为 `SCRAPPED`

#### ATB-004: 审批驳回

```python
# Test Case: ATB-004
def test_reject_retirement_request(api_client, retirement_request, approver_user):
    """
    Given: 存在 PENDING 状态的报废申请
    When:  审批人驳回申请
    Then:  返回 200 OK
          RetirementRequest.status == 'REJECTED'
          Asset.status 回退为 'IN_USE'
    """
```

**物理测试期待**:
- `POST /api/v1/retirements/{id}/reject/` 返回 200
- 资产状态恢复为 `IN_USE`

#### ATB-005: 进度查询

```python
# Test Case: ATB-005
def test_get_retirement_progress(api_client, user, retirement_request):
    """
    Given: 存在报废申请
    When:  申请人查询进度
    Then:  返回包含当前审批状态和审批历史的完整对象
    """
```

**物理测试期待**:
- `GET /api/v1/retirements/{id}/progress/` 返回 200
- 响应包含 `status`, `currentApprover`, `approvalHistory` 字段

### 4.2 前端功能测试

测试文件: `tests/e2e/retirement_flow.spec.ts`

#### ATB-006: 报废申请页面渲染

```typescript
// Test Case: ATB-006
test('retirement application page loads correctly', async ({ page }) => {
  await page.goto('/assets/retirement/new');
  await expect(page.locator('form')).toBeVisible();
  await expect(page.locator('#asset-selector')).toBeVisible();
  await expect(page.locator('#reason-select')).toBeVisible();
});
```

**物理测试期待**: 页面加载成功，关键表单元素可见

#### ATB-007: 提交申请流程

```typescript
// Test Case: ATB-007
test('submit retirement application', async ({ page }) => {
  await page.goto('/assets/retirement/new');
  await page.selectOption('#asset-selector', 'AST-001');
  await page.selectOption('#reason-select', 'DAMAGED');
  await page.fill('#description', '设备老化严重');
  await page.click('button[type="submit"]');
  
  await expect(page.locator('.toast-success')).toBeVisible();
  await expect(page).toHaveURL(/\/retirement\/\w+\/progress/);
});
```

**物理测试期待**: 
- 表单提交成功
- 显示成功提示
- 跳转至进度跟踪页面

#### ATB-008: 审批进度可视化

```typescript
// Test Case: ATB-008
test('view approval progress', async ({ page }) => {
  await page.goto('/retirement/RET-001/progress');
  
  await expect(page.locator('.status-badge')).toContainText('审批中');
  await expect(page.locator('.approver-name')).toContainText('张经理');
  await expect(page.locator('.timeline')).toBeVisible();
});
```

**物理测试期待**: 进度页面展示当前状态、审批人、时间线

### 4.3 静态分析测试

测试文件: `tests/sprint4/test_static_analysis.py`

#### ATB-009: 语法检查

```python
# Test Case: ATB-009
def test_no_syntax_errors_in_modified_files():
    """验证修改的文件无语法错误"""
    files_to_check = [
        'backend/src/main/java/com/ams/mapper/ApprovalRecordMapper.java',
        'frontend/src/composables/useApprovalPermission.ts',
        'frontend/src/stores/approvalStore.ts',
        'frontend/src/app/pages/OperationLogDashboard/components/TrendChart.tsx',
    ]
```

#### ATB-010: Docstring 覆盖

```python
# Test Case: ATB-010
def test_all_modified_functions_have_docstrings():
    """验证所有修改的函数包含 docstring"""
    # 检查关键函数:
    # - ApprovalRecordMapper 中的方法
    # - useApprovalPermission.ts 中的 hooks
    # - approvalStore.ts 中的 actions
```

---

## 5. 开发切入层级序列

### 5.1 层级 1: 数据模型层 (Day 1)

```
┌─────────────────────────────────────────────────────────┐
│ 1.1 创建数据库迁移                                        │
│     - retirement_requests 表                             │
│     - approval_records 表                                │
├─────────────────────────────────────────────────────────┤
│ 1.2 定义实体类                                            │
│     - RetirementRequest.java                            │
│     - ApprovalRecord.java                               │
├─────────────────────────────────────────────────────────┤
│ 1.3 配置 Mapper 接口                                      │
│     - RetirementRequestMapper.java                      │
│     - ApprovalRecordMapper.java                         │
│       ★ 新增方法: findByRequestId, findPendingByAsset   │
├─────────────────────────────────────────────────────────┤
│ 1.4 编写单元测试                                          │
│     - test_retirement_request_entity                    │
│     - test_approval_record_entity                       │
└─────────────────────────────────────────────────────────┘
```

### 5.2 层级 2: 服务层 (Day 1-2)

```
┌─────────────────────────────────────────────────────────┐
│ 2.1 RetirementService                                   │
│     - createRetirementRequest() 创建申请                  │
│     - getRetirementRequest() 查询申请                    │
│     - getRetirementProgress() 获取进度                   │
├─────────────────────────────────────────────────────────┤
│ 2.2 ApprovalService                                     │
│     - approveRequest() 批准申请                          │
│     - rejectRequest() 驳回申请                          │
│     - autoAssignApprover() 自动分配审批人                │
├─────────────────────────────────────────────────────────┤
│ 2.3 AssetStateMachine                                   │
│     - validateTransition() 状态转换校验                  │
│     - executeTransition() 执行状态转换                   │
│     - IN_USE -> PENDING_RETIREMENT                      │
│     - PENDING_RETIREMENT -> SCRAPPED (approved)         │
│     - PENDING_RETIREMENT -> IN_USE (rejected)            │
└─────────────────────────────────────────────────────────┘
```

### 5.3 层级 3: API 层 (Day 2)

```
┌─────────────────────────────────────────────────────────┐
│ 3.1 DTO 定义                                            │
│     - RetirementApplicationDTO                          │
│     - RetirementApproveDTO                              │
│     - RetirementRejectDTO                               │
│     - RetirementProgressDTO                             │
├─────────────────────────────────────────────────────────┤
│ 3.2 Controller                                          │
│     RetirementController                                │
│     - POST /retirements/          创建申请               │
│     - GET /retirements/{id}/      申请详情              │
│     - GET /retirements/{id}/progress/ 审批进度          │
│     - POST /retirements/{id}/approve/ 批准              │
│     - POST /retirements/{id}/reject/ 驳回               │
├─────────────────────────────────────────────────────────┤
│ 3.3 路由配置                                            │
│     - 添加 Retirement 相关路由                           │
│     - 配置权限拦截器                                     │
└─────────────────────────────────────────────────────────┘
```

### 5.4 层级 4: 前端组件层 (Day 3)

```
┌─────────────────────────────────────────────────────────┐
│ 4.1 状态管理 (approvalStore.ts)                          │
│     - retirementRequestSlice                           │
│     - fetchRetirementRequest()                          │
│     - submitRetirementRequest()                         │
│     - fetchRetirementProgress()                        │
├─────────────────────────────────────────────────────────┤
│ 4.2 权限校验 (useApprovalPermission.ts)                  │
│     - canSubmitRetirement()                             │
│     - canApproveRetirement()                            │
│     - canViewRetirementProgress()                       │
├─────────────────────────────────────────────────────────┤
│ 4.3 页面组件                                            │
│     - RetirementApplicationPage                        │
│     - RetirementProgressPage                           │
├─────────────────────────────────────────────────────────┤
│ 4.4 样式调整                                            │
│     - AuditDashboard.module.css                        │
│     - FilterBar.module.css                             │
│     - TrendChart.tsx                                   │
└─────────────────────────────────────────────────────────┘
```

### 5.5 层级 5: 集成与验收 (Day 3-4)

```
┌─────────────────────────────────────────────────────────┐
│ 5.1 端到端测试                                          │
│     - Playwright E2E 测试                               │
│     - 用户操作流程覆盖 (ATB-006 ~ ATB-008)               │
├─────────────────────────────────────────────────────────┤
│ 5.2 API 集成测试                                        │
│     - pytest 完整覆盖 (ATB-001 ~ ATB-005)                │
├─────────────────────────────────────────────────────────┤
│ 5.3 静态分析测试                                        │
│     - 语法检查 (ATB-009)                                 │
│     - Docstring 覆盖 (ATB-010)                          │
├─────────────────────────────────────────────────────────┤
│ 5.4 手动验收检查                                        │
│     - 实际资产状态流转验证                               │
│     - UI 功能验证                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 6. API 规范摘要

### 6.1 接口列表

| 方法 | 端点 | 描述 | 状态码 |
|------|------|------|--------|
| POST | `/api/v1/retirements/` | 创建报废申请 | 201 |
| GET | `/api/v1/retirements/` | 列表查询 | 200 |
| GET | `/api/v1/retirements/{id}/` | 申请详情 | 200 |
| GET | `/api/v1/retirements/{id}/progress/` | 审批进度 | 200 |
| POST | `/api/v1/retirements/{id}/approve/` | 批准申请 | 200 |
| POST | `/api/v1/retirements/{id}/reject/` | 驳回申请 | 200 |

### 6.2 请求/响应示例

#### 创建报废申请

**Request:**
```json
POST /api/v1/retirements/
{
  "assetId": 1001,
  "reason": "DAMAGED",
  "description": "设备老化严重，无法正常使用"
}
```

**Response (201):**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 5001,
    "assetId": 1001,
    "assetCode": "AST-2024-001",
    "assetName": "Dell 服务器 R740",
    "reason": "DAMAGED",
    "reasonText": "设备损坏",
    "status": "PENDING",
    "statusText": "待审批",
    "currentApprover": {
      "id": 201,
      "name": "张经理"
    },
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### 获取审批进度

**Request:**
```
GET /api/v1/retirements/5001/progress/
```

**Response (200):**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "requestId": 5001,
    "currentStatus": "PENDING",
    "currentApprover": {
      "id": 201,
      "name": "张经理",
      "department": "资产管理部"
    },
    "approvalHistory": [
      {
        "sequence": 1,
        "approverName": "张经理",
        "decision": "PENDING",
        "comment": null,
        "decidedAt": null
      }
    ],
    "assetSnapshot": {
      "assetCode": "AST-2024-001",
      "assetName": "Dell 服务器 R740",
      "purchaseDate": "2020-06-15",
      "originalValue": 50000.00
    }
  }
}
```

---

## 7. 状态机定义

### 7.1 资产状态流转

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    ▼                                      │
┌─────────┐   submit    ┌─────────────────────┐   approve  ┌───────────┐
│ IN_USE  │ ──────────▶│ PENDING_RETIREMENT │ ──────────▶│ SCRAPPED  │
└─────────┘             └──────────┬──────────┘            └───────────┘
      ▲                            │
      │                            │ reject
      └────────────────────────────┘
```

### 7.2 报废申请状态

```
┌─────────┐   submit    ┌──────────┐   approve   ┌───────────┐
│  DRAFT  │ ──────────▶│  PENDING │ ──────────▶│ APPROVED  │
└─────────┘             └────┬─────┘            └───────────┘
                             │
                             │ reject
                             ▼
                       ┌───────────┐
                       │ REJECTED │
                       └───────────┘
```

### 7.3 状态转换规则

| 当前状态 | 目标状态 | 触发动作 | 条件 |
|----------|----------|----------|------|
| IN_USE | PENDING_RETIREMENT | 提交报废申请 | 用户发起 |
| PENDING_RETIREMENT | SCRAPPED | 审批通过 | 审批人同意 |
| PENDING_RETIREMENT | IN_USE | 审批驳回 | 审批人拒绝 |

---

## 8. 附录

### 8.1 ApprovalRecordMapper 扩展方法

根据 deliverables，需要在 `ApprovalRecordMapper.java` 中添加报废相关的查询方法：

```java
/**
 * 根据报废申请ID查询审批记录列表
 * @param requestId 报废申请ID
 * @return 审批记录列表
 */
List<ApprovalRecord> findByRequestId(Long requestId);

/**
 * 根据资产ID查询待审批的报废申请
 * @param assetId 资产ID
 * @return 待审批记录
 */
ApprovalRecord findPendingByAssetId(Long assetId);
```

### 8.2 错误码定义

| 错误码 | 描述 | HTTP 状态码 |
|--------|------|-------------|
| RET_001 | 资产状态不允许报废申请 | 400 |
| RET_002 | 报废申请不存在 | 404 |
| RET_003 | 非法的状态转换 | 400 |
| RET_004 | 无权审批此申请 | 403 |
| RET_005 | 申请已被处理 | 409 |

### 8.3 参考文档

- [资产管理系统 API 规范](./api-specification.md)
- [状态机设计文档](./state-machine-design.md)
- [前端组件开发指南](./frontend-guidelines.md)

---

**文档结束**