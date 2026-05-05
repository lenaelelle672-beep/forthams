# SWARM-051 前端集成-资产详情页面开发规格文档

## 版本信息

| 属性 | 值 |
|------|-----|
| 任务编号 | SWARM-051 |
| 任务名称 | 前端集成-资产详情页面开发 |
| 文档版本 | v1.0 |
| 适用迭代 | Iteration 1 |
| 文档状态 | 已审核 |

---

## 1. 需求与背景

### 1.1 业务背景

Graphify 知识图谱平台需要实现资产详情页面的完整前端集成，以便用户能够查看资产的全量属性信息及关联的操作审计日志。当前平台已完成基础架构搭建，需补全资产详情展示的端到端链路。

### 1.2 核心需求

| 需求编号 | 需求描述 | 优先级 |
|----------|----------|--------|
| REQ-001 | 资产详情展示组件 - 渲染资产的基础属性、扩展属性及关联关系图谱 | P0 |
| REQ-002 | 审计日志模块 - 展示资产的变更历史、操作记录、状态流转 | P0 |
| REQ-003 | @Auditable 注解数据可视化 - 后端通过该注解标记的字段变更需在前端可追溯 | P0 |
| REQ-004 | AuditService 服务对接 - 前端通过标准 API 与审计服务层通信 | P0 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 映射表

| Plan Phase | 阶段名称 | SWARM-051 对齐目标 | 交付物 |
|------------|---------|-------------------|--------|
| Phase 1 | 资产详情基础组件开发 | 实现 `AssetDetailPage` 页面框架与 `AssetInfoCard` 信息卡片组件 | 前端页面骨架 |
| Phase 2 | 数据绑定与状态管理 | 对接 AssetService 获取资产详情数据，纳入状态管理 | 数据绑定逻辑 |
| Phase 3 | 审计日志模块集成 | 实现 `AuditLogPanel` 面板组件，对接 AuditService API | 审计日志面板 |
| Phase 4 | @Auditable 字段可视化增强 | 解析后端返回的 `auditableFields` 元数据，高亮展示变更追踪 | 字段高亮展示 |
| Phase 5 | 响应式与边界处理 | 异常状态、Loading、Empty 场景覆盖 | 容错机制 |

### 2.2 后端 Phase 目标

| Phase | 目标 | 关键交付物 |
|-------|------|------------|
| Phase 1 | AuditService 服务层基础接口实现 | `getAuditLogs()`、`logAuditEvent()`、`trackChanges()` 方法 |
| Phase 2 | @Auditable 注解解析与数据绑定 | `getAuditableFields()` 元数据接口 |
| Phase 3 | GraphQL/Restful API 对接 | 审计日志查询端点 |
| Phase 4 | Graphify 节点集成 | 审计节点与资产图谱联动 |

---

## 3. 边界约束

### 3.1 功能边界

| 约束项 | 限定条件 | 备注 |
|--------|----------|------|
| 支持资产类型 | 仅限 `Node`、`Relationship`、`Property` 三类资产 | 枚举值：`ASSET`、`DOCUMENT`、`PROCESS`、`METRIC`、`RELATIONSHIP` |
| 审计日志范围 | 仅展示当前资产关联的审计记录，不含跨资产查询 | 通过 `assetId` 隔离 |
| 分页限制 | 审计日志默认展示 20 条/页，支持手动加载更多 | 最多 100 条/页 |
| 时间范围 | 审计日志默认查询最近 90 天数据，超出需手动调整筛选条件 | 可配置 |
| @Auditable 字段 | 仅展示标记了 `@Auditable` 注解的字段变更 | 需解析注解元数据 |

### 3.2 技术约束

| 约束项 | 技术要求 |
|--------|----------|
| 后端框架 | Spring Boot 3.x + MyBatis-Plus |
| 数据库 | MySQL 8.0+ |
| API 规范 | RESTful API，遵循统一 JSON Schema |
| 日志规范 | 审计日志使用 `GeneralAuditEntry` 实体存储 |
| 注解规范 | 使用 `@Auditable` 和 `@Audited` 注解标记可审计字段 |
| 环境隔离 | dev、test、staging、prod 环境通过 profile 切换 |

### 3.3 数据约束

| 约束项 | 约束条件 |
|--------|----------|
| 敏感字段 | 密码、密钥等敏感字段不得在前端明文展示 |
| 数据权限 | 审计日志按租户（Tenant）隔离 |
| 路由参数 | 资产详情页路由需携带资产唯一标识 `assetId` 参数 |
| 日志保留 | 审计日志默认保留 365 天，可配置 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB 总览

| ATB ID | 测试目标 | 验证方法 | 优先级 |
|--------|----------|----------|--------|
| ATB-001 | 资产详情页面正常渲染 | 集成测试 | P0 |
| ATB-002 | 资产信息卡片数据展示 | 集成测试 | P0 |
| ATB-003 | 审计日志面板展示 | 集成测试 | P0 |
| ATB-004 | @Auditable 字段高亮展示 | 集成测试 | P0 |
| ATB-005 | AuditService API 对接验证 | 集成测试 | P0 |
| ATB-006 | 分页加载功能 | 集成测试 | P1 |
| ATB-007 | 边界场景 - 资产不存在 | 集成测试 | P1 |
| ATB-008 | Loading 状态展示 | 集成测试 | P1 |

### 4.2 详细 ATB 定义

#### ATB-001: 资产详情页面正常渲染

```python
def test_asset_detail_page_loads():
    """
    验证资产详情页面正常加载，无控制台错误
    """
    # Step 1: 导航至资产详情页
    page.goto(f"/asset/detail/{valid_asset_id}")
    
    # Step 2: 验证页面 title 或关键 heading 可见
    assert page.locator("h1:has-text('资产详情')").is_visible()
    
    # Step 3: 验证资产名称卡片加载完成
    assert page.locator("[data-testid='asset-name-card']").is_visible()
    
    # Step 4: 验证无控制台 Error 级别日志
    assert len(get_console_errors()) == 0
```

#### ATB-002: 资产信息卡片数据展示

```python
def test_asset_info_card_data_display():
    """
    验证资产信息卡片数据正确映射
    """
    # Step 1: 获取 mock 数据
    mock_asset = get_mock_asset()
    
    # Step 2: 导航至资产详情页
    page.goto(f"/asset/detail/{mock_asset['id']}")
    
    # Step 3: 验证字段映射正确
    assert page.locator("[data-testid='field-name']").inner_text() == mock_asset['name']
    assert page.locator("[data-testid='field-type']").inner_text() == mock_asset['type']
    assert page.locator("[data-testid='field-createdAt']").inner_text() == mock_asset['createdAt']
```

#### ATB-003: 审计日志面板展示

```python
def test_audit_log_panel_renders():
    """
    验证审计日志面板正确渲染
    """
    # Step 1: 滚动至审计日志面板区域
    page.locator("[data-testid='audit-log-panel']").scroll_into_view_if_needed()
    
    # Step 2: 验证默认加载 20 条记录
    log_items = page.locator("[data-testid='audit-log-item']")
    assert log_items.count() == 20
    
    # Step 3: 验证日志项包含必要字段
    first_log = log_items.first
    assert first_log.locator("[data-testid='log-action']").is_visible()
    assert first_log.locator("[data-testid='log-timestamp']").is_visible()
    assert first_log.locator("[data-testid='log-operator']").is_visible()
```

#### ATB-004: @Auditable 字段高亮展示

```python
def test_auditable_fields_highlight():
    """
    验证 @Auditable 注解的字段具有高亮样式
    """
    # Step 1: 调用后端接口，验证返回数据包含 auditableFields 元数据
    response = api.get(f"/api/assets/{asset_id}")
    auditable_fields = response.json()['metadata']['auditableFields']
    
    # Step 2: 验证前端页面中 @Auditable 标注的字段具有高亮样式类
    for field in auditable_fields:
        selector = f"[data-testid='field-{field}']"
        assert "auditable-highlight" in page.locator(selector).get_attribute("class")
```

#### ATB-005: AuditService API 对接验证

```python
def test_audit_service_api_integration():
    """
    验证前端与 AuditService API 正确对接
    """
    # Step 1: 监听网络请求
    with page.expect_request("**/api/audit/logs/**") as request_info:
        page.goto(f"/asset/detail/{asset_id}")
    
    # Step 2: 验证请求参数包含 assetId 和分页参数
    request = request_info.value
    assert "assetId" in request.url
    assert "pageSize=20" in request.url
    
    # Step 3: 验证响应状态码为 200
    assert request.response().status == 200
```

#### ATB-006: 分页加载功能

```python
def test_audit_log_pagination():
    """
    验证审计日志分页加载功能
    """
    # Step 1: 点击"加载更多"按钮
    page.locator("[data-testid='load-more-btn']").click()
    
    # Step 2: 验证日志项数量增加至 40
    log_items = page.locator("[data-testid='audit-log-item']")
    assert log_items.count() == 40
```

#### ATB-007: 边界场景 - 资产不存在

```python
def test_asset_not_found_handling():
    """
    验证资产不存在时的错误处理
    """
    # Step 1: 导航至不存在的资产详情页
    page.goto("/asset/detail/invalid-id-999")
    
    # Step 2: 验证展示 404 提示或错误状态
    assert page.locator("[data-testid='error-not-found']").is_visible()
    
    # Step 3: 验证日志面板不展示
    assert page.locator("[data-testid='audit-log-panel']").count() == 0
```

#### ATB-008: Loading 状态展示

```python
def test_loading_state_display():
    """
    验证 Loading 状态正确展示
    """
    # Step 1: 模拟网络慢速环境
    # Step 2: 导航至资产详情页
    page.goto(f"/asset/detail/{asset_id}")
    
    # Step 3: 验证 Loading Skeleton 可见
    assert page.locator("[data-testid='loading-skeleton']").is_visible()
    
    # Step 4: 数据加载完成后，Loading Skeleton 消失
    page.wait_for_selector("[data-testid='loading-skeleton']", state="hidden")
    assert page.locator("[data-testid='asset-name-card']").is_visible()
```

---

## 5. 开发切入层级序列

### 5.1 层级架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Level 6: 测试与集成                      │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │  ATB 物理测试    │  │  后端 API 联调    │  │  E2E 回归   │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      Level 5: 样式与可视化                    │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ @Auditable 高亮 │  │ 变更前后值对比    │  │ 响应式布局  │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      Level 4: 交互层                         │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ 时间范围筛选器   │  │ 操作类型筛选器    │  │ 详情展开收起 │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      Level 3: 组件层                        │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ AssetInfoCard   │  │ AuditLogPanel    │  │AuditLogItem │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      Level 2: 数据层                         │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ TypeScript 接口 │  │ API Service 封装  │  │ Mock 数据   │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      Level 1: 基础设施层                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ 路由配置        │  │ 页面容器组件      │  │ 环境变量    │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 后端开发层级

| Level | 层级名称 | 任务描述 | 关键交付物 |
|-------|----------|----------|------------|
| L1 | 基础设施层 | 配置 AuditService Bean、数据库连接 | Spring Boot 配置 |
| L2 | 数据访问层 | 实现 GeneralAuditEntry Mapper | CRUD 方法 |
| L3 | 业务逻辑层 | 实现核心业务方法 | getAuditLogs、trackChanges |
| L4 | API 层 | 暴露 RESTful 端点 | Controller |
| L5 | 注解解析层 | 解析 @Auditable 元数据 | getAuditableFields |
| L6 | 测试与集成 | ATB 验证、联调 | 测试报告 |

---

## 6. API 接口规范

### 6.1 审计日志查询接口

```
GET /api/audit/logs
```

#### 请求参数

| 参数名 | 类型 | 必填 | 描述 |
|--------|------|------|------|
| assetId | String | 是 | 资产唯一标识 |
| page | Integer | 否 | 页码，默认 0 |
| pageSize | Integer | 否 | 每页条数，默认 20，最大 100 |
| startDate | String | 否 | 开始时间 (ISO 8601) |
| endDate | String | 否 | 结束时间 (ISO 8601) |
| action | String | 否 | 操作类型筛选 (CREATE/UPDATE/DELETE) |

#### 响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "content": [
      {
        "id": "log-001",
        "assetId": "asset-123",
        "action": "UPDATE",
        "operator": "user-456",
        "timestamp": "2025-01-15T10:30:00Z",
        "changes": [
          {
            "field": "name",
            "oldValue": "旧名称",
            "newValue": "新名称",
            "isAuditable": true
          }
        ],
        "metadata": {
          "ipAddress": "192.168.1.100",
          "userAgent": "Mozilla/5.0..."
        }
      }
    ],
    "page": 0,
    "pageSize": 20,
    "totalElements": 150,
    "totalPages": 8
  }
}
```

### 6.2 获取资产可审计字段接口

```
GET /api/audit/auditable-fields/{entityType}
```

#### 响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "entityType": "Asset",
    "auditableFields": [
      {
        "field": "name",
        "label": "资产名称",
        "type": "String",
        "auditLevel": "NORMAL"
      },
      {
        "field": "status",
        "label": "资产状态",
        "type": "Enum",
        "auditLevel": "HIGH"
      }
    ]
  }
}
```

---

## 7. 数据模型

### 7.1 GeneralAuditEntry 实体

| 字段名 | 类型 | 描述 |
|--------|------|------|
| id | Long | 主键 |
| entityType | String | 实体类型 |
| entityId | String | 实体 ID |
| action | String | 操作类型 (CREATE/UPDATE/DELETE) |
| operator | String | 操作人 |
| operatorId | Long | 操作人 ID |
| timestamp | LocalDateTime | 操作时间 |
| changes | JSON | 变更详情 |
| metadata | JSON | 附加元数据 |
| tenantId | Long | 租户 ID |

### 7.2 @Auditable 注解定义

```java
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {
    String label() default "";
    AuditLevel level() default AuditLevel.NORMAL;
    boolean trackChanges() default true;
}
```

---

## 8. 关键实现点

### 8.1 AuditService 核心方法

| 方法名 | 职责 | 输入 | 输出 |
|--------|------|------|------|
| `getAuditLogs` | 查询审计日志列表 | assetId, page, pageSize | Page<GeneralAuditEntry> |
| `logAuditEvent` | 记录审计事件 | AuditEvent | void |
| `trackChanges` | 追踪字段变更 | oldEntity, newEntity | List<FieldChange> |
| `getAuditableFields` | 获取可审计字段元数据 | entityType | List<AuditableFieldMeta> |

### 8.2 Graphify 节点集成

根据 `CustomNodes.tsx` 中的节点工厂模式，审计日志需要支持以下节点类型：

- `GraphifyNodeType.ASSET` - 资产节点
- `GraphifyNodeType.DOCUMENT` - 文档节点
- `GraphifyNodeType.PROCESS` - 流程节点
- `GraphifyNodeType.METRIC` - 指标节点
- `GraphifyNodeType.RELATIONSHIP` - 关系节点

---

## 9. 异常处理

| 异常场景 | HTTP 状态码 | 错误码 | 处理策略 |
|----------|-------------|--------|----------|
| 资产不存在 | 404 | ASSET_NOT_FOUND | 返回友好提示 |
| 无权限访问 | 403 | ACCESS_DENIED | 提示权限不足 |
| 审计日志查询失败 | 500 | AUDIT_QUERY_FAILED | 记录日志，返回错误信息 |
| 参数校验失败 | 400 | INVALID_PARAMETER | 返回具体校验信息 |

---

## 10. 文档附录

### 10.1 术语表

| 术语 | 定义 |
|------|------|
| @Auditable | 字段级注解，标记该字段变更需要审计追踪 |
| @Audited | 方法/类级注解，标记该方法/类需要审计 |
| AuditService | 审计服务层，负责审计日志的记录与查询 |
| Graphify | 平台知识图谱可视化引擎 |

### 10.2 参考文档

- 架构设计文档
- API 接口规范文档
- 前端组件库文档
- 测试规范文档

---

**文档审核状态**: ✅ 已审核  
**审核人**: Tech Lead  
**审核时间**: 2025-01-15