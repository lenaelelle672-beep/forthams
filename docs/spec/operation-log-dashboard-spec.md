# 操作日志仪表板 - 规格指导文档

## 1. 概述与范围

### 1.1 功能范围

本次迭代实现管理员操作日志仪表板的前端可视化能力，涵盖以下核心功能：

- **趋势图表展示**：按时间维度展示操作日志的变化趋势
- **分类统计筛选**：支持按操作类型、模块、用户等维度进行数据筛选
- **风险分布图**：展示不同风险等级操作的分布情况

### 1.2 涉及文件

| 文件路径 | 修改类型 | 优先级 |
|----------|----------|--------|
| `frontend/src/app/pages/OperationLogDashboard/index.tsx` | 修改 | P0 |
| `frontend/src/app/pages/OperationLogDashboard/components/TrendChart.tsx` | 修改 | P1 |
| `frontend/src/app/pages/OperationLogDashboard/components/FilterControls.tsx` | 修改 | P1 |
| `frontend/src/app/pages/OperationLogDashboard/components/RiskPieChart.tsx` | 修改 | P1 |
| `frontend/tests/unit/auditLog.test.ts` | 修改 | P1 |

### 1.3 迭代目标

| Phase | 范围 | 状态 |
|-------|------|------|
| Phase 1 | 后端 API 接口开发（聚合统计） | 下游依赖 |
| Phase 2 | 前端 Dashboard 视图搭建 | **本次迭代** |
| Phase 3 | 权限控制与数据脱敏 | 待规划 |

## 2. 功能需求

### 2.1 仪表板主视图 (index.tsx)

#### 2.1.1 布局结构

```
┌─────────────────────────────────────────────────────┐
│  操作日志仪表板                                      │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐    │
│  │  筛选控件区域 (FilterControls)               │    │
│  │  - 时间范围选择器                            │    │
│  │  - 操作类型下拉框                            │    │
│  │  - 模块选择器                                │    │
│  │  - 用户选择器                                │    │
│  │  - 重置/应用按钮                             │    │
│  └─────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │  趋势图表区域 (TrendChart)                    │    │
│  │  - 折线图展示时间趋势                         │    │
│  │  - 支持按小时/按天切换                        │    │
│  └─────────────────────────────────────────────┘    │
│  ┌──────────────────┐  ┌──────────────────────┐    │
│  │ 风险饼图区域      │  │ 分类统计卡片          │    │
│  │ (RiskPieChart)   │  │ - 操作类型分布        │    │
│  │                  │  │ - 模块分布            │    │
│  │                  │  │ - 用户分布            │    │
│  └──────────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

#### 2.1.2 数据流

1. 用户在筛选控件中选择过滤条件
2. 组件通过 `useAuditLogs` hook 获取数据
3. 数据传入 TrendChart、RiskPieChart、分类统计卡片进行渲染
4. 支持手动刷新和自动轮询（间隔 ≥ 30s）

#### 2.1.3 接口依赖

```typescript
// 获取趋势统计
GET /api/audit-logs/stats/trend?period={today|30d}&start={date}&end={date}

// 获取分类统计
GET /api/audit-logs/stats/categories?dimension={action|module|user}

// 获取组合筛选统计
GET /api/audit-logs/stats/combo?start={date}&end={date}&action={type}&module={name}
```

### 2.2 趋势图表组件 (TrendChart.tsx)

#### 2.2.1 功能规格

| 特性 | 说明 |
|------|------|
| 图表类型 | 折线图 (Line Chart) |
| 时间粒度 | 按小时（当日）、按天（近30天） |
| 数据点 | 自动聚合，支持鼠标悬停显示详情 |
| 响应式 | 宽度自适应容器高度 300px |

#### 2.2.2 Props 接口

```typescript
interface TrendChartProps {
  data: Array<{
    timestamp: string;
    count: number;
  }>;
  granularity: 'hour' | 'day';
  loading?: boolean;
  onRefresh?: () => void;
}
```

### 2.3 筛选控件组件 (FilterControls.tsx)

#### 2.3.1 功能规格

| 控件 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| 时间范围 | DateRangePicker | 最近7天 | 限制最大90天 |
| 操作类型 | Select (多选) | 全部 | CREATE/UPDATE/DELETE/READ |
| 模块 | Select (多选) | 全部 | 枚举值: asset/user/order/inventory |
| 用户 | Select (搜索) | 全部 | 支持用户名模糊搜索 |

#### 2.3.2 Props 接口

```typescript
interface FilterControlsProps {
  initialValues?: FilterValues;
  onApply: (filters: FilterValues) => void;
  onReset: () => void;
}

interface FilterValues {
  dateRange: [string, string] | null;
  actions: string[];
  modules: string[];
  userId: number | null;
}
```

### 2.4 风险饼图组件 (RiskPieChart.tsx)

#### 2.4.1 功能规格

| 特性 | 说明 |
|------|------|
| 图表类型 | 饼图 (Pie Chart) |
| 风险等级 | low / medium / high / critical |
| 交互 | 点击扇区可下钻查看详情 |
| 颜色映射 | low=#52c41a, medium=#faad14, high=#fa8c16, critical=#f5222d |

#### 2.4.2 Props 接口

```typescript
interface RiskPieChartProps {
  data: Array<{
    level: 'low' | 'medium' | 'high' | 'critical';
    count: number;
  }>;
  loading?: boolean;
  onSectorClick?: (level: string) => void;
}
```

## 3. 验收标准 (ATB)

### 3.1 AC-001: 单元测试覆盖

| 测试用例 | 输入 | 预期结果 | 测试方法 |
|----------|------|----------|----------|
| T-01 | 渲染 Dashboard 主视图 | 组件正常挂载，无 JS 异常 | `render(<OperationLogDashboard />)` |
| T-02 | 传入趋势数据 | 折线图正确渲染数据点 | 快照测试或数据验证 |
| T-03 | 筛选条件变更 | 回调正确传递参数 | Mock onApply 函数 |
| T-04 | 风险数据传入 | 饼图正确渲染 4 个扇区 | 数据点数量断言 |

**测试文件**: `frontend/tests/unit/auditLog.test.ts`

```bash
# 执行命令
pnpm test:unit auditLog.test.ts
```

### 3.2 AC-002: 静态分析通过

| 检查项 | 工具 | 标准 |
|--------|------|------|
| TypeScript 语法 | tsc | 0 errors |
| ESLint | eslint | 0 errors, 0 warnings (可选) |
| AST 可达性 | 自定义脚本 | 无死代码 |

```bash
# 执行命令
cd frontend
pnpm tsc --noEmit
```

### 3.3 AC-003: Docstring 覆盖

| 文件 | 导出的函数/组件 | Docstring 要求 |
|------|-----------------|----------------|
| index.tsx | `OperationLogDashboard` | ✓ |
| TrendChart.tsx | `TrendChart` | ✓ |
| FilterControls.tsx | `FilterControls`, `FilterValues` | ✓ |
| RiskPieChart.tsx | `RiskPieChart` | ✓ |

**Docstring 模板**:

```typescript
/**
 * OperationLogDashboard - 操作日志仪表板主视图
 * 
 * @description 展示审计日志的趋势图表、分类统计和筛选功能
 * @returns {JSX.Element}
 * 
 * @example
 * ```tsx
 * <OperationLogDashboard />
 * ```
 */
```

### 3.4 AC-004: Import 验证

| 检查项 | 标准 |
|--------|------|
| 模块可被正常 import | 无 `ImportError` 或 `Module not found` |
| 类型声明可用 | 无 `TS2307` 错误 |

```bash
# 执行命令
cd frontend
pnpm tsc --noEmit 2>&1 | grep -c "Cannot find module" 
# 预期输出: 0
```

## 4. 边界约束

### 4.1 技术约束

- **轮询间隔**: 自动刷新间隔 ≥ 30 秒
- **日期范围**: 最大支持 90 天查询
- **筛选维度**: 最多支持 3 个维度同时生效
- **响应式**: 支持 1024px 以上屏幕宽度

### 4.2 数据约束

- **历史数据**: 仅支持查询近 90 天日志
- **空状态**: 无数据时显示友好提示文案
- **加载状态**: 数据请求中显示骨架屏或 Loading 动画

### 4.3 范围外明确排除

| 功能 | 原因 | 规划 |
|------|------|------|
| 日志全文搜索 | 超出本次迭代范围 | Phase 4 |
| 数据导出 Excel | 超出本次迭代范围 | Phase 5 |
| 实时 WebSocket 推送 | 超出本次迭代范围 | 独立模块 |

## 5. 开发切入层级

### Layer 0: 类型定义层

```
文件: frontend/src/app/types/audit.types.ts

新增类型:
- TrendDataPoint
- CategoryDistribution  
- RiskLevel
- FilterValues
- DashboardStats
```

### Layer 1: Hooks 层

```
文件: frontend/src/app/hooks/useAuditLogs.ts

职责:
- 调用审计日志统计 API
- 管理加载/错误状态
- 提供数据转换逻辑
```

### Layer 2: 组件层

```
frontend/src/app/pages/OperationLogDashboard/
├── index.tsx          # 主视图容器
└── components/
    ├── TrendChart.tsx      # 趋势图表
    ├── FilterControls.tsx  # 筛选控件
    └── RiskPieChart.tsx    # 风险饼图
```

### Layer 3: 服务层

```
文件: frontend/src/app/services/auditService.ts

方法:
- getTrendStats(params)
- getCategoryStats(params)
- getComboStats(params)
```

### Layer 4: 测试层

```
frontend/tests/unit/
└── auditLog.test.ts   # 单元测试

覆盖:
- 组件渲染测试
- Props 传递测试
- 回调函数测试
- 边界条件测试
```

## 6. 质量门槛

| 验收标准 | 状态 | 备注 |
|----------|------|------|
| AC-001 (unit_test) | **必须通过** | 核心功能验证 |
| AC-002 (static_analysis) | **必须通过** | 代码质量基线 |
| AC-003 (docstring) | 建议通过 | 非关键项 `is_critical=False` |
| AC-004 (import) | **必须通过** | 模块可用性验证 |

## 7. 附录

### 7.1 响应数据结构

**趋势统计响应**:

```json
{
  "success": true,
  "data": {
    "period": "today",
    "granularity": "hour",
    "items": [
      {"timestamp": "2024-01-15T00:00:00Z", "count": 12},
      {"timestamp": "2024-01-15T01:00:00Z", "count": 8}
    ]
  }
}
```

**分类统计响应**:

```json
{
  "success": true,
  "data": {
    "dimensions": {
      "action": [{"value": "CREATE", "count": 156}],
      "module": [{"value": "order", "count": 89}],
      "riskLevel": [{"value": "low", "count": 200}]
    }
  }
}
```

### 7.2 风险等级颜色映射

| 等级 | 颜色代码 | 描述 |
|------|----------|------|
| low | #52c41a | 低风险操作 |
| medium | #faad14 | 中等风险操作 |
| high | #fa8c16 | 高风险操作 |
| critical | #f5222d | 极高风险操作 |