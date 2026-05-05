# Asset Retirement/Disposal Process Specification - Iteration 1

## 1. 需求与背景

### 1.1 业务背景
企业资产管理系统需支持资产全生命周期管理。资产在达到使用寿命、技术淘汰或损坏后，需进入报废退役流程。该流程需确保：
- 资产报废有正式的申请与审批记录
- 退役过程有完整的时间线和状态变更审计
- 财务与库存系统同步资产状态变更
- 历史记录可追溯、可查询

### 1.2 功能目标
本次迭代 (Iteration 1) 聚焦于**报废申请与退役历史记录的基础能力建设**，不包含审批流程、审批链配置、多级审批等高级功能。

---

## 2. 当前 Phase 对应实施目标

> **注**：以下 Phase 拆解基于标准资产管理系统生命周期模型。若项目存在 `plan.md`，请以 plan.md 中定义的 Phase 为准。

| Phase | 名称 | 目标范围 | 状态 |
|-------|------|----------|------|
| Phase 1 | 基础数据模型与 API | 资产报废单数据模型、CRUD API、退役历史记录存储 | **本次迭代** |
| Phase 2 | 申请审批流 (单级) | 简单审批状态机、审批通过/驳回操作 | 待开发 |
| Phase 3 | 多级审批与通知 | 审批链配置、邮件/站内信通知 | 待开发 |
| Phase 4 | 财务库存同步 | 与财务系统、库存系统的集成 | 待开发 |

**本次 Iteration 1 对准 Phase 1**，交付标准：
- 后端 API 完整可用
- 数据库模型正确建立
- 前端报废申请表单与历史记录页面可演示

---

## 3. 边界约束

### 3.1 范围边界 (Scope Constraints)

| 约束项 | 明确限定 |
|--------|----------|
| 报废类型 | 仅支持物理资产（设备、家具、车辆等），暂不支持无形资产（专利、软件许可） |
| 审批模式 | 本次迭代**不实现**审批流程，报废单创建后直接进入"已退役"状态 |
| 状态机 | 仅实现两种状态：`DRAFT`（草稿）、`RETIRED`（已退役） |
| 附件支持 | 本次迭代**不支持**附件上传（如现场照片、评估报告） |
| 批量操作 | 本次迭代**不支持**批量报废 |
| 权限控制 | 本次迭代**不实现**细粒度权限，仅做简单的登录态校验 |

### 3.2 技术边界

| 约束项 | 明确限定 |
|--------|----------|
| 后端框架 | 假设使用 Django/DRF 或 Spring Boot（本次以 RESTful API 描述为准，框架无关） |
| 前端框架 | 假设使用 React/Vue（本次以组件行为描述为准） |
| 数据库 | 关系型数据库（PostgreSQL/MySQL） |
| 部署环境 | 假设容器化部署（Docker） |

### 3.3 数据边界

| 约束项 | 明确限定 |
|--------|----------|
| 单次报废资产数量 | 每次报废申请仅关联 **1 个资产** |
| 历史记录保留策略 | 永久保留，不可物理删除 |
| 资产关联 | 资产与报废单为 **1:1 关系**（一个资产只能有一条报废记录） |

---

## 4. 验收测试基准 (ATB)

### 4.1 测试层级说明

| 层级 | 描述 |
|------|------|
| Unit Test | 单元测试，使用 pytest (Python) 或 JUnit (Java) |
| Integration Test | 集成测试，验证 API 与数据库交互 |
| E2E Test | 端到端测试，使用 Playwright 或 Cypress |

---

### 4.2 ATB-1: 报废申请创建

| 测试 ID | 描述 | 测试类型 | 物理测试期待 |
|---------|------|----------|--------------|
| ATB-1.1 | 用户提交有效报废申请，包含必填字段（资产 ID、报废原因、报废日期） | Unit + Integration | API 返回 201 Created，报废单记录写入数据库，状态为 DRAFT |
| ATB-1.2 | 提交时资产 ID 不存在 | Unit | API 返回 404 Not Found，错误信息包含 "Asset not found" |
| ATB-1.3 | 提交时缺少必填字段（报废原因为空） | Unit | API 返回 400 Bad Request，响应体包含字段级验证错误 |
| ATB-1.4 | 对已处于 RETIRED 状态的资产再次发起报废 | Unit + Integration | API 返回 409 Conflict，错误信息包含 "Asset already retired" |
| ATB-1.5 | 用户未登录状态提交报废申请 | Integration | API 返回 401 Unauthorized |

**物理测试代码片段示例（pytest）**：
```python
def test_create_retirement_success():
    asset = AssetFactory(id=1, status="ACTIVE")
    response = client.post("/api/v1/retirements/", json={
        "asset_id": 1,
        "reason": "设备老化",
        "retirement_date": "2025-01-15"
    })
    assert response.status_code == 201
    assert response.json()["status"] == "DRAFT"
    assert response.json()["asset_id"] == 1

def test_retire_already_retired_asset():
    asset = AssetFactory(id=2, status="RETIRED")
    response = client.post("/api/v1/retirements/", json={
        "asset_id": 2,
        "reason": "测试",
        "retirement_date": "2025-01-15"
    })
    assert response.status_code == 409
```

---

### 4.3 ATB-2: 报废单状态变更（直接退役）

> **说明**：由于本次迭代不实现审批流程，DRAFT → RETIRED 状态变更为直接操作。

| 测试 ID | 描述 | 测试类型 | 物理测试期待 |
|---------|------|----------|--------------|
| ATB-2.1 | 用户将报废单状态从 DRAFT 变更为 RETIRED | Unit + Integration | API 返回 200 OK，报废单状态变更为 RETIRED，同时关联的资产状态同步变更为 RETIRED |
| ATB-2.2 | 变更时报废单 ID 不存在 | Unit | API 返回 404 Not Found |
| ATB-2.3 | 变更时报废单状态已为 RETIRED（幂等性） | Unit | API 返回 200 OK（幂等操作），状态保持 RETIRED |
| ATB-2.4 | 变更时资产关联校验 | Integration | 确认资产表 `status` 字段同步更新为 RETIRED |

**物理测试代码片段示例（Playwright E2E）**：
```javascript
// E2E: 用户在退役页面点击"确认退役"按钮
await page.goto('/retirements/1');
await page.click('button[data-testid="confirm-retire"]');
await expect(page.locator('.status-badge')).toHaveText('RETIRED');
await expect(page.locator('.asset-status')).toHaveText('RETIRED');
```

---

### 4.4 ATB-3: 退役历史记录查询

| 测试 ID | 描述 | 测试类型 | 物理测试期待 |
|---------|------|----------|--------------|
| ATB-3.1 | 查询单条退役记录详情 | Unit + Integration | API 返回 200 OK，包含完整字段（asset_id, reason, retirement_date, created_at, retired_at） |
| ATB-3.2 | 查询资产对应的退役记录 | Integration | GET `/api/v1/assets/{asset_id}/retirement` 返回对应记录或 404 |
| ATB-3.3 | 查询不存在的退役记录 | Unit | API 返回 404 Not Found |
| ATB-3.4 | 历史记录不可被物理删除 | Unit | DELETE 请求返回 405 Method Not Allowed |

---

### 4.5 ATB-4: 列表查询与分页

| 测试 ID | 描述 | 测试类型 | 物理测试期待 |
|---------|------|----------|--------------|
| ATB-4.1 | 列表查询默认返回第一页（page=1, page_size=20） | Integration | 返回结构包含 `items`, `total`, `page`, `page_size` |
| ATB-4.2 | 支持按状态筛选（DRAFT/RETIRED） | Integration | `GET /api/v1/retirements/?status=RETIRED` 仅返回已退役记录 |
| ATB-4.3 | 支持按资产 ID 筛选 | Integration | `GET /api/v1/retirements/?asset_id=5` 仅返回该资产记录 |
| ATB-4.4 | 页码超出范围返回空数组 | Integration | `page=999` 返回 `{"items": [], "total": 10}` |

---

### 4.6 ATB-5: 边界条件与异常

| 测试 ID | 描述 | 测试类型 | 物理测试期待 |
|---------|------|----------|--------------|
| ATB-5.1 | 报废日期早于资产创建日期 | Unit | API 返回 400 Bad Request，错误信息 "Retirement date cannot be before asset acquisition date" |
| ATB-5.2 | 报废日期晚于当前日期 | Unit | API 返回 400 Bad Request（不允许预报废） |
| ATB-5.3 | 并发操作同一资产的退役（Race Condition） | Integration | 数据库唯一约束防止重复记录，第二个请求返回 409 |
| ATB-5.4 | 资产状态为维修中不可报废 | Unit | API 返回 400 Bad Request，错误信息包含 "Asset under maintenance" |

---

## 5. 开发切入层级序列

### 5.1 开发顺序（Top-Down Approach）

```
┌─────────────────────────────────────────────────────────────────┐
│  1. 数据模型层 (Database Schema)                                │
│     ├── 扩展 Asset 表（添加 status 枚举）                       │
│     ├── 新建 RetirementRequest 表                               │
│     └── 新建 RetirementHistory 表                               │
│           ↓                                                      │
│  2. Repository / ORM 层                                         │
│     ├── AssetRepository                                         │
│     ├── RetirementRepository                                    │
│     └── RetirementHistoryRepository                             │
│           ↓                                                      │
│  3. Service / Business Logic 层                                 │
│     ├── RetirementService.create_retirement_request()          │
│     ├── RetirementService.confirm_retirement()                 │
│     └── RetirementService.get_retirement_history()              │
│           ↓                                                      │
│  4. API Controller 层                                           │
│     ├── POST /api/v1/retirements/                               │
│     ├── PATCH /api/v1/retirements/{id}/retire                  │
│     ├── GET /api/v1/retirements/{id}                           │
│     ├── GET /api/v1/retirements/                               │
│     └── GET /api/v1/assets/{asset_id}/retirement               │
│           ↓                                                      │
│  5. 前端组件层 (UI)                                             │
│     ├── RetirementFormPage（报废申请表单）                     │
│     ├── RetirementListPage（报废列表）                         │
│     └── RetirementDetailPage（报废详情+确认退役按钮）          │
│           ↓                                                      │
│  6. 集成测试与 E2E 测试                                        │
│     └── 执行 ATB-1 ~ ATB-5 中的集成/E2E 测试用例               │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 数据库模型设计

#### 表：Asset（扩展）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK | 资产主键 |
| name | VARCHAR(255) | NOT NULL | 资产名称 |
| status | ENUM('ACTIVE', 'IN_REPAIR', 'RETIRED') | NOT NULL, DEFAULT 'ACTIVE' | 资产状态 |
| acquired_at | DATE | NOT NULL | 购置日期 |
| updated_at | TIMESTAMP | | 更新时间 |

#### 表：RetirementRequest

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK | 报废单主键 |
| asset_id | BIGINT | FK, UNIQUE, NOT NULL | 关联资产 ID |
| reason | VARCHAR(1000) | NOT NULL | 报废原因 |
| retirement_date | DATE | NOT NULL | 退役日期 |
| status | ENUM('DRAFT', 'RETIRED') | NOT NULL, DEFAULT 'DRAFT' | 状态 |
| created_by | BIGINT | FK, NOT NULL | 创建人 ID |
| created_at | TIMESTAMP | NOT NULL | 创建时间 |
| retired_at | TIMESTAMP | NULL | 退役确认时间 |

#### 表：RetirementHistory

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK | 历史记录主键 |
| retirement_id | BIGINT | FK, NOT NULL | 关联报废单 ID |
| action | ENUM('CREATED', 'RETIRED') | NOT NULL | 操作类型 |
| performed_by | BIGINT | FK, NOT NULL | 操作人 ID |
| performed_at | TIMESTAMP | NOT NULL | 操作时间 |
| notes | TEXT | NULL | 备注 |

### 5.3 API 契约

#### POST /api/v1/retirements/

**Request Body**:
```json
{
  "asset_id": 123,
  "reason": "设备老化，无法修复",
  "retirement_date": "2025-01-15"
}
```

**Response 201**:
```json
{
  "id": 1,
  "asset_id": 123,
  "reason": "设备老化，无法修复",
  "retirement_date": "2025-01-15",
  "status": "DRAFT",
  "created_by": 456,
  "created_at": "2025-01-10T10:00:00Z"
}
```

#### PATCH /api/v1/retirements/{id}/retire

**Response 200**:
```json
{
  "id": 1,
  "asset_id": 123,
  "status": "RETIRED",
  "retired_at": "2025-01-10T11:00:00Z"
}
```

#### GET /api/v1/assets/{asset_id}/retirement

**Response 200**:
```json
{
  "id": 1,
  "asset_id": 123,
  "reason": "设备老化，无法修复",
  "retirement_date": "2025-01-15",
  "status": "RETIRED",
  "history": [
    {
      "action": "CREATED",
      "performed_by": 456,
      "performed_at": "2025-01-10T10:00:00Z"
    },
    {
      "action": "RETIRED",
      "performed_by": 456,
      "performed_at": "2025-01-10T11:00:00Z"
    }
  ]
}
```

---

## 6. 附录：后续迭代预留点

以下功能在本 Iteration 1 中**不实现**，但需在代码中预留扩展点：

1. **审批状态机**：当前 `status` 枚举预留 `PENDING_APPROVAL`, `APPROVED`, `REJECTED` 值
2. **多级审批链**：Service 层预留 `ApprovalChain` 注入点
3. **附件上传**：表单预留 `attachments` 数组字段接口
4. **批量报废**：API 预留 `POST /api/v1/retirements/batch` 接口签名
5. **通知服务**：确认退役时预留 `NotificationService.emit()` 调用点

---

## 7. 参考文件清单

本次迭代需要创建/修改的文件（基于工作区结构）：

### 7.1 后端文件（Java/Spring Boot）

| 文件路径 | 操作 | 说明 |
|----------|------|------|
| `backend/src/main/java/com/ams/entity/Asset.java` | 修改 | 扩展 status 字段 |
| `backend/src/main/java/com/ams/entity/RetirementRequest.java` | 新建 | 报废申请实体 |
| `backend/src/main/java/com/ams/entity/RetirementHistory.java` | 新建 | 退役历史实体 |
| `backend/src/main/java/com/ams/service/RetirementService.java` | 新建 | 退役服务接口 |
| `backend/src/main/java/com/ams/service/impl/RetirementServiceImpl.java` | 新建 | 退役服务实现 |
| `backend/src/main/java/com/ams/controller/RetirementController.java` | 新建 | 退役 API 控制器 |
| `backend/src/main/java/com/ams/mapper/RetirementRequestMapper.java` | 新建 | MyBatis Mapper |
| `backend/src/main/java/com/ams/mapper/RetirementHistoryMapper.java` | 新建 | MyBatis Mapper |
| `backend/src/main/java/com/ams/dto/RetirementApplicationDTO.java` | 新建 | DTO 类 |
| `backend/src/test/java/com/ams/service/RetirementServiceTest.java` | 新建 | 单元测试 |

### 7.2 前端文件（TypeScript/React）

| 文件路径 | 操作 | 说明 |
|----------|------|------|
| `frontend/src/types/retirement.types.ts` | 新建 | TypeScript 类型定义 |
| `frontend/src/api/retirementApi.ts` | 新建 | API 调用层 |
| `frontend/src/pages/retirement/RetirementFormPage.tsx` | 新建 | 报废申请表单页 |
| `frontend/src/pages/retirement/RetirementListPage.tsx` | 新建 | 报废列表页 |
| `frontend/src/pages/retirement/RetirementDetailPage.tsx` | 新建 | 报废详情页 |
| `frontend/src/pages/retirement/types/retirement.types.ts` | 新建 | 前端类型定义 |
| `frontend/tests/e2e/retirement_flow.spec.ts` | 新建 | E2E 测试 |

### 7.3 数据库迁移

| 文件路径 | 操作 | 说明 |
|----------|------|------|
| `alembic/versions/005_create_retirement_tables.py` | 新建 | 数据库迁移脚本 |