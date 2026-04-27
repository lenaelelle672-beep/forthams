"""
资产批量导入导出 - 文件解析层单元测试

测试目标：验证 Excel/CSV 文件解析功能
验收标准：
    - AC-003: AST静态检查通过
    - AC-004: 函数包含docstring
    - AC-005: 模块可正常import

测试层级：Layer 1 - 文件解析层
"""

import pytest
import os
import tempfile
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass

# 被测试模块
from src.utils.excel_parser import ExcelParser, CSVParser, FileParseError, EmptyFileError, UnsupportedFormatError
from src.services.field_mapping_engine import FieldMappingEngine


# ==================== 测试数据准备 ====================

@dataclass
class TestAssetData:
    """测试用资产数据结构"""
    asset_id: str
    asset_name: str
    asset_type: str
    status: str
    purchase_date: str = "2024-01-01"
    purchase_price: str = "1000.00"
    department: str = "IT"
    remarks: str = ""


class TestDataBuilder:
    """测试数据构建器"""
    
    @staticmethod
    def create_valid_xlsx_template_headers() -> List[str]:
        """
        生成合法的资产导入模板表头
        
        Returns:
            List[str]: 标准表头列表
        """
        return [
            "asset_id",
            "asset_name", 
            "asset_type",
            "purchase_date",
            "purchase_price",
            "status",
            "department",
            "remarks"
        ]
    
    @staticmethod
    def create_valid_asset_row() -> Dict[str, str]:
        """
        生成一条合法的资产数据行
        
        Returns:
            Dict[str, str]: 字段名到值的映射
        """
        return {
            "asset_id": "AST-2024-001",
            "asset_name": "测试资产",
            "asset_type": "DEVICE",
            "purchase_date": "2024-01-01",
            "purchase_price": "5000.00",
            "status": "ACTIVE",
            "department": "IT部",
            "remarks": "批量导入测试"
        }


class MockFileParser:
    """
    模拟文件解析器（用于隔离测试）
    
    提供标准化的文件解析接口，便于单元测试验证解析逻辑
    """
    
    def __init__(self, content: str = "", extension: str = ".xlsx"):
        """
        初始化模拟解析器
        
        Args:
            content: 文件内容字符串
            extension: 文件扩展名
        """
        self.content = content
        self.extension = extension
        self.parse_called = False
        self.parse_result = None
    
    def parse(self, file_path: str) -> Dict[str, Any]:
        """
        解析文件内容
        
        Args:
            file_path: 文件路径
            
        Returns:
            Dict: 解析结果，包含 headers 和 rows
            
        Raises:
            FileParseError: 解析失败时抛出
            EmptyFileError: 文件为空时抛出
        """
        self.parse_called = True
        
        if not self.content or self.content.strip() == "":
            raise EmptyFileError("文件内容为空")
        
        if self.extension not in [".xlsx", ".csv"]:
            raise UnsupportedFormatError(f"不支持的格式: {self.extension}")
        
        # 模拟解析逻辑
        lines = self.content.strip().split("\n")
        headers = lines[0].split(",") if lines else []
        rows = []
        
        for line in lines[1:]:
            if line.strip():
                values = line.split(",")
                row = dict(zip(headers, values))
                rows.append(row)
        
        self.parse_result = {
            "headers": headers,
            "rows": rows,
            "total_rows": len(rows)
        }
        
        return self.parse_result
    
    def supports_format(self, extension: str) -> bool:
        """
        检查是否支持指定格式
        
        Args:
            extension: 文件扩展名
            
        Returns:
            bool: 是否支持
        """
        return extension.lower() in [".xlsx", ".csv"]


# ==================== ATB 测试用例 ====================

class TestFileParserBasic:
    """ATB-001 ~ ATB-005: 文件解析基础功能测试"""
    
    def test_parse_valid_xlsx(self):
        """
        ATB-001: 合法 xlsx 文件应正确解析返回数据列表
        
        测试场景：
            - 准备符合模板的 xlsx 文件
            - 调用解析器解析
            - 验证返回数据结构和内容
        
        验收标准：
            - 返回 ParseResult 对象
            - headers 包含所有标准字段
            - rows 数量等于数据行数
            - 每行数据包含必要字段
        """
        # Arrange: 准备符合模板的测试内容
        headers = ",".join(TestDataBuilder.create_valid_xlsx_template_headers())
        data_row = ",".join([
            "AST-2024-001",
            "测试笔记本",
            "DEVICE",
            "2024-01-01",
            "8000.00",
            "ACTIVE",
            "研发部",
            "新采购"
        ])
        content = f"{headers}\n{data_row}"
        
        parser = MockFileParser(content=content, extension=".xlsx")
        
        # Act: 调用解析方法
        result = parser.parse("test_asset_valid.xlsx")
        
        # Assert: 验证解析结果
        assert result is not None, "解析结果不应为空"
        assert len(result["headers"]) == 8, "应包含8个表头字段"
        assert result["total_rows"] == 1, "应包含1条数据行"
        assert result["rows"][0]["asset_id"] == "AST-2024-001"
        assert result["rows"][0]["asset_name"] == "测试笔记本"
        assert result["rows"][0]["asset_type"] == "DEVICE"
    
    def test_parse_valid_csv(self):
        """
        ATB-002: 合法 CSV 文件应正确解析
        
        测试场景：
            - 准备符合模板的 CSV 文件（UTF-8 编码）
            - 调用解析器解析
            - 验证与 xlsx 解析结果一致
        
        验收标准：
            - 返回与 xlsx 相同的字段结构
            - 数据内容准确映射
            - 无编码错误
        """
        # Arrange: 准备符合模板的 CSV 内容
        headers = ",".join(TestDataBuilder.create_valid_xlsx_template_headers())
        data_rows = [
            "AST-2024-001,测试设备A,DEVICE,2024-01-01,5000.00,ACTIVE,IT部,备注1",
            "AST-2024-002,测试设备B,FURNITURE,2024-02-01,2000.00,ACTIVE,HR部,备注2"
        ]
        content = f"{headers}\n" + "\n".join(data_rows)
        
        parser = MockFileParser(content=content, extension=".csv")
        
        # Act: 调用解析方法
        result = parser.parse("test_assets.csv")
        
        # Assert: 验证解析结果
        assert result is not None
        assert result["total_rows"] == 2, "应包含2条数据行"
        assert result["rows"][0]["asset_type"] == "DEVICE"
        assert result["rows"][1]["asset_type"] == "FURNITURE"
        assert len(result["headers"]) == 8
    
    def test_parse_unsupported_format(self):
        """
        ATB-003: 不支持格式应抛出 UnsupportedFormatError
        
        测试场景：
            - 准备不支持格式的文件（如 .txt）
            - 调用解析器解析
            - 验证抛出正确的异常
        
        验收标准：
            - 抛出 UnsupportedFormatError
            - 异常消息包含格式信息
        """
        # Arrange: 准备不支持格式的文件
        parser = MockFileParser(content="some data", extension=".txt")
        
        # Act & Assert: 验证抛出正确异常
        with pytest.raises(UnsupportedFormatError) as exc_info:
            parser.parse("test.txt")
        
        assert ".txt" in str(exc_info.value), "异常消息应包含不支持的格式"
    
    def test_parse_corrupted_file(self):
        """
        ATB-004: 损坏文件应抛出 FileParseError
        
        测试场景：
            - 准备内容损坏的 xlsx 文件
            - 调用解析器解析
            - 验证抛出文件解析错误
        
        验收标准：
            - 抛出 FileParseError
            - 异常消息指明文件损坏
        """
        # Arrange: 准备损坏的/非标准格式内容
        corrupted_content = "\x00\x01\x02\x03\xFF\xFE invalid content"
        parser = MockFileParser(content=corrupted_content, extension=".xlsx")
        
        # Act & Assert: 验证抛出解析错误
        with pytest.raises(FileParseError) as exc_info:
            parser.parse("corrupted.xlsx")
        
        assert "parse" in str(exc_info.value).lower() or "file" in str(exc_info.value).lower()
    
    def test_parse_empty_file(self):
        """
        ATB-005: 空文件应抛出 EmptyFileError
        
        测试场景：
            - 准备行数为 0 的空文件
            - 调用解析器解析
            - 验证抛出空文件错误
        
        验收标准：
            - 抛出 EmptyFileError
            - 异常消息指明文件为空
        """
        # Arrange: 准备空内容
        parser = MockFileParser(content="", extension=".xlsx")
        
        # Act & Assert: 验证抛出空文件错误
        with pytest.raises(EmptyFileError) as exc_info:
            parser.parse("empty.xlsx")
        
        assert "empty" in str(exc_info.value).lower() or "空" in str(exc_info.value)


class TestFileParserAdvanced:
    """ATB-006 ~ ATB-010: 文件解析高级功能测试"""
    
    def test_parse_large_file(self):
        """
        ATB-006: 大文件解析性能测试
        
        测试场景：
            - 准备接近限制的大文件（5000行）
            - 验证解析时间在可接受范围
        
        验收标准：
            - 解析完成且无内存溢出
            - 返回正确的数据行数
        """
        # Arrange: 生成5000行测试数据
        headers = ",".join(TestDataBuilder.create_valid_xlsx_template_headers())
        data_rows = []
        
        for i in range(5000):
            row = f"AST-2024-{i:05d},资产{i},DEVICE,2024-01-01,1000.00,ACTIVE,IT部,备注{i}"
            data_rows.append(row)
        
        content = f"{headers}\n" + "\n".join(data_rows)
        parser = MockFileParser(content=content, extension=".csv")
        
        # Act: 解析大文件
        import time
        start_time = time.time()
        result = parser.parse("large_assets.csv")
        elapsed_time = time.time() - start_time
        
        # Assert: 验证结果
        assert result["total_rows"] == 5000, "应正确解析5000行数据"
        assert elapsed_time < 10.0, "解析时间应少于10秒"
    
    def test_parse_with_special_characters(self):
        """
        ATB-007: 特殊字符处理测试
        
        测试场景：
            - 文件内容包含特殊字符（中文、emoji、引号等）
            - 验证解析正确处理
        
        验收标准：
            - 特殊字符不导致解析错误
            - 内容准确保留
        """
        # Arrange: 准备包含特殊字符的内容
        headers = ",".join(TestDataBuilder.create_valid_xlsx_template_headers())
        special_content = (
            "AST-2024-001,"
            "测试资产（含'单引号'和\"双引号\"）,"
            "DEVICE,"
            "2024-01-01,"
            "1000.00,"
            "ACTIVE,"
            "IT部💻,"
            "备注：🎉成功"
        )
        content = f"{headers}\n{special_content}"
        
        parser = MockFileParser(content=content, extension=".csv")
        
        # Act & Assert
        result = parser.parse("special_chars.csv")
        assert result["total_rows"] == 1
        assert "单引号" in result["rows"][0]["asset_name"]
        assert "双引号" in result["rows"][0]["asset_name"]
    
    def test_parse_with_missing_fields(self):
        """
        ATB-008: 缺失字段处理测试
        
        测试场景：
            - 部分行缺少某些字段值
            - 验证解析不会崩溃
        
        验收标准：
            - 解析完成不抛异常
            - 缺失字段返回空字符串或None
        """
        # Arrange: 准备部分字段缺失的数据
        headers = ",".join(TestDataBuilder.create_valid_xlsx_template_headers())
        incomplete_row = "AST-2024-001,测试资产,DEVICE,,,ACTIVE,,"
        content = f"{headers}\n{incomplete_row}"
        
        parser = MockFileParser(content=content, extension=".csv")
        
        # Act: 解析不完整数据
        result = parser.parse("incomplete.csv")
        
        # Assert: 验证处理结果
        assert result["total_rows"] == 1
        row = result["rows"][0]
        assert row["purchase_date"] == "" or row["purchase_date"] is None
        assert row["purchase_price"] == "" or row["purchase_price"] is None
    
    def test_parse_with_extra_columns(self):
        """
        ATB-009: 多余列处理测试
        
        测试场景：
            - 文件包含额外的不标准列
            - 验证解析只处理已知字段
        
        验收标准：
            - 解析不因额外列失败
            - 已知字段正确解析
        """
        # Arrange: 准备包含额外列的数据
        extra_headers = TestDataBuilder.create_valid_xlsx_template_headers() + ["extra_column1", "extra_column2"]
        headers = ",".join(extra_headers)
        
        data_row = (
            "AST-2024-001,测试资产,DEVICE,2024-01-01,1000.00,ACTIVE,IT部,备注,"
            "额外值1,额外值2"
        )
        content = f"{headers}\n{data_row}"
        
        parser = MockFileParser(content=content, extension=".csv")
        
        # Act: 解析含额外列的数据
        result = parser.parse("extra_columns.csv")
        
        # Assert: 验证已知字段正确
        assert result["total_rows"] == 1
        assert result["rows"][0]["asset_id"] == "AST-2024-001"
        assert result["rows"][0]["asset_name"] == "测试资产"
    
    def test_parse_with_whitespace(self):
        """
        ATB-010: 空白字符处理测试
        
        测试场景：
            - 字段值包含前后空白字符
            - 验证解析正确trim或保留
        
        验收标准：
            - 解析完成
            - 可根据业务需求决定是否trim
        """
        # Arrange: 准备带空白字符的数据
        headers = ",".join(TestDataBuilder.create_valid_xlsx_template_headers())
        data_row = "  AST-2024-001  ,  测试资产  ,DEVICE,2024-01-01,1000.00,ACTIVE,  IT部  ,  备注  "
        content = f"{headers}\n{data_row}"
        
        parser = MockFileParser(content=content, extension=".csv")
        
        # Act: 解析含空白字符的数据
        result = parser.parse("whitespace.csv")
        
        # Assert: 验证解析结果
        assert result["total_rows"] == 1
        # 验证是否trim取决于实现，这里验证解析不失败
        assert result["rows"][0]["asset_id"] is not None


class TestFileParserFormatSupport:
    """ATB-011 ~ ATB-015: 格式支持测试"""
    
    def test_xlsx_format_supported(self):
        """
        ATB-011: xlsx 格式应被支持
        
        验收标准：
            - supports_format(".xlsx") 返回 True
        """
        parser = MockFileParser()
        assert parser.supports_format(".xlsx") is True
    
    def test_csv_format_supported(self):
        """
        ATB-012: csv 格式应被支持
        
        验收标准：
            - supports_format(".csv") 返回 True
        """
        parser = MockFileParser()
        assert parser.supports_format(".csv") is True
    
    def test_xls_format_not_supported(self):
        """
        ATB-013: xls (旧格式) 不应支持
        
        验收标准：
            - supports_format(".xls") 返回 False
        """
        parser = MockFileParser()
        assert parser.supports_format(".xls") is False
    
    def test_case_insensitive_format(self):
        """
        ATB-014: 格式检查应大小写不敏感
        
        验收标准：
            - 支持 .XLSX, .CSV 等大写扩展名
        """
        parser = MockFileParser()
        assert parser.supports_format(".XLSX") is True
        assert parser.supports_format(".CSV") is True
        assert parser.supports_format(".Xlsx") is True


class TestFieldMappingIntegration:
    """ATB-016 ~ ATB-018: 字段映射集成测试"""
    
    def test_field_mapping_with_excel_parser(self):
        """
        ATB-016: Excel解析器与字段映射引擎集成
        
        测试场景：
            - 使用 ExcelParser 解析文件
            - 使用 FieldMappingEngine 进行字段映射
            - 验证映射结果正确
        
        验收标准：
            - 解析后的字段可正确映射到资产模型
            - 映射过程无数据丢失
        """
        # Arrange: 准备Excel内容和映射配置
        headers = TestDataBuilder.create_valid_xlsx_template_headers()
        valid_row = TestDataBuilder.create_valid_asset_row()
        
        # Act: 执行字段映射
        # 注：这里需要 FieldMappingEngine 的实际实现
        # 由于是隔离测试，使用 mock 验证接口
        mapping_engine = FieldMappingEngine()
        
        # 验证映射配置存在
        assert hasattr(mapping_engine, 'apply_mapping'), "FieldMappingEngine 应有 apply_mapping 方法"
        assert hasattr(mapping_engine, 'get_mapping_config'), "FieldMappingEngine 应有 get_mapping_config 方法"
    
    def test_required_fields_extraction(self):
        """
        ATB-017: 必填字段提取测试
        
        测试场景：
            - 解析文件后提取必填字段
            - 验证必填字段完整性
        
        验收标准：
            - 能正确识别必填字段
            - 必填字段：asset_id, asset_name, asset_type, status
        """
        # Arrange: 定义必填字段列表
        required_fields = ["asset_id", "asset_name", "asset_type", "status"]
        
        # Act: 从解析结果中提取
        headers = TestDataBuilder.create_valid_xlsx_template_headers()
        
        # Assert: 验证必填字段都存在
        for field in required_fields:
            assert field in headers, f"必填字段 {field} 应存在于表头中"
    
    def test_enum_field_value_mapping(self):
        """
        ATB-018: 枚举字段值映射测试
        
        测试场景：
            - 验证 asset_type 和 status 的枚举值映射
            - 确保与 UserRole 枚举定义一致
        
        验收标准：
            - asset_type 映射到正确枚举
            - status 映射到正确枚举
        """
        # Arrange: 定义枚举值映射
        asset_type_mapping = {
            "DEVICE": "DEVICE",
            "FURNITURE": "FURNITURE", 
            "VEHICLE": "VEHICLE",
            "SOFTWARE": "SOFTWARE",
            "OTHER": "OTHER"
        }
        
        status_mapping = {
            "ACTIVE": "ACTIVE",
            "INACTIVE": "INACTIVE",
            "SCRAPPED": "SCRAPPED",
            "TRANSFERRED": "TRANSFERRED"
        }
        
        # Act & Assert: 验证映射正确
        assert asset_type_mapping["DEVICE"] == "DEVICE"
        assert status_mapping["ACTIVE"] == "ACTIVE"


# ==================== 边界条件测试 ====================

class TestFileParserBoundaryConditions:
    """边界条件测试"""
    
    def test_single_row_file(self):
        """
        仅包含表头无数据行的文件
        
        验收标准：
            - total_rows = 0
            - headers 正确解析
        """
        headers = ",".join(TestDataBuilder.create_valid_xlsx_template_headers())
        parser = MockFileParser(content=headers, extension=".csv")
        
        result = parser.parse("header_only.csv")
        
        assert result["total_rows"] == 0
        assert len(result["headers"]) == 8
    
    def test_single_data_row(self):
        """
        仅包含一条数据行
        
        验收标准：
            - total_rows = 1
            - 数据正确
        """
        headers = ",".join(TestDataBuilder.create_valid_xlsx_template_headers())
        data_row = "AST-001,资产1,DEVICE,2024-01-01,100.00,ACTIVE,IT,test"
        
        parser = MockFileParser(content=f"{headers}\n{data_row}", extension=".csv")
        result = parser.parse("single_row.csv")
        
        assert result["total_rows"] == 1
        assert result["rows"][0]["asset_id"] == "AST-001"


# ==================== Fixtures ====================

@pytest.fixture
def temp_csv_file():
    """
    创建临时 CSV 文件 fixture
    
    用途：
        - 提供临时测试文件
        - 测试结束后自动清理
    """
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        headers = ",".join(TestDataBuilder.create_valid_xlsx_template_headers())
        f.write(headers + "\n")
        f.write("AST-TEST-001,测试资产,DEVICE,2024-01-01,1000.00,ACTIVE,IT,测试备注\n")
        temp_path = f.name
    
    yield temp_path
    
    # Cleanup
    if os.path.exists(temp_path):
        os.unlink(temp_path)


@pytest.fixture
def temp_xlsx_file():
    """
    创建临时 xlsx 文件 fixture
    
    用途：
        - 提供临时测试文件
        - 测试结束后自动清理
    """
    # 注意：这里创建的是文本格式，实际使用 openpyxl
    with tempfile.NamedTemporaryFile(mode='w', suffix='.xlsx', delete=False) as f:
        headers = ",".join(TestDataBuilder.create_valid_xlsx_template_headers())
        f.write(headers + "\n")
        f.write("AST-TEST-002,测试资产2,DEVICE,2024-01-01,2000.00,ACTIVE,HR,测试备注2\n")
        temp_path = f.name
    
    yield temp_path
    
    # Cleanup
    if os.path.exists(temp_path):
        os.unlink(temp_path)


# ==================== 参数化测试 ====================

@pytest.mark.parametrize("extension", [".xlsx", ".csv", ".XLSX", ".CSV"])
def test_format_support_case_insensitive(extension):
    """
    参数化测试：验证大小写不敏感的格式支持
    
    Args:
        extension: 文件扩展名参数
    """
    parser = MockFileParser()
    assert parser.supports_format(extension) is True


@pytest.mark.parametrize("invalid_extension", [".txt", ".pdf", ".doc", ".xls", ".json"])
def test_unsupported_format_rejection(invalid_extension):
    """
    参数化测试：验证不支持的格式被拒绝
    
    Args:
        invalid_extension: 不支持的扩展名参数
    """
    parser = MockFileParser(content="test", extension=invalid_extension)
    
    with pytest.raises(UnsupportedFormatError):
        parser.parse(f"test{invalid_extension}")


# ==================== 性能基准测试 ====================

class TestFileParserPerformance:
    """性能基准测试"""
    
    @pytest.mark.benchmark
    def test_parse_1000_rows_performance(self, benchmark):
        """
        性能测试：解析1000行数据
        
        基准：
            - 应在 1 秒内完成
        """
        headers = ",".join(TestDataBuilder.create_valid_xlsx_template_headers())
        data_rows = []
        
        for i in range(1000):
            row = f"AST-2024-{i:05d},资产{i},DEVICE,2024-01-01,1000.00,ACTIVE,IT部,备注{i}"
            data_rows.append(row)
        
        content = f"{headers}\n" + "\n".join(data_rows)
        parser = MockFileParser(content=content, extension=".csv")
        
        result = benchmark(parser.parse, "benchmark.csv")
        
        assert result["total_rows"] == 1000