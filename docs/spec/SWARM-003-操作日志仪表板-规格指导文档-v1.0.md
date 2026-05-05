# SWARM-003 操作日志仪表板 规格指导文档

> **版本**: v1.0  
> **任务**: [SWARM-003] 操作日志仪表板（审计数据可视化 + 趋势图表）  
> **迭代**: 1  
> **状态**: 已批准 (AC-001 ~ AC-004 审核通过)  
> **最后更新**: 2024-XX-XX

---

## 1. 需求与背景

### 1.1 业务场景

操作日志仪表板是资产管理系统的重要审计功能模块，旨在为系统管理员和审计人员提供：

| 角色 | 使用场景 |
|------|----------|
| **系统管理员** | 监控用户操作行为，识别异常操作模式 |
| **审计人员** | 合规性审查，追溯特定用户/资产的操作历史 |
| **运维人员** | 系统健康监控，评估操作负载趋势 |

### 1.2 功能目标

本次 **Iteration 1** 实现 **MVP (Minimum Viable Product)** 版本的仪表板，聚焦核心可视化能力：

1. **统计概览卡片** - 关键指标的即时展示
2. **操作类型分布图** - 不同操作类型的占比分析（饼图）
3. **7日趋势折线图** - 操作量的时序变化趋势
4. **最新日志列表** - 最近操作记录的快速浏览

### 1.3 技术约束前提

```
✅ audit_logs 数据表已存在且数据持续写入
✅ 权限控制中间件已就绪（仅 admin 角色可访问）
✅ 前端组件库（Ant Design / Tailwind CSS）已集成
✅ ECharts 图表库已集成
✅ 后端服务：Python FastAPI + SQLAlchemy
✅ 前端技术栈：React + TypeScript + Vite
```

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 1 交付范围

本次迭代为 **Phase 1: 基础仪表板框架 + 核心指标卡片**，仅交付以下功能：

| 交付物 | 描述 | 优先级 |
|--------|------|--------|
| **统计概览卡片** | 展示今日操作总数、异常操作数、活跃用户数 | P0 |
| **操作类型分布图** | 饼图展示各操作类型占比 | P0 |
| **7日趋势折线图** | 每日操作量的时序趋势 | P0 |
| **最新日志列表** | 最近20条操作记录的表格展示 | P0 |
| **手动刷新功能** | 按钮触发数据重新拉取 | P1 |

### 2.2 明确排除的功能

以下功能属于 **Phase 2** 范围，**本次迭代不实现**：

| 功能 | 说明 | 计划迭代 |
|------|------|----------|
| 高级筛选器 | 支持多条件组合筛选 | Phase 2 |
| 导出功能 | Excel/CSV 导出日志 | Phase 2 |
| 实时推送 | WebSocket 实时更新 | Phase 2 |
| 自定义时间范围 | 用户选择日期范围 | Phase 2 |
| 异常操作告警 | 实时告警通知 | Phase 3 |
| 操作详情钻取 | 点击日志查看详情 | Phase 2 |

---

## 3. 边界约束

### 3.1 范围边界

| 边界项 | 约束条件 | 边界类型 |
|--------|----------|----------|
| **时间范围** | 默认展示近7天数据，不可配置 | 硬性约束 |
| **数据分页** | 日志列表固定20条/页 | 硬性约束 |
| **用户权限** | 仅 `admin` 角色可访问，其他角色返回 HTTP 403 | 硬性约束 |
| **刷新策略** | 页面加载时一次性请求，手动刷新按钮触发 | 硬性约束 |
| **图表交互** | 仅展示静态图表，无缩放/拖拽交互 | 软性约束 |

### 3.2 技术边界

| 技术维度 | 约束 |
|----------|------|
| **API 规范** | RESTful 风格，遵循 `api/v1/dashboard/*` 路径 |
| **响应格式** | 统一 JSON 格式：`{ code, message, data }` |
| **日期格式** | ISO 8601 (UTC)，格式：`YYYY-MM-DD` |
| **性能要求** | API 响应时间 P95 < 500ms |
| **图表库** | 仅使用 ECharts，不引入额外图表库 |
| **错误处理** | 统一异常处理，返回结构化错误响应 |

### 3.3 数据边界

| 数据项 | 约束 |
|--------|------|
| **查询方式** | 使用只读副本或异步查询，不锁定主表 |
| **聚合计算** | 在数据库层完成，不在前端循环计算 |
| **数据类型** | `operation_type` 为枚举值：`LOGIN`, `LOGOUT`, `CREATE`, `UPDATE`, `DELETE`, `VIEW` |
| **异常判定** | 异常操作定义：HTTP 方法非 GET 且操作结果包含 "FAIL" 或 "ERROR" 关键字 |

---

## 4. 验收测试基准 (ATB)

### 4.1 后端 API 接口测试

| ATB 编号 | 测试场景 | 验证方法 | 预期结果 |
|----------|----------|----------|----------|
| **ATB-1.1** | 获取仪表板统计数据 | `pytest tests/api/test_audit_dashboard.py::test_get_dashboard_stats` | 返回 `total_ops`, `anomaly_count`, `active_users`，HTTP 200 |
| **ATB-1.2** | 获取操作类型分布 | `pytest tests/api/test_audit_dashboard.py::test_get_operation_distribution` | 返回操作类型聚合列表，饼图可直接消费 |
| **ATB-1.3** | 获取7日趋势数据 | `pytest tests/api/test_audit_dashboard.py::test_get_weekly_trend` | 返回7组日期+数量数组，按日期升序 |
| **ATB-1.4** | 获取最新日志列表 | `pytest tests/api/test_audit_dashboard.py::test_get_recent_logs` | 返回 `items` 数组(20条) + `total` 计数 |
| **ATB-1.5** | 权限校验 | `pytest tests/api/test_audit_dashboard.py::test_non_admin_forbidden` | 非 admin 用户请求返回 403 |
| **ATB-1.6** | 数据准确性 | `pytest tests/api/test_audit_dashboard.py::test_stats_accuracy` | API 返回值与数据库 COUNT 查询一致 |

### 4.2 前端组件测试

| ATB 编号 | 测试场景 | 验证方法 | 预期结果 |
|----------|----------|----------|----------|
| **ATB-2.1** | 仪表板页面渲染 | `playwright tests/e2e/audit_dashboard.spec.ts` | 页面加载完成，统计卡片可见，无 console.error |
| **ATB-2.2** | 趋势图表渲染 | E2E 验证 | ECharts 图表容器存在且有渲染内容 |
| **ATB-2.3** | 分布图表渲染 | E2E 验证 | 饼图展示操作类型占比 |
| **ATB-2.4** | 日志表格数据绑定 | E2E 验证 | 表格存在且包含至少1行数据 |
| **ATB-2.5** | 手动刷新功能 | E2E 验证 | 点击刷新后接口重新触发，数据更新 |

### 4.3 静态分析与文档测试

| ATB 编号 | 测试场景 | 验证方法 | 预期结果 |
|----------|----------|----------|----------|
| **ATB-3.1** | AST 静态检查 | `pytest tests/test_ast_analyzer.py` | 代码无语法错误，AST 解析通过 |
| **ATB-3.2** | Docstring 覆盖率 | `pytest tests/test_docstring_coverage.py` | 所有修改的函数包含 docstring |
| **ATB-3.3** | Import 验证 | `pytest tests/test_ac_004.py` | 模块可正常 import，无 ImportError |

### 4.4 回归测试

| ATB 编号 | 测试场景 | 验证方法 | 预期结果 |
|----------|----------|----------|----------|
| **ATB-4.1** | 报废服务回归 | `pytest frontend/tests/unit/retirementService.test.ts` | 原有功能不受影响 |
| **ATB-4.2** | 折旧功能回归 | `playwright frontend/tests/e2e/depreciation.spec.ts` | 原有功能不受影响 |

---

## 5. 开发切入层级序列

### 层级 L1：数据层准备 (Day 1)

```
目标：确保数据查询性能满足仪表板需求
```

#### 1.1 数据库索引优化

```sql
-- 创建复合索引加速时间范围查询
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_type 
ON audit_logs(created_at, operation_type);

-- 创建索引加速异常操作筛选
CREATE INDEX IF NOT EXISTS idx_audit_logs_result 
ON audit_logs(result) WHERE result LIKE '%FAIL%' OR result LIKE '%ERROR%';
```

#### 1.2 验证查询计划

```python
# 使用 EXPLAIN ANALYZE 验证查询性能
EXPLAIN ANALYZE 
SELECT date_trunc('day', created_at) as day, count(*)
FROM audit_logs 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day;
```

**交付物**：
- `backend/migrations/add_dashboard_indexes.sql`
- `scripts/verify_query_performance.py`

---

### 层级 L2：后端 API 层 (Day 2)

```
目标：提供前端可消费的 RESTful 接口
```

#### 2.1 API 端点设计

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/dashboard/stats` | GET | 获取统计概览数据 |
| `/api/v1/dashboard/distribution` | GET | 获取操作类型分布 |
| `/api/v1/dashboard/trend` | GET | 获取7日趋势数据 |
| `/api/v1/dashboard/recent-logs` | GET | 获取最新日志列表 |

#### 2.2 服务层实现

```python
# src/services/dashboard_service.py

class DashboardService:
    """操作日志仪表板服务"""
    
    async def get_stats(self, user: User) -> DashboardStatsDTO:
        """获取统计概览数据"""
        pass
    
    async def get_distribution(self, user: User) -> List[DistributionItemDTO]:
        """获取操作类型分布"""
        pass
    
    async def get_trend(self, user: User) -> List[TrendItemDTO]:
        """获取7日趋势数据"""
        pass
    
    async def get_recent_logs(self, user: User, page: int = 1, size: int = 20) -> PaginatedLogsDTO:
        """获取最新日志列表"""
        pass
```

#### 2.3 统一响应格式

```python
# src/api/schemas/responses.py

class SuccessResponse(BaseModel):
    """统一成功响应格式"""
    code: int = 0
    message: str = "success"
    data: Any = None

class ErrorResponse(BaseModel):
    """统一错误响应格式"""
    code: int
    message: str
    data: Optional[Any] = None
```

**交付物**：
- `src/api/routes/dashboard_router.py`
- `src/services/dashboard_service.py`
- `src/api/dependencies/auth.py` (admin 权限校验)

---

### 层级 L3：前端组件层 (Day 3)

```
目标：实现 UI 渲染和基础交互
```

#### 3.1 组件结构

```
frontend/src/app/pages/AuditDashboard/
├── components/
│   ├── StatsCards/           # 统计概览卡片
│   │   ├── StatsCards.tsx
│   │   └── StatsCards.module.css
│   ├── TrendChart/           # 趋势折线图
│   │   ├── TrendChart.tsx
│   │   └── TrendChart.module.css
│   ├── DistributionChart/     # 分布饼图
│   │   ├── DistributionChart.tsx
│   │   └── DistributionChart.module.css
│   ├── RecentLogsTable/       # 日志表格
│   │   ├── RecentLogsTable.tsx
│   │   └── RecentLogsTable.module.css
│   └── FilterBar/             # 筛选栏 (Phase 2)
│       └── FilterBar.module.css
├── hooks/
│   └── useDashboardData.ts   # 数据获取 Hook
├── services/
│   └── dashboardApi.ts       # API 调用封装
├── types/
│   └── dashboard.types.ts    # TypeScript 类型定义
├── AuditDashboard.tsx         # 主容器组件
└── AuditDashboard.module.css
```

#### 3.2 核心组件实现

```typescript
// hooks/useDashboardData.ts

interface DashboardData {
  stats: DashboardStats | null;
  distribution: DistributionItem[];
  trend: TrendItem[];
  recentLogs: PaginatedLogs;
  isLoading: boolean;
  error: string | null;
}

export function useDashboardData() {
  // 实现数据获取逻辑
}
```

#### 3.3 统计卡片实现

```typescript
// components/StatsCards/StatsCards.tsx

interface StatsCardsProps {
  totalOps: number;
  anomalyCount: number;
  activeUsers: number;
  onRefresh: () => void;
}

export function StatsCards({ totalOps, anomalyCount, activeUsers, onRefresh }: StatsCardsProps) {
  return (
    <div className={styles.statsGrid}>
      <StatCard title="总操作数" value={totalOps} icon="activity" />
      <StatCard title="异常操作" value={anomalyCount} icon="alert-triangle" trend="up" />
      <StatCard title="活跃用户" value={activeUsers} icon="users" />
      <RefreshButton onClick={onRefresh} />
    </div>
  );
}
```

**交付物**：
- `frontend/src/app/pages/AuditDashboard/` 完整组件目录
- `frontend/src/app/services/dashboardApi.ts`
- `frontend/src/app/types/dashboard.types.ts`

---

### 层级 L4：联调与测试 (Day 4)

```
目标：端到端验证功能完整性
```

#### 4.1 接口联调清单

| 检查项 | 验证方法 | 通过标准 |
|--------|----------|----------|
| 权限校验 | 非 admin 用户访问 | 返回 403 |
| 数据格式 | Postman/API 工具验证响应结构 | 符合 Schema |
| 图表数据 | 前端 ECharts 正确渲染 | 无空白图表 |
| 分页功能 | 翻页操作 | 数据正确切换 |

#### 4.2 性能验证

```bash
# API 响应时间测试
curl -o /dev/null -s -w "Time: %{time_total}s\n" \
  http://localhost:8000/api/v1/dashboard/stats

# 目标：P95 < 500ms
```

#### 4.3 测试执行

```bash
# 后端测试
pytest tests/api/test_audit_dashboard.py -v

# 前端 E2E 测试
npx playwright test tests/e2e/audit_dashboard.spec.ts

# 静态分析
pytest tests/test_ast_analyzer.py
pytest tests/test_docstring_coverage.py
```

**交付物**：
- 测试报告 (`tests/report/dashboard_test_report.html`)
- 代码审查记录

---

## 附录 A：API 响应数据结构

### A.1 统计概览响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total_ops": 15234,
    "anomaly_count": 23,
    "active_users": 156,
    "period": "7d"
  }
}
```

### A.2 操作类型分布响应

```json
{
  "code": 0,
  "message": "success",
  "data": [
    { "operation_type": "LOGIN", "count": 5231, "percentage": 34.3 },
    { "operation_type": "UPDATE", "count": 3421, "percentage": 22.5 },
    { "operation_type": "VIEW", "count": 2890, "percentage": 19.0 },
    { "operation_type": "CREATE", "count": 2103, "percentage": 13.8 },
    { "operation_type": "DELETE", "count": 1203, "percentage": 7.9 },
    { "operation_type": "LOGOUT", "count": 386, "percentage": 2.5 }
  ]
}
```

### A.3 7日趋势响应

```json
{
  "code": 0,
  "message": "success",
  "data": [
    { "date": "2024-01-15", "count": 2103 },
    { "date": "2024-01-16", "count": 2356 },
    { "date": "2024-01-17", "count": 1892 },
    { "date": "2024-01-18", "count": 2214 },
    { "date": "2024-01-19", "count": 2567 },
    { "date": "2024-01-20", "count": 1987 },
    { "date": "2024-01-21", "count": 2115 }
  ]
}
```

### A.4 最新日志响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "log_001",
        "user_id": "user_123",
        "username": "zhang_san",
        "operation_type": "UPDATE",
        "resource_type": "asset",
        "resource_id": "asset_456",
        "result": "SUCCESS",
        "ip_address": "192.168.1.100",
        "created_at": "2024-01-21T10:30:00Z"
      }
    ],
    "total": 15234,
    "page": 1,
    "size": 20,
    "pages": 762
  }
}
```

---

## 附录 B：错误响应码

| 错误码 | 描述 | HTTP Status |
|--------|------|-------------|
| 0 | 成功 | 200 |
| 1001 | 权限不足 | 403 |
| 1002 | 资源不存在 | 404 |
| 2001 | 数据库查询错误 | 500 |
| 2002 | 服务内部错误 | 500 |

---

## 附录 C：相关文件清单

### 本次迭代修改的文件

| 文件路径 | 修改类型 | 说明 |
|----------|----------|------|
| `src/main.py` | 修改 | 添加 dashboard 相关路由注册 |
| `frontend/src/app/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` | 修改 | FilterBar 样式（预置 Phase 2） |
| `frontend/tests/unit/retirementService.test.ts` | 修改 | 回归测试保障 |
| `frontend/tests/e2e/depreciation.spec.ts` | 修改 | 回归测试保障 |
| `frontend/tests/e2e/audit_dashboard.spec.ts` | 修改 | E2E 测试覆盖 |

### 新增文件清单

| 文件路径 | 说明 |
|----------|------|
| `src/api/routes/dashboard_router.py` | Dashboard API 路由 |
| `src/services/dashboard_service.py` | Dashboard 业务逻辑 |
| `frontend/src/app/pages/AuditDashboard/AuditDashboard.tsx` | 主容器组件 |
| `frontend/src/app/pages/AuditDashboard/components/StatsCards/` | 统计卡片组件 |
| `frontend/src/app/pages/AuditDashboard/components/TrendChart/` | 趋势图组件 |
| `frontend/src/app/pages/AuditDashboard/components/DistributionChart/` | 分布图组件 |
| `frontend/src/app/pages/AuditDashboard/components/RecentLogsTable/` | 日志表格组件 |
| `frontend/src/app/pages/AuditDashboard/hooks/useDashboardData.ts` | 数据获取 Hook |
| `frontend/src/app/pages/AuditDashboard/services/dashboardApi.ts` | API 调用封装 |
| `frontend/src/app/pages/AuditDashboard/types/dashboard.types.ts` | 类型定义 |
| `tests/api/test_audit_dashboard.py` | 后端 API 测试 |

---

*文档版本：v1.0 | 对应 Iteration：1 | 状态：Pending Implementation*