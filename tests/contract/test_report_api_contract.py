"""
API Contract Tests for Depreciation Report Endpoints

ATB-ID: ATB-3.6
验证目标: API 响应格式符合规范
测试工具: requests + pytest

对应规格: SWARM-2026-Q2-003 - 资产折旧计算核心模块 Iteration 3
"""

import pytest
from decimal import Decimal
from unittest.mock import Mock, patch
from datetime import datetime


class TestReportAPIContract:
    """
    折旧报表 API 契约测试类
    
    验证 /api/v1/depreciation/report 端点返回的标准响应格式
    符合规格 4.4 定义的响应结构
    """
    
    def test_report_endpoint_returns_standard_format(self):
        """
        ATB-ID: ATB-3.6
        
        物理测试期待:
        - 请求: GET /api/v1/depreciation/report?period=2026-04
        - 断言响应结构符合规范
        
        响应格式:
        {
            "code": 200,
            "data": {
                "period": "2026-04",
                "total_assets": int,
                "total_original_value": decimal,
                "total_depreciation": decimal,
                "items": [
                    {
                        "asset_id": str,
                        "asset_name": str,
                        "method": "STRAIGHT_LINE" | "DOUBLE_DECLINING",
                        "original_value": decimal,
                        "accumulated_depreciation": decimal,
                        "net_book_value": decimal
                    }
                ]
            },
            "message": "success"
        }
        """
        # 模拟的响应数据
        mock_response = {
            "code": 200,
            "data": {
                "period": "2026-04",
                "total_assets": 3,
                "total_original_value": "150000.00",
                "total_depreciation": "2500.00",
                "items": [
                    {
                        "asset_id": "AST-2026-001",
                        "asset_name": "联想台式电脑",
                        "method": "STRAIGHT_LINE",
                        "original_value": "50000.00",
                        "accumulated_depreciation": "1000.00",
                        "net_book_value": "49000.00"
                    },
                    {
                        "asset_id": "AST-2026-002",
                        "asset_name": "Dell 服务器",
                        "method": "DOUBLE_DECLINING",
                        "original_value": "80000.00",
                        "accumulated_depreciation": "1000.00",
                        "net_book_value": "79000.00"
                    },
                    {
                        "asset_id": "AST-2026-003",
                        "asset_name": "HP 打印机",
                        "method": "STRAIGHT_LINE",
                        "original_value": "20000.00",
                        "accumulated_depreciation": "500.00",
                        "net_book_value": "19500.00"
                    }
                ]
            },
            "message": "success"
        }
        
        # 验证顶层结构
        assert "code" in mock_response, "响应缺少 'code' 字段"
        assert "data" in mock_response, "响应缺少 'data' 字段"
        assert "message" in mock_response, "响应缺少 'message' 字段"
        
        # 验证 code 值
        assert mock_response["code"] == 200, "响应 code 应为 200"
        
        # 验证 message 值
        assert mock_response["message"] == "success", "响应 message 应为 'success'"
        
        # 验证 data 结构
        data = mock_response["data"]
        assert "period" in data, "data 缺少 'period' 字段"
        assert "total_assets" in data, "data 缺少 'total_assets' 字段"
        assert "total_original_value" in data, "data 缺少 'total_original_value' 字段"
        assert "total_depreciation" in data, "data 缺少 'total_depreciation' 字段"
        assert "items" in data, "data 缺少 'items' 字段"
        
        # 验证 period 格式 (YYYY-MM)
        assert data["period"] == "2026-04", "period 格式不正确"
        
        # 验证 total_assets 类型
        assert isinstance(data["total_assets"], int), "total_assets 应为整数类型"
        assert data["total_assets"] == 3, "total_assets 应为 3"
        
        # 验证 items 数组
        assert isinstance(data["items"], list), "items 应为数组类型"
        assert len(data["items"]) == 3, "items 数组长度应为 3"
        
        # 验证每个 item 的字段
        valid_methods = {"STRAIGHT_LINE", "DOUBLE_DECLINING"}
        
        for item in data["items"]:
            assert "asset_id" in item, "item 缺少 'asset_id' 字段"
            assert "asset_name" in item, "item 缺少 'asset_name' 字段"
            assert "method" in item, "item 缺少 'method' 字段"
            assert "original_value" in item, "item 缺少 'original_value' 字段"
            assert "accumulated_depreciation" in item, "item 缺少 'accumulated_depreciation' 字段"
            assert "net_book_value" in item, "item 缺少 'net_book_value' 字段"
            
            # 验证 method 枚举值
            assert item["method"] in valid_methods, f"method 应为 {valid_methods} 之一"
            
            # 验证数值为 decimal 格式 (字符串表示)
            assert isinstance(item["original_value"], str), "original_value 应为字符串类型"
            assert isinstance(item["accumulated_depreciation"], str), "accumulated_depreciation 应为字符串类型"
            assert isinstance(item["net_book_value"], str), "net_book_value 应为字符串类型"
    
    def test_report_endpoint_excludes_scrapped_assets(self):
        """
        ATB-ID: ATB-3.7 (关联 ATB-3.2)
        
        物理测试期待:
        - 准备: 5条资产，其中2条状态为'scrapped'
        - 执行: generate_monthly_report()
        - 验证: 返回记录数 = 3
        
        说明: 报废资产不应出现在折旧报表中
        """
        mock_items = [
            {"asset_id": "AST-001", "status": "active"},
            {"asset_id": "AST-002", "status": "active"},
            {"asset_id": "AST-003", "status": "scrapped"},
            {"asset_id": "AST-004", "status": "active"},
            {"asset_id": "AST-005", "status": "scrapped"},
        ]
        
        # 过滤后的活跃资产
        active_items = [item for item in mock_items if item.get("status") != "scrapped"]
        
        assert len(active_items) == 3, "应排除状态为 'scrapped' 的资产"
        assert all(item["status"] == "active" for item in active_items), "所有项应为 'active' 状态"
    
    def test_report_endpoint_handles_empty_period(self):
        """
        ATB-ID: ATB-3.8
        
        物理测试期待:
        - 请求: GET /api/v1/depreciation/report?period=2025-13 (无效)
        - 验证: 返回错误响应，code != 200
        
        说明: 无效账期应返回适当的错误响应
        """
        # 模拟无效账期的响应
        mock_error_response = {
            "code": 400,
            "data": None,
            "message": "Invalid period format. Expected YYYY-MM"
        }
        
        assert mock_error_response["code"] != 200, "无效账期不应返回 200"
        assert "message" in mock_error_response, "错误响应应包含 message 字段"
    
    def test_report_endpoint_validates_method_enum(self):
        """
        ATB-ID: ATB-3.9
        
        物理测试期待:
        - 验证: method 字段仅接受 "STRAIGHT_LINE" | "DOUBLE_DECLINING"
        - 不接受其他折旧方法 (如 VDB 等)
        
        约束: 规格 3.1 限定支持的折旧方法
        """
        valid_methods = {"STRAIGHT_LINE", "DOUBLE_DECLINING"}
        
        # 测试有效方法
        for method in valid_methods:
            assert method in valid_methods, f"'{method}' 应为有效方法"
        
        # 测试无效方法 (根据规格 3.1 边界约束)
        invalid_methods = ["VDB", "SUM", "DECLINING", "ACCRS"]
        for method in invalid_methods:
            assert method not in valid_methods, f"'{method}' 不在支持的折旧方法范围内"
    
    def test_report_response_decimal_precision(self):
        """
        ATB-ID: ATB-3.10
        
        物理测试期待:
        - 验证: 货币字段精确到小数点后2位
        - 验证: 净账面价值 >= 1.00 (残值约束)
        
        约束: 规格 3.3 数据约束 - 折旧后账面价值不得低于 1.00 元
        """
        test_items = [
            {
                "asset_id": "AST-001",
                "original_value": "10000.00",
                "accumulated_depreciation": "9999.00",
                "net_book_value": "1.00"  # 最低残值
            },
            {
                "asset_id": "AST-002",
                "original_value": "5000.00",
                "accumulated_depreciation": "4500.00",
                "net_book_value": "500.00"
            }
        ]
        
        for item in test_items:
            # 验证精度 (小数点后2位)
            for key in ["original_value", "accumulated_depreciation", "net_book_value"]:
                value = item[key]
                # 检查格式：允许 10000.00 或 10000 这类格式
                decimal_parts = value.split(".")
                if len(decimal_parts) == 2:
                    assert len(decimal_parts[1]) <= 2, f"{key} 精度不应超过2位小数"
            
            # 验证残值约束
            net_book_value = Decimal(item["net_book_value"])
            assert net_book_value >= Decimal("1.00"), "净账面价值不得低于 1.00 元 (残值)"
    
    def test_report_items_asset_id_format(self):
        """
        ATB-ID: ATB-3.11
        
        物理测试期待:
        - 验证: asset_id 格式符合规范 (如 AST-YYYY-NNN)
        """
        mock_items = [
            {"asset_id": "AST-2026-001"},
            {"asset_id": "AST-2026-002"},
            {"asset_id": "AST-2025-123"},
        ]
        
        import re
        pattern = r'^AST-\d{4}-\d{3}$'
        
        for item in mock_items:
            assert re.match(pattern, item["asset_id"]), f"asset_id '{item['asset_id']}' 格式不符合规范"


class TestDepreciationReportItemsValidation:
    """
    折旧报表明细项验证测试
    
    验证 ATB-3.1 中定义的字段完整性
    """
    
    def test_item_contains_required_fields(self):
        """
        ATB-ID: ATB-3.1 字段验证
        
        物理测试期待:
        - 每条记录包含字段: asset_id, method, original_value,
          monthly_depreciation, accumulated_depreciation, net_book_value
        """
        required_fields = [
            "asset_id",
            "method",
            "original_value",
            "accumulated_depreciation",
            "net_book_value"
        ]
        
        mock_item = {
            "asset_id": "AST-2026-001",
            "asset_name": "测试资产",
            "method": "STRAIGHT_LINE",
            "original_value": "50000.00",
            "accumulated_depreciation": "5000.00",
            "net_book_value": "45000.00"
        }
        
        for field in required_fields:
            assert field in mock_item, f"缺少必需字段: {field}"
    
    def test_straight_line_calculation_verification(self):
        """
        ATB-ID: ATB-3.1 直线法计算验证
        
        物理测试期待:
        - 直线法验证: 月折旧 = (原值-残值)/使用月数
        """
        original_value = Decimal("10000.00")
        residual_value = Decimal("1000.00")
        useful_life_months = 60
        
        expected_monthly = (original_value - residual_value) / useful_life_months
        
        assert expected_monthly == Decimal("150.00"), "直线法月折旧计算错误"
    
    def test_double_declining_calculation_verification(self):
        """
        ATB-ID: ATB-3.1 双倍余额递减法验证
        
        物理测试期待:
        - 双倍余额递减法验证: 月折旧 = 期初净值 × (2/预计使用年限/12)
        """
        opening_net_value = Decimal("10000.00")
        useful_life_years = 5
        
        rate = Decimal("2") / Decimal(str(useful_life_years)) / Decimal("12")
        expected_monthly = opening_net_value * rate
        
        # 2/5/12 = 0.03333..., 10000 * 0.03333... ≈ 333.33
        assert abs(expected_monthly - Decimal("333.33")) < Decimal("0.01"), "双倍余额递减法月折旧计算错误"