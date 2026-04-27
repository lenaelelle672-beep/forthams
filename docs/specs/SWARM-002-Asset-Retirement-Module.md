# [SWARM-002] 资产报废退役模块 - 规格指导文档

## 需求与背景

### 业务背景

资产报废退役管理是企业资产管理生命周期中的关键收尾环节，贯穿资产从购置入账到最终处置的全流程。当资产因技术淘汰、损坏无法修复、功能不符合业务需求或法定年限到期等原因需要退出在役状态时，系统需提供规范的报废退役申请、审批及执行机制，确保资产处置有据可查、责任明确、流程合规。

### 功能目标

本模块核心目标包括：

1. **申请发起**：资产责任人或管理员可发起资产报废退役申请，提交至审批流程
2. **状态自动流转**：系统依据预定义规则自动执行资产状态变更，支持多级审批场景
3. **生命周期追溯**：生成完整的操作历史记录，支持变更链路审计与回溯

### 关键术语定义

| 术语 | 定义 |
|------|------|
| 资产报废 | 资产因物理损坏、严重老化或技术淘汰无法修复，需终止使用并处置 |
| 资产退役 | 资产虽可用但不再满足业务需求或合规要求，退出生产环境但不立即处置 |
| 生命周期记录 | 记录资产从入库到报废/退役全生命周期的状态变更、责任人变更及操作日志 |

---

## 当前 Phase 对应实施目标

### Phase 1：核心流程实现（当前迭代目标）

| 实施目标 | 交付物 | 优先级 |
|----------|--------|--------|
| 报废申请单创建 | 支持用户填写报废原因、期望处置方式、附件上传 | P0 |
| 资产状态流转引擎 | 有限状态机实现资产状态由 `在役` → `申请中` → `审批中` → `已退役`/`已报废` 的自动转换 | P0 |
| 生命周期历史记录写入 | 每次状态变更自动生成时间戳、操作人、前后状态快照记录 | P0 |
| 基础查询接口 | 提供按资产ID/时间段/操作人维度的生命周期记录查询 | P1 |
| 审批流程集成 | 与现有工作流引擎对接，支持审批通过/驳回状态回写 | P1 |

### Phase 2：增强功能（后续迭代）

- 批量报废退役处理
- 报废资产残值评估
- 处置收益关联
- 合规审计报告导出

### Phase 3：高级特性（远期规划）

- 智能推荐退役资产（基于使用率/寿命预测）
- 自动触发定期维护提醒
- 跨系统联动（财务系统销账集成）

---

## 边界约束

### 功能边界

| 约束维度 | 明确规定 |
|----------|----------|
| 申请权限 | 仅资产责任人（owner）或管理员（admin）角色可发起报废申请 |
| 资产前置状态 | 申请发起时资产必须处于 `在役(InService)` 或 `空闲(Idle)` 状态 |
| 状态不可逆 | 退役/报废状态为终态，状态变更为不可逆操作 |
| 审批前置 | 报废操作须经审批通过后方可执行状态变更 |
| 历史记录不可删除 | 所有生命周期记录写入后不可删除，仅支持追加修正说明 |
| 处置方式限定 | 支持的处置方式枚举：`转让`、`回收`、`销毁`、`捐赠` |
| 附件限制 | 单次申请附件数量 ≤ 5，单文件大小 ≤ 20MB |

### 技术边界

| 约束维度 | 明确规定 |
|----------|----------|
| 响应时限 | 单次状态变更操作响应时间 ≤ 500ms |
| 并发控制 | 使用乐观锁机制防止并发状态更新冲突 |
| 数据一致性 | 状态变更与历史记录写入须在同一事务内完成 |
| API 版本 | RESTful API 版本标识为 `v1`，路径前缀 `/api/v1/asset-retirement` |
| 事件驱动 | 状态变更完成后须发布领域事件 `AssetStatusChangedEvent` |

### 合规边界

| 约束维度 | 明确规定 |
|----------|----------|
| 审计要求 | 须记录操作用户的终端IP、浏览器UA、操作时间戳 |
| 权限分离 | 申请人与审批人不得为同一用户 |
| 敏感数据 | 资产原值、折旧净值等财务信息须脱敏后写入公开日志 |

### 禁止事项

- **禁止** 在 Phase 1 中实现批量报废功能（需 Phase 2）
- **禁止** 跳过审批流程直接执行状态变更
- **禁止** 允许普通用户（非责任人/非管理员）访问报废申请接口
- **禁止** 状态变更后修改历史记录的原始时间戳

---

## 验收测试基准 (ATB)

### ATB-1：报废申请单创建

| 测试编号 | 测试场景 | 输入 | 物理测试期待 |
|----------|----------|------|--------------|
| ATB-1.1 | 正常创建报废申请 | 资产ID、报废原因、期望处置方式、当前用户为责任人 | 返回 201，生成申请单ID，申请状态为 `申请中`，资产状态锁定为 `申请中` |
| ATB-1.2 | 非责任人创建申请 | 当前用户非资产owner且非admin | 返回 403 Forbidden，错误码 `PERMISSION_DENIED` |
| ATB-1.3 | 已退役资产二次申请 | 资产状态为 `已退役` | 返回 422 Unprocessable Entity，错误码 `INVALID_ASSET_STATE`，提示 "资产已退役不可重复申请" |
| ATB-1.4 | 必填字段校验 | 报废原因字段为空 | 返回 400 Bad Request，校验错误详情包含 `retirementReason: [required]` |
| ATB-1.5 | 处置方式枚举校验 | 处置方式为 "非法处置" | 返回 400 Bad Request，错误信息提示 "disposalMethod 须为 [转让/回收/销毁/捐赠] 之一" |
| ATB-1.6 | 附件上传正常 | 5个文件，每个 ≤ 20MB | 返回 201，附件IDs已关联至申请单 |
| ATB-1.7 | 附件超量校验 | 上传第6个文件 | 返回 400 Bad Request，错误码 `ATTACHMENT_LIMIT_EXCEEDED` |
| ATB-1.8 | 附件超 size 校验 | 单文件 21MB | 返回 413 Payload Too Large，提示文件大小限制 |

**自动化测试实现（pytest）**：
```python
class TestRetirementApplicationCreation:
    @pytest.mark.parametrize("test_id,scenario,expected_code", [
        ("ATB-1.1", "valid_application", 201),
        ("ATB-1.2", "unauthorized_user", 403),
        ("ATB-1.3", "already_retired_asset", 422),
        ("ATB-1.4", "missing_required_field", 400),
        ("ATB-1.5", "invalid_disposal_method", 400),
        ("ATB-1.6", "valid_attachments", 201),
        ("ATB-1.7", "exceed_attachment_count", 400),
        ("ATB-1.8", "exceed_attachment_size", 413),
    ])
    def test_application_creation_scenarios(self, test_id, scenario, expected_code):
        # 实现详见测试用例模块
        pass
```

---

### ATB-2：资产状态流转引擎

| 测试编号 | 测试场景 | 输入条件 | 物理测试期待 |
|----------|----------|----------|--------------|
| ATB-2.1 | 申请中 → 审批中流转 | 申请提交触发 | 资产状态自动变更为 `审批中`，流转时间戳精确到毫秒 |
| ATB-2.2 | 审批通过 → 已退役流转 | 审批人审核通过 | 资产状态变更为 `已退役`，终态标记设置 |
| ATB-2.3 | 审批通过 → 已报废流转 | 审批人审核通过且处置方式=销毁 | 资产状态变更为 `已报废`，残值清零标记 |
| ATB-2.4 | 审批驳回 → 在役回退 | 审批人驳回申请 | 资产状态回退至 `在役`，驳回原因写入历史记录 |
| ATB-2.5 | 并发状态更新冲突 | 两请求同时修改同一资产状态 | 返回 409 Conflict，后请求失败，乐观锁版本号校验生效 |
| ATB-2.6 | 状态变更事务一致性 | 状态变更成功但历史记录写入失败 | 事务回滚，资产状态保持原值，返回 500 |
| ATB-2.7 | 非法状态转换验证 | 尝试将 `已报废` 直接变更为 `在役` | 返回 422，错误码 `INVALID_STATE_TRANSITION`，提示转换路径不合法 |
| ATB-2.8 | 领域事件发布 | 状态变更成功后 | 消息队列接收到 `AssetStatusChangedEvent`，payload包含资产ID、旧状态、新状态、操作人 |

**自动化测试实现（pytest）**：
```python
class TestAssetStatusTransition:
    @pytest.mark.parametrize("transition,expected_state", [
        (ApplicationSubmitted(), "PENDING_APPROVAL"),
        (ApprovalApproved(), "RETIRED"),
        (ApprovalApproved(disposal="destroy"), "RETIRED"),
        (ApprovalRejected(), "IN_SERVICE"),
    ])
    def test_state_transitions(self, transition, expected_state):
        asset = Asset.objects.get(id=TEST_ASSET_ID)
        previous_state = asset.status
        service.process_transition(asset, transition)
        asset.refresh_from_db()
        assert asset.status == expected_state

    def test_concurrent_update_conflict(self):
        with concurrent.ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(update_asset_status, TEST_ASSET_ID, "PENDING_APPROVAL"),
                executor.submit(update_asset_status, TEST_ASSET_ID, "PENDING_APPROVAL"),
            ]
            results = [f.result() for f in futures]
        # 验证仅一个成功，另一个返回409
```

---

### ATB-3：生命周期历史记录生成

| 测试编号 | 测试场景 | 验证点 | 物理测试期待 |
|----------|----------|--------|--------------|
| ATB-3.1 | 状态变更记录完整性 | 新建申请触发状态变更 | 历史记录包含：资产ID、操作时间戳（ISO8601）、操作人ID、旧状态、新状态、触发事件类型 |
| ATB-3.2 | 审批记录关联 | 审批操作完成后 | 历史记录新增条目，关联审批单ID、审批结论（通过/驳回）、审批意见 |
| ATB-3.3 | 记录时间顺序 | 多次操作后查询 | 历史记录按时间戳升序排列，每条记录序号连续无断层 |
| ATB-3.4 | 记录不可删除 | 历史记录写入后尝试删除 | 无删除接口，DELETE请求返回 405 Method Not Allowed |
| ATB-3.5 | 追加修正说明 | 管理员对历史记录追加备注 | 可追加 `correctionNote` 字段，不修改原始时间戳 |
| ATB-3.6 | 审计信息记录 | 任意操作后 | 记录包含 `operatorIp`、`operatorUserAgent`、`operatorTimestamp` |
| ATB-3.7 | 批量查询过滤 | 按资产ID查询 | 仅返回目标资产的历史记录，无跨资产数据泄露 |
| ATB-3.8 | 时间范围查询 | 按 startDate/endDate 过滤 | 返回结果时间戳均在指定范围内 |

**自动化测试实现（pytest）**：
```python
class TestLifecycleHistory:
    def test_history_record_completeness(self):
        """ATB-3.1"""
        history = LifecycleHistory.objects.filter(asset_id=TEST_ASSET_ID).latest()
        required_fields = ['asset_id', 'timestamp', 'operator_id',
                          'previous_state', 'new_state', 'trigger_event']
        assert all(field in history.__dict__ for field in required_fields)

    def test_history_immutability(self):
        """ATB-3.4"""
        response = api_client.delete(
            f"/api/v1/asset-retirement/history/{TEST_HISTORY_ID}"
        )
        assert response.status_code == 405

    def test_audit_info_recorded(self):
        """ATB-3.6"""
        history = LifecycleHistory.objects.filter(asset_id=TEST_ASSET_ID).first()
        assert history.operator_ip is not None
        assert history.operator_user_agent is not None
        assert is_valid_iso8601(history.operator_timestamp)

    def test_history_time_ordering(self):
        """ATB-3.3"""
        histories = list(LifecycleHistory.objects.filter(
            asset_id=TEST_ASSET_ID
        ).order_by('timestamp').values_list('id', flat=True))
        # 验证ID与时间顺序一致
        expected_order = histories
        assert histories == expected_order
```

---

### ATB-4：审批流程集成

| 测试编号 | 测试场景 | 验证点 | 物理测试期待 |
|----------|----------|--------|--------------|
| ATB-4.1 | 审批通过回调 | 工作流回调 `/callback/approval` | 资产状态更新成功，历史记录写入成功，响应工作流ACK |
| ATB-4.2 | 审批驳回回调 | 工作流回调驳回 | 资产状态回退，历史记录写入驳回原因，响应工作流ACK |
| ATB-4.3 | 申请人/审批人同一校验 | 申请人尝试审批自己创建的申请 | 返回 400，错误码 `APPROVAL_SELF_FORBIDDEN` |
| ATB-4.4 | 重复回调幂等性 | 同一审批结果两次回调 | 第一次成功，第二次返回 200 但状态无变更，提示 "duplicated callback ignored" |
| ATB-4.5 | 未知申请单回调 | 回调携带不存在的申请单ID | 返回 404，错误码 `APPLICATION_NOT_FOUND` |
| ATB-4.6 | 回调签名校验 | 伪造X-Workflow-Signature头 | 返回 401 Unauthorized |

**自动化测试实现（pytest）**：
```python
class TestApprovalIntegration:
    @pytest.mark.parametrize("callback_type,expected_result", [
        ("approve", ("state_updated", "ACK_SUCCESS")),
        ("reject", ("state_rolled_back", "ACK_SUCCESS")),
    ])
    def test_workflow_callback(self, callback_type, expected_result):
        """ATB-4.1, ATB-4.2"""
        callback_payload = build_callback_payload(
            application_id=TEST_APP_ID,
            result=callback_type,
            approver_id=TEST_APPROVER_ID
        )
        response = api_client.post(
            "/api/v1/asset-retirement/callback/approval",
            data=callback_payload,
            headers={"X-Workflow-Signature": VALID_SIGNATURE}
        )
        assert response.status_code == 200

    def test_self_approval_forbidden(self):
        """ATB-4.3"""
        payload = build_callback_payload(
            application_id=TEST_APP_BY_USER_A,
            approver_id=get_user_a_id()  # 与申请人相同
        )
        response = api_client.post("/callback/approval", data=payload)
        assert response.status_code == 400
        assert response.json()["code"] == "APPROVAL_SELF_FORBIDDEN"
```

---

### ATB-5：基础查询接口

| 测试编号 | 测试场景 | 验证点 | 物理测试期待 |
|----------|----------|--------|--------------|
| ATB-5.1 | 按资产ID查询 | GET `/history?assetId=xxx` | 返回该资产完整历史记录列表 |
| ATB-5.2 | 按时间段查询 | GET `/history?startDate=...&endDate=...` | 返回指定时间范围内的所有资产变更记录 |
| ATB-5.3 | 按操作人查询 | GET `/history?operatorId=xxx` | 返回该操作人发起的所有变更记录 |
| ATB-5.4 | 分页查询 | GET `/history?page=2&pageSize=20` | 返回第21-40条记录，含分页元信息 |
| ATB-5.5 | 无权限查询 | 普通用户查询他人资产记录 | 返回 403，错误码 `ACCESS_DENIED` |
| ATB-5.6 | 管理员全量查询 | admin角色查询 | 返回全量记录（受分页限制） |
| ATB-5.7 | 字段脱敏 | 管理员查询含敏感信息记录 | 财务相关字段脱敏展示，如 `original_value: "***"` |

**自动化测试实现（Playwright E2E）**：
```python
class TestHistoryQueryE2E:
    @pytest.mark.parametrize("filter_type", ["assetId", "dateRange", "operatorId"])
    def test_query_filters(self, filter_type, authenticated_browser):
        """ATB-5.1, ATB-5.2, ATB-5.3"""
        page = authenticated_browser.new_page()
        query_params = get_filter_params(filter_type)
        page.goto(f"/asset-retirement/history?{urlencode(query_params)}")
        page.wait_for_selector(".history-table")
        rows = page.query_selector_all(".history-table tbody tr")
        assert len(rows) > 0
        # 验证过滤条件生效
        for row in rows:
            assert verify_filter_match(row, filter_type, query_params)

    def test_pagination(self, authenticated_browser):
        """ATB-5.4"""
        page = authenticated_browser.new_page()
        page.goto("/asset-retirement/history?page=2&pageSize=20")
        pagination_info = page.query_selector(".pagination-info").inner_text()
        assert "Showing 21-40" in pagination_info
```

---

### ATB-6：性能与安全基准

| 测试编号 | 测试场景 | 基准指标 | 物理测试期待 |
|----------|----------|----------|--------------|
| ATB-6.1 | 单次状态变更响应 | p99延迟 | ≤ 500ms |
| ATB-6.2 | 并发状态更新 | 100 QPS | 错误率 ≤ 1%，返回正确409冲突响应 |
| ATB-6.3 | 历史记录查询 | 分页查询20条 | ≤ 200ms |
| ATB-6.4 | SQL注入防护 | 输入 `' OR 1=1 --` | 参数化查询生效，无数据泄露，返回正常空结果 |
| ATB-6.5 | XSS防护 | 输入 `<script>alert(1)</script>` | 响应HTML转义，无脚本执行 |
| ATB-6.6 | 频率限制 | 1分钟内发起100次申请 | 第101次请求返回 429 Too Many Requests |

---

## 开发切入层级序列

### Phase 1 实施序列

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 0: 数据模型层                                              │
├─────────────────────────────────────────────────────────────────┤
│  0.1 创建资产状态枚举 (AssetStatus)                               │
│  0.2 扩展资产表增加状态字段 (status, version for乐观锁)           │
│  0.3 创建报废申请单模型 (RetirementApplication)                  │
│  0.4 创建生命周期历史记录模型 (LifecycleHistory)                  │
│  0.5 创建领域事件模型 (AssetStatusChangedEvent)                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: 领域逻辑层                                              │
├─────────────────────────────────────────────────────────────────┤
│  1.1 有限状态机实现 (StateTransitionEngine)                       │
│      - 状态转换规则定义                                           │
│      - 非法转换拦截                                               │
│      - 并发冲突检测                                               │
│  1.2 生命周期记录服务 (LifecycleRecorder)                         │
│      - 记录写入                                                   │
│      - 不可变性保障                                               │
│  1.3 权限校验服务 (PermissionService)                            │
│      - 申请人资格校验                                             │
│      - 审批人分离校验                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: 应用服务层                                              │
├─────────────────────────────────────────────────────────────────┤
│  2.1 报废申请应用服务 (RetirementApplicationService)             │
│      - 创建申请                                                   │
│      - 附件处理                                                   │
│      - 状态锁定                                                   │
│  2.2 审批回调应用服务 (ApprovalCallbackService)                  │
│      - 回调处理                                                   │
│      - 幂等性保障                                                 │
│      - 签名校验                                                   │
│  2.3 历史查询应用服务 (HistoryQueryService)                       │
│      - 多维过滤                                                   │
│      - 分页查询                                                   │
│      - 字段脱敏                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: 接口层                                                  │
├─────────────────────────────────────────────────────────────────┤
│  3.1 REST API 实现                                                │
│      - POST /applications         # 创建申请                     │
│      - GET /applications/{id}     # 查询申请详情                 │
│      - GET /history               # 查询历史记录                 │
│      - POST /callback/approval    # 审批回调                     │
│  3.2 事件发布 (EventPublisher)                                   │
│      - 状态变更事件发布                                           │
│      - 消息队列集成                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: 基础设施层                                              │
├─────────────────────────────────────────────────────────────────┤
│  4.1 数据库事务配置                                               │
│  4.2 乐观锁实现                                                   │
│  4.3 缓存策略 (如有性能需求)                                      │
│  4.4 日志与审计基础设施                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: 测试与验收                                              │
├─────────────────────────────────────────────────────────────────┤
│  5.1 单元测试 (pytest) - 各层级核心逻辑                           │
│  5.2 集成测试 - 跨层事务一致性                                    │
│  5.3 API测试 (pytest) - ATB全部场景                              │
│  5.4 E2E测试 (Playwright) - 完整用户旅程                          │
│  5.5 性能测试 - 基准指标验证                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 开发顺序约束

| 依赖关系 | 说明 |
|----------|------|
| Layer 0 → Layer 1 | 数据模型必须先完成，领域逻辑依赖模型定义 |
| Layer 1 → Layer 2 | 应用服务编排领域逻辑，必须先完成Layer 1 |
| Layer 2 → Layer 3 | 接口层调用应用服务，必须先完成Layer 2 |
| ATB-2依赖ATB-3 | 状态流转测试依赖历史记录模型存在 |
| 单元测试先行 | 每层开发完成后立即编写单元测试，测试通过后进入下层 |

### 关键技术决策点

| 决策点 | 选型建议 | 决策依据 |
|--------|----------|----------|
| 状态机实现 | 采用 `pytransitions` 库或自研有限状态机 | 根据复杂度评估，复杂流转规则建议自研 |
| 事务管理 | 统一使用数据库事务装饰器 `@transaction.atomic` | 确保状态+历史一致性 |
| 幂等键 | 使用 `application_id + callback_type + timestamp` 组合 | 防止重复回调 |
| 历史表分区 | 按 `asset_id` 哈希分区或按月分区 | 视数据量评估 |
| 事件队列 | RabbitMQ / Kafka（待定） | 与现有基础设施对齐 |

---

## 附录

### 参考文档

- `plan.md` - 项目整体规划
- `swarm-001.md` - 资产管理基础模块
- `swarm-003.md` - 财务系统集成模块（待规划）

### 变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0 | TBD | 初始版本创建 | - |