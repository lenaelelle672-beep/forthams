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

**关联枚举定义（`src/models/enums.py`）：**

```python
class AssetType(str, Enum):
    """资产类型枚举"""
    DEVICE = "DEVICE"           # 电子设备
    FURNITURE = "FURNITURE"     # 办公家具
    VEHICLE = "VEHICLE"         # 交通工具
    SOFTWARE = "SOFTWARE"       # 软件许可
    OTHER = "OTHER"             # 其他

class AssetStatus(str, Enum):
    """资产状态枚举（定义于 src/api/deps/auth.py）"""
    ACTIVE = "ACTIVE"           # 使用中
    MAINTENANCE = "MAINTENANCE" # 维护中
    INACTIVE = "INACTIVE"       # 停用
    RETIRED = "RETIRED"         # 已退役
    SCRAPPED = "SCRAPPED"       # 已报废
    TRANSFERRED = "TRANSFERRED" # 已转移
```

### 3.3 业务约束

| 约束项 | 规则 |
|--------|------|
| 重复导入 | `asset_id` 冲突时，导入失败并报告冲突记录 |
| 字段映射 | 导入文件表头必须与模板表头精确匹配 |
| 导出范围 | 默认导出当前筛选条件下的全部资产（支持分页导出） |
| 权限控制 | 仅 `ADMIN` 或 `ASSET_MANAGER` 可执行导入导出 |

**用户角色权限（`src/api/deps/auth.py`）：**

```python
class UserRole(str, Enum):
    """用户角色枚举"""
    ADMIN = "ADMIN"                          # 管理员 - 可执行导入导出
    ASSET_MANAGER = "ASSET_MANAGER"          # 资产管理员 - 可执行导入导出
    REQUESTER = "REQUESTER"                  # 普通请求者 - 不可执行
```

### 3.4 API 端点约束

| 操作 | HTTP Method | Endpoint | 认证要求 |
|------|-------------|----------|----------|
| 上传导入 | POST | `/api/v1/assets/import` | JWT Bearer + ADMIN/ASSET_MANAGER |
| 下载导出 | POST | `/api/v1/assets/export` | JWT Bearer + ADMIN/ASSET_MANAGER |
| 下载模板 | GET | `/api/v1/assets/import/template` | JWT Bearer |

---

## 4. 验收测试基准 (ATB)

### 4.1 单元测试（pytest）

#### 4.1.1 文件解析层测试（`src/utils/excel_parser.py`）

```python
# tests/unit/test_excel_parser.py

class TestExcelParser:
    """Excel/CSV 文件解析器单元测试"""
    
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
        
    def test_parse_exceeds_row_limit(self):
        """ATB-006: 行数超 5000 应抛出 RowLimitExceededError"""
        # Arrange: 准备 5001 行数据
        # Act/Assert: parser.parse() 应抛出 RowLimitExceededError
```

#### 4.1.2 字段映射层测试（`src/services/field_mapping_engine.py`）

```python
# tests/unit/test_field_mapping_engine.py

class TestFieldMappingEngine:
    """字段映射引擎单元测试"""
    
    def test_apply_mapping_valid_headers(self):
        """ATB-007: 合法表头应正确映射到模型字段"""
        # Arrange: headers=["asset_id", "asset_name", "asset_type"]
        # Act: engine.apply_mapping(headers, data)
        # Assert: 返回映射后的 dict，字段名转换正确
        
    def test_apply_mapping_missing_header(self):
        """ATB-008: 缺少必填表头应返回错误"""
        # Arrange: headers 缺少 "asset_id"
        # Act/Assert: 应抛出 MissingRequiredHeaderError
        
    def test_apply_mapping_duplicate_columns(self):
        """ATB-009: 重复表头应返回错误"""
        # Arrange: headers 包含重复列名
        # Act/Assert: 应抛出 DuplicateHeaderError
```

#### 4.1.3 导入服务层测试（批量创建逻辑）

```python
# tests/unit/test_asset_import_service.py

class TestAssetImportService:
    """资产导入服务单元测试"""
    
    def test_import_creates_assets(self):
        """ATB-010: 导入成功应创建对应数量的资产记录"""
        # Arrange: 准备 100 条合法数据
        # Act: service.import_assets(data_list)
        # Assert: DB 中新增 100 条记录
        
    def test_import_duplicate_asset_id(self):
        """ATB-011: 重复 asset_id 应回滚并返回错误"""
        # Arrange: 数据包含已存在的 asset_id
        # Act/Assert: 抛出 DuplicateAssetIdError, DB 无新增记录
        
    def test_import_partial_failure(self):
        """ATB-012: 部分失败应回滚全部"""
        # Arrange: 数据中第 50 条非法
        # Act/Assert: 抛出 ValidationError, DB 无任何新增
        
    def test_import_exceeds_row_limit(self):
        """ATB-013: 超出 5000 行应拒绝"""
        # Arrange: 准备 5001 条数据
        # Act/Assert: 抛出 RowLimitExceededError
```

#### 4.1.4 导出服务层测试（`src/utils/excel_generator.py`）

```python
# tests/unit/test_excel_generator.py

class TestExcelGenerator:
    """Excel/CSV 导出生成器单元测试"""
    
    def test_generate_xlsx_bytes(self):
        """ATB-014: xlsx 导出应返回二进制流"""
        # Act: generator.generate(data, format="xlsx")
        # Assert: 返回 bytes, 可被 openpyxl.load_workbook() 加载
        
    def test_generate_csv_bytes_utf8(self):
        """ATB-015: csv 导出应返回 UTF-8 二进制流"""
        # Act: generator.generate(data, format="csv")
        # Assert: 返回 bytes, 可用 utf-8 解码
        
    def test_generate_includes_all_columns(self):
        """ATB-016: 导出文件应包含所有定义字段"""
        # Arrange: 存在包含所有字段的资产
        # Act: generator.generate([asset])
        # Assert: 解析导出的文件，包含全部 9 个字段
        
    def test_generate_empty_data(self):
        """ATB-017: 无数据时应导出仅含表头的空文件"""
        # Act: generator.generate([])
        # Assert: 文件仅含表头，无数据行
```

#### 4.1.5 数据模型层测试（`src/models/enums.py`）

```python
# tests/unit/test_enums.py

class TestAssetEnums:
    """资产枚举类型单元测试"""
    
    def test_asset_type_enum_values(self):
        """ATB-018: AssetType 枚举应包含所有定义值"""
        # Assert: AssetType 包含 DEVICE, FURNITURE, VEHICLE, SOFTWARE, OTHER
        
    def test_asset_status_enum_values(self):
        """ATB-019: AssetStatus 枚举应包含所有定义值"""
        # Assert: AssetStatus 包含 ACTIVE, MAINTENANCE, INACTIVE, RETIRED, SCRAPPED, TRANSFERRED
```

### 4.2 集成测试（pytest + FastAPI TestClient）

#### 4.2.1 API 端点集成测试

```python
# tests/integration/test_asset_bulk_api.py

class TestAssetBulkImportExportAPI:
    """资产批量导入导出 API 集成测试"""
    
    def test_import_api_success(self, authenticated_admin_client):
        """ATB-020: POST /api/v1/assets/import 合法请求返回 201"""
        # Arrange: authenticated_admin_client 携带 admin token
        #          multipart/form-data 包含 test_file.xlsx
        # Act: POST /api/v1/assets/import
        # Assert: status=201, body={"created": 100, "failed": 0}
        
    def test_import_api_unauthorized(self, client):
        """ATB-021: 未认证请求应返回 401"""
        # Act: POST /api/v1/assets/import (无 token)
        # Assert: status=401
        
    def test_import_api_forbidden_requester_role(self, authenticated_requester_client):
        """ATB-022: REQUESTER 角色请求导入应返回 403"""
        # Act: POST /api/v1/assets/import (requester token)
        # Assert: status=403
        
    def test_import_api_file_too_large(self, authenticated_admin_client):
        """ATB-023: 文件超 10MB 应返回 413"""
        # Arrange: 构造 11MB 文件
        # Act/Assert: status=413, body.code="FILE_TOO_LARGE"
        
    def test_import_api_unsupported_format(self, authenticated_admin_client):
        """ATB-024: 不支持格式应返回 400"""
        # Arrange: 上传 .txt 文件
        # Act/Assert: status=400, body.code="UNSUPPORTED_FORMAT"
        
    def test_export_api_success(self, authenticated_admin_client):
        """ATB-025: POST /api/v1/assets/export 应返回 200"""
        # Act: POST /api/v1/assets/export, body={"format": "xlsx"}
        # Assert: status=200, content-type 匹配格式
        
    def test_export_api_csv_format(self, authenticated_admin_client):
        """ATB-026: 指定 csv 格式应返回正确 content-type"""
        # Act: POST /api/v1/assets/export, body={"format": "csv"}
        # Assert: status=200, content-type="text/csv; charset=utf-8"
        
    def test_template_download_api(self, authenticated_client):
        """ATB-027: GET /api/v1/assets/import/template 应返回模板文件"""
        # Act: GET /api/v1/assets/import/template?format=xlsx
        # Assert: status=200, content-type 正确, 文件可被 openpyxl 加载
```

#### 4.2.2 E2E 场景测试

```python
# tests/e2e/test_asset_bulk_workflow.spec.ts (Playwright)

class TestAssetBulkWorkflowE2E:
    """资产批量操作端到端测试"""
    
    def test_full_import_export_cycle(self, browser):
        """ATB-028: 导入后导出应包含导入数据"""
        # Arrange: 登录 admin, 准备 50 条测试数据
        # Step 1: 上传 xlsx 文件到 /api/v1/assets/import
        # Step 2: 等待 201 响应
        # Step 3: 调用 /api/v1/assets/export 导出
        # Step 4: 解析导出文件
        # Assert: 导出数据包含导入的 50 条，且数据一致
        
    def test_invalid_import_shows_error(self, browser):
        """ATB-029: 导入非法文件应在前端显示错误"""
        # Arrange: 登录 admin
        # Step 1: 上传包含非法数据的 test_invalid.xlsx
        # Step 2: 点击导入按钮
        # Assert: 前端显示错误提示区域
```

### 4.3 测试覆盖率要求

| 层级 | 覆盖率目标 |
|------|------------|
| 文件解析层 (`excel_parser`) | ≥ 90% 行覆盖率 |
| 字段映射层 (`field_mapping_engine`) | ≥ 85% 行覆盖率 |
| 导出生成层 (`excel_generator`) | ≥ 80% 行覆盖率 |
| 导入服务层 | ≥ 80% 行覆盖率 |
| API 路由层 | 关键路径 100% 覆盖 |
| 数据模型层 (`enums`) | 100% 覆盖 |

---

## 5. 开发切入层级序列

### 5.1 层级依赖图

```
┌──────────────────────────────────────────────────────────┐
│                      Layer 6: 前端 UI                     │
│            (上传按钮、进度条、错误展示)                      │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTP API
┌──────────────────────────▼───────────────────────────────┐
│                      Layer 5: API 路由层                  │
│    POST /import    POST /export    GET /template          │
│              (src/api/routers/asset_router.py)           │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                    Layer 4: 业务服务层                     │
│           AssetImportService    AssetExportService       │
│              (事务控制、错误聚合)                          │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                   Layer 3: 字段映射层                      │
│                 FieldMappingEngine                        │
│            (src/services/field_mapping_engine.py)         │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                   Layer 2: 文件处理层                     │
│          ExcelParser          ExcelGenerator            │
│       (src/utils/excel_parser.py)                        │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                   Layer 1: 数据模型层                     │
│        Asset Model / Enums / BatchImportRequest          │
│  (src/models/enums.py, src/models/BatchImportRequest.py) │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                   Layer 0: 数据库层                       │
│              Asset Table / Migration                     │
└──────────────────────────────────────────────────────────┘
```

### 5.2 开发任务序列

| 顺序 | 层级 | 任务卡片 | 预计工时 | 依赖前置 | 验收测试 |
|------|------|----------|----------|----------|----------|
| 1 | Layer 0 | 确认 Asset 数据表结构，必要时创建迁移 | 0.5d | 无 | ATB-N/A |
| 2 | Layer 1 | 确认/扩展 `AssetType` 和 `AssetStatus` 枚举 | 0.25d | 无 | ATB-018, ATB-019 |
| 3 | Layer 1 | 创建 `BatchImportRequest` 模型 | 0.5d | 任务 2 | AC-005 验证 |
| 4 | Layer 2 | 实现 `ExcelParser.parse()` xlsx 解析 | 1d | 任务 3 | ATB-001, ATB-003, ATB-004, ATB-005 |
| 5 | Layer 2 | 实现 `ExcelParser.parse()` CSV 解析 | 0.5d | 任务 4 | ATB-002, ATB-006 |
| 6 | Layer 2 | 实现 `ExcelGenerator.generate()` xlsx 导出 | 1d | 任务 2 | ATB-014, ATB-016, ATB-017 |
| 7 | Layer 2 | 实现 `ExcelGenerator.generate()` CSV 导出 | 0.5d | 任务 6 | ATB-015 |
| 8 | Layer 3 | 利用现有 `FieldMappingEngine` 实现字段映射 | 0.5d | 任务 4 | ATB-007, ATB-008, ATB-009 |
| 9 | Layer 4 | 实现 `AssetImportService.import_from_file()` | 1d | 任务 8 | ATB-010, ATB-011, ATB-012, ATB-013 |
| 10 | Layer 4 | 实现 `AssetExportService.export_assets()` | 1d | 任务 6 | ATB-014 ~ ATB-017 |
| 11 | Layer 5 | 实现 API 路由（import/export/template） | 1d | 任务 9, 10 | ATB-020 ~ ATB-027 |
| 12 | Layer 5 | 实现文件大小/格式中间件校验 | 0.5d | 任务 11 | ATB-023, ATB-024 |
| 13 | Layer 6 | 前端导入页面组件开发 | 1.5d | 任务 11 | ATB-028, ATB-029 |
| 14 | Layer 6 | 前端导出页面组件开发 | 1d | 任务 11 | ATB-028 |
| 15 | - | 单元测试编写（Layer 1-4） | 2d | 任务 10 | ATB-001 ~ ATB-019 |
| 16 | - | 集成测试编写 | 1d | 任务 11 | ATB-020 ~ ATB-027 |
| 17 | - | 测试报告与验收 | 0.5d | 任务 15-16 | AC-003 静态检查 |

### 5.3 关键代码接口预定义

#### 5.3.1 文件解析接口（`src/utils/excel_parser.py`）

```python
"""Excel/CSV 文件解析器模块

提供统一的文件解析接口，支持 xlsx 和 csv 格式。
使用 openpyxl 解析 xlsx，pandas 解析 csv。
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Dict, Any, BinaryIO
from enum import Enum

class FileFormat(Enum):
    """支持的导入文件格式"""
    XLSX = "xlsx"
    CSV = "csv"

class ParseError(Enum):
    """解析错误类型"""
    UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT"
    FILE_PARSE_ERROR = "FILE_PARSE_ERROR"
    EMPTY_FILE = "EMPTY_FILE"
    ROW_LIMIT_EXCEEDED = "ROW_LIMIT_EXCEEDED"
    MISSING_REQUIRED_HEADER = "MISSING_REQUIRED_HEADER"
    DUPLICATE_HEADER = "DUPLICATE_HEADER"

MAX_ROWS = 5000
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

@dataclass
class ParseResult:
    """解析结果数据类"""
    headers: List[str]
    rows: List[Dict[str, Any]]
    total_rows: int
    file_format: FileFormat

class ExcelParser:
    """Excel/CSV 文件解析器"""
    
    def parse(self, file_content: BinaryIO, filename: str) -> ParseResult:
        """
        解析上传的文件内容
        
        Args:
            file_content: 文件二进制内容
            filename: 原始文件名
            
        Returns:
            ParseResult: 包含表头和数据行的解析结果
            
        Raises:
            UnsupportedFormatError: 不支持的文件格式
            FileParseError: 文件解析失败
            EmptyFileError: 文件为空
            RowLimitExceededError: 行数超限
        """
        pass
```

#### 5.3.2 文件生成接口（`src/utils/excel_generator.py`）

```python
"""Excel/CSV 文件生成器模块

提供统一的文件生成接口，支持导出 xlsx 和 csv 格式。
"""

from typing import List, Dict, Any
from enum import Enum

class ExportFormat(Enum):
    """支持的导出文件格式"""
    XLSX = "xlsx"
    CSV = "csv"

class ExcelGenerator:
    """Excel/CSV 文件生成器"""
    
    def generate(
        self, 
        data: List[Dict[str, Any]], 
        format: ExportFormat = ExportFormat.XLSX
    ) -> bytes:
        """
        生成导出文件
        
        Args:
            data: 要导出的数据列表
            format: 导出格式
            
        Returns:
            bytes: 文件二进制内容
        """
        pass
```

#### 5.3.3 字段映射接口（`src/services/field_mapping_engine.py`）

```python
"""字段映射引擎模块

基于已有 FieldMappingEngine 实现 Excel 表头到模型字段的映射。
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass

@dataclass
class MappingResult:
    """映射结果数据类"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class FieldMappingEngine:
    """字段映射引擎（已实现，参考现有代码）"""
    
    def apply_mapping(
        self, 
        headers: List[str], 
        data: Dict[str, Any]
    ) -> MappingResult:
        """
        将 Excel 表头映射到模型字段
        
        Args:
            headers: Excel 表头列表
            data: Excel 行数据
            
        Returns:
            MappingResult: 映射结果
        """
        pass
```

#### 5.3.4 导入服务接口（`src/services/asset_import_service.py`）

```python
"""资产导入服务模块

提供批量导入资产的业务逻辑。
"""

from typing import BinaryIO, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

class ImportErrorCode(Enum):
    """导入错误码"""
    DUPLICATE_ASSET_ID = "DUPLICATE_ASSET_ID"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    ROW_LIMIT_EXCEEDED = "ROW_LIMIT_EXCEEDED"

@dataclass
class ImportResult:
    """导入结果数据类"""
    success: bool
    created: int = 0
    failed: int = 0
    errors: List[Dict[str, Any]] = None

class AssetImportService:
    """资产导入服务"""
    
    def import_from_file(
        self, 
        file_content: BinaryIO, 
        filename: str,
        current_user: "CurrentUser"  # 引用 auth.py 的 CurrentUser
    ) -> ImportResult:
        """
        从文件导入资产
        
        Args:
            file_content: 文件二进制内容
            filename: 原始文件名
            current_user: 当前用户信息
            
        Returns:
            ImportResult: 导入结果
        """
        pass
```

#### 5.3.5 导出服务接口（`src/services/asset_export_service.py`）

```python
"""资产导出服务模块

提供导出资产列表的业务逻辑。
"""

from typing import Dict, Any, Optional
from .excel_generator import ExportFormat

class AssetExportService:
    """资产导出服务"""
    
    def export_assets(
        self, 
        filters: Optional[Dict[str, Any]] = None,
        format: ExportFormat = ExportFormat.XLSX,
        current_user: "CurrentUser"
    ) -> bytes:
        """
        导出资产列表
        
        Args:
            filters: 筛选条件
            format: 导出格式
            current_user: 当前用户信息
            
        Returns:
            bytes: 导出文件二进制内容
        """
        pass
```

#### 5.3.6 API 路由接口（`src/api/routers/asset_router.py`）

```python
"""资产批量操作路由模块

提供资产导入导出相关 API 端点。
"""

from fastapi import APIRouter, UploadFile, File, Form, Query, Depends
from typing import Optional

router = APIRouter(prefix="/api/v1/assets", tags=["资产批量操作"])

class AssetBulkDeps:
    """资产批量操作权限依赖"""
    
    @staticmethod
    def require_bulk_permission(
        current_user: "CurrentUser" = Depends(get_current_user)
    ) -> "CurrentUser":
        """
        验证用户是否有批量操作权限
        
        Args:
            current_user: 当前用户
            
        Returns:
            CurrentUser: 验证通过的用户
            
        Raises:
            ForbiddenError: 用户角色无权执行此操作
        """
        pass

@router.post("/import")
async def import_assets(
    file: UploadFile = File(...),
    current_user: "CurrentUser" = Depends(AssetBulkDeps.require_bulk_permission)
):
    """
    批量导入资产
    
    Args:
        file: 上传的 Excel/CSV 文件
        current_user: 当前用户（需 ADMIN 或 ASSET_MANAGER 角色）
        
    Returns:
        ImportResult: 导入结果
    """
    pass

@router.post("/export")
async def export_assets(
    format: ExportFormat = Form(ExportFormat.XLSX),
    filters: Optional[str] = Form(None),
    current_user: "CurrentUser" = Depends(AssetBulkDeps.require_bulk_permission)
):
    """
    批量导出资产
    
    Args:
        format: 导出格式 (xlsx/csv)
        filters: JSON 格式的筛选条件
        current_user: 当前用户（需 ADMIN 或 ASSET_MANAGER 角色）
        
    Returns:
        FileResponse: 导出的文件
    """
    pass

@router.get("/import/template")
async def download_template(
    format: ExportFormat = Query(ExportFormat.XLSX),
    current_user: "CurrentUser" = Depends(get_current_user)
):
    """
    下载资产导入模板
    
    Args:
        format: 模板格式 (xlsx/csv)
        current_user: 当前用户
        
    Returns:
        FileResponse: 模板文件
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

- `asset_type` 可选值：`DEVICE`, `FURNITURE`, `VEHICLE`, `SOFTWARE`, `OTHER`
- `status` 可选值：`ACTIVE`, `MAINTENANCE`, `INACTIVE`, `RETIRED`, `SCRAPPED`, `TRANSFERRED`
- `purchase_date` 格式：`YYYY-MM-DD`
- `purchase_price` 格式：`1234.56`

### 6.3 审计日志配置

批量导入导出操作需记录审计日志，参考 `src/api/middleware/audit_logger.py` 配置：

```python
"""批量操作审计日志配置"""

AUDIT_EVENT_BULK_IMPORT = "ASSET_BULK_IMPORT"
AUDIT_EVENT_BULK_EXPORT = "ASSET_BULK_EXPORT"

BULK_OPERATION_AUDIT_FIELDS = [
    "operation_type",    # IMPORT / EXPORT
    "file_format",       # xlsx / csv
    "file_name",         # 原始文件名
    "record_count",      # 处理记录数
    "success_count",     # 成功数
    "failure_count",     # 失败数
]
```

---

**文档结束**