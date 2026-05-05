# SWARM-2025-Q2-P2-006 资产批量导入导出功能规格指导

## 1. 需求与背景

### 1.1 业务驱动

资产管理模块在企业实际运营中涉及大量数据初始化与周期性维护。手工逐条录入存在效率低下、易出错、人力成本高等痛点。业务方明确要求支持 Excel/CSV 格式的批量数据操作，以满足以下核心场景：

| 场景 | 描述 | 频次 |
|------|------|------|
| 数据初始化 | 新系统上线时的资产数据批量初始化 | 一次性 |
| 数据迁移 | 跨系统迁移时的资产数据导出与再导入 | 周期性 |
| 报表导出 | 财务/审计部门的定期资产报表导出 | 周期性 |

### 1.2 技术驱动

- 现有系统已具备资产数据模型与基础 CRUD API
- 前端技术栈支持文件上传与数据解析
- 后端已有 openpyxl / pandas 等数据处理库的技术储备

### 1.3 功能概述

```
┌─────────────────────────────────────────────────────────────┐
│                    资产批量导入导出功能                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐              ┌─────────────────┐       │
│  │   导入流程        │              │   导出流程        │       │
│  ├─────────────────┤              ├─────────────────┤       │
│  │ 1. 文件上传       │              │ 1. 参数筛选       │       │
│  │ 2. 数据解析       │              │ 2. 数据查询       │       │
│  │ 3. 格式校验       │              │ 3. 数据格式化     │       │
│  │ 4. 数据入库       │              │ 4. 文件生成       │       │
│  │ 5. 结果报告       │              │ 5. 文件下载       │       │
│  └─────────────────┘              └─────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 定位

| 属性 | 值 |
|------|-----|
| **所属 Quarter** | 2025 Q2 |
| **所属 Phase** | P2（批量操作与数据管理增强） |
| **Phase 整体目标** | 在资产基础 CRUD 完善后，扩展批量操作能力，提升数据管理效率 |
| **迭代版本** | Iteration 1 |

### 2.2 本 Iteration 具体目标

| 目标编号 | 目标描述 | 优先级 | 交付标准 |
|---------|---------|--------|---------|
| P2-006-T1 | 支持 CSV 格式的单资产批量导入（≤5000条/次） | P0 | 5000条数据 < 30s 完成 |
| P2-006-T2 | 支持 Excel（.xlsx）格式的单资产批量导入 | P0 | 同 CSV 标准 |
| P2-006-T3 | 支持资产列表数据导出为 CSV | P0 | 支持筛选条件 |
| P2-006-T4 | 支持资产列表数据导出为 Excel | P1 | 格式美化、列宽自适应 |
| P2-006-T5 | 导入数据校验与错误报告生成 | P0 | 逐行错误定位 |
| P2-006-T6 | 导入进度跟踪与状态查询 | P1 | 实时进度更新 |

---

## 3. 边界约束

### 3.1 范围边界

#### ✅ 明确纳入

- 单资产（Asset）实体的批量导入导出
- CSV 与 .xlsx 两种主流格式
- 字段级数据校验（必填、格式、枚举值）
- 导入结果错误报告（失败行明细）
- 异步导入任务（>1000条触发异步处理）
- 导出时的筛选条件（分类、状态、时间范围）

#### ❌ 明确排除

- 附件/图片的批量上传
- 资产关系（父子、从属）的批量维护
- 批量操作的历史审计回滚
- 从其他系统（如SAP、Oracle）的直接对接
- 多语言/多币种汇率处理
- 模板定制化（使用固定导入模板）

### 3.2 技术约束

| 约束项 | 具体限制 |
|-------|---------|
| 单次导入上限 | 5000 条记录 |
| 文件大小上限 | 10 MB |
| 支持字段数 | 固定 12 个核心字段（见字段映射表） |
| 并发导入任务 | 单用户同时 ≤ 2 个任务 |
| 任务超时 | 30 分钟 |
| 支持浏览器 | Chrome ≥ 90, Firefox ≥ 88, Safari ≥ 14 |

### 3.3 数据约束

#### 导入字段清单（固定映射）

| 字段名 | 类型 | 必填 | 格式/约束 | 示例 |
|-------|------|------|----------|------|
| asset_id | String | 否 | 导入时为空则自动生成 UUID | - |
| asset_name | String | 是 | 最大50字符 | "Dell OptiPlex 7090" |
| asset_type | Enum | 是 | EQUIPMENT/FURNITURE/VEHICLE/IT_HARDWARE/OTHER | "IT_HARDWARE" |
| serial_number | String | 否 | 最大100字符 | "SN-2024-00123" |
| purchase_date | Date | 是 | YYYY-MM-DD | "2024-01-15" |
| purchase_price | Decimal | 是 | >0, 最多2位小数 | "5999.99" |
| currency | Enum | 是 | 默认 CNY | "CNY" |
| department | String | 是 | 需匹配已存在的部门编码 | "DEPT-001" |
| custodian | String | 否 | 最大100字符 | "张三" |
| status | Enum | 是 | ACTIVE/INACTIVE/MAINTENANCE/RETIRED | "ACTIVE" |
| location | String | 否 | 最大200字符 | "A栋3层301室" |
| remarks | String | 否 | 最大500字符 | "采购自京东自营" |

#### 导出字段清单

| 字段名 | 中文表头 | 格式 |
|-------|---------|------|
| asset_id | 资产编号 | String |
| asset_name | 资产名称 | String |
| asset_type | 资产类型 | String |
| serial_number | 序列号 | String |
| purchase_date | 采购日期 | YYYY-MM-DD |
| purchase_price | 采购金额 | Decimal |
| currency | 币种 | String |
| department | 所属部门 | String |
| custodian | 保管人 | String |
| status | 资产状态 | String |
| location | 存放地点 | String |
| remarks | 备注 | String |

---

## 4. 验收测试基准 (ATB)

### 4.1 测试层级架构

```
Layer 1: 单元测试 (Unit Tests)
    ↓
Layer 2: 组件集成测试 (Component Integration)
    ↓
Layer 3: API 端到端测试 (API E2E)
    ↓
Layer 4: 前端 UI 交互测试 (UI E2E via Playwright)
```

### 4.2 ATB-1: CSV 导入功能

#### 4.2.1 CSV 文件解析验证

| 测试用例 ID | 测试用例 | 物理测试方法 | 期待结果 |
|------------|---------|-------------|---------|
| TC-1.1.1 | 正常 CSV 解析 | `pytest tests/unit/test_csv_parser.py::test_parse_valid_csv` | 正确解析 header 与数据行，无异常 |
| TC-1.1.2 | 多编码支持 | `pytest tests/unit/test_csv_parser.py::test_parse_utf8_with_bom` | UTF-8-BOM 编码文件正确解析 |
| TC-1.1.3 | GBK 编码兼容 | `pytest tests/unit/test_csv_parser.py::test_parse_gbk_encoding` | GBK 编码文件正确解析 |
| TC-1.1.4 | 异常行处理 | `pytest tests/unit/test_csv_parser.py::test_parse_with_empty_rows` | 空行自动跳过，生成警告日志 |
| TC-1.1.5 | 超大文件拒绝 | `pytest tests/unit/test_csv_parser.py::test_reject_file_over_10mb` | 抛出 `FileSizeExceededError`，返回 413 |

#### 4.2.2 字段校验逻辑

| 测试用例 ID | 测试用例 | 物理测试方法 | 期待结果 |
|------------|---------|-------------|---------|
| TC-1.2.1 | 必填字段缺失 | `pytest tests/unit/test_field_validator.py::test_missing_required_fields` | 返回校验失败列表，含字段名与行号 |
| TC-1.2.2 | 枚举值越界 | `pytest tests/unit/test_field_validator.py::test_invalid_enum_value` | 返回 `{row: 5, field: "asset_type", value: "UNKNOWN", reason: "invalid enum"}` |
| TC-1.2.3 | 日期格式错误 | `pytest tests/unit/test_field_validator.py::test_invalid_date_format` | 拒绝非 YYYY-MM-DD 格式，返回错误位置 |
| TC-1.2.4 | 价格非数字 | `pytest tests/unit/test_field_validator.py::test_non_numeric_price` | 返回 `{row: 3, field: "purchase_price", error: "must be numeric"}` |
| TC-1.2.5 | 字符串超长 | `pytest tests/unit/test_field_validator.py::test_string_length_exceed` | 返回超长字段及最大限制 |

#### 4.2.3 批量入库验证

| 测试用例 ID | 测试用例 | 物理测试方法 | 期待结果 |
|------------|---------|-------------|---------|
| TC-1.3.1 | 500条同步入库 | `pytest tests/integration/test_asset_import.py::test_sync_import_500_rows` | 响应时间 < 5s, 500条全入库 |
| TC-1.3.2 | 3000条异步入库 | `pytest tests/integration/test_asset_import.py::test_async_import_3000_rows` | 返回 task_id, 30s 内完成 |
| TC-1.3.3 | 5000条极限入库 | `pytest tests/integration/test_asset_import.py::test_async_import_5000_rows` | 正常完成，数据库记录一致 |
| TC-1.3.4 | 部分失败回滚 | `pytest tests/integration/test_asset_import.py::test_partial_failure_rollback` | 任意一条失败则全量回滚，状态置 FAILED |

#### 4.2.4 错误报告生成

| 测试用例 ID | 测试用例 | 物理测试方法 | 期待结果 |
|------------|---------|-------------|---------|
| TC-1.4.1 | 错误报告格式 | `pytest tests/integration/test_import_report.py::test_error_report_csv_format` | 生成 CSV 报告，含 row_number/error_field/error_detail |
| TC-1.4.2 | 下载接口可用 | `GET /api/v1/asset-import/tasks/{task_id}/report` | 返回 200 + CSV 文件下载流 |
| TC-1.4.3 | 错误行定位 | `pytest tests/integration/test_import_report.py::test_error_row_location` | 错误报告包含原始行号 |

### 4.3 ATB-2: Excel 导入功能

| 测试用例 ID | 测试用例 | 物理测试方法 | 期待结果 |
|------------|---------|-------------|---------|
| TC-2.1 | .xlsx 文件解析 | `pytest tests/unit/test_excel_parser.py::test_parse_xlsx_worksheet` | 正确读取第一个工作表 |
| TC-2.2 | 多工作表取第一 | `pytest tests/unit/test_excel_parser.py::test_ignore_other_worksheets` | 忽略非首工作表数据 |
| TC-2.3 | 空单元格处理 | `pytest tests/unit/test_excel_parser.py::test_empty_cell_as_empty_string` | 空单元格转为空字符串而非 null |
| TC-2.4 | 合并单元格支持 | `pytest tests/unit/test_excel_parser.py::test_merged_cell_handling` | 合并单元格取首值 |
| TC-2.5 | 日期类型识别 | `pytest tests/unit/test_excel_parser.py::test_date_type_recognition` | Excel 日期类型自动转为 YYYY-MM-DD |

### 4.4 ATB-3: CSV 导出功能

| 测试用例 ID | 测试用例 | 物理测试方法 | 期待结果 |
|------------|---------|-------------|---------|
| TC-3.1 | 基础导出 | `pytest tests/integration/test_asset_export.py::test_export_all_assets_to_csv` | 生成标准 CSV，UTF-8 编码 |
| TC-3.2 | 筛选导出 | `pytest tests/integration/test_asset_export.py::test_export_filtered_by_type` | 仅导出 `asset_type=EQUIPMENT` 的记录 |
| TC-3.3 | 日期范围导出 | `pytest tests/integration/test_asset_export.py::test_export_with_date_range` | 按采购日期筛选 |
| TC-3.4 | 大数据量导出 | `pytest tests/integration/test_asset_export.py::test_export_10000_records` | 内存不超 512MB，生成时间 < 10s |
| TC-3.5 | 分页导出 | `pytest tests/integration/test_asset_export.py::test_paginated_export` | 支持 page/page_size 参数 |

### 4.5 ATB-4: Excel 导出功能

| 测试用例 ID | 测试用例 | 物理测试方法 | 期待结果 |
|------------|---------|-------------|---------|
| TC-4.1 | Excel 格式正确 | `pytest tests/integration/test_asset_export.py::test_export_to_xlsx` | 生成 .xlsx 文件，openpyxl 可正常打开 |
| TC-4.2 | 列宽自适应 | `pytest tests/integration/test_asset_export.py::test_auto_adjust_column_width` | 列宽自动匹配内容，列数 = 字段数 |
| TC-4.3 | 中文表头支持 | `pytest tests/integration/test_asset_export.py::test_chinese_column_headers` | 表头显示中文名称 |
| TC-4.4 | 金额格式化 | `pytest tests/integration/test_asset_export.py::test_currency_formatting` | 金额显示为会计格式 |

### 4.6 ATB-5: 前端 UI 集成（Playwright）

| 测试用例 ID | 测试用例 | 物理测试方法 | 期待结果 |
|------------|---------|-------------|---------|
| TC-5.1 | 文件上传交互 | `playwright tests/e2e/test_import_ui.py::test_upload_csv_file` | 文件选择后触发预览，显示前10行 |
| TC-5.2 | 拖拽上传 | `playwright tests/e2e/test_import_ui.py::test_drag_and_drop_upload` | 支持拖拽上传文件 |
| TC-5.3 | 上传进度显示 | `playwright tests/e2e/test_import_ui.py::test_upload_progress_indicator` | 上传中显示进度条，完成后显示结果 |
| TC-5.4 | 错误提示UI | `playwright tests/e2e/test_import_ui.py::test_validation_errors_display` | 校验失败时在UI高亮错误行，可下载错误报告 |
| TC-5.5 | 导出按钮交互 | `playwright tests/e2e/test_export_ui.py::test_export_button_click` | 点击导出后触发下载，文件名含时间戳 |
| TC-5.6 | 导出格式选择 | `playwright tests/e2e/test_export_ui.py::test_export_format_selector` | 可切换 CSV/Excel，切换后刷新预览 |

---

## 5. 开发切入层级序列

### 5.1 第一层：数据解析层（Layer 1 - Foundation）

```
src/
├── parsers/                          # [新建]
│   ├── __init__.py
│   ├── base_parser.py                # 抽象基类，定义 parse() 接口
│   ├── csv_parser.py                 # CSV 解析实现
│   └── excel_parser.py               # Excel 解析实现
└── validators/
    ├── __init__.py
    ├── field_validator.py            # 单字段校验器
    └── row_validator.py              # 行级校验器
```

**交付物**：
- CSV/Excel 文件解析器
- 字段类型校验器（必填、枚举、格式）
- 依赖单元测试覆盖率 ≥ 90%

#### 5.1.1 BaseParser 抽象接口

```python
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class BaseParser(ABC):
    """文件解析器抽象基类"""
    
    @abstractmethod
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        """解析文件并返回数据行列表"""
        pass
    
    @abstractmethod
    def validate_headers(self, headers: List[str]) -> bool:
        """验证文件头是否符合预期"""
        pass
    
    @property
    @abstractmethod
    def supported_extensions(self) -> List[str]:
        """返回支持的文件扩展名"""
        pass
```

#### 5.1.2 FieldValidator 字段校验器

```python
class FieldValidator:
    """单字段校验器"""
    
    REQUIRED_FIELDS = ["asset_name", "asset_type", "purchase_date", "purchase_price", "currency", "department", "status"]
    ENUM_FIELDS = {
        "asset_type": ["EQUIPMENT", "FURNITURE", "VEHICLE", "IT_HARDWARE", "OTHER"],
        "status": ["ACTIVE", "INACTIVE", "MAINTENANCE", "RETIRED"],
        "currency": ["CNY", "USD", "EUR", "JPY", "GBP"]
    }
    DATE_FORMAT = "%Y-%m-%d"
    MAX_STRING_LENGTHS = {
        "asset_name": 50,
        "serial_number": 100,
        "custodian": 100,
        "location": 200,
        "remarks": 500
    }
```

---

### 5.2 第二层：数据处理层（Layer 2 - Core Business）

```
src/
├── services/
│   ├── __init__.py
│   ├── import_service.py             # 导入业务逻辑
│   ├── export_service.py              # 导出业务逻辑
│   └── validation_service.py          # 校验编排服务
└── models/
    └── import_task.py                 # 导入任务模型
```

**交付物**：
- 同步导入（≤1000条）
- 异步导入任务队列（Celery/Redis）
- 导出数据查询与格式化
- 依赖单元测试覆盖率 ≥ 85%

#### 5.2.1 异步任务处理流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      导入任务处理流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户上传文件 ──→ 文件解析 ──→ 数据校验 ──→ [数据量判断]          │
│                                         │                       │
│                              ┌──────────┴──────────┐            │
│                              ↓                     ↓            │
│                        ≤1000条                  >1000条         │
│                        同步处理                  异步处理         │
│                              │                     │            │
│                              └──────────┬─────────┘            │
│                                         ↓                       │
│                                   结果入库                       │
│                                         │                       │
│                              ┌──────────┴──────────┐            │
│                              ↓                     ↓            │
│                         成功                      失败            │
│                         全量提交                  全量回滚        │
│                              │                     │            │
│                              └──────────┬──────────┘            │
│                                         ↓                       │
│                                    生成报告                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5.3 第三层：API 层（Layer 3 - Interface）

```
src/
├── api/
│   ├── __init__.py
│   └── v1/
│       ├── __init__.py
│       └── asset_import.py             # 导入相关 API
│       └── asset_export.py             # 导出相关 API
└── schemas/
    ├── import_schema.py                # Pydantic 请求/响应模型
    └── export_schema.py                # [当前文件] 导出相关 Schema
```

**API 端点定义**：

| 方法 | 路径 | 描述 | 请求体/参数 |
|------|------|------|------------|
| POST | `/api/v1/assets/import/upload` | 上传文件触发导入 | multipart/form-data |
| GET | `/api/v1/assets/import/tasks` | 列出当前用户导入任务 | - |
| GET | `/api/v1/assets/import/tasks/{task_id}` | 查询任务状态 | task_id (path) |
| GET | `/api/v1/assets/import/tasks/{task_id}/report` | 下载错误报告 | task_id (path) |
| GET | `/api/v1/assets/export` | 导出资产列表 | query params |

---

### 5.4 第四层：前端层（Layer 4 - UI/UX）

```
src/
├── components/
│   ├── ImportPanel/
│   │   ├── index.tsx
│   │   ├── FileUploader.tsx
│   │   ├── DataPreview.tsx
│   │   └── ImportResult.tsx
│   └── ExportPanel/
│       ├── index.tsx
│       └── FormatSelector.tsx
└── pages/
    └── AssetBatchPage.tsx
```

**交付物**：
- 文件上传组件（含拖拽）
- 数据预览表格（支持前100行预览）
- 导入进度指示器
- 导出格式选择器

---

### 5.5 第五层：集成与交付（Layer 5 - Verification）

```
tests/
├── unit/                              # Layer 1 单元测试
├── integration/                        # Layer 2-3 API 测试
├── e2e/                               # Layer 4 Playwright 测试
└── fixtures/                          # 测试数据 fixtures
```

**CI/CD 门禁**：
- pytest 覆盖率报告生成
- Playwright E2E 测试通过
- 安全性扫描（文件上传路径穿越防护）

---

## 6. 依赖与风险项

### 6.1 关键依赖

| 依赖项 | 负责方 | 交付时间 | 依赖关系 |
|-------|--------|---------|---------|
| 资产基础 CRUD API | 后端 Team A | Sprint-3 结束前 | API 层依赖 |
| 部门数据字典 API | 后端 Team B | Sprint-3 结束前 | 字段校验依赖 |
| 文件存储服务（S3/本地） | 基础设施 Team | Sprint-2 结束前 | 文件上传依赖 |
| Celery 任务队列 | 后端 Team A | Sprint-3 结束前 | 异步处理依赖 |
| 资产数据模型 | 后端 Team A | Sprint-2 结束前 | 数据层依赖 |

### 6.2 已知风险

| 风险 | 概率 | 影响 | 缓解策略 |
|-----|------|------|---------|
| 大文件解析内存溢出 | 中 | 高 | 流式解析 + 内存监控，超限直接拒绝 |
| Excel 格式兼容性问题 | 低 | 中 | 仅支持 .xlsx，告知用户避免 .xls |
| 并发导入任务资源竞争 | 中 | 中 | 引入 Redis 锁，单用户并发 ≤ 2 |
| 部门编码不存在 | 高 | 中 | 导入前预先校验部门数据字典 |
| 特殊字符导致 CSV 解析错误 | 低 | 低 | 使用 CSV 标准引号包裹含逗号字段 |

---

## 7. 附件

### 7.1 导入模板示例（CSV）

```csv
asset_name,asset_type,serial_number,purchase_date,purchase_price,currency,department,custodian,status,location,remarks
Dell OptiPlex 7090,IT_HARDWARE,SN-2024-00123,2024-01-15,5999.99,CNY,DEPT-001,张三,ACTIVE,A栋3层301室,采购自京东自营
办公椅,OFFICE_FURNITURE,,2024-02-01,299.00,CNY,DEPT-002,李四,ACTIVE,B栋2层201室,
```

### 7.2 错误报告示例（CSV）

```csv
row_number,field,original_value,error_detail
5,asset_type,UNKNOWN,invalid enum value, must be one of [EQUIPMENT, FURNITURE, VEHICLE, IT_HARDWARE, OTHER]
8,purchase_price,-100,price must be greater than 0
12,purchase_date,2024/01/15,invalid date format, expected YYYY-MM-DD
```

---

**文档版本**: v1.0  
**制定日期**: 2025-Q2-Sprint-2  
**审核状态**: 待评审  
**文档作者**: SWARM Generator