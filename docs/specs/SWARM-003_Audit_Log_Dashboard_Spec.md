# SWARM-003 操作日志可视化仪表板 - 规格指导文档

## 需求与背景

### 业务背景

| 驱动因素 | 描述 |
|----------|------|
| 合规性要求 | 组织对运维操作可追溯性有强合规要求，需实时呈现审计日志统计 |
| 数据可读性 | 当前审计日志以文本形式存储，缺乏可视化分析与数据导出能力 |
| 用户体验 | 前端仪表板需提供直观的数据洞察与合规报告输出 |

### 功能范围

本次迭代（Iteration 1）聚焦于以下核心功能：

1. **审计日志统计图表展示**
   - 操作频次趋势图（折线图）
   - 操作类型分布图（饼图）
   - 操作者排行榜（柱状图）

2. **多维度筛选能力**
   - 按操作类型（operation_type）筛选
   - 按时间范围（created_at）筛选
   - 组合筛选支持

3. **操作记录报表导出**
   - CSV 格式导出
   - PDF 格式导出（可选）
   - 支持筛选后数据导出

---

## 当前 Phase 对应实施目标

### Phase 1: 核心功能实现（Iteration 1）

| 优先级 | 实施项 | 描述 | 交付物 |
|--------|--------|------|--------|
| P0 | 仪表板页面框架 | 搭建审计仪表板页面布局框架 | `AuditDashboard` 页面组件 |
| P0 | 统计图表组件 | 实现趋势图、饼图、排行榜三类图表 | `TrendChart`, `DistributionChart`, `TopOperatorsChart` |
| P0 | 筛选器组件 | 实现操作类型下拉、时间范围选择器 | `OperationTypeFilter`, `DateRangePicker` |
| P1 | 导出功能 | 实现 CSV/PDF 报表导出 | `ExportButton`, `useExportHook` |
| P2 | 权限控制 | 限制仅 admin/auditor 角色访问 | `useAuditPermission` hook |

### 交付文件清单

| 文件路径 | 修改类型 | 变更描述 |
|----------|----------|----------|
| `tests/frontend/ticket-list.spec.ts` | 修改 | 添加审计仪表板 E2E 测试用例 |
| `frontend/src/app/utils/permissionHooks.ts` | 修改 | 添加审计模块权限钩子 |
| `frontend/src/app/components/AssetDetailModal.tsx` | 修改 | 集成审计日志展示组件 |
| `frontend/src/app/pages/Settings.tsx` | 修改 | 添加审计配置入口链接 |
| `frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css` | 修改 | 仪表板样式文件 |

---

## 边界约束

### 硬性约束

| 约束项 | 限制值 | 说明 |
|--------|--------|------|
| 数据时间范围 | 近 12 个月内 | 仅支持查询近 12 个月的审计日志 |
| CSV 导出上限 | 10,000 条 | 单次 CSV 导出最多 10,000 条记录 |
| PDF 导出上限 | 1,000 条 | 单次 PDF 导出最多 1,000 条记录 |
| 时间筛选粒度 | 1 分钟 | 最小时间筛选粒度为 1 分钟 |
| 并发限制 | 50 个请求 | 日志统计 API 同一时刻最多 50 个并发 |
| 数据点阈值 | 5,000 个 | 超过 5,000 个数据点时启用抽样 |
| 权限角色 | admin, auditor | 仅 `admin` 和 `auditor` 角色可访问 |

### 软性约束（建议）

| 约束项 | 目标值 | 说明 |
|--------|--------|------|
| 图表加载时间 | < 3 秒 | 首屏图表渲染应在 3 秒内完成 |
| 导出响应时间 | < 10 秒 | 10,000 条 CSV 导出应在 10 秒内完成 |
| 筛选响应时间 | < 1 秒 | 筛选条件变更后图表刷新应在 1 秒内 |

### 排除范围（Out of Scope）

- 审计日志的写入功能（假定已存在，由后端维护）
- 实时推送能力（WebSocket）
- 自定义报表模板
- 多语言国际化（i18n）
- 审计日志的编辑/删除功能

---

## 验收测试基准 (ATB)

### ATB-1: 审计日志统计图表功能

| 测试编号 | 测试场景 | 物理测试期待 | 验证方法 |
|----------|----------|--------------|----------|
| ATB-1.1 | 趋势图加载 | 页面加载后 3 秒内渲染趋势图，SVG/Canvas 元素可见 | Playwright E2E |
| ATB-1.2 | 饼图渲染 | 饼图扇区数与数据库 `DISTINCT operation_type` 数量一致 | Playwright + API Mock |
| ATB-1.3 | 排行榜显示 | 显示 Top 10 操作者，柱状图数据正确 | Playwright 断言 |
| ATB-1.4 | 空数据状态 | 无数据时显示友好的空状态提示 | Playwright |

**测试文件**: `tests/frontend/ticket-list.spec.ts`

```typescript
test('ATB-1.1: 趋势图加载成功', async ({ page }) => {
  await page.goto('/dashboard/audit');
  const trendChart = page.locator('[data-testid="trend-chart"]');
  await expect(trendChart).toBeVisible({ timeout: 5000 });
  await page.waitForSelector('[data-testid="chart-loaded"]', { timeout: 3000 });
});
```

### ATB-2: 筛选功能验证

| 测试编号 | 测试场景 | 物理测试期待 | 验证方法 |
|----------|----------|--------------|----------|
| ATB-2.1 | 按操作类型筛选 | 筛选 `delete` 类型后，表格该列值统一为 `delete` | Playwright + API |
| ATB-2.2 | 按时间范围筛选 | 筛选 2024-01-15 ~ 2024-01-31，返回结果 `created_at` 均在区间内 | pytest 断言 |
| ATB-2.3 | 组合筛选 | 同时筛选 operation_type + 时间范围，结果同时满足两个条件 | Playwright |
| ATB-2.4 | 筛选重置 | 点击重置按钮，筛选条件恢复默认值 | Playwright |

**测试文件**: `tests/e2e/test_dashboard_filters.py`

```python
def test_filter_by_operation_type(api_client, db_session):
    """ATB-2.1: 按操作类型筛选"""
    response = api_client.get("/api/v1/audit/logs?operation_type=delete")
    assert response.status_code == 200
    items = response.json()["data"]
    assert all(item["operation_type"] == "delete" for item in items)
```

### ATB-3: 报表导出功能

| 测试编号 | 测试场景 | 物理测试期待 | 验证方法 |
|----------|----------|--------------|----------|
| ATB-3.1 | CSV 导出（常规量） | 导出 500 条记录，响应 `Content-Type: text/csv`，包含 header + 500 行 | pytest |
| ATB-3.2 | CSV 导出（边界量） | 导出 10,000 条记录，响应成功，header 包含 `Content-Disposition: attachment` | pytest |
| ATB-3.3 | CSV 导出（超限拦截） | 请求导出 10,001 条，返回 `400 Bad Request`，错误码 `EXPORT_LIMIT_EXCEEDED` | pytest |
| ATB-3.4 | PDF 导出 | 响应 `Content-Type: application/pdf`，PDF 可正常打开 | pytest |
| ATB-3.5 | 筛选后导出 | 应用筛选后导出，断言导出数据与筛选结果一致 | Playwright |

**测试文件**: `tests/api/test_audit_export.py`

```python
def test_csv_export_boundary():
    """ATB-3.2: CSV 导出边界量测试"""
    response = client.get("/api/v1/audit/export?format=csv&limit=10000")
    assert response.status_code == 200
    assert "text/csv" in response.headers["Content-Type"]
    lines = response.content.decode().splitlines()
    assert len(lines) == 10001  # header + 10000 data rows

def test_csv_export_limit_exceeded():
    """ATB-3.3: 导出超限拦截"""
    response = client.get("/api/v1/audit/export?format=csv&limit=10001")
    assert response.status_code == 400
    assert response.json()["code"] == "EXPORT_LIMIT_EXCEEDED"
```

### ATB-4: 权限控制

| 测试编号 | 测试场景 | 物理测试期待 | 验证方法 |
|----------|----------|--------------|----------|
| ATB-4.1 | 未授权用户访问 | 以 `guest` 角色访问 `/dashboard/audit`，返回 `403 Forbidden` | Playwright |
| ATB-4.2 | 授权用户正常访问 | 以 `admin` 角色访问，返回 `200 OK` | Playwright |
| ATB-4.3 | API 权限校验 | 以 `guest` 角色调用 API，返回 `403` | pytest |

**测试文件**: `frontend/src/app/utils/permissionHooks.ts`

```typescript
test('ATB-4.1: 未授权用户被拒绝访问', async ({ page }) => {
  // 设置 guest 角色
  await page.context().addInitScript(() => {
    localStorage.setItem('user_role', 'guest');
  });
  
  await page.goto('/dashboard/audit');
  // 期望被重定向到无权限页面或显示 403
  await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
});
```

### ATB-5: 代码质量验收

| 测试编号 | 测试场景 | 物理测试期待 | 验证方法 |
|----------|----------|--------------|----------|
| AC-002 | AST 静态检查 | 所有修改文件通过 Python AST 解析，无语法错误 | `test_ac_002.py` |
| AC-003 | docstring 覆盖 | 所有修改的函数包含 docstring 文档注释 | `test_docstring_coverage.py` |
| AC-004 | 模块可导入 | 变更后的模块可被正常 import 不抛出 ImportError | `test_ac_004.py` |

**测试文件**: `tests/test_ac_002.py`, `tests/test_ac_004.py`

```python
def test_modified_files_have_no_syntax_errors():
    """AC-002: 验证修改的文件无语法错误"""
    modified_files = [
        'frontend/src/app/utils/permissionHooks.ts',
        'frontend/src/app/components/AssetDetailModal.tsx',
        'frontend/src/app/pages/Settings.tsx',
        'frontend/src/app/pages/AuditDashboard/AuditDashboard.module.css',
    ]
    for filepath in modified_files:
        assert is_valid_syntax(read_file(filepath)), f"{filepath} has syntax error"

def test_modules_importable():
    """AC-004: 验证模块可正常导入"""
    # TypeScript/TSX 文件通过 ts-node 或 jest 验证
    # CSS 文件验证无语法错误
    pass
```

---

## 开发切入层级序列

### L1: 数据库层（优先）

```
┌─────────────────────────────────────────────────────────────┐
│ 1.1 扩展审计日志表索引                                        │
│     - operation_type: B-tree 索引（等值查询）                 │
│     - created_at: Range 索引（时间范围查询）                  │
│     - operator: Hash 索引（高频查询优化）                     │
├─────────────────────────────────────────────────────────────┤
│ 1.2 数据模型对齐                                             │
│     - 确认 AuditLog 实体字段与前端 DTO 一致                   │
│     - 补充缺失字段（resource_type, metadata）                 │
└─────────────────────────────────────────────────────────────┘
```

### L2: 后端服务层

```
┌─────────────────────────────────────────────────────────────┐
│ 2.1 聚合查询服务 (AuditStatsService)                         │
│     - get_trend_aggregation(period, start, end)              │
│     - get_type_distribution(start, end)                      │
│     - get_top_operators(limit=10)                            │
├─────────────────────────────────────────────────────────────┤
│ 2.2 日志查询服务 (AuditLogService)                            │
│     - query_logs(filters, pagination)                        │
│     - get_log_detail(id)                                     │
├─────────────────────────────────────────────────────────────┤
│ 2.3 报表导出服务 (ReportExportService)                        │
│     - generate_csv(logs, columns)                             │
│     - generate_pdf(logs, template)                           │
│     - validate_export_limit(count, format)                   │
└─────────────────────────────────────────────────────────────┘
```

### L3: API 网关层

```
┌─────────────────────────────────────────────────────────────┐
│ 3.1 路由定义                                                  │
│     GET /api/v1/audit/stats/trend     → 趋势聚合数据           │
│     GET /api/v1/audit/stats/distribution → 类型分布           │
│     GET /api/v1/audit/stats/top-operators → TOP 排行          │
│     GET /api/v1/audit/logs           → 日志分页查询           │
│     GET /api/v1/audit/export         → 报表导出               │
├─────────────────────────────────────────────────────────────┤
│ 3.2 中间件                                                    │
│     - 权限校验中间件: role in [admin, auditor]                 │
│     - 限流中间件: max 50 concurrent requests                  │
│     - 参数校验: limit <= 10000, format in [csv, pdf]          │
└─────────────────────────────────────────────────────────────┘
```

### L4: 前端组件层

```
┌─────────────────────────────────────────────────────────────┐
│ 4.1 仪表板页面框架                                           │
│     frontend/src/app/pages/AuditDashboard/                    │
│     ├── AuditDashboard.tsx        (主页面)                   │
│     ├── AuditDashboard.module.css (样式)                    │
│     ├── components/                                               │
│     │   ├── TrendChart/           (趋势图)                    │
│     │   ├── DistributionChart/    (分布图)                   │
│     │   ├── TopOperatorsChart/    (排行榜)                   │
│     │   └── FilterBar/            (筛选栏)                   │
│     └── services/                 (API 调用)                 │
├─────────────────────────────────────────────────────────────┤
│ 4.2 权限钩子 (permissionHooks.ts)                            │
│     - useAuditPermission(): 审计模块权限判断                  │
│     - useExportPermission(): 导出功能权限                     │
├─────────────────────────────────────────────────────────────┤
│ 4.3 集成修改                                                  │
│     - AssetDetailModal.tsx: 添加审计日志标签页                │
│     - Settings.tsx: 添加审计配置入口                          │
└─────────────────────────────────────────────────────────────┘
```

### L5: 测试验证层

```
┌─────────────────────────────────────────────────────────────┐
│ 5.1 单元测试                                                  │
│     tests/test_ac_002.py   → AST 语法检查                     │
│     tests/test_ac_003.py  → docstring 覆盖检查               │
│     tests/test_ac_004.py  → 模块导入检查                     │
├─────────────────────────────────────────────────────────────┤
│ 5.2 E2E 测试                                                  │
│     tests/frontend/ticket-list.spec.ts                       │
│     tests/e2e/test_dashboard_filters.py                       │
├─────────────────────────────────────────────────────────────┤
│ 5.3 集成测试                                                  │
│     tests/api/test_audit_export.py                           │
│     tests/api/test_log_aggregation.py                        │
└─────────────────────────────────────────────────────────────┘
```

### 开发启动顺序（6 天迭代）

| 阶段 | 时间 | 任务 | 交付物 |
|------|------|------|--------|
| Day 1-2 | L1 + L2 | 数据库索引 + 后端服务开发 | API 接口就绪 |
| Day 3 | L3 | API 网关 + 权限中间件 | 完整 API 可用 |
| Day 4 | L4.1 | 前端仪表板框架 + 图表组件 | 页面可访问 |
| Day 5 | L4.2-4.3 | 筛选器 + 导出 + 集成修改 | 功能完整 |
| Day 6 | L5 | 全链路 ATB 验收 + Bug Fix | 上线准备 |

### 关键依赖关系

```
[后端 API] ← L2 服务层
    ↓
[L3 API 网关] ← 权限 + 限流
    ↓
[L4 前端组件] ← 仪表板 + 图表
    ↓
[L5 测试验证] ← ATB 验收
```

---

## 附录

### 相关文档

| 文档 | 路径 |
|------|------|
| API 接口文档 | `backend/src/main/java/com/ams/controller/AuditController.java` |
| 前端类型定义 | `frontend/src/app/pages/AuditDashboard/types/audit.types.ts` |
| 审计实体 | `backend/src/main/java/com/ams/entity/AuditLog.java` |

### 术语表

| 术语 | 定义 |
|------|------|
| operation_type | 操作类型（create, update, delete, read 等） |
| operator | 操作者，执行操作的用户 |
| resource_type | 资源类型（asset, user, role 等） |
| AuditLog | 审计日志实体，记录系统操作行为 |