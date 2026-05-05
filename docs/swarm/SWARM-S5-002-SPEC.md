# SWARM-S5-002 资产报废/退役流程 - 规格指导文档

**版本**: Iteration 1  
**状态**: 待开发  
**文档类型**: Specifications  
**创建日期**: 2025-01-15

---

## 需求与背景

### 业务背景

资产报废/退役是资产管理生命周期中的关键环节，涉及到资产从"在用"状态向"退役"状态的转变，需要严格的申请、审批与追踪机制。

随着企业资产规模的扩大，传统的纸质审批流程已无法满足业务需求，需要构建一套完整的数字化资产报废/退役工作流系统。

### 功能范围

| 功能模块 | 描述 | 优先级 |
|---------|------|--------|
| 报废申请提交 | 资产管理员可提交报废申请，包含报废原因、预估残值、附件证据 | P0 |
| 审批链确认 | 支持多级审批流程，可配置审批节点与审批人 | P1 |
| 状态变更执行 | 审批通过后自动变更资产状态为"退役" | P0 |
| 历史记录追踪 | 完整记录报废全生命周期操作日志 | P1 |

### 核心用户角色

| 角色 | 权限范围 |
|------|---------|
| ASSET_ADMIN | 提交报废申请、查看资产历史 |
| APPROVER | 审批/驳回报废申请 |
| AUDITOR | 查看所有操作审计日志 |
| VIEWER | 仅查看资产信息 |

### 相关系统集成

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   资产管理系统    │────▶│  报废工作流系统   │────▶│  财务系统       │
│  (Asset System) │     │ (Retirement WF)  │     │ (Finance System)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  审计日志系统     │
                        │ (Audit System)   │
                        └──────────────────┘
```

---

## 当前 Phase 对应实施目标

### 对准 Phase

本次 Iteration 1 对准 **Phase 1: 核心状态机与报废申请基础流**

### 目标声明

**本次实施目标**：实现资产状态机中"退役"状态定义及基础报废申请提交功能，验证状态转换逻辑正确性。

### 交付边界

```
✓ 已完成范围
├── 资产状态枚举扩展（新增 RETIRED 状态）
├── 报废申请数据模型（AssetScrapApplication）
├── 报废申请提交 API
├── 状态变更前置条件校验
└── 基础历史记录写入

✗ 本次不交付范围
├── 审批链配置（Phase 2）
├── 多级审批流程（Phase 2）
├── 通知机制（Phase 3）
├── 历史审计界面（Phase 3）
└── 残值评估逻辑（Phase 3）
```

### Iteration 1 里程碑

| 里程碑 | 验收日期 | 完成标准 |
|--------|---------|---------|
| M1: 状态机就绪 | Week 1 | RETIRED 状态定义完成，状态转换规则生效 |
| M2: 申请API就绪 | Week 2 | 报废申请提交接口通过所有单元测试 |
| M3: 集成验证 | Week 3 | E2E 测试通过率 100% |

---

## 边界约束

### 技术边界

| 约束项 | 规格 | 说明 |
|-------|------|------|
| 资产状态集 | 限于 `[ACTIVE, MAINTENANCE, RETIRED, DISPOSED]` 四种枚举值 | 不可扩展至 Phase 2 |
| 审批层级 | 本次仅实现单级审批，固定审批人为系统配置 | 硬编码审批人 ID |
| 数据持久化 | 仅支持关系型数据库（PostgreSQL/MySQL） | 不支持 NoSQL |
| 并发控制 | 采用乐观锁（version 字段）防止状态冲突 | 不使用悲观锁 |
| 事务边界 | 单次状态变更加入同一事务 | 确保原子性 |

### 业务边界

| 约束项 | 规格 | 说明 |
|-------|------|------|
| 可报废资产 | 仅限状态为 `ACTIVE` 的资产 | 其他状态需先转换 |
| 报废原因 | 必填，从预定义枚举选择 | PHYSICAL_DAMAGE / OBSOLESCENCE / UPGRADE / OTHER |
| 申请人员 | 需具备 `ASSET_ADMIN` 角色 | 权限校验前置 |
| 审批时限 | 申请提交后 72 小时内需完成审批 | 超时触发提醒 |
| 预估残值 | 可选，正数或零 | 默认 0 |

### 入流校验约束

```
输入校验规则（JSON Schema）：
{
  "type": "object",
  "required": ["asset_id", "scrap_reason", "applicant_id"],
  "properties": {
    "asset_id": {
      "type": "string",
      "format": "uuid",
      "description": "待报废资产ID"
    },
    "scrap_reason": {
      "type": "string",
      "enum": ["PHYSICAL_DAMAGE", "OBSOLESCENCE", "UPGRADE", "OTHER"],
      "description": "报废原因"
    },
    "estimated_residual_value": {
      "type": "number",
      "minimum": 0,
      "default": 0
    },
    "description": {
      "type": "string",
      "maxLength": 500
    },
    "attachment_urls": {
      "type": "array",
      "items": { "type": "string", "format": "uri" },
      "maxItems": 10
    },
    "applicant_id": {
      "type": "string",
      "format": "uuid"
    }
  }
}
```

### 出流约束

```
输出约束：
- 申请提交成功返回 201 Created
- 业务异常返回 4xx 状态码
- 系统异常返回 500 并记录日志
- 响应体必须包含 application_id 字段
```

---

## 验收测试基准 (ATB)

### ATB-1: 资产状态枚举验证

**测试方法**: `pytest tests/unit/test_asset_status.py`

| 测试用例 ID | 测试用例 | 期待结果 |
|------------|---------|---------|
| ATB-1-01 | `test_retired_state_exists` | 状态枚举中包含 RETIRED |
| ATB-1-02 | `test_valid_state_transitions` | ACTIVE→RETIRED 转换合法 |
| ATB-1-03 | `test_invalid_state_transition` | MAINTENANCE→RETIRED 抛出 ValidationError |
| ATB-1-04 | `test_retired_to_disposed_transition` | RETIRED→DISPOSED 转换合法 |

**物理测试期望**:
- 所有状态枚举值可被正确序列化/反序列化
- 状态转换规则表覆盖所有合法路径

### ATB-2: 报废申请提交 API

**测试方法**: `pytest tests/api/test_scrap_application.py`

| 测试用例 ID | 测试用例 | 期待结果 |
|------------|---------|---------|
| ATB-2-01 | `test_submit_valid_scrap_application` | 返回 201，生成 Application ID |
| ATB-2-02 | `test_submit_with_non_active_asset` | 返回 422，错误码 `ASSET_NOT_ACTIVE` |
| ATB-2-03 | `test_submit_without_required_fields` | 返回 400，验证错误列表 |
| ATB-2-04 | `test_submit_with_invalid_role` | 返回 403，`FORBIDDEN` |
| ATB-2-05 | `test_submit_duplicate_application` | 返回 409，`DUPLICATE_APPLICATION` |

**物理测试期望**:
- API 响应时间 < 200ms
- 申请记录正确写入数据库
- 关联资产状态保持 ACTIVE（待审批状态）

### ATB-3: 状态变更事务性验证

**测试方法**: `pytest tests/integration/test_state_transition.py`

| 测试用例 ID | 测试用例 | 期待结果 |
|------------|---------|---------|
| ATB-3-01 | `test_approval_triggers_state_change` | 审批通过后资产状态原子性变更为 RETIRED |
| ATB-3-02 | `test_concurrent_state_change_conflict` | 乐观锁冲突时返回 409，`VERSION_CONFLICT` |
| ATB-3-03 | `test_state_change_creates_history` | 变更操作生成 AssetHistoryRecord |
| ATB-3-04 | `test_rejection_preserves_state` | 审批拒绝后资产状态保持 ACTIVE |

**物理测试期望**:
- 状态变更与历史记录写入在同一事务内完成
- 数据库 version 字段正确递增
- 并发更新时只有一个请求成功

### ATB-4: 历史记录完整性验证

**测试方法**: `playwright tests/e2e/test_retirement_history.spec.ts`

| 测试用例 ID | 测试用例 | 期待结果 |
|------------|---------|---------|
| ATB-4-01 | `test_history_traceability` | 退役资产历史记录包含完整时间戳、操作人、变更前后状态 |
| ATB-4-02 | `test_history_immutability` | 历史记录不支持 UPDATE/DELETE 操作 |
| ATB-4-03 | `test_history_query_pagination` | 大量历史记录时分页正常 |

**物理测试期望**:
- 历史记录不可被应用层修改
- 完整追溯链条无断点
- 界面展示数据与数据库一致

### ATB-5: 边界约束验证

**测试方法**: `pytest tests/unit/test_boundary_constraints.py`

| 测试用例 ID | 测试用例 | 期待结果 |
|------------|---------|---------|
| ATB-5-01 | `test_residual_value_non_negative` | 负值输入返回 400 |
| ATB-5-02 | `test_attachment_limit` | 超过10个附件返回 400 |
| ATB-5-03 | `test_description_length` | 超过500字符返回 400 |
| ATB-5-04 | `test_72h_approval_timeout` | 超时触发自动提醒任务（mock验证） |

### ATB-6: 审批流程验证

**测试方法**: `pytest tests/unit/test_approval_chain.py`

| 测试用例 ID | 测试用例 | 期待结果 |
|------------|---------|---------|
| ATB-6-01 | `test_single_approval_level` | 单级审批路径正确执行 |
| ATB-6-02 | `test_approval_by_configured_user` | 审批人必须是配置的固定用户 |
| ATB-6-03 | `test_reject_with_reason` | 驳回时必须提供原因 |

---

## 开发切入层级序列

### 层级 1: 数据模型层

```
开发顺序：
1. AssetStatus 枚举扩展（新增 RETIRED）
   └── backend/src/main/java/com/ams/state/AssetState.java
   
2. AssetScrapApplication 模型定义
   └── backend/src/main/java/com/ams/entity/ScrapRequest.java
   
3. AssetHistory 模型扩展（新增 RETIREMENT 事件类型）
   └── backend/src/main/java/com/ams/entity/AssetStatusHistory.java
   
4. 数据库迁移脚本编写
   └── alembic/versions/003_add_retirement_fields.py
```

**关键代码片段**:

```java
// AssetState.java
public enum AssetStatus {
    ACTIVE("在用"),
    MAINTENANCE("维护中"),
    RETIRED("退役"),    // 新增
    DISPOSED("已处置");
    
    private final String description;
}
```

### 层级 2: 服务层

```
开发顺序：
1. AssetStateService 状态转换逻辑
   └── src/services/retirement_service.py
   
2. ScrapApplicationService 申请处理
   └── src/services/scrap_service.py
   
3. ValidationService 前置条件校验
   └── src/services/validators/asset_validator.py
   
4. HistoryRecordingService 历史记录写入
   └── src/services/status_history_service.py
```

**关键服务接口**:

```python
class RetirementService:
    """
    资产退役服务
    
    负责处理资产退役申请的状态流转和业务逻辑
    """
    
    def submit_application(self, request: ScrapRequestDTO) -> ApplicationResponse:
        """
        提交报废申请
        
        Args:
            request: 报废申请请求
            
        Returns:
            ApplicationResponse: 申请响应
            
        Raises:
            AssetNotActiveError: 资产状态不满足报废条件
            DuplicateApplicationError: 存在待处理的申请
        """
        pass
    
    def approve(self, application_id: str, approver_id: str) -> Asset:
        """
        审批通过
        
        Args:
            application_id: 申请ID
            approver_id: 审批人ID
            
        Returns:
            Asset: 更新后的资产对象
        """
        pass
```

### 层级 3: API 层

```
开发顺序：
1. POST /api/v1/assets/{id}/scrap-application（提交报废申请）
   └── backend/src/main/java/com/ams/controller/ScrapController.java
   
2. POST /api/v1/scrap-applications/{id}/approve（审批通过）
   └── backend/src/main/java/com/ams/controller/ScrapController.java
   
3. GET /api/v1/assets/{id}/history（查询历史）
   └── backend/src/main/java/com/ams/controller/AuditController.java
```

**API 规格摘要**:

```yaml
POST /api/v1/assets/{assetId}/scrap-application:
  summary: 提交资产报废申请
  tags:
    - Retirement
  parameters:
    - name: assetId
      in: path
      required: true
      schema:
        type: string
        format: uuid
  requestBody:
    required: true
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/ScrapApplicationRequest'
  responses:
    '201':
      description: 申请提交成功
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ScrapApplicationResponse'
    '400':
      description: 参数校验失败
    '403':
      description: 权限不足
    '409':
      description: 存在待处理申请
    '422':
      description: 资产状态不满足条件
```

### 层级 4: 异常处理层

```
异常码定义（ErrorCode 枚举）：
├── ASSET_NOT_ACTIVE: 1001 - 资产状态不满足报废条件
├── APPLICATION_NOT_FOUND: 1002 - 报废申请不存在
├── APPLICATION_DUPLICATED: 1003 - 存在待处理申请
├── VERSION_CONFLICT: 1004 - 状态并发冲突
├── FORBIDDEN: 1005 - 权限不足
├── VALIDATION_ERROR: 1006 - 输入校验失败
└── APPROVAL_TIMEOUT: 1007 - 审批超时
```

---

## 测试覆盖率目标

| 模块 | 覆盖率目标 |
|------|-----------|
| 状态机逻辑 | 100% |
| 服务层 | 90% |
| API 层 | 85% |
| 整体 | 80% |

---

## 附录

### A. 相关文件清单

| 文件路径 | 用途 |
|---------|------|
| `frontend/src/types/workorder.types.ts` | 工单类型定义 |
| `frontend/tests/e2e/retirement_flow.spec.ts` | 退役流程 E2E 测试 |
| `tests/e2e/retirement_user_journey.spec.ts` | 退役用户旅程测试 |
| `frontend/tests/e2e/dashboard.spec.ts` | 仪表盘测试 |
| `frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css` | 审计仪表盘样式 |

### B. 数据模型变更

```sql
-- 新增报废申请表
CREATE TABLE scrap_application (
    id VARCHAR(36) PRIMARY KEY,
    asset_id VARCHAR(36) NOT NULL,
    scrap_reason ENUM('PHYSICAL_DAMAGE', 'OBSOLESCENCE', 'UPGRADE', 'OTHER') NOT NULL,
    estimated_residual_value DECIMAL(12, 2) DEFAULT 0,
    description VARCHAR(500),
    status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    applicant_id VARCHAR(36) NOT NULL,
    approver_id VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    version INT DEFAULT 1,
    FOREIGN KEY (asset_id) REFERENCES asset(id)
);

-- 新增资产状态历史表事件类型
ALTER TABLE asset_status_history 
ADD COLUMN event_type ENUM('CREATE', 'UPDATE', 'STATUS_CHANGE', 'RETIREMENT', 'DISPOSAL');
```

### C. 回归测试策略

- 每次提交自动运行单元测试
- 每晚运行完整 E2E 测试套件
- 部署前运行集成测试

---

*本文档为 Iteration 1 实施基准，后续 Phase 扩展需基于本版本进行增量开发。*

**文档版本历史**:
- v1.0 (2025-01-15): 初始版本