"""
SWARM-003 操作日志仪表板 - 风险分布 API 测试

测试目标: GET /api/v1/logs/risk/distribution

验收标准: ATB-003
    - 验证风险等级占比计算准确性
    - 验证所有风险等级占比之和为 100%
    - 验证数据格式符合 Graphify 可视化组件预期

依赖服务:
    - LogAggregationService
    - RiskAnalysisService

Author: SWARM-003 Team
Since: Iteration 1
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient


class TestRiskDistributionAPI:
    """风险分布 API 端点测试套件"""

    @pytest.fixture
    def mock_logs_with_various_risks(self):
        """生成包含各风险等级的测试日志数据"""
        risk_levels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        logs = []
        for i, level in enumerate(risk_levels):
            logs.extend([
                {
                    "id": 1000 + i * 100 + j,
                    "user_id": f"user_{j}",
                    "operation_type": "UPDATE",
                    "resource_type": "Asset",
                    "resource_id": f"asset_{j}",
                    "risk_level": level,
                    "ip_address": "192.168.1.100",
                    "detail": {"field": "status", "old": "active", "new": "inactive"},
                    "created_at": (datetime.now() - timedelta(days=j)).isoformat()
                }
                for j in range(5)  # 每个等级 5 条日志
            ])
        return logs

    @pytest.fixture
    def mock_single_risk_logs(self):
        """生成仅包含单一风险等级的测试数据"""
        return [
            {
                "id": i,
                "risk_level": "LOW",
                "operation_type": "READ",
                "created_at": datetime.now().isoformat()
            }
            for i in range(10)
        ]

    @pytest.fixture
    def mock_empty_logs(self):
        """空日志数据集"""
        return []

    @pytest.fixture
    def mock_zero_counts(self):
        """存在风险等级但计数为零的情况"""
        return [
            {"risk_level": "LOW", "count": 0},
            {"risk_level": "MEDIUM", "count": 0},
            {"risk_level": "HIGH", "count": 0},
            {"risk_level": "CRITICAL", "count": 0},
        ]


class TestRiskDistributionRatios(TestRiskDistributionAPI):
    """ATB-003: 验证风险等级占比计算准确性"""

    def test_risk_distribution_ratios_sum_to_100(
        self, 
        client: TestClient,
        mock_logs_with_various_risks
    ):
        """
        ATB-003: 验证风险分布占比之和为 100%
        
        测试场景: 当存在各风险等级的日志时，占比计算应准确
        预期结果: 所有 risk_level 的 ratio 之和等于 100.0（浮点误差 < 0.01）
        """
        with patch("api.routers.audit_router.get_audit_logs") as mock_get:
            mock_get.return_value = mock_logs_with_various_risks
            
            response = client.get("/api/v1/logs/risk/distribution")
            
            assert response.status_code == 200
            data = response.json()
            
            # 验证响应结构
            assert "success" in data
            assert data["success"] is True
            assert "data" in data
            assert "distribution" in data["data"]
            
            distribution = data["data"]["distribution"]
            
            # ATB-003: 核心断言 - 占比之和为 100%
            total_ratio = sum(item["ratio"] for item in distribution)
            assert abs(total_ratio - 100.0) < 0.01, (
                f"风险占比之和 {total_ratio}% 不等于 100%"
            )

    def test_single_risk_level_allocation(
        self,
        client: TestClient,
        mock_single_risk_logs
    ):
        """
        ATB-003: 验证单一风险等级场景
        
        测试场景: 所有日志均为 LOW 风险等级
        预期结果: LOW 占比为 100%，其余等级占比为 0
        """
        with patch("api.routers.audit_router.get_audit_logs") as mock_get:
            mock_get.return_value = mock_single_risk_logs
            
            response = client.get("/api/v1/logs/risk/distribution")
            data = response.json()
            
            distribution = {
                item["level"]: item["ratio"] 
                for item in data["data"]["distribution"]
            }
            
            assert distribution["LOW"] == 100.0
            assert distribution["MEDIUM"] == 0.0
            assert distribution["HIGH"] == 0.0
            assert distribution["CRITICAL"] == 0.0

    def test_zero_counts_allocation(self, client: TestClient, mock_zero_counts):
        """
        ATB-003: 验证零计数边界情况
        
        测试场景: 所有风险等级计数均为 0
        预期结果: 各等级占比为 0（避免除零错误）
        """
        with patch("api.routers.audit_router.get_risk_aggregation") as mock_agg:
            mock_agg.return_value = mock_zero_counts
            
            response = client.get("/api/v1/logs/risk/distribution")
            
            assert response.status_code == 200
            data = response.json()
            
            for item in data["data"]["distribution"]:
                assert item["ratio"] == 0.0
                assert item["count"] == 0

    def test_empty_logs_returns_zero_distribution(self, client: TestClient, mock_empty_logs):
        """
        ATB-003: 验证空日志数据集
        
        测试场景: 数据库中无操作日志
        预期结果: 返回空分布或全零分布
        """
        with patch("api.routers.audit_router.get_audit_logs") as mock_get:
            mock_get.return_value = mock_empty_logs
            
            response = client.get("/api/v1/logs/risk/distribution")
            
            assert response.status_code == 200
            data = response.json()
            
            distribution = data["data"]["distribution"]
            
            # 空数据时，各等级占比应为 0
            total_ratio = sum(item["ratio"] for item in distribution)
            assert total_ratio == 0.0


class TestRiskDistributionDataFormat(TestRiskDistributionAPI):
    """ATB-003: 验证响应数据格式符合可视化组件预期"""

    def test_distribution_item_structure(self, client: TestClient):
        """验证单个分布条目的数据结构"""
        response = client.get("/api/v1/logs/risk/distribution")
        data = response.json()
        
        required_fields = {"level", "count", "ratio"}
        
        for item in data["data"]["distribution"]:
            assert required_fields.issubset(item.keys()), (
                f"分布条目缺少必要字段: {required_fields - item.keys()}"
            )

    def test_risk_level_values(self, client: TestClient, mock_logs_with_various_risks):
        """验证风险等级枚举值正确"""
        with patch("api.routers.audit_router.get_audit_logs") as mock_get:
            mock_get.return_value = mock_logs_with_various_risks
            
            response = client.get("/api/v1/logs/risk/distribution")
            data = response.json()
            
            valid_levels = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
            returned_levels = {item["level"] for item in data["data"]["distribution"]}
            
            assert returned_levels == valid_levels, (
                f"风险等级不匹配. 期望: {valid_levels}, 实际: {returned_levels}"
            )

    def test_count_and_ratio_consistency(
        self, 
        client: TestClient, 
        mock_logs_with_various_risks
    ):
        """验证 count 和 ratio 数值一致性"""
        with patch("api.routers.audit_router.get_audit_logs") as mock_get:
            mock_get.return_value = mock_logs_with_various_risks
            
            response = client.get("/api/v1/logs/risk/distribution")
            data = response.json()
            
            total_count = sum(item["count"] for item in data["data"]["distribution"])
            
            for item in data["data"]["distribution"]:
                if total_count > 0:
                    expected_ratio = round((item["count"] / total_count) * 100, 2)
                    assert abs(item["ratio"] - expected_ratio) < 0.1, (
                        f"Count {item['count']} / Total {total_count} "
                        f"与 ratio {item['ratio']}% 不一致"
                    )


class TestRiskDistributionFilters(TestRiskDistributionAPI):
    """ATB-003: 验证筛选参数对风险分布的影响"""

    def test_time_range_filter(self, client: TestClient):
        """验证时间范围筛选"""
        params = {
            "start_date": (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d"),
            "end_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = client.get("/api/v1/logs/risk/distribution", params=params)
        
        assert response.status_code == 200
        
        # 验证时间范围参数被正确传递
        with patch("api.routers.audit_router.get_audit_logs") as mock_get:
            mock_get.return_value = []
            client.get("/api/v1/logs/risk/distribution", params=params)
            
            call_args = mock_get.call_args
            assert "start_date" in call_args.kwargs or "start_date" in str(call_args)

    def test_operation_type_filter(self, client: TestClient, mock_logs_with_various_risks):
        """验证操作类型筛选"""
        params = {"operation_type": "DELETE"}
        
        # 过滤出 DELETE 操作的日志
        delete_logs = [log for log in mock_logs_with_various_risks 
                      if log["operation_type"] == "DELETE"]
        
        with patch("api.routers.audit_router.get_audit_logs") as mock_get:
            mock_get.return_value = delete_logs if delete_logs else []
            
            response = client.get("/api/v1/logs/risk/distribution", params=params)
            
            assert response.status_code == 200


class TestRiskDistributionPerformance(TestRiskDistributionAPI):
    """ATB-003: 性能基准测试"""

    def test_large_dataset_response_time(self, client: TestClient):
        """PTB-003: 大数据集 (1000 条) 响应时间 ≤ 2 秒"""
        large_logs = [
            {
                "id": i,
                "risk_level": ["LOW", "MEDIUM", "HIGH", "CRITICAL"][i % 4],
                "operation_type": "UPDATE",
                "created_at": datetime.now().isoformat()
            }
            for i in range(1000)
        ]
        
        with patch("api.routers.audit_router.get_audit_logs") as mock_get:
            mock_get.return_value = large_logs
            
            import time
            start = time.time()
            
            response = client.get("/api/v1/logs/risk/distribution")
            
            elapsed = time.time() - start
            
            assert response.status_code == 200
            assert elapsed <= 2.0, f"响应时间 {elapsed:.2f}s 超过 2 秒阈值"

    def test_distribution_calculation_complexity(self, client: TestClient):
        """验证分布计算逻辑的时间复杂度"""
        # 生成 5000 条日志
        many_logs = [
            {
                "id": i,
                "risk_level": ["LOW", "MEDIUM", "HIGH", "CRITICAL"][i % 4],
                "operation_type": "CREATE",
                "created_at": datetime.now().isoformat()
            }
            for i in range(5000)
        ]
        
        with patch("api.routers.audit_router.get_audit_logs") as mock_get:
            mock_get.return_value = many_logs
            
            import time
            start = time.time()
            
            response = client.get("/api/v1/logs/risk/distribution")
            
            elapsed = time.time() - start
            
            # O(n) 算法应在合理时间内完成
            assert elapsed <= 5.0, f"5000 条数据计算耗时 {elapsed:.2f}s 过长"
            assert response.status_code == 200