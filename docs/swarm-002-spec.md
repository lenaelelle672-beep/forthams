# SWARM-002 [资产报废流程] 规格指导文档

> **版本**: v1.0  
> **状态**: ✅ AC 审核全部通过  
> **迭代**: Iteration-1  
> **更新日期**: 2024-01-15

---

## 1. 需求与背景

### 1.1 业务场景

资产管理系统需覆盖资产全生命周期管理。资产在完成使用寿命周期或因故障损毁无法修复后，需经过规范化的报废审批流程，标记为报废状态并从在役资产台账中移出。

### 1.2 业务价值

| 价值维度 | 具体描述 |
|---------|----------|
| 流程规范化 | 建立标准化的资产退役机制，防止已报废资产继续在系统中流转 |
| 审计追溯 | 保留完整的资产状态变更历史，满足审计追溯要求 |
| 数据一致性 | 实时同步资产台账数据，确保账实一致 |

### 1.3 依赖前置条件

- ✅ 资产台账基础数据已建立（参见 SWARM-001）
- ✅ 用户认证与权限体系已就绪
- ✅ 核心服务层已实现（retirement_service, approval_service, notification_service）

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解对照表

| Phase ID | Phase 名称 | 状态 | 说明 |
|----------|-----------|------|------|
| Phase 1 | 资产台账基础管理 | ✅ 已完成 | 资产CRUD、基础查询 |
| **Phase 2** | **资产报废流程** | **🔄 本次迭代** | **SWARM-002 实施范围** |
| Phase 3 | 资产调拨流程 | 📋 待实施 | - |
| Phase 4 | 资产维保流程 | 📋 待实施 | - |

### 2.2 本次 Phase 2 实施目标

#### 核心功能目标

1. **报废申请提交**
   - 支持用户对状态为"退役"的资产提交报废申请
   - 必填字段：报废原因（reason）
   - 自动生成申请单据号

2. **状态变更历史记录**
   - 系统自动生成资产状态变更流水日志
   - 记录类型包括：SCRAP_APPLY, SCRAP_APPROVED, SCRAP_REJECTED
   - 记录操作人、操作时间、变更前后状态

3. **审批流程**
   - 支持审批人对报废申请进行通过/驳回操作
   - 驳回时可填写驳回理由
   - 单级审批，不支持多级会签

4. **台账状态同步**
   - 审批通过后自动更新资产台账状态为"已报废"
   - 报废状态为终态，不可变更回退役或在役
   - 原子性操作保证数据一致性

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 具体约束 |
|--------|----------|
| 申请前置状态 | 仅允许状态为"退役"的资产提交报废申请 |
| 申请人权限 | 需具备 `asset:apply_retire` 权限 |
| 审批人权限 | 需具备 `asset:approve_scrap` 权限 |
| 审批方式 | 单级审批，不支持多级会签 |
| 不可逆约束 | 报废状态为终态，不可变更回退役或在役 |
| 数据完整性 | 报废操作必须原子性完成，否则事务回滚 |
| 重复申请 | 已存在 pending 状态申请时，不可重复提交 |

### 3.2 非功能约束

| 约束项 | 具体要求 |
|--------|----------|
| 响应时间 | 单次报废申请处理响应时间 ≤ 2s |
| 查询能力 | 状态变更历史查询支持按资产编号、时间范围筛选 |
| 操作审计 | 系统需记录操作人、操作时间、操作类型、变更前后状态 |
| 通知机制 | 依赖通知服务发送审批结果通知（可降级处理） |

### 3.3 错误码对照表

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

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 报废申请提交

| 测试编号 | 测试描述 | 物理测试方法 | 预期结果 |
|----------|----------|--------------|----------|
| ATB-1.1 | 正常提交报废申请 | POST `/api/assets/{asset_id}/scrap-requests` | 返回 201，生成 scrap_request 记录，状态为 pending |
| ATB-1.2 | 对非退役状态资产提交申请 | POST `/api/assets/{asset_id}/scrap-requests`（资产状态为"在役"） | 返回 400，错误码 `ASSET_STATUS_INVALID` |
| ATB-1.3 | 重复提交报废申请 | 同一资产两次 POST | 返回 409，错误码 `SCRAP_REQUEST_DUPLICATE` |
| ATB-1.4 | 提交时自动生成状态变更历史 | POST 后查询 `/api/assets/{asset_id}/status-history` | 新增 type="SCRAP_APPLY", from_status="retired", to_status="pending" 记录 |
| ATB-1.5 | 无权限用户提交申请 | 以无 `asset:apply_retire` 权限用户请求 | 返回 403 |

### 4.2 ATB-2: 审批流程

| 测试编号 | 测试描述 | 物理测试方法 | 预期结果 |
|----------|----------|--------------|----------|
| ATB-2.1 | 审批通过 | PUT `/api/scrap-requests/{request_id}/approve` | 返回 200，request 状态更新为 approved |
| ATB-2.2 | 审批驳回 | PUT `/api/scrap-requests/{request_id}/reject` | 返回 200，request 状态更新为 rejected |
| ATB-2.3 | 驳回时可选填写理由 | PUT with `reject_reason` | 返回 200，驳回理由被记录 |
| ATB-2.4 | 重复审批同一申请 | 同一 request 两次 approve | 第二次返回 409，错误码 `REQUEST_ALREADY_PROCESSED` |
| ATB-2.5 | 无权限用户审批 | 以无 `asset:approve_scrap` 权限用户请求 | 返回 403 |

### 4.3 ATB-3: 资产状态同步

| 测试编号 | 测试描述 | 物理测试方法 | 预期结果 |
|----------|----------|--------------|----------|
| ATB-3.1 | 审批通过后资产状态变更为已报废 | approve 后 GET `/api/assets/{asset_id}` | asset.status == "scrapped" |
| ATB-3.2 | 审批通过后生成状态变更历史 | approve 后查询 status-history | 新增 type="SCRAP_APPROVED" 记录 |
| ATB-3.3 | 审批通过为原子操作 | approve 操作开启事务，注入失败 | 事务回滚，资产状态不变更 |
| ATB-3.4 | 驳回后资产状态保持退役 | reject 后 GET asset | asset.status == "retired"（未变更） |

### 4.4 ATB-4: 状态变更历史查询

| 测试编号 | 测试描述 | 物理测试方法 | 预期结果 |
|----------|----------|--------------|----------|
| ATB-4.1 | 按资产编号查询历史 | GET `/api/assets/{asset_id}/status-history` | 返回该资产的完整变更记录列表 |
| ATB-4.2 | 按时间范围筛选 | GET with `?start_time=&end_time=` | 仅返回指定时间范围内的记录 |
| ATB-4.3 | 分页查询 | GET with `?page=&page_size=` | 返回分页结果，包含 total, page, page_size |
| ATB-4.4 | 历史记录包含操作人信息 | 查询结果检查 | 每条记录包含 operator, operated_at 字段 |

### 4.5 ATB-5: 边界条件验证

| 测试编号 | 测试描述 | 物理测试方法 | 预期结果 |
|----------|----------|--------------|----------|
| ATB-5.1 | 报废状态不可逆变更 | 尝试将报废资产状态改回其他状态 | API 返回 400，错误码 `SCRAPPED_STATUS_IMMUTABLE` |
| ATB-5.2 | 资产不存在时的错误处理 | 对不存在的 asset_id 操作 | 返回 404，错误码 `ASSET_NOT_FOUND` |
| ATB-5.3 | 申请不存在时的审批处理 | 对不存在的 request_id 审批 | 返回 404，错误码 `REQUEST_NOT_FOUND` |

---

## 5. 开发切入层级序列

### 5.1 Level 1: 数据模型层

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

### 5.2 Level 2: Repository 层

| Repository | 核心方法 |
|------------|----------|
| ScrapRequestRepository | create_scrap_request, find_by_id, find_pending_by_asset_id, update_status |
| AssetStatusHistoryRepository | create_history, find_by_asset_id, find_by_asset_id_all |
| AssetRepository (扩展) | find_by_id_with_status_check, update_status |

### 5.3 Level 3: Service 层

| Service | 核心方法 | 副作用 |
|---------|----------|--------|
| ScrapService.submit_scrap_request | 前置校验: 资产存在、状态为退役、无待处理申请 | 记录状态变更历史 |
| ScrapService.approve_scrap_request | 前置校验: 申请存在、状态为pending | 更新资产状态为scrapped、记录状态变更历史 |
| ScrapService.reject_scrap_request | 前置校验: 申请存在、状态为pending | 记录状态变更历史 |
| AssetStatusHistoryService | record_status_change, query_history | - |

### 5.4 Level 4: Controller 层

#### API 端点定义

| 方法 | 路径 | 权限 | 描述 |
|------|------|------|------|
| POST | `/api/assets/{asset_id}/scrap-requests` | asset:apply_retire | 提交报废申请 |
| PUT | `/api/scrap-requests/{request_id}/approve` | asset:approve_scrap | 审批通过 |
| PUT | `/api/scrap-requests/{request_id}/reject` | asset:approve_scrap | 审批驳回 |
| GET | `/api/assets/{asset_id}/status-history` | - | 查询状态变更历史 |

### 5.5 Level 5: 前端/UI 层

#### 本次迭代前端交付物

| 文件路径 | 修改说明 |
|----------|----------|
| `frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css` | 审计仪表板样式适配 |
| `frontend/src/app/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` | 筛选栏组件样式 |
| `frontend/src/app/pages/AuditDashboard/hooks/useAuditData.ts` | 审计数据 Hook |
| `frontend/src/api/retirementApi.ts` | 报废流程 API 接口 |
| `frontend/src/pages/retirement/types/retirement.types.ts` | 报废类型定义 |

---

## 6. API 响应数据结构

### 6.1 ScrapRequest 响应

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

### 6.2 StatusHistory 响应

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

### 6.3 错误响应

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "details": {}
}
```

---

## 7. 数据模型变更摘要

### 7.1 Asset 表变更

| 字段 | 变更类型 | 说明 |
|------|----------|------|
| status | 修改枚举 | 增加 "scrapped" 值 |

### 7.2 新增 ScrapRequest 表

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

### 7.3 新增 AssetStatusHistory 表

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

## 8. AC 审核结果

| AC ID | 验证方法 | 状态 | 审核意见 |
|-------|----------|------|----------|
| AC-001 | unit_test | ✅ 通过 | 核心报废申请提交功能验收通过 |
| AC-002 | unit_test | ✅ 通过 | 审批流程功能验收通过 |
| AC-003 | static_analysis | ✅ 通过 | AST 静态检查无新增语法错误 |
| AC-004 | static_analysis | ✅ 通过 | 所有函数包含 docstring 文档注释 |
| AC-005 | unit_test | ✅ 通过 | 模块可正常 import 无 ImportError |

---

## 9. 附录

### 9.1 参考文档

- [SWARM-001 资产台账基础管理规格](./swarm-001-spec.md)
- [资产状态机设计文档](../architecture/asset-state-machine.md)
- [审批流程设计文档](../architecture/approval-flow.md)

### 9.2 变更记录

| 版本 | 日期 | 作者 | 变更描述 |
|------|------|------|----------|
| v1.0 | 2024-01-15 | - | 初始版本，AC 审核全部通过 |

---

*本文档由系统自动生成，基于 SWARM-002 迭代需求和 AC 审核结果。*