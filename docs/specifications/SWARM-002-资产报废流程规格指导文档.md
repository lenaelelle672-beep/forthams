# SWARM-002 [资产报废流程] 规格指导文档

---

## 需求与背景

### 业务场景

资产管理系统需覆盖资产全生命周期管理。资产在完成使用寿命周期或因故障损毁无法修复后，需经过规范化的报废审批流程，标记为报废状态并从在役资产台账中移出。

### 业务价值

- 建立标准化的资产退役机制，防止已报废资产继续在系统中流转
- 保留完整的资产状态变更历史，满足审计追溯要求
- 实时同步资产台账数据，确保账实一致

### 依赖前置条件

- 资产台账基础数据已建立（参见 SWARM-001）
- 用户认证与权限体系已就绪

---

## 当前 Phase 对应实施目标

### 参照 plan.md Phase 拆解

| Phase ID | Phase 名称 | 状态 | 说明 |
|----------|-----------|------|------|
| Phase 1 | 资产台账基础管理 | 已完成 | 资产CRUD、基础查询 |
| **Phase 2** | **资产报废流程** | **本次迭代** | **SWARM-002 实施范围** |
| Phase 3 | 资产调拨流程 | 待实施 | - |
| Phase 4 | 资产维保流程 | 待实施 | - |

### 本次 Phase 2 实施目标

1. **报废申请提交**：支持用户对状态为"退役"的资产提交报废申请
2. **状态变更历史记录**：系统自动生成资产状态变更流水日志
3. **审批流程**：支持审批人对报废申请进行通过/驳回操作
4. **台账状态同步**：审批通过后自动更新资产台账状态为"已报废"

---

## 边界约束

### 功能边界

| 约束项 | 具体约束 |
|--------|----------|
| 申请前置状态 | 仅允许状态为"退役"的资产提交报废申请 |
| 申请人权限 | 需具备 `asset:apply_retire` 权限 |
| 审批人权限 | 需具备 `asset:approve_scrap` 权限 |
| 审批方式 | 单级审批，不支持多级会签 |
| 不可逆约束 | 报废状态为终态，不可变更回退役或在役 |
| 数据完整性 | 报废操作必须原子性完成，否则事务回滚 |

### 非功能约束

- 单次报废申请处理响应时间 ≤ 2s
- 状态变更历史查询支持按资产编号、时间范围筛选
- 系统需记录操作人、操作时间、操作类型、变更前后状态

### 外部依赖

- 依赖通知服务发送审批结果通知（非本次迭代范围，可降级处理）

---

## 验收测试基准 (ATB)

### ATB-1: 报废申请提交

| 测试编号 | 测试描述 | 物理测试方法 | 预期结果 |
|----------|----------|--------------|----------|
| ATB-1.1 | 正常提交报废申请 | POST `/api/assets/{asset_id}/scrap-requests` | 返回 201，生成 scrap_request 记录，状态为 pending |
| ATB-1.2 | 对非退役状态资产提交申请 | POST `/api/assets/{asset_id}/scrap-requests`（资产状态为"在役"） | 返回 400，错误码 `ASSET_STATUS_INVALID` |
| ATB-1.3 | 重复提交报废申请 | 同一资产两次 POST | 返回 409，错误码 `SCRAP_REQUEST_DUPLICATE` |
| ATB-1.4 | 提交时自动生成状态变更历史 | POST 后查询 `/api/assets/{asset_id}/status-history` | 新增 type="SCRAP_APPLY", from_status="retired", to_status="pending" 记录 |
| ATB-1.5 | 无权限用户提交申请 | 以无 `asset:apply_retire` 权限用户请求 | 返回 403 |

**pytest 示例代码片段**：

```python
class TestScrapRequestSubmission:
    def test_submit_scrap_request_success(self, client, auth_token, retired_asset):
        response = client.post(
            f"/api/assets/{retired_asset.id}/scrap-requests",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"reason": "设备老化无法修复"}
        )
        assert response.status_code == 201
        data = response.get_json()
        assert data["status"] == "pending"
        assert data["reason"] == "设备老化无法修复"

    def test_cannot_submit_for_non_retired_asset(self, client, auth_token, active_asset):
        response = client.post(
            f"/api/assets/{active_asset.id}/scrap-requests",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"reason": "测试"}
        )
        assert response.status_code == 400
        assert response.get_json()["code"] == "ASSET_STATUS_INVALID"
```

---

### ATB-2: 审批流程

| 测试编号 | 测试描述 | 物理测试方法 | 预期结果 |
|----------|----------|--------------|----------|
| ATB-2.1 | 审批通过 | PUT `/api/scrap-requests/{request_id}/approve` | 返回 200，request 状态更新为 approved |
| ATB-2.2 | 审批驳回 | PUT `/api/scrap-requests/{request_id}/reject` | 返回 200，request 状态更新为 rejected |
| ATB-2.3 | 驳回时可选填写理由 | PUT with `reject_reason` | 返回 200，驳回理由被记录 |
| ATB-2.4 | 重复审批同一申请 | 同一 request 两次 approve | 第二次返回 409，错误码 `REQUEST_ALREADY_PROCESSED` |
| ATB-2.5 | 无权限用户审批 | 以无 `asset:approve_scrap` 权限用户请求 | 返回 403 |

**pytest 示例代码片段**：

```python
class TestScrapRequestApproval:
    def test_approve_scrap_request(self, client, auth_token, scrap_request):
        response = client.put(
            f"/api/scrap-requests/{scrap_request.id}/approve",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert response.get_json()["status"] == "approved"

    def test_reject_with_reason(self, client, auth_token, scrap_request):
        response = client.put(
            f"/api/scrap-requests/{scrap_request.id}/reject",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"reason": "资产尚有使用价值"}
        )
        assert response.status_code == 200
        assert response.get_json()["reject_reason"] == "资产尚有使用价值"
```

---

### ATB-3: 资产状态同步

| 测试编号 | 测试描述 | 物理测试方法 | 预期结果 |
|----------|----------|--------------|----------|
| ATB-3.1 | 审批通过后资产状态变更为已报废 | approve 后 GET `/api/assets/{asset_id}` | asset.status == "scrapped" |
| ATB-3.2 | 审批通过后生成状态变更历史 | approve 后查询 status-history | 新增 type="SCRAP_APPROVED" 记录 |
| ATB-3.3 | 审批通过为原子操作 | approve 操作开启事务，注入失败 | 事务回滚，资产状态不变更 |
| ATB-3.4 | 驳回后资产状态保持退役 | reject 后 GET asset | asset.status == "retired"（未变更） |

**pytest 示例代码片段**：

```python
class TestAssetStatusSync:
    def test_asset_status_updated_after_approval(self, client, auth_token, scrap_request, asset_id):
        # Approve the scrap request
        client.put(f"/api/scrap-requests/{scrap_request.id}/approve",
                   headers={"Authorization": f"Bearer {auth_token}"})
        
        # Verify asset status changed
        response = client.get(f"/api/assets/{asset_id}")
        assert response.status_code == 200
        assert response.get_json()["status"] == "scrapped"

    def test_status_history_recorded(self, client, auth_token, scrap_request, asset_id):
        client.put(f"/api/scrap-requests/{scrap_request.id}/approve",
                   headers={"Authorization": f"Bearer {auth_token}"})
        
        response = client.get(f"/api/assets/{asset_id}/status-history")
        history = response.get_json()["items"]
        
        approval_records = [h for h in history if h["type"] == "SCRAP_APPROVED"]
        assert len(approval_records) == 1
```

---

### ATB-4: 状态变更历史查询

| 测试编号 | 测试描述 | 物理测试方法 | 预期结果 |
|----------|----------|--------------|----------|
| ATB-4.1 | 按资产编号查询历史 | GET `/api/assets/{asset_id}/status-history` | 返回该资产的完整变更记录列表 |
| ATB-4.2 | 按时间范围筛选 | GET with `?start_time=&end_time=` | 仅返回指定时间范围内的记录 |
| ATB-4.3 | 分页查询 | GET with `?page=&page_size=` | 返回分页结果，包含 total, page, page_size |
| ATB-4.4 | 历史记录包含操作人信息 | 查询结果检查 | 每条记录包含 operator, operated_at 字段 |

**pytest 示例代码片段**：

```python
class TestStatusHistoryQuery:
    def test_query_by_asset_id(self, client, asset_id):
        response = client.get(f"/api/assets/{asset_id}/status-history")
        assert response.status_code == 200
        assert "items" in response.get_json()

    def test_time_range_filter(self, client, asset_id):
        response = client.get(
            f"/api/assets/{asset_id}/status-history",
            query_string={"start_time": "2024-01-01T00:00:00Z", 
                         "end_time": "2024-12-31T23:59:59Z"}
        )
        assert response.status_code == 200
        
    def test_pagination(self, client, asset_id):
        response = client.get(
            f"/api/assets/{asset_id}/status-history",
            query_string={"page": 1, "page_size": 10}
        )
        data = response.get_json()
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
```

---

### ATB-5: 边界条件验证

| 测试编号 | 测试描述 | 物理测试方法 | 预期结果 |
|----------|----------|--------------|----------|
| ATB-5.1 | 报废状态不可逆变更 | 尝试将报废资产状态改回其他状态 | API 返回 400，错误码 `SCRAPPED_STATUS_IMMUTABLE` |
| ATB-5.2 | 资产不存在时的错误处理 | 对不存在的 asset_id 操作 | 返回 404，错误码 `ASSET_NOT_FOUND` |
| ATB-5.3 | 申请不存在时的审批处理 | 对不存在的 request_id 审批 | 返回 404，错误码 `REQUEST_NOT_FOUND` |

---

## 开发切入层级序列

### Level 1: 数据模型层

```
步骤 1.1: 扩展 Asset 模型
├── 新增字段: status (增加 "scrapped" 枚举值)
└── 约束: 报废状态不可回退

步骤 1.2: 新增 ScrapRequest 模型
├── 字段: id, asset_id, applicant_id, reason, status, reject_reason, created_at, updated_at
├── 状态枚举: pending, approved, rejected
└── 索引: asset_id, status

步骤 1.3: 新增 AssetStatusHistory 模型
├── 字段: id, asset_id, type, from_status, to_status, operator_id, operated_at, extra_data
├── 类型枚举: SCRAP_APPLY, SCRAP_APPROVED, SCRAP_REJECTED
└── 索引: asset_id, operated_at
```

### Level 2: Repository 层

```
步骤 2.1: ScrapRequestRepository
├── create_scrap_request(asset_id, applicant_id, reason)
├── find_by_id(request_id)
├── find_pending_by_asset_id(asset_id)
└── update_status(request_id, status, reject_reason=None)

步骤 2.2: AssetStatusHistoryRepository
├── create_history(asset_id, type, from_status, to_status, operator_id, extra_data)
├── find_by_asset_id(asset_id, start_time, end_time, page, page_size)
└── find_by_asset_id_all(asset_id)

步骤 2.3: AssetRepository 扩展
├── find_by_id_with_status_check(asset_id, allowed_statuses)
└── update_status(asset_id, new_status)
```

### Level 3: Service 层

```
步骤 3.1: ScrapService
├── submit_scrap_request(asset_id, applicant_id, reason) -> ScrapRequest
│   └── 前置校验: 资产存在、状态为退役、无待处理申请
│   └── 副作用: 记录状态变更历史
│
├── approve_scrap_request(request_id, approver_id) -> ScrapRequest
│   └── 前置校验: 申请存在、状态为pending
│   └── 副作用: 更新资产状态为scrapped、记录状态变更历史
│
├── reject_scrap_request(request_id, approver_id, reason) -> ScrapRequest
│   └── 前置校验: 申请存在、状态为pending
│   └── 副作用: 记录状态变更历史

步骤 3.2: AssetStatusHistoryService
├── record_status_change(asset_id, type, from_status, to_status, operator_id, extra_data)
└── query_history(asset_id, start_time, end_time, page, page_size) -> PaginatedResult
```

### Level 4: Controller 层

```
步骤 4.1: ScrapRequestController
├── POST /api/assets/{asset_id}/scrap-requests
│   └── 权限: asset:apply_retire
│   └── 请求体: { "reason": "string" }
│   └── 响应: 201 ScrapRequest
│
├── PUT /api/scrap-requests/{request_id}/approve
│   └── 权限: asset:approve_scrap
│   └── 响应: 200 ScrapRequest
│
├── PUT /api/scrap-requests/{request_id}/reject
│   └── 权限: asset:approve_scrap
│   └── 请求体: { "reason": "string" } (可选)
│   └── 响应: 200 ScrapRequest

步骤 4.2: AssetStatusHistoryController
├── GET /api/assets/{asset_id}/status-history
│   └── 查询参数: start_time, end_time, page, page_size
│   └── 响应: 200 PaginatedResult<StatusHistory>
```

### Level 5: 前端/UI 层（非本次 API 规格范围）

```
步骤 5.1: 报废申请表单页面
步骤 5.2: 报废申请列表与审批页面
步骤 5.3: 资产状态历史查看组件
```

---

## 数据模型变更摘要

### Asset 表变更

| 字段 | 变更类型 | 说明 |
|------|----------|------|
| status | 修改枚举 | 增加 "scrapped" 值 |

### 新增 ScrapRequest 表

| 字段 | 类型 | 约束 |
|------|------|------|
| id | UUID | PK |
| asset_id | UUID | FK, NOT NULL, INDEX |
| applicant_id | UUID | NOT NULL |
| reason | TEXT | NOT NULL |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'pending' |
| reject_reason | TEXT | NULLABLE |
| created_at | TIMESTAMP | NOT NULL |
| updated_at | TIMESTAMP | NOT NULL |

### 新增 AssetStatusHistory 表

| 字段 | 类型 | 约束 |
|------|------|------|
| id | UUID | PK |
| asset_id | UUID | NOT NULL, INDEX |
| type | VARCHAR(50) | NOT NULL |
| from_status | VARCHAR(20) | NOT NULL |
| to_status | VARCHAR(20) | NOT NULL |
| operator_id | UUID | NOT NULL |
| operated_at | TIMESTAMP | NOT NULL |
| extra_data | JSONB | NULLABLE |

---

## API 响应数据结构

### ScrapRequest 响应

```json
{
  "id": "uuid",
  "asset_id": "uuid",
  "applicant_id": "uuid",
  "reason": "string",
  "status": "pending|approved|rejected",
  "reject_reason": "string|null",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

### StatusHistory 响应

```json
{
  "id": "uuid",
  "asset_id": "uuid",
  "type": "SCRAP_APPLY|SCRAP_APPROVED|SCRAP_REJECTED",
  "from_status": "string",
  "to_status": "string",
  "operator_id": "uuid",
  "operated_at": "ISO8601",
  "extra_data": {}
}
```

### 错误响应

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "details": {}
}
```

---

## 附录：错误码对照表

| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| ASSET_NOT_FOUND | 404 | 资产不存在 |
| ASSET_STATUS_INVALID | 400 | 资产状态不满足操作前置条件 |
| SCRAPPED_STATUS_IMMUTABLE | 400 | 报废状态不可变更 |
| REQUEST_NOT_FOUND | 404 | 报废申请不存在 |
| SCRAP_REQUEST_DUPLICATE | 409 | 存在待处理的报废申请 |
| REQUEST_ALREADY_PROCESSED | 409 | 申请已被处理，不可重复操作 |
| PERMISSION_DENIED | 403 | 权限不足 |

---

## 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| 1.0 | - | 初始版本 | - |