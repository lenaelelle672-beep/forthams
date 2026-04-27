# SWARM-002 资产批量导入导出 规格指导文档

## 版本信息

| 字段 | 内容 |
|------|------|
| 任务编号 | SWARM-002 |
| 功能名称 | 资产批量导入导出 |
| 迭代版本 | Iteration 1 |
| 文档状态 | 正式版 |

---

## 1. 需求与背景

### 1.1 业务需求

资产管理系统需支持批量操作场景，以提升管理员效率，减少重复性手动录入工作。

**核心需求：**

| 需求项 | 描述 | 优先级 |
|--------|------|--------|
| 批量导入 | 支持通过 Excel/CSV 文件批量创建资产记录 | P0 |
| 批量导出 | 支持将现有资产列表导出为 Excel/CSV 文件 | P0 |
| 数据校验 | 导入时需校验数据合法性并提供错误报告 | P1 |
| 模板下载 | 提供标准导入模板供用户下载 | P1 |

### 1.2 使用场景

- **场景 A**：系统初始化时，从旧系统迁移资产数据
- **场景 B**：资产盘点后，批量更新资产状态信息
- **场景 C**：财务审计时，导出资产报表

### 1.3 既有支撑

| 组件 | 路径 | 说明 |
|------|------|------|
| FieldMappingEngine | `src/services/field_mapping_engine.py` | 已实现字段映射与缓存逻辑 |
| ExcelParser | `src/utils/excel_parser.py` | 已实现 Excel 文件解析 |
| ExcelGenerator | `src/utils/excel_generator.py` | 已实现 Excel 文件生成 |
| BatchImportRequest | `src/models/BatchImportRequest.py` | 已实现批量导入请求模型 |

---

## 2. 当前 Phase 对应实施目标

### 2.1 Phase 拆解对照

| Phase | 阶段名称 | 范围界定 |
|-------|----------|----------|
| Phase 1 | 核心导入导出 | 基础文件上传/下载、单表资产批量操作 |
| Phase 2 | 校验增强 | 数据格式校验、错误行报告、模板管理 |
| Phase 3 | 高级特性 | 增量导入、导入日志、异步任务 |

### 2.2 本次 Iteration 目标（Phase 1）

本次 Iteration 1 聚焦 **Phase 1**，交付以下可测试成果：

```
┌─────────────────────────────────────────────────┐
│  Iteration 1 交付范围                            │
├─────────────────────────────────────────────────┤
│  ✓ 文件上传 API（支持 xlsx, csv）                │
│  ✓ 资产批量插入逻辑                              │
│  ✓ 资产列表导出 API（支持 xlsx, csv）            │
│  ✓ 基础错误处理（文件格式错误、空文件等）         │
└─────────────────────────────────────────────────┘
```

### 2.3 非本次范围（Phase 2/3 预埋点）

- 数据行级别校验及错误报告
- 导入模板管理接口
- 异步导入任务及进度查询
- 增量导入策略

---

## 3. 边界约束

### 3.1 技术约束

| 约束项 | 具体限制 | 说明 |
|--------|----------|------|
| 支持格式 | `.xlsx`, `.csv` | 仅限这两种文件格式 |
| 单次文件大小 | ≤ 10 MB | 超出则拒绝并返回错误码 |
| 单次导入行数 | ≤ 5000 行 | 超出则拒绝，超出限制应提示分段处理 |
| 字符编码 | UTF-8 | CSV 必须为 UTF-8 编码 |
| 超时限制 | 请求超时 120s | 超出则返回 504 |

### 3.2 数据模型约束

**资产表（assets）字段定义：**

| 字段名 | 类型 | 必填 | 导入映射 | 导出包含 |
|--------|------|------|----------|----------|
| asset_id | VARCHAR(64) | 是 | ✅ | ✅ |
| asset_name | VARCHAR(255) | 是 | ✅ | ✅ |
| asset_type | ENUM | 是 | ✅ | ✅ |
| purchase_date | DATE | 否 | ✅ | ✅ |
| purchase_price | DECIMAL(12,2) | 否 | ✅ | ✅ |
| status | ENUM | 是 | ✅ | ✅ |
| department | VARCHAR(128) | 否 | ✅ | ✅ |
| remarks | TEXT | 否 | ✅ | ✅ |
| created_at | DATETIME | 系统生成 | ❌ | ✅ |
| updated_at | DATETIME | 系统生成 | ❌ | ✅ |

### 3.3 业务约束

| 约束项 | 规则 |
|--------|------|
| 重复导入 | `asset_id` 冲突时，导入失败并报告冲突记录 |
| 字段映射 | 导入文件表头必须与模板表头精确匹配 |
| 导出范围 | 默认导出当前筛选条件下的全部资产（支持分页导出） |
| 权限控制 | 仅 `role=ADMIN` 或 `role=ASSET_MANAGER` 可执行导入导出 |

### 3.4 API 端点约束

| 操作 | HTTP Method | Endpoint | 认证要求 |
|------|-------------|----------|----------|
| 上传导入 | POST | `/api/v1/assets/import` | JWT Bearer |
| 下载导出 | POST | `/api/v1/assets/export` | JWT Bearer |
| 下载模板 | GET | `/api/v1/assets/import/template` | JWT Bearer |

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试（pytest）

#### 4.1.1 文件解析层测试

```python
# tests/unit/test_file_parser.py

class TestFileParser:
    """文件解析器单元测试"""
    
    def test_parse_valid_xlsx(self):
        """ATB-001: 合法 xlsx 文件应正确解析返回数据列表"""
        # Arrange: 准备符合模板的 test_asset_valid.xlsx
        # Act: 调用 parser.parse(file_path)
        # Assert: 返回 list，长度=数据行数，每行 dict 包含必要字段
        
    def test_parse_valid_csv(self):
        """ATB-002: 合法 CSV 文件应正确解析"""
        # Arrange: 准备 test_asset_valid.csv (UTF-8 编码)
        # Act: 调用 parser.parse()
        # Assert: 返回与 xlsx 解析相同的结果
        
    def test_parse_unsupported_format(self):
        """ATB-003: 不支持格式应抛出 UnsupportedFormatError"""
        # Arrange: 准备 .txt 文件
        # Act/Assert: parser.parse() 应抛出 UnsupportedFormatError
        
    def test_parse_corrupted_file(self):
        """ATB-004: 损坏文件应抛出 FileParseError"""
        # Arrange: 准备内容损坏的 xlsx
        # Act/Assert: parser.parse() 应抛出 FileParseError
        
    def test_parse_empty_file(self):
        """ATB-005: 空文件应抛出 EmptyFileError"""
        # Arrange: 准备行数为 0 的文件
        # Act/Assert: parser.parse() 应抛出 EmptyFileError
```

#### 4.1.2 数据校验层测试

```python
# tests/unit/test_asset_validator.py

class TestAssetValidator:
    """资产数据校验单元测试"""
    
    def test_validate_required_fields_present(self):
        """ATB-006: 必填字段齐全应通过校验"""
        # Arrange: 包含 asset_id, asset_name, asset_type, status 的数据
        # Act: validator.validate(data)
        # Assert: 返回 valid=True, errors=[]
        
    def test_validate_missing_required_field(self):
        """ATB-007: 缺少必填字段应返回错误"""
        # Arrange: 缺少 asset_id
        # Act/Assert: valid=False, errors 包含 "asset_id is required"
        
    def test_validate_enum_field_invalid_value(self):
        """ATB-008: ENUM 字段值不合法应返回错误"""
        # Arrange: asset_type="INVALID_TYPE"
        # Act/Assert: valid=False, errors 包含 "asset_type invalid"
        
    def test_validate_date_format_invalid(self):
        """ATB-009: 日期格式错误应返回错误"""
        # Arrange: purchase_date="2024-13-45"
        # Act/Assert: valid=False, errors 包含 "date format invalid"
        
    def test_validate_price_not_numeric(self):
        """ATB-010: 价格字段非数字应返回错误"""
        # Arrange: purchase_price="abc"
        # Act/Assert: valid=False, errors 包含 "price must be numeric"
```

#### 4.1.3 导入服务层测试

```python
# tests/unit/test_asset_import_service.py

class TestAssetImportService:
    """资产导入服务单元测试"""
    
    def test_import_creates_assets(self):
        """ATB-011: 导入成功应创建对应数量的资产记录"""
        # Arrange: 准备 100 条合法数据
        # Act: service.import_assets(data_list)
        # Assert: DB 中新增 100 条记录
        
    def test_import_duplicate_asset_id(self):
        """ATB-012: 重复 asset_id 应回滚并返回错误"""
        # Arrange: 数据包含已存在的 asset_id
        # Act/Assert: 抛出 DuplicateAssetIdError, DB 无新增记录
        
    def test_import_partial_failure(self):
        """ATB-013: 部分失败应回滚全部"""
        # Arrange: 数据中第 50 条非法
        # Act/Assert: 抛出 ValidationError, DB 无任何新增
        
    def test_import_exceeds_row_limit(self):
        """ATB-014: 超出 5000 行应拒绝"""
        # Arrange: 准备 5001 条数据
        # Act/Assert: 抛出 RowLimitExceededError
```

#### 4.1.4 导出服务层测试

```python
# tests/unit/test_asset_export_service.py

class TestAssetExportService:
    """资产导出服务单元测试"""
    
    def test_export_returns_xlsx_bytes(self):
        """ATB-015: xlsx 导出应返回二进制流"""
        # Act: service.export_assets(format="xlsx")
        # Assert: 返回 ApplicationResponse, content_type="application/vnd.openxmlformats..."
        
    def test_export_returns_csv_bytes(self):
        """ATB-016: csv 导出应返回 UTF-8 二进制流"""
        # Act: service.export_assets(format="csv")
        # Assert: 返回 ApplicationResponse, content_type="text/csv"
        
    def test_export_includes_all_columns(self):
        """ATB-017: 导出文件应包含所有定义字段"""
        # Arrange: 存在包含所有字段的资产
        # Act: service.export_assets()
        # Assert: 解析导出的 xlsx/csv，包含全部 9 个字段
        
    def test_export_empty_result(self):
        """ATB-018: 无数据时应导出仅含表头的空文件"""
        # Arrange: DB 中无资产
        # Act: service.export_assets()
        # Assert: 文件仅含表头，无数据行
```

### 4.2 集成测试（Playwright）

#### 4.2.1 API 端点集成测试

```python
# tests/integration/test_asset_bulk_api.py

class TestAssetBulkImportExportAPI:
    """资产批量导入导出 API 集成测试"""
    
    @pytest.mark.asyncio
    async def test_import_api_success(self, authenticated_client):
        """ATB-019: POST /api/v1/assets/import 合法请求返回 201"""
        # Arrange: authenticated_client 携带 admin token
        #          multipart/form-data 包含 test_file.xlsx
        # Act: POST /api/v1/assets/import
        # Assert: status=201, body={"created": 100, "failed": 0}
        
    @pytest.mark.asyncio
    async def test_import_api_unauthorized(self):
        """ATB-020: 未认证请求应返回 401"""
        # Act: POST /api/v1/assets/import (无 token)
        # Assert: status=401
        
    @pytest.mark.asyncio
    async def test_import_api_file_too_large(self, authenticated_client):
        """ATB-021: 文件超 10MB 应返回 413"""
        # Arrange: 构造 11MB 文件
        # Act/Assert: status=413, body.code="FILE_TOO_LARGE"
        
    @pytest.mark.asyncio
    async def test_export_api_success(self, authenticated_client):
        """ATB-022: POST /api/v1/assets/export 应返回 200"""
        # Act: POST /api/v1/assets/export, body={"format": "xlsx"}
        # Assert: status=200, content-type 匹配格式
        
    @pytest.mark.asyncio
    async def test_export_api_csv_format(self, authenticated_client):
        """ATB-023: 指定 csv 格式应返回正确 content-type"""
        # Act: POST /api/v1/assets/export, body={"format": "csv"}
        # Assert: status=200, content-type="text/csv; charset=utf-8"
        
    @pytest.mark.asyncio
    async def test_template_download_api(self, authenticated_client):
        """ATB-024: GET /api/v1/assets/import/template 应返回模板文件"""
        # Act: GET /api/v1/assets/import/template?format=xlsx
        # Assert: status=200, content-type 正确, 文件可被 openpyxl 加载
```

#### 4.2.2 E2E 场景测试

```python
# tests/e2e/test_asset_bulk_workflow.py

class TestAssetBulkWorkflowE2E:
    """资产批量操作端到端测试"""
    
    @pytest.mark.asyncio
    async def test_full_import_export_cycle(self, browser):
        """ATB-025: 导入后导出应包含导入数据"""
        # Arrange: 登录 admin, 准备 50 条测试数据
        # Step 1: POST /api/v1/assets/import 上传
        # Step 2: 等待 201 响应
        # Step 3: POST /api/v1/assets/export 导出
        # Step 4: 解析导出文件
        # Assert: 导出数据包含导入的 50 条，且数据一致
        
    @pytest.mark.asyncio
    async def test_invalid_import_shows_error(self, browser):
        """ATB-026: 导入非法文件应在前端显示错误"""
        # Arrange: 登录 admin
        # Step 1: 上传包含非法数据的 test_invalid.xlsx
        # Step 2: 页面点击导入按钮
        # Assert: 前端显示错误提示区域，包含错误摘要
```

### 4.3 测试覆盖率要求

| 层级 | 覆盖率目标 |
|------|------------|
| 文件解析层 (parser) | ≥ 90% 行覆盖率 |
| 校验层 (validator) | ≥ 85% 行覆盖率 |
| 导入服务层 | ≥ 80% 行覆盖率 |
| 导出服务层 | ≥ 80% 行覆盖率 |
| API 路由层 | 关键路径 100% 覆盖 |

---

## 5. 开发切入层级序列

### 5.1 层级依赖图

```
┌──────────────────────────────────────────────────────────┐
│                      Layer 5: 前端 UI                     │
│            (上传按钮、进度条、错误展示)                      │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTP API
┌──────────────────────────▼───────────────────────────────┐
│                      Layer 4: API 路由层                  │
│      POST /import    POST /export    GET /template       │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                    Layer 3: 业务服务层                     │
│         AssetImportService    AssetExportService         │
│              (事务控制、错误聚合)                          │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                   Layer 2: 数据校验层                     │
│                    AssetValidator                        │
│              (字段类型、必填、格式校验)                     │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                   Layer 1: 文件解析层                     │
│                      FileParser                           │
│             (xlsx/csv 读取、表头提取、行映射)               │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                   Layer 0: 数据模型层                     │
│              Asset Model / DB Schema                      │
└──────────────────────────────────────────────────────────┘
```

### 5.2 开发任务序列

| 顺序 | 层级 | 任务卡片 | 预计工时 | 依赖前置 |
|------|------|----------|----------|----------|
| 1 | Layer 0 | 确认/创建 Asset 数据模型迁移 | 0.5d | 无 |
| 2 | Layer 0 | 创建资产相关 Enum 类型定义 | 0.25d | 任务 1 |
| 3 | Layer 1 | 扩展 ExcelParser 支持资产导入格式 | 1d | 任务 2 |
| 4 | Layer 1 | 扩展 ExcelGenerator 支持资产导出格式 | 0.5d | 任务 3 |
| 5 | Layer 2 | 扩展 AssetValidator 必填校验 | 0.5d | 任务 2 |
| 6 | Layer 2 | 扩展 AssetValidator 类型/格式校验 | 1d | 任务 5 |
| 7 | Layer 3 | 实现 AssetImportService（事务控制） | 1d | 任务 6 |
| 8 | Layer 3 | 实现 AssetExportService | 1d | 任务 7 |
| 9 | Layer 4 | 实现 API 路由（import/export/template） | 1d | 任务 8 |
| 10 | Layer 4 | 实现文件大小/格式中间件校验 | 0.5d | 任务 9 |
| 11 | Layer 5 | 前端导入页面组件开发 | 1.5d | 任务 9 |
| 12 | Layer 5 | 前端导出页面组件开发 | 1d | 任务 9 |
| 13 | - | 单元测试编写（Layer 1-3） | 2d | 任务 8 |
| 14 | - | 集成测试编写 | 1d | 任务 9 |
| 15 | - | 测试报告与验收 | 0.5d | 任务 13-14 |

### 5.3 既有组件扩展点

| 组件 | 路径 | 扩展方式 |
|------|------|----------|
| ExcelParser | `src/utils/excel_parser.py` | 扩展 parse() 方法支持资产表头映射 |
| ExcelGenerator | `src/utils/excel_generator.py` | 扩展 generate() 方法支持资产字段 |
| FieldMappingEngine | `src/services/field_mapping_engine.py` | 复用 apply_mapping() 处理 Excel→模型映射 |
| BatchImportRequest | `src/models/BatchImportRequest.py` | 扩展字段定义支持资产导入请求 |

### 5.4 关键代码接口预定义

#### 5.4.1 FileParser 接口

```python
# src/utils/excel_parser.py (扩展点)
from abc import ABC, abstractmethod
from typing import List, Dict, Any
from dataclasses import dataclass

@dataclass
class ParseResult:
    headers: List[str]
    rows: List[Dict[str, Any]]
    total_rows: int

class AssetExcelParser:
    """资产 Excel/CSV 解析器"""
    
    def parse(self, file_path: str) -> ParseResult:
        """
        解析资产导入文件
        
        Args:
            file_path: 文件路径
            
        Returns:
            ParseResult: 包含表头和数据行的解析结果
            
        Raises:
            UnsupportedFormatError: 不支持的文件格式
            FileParseError: 文件解析失败
            EmptyFileError: 文件为空
        """
        pass
    
    def supports_format(self, extension: str) -> bool:
        """
        判断是否支持该文件格式
        
        Args:
            extension: 文件扩展名 (如 'xlsx', 'csv')
            
        Returns:
            bool: 是否支持
        """
        pass
```

#### 5.4.2 AssetValidator 接口

```python
# src/services/validators/asset_validator.py (新建)
from dataclasses import dataclass, field
from typing import List, Dict, Any
from enum import Enum

class AssetTypeEnum(str, Enum):
    """资产类型枚举"""
    DEVICE = "DEVICE"
    FURNITURE = "FURNITURE"
    VEHICLE = "VEHICLE"
    SOFTWARE = "SOFTWARE"
    OTHER = "OTHER"

class AssetStatusEnum(str, Enum):
    """资产状态枚举"""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SCRAPPED = "SCRAPPED"
    TRANSFERRED = "TRANSFERRED"

@dataclass
class ValidationResult:
    """校验结果"""
    is_valid: bool
    errors: List[str] = field(default_factory=list)
    row_index: int = 0

class AssetValidator:
    """资产数据校验器"""
    
    def validate(self, data: Dict[str, Any]) -> ValidationResult:
        """
        校验单条资产数据
        
        Args:
            data: 资产数据字典
            
        Returns:
            ValidationResult: 校验结果
        """
        pass
    
    def validate_batch(self, data_list: List[Dict[str, Any]]) -> List[ValidationResult]:
        """
        批量校验资产数据
        
        Args:
            data_list: 资产数据列表
            
        Returns:
            List[ValidationResult]: 每条数据的校验结果列表
        """
        pass
```

#### 5.4.3 ImportService 接口

```python
# src/services/import_service.py (新建)
from typing import BinaryIO, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum

class ExportFormatEnum(str, Enum):
    """导出格式枚举"""
    XLSX = "xlsx"
    CSV = "csv"

@dataclass
class ImportResult:
    """导入结果"""
    success: bool
    created: int = 0
    failed: int = 0
    errors: List[Dict[str, Any]] = field(default_factory=list)

class AssetImportService:
    """资产导入服务"""
    
    def import_from_file(self, file_content: BinaryIO, filename: str) -> ImportResult:
        """
        从文件内容导入资产
        
        Args:
            file_content: 文件二进制内容
            filename: 文件名
            
        Returns:
            ImportResult: 导入结果，包含成功/失败数量
            
        Raises:
            UnsupportedFormatError: 不支持的格式
            FileTooLargeError: 文件超出大小限制
            RowLimitExceededError: 行数超出限制
            ValidationError: 数据校验失败
        """
        pass

class AssetExportService:
    """资产导出服务"""
    
    def export_assets(
        self,
        filters: Dict[str, Any] = None,
        format: ExportFormatEnum = ExportFormatEnum.XLSX
    ) -> bytes:
        """
        导出资产为指定格式的字节流
        
        Args:
            filters: 导出筛选条件
            format: 导出格式 (xlsx 或 csv)
            
        Returns:
            bytes: 文件二进制内容
        """
        pass
    
    def generate_template(self, format: ExportFormatEnum) -> bytes:
        """
        生成导入模板文件
        
        Args:
            format: 模板格式
            
        Returns:
            bytes: 模板文件二进制内容
        """
        pass
```

---

## 6. 附录

### 6.1 错误码定义

| 错误码 | 名称 | HTTP Status | 说明 |
|--------|------|-------------|------|
| `UNSUPPORTED_FORMAT` | 不支持的文件格式 | 400 | 仅接受 xlsx/csv |
| `FILE_TOO_LARGE` | 文件超出限制 | 413 | 文件 > 10MB |
| `ROW_LIMIT_EXCEEDED` | 行数超出限制 | 400 | 行数 > 5000 |
| `FILE_PARSE_ERROR` | 文件解析失败 | 400 | 文件损坏或格式错误 |
| `EMPTY_FILE` | 文件为空 | 400 | 无数据行 |
| `VALIDATION_ERROR` | 数据校验失败 | 400 | 含错误行（Phase 2） |
| `DUPLICATE_ASSET_ID` | 资产ID重复 | 409 | asset_id 已存在 |
| `UNAUTHORIZED` | 未认证 | 401 | token 无效或缺失 |
| `FORBIDDEN` | 无权限 | 403 | 角色不允许此操作 |

### 6.2 导入模板表头

```
asset_id,asset_name,asset_type,purchase_date,purchase_price,status,department,remarks
```

**字段说明：**

| 字段名 | 是否必填 | 可选值 | 格式示例 |
|--------|----------|--------|----------|
| asset_id | 是 | 用户自定义 | `AST-2024-00001` |
| asset_name | 是 | 用户自定义 | `Dell Laptop XPS 15` |
| asset_type | 是 | DEVICE, FURNITURE, VEHICLE, SOFTWARE, OTHER | `DEVICE` |
| purchase_date | 否 | - | `2024-01-15` |
| purchase_price | 否 | - | `8999.99` |
| status | 是 | ACTIVE, INACTIVE, SCRAPPED, TRANSFERRED | `ACTIVE` |
| department | 否 | 用户自定义 | `IT Department` |
| remarks | 否 | 用户自定义 | `采购自京东自营` |

### 6.3 修改文件清单

本次 Iteration 需修改的文件：

| 序号 | 文件路径 | 修改类型 | 说明 |
|------|----------|----------|------|
| 1 | `src/models/enums.py` | 扩展 | 添加 AssetTypeEnum, AssetStatusEnum |
| 2 | `src/models/BatchImportRequest.py` | 扩展 | 支持资产导入请求模型 |
| 3 | `src/utils/excel_parser.py` | 扩展 | 支持资产表头映射 |
| 4 | `src/utils/excel_generator.py` | 扩展 | 支持资产字段导出 |
| 5 | `src/services/field_mapping_engine.py` | 复用 | 处理 Excel→模型映射 |
| 6 | `src/api/deps/auth.py` | 检查 | 确保 UserRole 包含必要角色 |
| 7 | `src/api/middleware/audit_logger.py` | 检查 | 审计日志记录导入导出操作 |
| 8 | `src/main.py` | 扩展 | 注册新的路由和服务 |
| 9 | `tests/e2e/retirement_flow.spec.ts` | 新增测试 | E2E 测试用例 |

---

**文档结束**