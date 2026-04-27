# SWARM-S5-003 资产折旧计算模块 规格指导文档

**版本**: 1.0  
**迭代周期**: Iteration 1  
**状态**: 已批准  
**创建日期**: 2025-01-15

---

## 1. 需求与背景

### 1.1 业务背景

资产折旧是企业固定资产管理的核心核算内容，准确计算折旧直接影响财务报表的准确性。当前系统缺少自动化折旧计算能力，用户需手动维护折旧数据，效率低下且易出错。

### 1.2 核心需求

| 需求编号 | 描述 | 优先级 | 迭代 |
|---------|------|--------|------|
| REQ-001 | 用户在资产详情页查看直线法折旧报表 | P0 | Iteration 1 |
| REQ-002 | 用户在资产详情页查看双倍余额递减法折旧报表 | P0 | Iteration 1 |
| REQ-003 | 系统定时更新折旧数据 | P0 | Iteration 1 |

### 1.3 用户故事

```
作为 资产管理员
我希望在 资产详情页 直接查看折旧报表
以便 无需切换页面即可掌握资产价值变化
```

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解模型

| Phase | 名称 | 本次迭代覆盖 | 里程碑交付物 |
|-------|------|-------------|-------------|
| Phase 1 | 折旧计算引擎 & 数据模型 | ✅ 完整覆盖 | 数据库模型、计算服务、基础 API |
| Phase 2 | 前端展示层 | 🔲 下一迭代 | 资产详情页折旧组件 |
| Phase 3 | 定时任务调度 | 🔲 下一迭代 | 每日折旧更新任务 |
| Phase 4 | 报表导出 & 权限控制 | 🔲 后续迭代 | Excel/CSV 导出 |

### 2.2 本次 Phase 1 具体目标

#### 2.2.1 数据模型建立
- 资产主数据扩展字段（折旧相关）
- 折旧台账表设计
- 折旧配置表设计

#### 2.2.2 折旧计算引擎实现
- **直线法计算公式**：
  ```
  年折旧额 = (原值 - 残值) / 预计使用年限
  月折旧额 = 年折旧额 / 12
  ```
- **双倍余额递减法计算公式**：
  ```
  年折旧率 = 2 / 预计使用年限 × 100%
  年折旧额 = 账面净值 × 年折旧率
  ```

#### 2.2.3 基础 API 暴露
- 折旧数据查询接口
- 折旧计算触发接口
- 折旧报表数据接口

---

## 3. 边界约束

### 3.1 范围约束

| 包含 (In Scope) | 排除 (Out of Scope) |
|-----------------|---------------------|
| 直线法折旧计算 | 年数总和法等其他折旧方法 |
| 双倍余额递减法计算 | 固定资产新增/报废流程 |
| 资产详情页折旧展示（后端数据） | 折旧报表导出功能 |
| 定时折旧数据更新 | 多币种资产折旧 |
| 折旧台账数据持久化 | 折旧预警通知 |

### 3.2 技术约束

| 项目 | 约束 |
|------|------|
| 框架 | FastAPI + SQLAlchemy (Backend), React + TypeScript (Frontend) |
| 数据库 | PostgreSQL 14+ |
| 调度 | APScheduler |
| 折旧计算精度 | 精确到小数点后 4 位 |
| 定时任务频率 | 每日凌晨 02:00 执行 |
| API 版本 | /api/v1/* |

### 3.3 数据约束

| 字段 | 类型 | 约束 |
|------|------|------|
| 原值 | DECIMAL(15,2) | 必须 > 0 |
| 残值 | DECIMAL(15,2) | 必须 >= 0 且 < 原值 |
| 预计使用年限 | INTEGER | 必须 > 0 |
| 折旧方法 | ENUM | ('straight_line', 'double_declining') |
| 启用日期 | DATE | 必须 <= 当前日期 |

---

## 4. 验收测试基准 (ATB)

### 4.1 测试清单

| ATB ID | 测试目标 | 测试类型 | 验证方法 |
|--------|----------|----------|----------|
| ATB-001 | 直线法折旧计算 | 单元测试 | pytest |
| ATB-002 | 双倍余额递减法折旧计算 | 单元测试 | pytest |
| ATB-003 | 折旧数据持久化 | 集成测试 | pytest |
| ATB-004 | API 接口可用性 | API 测试 | pytest |
| ATB-005 | 前端页面渲染 | E2E 测试 | Playwright |
| ATB-006 | 定时任务执行 | 单元测试 | pytest |
| ATB-007 | 边界条件验证 | 单元测试 | pytest |

### 4.2 ATB-001: 直线法折旧计算

**测试目标**: 验证直线法折旧计算结果的数学正确性

```python
# pytest: tests/services/test_depreciation_service.py

def test_straight_line_depreciation_calculation():
    """
    ATB-001 物理测试期待
    输入: 原值=10000, 残值=1000, 使用年限=5
    期待输出: 年折旧额=1800, 月折旧额=150
    
    验证公式: 年折旧额 = (原值 - 残值) / 预计使用年限
            = (10000 - 1000) / 5 = 1800
    """
    asset = Asset(
        asset_id="ASSET-001",
        original_value=Decimal("10000.00"),
        salvage_value=Decimal("1000.00"),
        useful_life_years=5,
        depreciation_method="straight_line",
        acquisition_date=date(2024, 1, 1)
    )
    
    result = depreciation_service.calculate_annual_depreciation(asset)
    
    assert result.annual_depreciation == Decimal("1800.00")
    assert result.monthly_depreciation == Decimal("150.00")
    assert result.total_depreciation_after_3_years == Decimal("5400.00")
    assert result.remaining_value_after_3_years == Decimal("4600.00")
```

### 4.3 ATB-002: 双倍余额递减法折旧计算

**测试目标**: 验证双倍余额递减法折旧计算逻辑

```python
# pytest: tests/services/test_depreciation_service.py

def test_double_declining_first_year():
    """
    ATB-002 物理测试期待
    输入: 原值=10000, 使用年限=5
    期待: 第一年折旧额=4000 (折旧率=40%)
    
    验证公式: 年折旧率 = 2 / 预计使用年限 × 100%
            = 2 / 5 × 100% = 40%
            第一年折旧额 = 10000 × 40% = 4000
    """
    asset = Asset(
        asset_id="ASSET-002",
        original_value=Decimal("10000.00"),
        useful_life_years=5,
        depreciation_method="double_declining",
        acquisition_date=date(2024, 1, 1)
    )
    
    schedule = depreciation_service.generate_depreciation_schedule(asset)
    
    assert schedule[0].year == 1
    assert schedule[0].depreciation_rate == Decimal("0.4000")
    assert schedule[0].depreciation == Decimal("4000.00")
    assert schedule[0].remaining_value == Decimal("6000.00")
    assert schedule[0].accumulated_depreciation == Decimal("4000.00")
```

### 4.4 ATB-003: 折旧数据持久化

**测试目标**: 验证折旧台账正确写入数据库

```python
# pytest: tests/services/test_depreciation_service.py

def test_depreciation_ledger_persisted():
    """
    ATB-003 物理测试期待
    验证折旧计算后生成台账记录并成功持久化
    """
    asset_id = create_test_asset(
        original_value=Decimal("10000.00"),
        salvage_value=Decimal("1000.00"),
        useful_life_years=5
    )
    
    depreciation_service.calculate_and_save(asset_id)
    
    ledger = db.query(DepreciationLedger).filter_by(asset_id=asset_id).first()
    
    assert ledger is not None
    assert ledger.depreciation_amount > 0
    assert ledger.record_date == date.today()
    assert ledger.depreciation_method == "straight_line"
```

### 4.5 ATB-004: API 接口可用性

**测试目标**: 验证折旧查询 API 返回正确数据

```python
# pytest: tests/api/test_depreciation_api.py

def test_get_asset_depreciation_endpoint():
    """
    ATB-004 物理测试期待
    GET /api/v1/assets/{asset_id}/depreciation
    期待: HTTP 200, 返回折旧报表数据
    
    响应格式:
    {
        "asset_id": "ASSET-001",
        "straight_line": {
            "annual_depreciation": "1800.00",
            "monthly_depreciation": "150.00",
            "schedule": [...]
        },
        "double_declining": {
            "annual_depreciation_first_year": "4000.00",
            "schedule": [...]
        }
    }
    """
    asset_id = create_test_asset()
    
    response = client.get(f"/api/v1/assets/{asset_id}/depreciation")
    
    assert response.status_code == 200
    data = response.json()
    assert data["asset_id"] == asset_id
    assert "straight_line" in data
    assert "double_declining" in data
    assert "schedule" in data["straight_line"]
    assert "schedule" in data["double_declining"]
```

### 4.6 ATB-005: 前端页面渲染 (Playwright)

**测试目标**: 验证资产详情页正确展示折旧报表

```typescript
// playwright: frontend/tests/e2e/depreciation.spec.ts

test('depreciation report displayed on asset detail', async ({ page }) => {
    /**
     * ATB-005 物理测试期待
     * 访问资产详情页，验证折旧报表模块可见
     */
    await page.goto(`/assets/${testAssetId}`);
    
    // 等待页面加载
    await page.waitForSelector('[data-testid="asset-detail-container"]');
    
    // 验证直线法折旧表格可见
    const straightLineTable = page.locator('[data-testid="depreciation-straight-line"]');
    await expect(straightLineTable).toBeVisible();
    
    // 验证双倍余额递减法表格可见
    const decliningTable = page.locator('[data-testid="depreciation-double-declining"]');
    await expect(decliningTable).toBeVisible();
    
    // 验证表格包含数据行
    const straightLineRows = straightLineTable.locator('tbody tr');
    await expect(straightLineRows).toHaveCount(5); // 5年折旧
    
    const decliningRows = decliningTable.locator('tbody tr');
    await expect(decliningRows).toHaveCount(5);
});
```

### 4.7 ATB-006: 定时任务执行

**测试目标**: 验证折旧定时更新任务正确执行

```python
# pytest: tests/scheduler/test_depreciation_scheduler.py

def test_daily_depreciation_update_job():
    """
    ATB-006 物理测试期待
    模拟定时任务执行，验证所有有效资产折旧数据更新
    """
    with freeze_time("2025-01-15 02:00:00"):
        # 创建待折旧资产
        asset = create_active_asset(
            purchase_date="2024-01-01",
            original_value=Decimal("10000.00")
        )
        
        # 执行定时任务
        depreciation_scheduler.run_daily_update()
        
        # 验证折旧台账已生成
        ledger = get_latest_ledger(asset.id)
        assert ledger.record_date == date(2025, 1, 15)
        assert ledger.depreciation_amount == Decimal("1800.00")
```

### 4.8 ATB-007: 边界条件验证

**测试目标**: 验证非法输入正确拒绝

```python
# pytest: tests/services/test_depreciation_service.py

def test_reject_salvage_greater_than_original():
    """
    ATB-007 物理测试期待
    残值 > 原值时应抛出 ValidationError
    """
    asset = Asset(
        asset_id="ASSET-003",
        original_value=Decimal("1000.00"),
        salvage_value=Decimal("1500.00"),  # 非法：残值大于原值
        useful_life_years=5
    )
    
    with pytest.raises(ValidationError) as exc_info:
        depreciation_service.calculate_annual_depreciation(asset)
    
    assert "salvage_value" in str(exc_info.value)
    assert "must be less than original_value" in str(exc_info.value)


def test_reject_zero_useful_life():
    """
    ATB-007 物理测试期待
    使用年限为 0 时应抛出 ValidationError
    """
    asset = Asset(
        asset_id="ASSET-004",
        original_value=Decimal("10000.00"),
        useful_life_years=0  # 非法：使用年限必须大于0
    )
    
    with pytest.raises(ValidationError) as exc_info:
        depreciation_service.calculate_annual_depreciation(asset)
    
    assert "useful_life_years" in str(exc_info.value)
```

---

## 5. 开发切入层级序列

### 5.1 层级架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  AssetDetailPage → DepreciationReport Component │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  useAuditData.ts → depreciation data fetching   │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  approvalStore.ts → state management            │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                     API Gateway                          │
│  GET /api/v1/assets/{id}/depreciation                   │
│  POST /api/v1/assets/{id}/depreciation/calculate        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Service Layer (Python)                 │
│  - DepreciationService                                  │
│  - StraightLineDepreciation                             │
│  - DoubleDecliningBalanceDepreciation                   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Repository Layer                        │
│  - DepreciationRecordRepository                         │
│  - AssetRepository                                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Database                              │
│  - asset_depreciation                                   │
│  - depreciation_record                                  │
└─────────────────────────────────────────────────────────┘
```

### 5.2 后端开发顺序

#### Layer 0: 数据模型层 (Day 1-2)

```
backend/src/main/java/com/ams/entity/
├── AssetDepreciation.java     # 资产折旧实体
└── DepreciationRecord.java    # 折旧记录实体

数据库迁移:
- 添加 asset_depreciation 表
- 添加 depreciation_record 表
```

#### Layer 1: 业务逻辑层 (Day 3-5)

```
backend/src/main/java/com/ams/service/impl/
├── StraightLineDepreciation.java      # 直线法计算实现
├── DoubleDecliningBalanceDepreciation.java  # 双倍余额递减法实现
└── DepreciationCalculator.java         # 折旧计算器

核心方法:
- calculateAnnualDepreciation()
- generateDepreciationSchedule()
- calculateMonthlyDepreciation()
```

#### Layer 2: 数据访问层 (Day 4-5)

```
backend/src/main/java/com/ams/mapper/
├── AssetDepreciationMapper.java
└── DepreciationRecordMapper.java

职责:
- 折旧记录 CRUD
- 批量折旧数据查询
```

#### Layer 3: API 接口层 (Day 6-7)

```
backend/src/main/java/com/ams/controller/
└── DepreciationController.java

端点清单:
- GET  /api/v1/assets/{assetId}/depreciation
- POST /api/v1/assets/{assetId}/depreciation/calculate
- GET  /api/v1/assets/{assetId}/depreciation/schedule
```

#### Layer 4: 定时任务层 (Day 7-8)

```
backend/src/main/java/com/ams/task/
└── DepreciationSyncTask.java

任务清单:
- dailyDepreciationUpdate: 每日折旧数据更新
- 触发时间: 02:00 UTC
```

### 5.3 前端开发顺序

#### Layer 0: 类型定义 (Day 1)

```
frontend/src/types/
├── depreciation.types.ts      # 折旧相关类型定义
└── workOrder.ts               # 工单类型（可能需要扩展）

frontend/src/pages/WorkOrder/types/
└── workOrder.ts               # 工单类型定义
```

#### Layer 1: 状态管理 (Day 2)

```
frontend/src/stores/
└── approvalStore.ts           # 审批状态管理（扩展折旧相关状态）
```

#### Layer 2: 数据层 (Day 3-4)

```
frontend/src/app/pages/AuditDashboard/hooks/
└── useAuditData.ts            # 审计数据 Hook（扩展折旧数据获取）

职责:
- fetchDepreciationData()
- calculateDepreciationReport()
```

#### Layer 3: 样式层 (Day 4-5)

```
frontend/src/app/pages/AuditDashboard/components/FilterBar/
└── FilterBar.module.css        # 筛选栏样式（可能需要调整布局）
```

#### Layer 4: 测试层 (Day 5-7)

```
frontend/tests/e2e/
└── depreciation.spec.ts       # 折旧功能 E2E 测试
```

---

## 6. 文件修改清单

| 文件路径 | 修改内容 | 优先级 |
|---------|---------|--------|
| `frontend/src/pages/WorkOrder/types/workOrder.ts` | 添加折旧相关类型定义 | P0 |
| `frontend/src/stores/approvalStore.ts` | 扩展状态管理，添加折旧数据存储 | P0 |
| `frontend/src/app/pages/AuditDashboard/hooks/useAuditData.ts` | 添加折旧数据获取方法 | P0 |
| `frontend/src/app/pages/AuditDashboard/components/FilterBar/FilterBar.module.css` | 调整样式以适配折旧报表布局 | P1 |
| `frontend/tests/e2e/depreciation.spec.ts` | 编写折旧功能 E2E 测试 | P0 |

---

## 7. API 规格

### 7.1 GET /api/v1/assets/{assetId}/depreciation

**描述**: 获取资产折旧报表

**响应示例**:
```json
{
    "asset_id": "ASSET-001",
    "original_value": "10000.00",
    "salvage_value": "1000.00",
    "useful_life_years": 5,
    "acquisition_date": "2024-01-01",
    "straight_line": {
        "annual_depreciation": "1800.00",
        "monthly_depreciation": "150.00",
        "total_depreciation": "9000.00",
        "schedule": [
            {"year": 1, "depreciation": "1800.00", "accumulated": "1800.00", "remaining": "8200.00"},
            {"year": 2, "depreciation": "1800.00", "accumulated": "3600.00", "remaining": "6400.00"}
        ]
    },
    "double_declining": {
        "first_year_rate": "40.00%",
        "first_year_depreciation": "4000.00",
        "schedule": [
            {"year": 1, "rate": "40.00%", "depreciation": "4000.00", "accumulated": "4000.00", "remaining": "6000.00"},
            {"year": 2, "rate": "40.00%", "depreciation": "2400.00", "accumulated": "6400.00", "remaining": "3600.00"}
        ]
    }
}
```

### 7.2 POST /api/v1/assets/{assetId}/depreciation/calculate

**描述**: 触发资产折旧计算

**请求体**:
```json
{
    "method": "straight_line" | "double_declining" | "both"
}
```

**响应示例**:
```json
{
    "success": true,
    "asset_id": "ASSET-001",
    "records_created": 5,
    "message": "Depreciation calculated successfully"
}
```

---

## 8. 附录

### 8.1 折旧计算公式参考

| 方法 | 年度折旧率 | 年度折旧额 | 账面净值 |
|------|-----------|-----------|---------|
| 直线法 | `1/使用年限` | `(原值-残值)×年折旧率` | 原值-累计折旧 |
| 双倍余额递减法 | `2/使用年限` | `账面净值×年折旧率` | 原值×(1-折旧率)^年份 |

> **注意**: 双倍余额递减法在最后两年需改为直线法摊销，确保残值被正确保留。

### 8.2 数据库表结构

```sql
-- 资产折旧配置表
CREATE TABLE asset_depreciation (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    asset_id VARCHAR(50) NOT NULL,
    depreciation_method ENUM('straight_line', 'double_declining') NOT NULL,
    useful_life_years INT NOT NULL,
    salvage_value DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 折旧记录表
CREATE TABLE depreciation_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    asset_id VARCHAR(50) NOT NULL,
    record_year INT NOT NULL,
    depreciation_amount DECIMAL(15,2) NOT NULL,
    accumulated_depreciation DECIMAL(15,2) NOT NULL,
    remaining_value DECIMAL(15,2) NOT NULL,
    depreciation_rate DECIMAL(10,4),
    record_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

**文档版本历史**:
| 版本 | 日期 | 修改人 | 描述 |
|------|------|--------|------|
| 1.0 | 2025-01-15 | - | 初始版本 |