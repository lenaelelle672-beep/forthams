# SWARM-502 资产报废/退役流程规格指导文档

## 1. 需求与背景

### 1.1 业务背景

企业资产管理中，资产退役（报废）是重要的生命周期管理环节。当资产达到使用年限、性能下降或不再满足业务需求时，需要正式执行退役流程。当前系统缺少标准化的资产退役审批链路，导致退役操作不规范、状态管理混乱。

### 1.2 核心诉求

1. **构建标准化的资产退役状态机**：规范资产退役生命周期，覆盖草稿、待审批、已批准、已拒绝、已撤回、已退役等状态
2. **实现资产退役审批链路**：支持多级审批流程，确保资产退役操作的合规性
3. **用户可提交资产退役申请**：提供友好的表单界面，支持填写退役原因、计划退役日期等信息
4. **审批通过后自动更新资产状态**：实现状态同步，确保资产数据的准确性
5. **完整的操作审计日志**：支持追溯所有退役相关操作

### 1.3 功能范围

| 功能模块 | 描述 | 优先级 |
|----------|------|--------|
| 退役申请创建 | 支持创建、编辑、提交资产退役申请 | P0 |
| 退役审批工作流 | 实现单级审批流程，支持审批/驳回操作 | P0 |
| 资产状态同步 | 审批通过后自动更新资产主数据状态 | P0 |
| 退役记录查询 | 支持查询历史退役记录与统计 | P1 |
| 前端表单组件 | `RetirementApplicationForm.tsx` 退役申请表单 | P0 |

### 1.4 相关文档

- [资产状态机规格](./asset-state-machine-spec.md)
- [审批链路服务规格](./approval-chain-service-spec.md)
- [RetirementApplicationForm 组件规格](./retirement-form-spec.md)

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 映射

根据 plan.md 中的 Phase 拆解，本 spec 对准 **Phase 2: 核心流程构建**

### 2.2 Phase 2 实施目标矩阵

| 目标项 | 描述 | 关键交付物 | 状态 |
|--------|------|------------|------|
| 状态机实现 | 构建 Asset Retirement State Machine | `retirement_state_machine.py` | ✅ 完成 |
| 审批链路 | 实现单级审批流程，支持审批/驳回操作 | `approval_chain_service.py` | ✅ 完成 |
| 申请管理 | 支持创建、编辑、提交、撤销退役申请 | `retirement_repository.py` | 🔄 进行中 |
| 状态同步 | 审批通过后自动更新资产主数据状态 | `backend/models/asset_retirement.py` | 🔄 进行中 |
| 前端表单 | 提供退役申请表单界面 | `RetirementApplicationForm.tsx` | 🔄 进行中 |

### 2.3 迭代里程碑

```
Phase 1: 基础架构 (已完成)
    │
    ▼
Phase 2: 核心流程构建 (当前)
    ├── Week 1: 数据库模型设计与迁移
    ├── Week 2: 核心服务层实现
    ├── Week 3: API 路由层实现
    └── Week 4: 前端组件与集成测试
    │
    ▼
Phase 3: 高级特性 (规划中)
    ├── 多级审批流程
    ├── 自动化审批规则引擎
    └── 财务系统集成
```

### 2.4 非本 Phase 范围（后续迭代）

- 多级审批流程
- 退役资产处置跟踪
- 自动化审批规则引擎
- 财务系统集成
- 移动端适配

---

## 3. 边界约束

### 3.1 架构约束

#### 3.1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端应用层                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         RetirementApplicationForm.tsx                    │    │
│  │         (退役申请表单组件)                                │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                       API Gateway                                │
├─────────────────────────────────────────────────────────────────┤
│                      服务层                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Asset Service │  │ Retirement   │  │  Workflow Service    │   │
│  │ (资产管理)     │  │ Service      │  │  (工作流引擎)         │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Notification │  │ Audit        │  │  Approval Chain      │   │
│  │ Service      │  │ Service      │  │  Service             │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                      数据层                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    PostgreSQL                            │    │
│  │  ┌───────────┐ ┌───────────────┐ ┌───────────────────┐   │    │
│  │  │  assets   │ │ retirement_   │ │ approval_records  │   │    │
│  │  │           │ │ applications  │ │                   │   │    │
│  │  └───────────┘ └───────────────┘ └───────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.1.2 技术栈定位

| 层级 | 技术选型 | 关键实现 |
|------|----------|----------|
| 前端展示层 | React + TypeScript + Tailwind CSS | `RetirementApplicationForm.tsx` |
| 接口层 | FastAPI Routes | RESTful API、Schema 验证 |
| 服务层 | Python Domain Service | 业务逻辑、状态机 |
| 数据层 | SQLAlchemy + PostgreSQL | ORM 模型、迁移脚本 |
| 测试层 | pytest + Playwright | ATB 覆盖、覆盖率 > 80% |

### 3.2 数据边界约束

| 约束项 | 具体限制 | 违反后果 |
|--------|----------|----------|
| 资产范围 | 仅支持 `status = 'ACTIVE'` 的资产发起退役申请 | 返回 400 Bad Request |
| 状态锁定 | `RETIRED` 状态资产不允许状态回退 | 返回 422 Unprocessable Entity |
| 审批唯一性 | 同一资产同一时间仅允许存在 1 个有效的退役申请 | 返回 409 Conflict |
| 字段长度 | 退役原因描述 ≤ 500 字符，审批意见 ≤ 200 字符 | 返回 422 Validation Error |
| 日期约束 | 计划退役日期必须晚于当前日期 | 返回 422 Validation Error |

### 3.3 业务规则约束

#### 3.3.1 前置条件检查

```python
# 退役申请前置条件伪代码
def validate_retirement_prerequisites(asset_id: str) -> ValidationResult:
    """
    验证资产是否符合退役申请条件
    """
    asset = get_asset(asset_id)
    
    # 规则 1: 资产必须处于 ACTIVE 状态
    if asset.status != AssetStatus.ACTIVE:
        return ValidationResult.error("ASSET_NOT_ACTIVE", "资产当前状态不允许退役")
    
    # 规则 2: 不存在待处理的退役申请
    pending = get_pending_retirement(asset_id)
    if pending:
        return ValidationResult.error("DUPLICATE_APPLICATION", "该资产存在待处理的退役申请")
    
    # 规则 3: 不存在待处理的借用/分配记录
    allocation = get_pending_allocation(asset_id)
    if allocation:
        return ValidationResult.error("PENDING_ALLOCATION", "资产存在待处理的分配记录")
    
    return ValidationResult.success()
```

#### 3.3.2 状态流转约束

```
┌─────────────────────────────────────────────────────────────────┐
│                     资产退役状态机                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌─────────┐                                                  │
│    │  DRAFT  │ ◄─────────────────┐                              │
│    └────┬────┘                   │                              │
│         │                        │                              │
│         │ [提交]                 │ [修订]                       │
│         ▼                        │                              │
│    ┌─────────────────┐          │                              │
│    │ PENDING_APPROVAL│───────────┴──────────────────► CANCELLED │
│    └────────┬────────┘            [撤回]                        │
│             │                                               ▲   │
│      ┌──────┴──────┐                                        │   │
│      │             │                                        │   │
│      ▼             ▼                                        │   │
│  ┌────────┐   ┌──────────┐                                 │   │
│  │APPROVED│   │ REJECTED │─────────────────────────────────┘   │
│  └────┬───┘   └──────────┘           [修订重提]                 │
│       │                                                         │
│       │ [执行退役]                                               │
│       ▼                                                         │
│  ┌─────────┐                                                    │
│  │ RETIRED │ ────────────────────────────────────────────────► │
│  └─────────┘          (终态，不可逆向操作)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

| 当前状态 | 允许转换 | 触发事件 | 目标状态 | 权限要求 |
|----------|----------|----------|----------|----------|
| DRAFT | PENDING_APPROVAL | submit | 提交 | REQUESTER+ |
| DRAFT | CANCELLED | cancel | 取消 | REQUESTER+ |
| PENDING_APPROVAL | APPROVED | approve | 批准 | APPROVER |
| PENDING_APPROVAL | REJECTED | reject | 驳回 | APPROVER |
| PENDING_APPROVAL | CANCELLED | withdraw | 撤回 | REQUESTER |
| APPROVED | RETIRED | execute | 执行退役 | ADMIN |
| REJECTED | DRAFT | revise | 修订重提 | REQUESTER |

#### 3.3.3 权限约束

| 操作 | 权限要求 | 说明 |
|------|----------|------|
| 查看退役申请列表 | 所有认证用户 | - |
| 创建退役申请 | ASSET_OWNER, REQUESTER | 资产归属部门用户 |
| 编辑草稿申请 | 创建者 | 仅可编辑自己创建的草稿 |
| 提交申请 | 创建者 | - |
| 撤回申请 | 创建者 | 仅在待审批状态下可撤回 |
| 审批操作 | APPROVER, ADMIN | - |
| 执行退役 | ADMIN | - |

### 3.4 性能约束

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 单次 API 响应时间 | < 200ms | p99 延迟 |
| 表单加载时间 | < 500ms | 首次内容渲染 |
| 状态机状态变更 | 原子性保证 | 事务回滚测试 |
| 并发审批冲突 | 乐观锁检测 | 竞态条件测试 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 资产退役申请创建

**测试场景**: 用户成功创建资产退役申请

#### ATB-1.1: 有效资产创建退役申请

```typescript
// frontend/src/app/pages/Retirement/RetirementApplicationForm.tsx
// 测试用例: test_create_retirement_application_success

describe('RetirementApplicationForm', () => {
  it('应该成功创建退役申请 - 有效资产', async () => {
    // 物理期待:
    // 1. 用户填写退役申请表单
    // 2. 点击提交按钮
    // 3. POST /api/v1/assets/{asset_id}/retirement 成功返回 201
    // 4. 申请状态为 DRAFT
    // 5. 返回包含 application_id
    
    const mockAsset = {
      id: 'asset-001',
      name: '测试资产',
      status: 'ACTIVE'
    };
    
    render(<RetirementApplicationForm asset={mockAsset} />);
    
    // 填写表单
    await userEvent.type(screen.getByLabelText('退役原因'), '设备老旧需报废');
    await userEvent.type(screen.getByLabelText('计划退役日期'), '2025-03-01');
    await userEvent.type(screen.getByLabelText('详细说明'), '使用年限超过10年');
    
    // 提交
    await userEvent.click(screen.getByRole('button', { name: '提交申请' }));
    
    // 验证
    expect(screen.getByText('申请已提交')).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/assets/asset-001/retirement',
      expect.objectContaining({
        status: 'DRAFT',
        reason: '设备老旧需报废'
      })
    );
  });
});
```

#### ATB-1.2: 非活跃资产创建退役申请失败

```typescript
it('应该拒绝为非活跃资产创建退役申请', async () => {
  // 物理期待:
  // 1. 用户尝试为已退役资产创建申请
  // 2. 返回 400 Bad Request
  // 3. 错误码 RETIRED_ASSET_NOT_ALLOWED
  // 4. 显示错误提示
  
  const retiredAsset = {
    id: 'asset-002',
    name: '已退役资产',
    status: 'RETIRED'
  };
  
  render(<RetirementApplicationForm asset={retiredAsset} />);
  
  // 退役原因输入框应该被禁用
  expect(screen.getByLabelText('退役原因')).toBeDisabled();
  expect(screen.getByText('该资产已退役，无法申请')).toBeInTheDocument();
});
```

#### ATB-1.3: 重复申请检测

```typescript
it('应该检测并拒绝重复的退役申请', async () => {
  // 物理期待:
  // 1. 用户为已有待处理申请的资产创建申请
  // 2. 返回 409 Conflict
  // 3. 错误码 DUPLICATE_APPLICATION_EXISTS
  // 4. 显示"该资产已存在待处理的退役申请"提示
  
  // 模拟已有待处理申请
  mockGet.mockResolvedValue({
    data: { exists: true, applicationId: 'existing-app-001' }
  });
  
  render(<RetirementApplicationForm asset={mockAsset} />);
  
  // 提交按钮应该被禁用
  expect(screen.getByRole('button', { name: '提交申请' })).toBeDisabled();
  expect(screen.getByText('该资产已存在待处理的退役申请')).toBeInTheDocument();
});
```

### 4.2 ATB-2: 资产退役状态机流转

**测试场景**: 验证状态机各状态转换合法性

#### ATB-2.1: 提交申请 DRAFT -> PENDING_APPROVAL

```typescript
it('应该正确处理申请提交状态变更', async () => {
  // 物理期待:
  // 1. PUT /api/v1/retirement/{id}/submit 返回 200
  // 2. 状态变更为 PENDING_APPROVAL
  // 3. submitted_at 时间戳更新
  // 4. 表单状态更新为只读
  
  const draftApplication = {
    id: 'app-001',
    status: 'DRAFT',
    asset_id: 'asset-001',
    reason: '测试原因'
  };
  
  render(<RetirementApplicationForm 
    application={draftApplication} 
    mode="edit" 
  />);
  
  await userEvent.click(screen.getByRole('button', { name: '提交' }));
  
  expect(screen.getByText('申请已提交')).toBeInTheDocument();
  expect(screen.getByTestId('status-badge')).toHaveTextContent('待审批');
});
```

#### ATB-2.2: 非法状态转换 DRAFT -> RETIRED

```typescript
it('应该拒绝非法的状态转换', async () => {
  // 物理期待:
  // 1. 草稿状态不能直接变更为已退役
  // 2. 返回 422 Unprocessable Entity
  // 3. 错误码 INVALID_STATE_TRANSITION
  // 4. 界面显示正确的状态转换路径提示
  
  const draftApplication = {
    id: 'app-001',
    status: 'DRAFT'
  };
  
  // 尝试直接执行退役（应该被前端拦截）
  await userEvent.click(screen.getByRole('button', { name: '执行退役' }));
  
  expect(screen.getByText('请先提交申请并等待审批')).toBeInTheDocument();
});
```

#### ATB-2.3: 撤回待审批申请 PENDING_APPROVAL -> CANCELLED

```typescript
it('应该正确撤回待审批的申请', async () => {
  // 物理期待:
  // 1. 返回 200
  // 2. 申请状态变更为 CANCELLED
  // 3. 界面状态更新
  
  const pendingApplication = {
    id: 'app-002',
    status: 'PENDING_APPROVAL'
  };
  
  render(<RetirementApplicationForm 
    application={pendingApplication} 
    mode="view" 
  />);
  
  await userEvent.click(screen.getByRole('button', { name: '撤回申请' }));
  
  expect(screen.getByTestId('status-badge')).toHaveTextContent('已撤回');
});
```

### 4.3 ATB-3: 审批链路

**测试场景**: 审批人执行审批操作

#### ATB-3.1: 审批通过

```typescript
it('应该正确处理审批通过', async () => {
  // 物理期待:
  // 1. POST /api/v1/retirement/{id}/approve 返回 200
  // 2. 申请状态变更为 APPROVED
  // 3. 创建审批记录 approval_record
  // 4. 审批人信息正确显示
  
  const pendingApplication = {
    id: 'app-003',
    status: 'PENDING_APPROVAL',
    asset: { id: 'asset-001', name: '测试资产' },
    reason: '设备老旧',
    submitted_at: '2025-01-20T10:00:00Z'
  };
  
  render(<RetirementApprovalPanel application={pendingApplication} />);
  
  await userEvent.type(screen.getByLabelText('审批意见'), '同意退役申请');
  await userEvent.click(screen.getByRole('button', { name: '批准' }));
  
  expect(screen.getByText('审批已完成')).toBeInTheDocument();
  expect(screen.getByTestId('approval-record')).toBeInTheDocument();
});
```

#### ATB-3.2: 审批驳回

```typescript
it('应该正确处理审批驳回', async () => {
  // 物理期待:
  // 1. 返回 200
  // 2. 申请状态变更为 REJECTED
  // 3. 需要填写驳回原因
  // 4. 申请人可收到通知
  
  render(<RetirementApprovalPanel application={pendingApplication} />);
  
  await userEvent.type(screen.getByLabelText('驳回原因'), '资产仍在使用中');
  await userEvent.click(screen.getByRole('button', { name: '驳回' }));
  
  expect(screen.getByText('申请已驳回')).toBeInTheDocument();
});
```

#### ATB-3.3: 执行退役后资产状态同步

```typescript
it('应该正确同步资产状态到已退役', async () => {
  // 物理期待:
  // 1. PUT /api/v1/retirement/{id}/execute 返回 200
  // 2. 申请状态变更为 RETIRED
  // 3. 关联资产 status 更新为 RETIRED
  // 4. 页面显示资产状态变更
  
  const approvedApplication = {
    id: 'app-004',
    status: 'APPROVED',
    asset: { id: 'asset-001', name: '测试资产' }
  };
  
  render(<RetirementExecutionPanel application={approvedApplication} />);
  
  await userEvent.click(screen.getByRole('button', { name: '执行退役' }));
  
  expect(screen.getByText('资产已退役')).toBeInTheDocument();
  expect(screen.getByTestId('asset-status')).toHaveTextContent('已退役');
});
```

#### ATB-3.4: 非审批人权限校验

```typescript
it('应该拒绝非审批人的操作', async () => {
  // 物理期待:
  // 1. 普通用户尝试审批
  // 2. 返回 403 Forbidden
  // 3. 错误码 INSUFFICIENT_PERMISSION
  // 4. 界面提示权限不足
  
  // 使用普通用户 token
  const regularUserToken = 'regular-user-token';
  
  render(
    <AuthProvider token={regularUserToken}>
      <RetirementApprovalPanel application={pendingApplication} />
    </AuthProvider>
  );
  
  // 审批按钮应该不可见或禁用
  expect(screen.queryByRole('button', { name: '批准' })).not.toBeInTheDocument();
});
```

### 4.4 ATB-4: 数据一致性

**测试场景**: 事务与并发控制

#### ATB-4.1: 并发审批冲突检测

```typescript
it('应该正确处理并发审批冲突', async () => {
  // 物理期待:
  // 1. 第二个审批请求返回 409 Conflict
  // 2. 使用乐观锁 version 字段检测
  // 3. 用户看到"申请已被处理"提示
  
  // 模拟两个审批请求同时到达
  const firstResponse = { status: 200, data: { status: 'APPROVED' }};
  const secondResponse = { status: 409, data: { error: 'CONCURRENT_MODIFICATION' }};
  
  mockPost
    .mockResolvedValueOnce(firstResponse)
    .mockResolvedValueOnce(secondResponse);
  
  // 模拟用户快速点击两次
  const approveButton = screen.getByRole('button', { name: '批准' });
  await userEvent.dblClick(approveButton);
  
  expect(screen.getByText('申请已被其他用户处理')).toBeInTheDocument();
});
```

#### ATB-4.2: 退役执行事务原子性

```typescript
it('应该保证退役执行的原子性', async () => {
  // 物理期待:
  // 1. 状态变更与资产更新在同一个事务中
  // 2. 失败时完整回滚
  // 3. 不会产生中间状态
  
  // 模拟事务失败
  mockExecute.mockRejectedValue(new Error('事务失败'));
  
  render(<RetirementExecutionPanel application={approvedApplication} />);
  
  await userEvent.click(screen.getByRole('button', { name: '执行退役' }));
  
  // 申请状态应该保持 APPROVED
  expect(screen.getByTestId('application-status')).toHaveTextContent('APPROVED');
  expect(screen.getByText('操作失败，请重试')).toBeInTheDocument();
});
```

---

## 5. 开发切入层级序列

### 5.1 Phase 2 开发任务分解

```
开发阶段    │ 任务项                    │ 预计工时  │ 依赖关系      │ 负责人
────────────┼───────────────────────────┼───────────┼──────────────┼────────
Day 1-2     │ 数据库模型设计与迁移       │ 8h        │ 无            │ Backend
            │ - retirement_applications │
            │ - approval_records        │
            │ - 状态机枚举定义           │
────────────┼───────────────────────────┼───────────┼──────────────┼────────
Day 3-4     │ 核心服务层实现            │ 12h       │ Day 1-2       │ Backend
            │ - RetirementService        │
            │ - 状态机状态转换逻辑       │
            │ - 审批链路服务             │
────────────┼───────────────────────────┼───────────┼──────────────┼────────
Day 5-6     │ API 路由层实现            │ 10h       │ Day 3-4       │ Backend
            │ - RESTful 接口定义         │
            │ - 请求验证与错误处理       │
            │ - 权限中间件集成           │
────────────┼───────────────────────────┼───────────┼──────────────┼────────
Day 7-8     │ 前端组件开发              │ 12h       │ Day 5-6       │ Frontend
            │ - RetirementApplicationForm│
            │ - 状态展示组件             │
            │ - 审批操作面板             │
────────────┼───────────────────────────┼───────────┼──────────────┼────────
Day 9       │ 集成测试与修复            │ 8h        │ Day 8         │ Full Team
            │ - ATB 测试用例执行         │
            │ - 缺陷修复                 │
────────────┼───────────────────────────┼───────────┼──────────────┼────────
Day 10      │ 文档与交付                │ 4h        │ Day 9         │ Full Team
            │ - API 文档更新            │
            │ - 操作手册                 │
```

### 5.2 技术栈定位

| 层级 | 技术选型 | 关键实现 | 文件 |
|------|----------|----------|------|
| 数据层 | SQLAlchemy + PostgreSQL | ORM 模型、迁移脚本 | `backend/models/asset_retirement.py` |
| 服务层 | Python Domain Service | 业务逻辑、状态机 | `src/services/retirement_service.py` |
| 接口层 | FastAPI Routes | REST API、Schema 验证 | `src/api/routers/retirement_router.py` |
| 前端层 | React + TypeScript | 表单组件 | `frontend/src/app/pages/Retirement/RetirementApplicationForm.tsx` |
| 测试层 | pytest + Playwright | ATB 覆盖、覆盖率 > 80% | `tests/e2e/retirement_user_journey.spec.ts` |

### 5.3 代码目录结构建议

```
src/
├── domain/
│   └── retirement/
│       ├── entities.py          # 退役申请实体
│       ├── state_machine.py     # 状态机定义
│       └── events.py            # 领域事件
├── application/
│   └── services/
│       ├── retirement_service.py
│       └── approval_service.py
├── infrastructure/
│   ├── repositories/
│   │   └── retirement_repository.py
│   └── database/
│       └── migrations/
├── api/
│   ├── routers/
│   │   └── retirement_router.py
│   └── middleware/
│       └── audit_logger.py
└── main.py                       # 应用入口

frontend/
└── src/
    └── app/
        └── pages/
            └── Retirement/
                ├── RetirementApplicationForm.tsx  # 退役申请表单
                ├── RetirementList.tsx              # 退役申请列表
                ├── RetirementDetail.tsx            # 退役申请详情
                ├── RetirementApprovalPanel.tsx     # 审批面板
                └── RetirementExecutionPanel.tsx    # 执行面板
```

### 5.4 前端组件规格 - RetirementApplicationForm.tsx

#### 5.4.1 组件接口定义

```typescript
// frontend/src/app/pages/Retirement/RetirementApplicationForm.tsx

import { Asset, RetirementApplication, User } from '@/types';

interface RetirementApplicationFormProps {
  /** 资产信息 */
  asset: Asset;
  /** 退役申请（编辑模式） */
  application?: RetirementApplication;
  /** 表单模式 */
  mode: 'create' | 'edit' | 'view';
  /** 提交回调 */
  onSubmit?: (data: RetirementFormData) => Promise<void>;
  /** 取消回调 */
  onCancel?: () => void;
}

interface RetirementFormData {
  asset_id: string;
  reason: string;
  planned_retirement_date: string;
  description?: string;
  attachments?: File[];
}
```

#### 5.4.2 组件状态管理

```typescript
// 组件内部状态
interface FormState {
  status: 'idle' | 'submitting' | 'success' | 'error';
  errors: Record<string, string>;
  draftData: RetirementFormData;
}
```

#### 5.4.3 表单字段规格

| 字段名 | 类型 | 必填 | 校验规则 | UI 组件 |
|--------|------|------|----------|---------|
| reason | string | ✅ | 1-500 字符 | TextArea |
| planned_retirement_date | date | ✅ | ≥ 今天 | DatePicker |
| description | string | ❌ | 0-1000 字符 | TextArea |
| attachments | File[] | ❌ | ≤ 5 个文件, 单个 ≤ 10MB | Upload |

---

## 6. 附录：状态机完整定义

### 6.1 状态枚举

```python
# src/domain/retirement/states.py

from enum import Enum
from typing import Set


class RetirementStatus(str, Enum):
    """
    资产退役申请状态枚举
    
    状态流转图:
    DRAFT -> PENDING_APPROVAL -> APPROVED -> RETIRED
                   ↓
              REJECTED/CANCELLED
                   ↓
                 DRAFT (修订)
    """
    DRAFT = "DRAFT"                    # 草稿
    PENDING_APPROVAL = "PENDING_APPROVAL"  # 待审批
    APPROVED = "APPROVED"              # 已批准
    REJECTED = "REJECTED"              # 已驳回
    CANCELLED = "CANCELLED"            # 已撤回
    RETIRED = "RETIRED"                # 已退役


# 允许的状态转换映射
ALLOWED_TRANSITIONS: dict[RetirementStatus, set[RetirementStatus]] = {
    RetirementStatus.DRAFT: {
        RetirementStatus.PENDING_APPROVAL,
        RetirementStatus.CANCELLED,
    },
    RetirementStatus.PENDING_APPROVAL: {
        RetirementStatus.APPROVED,
        RetirementStatus.REJECTED,
        RetirementStatus.CANCELLED,
    },
    RetirementStatus.APPROVED: {
        RetirementStatus.RETIRED,
    },
    RetirementStatus.REJECTED: {
        RetirementStatus.DRAFT,  # 修订重提
    },
    RetirementStatus.CANCELLED: set(),  # 终态
    RetirementStatus.RETIRED: set(),    # 终态
}
```

### 6.2 状态转换事件

```python
# src/domain/retirement/events.py

from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from .states import RetirementStatus


@dataclass
class RetirementEvent:
    """资产退役领域事件基类"""
    application_id: str
    timestamp: datetime
    actor_id: str


@dataclass
class ApplicationSubmitted(RetirementEvent):
    """申请提交事件"""
    pass


@dataclass
class ApplicationApproved(RetirementEvent):
    """申请批准事件"""
    comment: Optional[str] = None


@dataclass
class ApplicationRejected(RetirementEvent):
    """申请驳回事件"""
    reason: str


@dataclass
class RetirementExecuted(RetirementEvent):
    """退役执行事件"""
    asset_id: str
```

### 6.3 状态机实现

```python
# src/domain/retirement/state_machine.py

from typing import Optional
from .states import RetirementStatus, ALLOWED_TRANSITIONS
from .events import RetirementEvent


class RetirementStateMachine:
    """
    资产退役状态机
    
    负责管理退役申请的状态流转，确保状态转换的合法性。
    """
    
    def __init__(self, current_status: RetirementStatus):
        self._current_status = current_status
    
    @property
    def current_status(self) -> RetirementStatus:
        return self._current_status
    
    def can_transition(self, target_status: RetirementStatus) -> bool:
        """
        检查是否可以从当前状态转换到目标状态
        
        Args:
            target_status: 目标状态
            
        Returns:
            bool: 是否允许转换
        """
        allowed = ALLOWED_TRANSITIONS.get(self._current_status, set())
        return target_status in allowed
    
    def transition(self, target_status: RetirementStatus) -> None:
        """
        执行状态转换
        
        Args:
            target_status: 目标状态
            
        Raises:
            InvalidStateTransitionError: 不允许的状态转换
        """
        if not self.can_transition(target_status):
            raise InvalidStateTransitionError(
                f"Cannot transition from {self._current_status} to {target_status}"
            )
        self._current_status = target_status
```

---

## 7. 错误码定义

| 错误码 | HTTP 状态 | 描述 | 解决方案 |
|--------|-----------|------|----------|
| RETIRED_ASSET_NOT_ALLOWED | 400 | 资产已退役，无法申请 | 检查资产状态 |
| DUPLICATE_APPLICATION_EXISTS | 409 | 存在重复的退役申请 | 查看现有申请 |
| PENDING_ALLOCATION_EXISTS | 400 | 资产存在待处理分配 | 先完成分配处理 |
| INVALID_STATE_TRANSITION | 422 | 非法的状态转换 | 按正确流程操作 |
| INSUFFICIENT_PERMISSION | 403 | 权限不足 | 联系管理员 |
| CONCURRENT_MODIFICATION | 409 | 并发修改冲突 | 刷新后重试 |
| ASSET_NOT_FOUND | 404 | 资产不存在 | 检查资产ID |
| APPLICATION_NOT_FOUND | 404 | 申请不存在 | 检查申请ID |

---

*文档版本: v1.0 | 对应迭代: Iteration 1 | 最后更新: 2025-01-20*