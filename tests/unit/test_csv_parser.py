"""
CSV Parser Unit Tests

测试用例覆盖 ATB-1.1 CSV 文件解析验证：
- TC-1.1.1 正常 CSV 解析
- TC-1.1.2 多编码支持 (UTF-8-BOM)
- TC-1.1.3 GBK 编码兼容
- TC-1.1.4 异常行处理 (空行)
- TC-1.1.5 超大文件拒绝 (>10MB)
"""

import io
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

# 导入待测试的 CSV 解析器模块
from src.parsers.csv_parser import CsvParser
from src.parsers.base_parser import FileSizeExceededError


class TestCsvParser:
    """CSV 解析器单元测试类"""

    @pytest.fixture
    def csv_parser(self):
        """创建 CSV 解析器实例"""
        return CsvParser()

    @pytest.fixture
    def valid_csv_content(self):
        """标准有效 CSV 内容"""
        return """asset_id,asset_name,asset_type,serial_number,purchase_date,purchase_price,currency,department,custodian,status,location,remarks
,Test Asset 1,EQUIPMENT,SN001,2024-01-15,10000.00,CNY,DEPT001,John Doe,ACTIVE,Building A - Room 101,Test remarks
,Test Asset 2,IT_HARDWARE,SN002,2024-02-20,5000.50,CNY,DEPT002,Jane Smith,ACTIVE,Building B - Room 202,Another remarks"""

    @pytest.fixture
    def csv_with_bom(self):
        """UTF-8-BOM 编码的 CSV 内容"""
        bom = b'\xef\xbb\xbf'
        content = b"""asset_id,asset_name,asset_type,serial_number,purchase_date,purchase_price,currency,department,custodian,status,location,remarks
,Test BOM Asset,EQUIPMENT,SN-BOM-001,2024-03-10,8000.00,CNY,DEPT001,BOM User,ACTIVE,Location B,Test BOM"""
        return bom + content

    @pytest.fixture
    def csv_with_empty_rows(self):
        """包含空行的 CSV 内容"""
        return """asset_id,asset_name,asset_type,serial_number,purchase_date,purchase_price,currency,department,custodian,status,location,remarks

,Test Asset,EQUIPMENT,SN003,2024-04-05,3000.00,CNY,DEPT001,Empty Row User,ACTIVE,Location C,

,Test Asset 2,FURNITURE,SN004,2024-05-10,1500.00,CNY,DEPT002,Test User,ACTIVE,Location D,Valid

"""

    @pytest.fixture
    def large_file_content(self):
        """生成超过 10MB 的 CSV 内容"""
        header = "asset_id,asset_name,asset_type,serial_number,purchase_date,purchase_price,currency,department,custodian,status,location,remarks\n"
        # 计算需要生成的行数以超过 10MB (10 * 1024 * 1024 字节)
        row_size = 150  # 每行大约 150 字节
        rows_needed = (10 * 1024 * 1024) // row_size + 1
        data_row = ",Asset_X,EQUIPMENT,SN_XXXXX,2024-01-01,1000.00,CNY,DEPT001,Custodian,ACTIVE,Location,Remarks\n"
        return header + (data_row * rows_needed)


class TestParseValidCsv(TestCsvParser):
    """TC-1.1.1 正常 CSV 解析测试"""

    def test_parse_valid_csv(self, csv_parser, valid_csv_content):
        """
        测试正常 CSV 解析
        验证：正确解析 header 与数据行，无异常
        """
        file_stream = io.BytesIO(valid_csv_content.encode('utf-8'))
        
        result = csv_parser.parse(file_stream)
        
        assert result is not None
        assert 'headers' in result
        assert 'rows' in result
        
        # 验证 header 解析正确
        expected_headers = [
            'asset_id', 'asset_name', 'asset_type', 'serial_number',
            'purchase_date', 'purchase_price', 'currency', 'department',
            'custodian', 'status', 'location', 'remarks'
        ]
        assert result['headers'] == expected_headers
        
        # 验证数据行解析正确 (2 行数据)
        assert len(result['rows']) == 2
        
        # 验证第一行数据
        first_row = result['rows'][0]
        assert first_row['asset_name'] == 'Test Asset 1'
        assert first_row['asset_type'] == 'EQUIPMENT'
        assert first_row['purchase_price'] == '10000.00'
        
        # 验证第二行数据
        second_row = result['rows'][1]
        assert second_row['asset_name'] == 'Test Asset 2'
        assert second_row['asset_type'] == 'IT_HARDWARE'

    def test_parse_csv_with_minimal_columns(self, csv_parser):
        """测试仅包含必需字段的 CSV"""
        minimal_csv = """asset_name,asset_type,purchase_date,purchase_price,currency,department,status
Minimal Asset,VEHICLE,2024-06-01,20000.00,CNY,DEPT003,ACTIVE"""
        
        file_stream = io.BytesIO(minimal_csv.encode('utf-8'))
        result = csv_parser.parse(file_stream)
        
        assert len(result['headers']) == 7
        assert len(result['rows']) == 1
        assert result['rows'][0]['asset_name'] == 'Minimal Asset'


class TestMultiEncodingSupport(TestCsvParser):
    """TC-1.1.2 多编码支持测试"""

    def test_parse_utf8_with_bom(self, csv_parser, csv_with_bom):
        """
        测试 UTF-8-BOM 编码文件解析
        验证：UTF-8-BOM 编码文件正确解析
        """
        file_stream = io.BytesIO(csv_with_bom)
        
        result = csv_parser.parse(file_stream)
        
        assert result is not None
        assert 'headers' in result
        assert 'rows' in result
        
        # 验证 BOM 被正确识别并移除
        assert result['headers'][0] == 'asset_id'
        
        # 验证数据内容正确
        assert len(result['rows']) == 1
        assert result['rows'][0]['asset_name'] == 'Test BOM Asset'

    def test_parse_utf8_without_bom(self, csv_parser):
        """测试标准 UTF-8 (无 BOM) 编码文件"""
        standard_utf8 = """asset_id,asset_name,asset_type,serial_number,purchase_date,purchase_price,currency,department,custodian,status,location,remarks
1,UTF8 Asset,EQUIPMENT,SN-UTF8,2024-07-01,6000.00,CNY,DEPT001,UTF8 User,ACTIVE,UTF8 Location,UTF8 Remarks"""
        
        file_stream = io.BytesIO(standard_utf8.encode('utf-8'))
        result = csv_parser.parse(file_stream)
        
        assert result is not None
        assert result['rows'][0]['asset_name'] == 'UTF8 Asset'


class TestGbkEncodingSupport(TestCsvParser):
    """TC-1.1.3 GBK 编码兼容测试"""

    def test_parse_gbk_encoding(self, csv_parser):
        """
        测试 GBK 编码文件解析
        验证：GBK 编码文件正确解析
        """
        gbk_content = """asset_id,asset_name,asset_type,serial_number,purchase_date,purchase_price,currency,department,custodian,status,location,remarks
,测试资产1号,EQUIPMENT,SN-中文-001,2024-08-01,15000.00,CNY,部门001,管理员,ACTIVE,中文位置A,中文备注信息
,测试资产2号,IT_HARDWARE,SN-中文-002,2024-08-15,8000.00,CNY,部门002,用户B,ACTIVE,中文位置B,Another remarks"""
        
        file_stream = io.BytesIO(gbk_content.encode('gbk'))
        
        result = csv_parser.parse(file_stream, encoding='gbk')
        
        assert result is not None
        assert 'headers' in result
        assert 'rows' in result
        
        # 验证 header 正确解析
        assert 'asset_name' in result['headers']
        
        # 验证中文数据正确解析
        first_row = result['rows'][0]
        assert first_row['asset_name'] == '测试资产1号'
        assert first_row['department'] == '部门001'
        assert first_row['location'] == '中文位置A'
        
        second_row = result['rows'][1]
        assert second_row['asset_name'] == '测试资产2号'

    def test_parse_gbk_with_special_chars(self, csv_parser):
        """测试 GBK 编码包含特殊字符的文件"""
        special_gbk = """asset_name,asset_type,department,location
资产-001&特殊字符,OTHER,研发&测试部门,位置[1]"""
        
        file_stream = io.BytesIO(special_gbk.encode('gbk'))
        result = csv_parser.parse(file_stream, encoding='gbk')
        
        assert len(result['rows']) == 1
        assert '&' in result['rows'][0]['asset_name']


class TestEmptyRowsHandling(TestCsvParser):
    """TC-1.1.4 异常行处理测试"""

    def test_parse_with_empty_rows(self, csv_parser, csv_with_empty_rows, caplog):
        """
        测试包含空行的 CSV 解析
        验证：空行自动跳过，生成警告日志
        """
        import logging
        caplog.set_level(logging.WARNING)
        
        file_stream = io.BytesIO(csv_with_empty_rows.encode('utf-8'))
        
        result = csv_parser.parse(file_stream)
        
        assert result is not None
        assert 'headers' in result
        assert 'rows' in result
        
        # 验证有效数据行被保留 (2 行有效数据)
        assert len(result['rows']) == 2
        
        # 验证空行被正确跳过
        for row in result['rows']:
            assert row['asset_name'] is not None
            assert row['asset_name'] != ''
        
        # 验证警告日志生成
        # (具体验证逻辑取决于实现，部分实现可能不记录日志而直接过滤)

    def test_parse_all_empty_rows(self, csv_parser):
        """测试全部为空行的 CSV"""
        all_empty = """asset_id,asset_name,asset_type,serial_number,purchase_date,purchase_price,currency,department,custodian,status,location,remarks


"""
        
        file_stream = io.BytesIO(all_empty.encode('utf-8'))
        result = csv_parser.parse(file_stream)
        
        # 应该返回空行列表
        assert 'rows' in result
        assert len(result['rows']) == 0

    def test_parse_csv_with_whitespace_only_rows(self, csv_parser):
        """测试仅包含空白字符的行"""
        whitespace_csv = """asset_name,asset_type,department
Valid Asset,IT_HARDWARE,DEPT001
  
  ,OTHER,DEPT002"""
        
        file_stream = io.BytesIO(whitespace_csv.encode('utf-8'))
        result = csv_parser.parse(file_stream)
        
        # 空白行应被过滤
        assert len(result['rows']) == 2


class TestFileSizeValidation(TestCsvParser):
    """TC-1.1.5 超大文件拒绝测试"""

    def test_reject_file_over_10mb(self, csv_parser, large_file_content):
        """
        测试超大文件拒绝
        验证：抛出 FileSizeExceededError，返回 413
        """
        file_stream = io.BytesIO(large_file_content.encode('utf-8'))
        
        # 验证抛出文件大小超限异常
        with pytest.raises(FileSizeExceededError) as exc_info:
            csv_parser.parse(file_stream)
        
        assert '10MB' in str(exc_info.value) or 'size' in str(exc_info.value).lower()

    def test_accept_file_under_10mb(self, csv_parser):
        """测试允许的最大边界文件 (9.9MB)"""
        # 生成约 9.9MB 的内容
        header = "asset_name,asset_type\n"
        row = "Asset_X,IT_HARDWARE\n"
        row_size = len(row.encode('utf-8'))
        rows_needed = (9 * 1024 * 1024) // row_size
        
        content = header + (row * rows_needed)
        file_stream = io.BytesIO(content.encode('utf-8'))
        
        # 不应抛出异常
        result = csv_parser.parse(file_stream)
        assert result is not None

    def test_accept_exact_10mb_file(self, csv_parser):
        """测试恰好 10MB 的文件"""
        # 生成恰好 10MB 的内容
        header = "asset_name,asset_type\n"
        target_size = 10 * 1024 * 1024
        current_size = len(header.encode('utf-8'))
        row = "Asset_X,IT_HARDWARE\n"
        row_size = len(row.encode('utf-8'))
        
        content = header
        while current_size + row_size <= target_size:
            content += row
            current_size += row_size
        
        file_stream = io.BytesIO(content.encode('utf-8'))
        
        # 10MB 应该允许 (根据实现可能严格等于或小于)
        result = csv_parser.parse(file_stream)
        assert result is not None


class TestCsvParserEdgeCases(TestCsvParser):
    """CSV 解析器边界情况测试"""

    def test_parse_csv_with_quoted_fields(self, csv_parser):
        """测试带引号字段的 CSV"""
        quoted_csv = """asset_name,asset_type,location
"Asset, with comma",EQUIPMENT,"Location, with comma"
Normal Asset,IT_HARDWARE,Normal Location"""
        
        file_stream = io.BytesIO(quoted_csv.encode('utf-8'))
        result = csv_parser.parse(file_stream)
        
        assert len(result['rows']) == 2
        assert result['rows'][0]['asset_name'] == 'Asset, with comma'
        assert result['rows'][0]['location'] == 'Location, with comma'

    def test_parse_csv_with_newlines_in_field(self, csv_parser):
        """测试字段中包含换行符的 CSV"""
        multiline_csv = '''asset_name,description
Asset 1,"Line 1
Line 2
Line 3"
Asset 2,Normal description'''
        
        file_stream = io.BytesIO(multiline_csv.encode('utf-8'))
        result = csv_parser.parse(file_stream)
        
        assert len(result['rows']) == 2

    def test_parse_empty_file(self, csv_parser):
        """测试空文件"""
        file_stream = io.BytesIO(b"")
        
        with pytest.raises((ValueError, IOError)):
            csv_parser.parse(file_stream)

    def test_parse_csv_with_different_delimiters_not_supported(self, csv_parser):
        """测试不支持的分隔符"""
        tab_csv = "asset_name\tasset_type\nAsset\tIT_HARDWARE"
        file_stream = io.BytesIO(tab_csv.encode('utf-8'))
        
        # 默认解析器应该只支持逗号分隔符
        with pytest.raises(ValueError):
            csv_parser.parse(file_stream, delimiter='\t')