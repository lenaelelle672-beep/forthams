# SWARM-003 操作日志仪表板 - 规格指导文档

## 版本信息

| 字段 | 值 |
|------|-----|
| 任务编号 | SWARM-003 |
| 迭代版本 | Iteration 1 |
| 文档状态 | Active |
| 制定日期 | 2025-01-23 |

---

## 1. 需求与背景

### 1.1 业务需求

随着 Graphify 知识图谱系统运行时间的增长，系统产生大量操作日志与审计数据。现阶段这些数据以结构化记录形式存储，但缺乏直观的可视化呈现手段，导致运维人员与安全审计人员难以快速把握以下关键信息：

- **操作频率趋势**：识别异常高频操作模式
- **风险事件分布**：展示各类风险等级的操作占比
- **用户行为画像**：审计特定用户的操作轨迹
- **系统健康状态**：通过操作日志反推系统稳定性

### 1.2 核心目标

构建独立的 **操作日志仪表板 (Operation Log Dashboard)**，实现审计数据的可视化与趋势分析能力，使用户能够直观查看操作日志与风险趋势。

### 1.3 关键干系人

| 角色 | 关注点 |
|------|--------|
| 系统运维工程师 | 操作频率异常、系统负载关联 |
| 安全审计人员 | 风险事件定位、合规审计 |
| 管理员 | 用户行为监控、权限变更追踪 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 映射

参照 plan.md 的 Phase 拆解，**SWARM-003 Iteration 1** 对准 **Phase 1: 核心仪表板框架与基础可视化**。

### 2.2 Phase 1 交付范围

| 序号 | 交付物 | 描述 |
|------|--------|------|
| P1-01 | 日志聚合 API 端点 | 提供日志数据分页查询与聚合统计 |
| P1-02 | 操作趋势折线图 | 展示指定时间范围内的操作数量趋势 |
| P1-03 | 风险分布饼图 | 展示各类风险等级的操作占比 |
| P1-04 | 近期日志列表组件 | 显示最新 N 条操作日志条目 |
| P1-05 | 基础筛选与时间范围控件 | 支持按操作类型、用户、时间范围过滤 |

### 2.3 非 Phase 1 范围（将在后续 Iteration 覆盖）

- 高级告警规则配置
- 自定义报表导出
- 跨系统关联分析
- 移动端适配

---

## 3. 边界约束

### 3.1 技术边界

| 约束项 | 具体限制 |
|--------|----------|
| 数据源依赖 | 仅对接 Graphify 现有 `operation_logs` 表结构，不修改底层存储 |
| 数据时效 | 仪表板展示最近 **90 天** 内的日志数据 |
| 实时性 | 数据刷新周期不低于 **5 分钟**（非实时流） |
| 前端框架 | 必须使用系统既定的 Chart.js 或 ECharts（避免引入新的可视化库） |
| 并发限制 | 单个 API 请求响应时间不超过 **2 秒**（数据量 < 10,000 条） |

### 3.2 功能边界

| 边界类型 | 说明 |
|----------|------|
| **不包含** | 日志的增删改操作（仅读） |
| **不包含** | 日志数据的导出功能 |
| **不包含** | 跨租户数据隔离（当前为单租户场景） |
| **不包含** | 日志全文检索（Elasticsearch 集成） |
| **不包含** | 告警触发与通知推送 |

### 3.3 安全边界

- 仪表板访问需通过既有的身份认证中间件
- 敏感字段（如用户密码变更详情）需脱敏后展示
- API 响应禁止包含原始 SQL 语句

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试 (pytest)

#### ATB-001: 日志聚合 API 正确性

```python
# tests/api/test_log_aggregation.py

def test_log_aggregation_returns_correct_count(db_session, sample_logs):
    """ATB-001: 验证聚合 API 返回的日志总数与数据库记录一致"""
    response = client.get("/api/v1/logs/aggregate?start_date=2025-01-01&end_date=2025-01-23")
    assert response.status_code == 200
    assert response.json()["total_count"] == len(sample_logs)

def test_log_aggregation_with_type_filter(db_session, sample_logs):
    """ATB-001: 验证按操作类型过滤的聚合结果准确性"""
    response = client.get("/api/v1/logs/aggregate?operation_type=CREATE")
    data = response.json()
    assert data["total_count"] == sum(1 for log in sample_logs if log.type == "CREATE")

def test_log_aggregation_time_range_validation():
    """ATB-001: 验证超出 90 天限制时返回 400 错误"""
    response = client.get("/api/v1/logs/aggregate?start_date=2024-01-01&end_date=2025-01-23")
    assert response.status_code == 400
    assert "exceeds 90 days" in response.json()["error"]
```

#### ATB-002: 趋势数据计算准确性

```python
# tests/api/test_trend_calculation.py

def test_daily_trend_calculation(db_session, sample_logs):
    """ATB-002: 验证每日操作数量的趋势数据计算"""
    response = client.get("/api/v1/logs/trend/daily?days=7")
    data = response.json()
    # 验证返回数据点数量
    assert len(data["series"]) == 7
    # 验证每日数据格式
    for point in data["series"]:
        assert "date" in point
        assert "count" in point
        assert point["count"] >= 0
```

#### ATB-003: 风险分布数据正确性

```python
# tests/api/test_risk_distribution.py

def test_risk_distribution_ratios(db_session, mixed_risk_logs):
    """ATB-003: 验证风险等级占比计算"""
    response = client.get("/api/v1/logs/risk/distribution")
    data = response.json()
    # 验证所有风险等级占比之和为 100%
    total_ratio = sum(item["ratio"] for item in data["distribution"])
    assert abs(total_ratio - 100.0) < 0.01
```

#### ATB-004: 敏感字段脱敏验证

```python
# tests/api/test_data_masking.py

def test_sensitive_data_masked_in_response(db_session, password_change_log):
    """ATB-004: 验证敏感操作详情中的密码字段已脱敏"""
    response = client.get(f"/api/v1/logs/{password_change_log.id}")
    detail = response.json()["detail"]
    assert "password" not in detail.lower() or detail.count("*") > 0
```

### 4.2 端到端测试 (Playwright)

#### ATB-005: 仪表板页面加载

```python
# tests/e2e/test_dashboard_load.py

def test_dashboard_page_loads_successfully(page: Page):
    """ATB-005: 验证仪表板页面正常加载，核心组件均可见"""
    page.goto("/dashboard/operation-logs")
    
    # 验证页面标题
    assert page.locator("h1").text_content() == "操作日志仪表板"
    
    # 验证图表组件存在
    assert page.locator("[data-testid='trend-chart']").is_visible()
    assert page.locator("[data-testid='risk-chart']").is_visible()
    assert page.locator("[data-testid='log-list']").is_visible()

def test_dashboard_renders_trend_chart(page: Page):
    """ATB-005: 验证趋势图表正确渲染数据点"""
    page.goto("/dashboard/operation-logs")
    
    chart = page.locator("[data-testid='trend-chart'] canvas")
    assert chart.is_visible()
    # 验证图表 canvas 元素存在（ECharts/Chart.js 渲染产物）
```

#### ATB-006: 筛选功能交互

```python
# tests/e2e/test_dashboard_filters.py

def test_filter_by_operation_type(page: Page):
    """ATB-006: 验证操作类型筛选后，日志列表仅显示目标类型"""
    page.goto("/dashboard/operation-logs")
    
    # 选择筛选条件
    page.locator("[data-testid='filter-operation-type']").select_option("DELETE")
    page.locator("[data-testid='apply-filter']").click()
    
    # 等待列表刷新
    page.wait_for_timeout(500)
    
    # 验证列表中所有条目均为 DELETE 类型
    log_items = page.locator("[data-testid='log-item']")
    count = log_items.count()
    for i in range(count):
        type_badge = log_items.nth(i).locator("[data-testid='log-type']")
        assert type_badge.text_content() == "DELETE"

def test_time_range_picker_updates_charts(page: Page):
    """ATB-006: 验证时间范围选择后，图表数据随之更新"""
    page.goto("/dashboard/operation-logs")
    
    initial_data = page.evaluate("window.__dashboardData__.trend")
    
    # 修改时间范围为最近 30 天
    page.locator("[data-testid='time-range']").select_option("last_30_days")
    
    page.wait_for_timeout(1000)
    
    updated_data = page.evaluate("window.__dashboardData__.trend")
    assert len(updated_data) != len(initial_data) or updated_data != initial_data
```

#### ATB-007: 风险趋势仪表板入口

```python
# tests/e2e/test_risk_trend_navigation.py

def test_navigate_to_risk_trend_from_dashboard(page: Page):
    """ATB-007: 验证从操作日志仪表板可导航至风险趋势视图"""
    page.goto("/dashboard/operation-logs")
    
    # 点击风险趋势入口
    page.locator("[data-testid='nav-risk-trend']").click()
    
    # 验证跳转至风险趋势页面
    assert page.url == "/dashboard/risk-trend"
    assert page.locator("h1").text_content() == "风险趋势分析"
```

#### ATB-008: 响应式布局验证

```python
# tests/e2e/test_dashboard_responsive.py

def test_dashboard_layout_on_tablet(page: Page):
    """ATB-008: 验证平板尺寸 (768px) 下仪表板布局正常"""
    page.set_viewport_size({"width": 768, "height": 1024})
    page.goto("/dashboard/operation-logs")
    
    # 验证图表保持可见
    assert page.locator("[data-testid='trend-chart']").is_visible()
    # 验证日志列表可滚动
    log_list = page.locator("[data-testid='log-list']")
    assert log_list.bounding_box()["width"] < 768
```

### 4.3 性能测试基准

| 基准编号 | 测试场景 | 性能目标 | 测试方法 |
|----------|----------|----------|----------|
| PTB-001 | 仪表板首次加载 | P95 ≤ 3 秒 | Playwright `page.waitForLoadState` + `performance.timing` |
| PTB-002 | 筛选后列表刷新 | ≤ 1.5 秒 | Playwright 计时 `page.locator.click()` 到数据渲染完成 |
| PTB-003 | API 响应时间 (1000 条数据) | ≤ 2 秒 | pytest-benchmark 或 locust 压测 |

---

## 5. 开发切入层级序列

### 5.1 层级架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    前端展示层 (UI Layer)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  TrendChart │  │ RiskPieChart│  │ LogListTable│     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
├─────────────────────────────────────────────────────────┤
│                    数据获取层 (API Layer)                │
│  GET /api/v1/logs/aggregate                             │
│  GET /api/v1/logs/trend/daily                           │
│  GET /api/v1/logs/risk/distribution                     │
│  GET /api/v1/logs/recent                                │
├─────────────────────────────────────────────────────────┤
│                    服务逻辑层 (Service Layer)             │
│  LogAggregationService                                  │
│  TrendCalculationService                                │
│  RiskAnalysisService                                    │
├─────────────────────────────────────────────────────────┤
│                    数据访问层 (Repository Layer)         │
│  OperationLogRepository                                 │
│  (对接现有 operation_logs 表)                           │
└─────────────────────────────────────────────────────────┘
```

### 5.2 开发序列

| 阶段 | 层级 | 任务项 | 依赖关系 |
|------|------|--------|----------|
| **Phase 1.1** | 数据访问层 | 验证 `operation_logs` 表结构，编写 Repository 查询方法 | 无 |
| **Phase 1.2** | 数据访问层 | 实现日志分页查询与基础聚合统计 SQL | Phase 1.1 |
| **Phase 1.3** | 服务逻辑层 | 实现 `LogAggregationService` 聚合计算逻辑 | Phase 1.2 |
| **Phase 1.4** | 服务逻辑层 | 实现 `TrendCalculationService` 时间序列统计逻辑 | Phase 1.2 |
| **Phase 1.5** | 服务逻辑层 | 实现 `RiskAnalysisService` 风险分布统计逻辑 | Phase 1.2 |
| **Phase 1.6** | API 层 | 开发 `GET /api/v1/logs/*` 端点，集成 Service 层 | Phase 1.3/1.4/1.5 |
| **Phase 1.7** | API 层 | 实现数据脱敏中间件与边界校验（90 天限制） | Phase 1.6 |
| **Phase 1.8** | 前端展示层 | 搭建仪表板页面框架与路由 | Phase 1.6 |
| **Phase 1.9** | 前端展示层 | 集成 TrendChart 趋势折线图组件 | Phase 1.8 |
| **Phase 1.10** | 前端展示层 | 集成 RiskPieChart 风险分布饼图组件 | Phase 1.8 |
| **Phase 1.11** | 前端展示层 | 集成 LogListTable 日志列表组件 | Phase 1.8 |
| **Phase 1.12** | 前端展示层 | 实现筛选控件（类型、用户、时间范围）与状态联动 | Phase 1.9/1.10/1.11 |

### 5.3 关键实现细节

#### 5.3.1 数据库查询（Repository 层）

```sql
-- operation_logs 表结构假设
CREATE TABLE operation_logs (
    id BIGINT PRIMARY KEY,
    user_id VARCHAR(64),
    operation_type VARCHAR(32),   -- CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT
    resource_type VARCHAR(64),
    resource_id VARCHAR(128),
    risk_level VARCHAR(16),        -- LOW, MEDIUM, HIGH, CRITICAL
    ip_address VARCHAR(45),
    detail JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 聚合查询示例（趋势统计）
SELECT DATE(created_at) as date, COUNT(*) as count
FROM operation_logs
WHERE created_at >= :start_date AND created_at <= :end_date
GROUP BY DATE(created_at)
ORDER BY date;
```

#### 5.3.2 API 响应格式

```json
// GET /api/v1/logs/trend/daily?days=7
{
  "success": true,
  "data": {
    "period": "7d",
    "series": [
      {"date": "2025-01-17", "count": 142},
      {"date": "2025-01-18", "count": 98},
      {"date": "2025-01-19", "count": 215}
    ]
  }
}
```

#### 5.3.3 前端组件关键 Props

```typescript
// TrendChart 组件接口
interface TrendChartProps {
  data: Array<{ date: string; count: number }>;
  loading?: boolean;
  onPointClick?: (date: string) => void;
}

// RiskPieChart 组件接口
interface RiskPieChartProps {
  data: Array<{ level: RiskLevel; count: number; ratio: number }>;
  colors?: Record<RiskLevel, string>;
}
```

---

## 6. 附录

### 6.1 风险等级定义

| 等级 | 标识 | 典型操作场景 |
|------|------|--------------|
| LOW | 低风险 | 数据查询、资源浏览 |
| MEDIUM | 中风险 | 数据创建、常规更新 |
| HIGH | 高风险 | 权限变更、批量删除 |
| CRITICAL | 极高风险 | 账户删除、密码重置、系统配置修改 |

### 6.2 相关文档索引

| 文档 | 路径 | 用途 |
|------|------|------|
| plan.md | `/docs/plan.md` | Phase 整体拆解参考 |
| 数据库 Schema | `/docs/schema/operation_logs.md` | 表结构定义 |
| API 规范 | `/docs/api/swagger.yaml` | 端点详细定义 |

---

*本规格文档为 SWARM-003 Iteration 1 的唯一执行基准，所有开发与测试活动须严格对齐本文档定义的范围与验收标准。*