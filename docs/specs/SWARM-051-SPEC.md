# SWARM-051 前端集成-资产详情页面开发 规格指导文档

---

## 需求与背景

### 业务背景

资产管理系统需要对各类资产（硬件设备、软件许可证、数字资源等）提供完整的生命周期管理能力。资产详情页面作为用户深度了解单一资产核心信息的入口，承担着数据完整性展示、操作记录追溯、合规审计支撑等关键职责。

### 技术背景

当前系统已完成以下基础设施建设：

- 审计框架：已实现 `@Auditable` 注解体系，覆盖资产核心 CRUD 操作
- 审计服务层：`AuditService` 服务端点已部署，提供审计日志查询 API
- 资产域模型：资产主数据模型已定义，包含 `Asset` 实体及关联关系
- 前端框架：基于 Vue 3 + TypeScript 构建，组件库为 Element Plus

### 本次任务目标

完成资产详情页面的完整前端实现，包括资产基础信息展示、审计日志集成、注解驱动数据可视化三个维度的交付。

---

## 当前 Phase 对应实施目标

**对应 Phase**: Phase 2 - 前端集成与可视化阶段

| Phase | 职责 | 状态 |
|-------|------|------|
| Phase 1 | 资产核心数据模型与基础 API | 已完成 |
| Phase 2 | 资产详情展示与审计日志可视化 | **本次任务** |
| Phase 3 | 资产操作与状态流转集成 | 待规划 |

### 本次 Phase 交付物清单

```
SWARM-051
├── AssetDetailView.vue          # 资产详情主视图组件
├── components/
│   ├── AssetInfoCard.vue        # 资产基础信息卡片
│   ├── AssetMetadataTable.vue   # 资产元数据表格
│   ├── AuditLogTimeline.vue     # 审计日志时间线展示
│   └── AuditLogFilter.vue       # 审计日志筛选器
├── composables/
│   └── useAuditLog.ts           # 审计日志数据获取逻辑
├── services/
│   └── auditApi.ts              # AuditService API 封装
└── types/
    └── audit.types.ts           # 审计相关 TypeScript 类型定义
```

---

## 边界约束

### 技术边界

| 约束项 | 具体要求 |
|--------|----------|
| 前端框架 | Vue 3.4+，Composition API，`<script setup>` 语法 |
| 状态管理 | Pinia，仅用于审计日志筛选状态的本地持久化 |
| HTTP 客户端 | Axios，已全局配置 BaseURL 为 `/api/v1` |
| 类型约束 | 严格模式启用，所有 API 响应必须声明接口类型 |

### 数据边界

| 约束项 | 具体要求 |
|--------|----------|
| 资产数据源 | 仅从已定义的 Asset REST API 获取，不涉及 RPC 调用 |
| 审计日志范围 | 限定当前资产 ID 关联的审计记录，支持时间范围过滤 |
| 分页策略 | 审计日志采用游标分页（Cursor-based Pagination），每页 20 条 |
| 敏感字段 | 审计日志中的 `userId` 字段需脱敏展示，仅显示用户名 |

### 集成边界

| 约束项 | 具体要求 |
|--------|----------|
| @Auditable 注解绑定 | 前端仅消费已注解字段的变更记录，不处理注解定义本身 |
| AuditService 对接 | 通过 `GET /audit/records?entityType=asset&entityId={id}` 获取数据 |
| 实时性要求 | 审计日志列表允许 30 秒缓存，详情页初始化时强制刷新 |

### UI/UX 边界

| 约束项 | 具体要求 |
|--------|----------|
| 响应式断点 | 资产详情页需适配 Desktop (≥1200px) 和 Tablet (768px-1199px) |
| 加载状态 | API 请求期间需展示骨架屏（Skeleton），禁用时长上限 5 秒 |
| 错误状态 | 网络错误需展示重试按钮，401/403 跳转至统一登录/无权限页 |

---

## 验收测试基准 (ATB)

### ATB-001: 资产详情页初始加载

**测试场景**: 用户访问资产详情页 `/assets/:id`

**物理测试步骤**:

```python
# pytest + playwright
def test_asset_detail_page_loads():
    page.goto("/assets/asset-12345")
    
    # 验证骨架屏出现
    assert page.locator(".skeleton-card").is_visible()
    
    # 等待数据加载完成
    page.wait_for_selector(".asset-info-card", state="visible", timeout=10000)
    
    # 验证资产名称展示
    assert page.locator("[data-testid='asset-name']").text_content() == "测试资产-001"
    
    # 验证资产状态标签
    assert page.locator("[data-testid='asset-status']").text_content() == "运行中"
```

**期待结果**: 页面在 3 秒内完成数据渲染，资产基础信息完整展示。

---

### ATB-002: 审计日志时间线展示

**测试场景**: 资产详情页加载后，审计日志模块正确渲染

**物理测试步骤**:

```python
def test_audit_log_timeline_renders():
    page.goto("/assets/asset-12345")
    page.wait_for_selector(".audit-log-section", state="visible")
    
    # 验证时间线条目数量
    timeline_items = page.locator(".audit-timeline-item")
    assert timeline_items.count() >= 1
    
    # 验证首个条目包含操作类型
    first_item = timeline_items.first
    assert first_item.locator(".audit-action").text_content() in [
        "CREATE", "UPDATE", "DELETE", "VIEW"
    ]
    
    # 验证用户信息脱敏
    user_text = first_item.locator(".audit-user").text_content()
    assert "@" not in user_text  # 不应展示 userId 邮箱格式
```

**期待结果**: 时间线按时间倒序展示，每条记录包含操作类型、操作人、操作时间、变更摘要。

---

### ATB-003: 审计日志筛选功能

**测试场景**: 用户使用时间范围筛选器过滤审计日志

**物理测试步骤**:

```python
def test_audit_log_filter_by_date_range():
    page.goto("/assets/asset-12345")
    page.wait_for_selector(".audit-log-section")
    
    # 设置时间范围：最近 7 天
    page.click("[data-testid='date-range-picker']")
    page.select_option(".preset-range", "last7days")
    page.click(".apply-filter-btn")
    
    # 等待列表刷新
    page.wait_for_response("**/audit/records**")
    
    # 验证请求参数包含时间范围
    def handle_request(request):
        assert "startTime" in request.url
        assert "endTime" in request.url
    
    page.on("request", handle_request)
    page.click(".apply-filter-btn")
```

**期待结果**: 筛选器触发 API 调用，请求 URL 包含 `startTime` 和 `endTime` 参数，列表按新条件刷新。

---

### ATB-004: AuditService API 集成

**测试场景**: 前端正确对接 AuditService 并处理分页响应

**物理测试步骤**:

```python
def test_audit_service_pagination():
    # Mock AuditService 响应
    mock_response = {
        "data": [
            {"id": "audit-001", "action": "UPDATE", "timestamp": "2025-01-10T10:00:00Z"},
            {"id": "audit-002", "action": "CREATE", "timestamp": "2025-01-09T08:00:00Z"}
        ],
        "pagination": {
            "cursor": "next-cursor-token",
            "hasMore": True,
            "pageSize": 20
        }
    }
    
    page.goto("/assets/asset-12345")
    
    # 验证下一页加载
    page.click("[data-testid='load-more-btn']")
    page.wait_for_response("**/audit/records**cursor=next-cursor-token**")
    
    # 验证总条目增加
    assert page.locator(".audit-timeline-item").count() > 2
```

**期待结果**: 游标分页正确工作，"加载更多"触发下一页数据追加，非覆盖式更新。

---

### ATB-005: @Auditable 注解字段变更高亮

**测试场景**: 审计日志中标注为 `@Auditable` 的字段变更需视觉高亮

**物理测试步骤**:

```python
def test_auditable_field_highlight():
    page.goto("/assets/asset-12345")
    
    # 获取包含 UPDATE 操作的日志条目
    update_item = page.locator(".audit-timeline-item").filter(
        has=page.locator(".audit-action:has-text('UPDATE')")
    ).first
    
    # 验证变更字段列表存在
    assert update_item.locator(".changed-fields").is_visible()
    
    # 验证 @Auditable 标注字段有高亮标记
    highlighted_fields = update_item.locator(".field-highlight")
    assert highlighted_fields.count() > 0
    
    # 验证字段显示格式：字段名 (旧值 → 新值)
    first_field = highlighted_fields.first.text_content()
    assert "→" in first_field  # 必须包含值变更箭头
```

**期待结果**: UPDATE 类型日志展示变更字段列表，字段名使用高亮样式，值变更格式为 `字段名: [旧值] → [新值]`。

---

### ATB-006: 错误状态处理

**测试场景**: AuditService 不可用时前端降级处理

**物理测试步骤**:

```python
def test_audit_service_error_handling():
    # 模拟 500 错误
    page.route("**/audit/records**", lambda route: route.fulfill(
        status=500,
        body='{"error": "Internal Server Error"}'
    ))
    
    page.goto("/assets/asset-12345")
    page.wait_for_selector(".audit-log-section")
    
    # 验证错误提示展示
    assert page.locator(".audit-error-state").is_visible()
    assert "加载失败" in page.locator(".audit-error-state").text_content()
    
    # 验证重试按钮存在
    assert page.locator("[data-testid='retry-btn']").is_visible()
    
    # 验证重试功能
    page.route("**/audit/records**", lambda route: route.fulfill(
        status=200,
        json={"data": [], "pagination": {"hasMore": False}}
    ))
    page.click("[data-testid='retry-btn']")
    page.wait_for_selector(".audit-log-section .empty-state")
```

**期待结果**: API 错误时展示错误态 UI，包含重试按钮，重试成功后恢复正常列表展示。

---

## 开发切入层级序列

### L1 - 类型与接口定义（Day 1）

```
优先级: P0
目标: 建立类型安全基础
```

**交付物**:

- `types/audit.types.ts`: 定义审计日志相关 TypeScript 接口
  - `AuditRecord`, `AuditAction`, `AuditPagination`
  - `AuditFilterParams` 用于筛选条件

**入口文件**:
```typescript
// types/audit.types.ts
export interface AuditRecord {
  id: string;
  entityType: 'asset';
  entityId: string;
  action: AuditAction;
  timestamp: string;
  userId: string;
  userName: string;
  changes?: FieldChange[];
}

export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  isAuditable: boolean;  // 标识是否来自 @Auditable 注解
}
```

**验收**: TypeScript 编译无错误，IDE 自动补全正常工作。

---

### L2 - API 服务层（Day 1）

```
优先级: P0
目标: 封装 AuditService 调用逻辑
依赖: L1
```

**交付物**:

- `services/auditApi.ts`: AuditService REST API 封装
  - `fetchAuditRecords(params: AuditFilterParams): Promise<AuditResponse>`
  - 请求拦截器添加 `entityType=asset` 固定参数
  - 响应拦截器统一处理错误码

**核心逻辑**:
```typescript
// services/auditApi.ts
export const auditApi = {
  async getRecords(entityId: string, params?: AuditFilterParams) {
    const response = await axios.get('/audit/records', {
      params: {
        entityType: 'asset',
        entityId,
        ...params
      }
    });
    return response.data as AuditResponse;
  }
};
```

**验收**: API 封装可通过 Jest Mock 测试，HTTP 请求参数正确序列化。

---

### L3 - 审计日志数据获取 Composable（Day 2）

```
优先级: P0
目标: 封装数据获取与状态管理逻辑
依赖: L1, L2
```

**交付物**:

- `composables/useAuditLog.ts`: 审计日志数据获取逻辑封装
  - 状态管理：`records`, `loading`, `error`, `hasMore`, `cursor`
  - 方法：`loadInitial()`, `loadMore()`, `applyFilter()`

**验收**: Composable 可独立测试，状态转换符合预期（loading → success/error）。

---

### L4 - 审计日志 UI 组件（Day 2-3）

```
优先级: P0
目标: 完成审计日志展示组件开发
依赖: L1, L2, L3
```

**交付物**:

| 组件 | 职责 |
|------|------|
| `AuditLogTimeline.vue` | 时间线容器，渲染日志列表 |
| `AuditLogFilter.vue` | 筛选器组件，包含时间范围、操作类型 |
| `AuditTimelineItem.vue` | 单条日志条目，含高亮逻辑 |

**@Auditable 高亮逻辑**:
```vue
<!-- AuditTimelineItem.vue -->
<template>
  <div class="audit-timeline-item">
    <div class="audit-action">{{ record.action }}</div>
    <div class="changed-fields" v-if="record.changes?.length">
      <span 
        v-for="change in record.changes" 
        :key="change.field"
        :class="{ 'field-highlight': change.isAuditable }"
      >
        {{ change.field }}: {{ change.oldValue }} → {{ change.newValue }}
      </span>
    </div>
  </div>
</template>
```

**验收**: ATB-002, ATB-005 通过。

---

### L5 - 资产详情主视图集成（Day 3-4）

```
优先级: P0
目标: 组装资产详情页面，整合审计日志模块
依赖: L1-L4
```

**交付物**:

- `views/AssetDetailView.vue`: 资产详情主视图
  - 布局：左侧资产信息卡片，右侧审计日志模块（Desktop）/ 垂直堆叠（Tablet）
  - 初始化时并行加载资产数据与审计日志

**验收**: ATB-001 通过，页面加载时间 ≤ 3 秒。

---

### L6 - 端到端联调与测试（Day 5）

```
优先级: P1
目标: 与后端 AuditService 联调，修复接口问题
依赖: L1-L5
```

**交付物**:

- Playwright E2E 测试脚本覆盖所有 ATB 场景
- 响应式布局验证（Desktop/Tablet）

**验收**: 所有 ATB 测试通过 (100% pass rate)。

---

### 开发依赖图

```
[L1: 类型定义] ──┐
                 ├──► [L2: API 层] ──┐
[L1: 类型定义] ──┘                    │
                                    ├──► [L3: Composable] ──┐
[L1: 类型定义] ──┐                    │                       │
                 ├──► [L2: API 层] ──┘                       │
[L1: 类型定义] ──┘                                            │
                                                            ├──► [L4: UI组件]
                                                            │
[L1: 类型定义] ──────────────────────────────────────────────┤
                                                            │
                                                            ├──► [L5: 主视图] ──► [L6: E2E测试]
```

---

## 附录：关键 API 端点参考

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/audit/records` | GET | 查询审计记录，支持 `entityType`, `entityId`, `startTime`, `endTime`, `cursor` 参数 |
| `/api/v1/assets/{id}` | GET | 获取资产详情（主数据，非本次任务重点） |

---

## AuditLogFilter.vue 组件规格

### 组件概述

`AuditLogFilter.vue` 是审计日志模块的筛选器组件，负责提供时间范围筛选和操作类型筛选功能。

### Props 接口

```typescript
interface AuditLogFilterProps {
  /**
   * 初始起始时间（ISO 8601 格式）
   */
  initialStartTime?: string;
  
  /**
   * 初始结束时间（ISO 8601 格式）
   */
  initialEndTime?: string;
  
  /**
   * 初始选中的操作类型列表
   */
  initialActions?: AuditAction[];
  
  /**
   * 是否禁用筛选器
   */
  disabled?: boolean;
  
  /**
   * 预设时间范围选项
   */
  presetRanges?: Array<{
    label: string;
    value: string;
    getRange: () => { start: string; end: string };
  }>;
}
```

### Emits 事件

```typescript
interface AuditLogFilterEmits {
  /**
   * 筛选条件变更时触发
   * @param filter - 新的筛选条件
   */
  (e: 'filter-change', filter: AuditFilterParams): void;
  
  /**
   * 重置筛选条件时触发
   */
  (e: 'filter-reset'): void;
}
```

### 功能需求

1. **时间范围选择**
   - 支持自定义日期范围选择（使用 el-date-picker）
   - 提供预设选项：最近 7 天、最近 30 天、本月、上月
   - 支持清空时间范围

2. **操作类型筛选**
   - 支持多选操作类型：CREATE, UPDATE, DELETE, VIEW
   - 提供全选/取消全选快捷操作
   - 默认为全部选中

3. **筛选操作**
   - "应用筛选"按钮触发 `filter-change` 事件
   - "重置"按钮清空所有筛选条件并触发 `filter-reset` 事件
   - 禁用状态下按钮不可点击

4. **状态管理**
   - 内部维护筛选状态（startTime, endTime, actions）
   - 支持通过 props 初始化状态
   - 状态变更后需用户主动点击"应用"才会触发事件

---

**文档版本**: v1.0  
**适用迭代**: SWARM-051 Iteration 1  
**最后更新**: 2025-01-15