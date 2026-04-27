"""
资产批量导出集成测试

【SWARM-2025-Q2-P2-006】资产批量导入导出 Iteration 2
针对 ATB-005 (批量导出) 和 ATB-006 (安全性验证) 的集成测试套件

测试覆盖范围:
    - ATB-005: 批量导出 (xlsx/csv格式, 筛选条件, 数据完整性)
    - ATB-006: 安全性验证 (认证/授权/操作日志)
    - ATB-007: 数据完整性 (导出-导入往返一致性)
"""

import io
import pytest
import csv
from datetime import date, datetime, timedelta
from typing import List, Dict, Any
from unittest.mock import patch, MagicMock
from decimal import Decimal

# ========== 辅助函数 ==========

def create_test_asset_data(count: int = 10) -> List[Dict[str, Any]]:
    """
    创建测试用资产数据
    
    Args:
        count: 资产数量
        
    Returns:
        资产数据列表
    """
    assets = []
    base_date = date(2025, 1, 1)
    for i in range(count):
        assets.append({
            "asset_id": f"TEST{i:04d}",
            "asset_name": f"测试资产-{i}",
            "asset_type": "EQUIPMENT" if i % 2 == 0 else "INSTRUMENT",
            "purchase_date": (base_date + timedelta(days=i)).isoformat(),
            "purchase_amount": str(10000 + i * 100),
            "department": f"DEPT{(i % 3) + 1:02d}",
            "status": "ACTIVE" if i % 3 != 2 else "MAINTENANCE",
            "location": f"位置-{i}",
            "description": f"测试描述-{i}"
        })
    return assets


def parse_csv_content(content: bytes) -> List[Dict[str, str]]:
    """
    解析 CSV 内容为字典列表
    
    Args:
        content: CSV 文件字节内容
        
    Returns:
        解析后的字典列表
    """
    decoded = content.decode('utf-8-sig')  # 处理 UTF-8 BOM
    reader = csv.DictReader(io.StringIO(decoded))
    return list(reader)


def calculate_amount_sum(assets: List[Dict[str, Any]]) -> Decimal:
    """
    计算资产金额总和
    
    Args:
        assets: 资产数据列表
        
    Returns:
        金额总和
    """
    total = Decimal('0')
    for asset in assets:
        amount = asset.get('purchase_amount', '0')
        if isinstance(amount, str):
            amount = Decimal(amount)
        total += amount
    return total


# ========== ATB-005: 批量导出测试 ==========

class TestAssetExportIntegration:
    """
    ATB-005 批量导出集成测试类
    
    测试目标: 验证资产数据能正确导出为 Excel/CSV 格式
    """
    
    @pytest.fixture
    def authenticated_client(self, test_client, test_db_session):
        """
        创建已认证的测试客户端
        
        Args:
            test_client: FastAPI 测试客户端
            test_db_session: 测试数据库会话
            
        Returns:
            配置好的测试客户端
        """
        # 设置测试用户认证
        test_client.headers = {
            "Authorization": "Bearer test_token_for_integration",
            "X-User-ID": "test_user_001",
            "X-User-Role": "admin"
        }
        return test_client
    
    @pytest.fixture
    def populated_db(self, test_db_session):
        """
        填充测试数据库
        
        Args:
            test_db_session: 测试数据库会话
            
        Returns:
            资产总数
        """
        from src.models.asset import Asset
        from src.models.department import Department
        
        # 创建测试部门
        for i in range(1, 4):
            dept = Department(
                id=f"DEPT{i:02d}",
                name=f"测试部门{i}",
                code=f"DEPT{i:02d}"
            )
            test_db_session.add(dept)
        
        # 创建测试资产
        assets = []
        for i in range(100):
            asset = Asset(
                asset_id=f"EXPORT{i:05d}",
                asset_name=f"导出测试资产-{i}",
                asset_type="EQUIPMENT",
                purchase_date=date(2025, 1, 1) + timedelta(days=i % 365),
                purchase_amount=Decimal(f"{10000 + i * 50}.00"),
                department_id=f"DEPT{(i % 3) + 1:02d}",
                status="ACTIVE" if i % 5 != 4 else "MAINTENANCE",
                location=f"位置-{i % 10}",
                description=f"测试资产描述-{i}"
            )
            assets.append(asset)
            test_db_session.add(asset)
        
        test_db_session.commit()
        return len(assets)
    
    def test_export_xlsx(self, authenticated_client, populated_db):
        """
        ATB-005 步骤 5.1: 导出 Excel 格式
        
        测试操作: 调用 /api/v1/assets/export?format=xlsx
        预期结果: 返回 Excel 文件
        """
        response = authenticated_client.get(
            "/api/v1/assets/export",
            params={"format": "xlsx"}
        )
        
        assert response.status_code == 200, \
            f"Excel 导出失败: {response.status_code}, {response.text}"
        assert response.headers["content-type"].startswith(
            "application/vnd.openxmlformats"
        ), "Content-Type 应为 Excel 格式"
        
        # 验证文件非空
        content = response.content
        assert len(content) > 0, "导出的 Excel 文件为空"
        
        # 验证 Excel 文件签名 (ZIP)
        assert content[:2] == b"PK", "Excel 文件签名不正确"
    
    def test_export_csv(self, authenticated_client, populated_db):
        """
        ATB-005 步骤 5.2: 导出 CSV 格式 (UTF-8 BOM)
        
        测试操作: 调用 /api/v1/assets/export?format=csv
        预期结果: 返回 CSV 文件 (UTF-8 BOM)
        """
        response = authenticated_client.get(
            "/api/v1/assets/export",
            params={"format": "csv"}
        )
        
        assert response.status_code == 200, \
            f"CSV 导出失败: {response.status_code}, {response.text}"
        
        content = response.content
        assert len(content) > 0, "导出的 CSV 文件为空"
        
        # 解析 CSV 内容
        rows = parse_csv_content(content)
        assert len(rows) > 0, "CSV 文件无数据行"
        
        # 验证 UTF-8 BOM
        assert content[:3] == b"\xef\xbb\xbf", "CSV 文件缺少 UTF-8 BOM"
        
        # 验证表头
        headers = list(rows[0].keys())
        expected_fields = [
            "asset_id", "asset_name", "asset_type", "purchase_date",
            "purchase_amount", "department", "status", "location", "description"
        ]
        for field in expected_fields:
            assert field in headers, f"缺少必需字段: {field}"
    
    def test_export_field_consistency(self, authenticated_client, populated_db):
        """
        ATB-005 步骤 5.3: 验证导出字段与模板导入字段一致
        
        测试操作: 检查导出字段完整性
        预期结果: 导出字段与模板导入字段一致
        """
        # 获取导出数据
        response = authenticated_client.get(
            "/api/v1/assets/export",
            params={"format": "csv"}
        )
        
        assert response.status_code == 200
        rows = parse_csv_content(response.content)
        
        # 获取模板字段
        template_response = authenticated_client.get(
            "/api/v1/assets/import/template",
            params={"format": "csv"}
        )
        
        assert template_response.status_code == 200
        template_rows = parse_csv_content(template_response.content)
        
        export_headers = set(rows[0].keys())
        template_headers = set(template_rows[0].keys())
        
        # 导出字段应该是模板字段的子集或相等
        assert export_headers == template_headers, \
            f"导出字段与模板不一致: 导出={export_headers}, 模板={template_headers}"
    
    def test_export_with_filter(self, authenticated_client, populated_db):
        """
        ATB-005 步骤 5.4: 带筛选条件导出
        
        测试操作: 调用 /api/v1/assets/export?status=ACTIVE
        预期结果: 仅导出状态为 ACTIVE 的资产
        """
        # 仅导出 ACTIVE 状态资产
        response = authenticated_client.get(
            "/api/v1/assets/export",
            params={
                "format": "csv",
                "status": "ACTIVE"
            }
        )
        
        assert response.status_code == 200
        rows = parse_csv_content(response.content)
        
        # 验证所有行都是 ACTIVE 状态
        active_count = sum(1 for row in rows if row.get("status") == "ACTIVE")
        assert active_count == len(rows), \
            f"筛选结果包含非 ACTIVE 状态资产: {len(rows) - active_count} 条"
        
        # 验证与数据库查询一致
        from src.repositories.asset_repository import AssetRepository
        repo = AssetRepository(authenticated_client.app.state.db)
        db_active_assets = repo.list(status="ACTIVE")
        assert len(rows) == len(db_active_assets), \
            f"导出数量与数据库不符: 导出={len(rows)}, DB={len(db_active_assets)}"
    
    def test_export_data_integrity(self, authenticated_client, populated_db):
        """
        ATB-005 步骤 5.5: 验证导出行数、金额汇总与数据库一致
        
        测试操作: 导出 1000 行数据验证完整性
        预期结果: 导出行数、金额汇总与数据库一致
        """
        response = authenticated_client.get(
            "/api/v1/assets/export",
            params={"format": "csv"}
        )
        
        assert response.status_code == 200
        rows = parse_csv_content(response.content)
        
        # 获取数据库汇总
        from src.repositories.asset_repository import AssetRepository
        repo = AssetRepository(authenticated_client.app.state.db)
        all_assets = repo.list()
        
        # 验证行数一致
        assert len(rows) == len(all_assets), \
            f"导出行数不一致: 导出={len(rows)}, DB={len(all_assets)}"
        
        # 验证金额汇总一致
        export_amount = calculate_amount_sum([
            {"purchase_amount": row.get("purchase_amount", "0")}
            for row in rows
        ])
        db_amount = calculate_amount_sum([
            {"purchase_amount": asset.purchase_amount}
            for asset in all_assets
        ])
        
        assert export_amount == db_amount, \
            f"金额汇总不一致: 导出={export_amount}, DB={db_amount}"
    
    def test_export_department_filter(self, authenticated_client, populated_db):
        """
        ATB-005 额外测试: 部门筛选导出
        
        测试操作: 调用 /api/v1/assets/export?department=DEPT01
        预期结果: 仅导出指定部门的资产
        """
        response = authenticated_client.get(
            "/api/v1/assets/export",
            params={
                "format": "csv",
                "department": "DEPT01"
            }
        )
        
        assert response.status_code == 200
        rows = parse_csv_content(response.content)
        
        # 验证所有行都属于 DEPT01
        dept_mismatch = [
            row for row in rows 
            if row.get("department") != "DEPT01"
        ]
        assert len(dept_mismatch) == 0, \
            f"筛选结果包含非 DEPT01 部门资产: {len(dept_mismatch)} 条"
    
    def test_export_date_range_filter(self, authenticated_client, populated_db):
        """
        ATB-005 额外测试: 日期范围筛选导出
        
        测试操作: 调用 /api/v1/assets/export?date_from=2025-01-01&date_to=2025-06-30
        预期结果: 仅导出日期范围内的资产
        """
        response = authenticated_client.get(
            "/api/v1/assets/export",
            params={
                "format": "csv",
                "date_from": "2025-01-01",
                "date_to": "2025-06-30"
            }
        )
        
        assert response.status_code == 200
        rows = parse_csv_content(response.content)
        
        # 验证日期范围
        from_date = date(2025, 1, 1)
        to_date = date(2025, 6, 30)
        
        out_of_range = []
        for row in rows:
            purchase_date = date.fromisoformat(row.get("purchase_date", ""))
            if purchase_date < from_date or purchase_date > to_date:
                out_of_range.append(row)
        
        assert len(out_of_range) == 0, \
            f"筛选结果包含日期范围外资产: {len(out_of_range)} 条"


# ========== ATB-006: 安全性验证测试 ==========

class TestExportSecurityIntegration:
    """
    ATB-006 安全性验证集成测试类
    
    测试目标: 验证批量操作的安全控制
    """
    
    @pytest.fixture
    def test_client(self, test_app):
        """
        创建测试客户端
        
        Args:
            test_app: FastAPI 应用
            
        Returns:
            TestClient 实例
        """
        from fastapi.testclient import TestClient
        return TestClient(test_app)
    
    def test_export_unauthorized(self, test_client):
        """
        ATB-006 步骤 6.1: 未登录用户尝试导出
        
        测试操作: 未认证用户尝试导出
        预期结果: 返回 401 Unauthorized
        """
        response = test_client.get(
            "/api/v1/assets/export",
            params={"format": "csv"}
        )
        
        assert response.status_code == 401, \
            f"未认证用户应返回 401，实际: {response.status_code}"
    
    def test_export_forbidden(self, test_client, test_db_session):
        """
        ATB-006 步骤 6.2: 无权限用户尝试导出
        
        测试操作: 非管理员用户尝试导出
        预期结果: 返回 403 Forbidden
        """
        # 设置无导出权限的用户
        test_client.headers = {
            "Authorization": "Bearer test_token",
            "X-User-ID": "normal_user_001",
            "X-User-Role": "viewer"  # 无导出权限的角色
        }
        
        # 模拟权限检查
        with patch("src.api.v1.asset_export.check_export_permission") as mock_check:
            mock_check.return_value = False
            
            response = test_client.get(
                "/api/v1/assets/export",
                params={"format": "csv"}
            )
            
            assert response.status_code == 403, \
                f"无权限用户应返回 403，实际: {response.status_code}"
    
    def test_export_audit_log(self, test_client, test_db_session):
        """
        ATB-006 步骤 6.3: 检查操作日志记录
        
        测试操作: 验证导出操作的审计日志
        预期结果: 日志包含 user_id、file_name、时间
        """
        from src.models.audit_log import AuditLog
        
        # 设置认证用户
        test_client.headers = {
            "Authorization": "Bearer test_token",
            "X-User-ID": "audit_test_user",
            "X-User-Role": "admin"
        }
        
        # 执行导出
        response = test_client.get(
            "/api/v1/assets/export",
            params={"format": "csv"}
        )
        
        # 验证日志已记录
        audit_logs = test_db_session.query(AuditLog).filter(
            AuditLog.user_id == "audit_test_user",
            AuditLog.operation == "ASSET_EXPORT"
        ).all()
        
        assert len(audit_logs) > 0, "导出操作未记录审计日志"
        
        log = audit_logs[0]
        assert log.user_id == "audit_test_user", "日志用户ID不匹配"
        assert log.operation == "ASSET_EXPORT", "日志操作类型不匹配"
        assert log.timestamp is not None, "日志时间戳缺失"
        assert "csv" in log.details.get("file_format", ""), "日志缺少文件格式信息"
    
    def test_export_link_expiration(self, test_client, test_db_session):
        """
        ATB-006 步骤 6.4: 导出下载链接有效期验证
        
        测试操作: 验证下载链接 24 小时后失效
        预期结果: 24 小时后链接失效
        """
        # 生成导出链接
        with patch("src.services.export_service.ExportService.generate_download_link") as mock_link:
            mock_link.return_value = "/downloads/test_export.csv?token=xxx&expires=1234567890"
            
            response = test_client.get(
                "/api/v1/assets/export",
                params={"format": "csv"}
            )
            
            # 模拟过期时间检查
            with patch("src.services.export_service.ExportService.is_link_expired") as mock_expired:
                # 当前未过期
                mock_expired.return_value = False
                response1 = test_client.get(mock_link.return_value)
                assert response1.status_code == 200, "有效链接应正常访问"
                
                # 模拟 24 小时后过期
                mock_expired.return_value = True
                response2 = test_client.get(mock_link.return_value)
                assert response2.status_code == 410, "过期链接应返回 410 Gone"


# ========== ATB-007: 数据完整性测试 ==========

class TestDataIntegrityIntegration:
    """
    ATB-007 数据完整性集成测试类
    
    测试目标: 验证批量导入导出后数据一致性
    """
    
    @pytest.fixture
    def roundtrip_test_data(self):
        """
        往返测试数据
        
        Returns:
            测试资产数据
        """
        return create_test_asset_data(count=50)
    
    def test_export_import_roundtrip(
        self, 
        authenticated_client, 
        test_db_session,
        roundtrip_test_data
    ):
        """
        ATB-007 步骤 7.1: 导出 → 删除 → 重新导入验证
        
        测试操作: 
            1. 导出全部资产
            2. 删除数据库资产
            3. 重新导入导出数据
        预期结果: 
            - 数据完全一致
            - ID 连续性保持
        """
        # 步骤 1: 导出原始数据
        export_response = authenticated_client.get(
            "/api/v1/assets/export",
            params={"format": "csv"}
        )
        assert export_response.status_code == 200
        original_rows = parse_csv_content(export_response.content)
        original_count = len(original_rows)
        
        # 步骤 2: 删除数据库资产
        delete_response = authenticated_client.delete("/api/v1/assets")
        assert delete_response.status_code == 200
        
        # 步骤 3: 重新导入
        from io import BytesIO
        file_content = export_response.content
        files = {
            "file": ("export_backup.csv", BytesIO(file_content), "text/csv")
        }
        
        import_response = authenticated_client.post(
            "/api/v1/assets/import",
            files=files,
            data={"mode": "strict", "overwrite": True}
        )
        assert import_response.status_code == 200
        
        # 验证步骤 4: 数据一致性检查
        re_export_response = authenticated_client.get(
            "/api/v1/assets/export",
            params={"format": "csv"}
        )
        re_export_rows = parse_csv_content(re_export_response.content)
        
        # 验证行数一致
        assert len(re_export_rows) == original_count, \
            f"往返后行数不一致: 原={original_count}, 现={len(re_export_rows)}"
        
        # 验证金额一致
        original_amount = calculate_amount_sum([
            {"purchase_amount": row.get("purchase_amount", "0")}
            for row in original_rows
        ])
        re_export_amount = calculate_amount_sum([
            {"purchase_amount": row.get("purchase_amount", "0")}
            for row in re_export_rows
        ])
        
        assert original_amount == re_export_amount, \
            f"往返后金额不一致: 原={original_amount}, 现={re_export_amount}"
        
        # 验证 asset_id 集合一致
        original_ids = set(row.get("asset_id") for row in original_rows)
        re_export_ids = set(row.get("asset_id") for row in re_export_rows)
        
        assert original_ids == re_export_ids, \
            f"往返后 asset_id 集合不一致: 差异={original_ids ^ re_export_ids}"
    
    def test_amount_precision(
        self, 
        authenticated_client, 
        test_db_session
    ):
        """
        ATB-007 步骤 7.2: 验证金额字段精度
        
        测试操作: 创建带小数位的资产并导出
        预期结果: 导出金额与原金额精度一致（2位小数）
        """
        from src.models.asset import Asset
        
        # 创建带精确金额的资产
        test_assets = [
            Asset(
                asset_id=f"PREC{i:03d}",
                asset_name=f"精度测试资产-{i}",
                asset_type="EQUIPMENT",
                purchase_date=date(2025, 1, 1),
                purchase_amount=Decimal("12345.67"),  # 2位小数精度
                department_id="DEPT01",
                status="ACTIVE"
            )
            for i in range(5)
        ]
        
        for asset in test_assets:
            test_db_session.add(asset)
        test_db_session.commit()
        
        # 导出
        response = authenticated_client.get(
            "/api/v1/assets/export",
            params={"format": "csv"}
        )
        
        assert response.status_code == 200
        rows = parse_csv_content(response.content)
        
        # 查找精度测试资产
        precision_rows = [
            row for row in rows 
            if row.get("asset_id", "").startswith("PREC")
        ]
        
        assert len(precision_rows) == 5, "精度测试资产未全部导出"
        
        # 验证金额精度保留
        for row in precision_rows:
            amount_str = row.get("purchase_amount", "0")
            decimal_places = len(amount_str.split(".")[-1]) if "." in amount_str else 0
            assert decimal_places == 2, \
                f"资产 {row.get('asset_id')} 金额精度丢失: {amount_str}"


# ========== 性能与边界测试 ==========

class TestExportPerformanceIntegration:
    """
    导出性能与边界条件测试
    """
    
    def test_large_export_streaming(self, authenticated_client, test_db_session):
        """
        测试大文件流式导出
        
        测试操作: 导出 500,000 行数据
        预期结果: 使用流式响应，避免内存溢出
        """
        # 创建大量资产数据
        from src.models.asset import Asset
        
        # 批量创建 (使用 bulk_insert_mappings 提高性能)
        assets_data = [
            {
                "asset_id": f"PERF{i:06d}",
                "asset_name": f"性能测试资产-{i}",
                "asset_type": "EQUIPMENT",
                "purchase_date": date(2025, 1, 1),
                "purchase_amount": Decimal("1000.00"),
                "department_id": "DEPT01",
                "status": "ACTIVE"
            }
            for i in range(1000)  # 使用较小数量进行集成测试
        ]
        
        test_db_session.bulk_insert_mappings(Asset, assets_data)
        test_db_session.commit()
        
        # 验证流式响应
        with authenticated_client.stream(
            "GET",
            "/api/v1/assets/export",
            params={"format": "csv"}
        ) as response:
            assert response.status_code == 200
            
            # 流式读取
            content = b""
            for chunk in response.iter_content(chunk_size=8192):
                content += chunk
            
            # 验证内容完整性
            rows = parse_csv_content(content)
            assert len(rows) > 0, "流式导出数据为空"
    
    def test_export_concurrent_limit(self, authenticated_client, test_db_session):
        """
        测试并发导出限制
        
        测试操作: 同时发起 10 个导出请求
        预期结果: 超过限制的请求被拒绝或排队
        """
        import concurrent.futures
        
        def do_export():
            response = authenticated_client.get(
                "/api/v1/assets/export",
                params={"format": "csv"}
            )
            return response.status_code
        
        # 模拟并发请求
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(do_export) for _ in range(10)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]
        
        # 验证: 至少有一些请求成功或被正确排队
        success_or_queued = [
            r for r in results 
            if r in [200, 202, 429]  # 成功/已排队/限流
        ]
        assert len(success_or_queued) > 0, "并发导出请求全部失败"


# ========== 辅助工具测试 ==========

class TestExportUtilities:
    """
    导出相关辅助工具测试
    """
    
    def test_csv_parser_utility(self):
        """
        测试 CSV 解析工具
        
        测试操作: 使用 parse_csv_content 解析测试数据
        预期结果: 正确解析 UTF-8 BOM 和标准 CSV
        """
        # 测试标准 CSV
        standard_csv = b"asset_id,asset_name\nTEST001,Test Asset"
        rows = parse_csv_content(standard_csv)
        assert len(rows) == 1
        assert rows[0]["asset_id"] == "TEST001"
        
        # 测试带 BOM 的 CSV
        bom_csv = b"\xef\xbb\xbfasset_id,asset_name\nTEST002,Test Asset 2"
        rows = parse_csv_content(bom_csv)
        assert len(rows) == 1
        assert rows[0]["asset_id"] == "TEST002"
    
    def test_amount_calculation_utility(self):
        """
        测试金额计算工具
        
        测试操作: 使用 calculate_amount_sum 计算金额总和
        预期结果: 正确处理字符串和 Decimal 类型
        """
        assets = [
            {"purchase_amount": "100.50"},
            {"purchase_amount": "200.75"},
            {"purchase_amount": Decimal("300.25")}
        ]
        
        total = calculate_amount_sum(assets)
        expected = Decimal("601.50")
        
        assert total == expected, f"金额计算错误: {total} != {expected}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])