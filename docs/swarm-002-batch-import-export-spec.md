# SWARM-002: 资产批量导入/导出 规格指导文档

## 需求与背景

### 业务背景
当前 SWARM-002 资产管理系统已实现单条资产退休/处置流程，需扩展批量数据操作能力以提升运维效率。

### 核心需求
1. **批量导入**：用户上传 Excel 模板批量导入资产数据
2. **字段映射**：支持自定义字段与系统字段的映射配置
3. **错误回显**：导入失败时提供详细错误定位与原因说明
4. **批量导出**：将资产清单导出为标准 Excel 报表

### 依赖现有架构
- 复用 `RetirementRepository` (src/repositories/retirement_repository.py) 数据持久化层
- 复用 `AssetRetirementRequest` (src/models/asset_retirement.py) 数据模型
- 集成现有 `Enum` 枚举体系 (src/models/enums.py)
- 复用 `ApprovalChainService` (src/services/approval_chain_service.py) 审批链

---

## 当前 Phase 对应实施目标

### Phase 1: Excel 导入核心能力
| 目标编号 | 实施目标 | 对应代码位置 |
|---------|---------|-------------|
| P1.1 | Excel 文件解析与校验 | `src/utils/excel_parser.py` (新建) |
| P1.2 | 字段映射引擎 | `src/services/field_mapping_engine.py` (新建) |
| P1.3 | 批量数据验证框架 | `src/services/batch_validator.py` (新建) |
| P1.4 | 错误回显服务 | `src/services/import_error_service.py` (新建) |

### Phase 2: Excel 导出核心能力
| 目标编号 | 实施目标 | 对应代码位置 |
|---------|---------|-------------|
| P2.1 | 资产清单查询服务 | 扩展 `RetirementService` (src/services/retirement_service.py) |
| P2.2 | Excel 报表生成 | `src/services/asset_export_service.py` (新建) |
| P2.3 | 导出模板管理 | `src/templates/export_template.py` (新建) |

### Phase 3: API 层集成
| 目标编号 | 实施目标 | 对应代码位置 |
|---------|---------|-------------|
| P3.1 | 导入 API 端点 | `src/api/routers/retirement_router.py` 新增路由 |
| P3.2 | 导出 API 端点 | `src/api/routers/retirement_router.py` 新增路由 |

---

## 边界约束

### 导入约束
| 约束类型 | 限制值 | 超出处理 |
|---------|-------|---------|
| 单次导入文件大小 | ≤ 10MB | 返回 413 Payload Too Large |
| 单次导入记录数 | ≤ 5000 条 | 返回 422 Validation Error |
| 支持文件格式 | .xlsx, .xls | 返回 415 Unsupported Media Type |
| 必填字段 | asset_id, asset_name, retirement_type | 缺失则标记为 Error Row |
| 字段映射最大数 | 50 个自定义映射 | 超限返回 400 Bad Request |

### 导出约束
| 约束类型 | 限制值 | 超出处理 |
|---------|-------|---------|
| 单次导出记录数 | ≤ 10000 条 | 分页导出，每页 5000 条 |
| 导出超时 | ≤ 60 秒 | 返回 504 Gateway Timeout |
| 报表有效期 | 30 分钟（临时URL） | URL 失效后需重新导出 |

### 数据一致性约束
- 导入事务：整批成功或整批回滚（原子性）
- 并发导入：禁止同一 asset_id 重复导入（幂等性）
- 字段映射缓存：TTL 15 分钟

---

## 验收测试基准 (ATB)

### ATB-1: Excel 解析测试
```python
# tests/test_excel_parser.py::TestExcelParser
def test_parse_valid_xlsx_returns_dataframe():
    """物理测试：上传标准 xlsx 文件，验证解析结果"""
    # Input: 包含 100 条有效记录的 xlsx
    # Expect: 返回 DataFrame，行数=100，列数匹配模板
    
def test_parse_invalid_format_raises_error():
    """物理测试：上传 txt 文件，验证返回 415"""
    # Input: content-type=text/plain
    # Expect: HTTP 415 Unsupported Media Type

def test_parse_corrupted_xlsx_returns_error():
    """物理测试：上传损坏的 xlsx 文件"""
    # Input: 文件结构损坏的 xlsx
    # Expect: 抛出 ParseError，错误码 ERR_EXCEL_PARSE_FAILED
```

### ATB-2: 字段映射测试
```python
# tests/test_field_mapping.py::TestFieldMappingEngine
def test_mapping_with_custom_headers_success():
    """物理测试：自定义列名映射到系统字段"""
    # Input: Excel 列名 ["资产编号", "资产名称"] -> 系统字段 [asset_id, asset_name]
    # Expect: 映射后 DataFrame 列名变为系统字段名
    
def test_missing_required_field_mapping():
    """物理测试：缺少必填字段映射"""
    # Input: 未映射 asset_id
    # Expect: 验证失败，返回 422，detail 包含缺失字段列表

def test_duplicate_field_mapping_prevented():
    """物理测试：禁止一对多字段映射"""
    # Input: asset_id 同时映射到 asset_id 和 serial_number
    # Expect: 抛出 MappingConflictError
```

### ATB-3: 批量验证测试
```python
# tests/test_batch_validation.py::TestBatchValidator
def test_exceed_max_records_returns_422():
    """物理测试：导入记录超 5000 条"""
    # Input: DataFrame 包含 5001 条记录
    # Expect: HTTP 422，detail="Batch size exceeds maximum of 5000"

def test_valid_records_pass_validation():
    """物理测试：所有字段合法"""
    # Input: 100 条符合所有约束的记录
    # Expect: 验证通过，返回 ValidationResult(passed=100, failed=0)

def test_partial_failure_reports_errors():
    """物理测试：部分记录验证失败"""
    # Input: 100 条记录，其中 5 条 asset_id 重复
    # Expect: 返回每条失败记录的 row_number, field, reason
```

### ATB-4: 错误回显测试
```python
# tests/test_import_error.py::TestImportErrorService
def test_error_report_generates_excel_with_failed_rows():
    """物理测试：错误回显生成 Excel 文件"""
    # Input: 5 条失败记录 + 95 条成功记录
    # Expect: 生成包含错误标注的 result.xlsx，失败行标记为红色
    
def test_error_detail_includes_field_and_reason():
    """物理测试：错误详情包含字段名和原因"""
    # Input: 第 3 行 asset_id="ASSET-001" 重复
    # Expect: 错误对象 {row: 3, field: "asset_id", reason: "Duplicate asset_id"}
```

### ATB-5: 批量导出测试
```python
# tests/test_batch_export.py::TestAssetExportService
def test_export_generates_valid_xlsx():
    """物理测试：导出生成可用 Excel"""
    # Input: 查询条件 status=RETIRED, limit=1000
    # Expect: 生成 xlsx 文件，包含表头和数据行，文件可正常打开

def test_export_exceeds_timeout_handled():
    """物理测试：大数据量导出超时处理"""
    # Input: 查询条件导致 15000 条记录，模拟慢查询
    # Expect: 60 秒超时后返回 504，可重试

def test_export_pagination_for_large_dataset():
    """物理测试：超 10000 条自动分页"""
    # Input: 15000 条记录
    # Expect: 返回导出任务 ID，生成 page1.xlsx + page2.xlsx 两个文件
```

### ATB-6: API 集成测试
```python
# tests/test_api_integration.py::TestBatchOperationsAPI
def test_import_endpoint_accepts_multipart_form():
    """物理测试：POST /api/v1/assets/batch/import"""
    # Input: multipart/form-data 包含 file 和 mapping_config
    # Expect: 202 Accepted，返回 task_id

def test_export_endpoint_returns_stream():
    """物理测试：GET /api/v1/assets/batch/export"""
    # Input: query params status=ACTIVE
    # Expect: 200 OK，Content-Type=application/vnd.openxmlformats
```

### ATB-7: 性能基准测试
```python
# tests/test_performance.py::TestBatchPerformance
def test_import_1000_records_completes_under_10s():
    """物理测试：1000 条记录导入性能"""
    # Benchmark: ≤ 10 秒（不含网络传输）

def test_export_5000_records_completes_under_30s():
    """物理测试：5000 条记录导出性能"""
    # Benchmark: ≤ 30 秒
```

---

## 开发切入层级序列

### Layer 0: 基础设施层（优先）
```
src/
├── models/
│   ├── batch_import_request.py      # 批量导入请求模型
│   ├── batch_import_result.py       # 导入结果模型
│   ├── batch_export_request.py      # 导出请求模型
│   └── import_error_detail.py       # 错误详情模型
├── utils/
│   ├── excel_parser.py              # Excel 解析工具（封装 openpyxl）
│   └── excel_generator.py           # Excel 生成工具
```

### Layer 1: 核心服务层（其次）
```
src/
├── services/
│   ├── field_mapping_engine.py      # 字段映射引擎
│   ├── batch_validator.py           # 批量验证器
│   ├── asset_import_service.py      # 导入服务
│   ├── asset_export_service.py      # 导出服务
│   └── import_error_service.py      # 错误回显服务
```

### Layer 2: 持久化层（并行）
```
src/
├── repositories/
│   └── batch_import_repository.py   # 批量导入记录持久化
```

### Layer 3: API 层（最后）
```
src/api/routers/retirement_router.py 新增端点:
- POST /api/v1/assets/batch/import     # 批量导入
- GET  /api/v1/assets/batch/export    # 批量导出
- GET  /api/v1/assets/batch/import/{task_id}/errors  # 获取错误详情
```

### 依赖注入顺序
```
excel_parser.py 
    → FieldMappingEngine.py 
    → BatchValidator.py 
    → AssetImportService.py 
    → API Layer (retirement_router.py)
```

### 测试执行顺序
```
Layer 0 测试 → Layer 1 单元测试 → Layer 2 测试 → Layer 3 集成测试
```

---

## 附录：关键枚举扩展

```python
# src/models/enums.py 新增
class ImportErrorCode(str, Enum):
    FILE_TOO_LARGE = "ERR_FILE_TOO_LARGE"
    INVALID_FORMAT = "ERR_INVALID_FORMAT"
    PARSE_FAILED = "ERR_EXCEL_PARSE_FAILED"
    MAPPING_CONFLICT = "ERR_MAPPING_CONFLICT"
    BATCH_SIZE_EXCEEDED = "ERR_BATCH_SIZE_EXCEEDED"
    VALIDATION_FAILED = "ERR_VALIDATION_FAILED"
    DUPLICATE_ASSET_ID = "ERR_DUPLICATE_ASSET_ID"

class ExportFormat(str, Enum):
    XLSX = "xlsx"
    XLS = "xls"
```

---

## 质量门槛

| 指标 | 目标值 | 测量方法 |
|-----|-------|---------|
| 单元测试覆盖率 | ≥ 85% | pytest --cov |
| 批量导入成功率 | ≥ 99% (有效数据) | 1000 条/批次压测 |
| 错误定位准确率 | 100% | 已知错误集验证 |
| 最大内存占用 | ≤ 512MB | resource monitor |