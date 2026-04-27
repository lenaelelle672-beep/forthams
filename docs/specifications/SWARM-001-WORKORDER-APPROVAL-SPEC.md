# SWARM-001 工单审批流程 - 规格指导文档

> 版本: 1.0.0  
> 创建日期: 2024  
> 状态: 草稿

---

## 1. 需求与背景

### 1.1 业务场景

工单审批流程是资产管理系统中处理各类申请（请假、报销、采购、设备领用、资产报废等）的核心业务流程。本系统需支持用户在线提交工单、实时追踪审批进度、自动化状态流转以及及时的通知推送。

### 1.2 核心痛点

| 痛点 | 描述 |
|------|------|
| 状态不透明 | 传统流程审批进度难以追踪，用户无法获知当前审批节点 |
| 通知滞后 | 审批人无法及时获知待审批事项，审批周期过长 |
| 缺乏追溯 | 审批历史记录分散，难以形成完整的审计轨迹 |
| 规则僵化 | 审批规则硬编码，新流程配置困难 |

### 1.3 目标用户

| 角色 | 权限范围 |
|------|----------|
| 申请人 (Applicant) | 提交工单、查看本人工单状态、撤回本人待审批工单 |
| 审批人 (Approver) | 查看待审批列表、审批/拒绝工单、查看审批历史 |
| 管理员 (Admin) | 配置审批流程模板、查看全部工单数据、管理审批规则 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 1: 核心审批链路（当前迭代）

| 功能模块 | 具体目标 | 交付物 |
|----------|----------|--------|
| 工单创建 | 支持用户填写工单表单并提交 | `WorkOrder.create()` |
| 状态机流转 | 实现 `Pending → Approved/Rejected` 基础流转 | `StatusStateMachine` |
| 审批通知 | 审批完成后触发站内消息通知 | `NotificationService` |
| 状态查询 | 用户可查看本人工单的当前状态及历史 | `ApprovalChain.get_history()` |

### 2.2 Phase 2: 增强功能（后续迭代）

| 功能模块 | 描述 |
|----------|------|
| 多级审批链 | 支持串行/并行多级审批节点配置 |
| 审批委托 | 审批人可委托他人代为审批 |
| 工单催办 | 申请人可对待审批工单发送催办提醒 |
| 条件分支 | 根据工单属性（如金额）自动选择审批路径 |

### 2.3 Phase 3: 高级特性（远期规划）

| 功能模块 | 描述 |
|----------|------|
| SLA 监控 | 审批时效统计与告警 |
| 移动端适配 | 审批操作移动端支持 |
| 数据报表 | 审批效率统计分析 |

---

## 3. 边界约束

### 3.1 技术边界

| 约束项 | 限制条件 | 说明 |
|--------|----------|------|
| 单次工单附件数 | ≤ 5 个文件 | 超出提示用户分批提交 |
| 单文件大小限制 | ≤ 10MB | 超出拒绝上传 |
| 自定义字段上限 | ≤ 20 个 | 超出提示管理员配置 |
| 审批链路深度 | Phase 1 仅支持单级 | 多级审批见 Phase 2 |
| 并发审批控制 | 同一工单同时仅允许 1 人操作 | 悲观锁保证 |
| 通知渠道 | Phase 1 仅支持站内通知 | 邮件/短信见后续迭代 |

### 3.2 数据边界

| 约束项 | 限制条件 |
|--------|----------|
| 工单数据保留 | 永久存储（软删除后保留 90 天） |
| 审批历史不可篡改 | 状态变更记录仅追加，不修改 |
| 操作审计要求 | 所有状态变更需记录：操作人、时间戳、变更原因 |
| 数据一致性 | 状态变更与审批记录必须在同一事务内完成 |

### 3.3 安全边界

| 约束项 | 描述 |
|--------|------|
| 鉴权要求 | 所有 API 必须携带有效 Token |
| 权限隔离 | 用户仅能查看/操作本人发起或有审批权限的工单 |
| 敏感字段脱敏 | 金额等敏感信息在日志和响应中脱敏展示 |
| 防篡改 | 审批记录需包含数字签名或哈希校验 |

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试 (pytest)

#### 4.1.1 状态机流转测试

```python
# tests/unit/test_retirement_sm.py

class TestStatusStateMachine:
    """状态机核心逻辑测试"""

    def test_pending_to_approved_transition(self):
        """
        验收标准: 状态为 PENDING 时可流转至 APPROVED
        AC-001
        """
        sm = StatusStateMachine(initial_state="PENDING")
        result = sm.transition(event="APPROVE", role="approver")
        assert result.current_state == "APPROVED"
        assert result.timestamp is not None

    def test_pending_to_rejected_transition(self):
        """
        验收标准: 状态为 PENDING 时可流转至 REJECTED
        AC-001
        """
        sm = StatusStateMachine(initial_state="PENDING")
        result = sm.transition(event="REJECT", role="approver", comment="不符合条件")
        assert result.current_state == "REJECTED"
        assert result.metadata["comment"] == "不符合条件"

    def test_approved_is_final_state(self):
        """
        验收标准: APPROVED 为终态，不可再次流转
        AC-001
        """
        sm = StatusStateMachine(initial_state="APPROVED")
        with pytest.raises(InvalidTransitionError):
            sm.transition(event="REJECT", role="approver")

    def test_rejected_is_final_state(self):
        """
        验收标准: REJECTED 为终态，不可再次流转
        AC-001
        """
        sm = StatusStateMachine(initial_state="REJECTED")
        with pytest.raises(FinalStateError):
            sm.transition(event="APPROVE", role="approver")

    def test_get_available_actions(self):
        """
        验收标准: 状态机能正确返回当前状态下可执行的操作
        AC-001
        """
        sm = StatusStateMachine(initial_state="PENDING")
        actions = sm.get_available_actions(role="approver")
        assert "APPROVE" in actions
        assert "REJECT" in actions
```

#### 4.1.2 权限校验测试

```python
# tests/unit/test_approval_chain.py

class TestApprovalChain:
    """审批链权限校验测试"""

    def test_applicant_cannot_approve_own_order(self):
        """
        验收标准: 申请人不能审批自己提交的工单
        AC-001
        """
        chain = ApprovalChain(
            requester_id="user_001",
            approval_chain=[{"role": "approver", "user_id": "user_002"}]
        )
        assert chain.can_approve(order_creator="user_001", approver_id="user_001") is False

    def test_authorized_approver_can_approve(self):
        """
        验收标准: 授权审批人可执行审批操作
        AC-001
        """
        chain = ApprovalChain(
            requester_id="user_001",
            approval_chain=[{"role": "approver", "user_id": "user_002"}]
        )
        assert chain.can_approve(order_creator="user_001", approver_id="user_002") is True

    def test_unauthorized_user_blocked(self):
        """
        验收标准: 非审批人无法执行审批操作
        AC-001
        """
        chain = ApprovalChain(
            requester_id="user_001",
            approval_chain=[{"role": "approver", "user_id": "user_002"}]
        )
        assert chain.can_approve(order_creator="user_001", approver_id="user_003") is False
```

#### 4.1.3 通知机制测试

```python
# tests/unit/test_notification_service.py

class TestNotificationService:
    """通知服务测试"""

    @pytest.mark.asyncio
    async def test_notification_sent_on_approval(self):
        """
        验收标准: 审批完成后生成站内通知
        AC-001
        """
        service = NotificationService()
        await service.send_approval_notification(
            order_id="order_001",
            result="APPROVED",
            recipient_id="user_001"
        )
        
        notification = await service.get_notification(order_id="order_001")
        assert notification is not None
        assert notification.type == NotificationType.APPROVAL_RESULT
        assert "order_001" in notification.content

    @pytest.mark.asyncio
    async def test_notification_sent_on_rejection(self):
        """
        验收标准: 审批拒绝后发送通知并包含拒绝原因
        AC-001
        """
        service = NotificationService()
        await service.send_approval_notification(
            order_id="order_002",
            result="REJECTED",
            recipient_id="user_001",
            comment="材料不完整"
        )
        
        notification = await service.get_notification(order_id="order_002")
        assert "材料不完整" in notification.content
```

---

### 4.2 集成测试 (pytest + pytest-asyncio)

#### 4.2.1 端到端工单流程测试

```python
# tests/services/test_retirement_service.py

class TestRetirementServiceE2E:
    """资产报废服务端到端测试"""

    @pytest.mark.asyncio
    async def test_full_approval_flow(self):
        """
        验收标准: 完整审批流程 - 创建→审批→通知→状态更新
        AC-001, AC-004
        """
        service = RetirementService()
        
        # 1. 创建工单
        request = RetirementRequest(
            asset_id="asset_001",
            reason="设备老化需报废",
            requester_id="user_001"
        )
        order = await service.create_retirement_request(request)
        assert order.state == "PENDING"
        order_id = order.id
        
        # 2. 审批人审批
        result = await service.approve(
            order_id=order_id,
            approver_id="user_002",
            comment="同意报废"
        )
        assert result.state == "APPROVED"
        
        # 3. 验证状态变更
        updated_order = await service.get_order(order_id)
        assert updated_order.state == "APPROVED"
        
        # 4. 验证通知已发送
        notification = await service.get_notification(order_id=order_id)
        assert notification is not None
        assert notification.type == NotificationType.APPROVAL_RESULT

    @pytest.mark.asyncio
    async def test_concurrent_approval_only_one_succeeds(self):
        """
        验收标准: 同一工单同时审批，仅一操作成功
        AC-001
        """
        service = RetirementService()
        order = await service.create_retirement_request(...)
        
        results = await asyncio.gather(
            service.approve(order.id, "approver_1"),
            service.approve(order.id, "approver_2"),
            return_exceptions=True
        )
        
        success_count = sum(1 for r in results if not isinstance(r, Exception) and r.state == "APPROVED")
        assert success_count == 1, "仅允许一个审批操作成功"
```

#### 4.2.2 API 集成测试

```python
# tests/api/test_retirement_api.py

class TestRetirementAPI:
    """资产报废 API 测试"""

    async def test_create_retirement_order(self, client: TestClient):
        """
        验收标准: POST /api/v1/retirement 创建工单返回 201
        AC-001, AC-002
        """
        response = await client.post("/api/v1/retirement", json={
            "asset_id": "asset_001",
            "reason": "设备老化",
            "requester_id": "user_001"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["state"] == "PENDING"
        assert "id" in data

    async def test_approve_order(self, client: TestClient):
        """
        验收标准: POST /api/v1/retirement/{id}/approve 审批工单
        AC-001, AC-002
        """
        # 创建工单
        create_resp = await client.post("/api/v1/retirement", json={...})
        order_id = create_resp.json()["id"]
        
        # 审批工单
        approve_resp = await client.post(
            f"/api/v1/retirement/{order_id}/approve",
            json={"approver_id": "user_002", "comment": "同意"}
        )
        assert approve_resp.status_code == 200
        assert approve_resp.json()["state"] == "APPROVED"

    async def test_get_order_history(self, client: TestClient):
        """
        验收标准: GET /api/v1/retirement/{id}/history 返回审批历史
        AC-001
        """
        order_id = "order_001"
        response = await client.get(f"/api/v1/retirement/{order_id}/history")
        assert response.status_code == 200
        history = response.json()
        assert isinstance(history, list)
        assert all("timestamp" in record for record in history)
```

---

### 4.3 E2E 测试 (Playwright)

#### 4.3.1 用户提交流程测试

```typescript
// tests/e2e/retirement_flow.spec.ts

test.describe('工单审批流程', () => {
  test('用户可提交报废申请并追踪状态', async ({ page }) => {
    // 1. 登录
    await page.goto('/login');
    await page.fill('#username', 'test_user');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    
    // 2. 提交工单
    await page.goto('/retirement/create');
    await page.fill('#asset-id', 'asset_001');
    await page.fill('#reason', '设备老化需报废');
    await page.click('button[type="submit"]');
    
    // 3. 验证提交成功
    await expect(page.locator('.toast-message')).toHaveText('提交成功');
    await expect(page.locator('.status-badge')).toHaveText('待审批');
    
    // 4. 查看工单列表
    await page.goto('/retirement/my-list');
    await expect(page.locator('.order-item').first).toContainText('设备老化');
  });
  
  test('审批人可查看并审批工单', async ({ page }) => {
    // 1. 审批人登录
    await page.goto('/login');
    await page.fill('#username', 'approver');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    
    // 2. 进入待审批列表
    await page.goto('/approver/pending');
    await expect(page.locator('.pending-count')).toHaveText('1');
    
    // 3. 执行审批
    await page.click('.order-item:first-child .approve-btn');
    await page.fill('textarea[name="comment"]', '同意报废');
    await page.click('#confirm-approve');
    
    // 4. 验证状态更新
    await expect(page.locator('.toast-message')).toHaveText('审批成功');
    await expect(page.locator('.order-status')).toHaveText('已通过');
  });
});
```

---

### 4.4 测试覆盖率要求

| 测试类型 | 覆盖率门槛 | 关键路径 |
|----------|------------|----------|
| 状态机核心逻辑 | 100% 分支覆盖 | `StatusStateMachine.transition()` |
| 权限校验逻辑 | 100% 分支覆盖 | `ApprovalChain.can_approve()` |
| 服务层集成 | 80% 分支覆盖 | `RetirementService` |
| API 端点 | 请求/响应格式 100% 覆盖 | 所有 `/api/v1/retirement/*` |
| E2E 核心流程 | 主路径 100% 覆盖 | 创建→审批→通知 |

---

## 5. 开发切入层级序列

### 5.1 层级架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    L5: 前端交互层                             │
│  pages/retirement/*.tsx  |  components/approval/*.tsx        │
├─────────────────────────────────────────────────────────────┤
│                    L4: API 接口层                             │
│  api/routers/retirement_router.py                            │
├─────────────────────────────────────────────────────────────┤
│                    L3: 通知机制层                             │
│  services/notification_service.py                            │
├─────────────────────────────────────────────────────────────┤
│                    L2: 业务逻辑层                             │
│  services/retirement_service.py  |  state_machine/*.py      │
├─────────────────────────────────────────────────────────────┤
│                    L1: 数据模型层                             │
│  models/retirement_request.py  |  models/approval_chain.py   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 L1: 数据模型层

```
src/
├── models/
│   ├── enums.py                       # 状态枚举定义
│   ├── retirement_request.py          # 报废请求实体
│   ├── approval_chain.py              # 审批链实体
│   └── retirement_history.py          # 审批历史记录
```

**交付物**:
- [ ] `StatusEnum` 枚举定义（`PENDING`, `APPROVED`, `REJECTED`）
- [ ] `RetirementRequest` 数据类
- [ ] `ApprovalChain` 审批链模型
- [ ] `RetirementHistory` 历史记录模型

**前置依赖**: 需求评审通过

---

### 5.3 L2: 状态机与业务规则层

```
src/
├── state_machine/
│   ├── retirement_state_machine.py    # 资产报废状态机
│   ├── transitions.py                 # 状态流转定义
│   └── guards.py                      # 流转条件守卫
├── services/
│   ├── retirement_service.py          # 报废服务核心逻辑
│   └── approval_chain_service.py      # 审批链服务
```

**交付物**:
- [ ] `StatusStateMachine` 状态机引擎
- [ ] `RetirementService.create_retirement_request()` - 创建报废申请
- [ ] `RetirementService.approve()` - 审批通过
- [ ] `RetirementService.reject()` - 审批拒绝
- [ ] `RetirementService.get_progress()` - 获取审批进度
- [ ] 状态机单元测试通过

**前置依赖**: L1 完成

---

### 5.4 L3: 通知机制层

```
src/
├── services/
│   └── notification_service.py        # 通知服务
```

**交付物**:
- [ ] `NotificationService.send_approval_notification()` - 发送审批通知
- [ ] `NotificationService.get_notification()` - 查询通知
- [ ] 通知模板定义
- [ ] 通知服务单元测试通过

**前置依赖**: L1 完成

---

### 5.5 L4: API 接口层

```
src/
├── api/
│   ├── routers/
│   │   └── retirement_router.py       # 报废相关路由
│   ├── schemas/
│   │   ├── retirement_request.py      # 请求/响应 schema
│   │   └── approval.py                # 审批操作 schema
│   └── deps/
│       └── auth.py                    # 认证依赖
```

**交付物**:
- [ ] `POST /api/v1/retirement` - 创建报废申请
- [ ] `GET /api/v1/retirement/{id}` - 获取工单详情
- [ ] `POST /api/v1/retirement/{id}/approve` - 审批通过
- [ ] `POST /api/v1/retirement/{id}/reject` - 审批拒绝
- [ ] `GET /api/v1/retirement/{id}/history` - 获取审批历史
- [ ] API 集成测试通过

**前置依赖**: L2、L3 完成

---

### 5.6 L5: 前端交互层

```
frontend/
├── src/
│   ├── pages/
│   │   ├── retirement/
│   │   │   ├── CreatePage.tsx          # 报废申请创建页
│   │   │   ├── DetailPage.tsx         # 工单详情页
│   │   │   └── MyListPage.tsx         # 我的申请列表页
│   │   └── approver/
│   │       └── PendingPage.tsx        # 待审批列表页
│   └── components/
│       ├── retirement/
│       │   ├── RetirementForm.tsx     # 申请表单组件
│       │   └── StatusBadge.tsx        # 状态徽章组件
│       └── approval/
│           └── ApprovalActions.tsx    # 审批操作组件
```

**交付物**:
- [ ] 报废申请创建页面
- [ ] 工单详情页面（含审批历史）
- [ ] 我的申请列表页面
- [ ] 审批人待审批列表页面
- [ ] 审批操作组件
- [ ] E2E 测试通过

**前置依赖**: L4 API 联调完成

---

### 5.7 开发顺序矩阵

| 阶段 | 层级 | 任务 | 输出物 | 依赖 |
|------|------|------|--------|------|
| S1 | L1 | 数据库建模与实体定义 | `models/*.py` | 需求确认 |
| S2 | L2 | 状态机引擎实现 | `state_machine/*.py` | S1 |
| S3 | L2 | 业务服务层开发 | `services/retirement_service.py` | S2 |
| S4 | L3 | 通知服务实现 | `services/notification_service.py` | S1 |
| S5 | L4 | API 路由开发 | `api/routers/retirement_router.py` | S3, S4 |
| S6 | L4 | API 集成测试 | `tests/api/test_retirement_api.py` | S5 |
| S7 | L5 | 前端页面开发 | `pages/retirement/*.tsx` | S5 |
| S8 | L5 | E2E 测试 | `tests/e2e/retirement_flow.spec.ts` | S7 |

---

## 6. 关键技术约束

### 6.1 状态机实现

- 必须使用 `transitions` 或 `python-statemachine` 开源库
- 禁止手写状态流转逻辑
- 状态定义必须与 `models/enums.py` 保持一致

### 6.2 API 版本控制

- 所有接口统一使用 `/api/v1/` 前缀
- 响应格式统一使用 `Result<T>` 包装

### 6.3 异步处理

- 通知发送必须异步执行，不阻塞主流程
- 使用 `@asyncify` 装饰器或 `asyncio` 机制

### 6.4 事务保证

- 状态变更与审批记录必须在同一事务内完成
- 使用数据库事务或分布式事务框架

---

## 7. 参考文档

| 文档 | 路径 |
|------|------|
| 数据库 ER 图 | `docs/database/er-diagram.md` |
| API 接口文档 | `docs/api/swagger.yaml` |
| 状态机设计图 | `docs/design/state-machine.puml` |
| 审批流程图 | `docs/design/approval-flow.puml` |