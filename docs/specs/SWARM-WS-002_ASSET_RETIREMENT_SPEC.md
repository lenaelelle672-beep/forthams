# SWARM-WS-002 资产报废/退役流程实现规格指导

## 需求与背景

### 业务背景

资产全生命周期管理中，资产退役/报废是关键的终态环节。当前系统缺失此能力，导致：

- 已报废资产仍在线上系统显示为可用状态
- 无法追踪资产退役原因和时间
- 资产账实不符，财务核销缺乏依据
- 缺少标准化的审批流程控制

### 功能范围

本次迭代实现资产报废/退役流程的基础提交能力：

- 后端：`AssetRetirementService` 服务类及状态机
- 前端：`AssetRetirementPage` 退役申请页面
- 支持设备信息确认、退役原因选择、附件上传

### 非本次范围

- 审批流程（后续迭代实现）
- 财务核销对接（后续迭代实现）
- 资产回收/处置跟踪

---

## 当前 Phase 对应实施目标

### Phase 归属

本次实施对应 `plan.md` 中 **Phase 2: 资产全生命周期管理** 的子任务 **WS-002 资产退役/报废流程**。

### Phase 2 上下文

| 任务ID | 任务名称 | 状态 | 依赖 |
|--------|----------|------|------|
| WS-001 | 资产入库登记 | 已完成 | - |
| **WS-002** | **资产退役/报废流程** | **本次** | WS-001 |
| WS-003 | 资产维修流程 | 待开发 | WS-001 |
| WS-004 | 资产转移流程 | 待开发 | WS-001 |

### 交付物清单

| 交付物 | 类型 | 路径 |
|--------|------|------|
| AssetRetirementService | 后端服务类 | `src/services/retirement_service.py` |
| 审批链服务 | 后端服务类 | `src/services/approval_chain_service.py` |
| 资产状态机 | 后端状态机 | `src/state_machine/retirement_state_machine.py` |
| 退役路由 | API路由 | `src/api/routers/retirement_router.py` |
| 审计日志中间件 | 中间件 | `src/api/middleware/audit_logger.py` |
| 认证依赖 | 认证模块 | `src/api/deps/auth.py` |
| E2E测试 | 测试文件 | `tests/e2e/retirement_user_journey.spec.ts` |
| E2E测试 | 测试文件 | `tests/e2e/retirement_flow.spec.ts` |

---

## 边界约束

### 功能边界

| 约束项 | 具体描述 |
|--------|----------|
| 可退役资产范围 | 仅限状态为 `ACTIVE` 的资产 |
| 单次退役数量 | 单次申请仅支持单条资产（不支持批量退役） |
| 附件限制 | 单文件最大 10MB，支持格式：pdf, jpg, png, doc, docx |
| 附件数量 | 单次申请最多上传 5 个附件 |
| 退役原因必填 | 用户必须从预设原因列表中选择 |
| 设备信息只读 | 设备信息从资产详情页带入，不可编辑 |
| 角色权限 | 仅 `REQUESTER`、`ASSET_MANAGER`、`ADMIN` 可提交申请 |

### 数据边界

| 约束项 | 具体描述 |
|--------|----------|
| 退役申请单号 | 格式：`RET-{YYYYMMDD}-{6位序号}`，如 `RET-20240115-000001` |
| 状态初始值 | 新建申请单状态为 `PENDING_APPROVAL` |
| 数据持久化 | 退役申请记录写入 `asset_retirement` 表 |
| 历史追溯 | 状态变更记录写入 `retirement_history` 表 |
| 审计日志 | 所有操作记录写入 `general_audit_entry` 表 |

### 技术边界

| 约束项 | 具体描述 |
|--------|----------|
| 后端框架 | Python FastAPI + SQLAlchemy ORM |
| 前端框架 | Vue 3 + TypeScript |
| 文件存储 | 本地文件系统（`/uploads/retirements/`） |
| API 协议 | RESTful JSON |
| 认证要求 | 需登录态，接口需携带 Bearer Token |
| 状态机框架 | 自定义状态机（`src/state_machine/`） |

### 退役原因枚举

```python
class RetirementReason(str, Enum):
    EQUIPMENT_FAILURE = "EQUIPMENT_FAILURE"       # 设备故障无法修复
    UPGRADE_REPLACEMENT = "UPGRADE_REPLACEMENT"   # 升级换代淘汰
    EXPIRED_LIFECYCLE = "EXPIRED_LIFECYCLE"       # 超过使用年限
    DAMAGE_LOSS = "DAMAGE_LOSS"                   # 损坏或丢失
    OTHER = "OTHER"                               # 其他原因
```

### 资产状态机流转

```
[ACTIVE] ────(提交退役申请)───► [RETIREMENT_PENDING]
[RETIREMENT_PENDING] ────(审批通过)───► [RETIRED]
[RETIREMENT_PENDING] ────(审批拒绝)───► [ACTIVE]
[RETIRED] ────(不可逆)───► [终端状态]
```

### 审批链节点定义

基于 `src/models/approval_chain.py` 和 `src/services/approval_chain_service.py`：

```python
class ApprovalNode:
    level: ApprovalLevel          # APPROVER_L1 / APPROVER_L2 / APPROVER_L3
    required_roles: List[UserRole] # 允许审批的角色列表
    timeout_hours: int             # 超时时间
    auto_escalate: bool           # 超时是否自动升级
```

---

## 验收测试基准 (ATB)

### ATB-001: E2E退役申请提交流程测试

**测试目标**: 用户可完整完成资产退役申请提交

**物理测试期待 (Playwright - `tests/e2e/retirement_user_journey.spec.ts`)**:

```typescript
test('用户可提交资产退役申请', async ({ page }) => {
  // 1. 登录系统
  await page.goto('/login');
  await page.fill('#username', 'test_user');
  await page.fill('#password', 'test_password');
  await page.click('button[type="submit"]');
  
  // 2. 导航至资产详情页
  await page.goto('/asset/detail/AST-20240101-000001');
  
  // 3. 点击提交退役申请按钮
  await page.click('#btn-submit-retirement');
  
  // 4. 验证页面跳转至退役申请页
  await expect(page).toHaveURL(/.*retirement.*assetId=AST-20240101-000001/);
  
  // 5. 验证设备信息只读展示
  const assetNameInput = page.locator('#asset-name');
  await expect(assetNameInput).toHaveValue('测试设备-A001');
  await expect(assetNameInput).toBeDisabled();
  
  // 6. 选择退役原因
  await page.selectOption('#retirement-reason-select', 'EQUIPMENT_FAILURE');
  
  // 7. 上传附件（非必填，跳过）
  
  // 8. 填写说明
  await page.fill('#retirement-description', '设备主板损坏，经维修评估无法修复');
  
  // 9. 提交申请
  await page.click('button[type="submit"]');
  
  // 10. 验证提交成功
  await expect(page.locator('.el-message--success')).toContainText('申请提交成功');
  
  // 11. 验证跳转到申请详情页
  await expect(page).toHaveURL(/.*retirement.*RET-/);
});
```

**通过基准**: 用户可完成从资产详情页到退役申请提交的完整流程，无页面错误

---

### ATB-002: 退役原因必填校验测试

**测试目标**: 未选择退役原因时表单校验失败

**物理测试期待 (Playwright)**:

```typescript
test('未选择退役原因应显示校验错误', async ({ page }) => {
  await page.goto('/retirement?assetId=AST-20240101-000001');
  
  // 直接提交（不选择原因）
  await page.click('button[type="submit"]');
  
  // 验证错误提示
  await expect(page.locator('.el-form-item__error')).toContainText('请选择退役原因');
  
  // 验证页面未跳转
  await expect(page).toHaveURL(/.*retirement.*assetId=AST-20240101-000001/);
});
```

**通过基准**: 未选择原因时表单校验失败，不提交请求

---

### ATB-003: 附件上传功能测试

**测试目标**: 支持多文件上传，校验文件类型和大小

**物理测试期待 (Playwright)**:

```typescript
test('附件上传功能测试', async ({ page }) => {
  await page.goto('/retirement?assetId=AST-20240101-000001');
  
  // 1. 上传合法文件（PDF < 10MB）
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'test_report.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('fake pdf content')
  });
  await expect(page.locator('.upload-success')).toContainText('test_report.pdf');
  
  // 2. 上传非法类型应拒绝
  await fileInput.setInputFiles({
    name: 'malware.exe',
    mimeType: 'application/x-msdownload',
    buffer: Buffer.from('fake exe content')
  });
  await expect(page.locator('.el-message--error')).toContainText('不支持的文件格式');
  
  // 3. 上传超大文件应拒绝（模拟 > 10MB）
  await fileInput.setInputFiles({
    name: 'large_file.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(11 * 1024 * 1024) // 11MB
  });
  await expect(page.locator('.el-message--error')).toContainText('文件大小超过限制');
  
  // 4. 验证附件数量限制
  // 上传5个文件后再次上传应被拒绝
  for (let i = 0; i < 5; i++) {
    await fileInput.setInputFiles({
      name: `file_${i}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from('content')
    });
  }
  await fileInput.setInputFiles({
    name: 'file_6.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('content')
  });
  await expect(page.locator('.el-message--warning')).toContainText('最多上传5个附件');
});
```

**通过基准**: 合法文件上传成功，非法文件/超大文件/超数量被拒绝

---

### ATB-004: 设备信息只读展示测试

**测试目标**: 资产信息从详情页正确带入并展示，不可编辑

**物理测试期待 (Playwright)**:

```typescript
test('设备信息只读展示', async ({ page }) => {
  // 模拟从资产详情页跳转
  await page.goto('/asset/detail/AST-20240101-000001');
  await page.click('#btn-submit-retirement');
  
  // 验证 URL 参数传递
  await expect(page).toHaveURL(/.*assetId=AST-20240101-000001/);
  
  // 验证设备信息只读展示
  await expect(page.locator('#asset-name')).toHaveValue('测试设备-A001');
  await expect(page.locator('#asset-name')).toBeDisabled();
  
  await expect(page.locator('#asset-code')).toHaveValue('AST-20240101-000001');
  await expect(page.locator('#asset-code')).toBeDisabled();
  
  await expect(page.locator('#asset-model')).toHaveValue('Model-X100');
  await expect(page.locator('#asset-model')).toBeDisabled();
  
  await expect(page.locator('#purchase-date')).toHaveValue('2023-01-15');
  await expect(page.locator('#purchase-date')).toBeDisabled();
  
  // 尝试修改应失败
  const assetNameInput = page.locator('#asset-name');
  await assetNameInput.fill('修改后的名称');
  await expect(assetNameInput).toHaveValue('测试设备-A001'); // 值未改变
});
```

**通过基准**: 设备名称、编号、规格型号、购置日期均正确展示且不可编辑

---

### ATB-005: 后端服务类单元测试

**测试目标**: `AssetRetirementService.create_retirement()` 正确创建申请记录

**物理测试期待 (pytest)**:

```python
def test_create_retirement_success():
    """测试正常提交退役申请"""
    service = RetirementService(
        retirement_repository=mock_repo,
        state_machine=mock_state_machine,
        audit_logger=mock_audit_logger,
        notification_service=mock_notification
    )
    
    result = service.create_retirement(
        asset_id="AST-20240101-000001",
        reason=RetirementReason.EQUIPMENT_FAILURE,
        description="设备主板损坏",
        applicant_id="USR-001",
        attachment_urls=["uuid1.pdf", "uuid2.jpg"]
    )
    
    assert result.status == "PENDING_APPROVAL"
    assert result.retirement_no.startswith("RET-")
    assert result.asset_id == "AST-20240101-000001"
    assert result.reason == RetirementReason.EQUIPMENT_FAILURE

def test_create_retirement_invalid_asset_status():
    """测试非ACTIVE状态资产不可退役"""
    service = RetirementService(...)
    
    # 尝试退役已退役资产应抛出异常
    with pytest.raises(InvalidAssetStatusError) as exc_info:
        service.create_retirement(
            asset_id="AST-20240101-000002",  # 状态为 RETIRED
            reason=RetirementReason.EQUIPMENT_FAILURE,
            description="测试",
            applicant_id="USR-001"
        )
    assert "非ACTIVE状态资产不可申请退役" in str(exc_info.value)
```

**通过基准**: 合法请求返回申请记录，非法资产状态抛出预期异常

---

### ATB-006: 状态流转逻辑测试

**测试目标**: 资产状态机正确处理状态变更

**物理测试期待 (pytest - `tests/state_machine/test_retirement_sm.py`)**:

```python
def test_asset_state_transition_to_retirement_pending():
    """测试ACTIVE到RETIREMENT_PENDING的合法流转"""
    state_machine = RetirementStateMachine()
    
    result = state_machine.transition(
        asset_id="AST-20240101-000001",
        from_status=AssetStatus.ACTIVE,
        to_status=AssetStatus.RETIREMENT_PENDING,
        operator_id="USR-001",
        retirement_id="RET-20240115-000001"
    )
    
    assert result.success is True
    assert result.new_status == AssetStatus.RETIREMENT_PENDING
    assert result.asset_id == "AST-20240101-000001"

def test_invalid_state_transition_direct_to_retired():
    """测试从ACTIVE直接跳转到RETIRED应被拒绝"""
    state_machine = RetirementStateMachine()
    
    result = state_machine.transition(
        asset_id="AST-20240101-000001",
        from_status=AssetStatus.ACTIVE,
        to_status=AssetStatus.RETIRED,
        operator_id="USR-001",
        retirement_id="RET-20240115-000001"
    )
    
    assert result.success is False
    assert "Invalid transition" in result.error_message

def test_retirement_pending_to_approved():
    """测试审批通过状态流转"""
    state_machine = RetirementStateMachine()
    
    result = state_machine.transition(
        asset_id="AST-20240101-000001",
        from_status=AssetStatus.RETIREMENT_PENDING,
        to_status=AssetStatus.RETIRED,
        operator_id="USR-002",
        approval_record_id="APR-001"
    )
    
    assert result.success is True
    assert result.new_status == AssetStatus.RETIRED
```

**通过基准**: 合法流转成功，非法流转被拒绝并记录错误

---

### ATB-007: API 接口集成测试

**测试目标**: REST API 正确处理退役申请请求

**物理测试期待 (pytest - `tests/api/test_retirement_api.py`)**:

```python
def test_api_create_retirement_success(client, auth_headers):
    """测试创建退役申请API"""
    response = client.post(
        "/api/v1/retirements",
        json={
            "asset_id": "AST-20240101-000001",
            "reason": "EQUIPMENT_FAILURE",
            "description": "主板损坏需报废",
            "attachment_urls": ["uuid1.pdf", "uuid2.jpg"]
        },
        headers=auth_headers
    )
    
    assert response.status_code == 201
    data = response.json()
    assert "retirement_no" in data
    assert data["status"] == "PENDING_APPROVAL"
    assert data["asset_id"] == "AST-20240101-000001"

def test_api_create_retirement_unauthorized(client):
    """测试未认证请求应返回401"""
    response = client.post(
        "/api/v1/retirements",
        json={
            "asset_id": "AST-20240101-000001",
            "reason": "EQUIPMENT_FAILURE"
        }
    )
    
    assert response.status_code == 401

def test_api_create_retirement_invalid_asset(client, auth_headers):
    """测试无效资产ID应返回400"""
    response = client.post(
        "/api/v1/retirements",
        json={
            "asset_id": "INVALID-ID",
            "reason": "EQUIPMENT_FAILURE"
        },
        headers=auth_headers
    )
    
    assert response.status_code == 400
    assert "asset_not_found" in response.json()["code"]
```

**通过基准**: 已认证请求返回 201，未认证请求返回 401，无效数据返回 400

---

### ATB-008: 审计日志记录测试

**测试目标**: 退役申请操作正确记录审计日志

**物理测试期待 (pytest)**:

```python
def test_retirement_audit_logging():
    """测试退役申请创建时的审计日志"""
    mock_audit_logger = Mock(spec=AuditLogger)
    service = RetirementService(
        retirement_repository=mock_repo,
        state_machine=mock_state_machine,
        audit_logger=mock_audit_logger,
        notification_service=mock_notification
    )
    
    service.create_retirement(
        asset_id="AST-20240101-000001",
        reason=RetirementReason.EQUIPMENT_FAILURE,
        description="测试",
        applicant_id="USR-001"
    )
    
    # 验证审计日志被调用
    mock_audit_logger.log_transition.assert_called()
    call_args = mock_audit_logger.log_transition.call_args
    assert call_args.kwargs['asset_id'] == "AST-20240101-000001"
    assert call_args.kwargs['action'] == "RETIREMENT_SUBMITTED"
    assert call_args.kwargs['operator_id'] == "USR-001"
```

**通过基准**: 退役申请创建时正确触发审计日志记录

---

## 开发切入层级序列

### Phase 1: 数据模型层（Day 1）

```
src/
├── models/
│   ├── asset_retirement.py           # [1] 退役申请实体
│   └── retirement_history.py          # [2] 退役历史记录实体
├── schemas/
│   └── retirement_request.py         # [3] Pydantic 请求/响应模型
└── models/enums.py                    # [4] 枚举定义（RetirementReason等）
```

**任务清单**:
1. 定义 `AssetRetirement` 数据模型（`src/models/asset_retirement.py`）
2. 定义 `RetirementHistory` 历史记录模型（`src/models/retirement_history.py`）
3. 定义 API 请求/响应 Pydantic Schema（`src/schemas/retirement_request.py`）
4. 在 `src/models/enums.py` 中确认 `RetirementReason`、`AssetStatus` 枚举完整

**关键类参考**:

```python
# src/models/enums.py → AssetStatus
class AssetStatus(str, Enum):
    ACTIVE = "ACTIVE"                        # 使用中
    MAINTENANCE = "MAINTENANCE"              # 维护中
    RETIREMENT_PENDING = "RETIREMENT_PENDING"  # 退役待审批
    RETIRED = "RETIRED"                      # 已退役
```

---

### Phase 2: 状态机层（Day 1-2）

```
src/
├── state_machine/
│   ├── retirement_state_machine.py        # [5] 退役状态机实现
│   ├── guards.py                           # [6] 状态流转守卫
│   └── states.py                           # [7] 状态定义
└── models/approval_chain.py               # [8] 审批链模型
```

**任务清单**:
5. 实现 `RetirementStateMachine` 状态机类
6. 实现状态流转守卫（`guard_draft_to_pending_approval` 等）
7. 定义状态常量（`src/state_machine/states.py`）
8. 定义审批链模型（`src/models/approval_chain.py`）

**关键类参考**:

```python
# src/state_machine/retirement_state_machine.py
class RetirementStateMachine:
    def transition(self, asset_id, from_status, to_status, operator_id, **kwargs):
        """执行状态流转"""
        # 验证流转合法性
        # 执行业务逻辑
        # 发送事件通知
        pass
```

---

### Phase 3: 服务层（Day 2-3）

```
src/
├── services/
│   ├── retirement_service.py              # [9] 核心业务逻辑
│   ├── approval_chain_service.py           # [10] 审批链服务
│   ├── notification_service.py             # [11] 通知服务
│   └── field_mapping_engine.py             # [12] 字段映射引擎
└── repositories/
    └── retirement_repository.py            # [13] 数据访问层
```

**任务清单**:
9. 实现 `RetirementService.create_retirement()` 核心方法
10. 实现审批链构建与执行逻辑（`ApprovalChainService`）
11. 实现通知服务（`NotificationService`）
12. 实现字段映射引擎
13. 实现 `RetirementRepository` 数据访问

**关键类参考**:

```python
# src/services/retirement_service.py
class RetirementService:
    def create_retirement(self, asset_id, reason, description, applicant_id, attachment_urls):
        """创建退役申请"""
        # 1. 验证资产状态
        # 2. 创建申请记录
        # 3. 执行状态流转
        # 4. 记录审计日志
        # 5. 发送通知
        pass
    
    def approve(self, retirement_id, approver_id, comments):
        """审批通过"""
        pass
    
    def reject(self, retirement_id, approver_id, reason):
        """审批拒绝"""
        pass
```

---

### Phase 4: API路由层（Day 3）

```
src/
├── api/
│   ├── routers/
│   │   └── retirement_router.py            # [14] API路由注册
│   ├── middleware/
│   │   └── audit_logger.py                 # [15] 审计日志中间件
│   └── deps/
│       └── auth.py                         # [16] 认证依赖
└── main.py                                  # [17] 应用入口
```

**任务清单**:
14. 在 `retirement_router.py` 注册退役相关 API 端点
15. 更新 `audit_logger.py` 支持退役操作审计
16. 更新 `auth.py` 确认角色权限定义正确
17. 在 `main.py` 注册新路由和服务注入

**关键路由定义**:

```python
# src/api/routers/retirement_router.py
@router.post("/api/v1/retirements", status_code=201)
async def create_retirement(
    request: RetirementApplicationDTO,
    current_user: CurrentUser
):
    """创建退役申请"""
    pass

@router.get("/api/v1/retirements/{retirement_id}")
async def get_retirement(retirement_id: str, current_user: CurrentUser):
    """获取退役申请详情"""
    pass

@router.post("/api/v1/retirements/{retirement_id}/approve")
async def approve_retirement(retirement_id: str, current_user: CurrentUser):
    """审批通过"""
    pass

@router.post("/api/v1/retirements/{retirement_id}/reject")
async def reject_retirement(retirement_id: str, current_user: CurrentUser):
    """审批拒绝"""
    pass
```

---

### Phase 5: 前端页面层（Day 4-5）

```
frontend/src/
├── pages/
│   └── Retirement/
│       └── RetirementPage.vue              # [18] 退役申请主页面
├── components/
│   ├── RetirementForm.vue                  # [19] 退役申请表单
│   ├── AssetInfoDisplay.vue                # [20] 设备信息展示
│   └── AttachmentUploader.vue              # [21] 附件上传组件
├── services/
│   └── retirementService.ts                # [22] 前端API封装
└── types/
    └── retirement.types.ts                 # [23] 类型定义
```

**任务清单**:
18. 实现 `RetirementPage.vue` 页面框架与路由配置
19. 实现 `RetirementForm.vue` 表单逻辑与校验
20. 实现 `AssetInfoDisplay.vue` 设备信息只读展示
21. 实现 `AttachmentUploader.vue` 拖拽上传与预览
22. 封装 `retirementService.ts` 调用后端接口
23. 定义 `retirement.types.ts` TypeScript 类型

---

### Phase 6: 测试层（Day 6）

```
tests/
├── e2e/
│   ├── retirement_user_journey.spec.ts     # [24] 用户旅程E2E测试
│   └── retirement_flow.spec.ts             # [25] 退役流程E2E测试
├── api/
│   └── test_retirement_api.py              # [26] API集成测试
├── state_machine/
│   └── test_retirement_sm.py               # [27] 状态机单元测试
└── services/
    └── test_retirement_service.py          # [28] 服务层单元测试
```

**任务清单**:
24. 编写 `ATB-001` 用户旅程 E2E 测试
25. 编写 `ATB-002~004` 前端功能 E2E 测试
26. 编写 `ATB-007` API 集成测试
27. 编写 `ATB-006` 状态机单元测试
28. 编写 `ATB-005` 服务层单元测试

---

### 开发顺序依赖图

```
Phase 1: 数据模型
    [1] asset_retirement.py ──┐
    [2] retirement_history.py─┤
    [3] retirement_request.py─┤
    [4] enums.py ─────────────┴──► Phase 3: 服务层
                                     [9] retirement_service.py ──┐
Phase 2: 状态机                             [10] approval_chain_service.py
    [5] retirement_state_machine.py ────────┤
    [6] guards.py ──────────────────────────┼──► [13] retirement_repository.py
    [7] states.py ──────────────────────────┤
    [8] approval_chain.py ──────────────────┘

Phase 4: API路由
    [14] retirement_router.py ──┐
    [15] audit_logger.py ───────┼──► [17] main.py (路由注册)
    [16] auth.py ───────────────┘

Phase 5: 前端页面
    [18] RetirementPage.vue ──┐
    [19] RetirementForm.vue ──┼──► [22] retirementService.ts
    [20] AssetInfoDisplay.vue──┤              │
    [21] AttachmentUploader.vue┘         [23] retirement.types.ts

All Phases ──────────────────────────────► Phase 6: Tests [24~28]
```

---

### 关键里程碑

| 里程碑 | 完成标志 | 预计时间 |
|--------|----------|----------|
| M1: 数据模型就绪 | 所有模型类定义完成，可被 import | Day 1 上午 |
| M2: 状态机就绪 | 状态流转逻辑测试通过 | Day 2 结束 |
| M3: 服务层就绪 | CRUD 操作测试通过 | Day 3 结束 |
| M4: API就绪 | POST `/api/v1/retirements` 返回 201 | Day 3 结束 |
| M5: 前端页面可用 | 用户可完成完整申请提交流程 | Day 5 结束 |
| M6: 测试通过 | 所有 ATB 测试用例通过率 100% | Day 6 结束 |

---

## 参考资料

### 核心文件索引

| 文件路径 | 相关度 | 说明 |
|----------|--------|------|
| `src/models/enums.py` | 高 | `AssetStatus`、`UserRole` 枚举定义 |
| `src/api/deps/auth.py` | 高 | `CurrentUser`、`ApprovalContext` 认证模型 |
| `src/services/retirement_service.py` | 高 | 退役服务核心实现 |
| `src/services/approval_chain_service.py` | 高 | 审批链状态机实现 |
| `src/state_machine/retirement_state_machine.py` | 高 | 退役状态机 |
| `src/state_machine/guards.py` | 中 | 状态流转守卫 |
| `src/api/middleware/audit_logger.py` | 中 | 审计日志中间件 |
| `src/api/routers/retirement_router.py` | 中 | API 路由定义 |
| `src/main.py` | 中 | 应用入口，需注册路由 |
| `tests/e2e/retirement_user_journey.spec.ts` | 高 | E2E 测试文件 |

### 枚举值速查

```python
# AssetStatus (src/models/enums.py)
class AssetStatus(str, Enum):
    ACTIVE = "ACTIVE"
    MAINTENANCE = "MAINTENANCE"
    RETIREMENT_PENDING = "RETIREMENT_PENDING"
    RETIRED = "RETIRED"

# UserRole (src/api/deps/auth.py)
class UserRole(str, Enum):
    ADMIN = "ADMIN"
    ASSET_MANAGER = "ASSET_MANAGER"
    REQUESTER = "REQUESTER"

# RetirementReason (src/models/enums.py)
class RetirementReason(str, Enum):
    EQUIPMENT_FAILURE = "EQUIPMENT_FAILURE"
    UPGRADE_REPLACEMENT = "UPGRADE_REPLACEMENT"
    EXPIRED_LIFECYCLE = "EXPIRED_LIFECYCLE"
    DAMAGE_LOSS = "DAMAGE_LOSS"
    OTHER = "OTHER"
```