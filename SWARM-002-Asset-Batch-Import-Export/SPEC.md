# SWARM-002: 资产批量导入/导出 规格指导文档

## 1. 需求与背景

### 1.1 业务背景

当前 SWARM-002 资产管理系统已实现单条资产退休/处置流程，具备完善的审批链、状态机和通知服务机制。随着资产管理规模扩大，运维人员需要高效处理大量资产数据的批量操作能力，以提升工作效率并降低人工操作风险。

### 1.2 核心功能需求

| 需求编号 | 功能描述 | 优先级 |
|---------|---------|--------|
| REQ-001 | 批量导入：上传 Excel 模板批量导入资产数据 | P0 |
| REQ-002 | 字段映射：支持自定义字段与系统字段的映射配置 | P0 |
| REQ-003 | 错误回显：导入失败时提供详细错误定位与原因说明 | P0 |
| REQ-004 | 批量导出：将资产清单导出为标准 Excel 报表 | P1 |
| REQ-005 | 导入模板管理：提供标准化 Excel 导入模板下载 | P1 |

### 1.3 依赖现有架构

| 现有组件 | 复用方式 | 代码位置 |
|---------|---------|----------|
| `RetirementRepository` | 数据持久化层 | `src/repositories/retirement_repository.py` L391 |
| `AssetRetirementRequest` | 数据模型基类 | `src/models/asset_retirement.py` L153 |
| `Enum` 枚举体系 | 状态/类型枚举定义 | `src/models/enums.py` |
| `ApprovalChainService` | 审批链服务扩展 | `src/services/approval_chain_service.py` |
| `NotificationService` | 导入结果通知 | `src/services/notification_service.py` |

---

## 2. 当前 Phase 对应实施目标

### Phase 1: Excel 导入核心能力

| 目标编号 | 实施目标 | 对应代码位置 | 交付物 |
|---------|---------|-------------|--------|
| P1.1 | Excel 文件解析与校验 | `src/services/asset_import_service.py` (新建) | ExcelParser 类 |
| P1.2 | 字段映射引擎 | `src/services/field_mapping_engine.py` (新建) | FieldMappingEngine 类 |
| P1.3 | 批量数据验证框架 | `src/validators/batch_validator.py` (新建) | BatchValidator 类 |
| P1.4 | 错误回显服务 | `src/services/import_error_service.py` (新建) | ImportErrorService 类 |

### Phase 2: Excel 导出核心能力

| 目标编号 | 实施目标 | 对应代码位置 | 交付物 |
|---------|---------|-------------|--------|
| P2.1 | 资产清单查询服务 | 扩展 `src/services/retirement_service.py` (L444) | QueryBuilder 扩展 |
| P2.2 | Excel 报表生成 | `src/services/asset_export_service.py` (新建) | ExcelGenerator 类 |
| P2.3 | 导出模板管理 | `src/templates/export_template.py` (新建) | ExportTemplateManager 类 |

### Phase 3: API 层集成

| 目标编号 | 实施目标 | 对应代码位置 | 交付物 |
|---------|---------|-------------|--------|
| P3.1 | 导入 API 端点 | `src/main.py` 新增路由 L850+ | POST /api/v1/assets/batch/import |
| P3.2 | 导出 API 端点 | `src/main.py` 新增路由 L870+ | GET /api/v1/assets/batch/export |
| P3.3 | 错误报告下载端点 | `src/main.py` 新增路由 L890+ | GET /api/v1/assets/batch/import/{task_id}/errors |
| P3.4 | 导入模板下载端点 | `src/main.py` 新增路由 L910+ | GET /api/v1/assets/batch/template |

---

## 3. 边界约束

### 3.1 导入约束

| 约束类型 | 限制值 | 超出处理策略 | 错误码 |
|---------|-------|-------------|--------|
| 单次导入文件大小 | ≤ 10MB | 返回 HTTP 413 | `ERR_FILE_TOO_LARGE` |
| 单次导入记录数 | ≤ 5000 条 | 返回 HTTP 422 | `ERR_BATCH_SIZE_EXCEEDED` |
| 支持文件格式 | `.xlsx`, `.xls` | 返回 HTTP 415 | `ERR_INVALID_FORMAT` |
| 必填字段 | asset_id, asset_name, retirement_type | 缺失则标记为 Error Row | `ERR_MISSING_REQUIRED_FIELD` |
| 字段映射最大数 | 50 个自定义映射 | 返回 HTTP 400 | `ERR_MAPPING_CONFLICT` |
| 映射缓存 TTL | 15 分钟 | 缓存失效需重新映射 | - |

### 3.2 导出约束

| 约束类型 | 限制值 | 超出处理策略 | 错误码 |
|---------|-------|-------------|--------|
| 单次导出记录数 | ≤ 10000 条 | 自动分页，每页 5000 条 | - |
| 导出超时时间 | ≤ 60 秒 | 返回 HTTP 504 | `ERR_EXPORT_TIMEOUT` |
| 报表有效期 | 30 分钟（临时 URL） | URL 失效后需重新导出 | `ERR_REPORT_EXPIRED` |
| 并发导出任务数 | ≤ 3 个/用户 | 返回 HTTP 429 | `ERR_TOO_MANY_REQUESTS` |

### 3.3 数据一致性约束

| 约束类型 | 实现方式 | 失败处理 |
|---------|---------|---------|
| 导入事务原子性 | 整批成功或整批回滚 | 全部回滚，生成错误报告 |
| 导入幂等性 | 禁止同一 asset_id 重复导入 | 返回 ERR_DUPLICATE_ASSET_ID |
| 字段映射一致性 | 缓存 + 版本控制 | 冲突时使用最新映射配置 |
| 导出数据时效性 | 导出时点快照 | 标注导出时间戳 |

---

## 4. 验收测试基准 (ATB)

### 4.1 ATB-1: Excel 解析测试

```python
# tests/test_batch_import.py::TestExcelParser

def test_parse_valid_xlsx_returns_dataframe():
    """
    物理测试：上传标准 xlsx 文件，验证解析结果
    ---
    Input:  包含 100 条有效记录的 xlsx 文件
           列: [asset_id, asset_name, retirement_type, reason]
    Expect: 
           - 返回 DataFrame 对象
           - 行数 = 100
           - 列数匹配模板（4列）
           - 数据类型正确（asset_id 为 string）
    """

def test_parse_invalid_format_raises_error():
    """
    物理测试：上传非 Excel 文件，验证返回 415
    ---
    Input:  content-type: text/plain
           文件内容: "asset_id,asset_name\nA001,Test"
    Expect: 
           - HTTP 415 Unsupported Media Type
           - 响应体包含 {"error": "ERR_INVALID_FORMAT", "detail": "Only .xlsx and .xls files are supported"}
    """

def test_parse_corrupted_xlsx_returns_error():
    """
    物理测试：上传损坏的 xlsx 文件
    ---
    Input:  文件结构损坏的 xlsx（如 ZIP 格式不完整）
    Expect: 
           - 抛出 ParseError 异常
           - 错误码 = "ERR_EXCEL_PARSE_FAILED"
           - 包含原始文件名前缀在错误信息中
    """

def test_parse_empty_file_raises_error():
    """
    物理测试：上传空文件
    ---
    Input:  xlsx 文件包含 0 行数据
    Expect: 
           - HTTP 422 Validation Error
           - detail 包含 "No data records found"
    """
```

### 4.2 ATB-2: 字段映射测试

```python
# tests/test_field_mapping.py::TestFieldMappingEngine

def test_mapping_with_custom_headers_success():
    """
    物理测试：自定义列名映射到系统字段
    ---
    Input:  Excel 列名: ["资产编号", "资产名称", "处置类型", "处置原因"]
           映射配置: {
               "资产编号": "asset_id",
               "资产名称": "asset_name", 
               "处置类型": "retirement_type",
               "处置原因": "retirement_reason"
           }
    Expect: 
           - 映射后 DataFrame 列名变为系统字段名
           - 返回 MappingResult(success=True, mapped_count=4)
    """

def test_missing_required_field_mapping():
    """
    物理测试：缺少必填字段映射
    ---
    Input:  映射配置缺少 "asset_id"
           映射配置: {
               "资产名称": "asset_name",
               "处置类型": "retirement_type"
           }
    Expect: 
           - 验证失败
           - HTTP 422
           - detail.missing_fields = ["asset_id"]
    """

def test_duplicate_field_mapping_prevented():
    """
    物理测试：禁止一对多字段映射
    ---
    Input:  冲突映射配置:
           {
               "资产编号": "asset_id",
               "编号": "asset_id",  # 重复映射到同一目标
               "序列号": "serial_number"
           }
    Expect: 
           - 抛出 MappingConflictError
           - 错误码 = "ERR_MAPPING_CONFLICT"
           - conflict_fields = ["asset_id"]
    """

def test_mapping_cache_hit_performance():
    """
    物理测试：缓存命中性能验证
    ---
    Input:  相同映射配置重复调用 1000 次
    Expect: 
           - 第 2-1000 次调用平均响应时间 < 1ms
           - 缓存命中日志: "Cache hit for mapping config"
    """
```

### 4.3 ATB-3: 批量验证测试

```python
# tests/test_batch_validation.py::TestBatchValidator

def test_exceed_max_records_returns_422():
    """
    物理测试：导入记录超 5000 条
    ---
    Input:  DataFrame 包含 5001 条记录
    Expect: 
           - HTTP 422
           - detail = "Batch size exceeds maximum of 5000 records"
           - error_code = "ERR_BATCH_SIZE_EXCEEDED"
    """

def test_valid_records_pass_validation():
    """
    物理测试：所有字段合法的 100 条记录通过验证
    ---
    Input:  100 条符合所有约束的记录
           - asset_id: 唯一 10 位字符串
           - asset_name: 2-100 字符
           - retirement_type: 枚举值 [TRANSFER, DISPOSE, RECYCLE, STORAGE]
           - retirement_reason: 10-500 字符
    Expect: 
           - 返回 ValidationResult(passed=100, failed=0)
           - 无警告或错误
    """

def test_partial_failure_reports_errors():
    """
    物理测试：部分记录验证失败
    ---
    Input:  100 条记录，其中:
           - 第 3 行: asset_id 重复 (A001)
           - 第 7 行: asset_name 为空
           - 第 15 行: retirement_type 无效值 "INVALID"
    Expect: 
           - 返回 ValidationResult(
               passed=97,
               failed=3,
               errors=[
                   {row: 3, field: "asset_id", reason: "Duplicate value A001"},
                   {row: 7, field: "asset_name", reason: "Field cannot be empty"},
                   {row: 15, field: "retirement_type", reason: "Invalid enum value"}
               ]
             )
    """

def test_asset_id_format_validation():
    """
    物理测试：资产编号格式验证
    ---
    Input:  asset_id 字段值:
           - "A123456789" (10位，正常)
           - "A1" (过短)
           - "A1234567890" (11位，过长)
           - "A123-456-78" (含特殊字符)
    Expect: 
           - 正常值通过
           - 过短值失败，reason: "asset_id must be 10 characters"
           - 过长值失败，reason: "asset_id must not exceed 10 characters"
           - 含特殊字符失败，reason: "asset_id must be alphanumeric"
    """
```

### 4.4 ATB-4: 错误回显测试

```python
# tests/test_import_error.py::TestImportErrorService

def test_error_report_generates_excel_with_failed_rows():
    """
    物理测试：错误回显生成 Excel 文件
    ---
    Input:  导入任务结果:
           - 成功记录: 95 条
           - 失败记录: 5 条 (行号 3, 7, 15, 22, 33)
    Expect: 
           - 生成 result.xlsx 文件
           - 包含原始数据 + 错误标注列
           - 失败行 Status 列标记为 "ERROR"
           - 失败行 Error_Reason 列包含具体错误信息
    """

def test_error_detail_includes_field_and_reason():
    """
    物理测试：错误详情包含字段名和原因
    ---
    Input:  第 3 行 asset_id="ASSET-001" 重复
    Expect: 
           - 错误对象结构:
             {
                 row: 3,
                 field: "asset_id",
                 value: "ASSET-001",
                 reason: "Duplicate asset_id in batch",
                 error_code: "ERR_DUPLICATE_ASSET_ID"
             }
    """

def test_error_report_download_url_expiration():
    """
    物理测试：错误报告 URL 有效期验证
    ---
    Input:  生成错误报告后等待 31 分钟
    Expect: 
           - 30 分钟内: HTTP 200，文件正常下载
           - 30 分钟后: HTTP 410 Gone，错误码 "ERR_REPORT_EXPIRED"
    """
```

### 4.5 ATB-5: 批量导出测试

```python
# tests/test_batch_export.py::TestAssetExportService

def test_export_generates_valid_xlsx():
    """
    物理测试：导出生成可用 Excel
    ---
    Input:  查询条件:
           - status = RETIRED
           - limit = 1000
           - fields = [asset_id, asset_name, retirement_type, retirement_date]
    Expect: 
           - HTTP 200
           - Content-Type = application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
           - 生成 xlsx 文件可通过 openpyxl 正常打开
           - 表头行与指定 fields 一致
           - 数据行数 = min(1000, 数据库实际记录数)
    """

def test_export_exceeds_timeout_handled():
    """
    物理测试：大数据量导出超时处理
    ---
    Input:  查询条件导致 15000 条记录
           模拟: 数据库查询耗时 65 秒
    Expect: 
           - HTTP 504 Gateway Timeout
           - 响应包含 {"error": "ERR_EXPORT_TIMEOUT", "retry_after": 30}
           - 用户可重试导出
    """

def test_export_pagination_for_large_dataset():
    """
    物理测试：超 10000 条自动分页
    ---
    Input:  数据库包含 15000 条符合条件记录
    Expect: 
           - 返回导出任务 ID (非直接文件)
           - 生成 page1.xlsx (5000 条)
           - 生成 page2.xlsx (5000 条)
           - 生成 page3.xlsx (5000 条)
           - 响应包含 download_urls = [url1, url2, url3]
    """

def test_export_empty_result_handled():
    """
    物理测试：无数据导出场景
    ---
    Input:  查询条件无匹配记录
    Expect: 
           - HTTP 200
           - 生成空 xlsx 文件（仅表头行）
           - detail = "No records match the query criteria"
    """
```

### 4.6 ATB-6: API 集成测试

```python
# tests/test_api_integration.py::TestBatchOperationsAPI

def test_import_endpoint_accepts_multipart_form():
    """
    物理测试：POST /api/v1/assets/batch/import
    ---
    Input:  multipart/form-data
           - file: [upload] assets_import.xlsx
           - mapping_config: {"资产编号": "asset_id", ...} (JSON string)
           - callback_url: "https://example.com/webhook/import"
    Expect: 
           - HTTP 202 Accepted
           - 响应: {
               task_id: "import_20240115_abc123",
               status: "PROCESSING",
               estimated_completion: "2024-01-15T10:05:00Z"
             }
    """

def test_export_endpoint_returns_stream():
    """
    物理测试：GET /api/v1/assets/batch/export
    ---
    Input:  query params:
           - status = ACTIVE
           - department = IT
           - start_date = 2024-01-01
           - end_date = 2024-01-15
    Expect: 
           - HTTP 200 OK
           - Content-Disposition: attachment; filename="asset_export_20240115.xlsx"
           - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
           - Transfer-Encoding: chunked
    """

def test_template_download_endpoint():
    """
    物理测试：GET /api/v1/assets/batch/template
    ---
    Input:  query param: template_type = "retirement_import"
    Expect: 
           - HTTP 200 OK
           - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
           - 文件包含预定义表头行
    """
```

### 4.7 ATB-7: 性能基准测试

```python
# tests/test_performance.py::TestBatchPerformance

def test_import_1000_records_completes_under_10s():
    """
    物理测试：1000 条记录导入性能
    ---
    Test Setup:
           - 准备 1000 条符合规范的测试数据
           - Mock 数据库响应时间 < 100ms
    Benchmark:
           - 总耗时 ≤ 10 秒（不含网络传输）
           - 解析: ≤ 2s
           - 映射: ≤ 1s
           - 验证: ≤ 2s
           - 写入: ≤ 5s
    """

def test_export_5000_records_completes_under_30s():
    """
    物理测试：5000 条记录导出性能
    ---
    Test Setup:
           - Mock 5000 条数据库记录
           - Mock 查询响应时间 < 200ms
    Benchmark:
           - 总耗时 ≤ 30 秒
           - 查询: ≤ 5s
           - 生成: ≤ 20s
           - 压缩/传输: ≤ 5s
    """

def test_concurrent_import_limit_enforced():
    """
    物理测试：并发导入限制
    ---
    Input:  3 个并发导入请求（每请求 100 条记录）
    Expect: 
           - 前 3 个请求: HTTP 202 Accepted
           - 第 4 个并发请求: HTTP 429 Too Many Requests
           - 响应包含 retry_after 建议
    """
```

---

## 5. 开发切入层级序列

### 5.1 Layer 0: 基础设施层（优先级：P0）

```
src/
├── models/
│   ├── __init__.py
│   ├── batch_import_request.py      # 批量导入请求模型
│   ├── batch_import_result.py       # 导入结果模型（成功/失败统计）
│   ├── batch_export_request.py      # 导出请求模型
│   ├── import_error_detail.py       # 错误详情模型
│   └── export_task.py               # 导出任务模型
├── utils/
│   ├── __init__.py
│   ├── excel_parser.py              # Excel 解析工具（封装 openpyxl）
│   ├── excel_generator.py           # Excel 生成工具
│   └── file_validator.py            # 文件类型/大小验证工具
```

**实现顺序**：
1. `excel_parser.py` - 依赖 openpyxl，需优先实现
2. `file_validator.py` - 独立工具类
3. `excel_generator.py` - 依赖 openpyxl
4. 数据模型类 - 依赖 utils

### 5.2 Layer 1: 核心服务层（优先级：P0）

```
src/
├── services/
│   ├── __init__.py
│   ├── field_mapping_engine.py      # 字段映射引擎
│   ├── batch_validator.py           # 批量验证器
│   ├── asset_import_service.py      # 导入服务（编排层）
│   ├── asset_export_service.py      # 导出服务
│   └── import_error_service.py      # 错误回显服务
├── validators/
│   ├── __init__.py
│   ├── field_validators.py          # 字段级验证规则
│   └── record_validators.py         # 记录级验证规则
```

**实现顺序**：
1. `field_mapping_engine.py` - 映射核心逻辑
2. `field_validators.py` / `record_validators.py` - 验证规则
3. `batch_validator.py` - 验证编排
4. `import_error_service.py` - 错误处理
5. `asset_import_service.py` - 导入服务编排
6. `asset_export_service.py` - 导出服务

### 5.3 Layer 2: 持久化层（优先级：P1）

```
src/
├── repositories/
│   ├── __init__.py
│   ├── batch_import_repository.py   # 批量导入记录持久化
│   └── export_task_repository.py    # 导出任务持久化
```

**实现顺序**：
1. `batch_import_repository.py` - 导入任务状态存储
2. `export_task_repository.py` - 导出任务状态存储

### 5.4 Layer 3: API 层（优先级：P1）

```python
# src/main.py 新增端点（L850-L930）

# === 批量导入 API ===
@app.post("/api/v1/assets/batch/import", status_code=status.HTTP_202_ACCEPTED)
async def create_batch_import(
    file: UploadFile = File(...),
    mapping_config: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = None
) -> BatchImportResponse:
    """批量导入资产数据"""
    # 位置: L860

@app.get("/api/v1/assets/batch/import/{task_id}")
async def get_import_task_status(task_id: str) -> ImportTaskStatus:
    """获取导入任务状态"""
    # 位置: L875

@app.get("/api/v1/assets/batch/import/{task_id}/errors")
async def download_import_errors(task_id: str) -> FileResponse:
    """下载导入错误报告"""
    # 位置: L890

# === 批量导出 API ===
@app.get("/api/v1/assets/batch/export")
async def export_assets(
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    fields: Optional[str] = Query(None)
) -> Union[FileResponse, ExportTaskResponse]:
    """导出资产清单"""
    # 位置: L905

@app.get("/api/v1/assets/batch/export/{task_id}")
async def get_export_task_status(task_id: str) -> ExportTaskStatus:
    """获取导出任务状态"""
    # 位置: L920

@app.get("/api/v1/assets/batch/template")
async def download_import_template(
    template_type: str = Query("retirement_import")
) -> FileResponse:
    """下载导入模板"""
    # 位置: L935
```

### 5.5 依赖注入顺序图

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer (Layer 3)                      │
│  POST /batch/import → AssetImportService                        │
│  GET  /batch/export → AssetExportService                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Service Layer (Layer 1)                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ FieldMappingEngine│  │ BatchValidator   │  │ExportService   │ │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬────────┘ │
│           │                     │                     │         │
│           └────────────┬────────┴─────────────┬───────┘         │
│                        ▼                      ▼                 │
│              ┌──────────────────┐    ┌──────────────────┐         │
│              │ImportErrorService│    │ImportExportShared│         │
│              └──────────────────┘    └──────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Repository Layer (Layer 2)                   │
│  BatchImportRepository │ ExportTaskRepository                   │
│         ↓                            ↓                          │
│  RetirementRepository (复用 L391)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Utils Layer (Layer 0)                         │
│  ExcelParser │ ExcelGenerator │ FileValidator                   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.6 测试执行顺序

```bash
# 1. Layer 0 测试（单元测试）
pytest tests/utils/test_excel_parser.py -v
pytest tests/utils/test_file_validator.py -v

# 2. Layer 1 单元测试
pytest tests/services/test_field_mapping_engine.py -v
pytest tests/validators/test_field_validators.py -v
pytest tests/services/test_batch_validator.py -v
pytest tests/services/test_import_service.py -v
pytest tests/services/test_export_service.py -v

# 3. Layer 2 测试
pytest tests/repositories/test_batch_import_repository.py -v

# 4. Layer 3 集成测试
pytest tests/api/test_batch_operations.py -v

# 5. ATB 验收测试（按文档顺序执行）
pytest tests/test_batch_import.py -v          # ATB-1
pytest tests/test_field_mapping.py -v         # ATB-2
pytest tests/test_batch_validation.py -v       # ATB-3
pytest tests/test_import_error.py -v          # ATB-4
pytest tests/test_batch_export.py -v          # ATB-5
pytest tests/test_api_integration.py -v       # ATB-6

# 6. 性能基准测试
pytest tests/test_performance.py -v           # ATB-7
```

---

## 附录 A: 数据模型定义

### A.1 BatchImportRequest

```python
class BatchImportRequest(BaseModel):
    """批量导入请求"""
    file_name: str                          # 文件名
    file_size: int                         # 文件大小(bytes)
    mapping_config: Dict[str, str]         # 字段映射配置
    callback_url: Optional[str] = None     # 回调通知URL
    user_id: str                            # 操作用户ID
```

### A.2 BatchImportResult

```python
class BatchImportResult(BaseModel):
    """批量导入结果"""
    task_id: str                            # 任务ID
    status: ImportStatus                    # PENDING/PROCESSING/SUCCESS/FAILED/PARTIAL
    total_records: int                      # 总记录数
    success_count: int                      # 成功记录数
    failed_count: int                       # 失败记录数
    errors: List[ImportErrorDetail]         # 错误详情列表
    started_at: datetime                    # 开始时间
    completed_at: Optional[datetime] = None # 完成时间
    error_report_url: Optional[str] = None  # 错误报告下载URL
```

### A.3 ImportErrorDetail

```python
class ImportErrorDetail(BaseModel):
    """导入错误详情"""
    row_number: int                         # 行号
    field: str                              # 字段名
    value: Any                              # 实际值
    reason: str                             # 错误原因
    error_code: str                         # 错误码
```

---

## 附录 B: 枚举扩展

```python
# src/models/enums.py 新增

class ImportStatus(str, Enum):
    """导入任务状态"""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"  # 部分成功

class ExportStatus(str, Enum):
    """导出任务状态"""
    PENDING = "PENDING"
    GENERATING = "GENERATING"
    READY = "READY"
    EXPIRED = "EXPIRED"
    FAILED = "FAILED"

class ImportErrorCode(str, Enum):
    """导入错误码"""
    FILE_TOO_LARGE = "ERR_FILE_TOO_LARGE"
    INVALID_FORMAT = "ERR_INVALID_FORMAT"
    PARSE_FAILED = "ERR_EXCEL_PARSE_FAILED"
    MAPPING_CONFLICT = "ERR_MAPPING_CONFLICT"
    BATCH_SIZE_EXCEEDED = "ERR_BATCH_SIZE_EXCEEDED"
    VALIDATION_FAILED = "ERR_VALIDATION_FAILED"
    DUPLICATE_ASSET_ID = "ERR_DUPLICATE_ASSET_ID"
    MISSING_REQUIRED_FIELD = "ERR_MISSING_REQUIRED_FIELD"
    INVALID_FIELD_VALUE = "ERR_INVALID_FIELD_VALUE"
    DATABASE_ERROR = "ERR_DATABASE_ERROR"

class ExportErrorCode(str, Enum):
    """导出错误码"""
    EXPORT_TIMEOUT = "ERR_EXPORT_TIMEOUT"
    REPORT_EXPIRED = "ERR_REPORT_EXPIRED"
    TOO_MANY_REQUESTS = "ERR_TOO_MANY_REQUESTS"
    NO_DATA_FOUND = "ERR_NO_DATA_FOUND"
    GENERATION_FAILED = "ERR_GENERATION_FAILED"
```

---

## 附录 C: API 响应示例

### C.1 导入成功响应

```json
{
  "task_id": "import_20240115_abc123",
  "status": "SUCCESS",
  "total_records": 100,
  "success_count": 100,
  "failed_count": 0,
  "errors": [],
  "started_at": "2024-01-15T10:00:00Z",
  "completed_at": "2024-01-15T10:00:08Z"
}
```

### C.2 部分成功响应

```json
{
  "task_id": "import_20240115_def456",
  "status": "PARTIAL",
  "total_records": 100,
  "success_count": 95,
  "failed_count": 5,
  "errors": [
    {"row_number": 3, "field": "asset_id", "value": "A001", "reason": "Duplicate in batch", "error_code": "ERR_DUPLICATE_ASSET_ID"},
    {"row_number": 7, "field": "asset_name", "value": "", "reason": "Field cannot be empty", "error_code": "ERR_MISSING_REQUIRED_FIELD"}
  ],
  "error_report_url": "/api/v1/assets/batch/import/def456/errors",
  "started_at": "2024-01-15T10:00:00Z",
  "completed_at": "2024-01-15T10:00:05Z"
}
```

### C.3 导出任务响应

```json
{
  "task_id": "export_20240115_ghi789",
  "status": "GENERATING",
  "estimated_completion": "2024-01-15T10:01:30Z",
  "record_count": 15000,
  "page_count": 3,
  "download_urls": []
}
```

---

**文档版本**: v1.0  
**创建日期**: 2024-01-15  
**状态**: 待评审