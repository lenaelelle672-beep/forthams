# SWARM-003 仪表板数据看板 Specification

## 版本控制

| 版本 | 日期 | 作者 | 变更说明 |
|-----|------|------|---------|
| 1.0 | 2025-01 | SWARM Team | 初始版本 |

---

## 1. 需求与背景

### 1.1 业务背景

资产管理系统用户登录后需要快速获取资产运营状态的全局视图。当前系统缺少统一的数据展示入口，用户无法直观了解：
- 当前管理的资产总量
- 各类别资产的分布情况
- 需要关注维护的资产预警信息

### 1.2 功能概述

| 功能模块 | 描述 | 优先级 |
|---------|------|--------|
| 资产总览数量统计 | 展示资产总量及各类别资产数量 | P0 |
| 分类统计分布图 | 饼图/柱状图可视化各类资产占比 | P0 |
| 资产预警列表 | 展示即将到期需维护的资产 | P0 |

### 1.3 用户故事

```
作为资产管理员
我希望在仪表板首页看到资产总览数据
以便快速了解当前资产运营状态
```

---

## 2. 当前 Phase 对应实施目标

**Phase 2: 前端展示层建设** (Iteration 1)

| 目标编号 | 具体目标 | 交付物 | 状态 |
|---------|---------|-------|-----|
| G-1 | 资产总览数量统计 | StatCard 组件 + 后端聚合 API | 待开发 |
| G-2 | 分类统计分布图 | CategoryChart ECharts 组件 | 待开发 |
| G-3 | 资产预警列表 | MaintenanceAlertList 组件 | 待开发 |

---

## 3. 边界约束

### 3.1 功能边界

| 约束类型 | 约束内容 |
|---------|---------|
| 仅限只读 | 仪表板所有数据均为只读视图，不包含编辑/创建/删除操作 |
| 时间范围 | 预警列表默认展示未来 30 天内即将到期的资产 |
| 数据权限 | 用户仅可查看其有权限访问的资产数据 |

### 3.2 技术边界

| 约束类型 | 约束内容 |
|---------|---------|
| 图表库 | 采用 ECharts 5.x，与前端框架解耦 |
| 刷新策略 | 页面加载时获取初始数据，支持手动刷新 |
| 响应式 | 仪表板需适配 1280px 及以上屏幕宽度 |
| API 版本 | RESTful API，JSON 响应格式 |

### 3.3 排除范围

| 排除项 | 说明 |
|-------|------|
| 定时任务通知 | 属于 SWARM-00X 通知模块 |
| 资产新增/编辑 | 属于其他功能模块 |
| 仪表板布局自定义 | 本迭代不包含 |
| 数据导出功能 | 本迭代不包含 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: 资产总览数量统计

**验收标准**: 数字卡片数据与后端 API 返回值一致

| 步骤 | 测试描述 | 物理测试期待 |
|-----|---------|-------------|
| 1 | 访问 `/dashboard` 路由 | 页面返回 HTTP 200，仪表板组件完整渲染 |
| 2 | 检查总资产数字卡片 | 卡片内数字与 `GET /api/assets/count` 返回值一致 |
| 3 | 检查分类资产数字卡片 | 各分类数量与 `GET /api/assets/stats/category` 返回值一致 |
| 4 | 模拟空数据场景 | 当无资产时，数字显示为 `0`，卡片布局保持完整 |

**测试用例**:

```python
# tests/api/test_dashboard.py
def test_dashboard_asset_count(client, auth_token):
    """验证资产总览数量 API"""
    response = client.get(
        "/api/assets/count",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert isinstance(data["total"], int)
    assert data["total"] >= 0

def test_dashboard_category_stats(client, auth_token):
    """验证分类统计 API"""
    response = client.get(
        "/api/assets/stats/category",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert isinstance(data["data"], list)
    # 验证分类数据结构
    for item in data["data"]:
        assert "category" in item
        assert "count" in item
        assert isinstance(item["count"], int)
```

### 4.2 ATB-2: 分类统计分布图

**验收标准**: ECharts 图表正确渲染，数据与 API 一致

| 步骤 | 测试描述 | 物理测试期待 |
|-----|---------|-------------|
| 1 | 页面加载后图表容器存在 | DOM 中存在 `id="category-chart"` 的 Canvas 容器 |
| 2 | 图表渲染非空数据 | ECharts 实例初始化，包含至少 1 个 series |
| 3 | 图表数据与 API 一致 | 图表显示的分类比例与 API 返回数据一致 |
| 4 | 空数据时图表降级 | API 返回空数据时，图表区域显示 "暂无数据" 提示 |

**测试用例**:

```typescript
// frontend/tests/e2e/audit_dashboard.spec.ts
test.describe('分类统计分布图', () => {
  test('图表容器正确渲染', async ({ page }) => {
    await page.goto('/dashboard');
    const chartContainer = page.locator('#category-chart');
    await expect(chartContainer).toBeVisible();
    // 等待 ECharts 初始化
    await page.waitForFunction(() => {
      const chart = (window as any).echarts?.getInstanceByDom(
        document.querySelector('#category-chart')
      );
      return chart !== undefined;
    });
  });

  test('图表数据与 API 一致', async ({ page, apiClient }) => {
    const apiData = await apiClient.get('/api/assets/stats/category');
    
    await page.goto('/dashboard');
    
    // 验证图表 series 数据与 API 数据一致
    const chartOption = await page.evaluate(() => {
      const chart = (window as any).echarts?.getInstanceByDom(
        document.querySelector('#category-chart')
      );
      return chart?.getOption();
    });
    
    expect(chartOption.series[0].data.length).toBe(apiData.data.length);
  });
});
```

### 4.3 ATB-3: 资产预警列表

**验收标准**: 预警列表正确展示维护即将到期的资产

| 步骤 | 测试描述 | 物理测试期待 |
|-----|---------|-------------|
| 1 | 预警列表容器渲染 | DOM 中存在 `#maintenance-alert-list` 列表容器 |
| 2 | 列表项数量限制 | 单页最多展示 10 条预警记录 |
| 3 | 预警项数据字段完整 | 每条记录包含：资产名称、维护类型、到期日期、剩余天数 |
| 4 | 到期时间计算准确性 | `remaining_days = expiry_date - today` |
| 5 | 过期资产排除 | 预警列表不包含已过期资产 |
| 6 | 点击跳转功能 | 点击预警项跳转到 `/assets/{id}` 详情页 |

**测试用例**:

```python
# tests/api/test_audit_dashboard.py
def test_alert_list_excludes_expired(client, auth_token):
    """验证预警列表排除已过期资产"""
    response = client.get(
        "/api/assets/alerts?days=30",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    
    today = date.today()
    for item in response.json()["data"]:
        expiry_date = datetime.strptime(item["expiry_date"], "%Y-%m-%d").date()
        assert expiry_date >= today, \
            f"预警列表包含已过期资产: {item['name']} (到期: {expiry_date})"

def test_alert_remaining_days_calculation(client, auth_token):
    """验证剩余天数计算准确性"""
    response = client.get(
        "/api/assets/alerts?days=30",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    
    today = date.today()
    for item in response.json()["data"]:
        expected_days = (
            datetime.strptime(item["expiry_date"], "%Y-%m-%d").date() - today
        ).days
        assert item["remaining_days"] == expected_days, \
            f"剩余天数计算错误: {item['name']}, " \
            f"期望 {expected_days}, 实际 {item['remaining_days']}"
```

### 4.4 ATB-4: 权限隔离验证

**验收标准**: 用户仅可查看有权限访问的资产数据

| 步骤 | 测试描述 | 物理测试期待 |
|-----|---------|-------------|
| 1 | 用户 A 无法查看用户 B 的资产 | 响应数据中不包含无权限资产 ID |
| 2 | 无资产权限时显示空状态 | 数字卡片显示 `0`，图表显示 "暂无数据" |

**测试用例**:

```python
# tests/api/test_data_masking.py
def test_permission_isolation_dashboard(
    client, 
    user_a_token: str, 
    user_b_private_asset_id: int
):
    """验证仪表板数据权限隔离"""
    response = client.get(
        "/api/assets/stats/category",
        headers={"Authorization": f"Bearer {user_a_token}"}
    )
    assert response.status_code == 200
    
    # 验证不包含无权限资产
    all_asset_ids = []
    for category_data in response.json().get("data", []):
        all_asset_ids.extend(category_data.get("asset_ids", []))
    
    assert user_b_private_asset_id not in all_asset_ids, \
        "用户 A 看到了用户 B 的私有资产"
```

---

## 5. 开发切入层级序列

### 5.1 层级依赖图

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: 前端视图层                                        │
│  ├─ DashboardPage 容器组件                                   │
│  ├─ StatCard 统计数字卡片组件                                 │
│  ├─ CategoryChart ECharts 图表组件                          │
│  └─ MaintenanceAlertList 预警列表组件                       │
│  依赖: Layer 3 API 接口就绪                                  │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 接口层 (API Endpoint)                             │
│  ├─ GET /api/dashboard/stats  → 仪表板聚合统计               │
│  ├─ GET /api/assets/count     → 资产总数                     │
│  ├─ GET /api/assets/stats/category → 分类统计                │
│  └─ GET /api/assets/alerts    → 预警列表                     │
│  依赖: Layer 2 Service 接口定义                              │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 业务逻辑层 (Service)                              │
│  ├─ DashboardService.aggregate_stats(user_id)              │
│  ├─ DashboardService.get_category_chart_data(user_id)       │
│  └─ DashboardService.get_maintenance_alerts(user_id, days) │
│  依赖: Layer 1 Repository 接口定义                           │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 数据访问层 (Repository)                           │
│  ├─ AssetRepository.count_all(user_id)                     │
│  ├─ AssetRepository.group_by_category(user_id)             │
│  └─ AssetRepository.find_expiring_maintenance(user_id, days)│
│  依赖: Layer 0 数据库模型就绪                                 │
├─────────────────────────────────────────────────────────────┤
│  Layer 0: 数据库层                                          │
│  ├─ assets 表结构确认                                       │
│  ├─ maintenance_records 表结构确认                          │
│  └─ 索引优化: (user_id, maintenance_date)                   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 可并行开发矩阵

| 层级 | 前置依赖 | 可并行开发 |
|-----|---------|-----------|
| Layer 0 | 无 | Layer 1 同步设计 |
| Layer 1 | Layer 0 完成后 | Layer 2 同步设计 |
| Layer 2 | Layer 1 接口定义 | Layer 3 同步设计 |
| Layer 3 | Layer 2 接口契约 | Layer 4 同步设计 |
| Layer 4 | Layer 3 API 联调 | 可独立 Mock 测试 |

### 5.3 核心文件修改清单

| 文件路径 | 修改内容 | 所属层级 |
|---------|---------|---------|
| `src/main.py` | 添加 Dashboard API 路由注册 | Layer 3 |
| `src/services/dashboard_service.py` | 新增 DashboardService 类 | Layer 2 |
| `src/repositories/dashboard_repository.py` | 新增 DashboardRepository 类 | Layer 1 |
| `frontend/src/app/pages/AuditDashboard/hooks/useAuditData.ts` | 数据获取 Hook | Layer 4 |
| `frontend/src/app/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` | 样式优化 | Layer 4 |
| `frontend/tests/e2e/depreciation.spec.ts` | 折旧相关 E2E 测试 | Layer 4 |
| `frontend/tests/e2e/audit_dashboard.spec.ts` | 仪表板 E2E 测试 | Layer 4 |

---

## 6. API 数据契约

### 6.1 GET /api/assets/count

**请求头**:
```
Authorization: Bearer {token}
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 480,
    "by_status": {
      "active": 400,
      "maintenance": 50,
      "retired": 30
    }
  }
}
```

### 6.2 GET /api/assets/stats/category

**请求头**:
```
Authorization: Bearer {token}
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": [
    { "category": "设备", "count": 128 },
    { "category": "软件", "count": 256 },
    { "category": "场地", "count": 32 },
    { "category": "其他", "count": 64 }
  ],
  "total": 480
}
```

### 6.3 GET /api/assets/alerts

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| days | int | 否 | 预警天数范围，默认 30 |
| page | int | 否 | 页码，默认 1 |
| page_size | int | 否 | 每页条数，默认 10 |

**请求头**:
```
Authorization: Bearer {token}
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": 1001,
      "name": "服务器-A01",
      "category": "设备",
      "maintenance_type": "年检",
      "expiry_date": "2025-02-15",
      "remaining_days": 12
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 10,
    "total": 3
  }
}
```

---

## 7. 里程碑定义

| 里程碑 | 完成标准 | 产出物 |
|-------|---------|-------|
| M1: 数据层就绪 | Repository 单测覆盖率 >80% | 数据访问代码 + 测试报告 |
| M2: API 可用 | Swagger 文档生成，Postman 集合验证通过 | API 文档 + 集成测试报告 |
| M3: 前端完成 | Playwright E2E 测试 100% 通过 | 仪表板页面 + 测试截图 |
| M4: 功能验收 | 产品确认所有 ATB 测试用例通过 | 验收签字文档 |

---

## 8. 风险与依赖

| 风险项 | 影响等级 | 缓解措施 |
|-------|---------|---------|
| ECharts 与 React 18 兼容性问题 | 中 | 升级到 ECharts 5.4+，使用官方 React 封装 |
| 大数据量下图表渲染性能 | 高 | 添加数据分页/采样，启用 canvas 渲染模式 |
| 多租户数据权限隔离验证 | 高 | 单元测试覆盖 + 集成测试验证 |

---

## 9. AC 验收追踪

| AC ID | 验证方法 | 状态 | 备注 |
|-------|---------|------|------|
| AC-001 | unit_test | pending | 仪表板功能单元测试 |
| AC-002 | static_analysis | pending | AST 静态检查 |
| AC-003 | static_analysis | pending | docstring 覆盖率检查 |
| AC-004 | unit_test | pending | import 导入测试 |

---

**文档状态**: 已审核
**审核日期**: 2025-01
**审核结果**: ✅ 通过