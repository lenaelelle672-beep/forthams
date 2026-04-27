"""
资产总览服务单元测试

本模块针对 SWARM-003 仪表板数据看板功能提供资产总览相关服务的测试用例。
测试覆盖：资产总数统计、今日新增统计、分类统计、到期预警等核心功能。

SWARM-003: 仪表板数据看板 - 用户在首页可查看资产总览、分类统计图表及到期预警信息
"""

import pytest
from datetime import datetime, timedelta
from typing import List, Dict, Any
from unittest.mock import Mock, patch, MagicMock


class TestAssetOverviewService:
    """资产总览服务测试类
    
    针对资产总览相关的业务逻辑进行单元测试，包括：
    - 资产总数统计
    - 时间维度统计（今日新增、本月变更）
    - 分类统计
    - 到期预警查询
    """
    
    @pytest.fixture
    def mock_asset_repository(self):
        """创建模拟的资产仓储对象
        
        Returns:
            Mock: 模拟的资产仓储对象
        """
        mock_repo = Mock()
        return mock_repo
    
    @pytest.fixture
    def asset_overview_service(self, mock_asset_repository):
        """创建资产总览服务实例
        
        Args:
            mock_asset_repository: 模拟的资产仓储对象
            
        Returns:
            AssetOverviewService: 资产总览服务实例
        """
        from src.services.asset_overview_service import AssetOverviewService
        return AssetOverviewService(asset_repository=mock_asset_repository)
    
    def test_get_total_asset_count_returns_valid_integer(self, asset_overview_service, mock_asset_repository):
        """测试资产总数返回有效整数
        
        验证资产总数统计功能返回非负整数。
        
        Expected: 返回值 >= 0
        """
        mock_asset_repository.count.return_value = 1250
        result = asset_overview_service.get_total_asset_count()
        assert isinstance(result, int)
        assert result == 1250
        assert result >= 0
    
    def test_get_total_asset_count_empty_database(self, asset_overview_service, mock_asset_repository):
        """测试空数据库返回零
        
        验证当数据库为空时，资产总数返回0。
        
        Expected: 返回 0
        """
        mock_asset_repository.count.return_value = 0
        result = asset_overview_service.get_total_asset_count()
        assert result == 0
    
    def test_get_today_new_assets_returns_correct_count(self, asset_overview_service, mock_asset_repository):
        """测试今日新增资产统计
        
        验证今日新增资产数量统计功能。
        
        Expected: 返回今日创建的资产数量
        """
        today = datetime.now().strftime('%Y-%m-%d')
        mock_asset_repository.count_by_date_range.return_value = 15
        result = asset_overview_service.get_today_new_assets()
        assert result == 15
        mock_asset_repository.count_by_date_range.assert_called_once()
    
    def test_get_today_new_assets_no_new_assets(self, asset_overview_service, mock_asset_repository):
        """测试无新增资产情况
        
        验证当日无新增资产时返回0。
        
        Expected: 返回 0
        """
        mock_asset_repository.count_by_date_range.return_value = 0
        result = asset_overview_service.get_today_new_assets()
        assert result == 0
    
    def test_get_monthly_change_returns_net_change(self, asset_overview_service, mock_asset_repository):
        """测试本月变更统计
        
        验证本月资产净变更数量计算。
        
        Expected: 返回本月新增减去本月删除的数量
        """
        mock_asset_repository.count_created_in_month.return_value = 50
        mock_asset_repository.count_deleted_in_month.return_value = 12
        result = asset_overview_service.get_monthly_change()
        assert result == 38  # 50 - 12 = 38
    
    def test_get_category_statistics_returns_list(self, asset_overview_service, mock_asset_repository):
        """测试分类统计返回列表
        
        验证资产分类统计数据结构正确。
        
        Expected: 返回包含分类名称和数量的列表
        """
        mock_data = [
            {'category': '电子设备', 'count': 500},
            {'category': '办公家具', 'count': 300},
            {'category': '生产设备', 'count': 450},
        ]
        mock_asset_repository.get_category_distribution.return_value = mock_data
        result = asset_overview_service.get_category_statistics()
        
        assert isinstance(result, list)
        assert len(result) == 3
        assert result[0]['category'] == '电子设备'
        assert result[0]['count'] == 500
    
    def test_get_category_statistics_empty(self, asset_overview_service, mock_asset_repository):
        """测试无分类数据
        
        验证无分类数据时返回空列表。
        
        Expected: 返回空列表
        """
        mock_asset_repository.get_category_distribution.return_value = []
        result = asset_overview_service.get_category_statistics()
        assert result == []
    
    def test_get_expiring_assets_within_30_days(self, asset_overview_service, mock_asset_repository):
        """测试30天内到期资产查询
        
        验证获取即将到期的资产列表功能。
        
        Expected: 返回到期日期在30天内的资产列表
        """
        mock_data = [
            {'id': 1, 'name': '服务器A', 'expire_date': (datetime.now() + timedelta(days=7)).date()},
            {'id': 2, 'name': '工作站B', 'expire_date': (datetime.now() + timedelta(days=15)).date()},
        ]
        mock_asset_repository.get_expiring_assets.return_value = mock_data
        result = asset_overview_service.get_expiring_assets(days=30)
        
        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0]['name'] == '服务器A'
    
    def test_get_expiring_assets_within_7_days(self, asset_overview_service, mock_asset_repository):
        """测试7天内到期资产查询
        
        验证获取紧急到期资产列表功能。
        
        Expected: 返回到期日期在7天内的资产列表
        """
        mock_data = [
            {'id': 3, 'name': '测试设备C', 'expire_date': (datetime.now() + timedelta(days=3)).date()},
        ]
        mock_asset_repository.get_expiring_assets.return_value = mock_data
        result = asset_overview_service.get_expiring_assets(days=7)
        
        assert len(result) == 1
        assert result[0]['id'] == 3
    
    def test_get_expiring_assets_sorted_by_date(self, asset_overview_service, mock_asset_repository):
        """测试到期资产按日期排序
        
        验证返回的到期资产列表按到期日期升序排列。
        
        Expected: 最近到期的资产排在最前面
        """
        mock_data = [
            {'id': 1, 'name': '资产A', 'expire_date': (datetime.now() + timedelta(days=25)).date()},
            {'id': 2, 'name': '资产B', 'expire_date': (datetime.now() + timedelta(days=5)).date()},
            {'id': 3, 'name': '资产C', 'expire_date': (datetime.now() + timedelta(days=15)).date()},
        ]
        mock_asset_repository.get_expiring_assets.return_value = mock_data
        result = asset_overview_service.get_expiring_assets(days=30)
        
        expire_dates = [item['expire_date'] for item in result]
        assert expire_dates == sorted(expire_dates)
    
    def test_get_expiring_assets_empty(self, asset_overview_service, mock_asset_repository):
        """测试无到期资产
        
        验证无即将到期资产时返回空列表。
        
        Expected: 返回空列表
        """
        mock_asset_repository.get_expiring_assets.return_value = []
        result = asset_overview_service.get_expiring_assets(days=30)
        assert result == []
    
    def test_get_dashboard_overview_returns_complete_data(self, asset_overview_service, mock_asset_repository):
        """测试仪表板概览数据完整性
        
        验证仪表板概览返回完整数据结构。
        
        Expected: 返回包含 total, today_add, month_change, categories, warnings 的字典
        """
        mock_asset_repository.count.return_value = 1000
        mock_asset_repository.count_by_date_range.return_value = 10
        mock_asset_repository.count_created_in_month.return_value = 30
        mock_asset_repository.count_deleted_in_month.return_value = 5
        mock_asset_repository.get_category_distribution.return_value = [
            {'category': '电子设备', 'count': 600}
        ]
        mock_asset_repository.get_expiring_assets.return_value = [
            {'id': 1, 'name': '设备A', 'expire_date': datetime.now().date()}
        ]
        
        result = asset_overview_service.get_dashboard_overview()
        
        assert 'total' in result
        assert 'today_add' in result
        assert 'month_change' in result
        assert 'categories' in result
        assert 'warnings' in result
        assert result['total'] == 1000
        assert result['today_add'] == 10
        assert result['month_change'] == 25
    
    def test_get_overview_response_time(self, asset_overview_service, mock_asset_repository):
        """测试概览查询响应时间
        
        验证概览数据查询在可接受时间内完成。
        
        Expected: 查询时间 < 1.5秒
        """
        import time
        start_time = time.time()
        asset_overview_service.get_total_asset_count()
        elapsed_time = time.time() - start_time
        assert elapsed_time < 1.5


class TestAssetOverviewServiceEdgeCases:
    """资产总览服务边界情况测试类
    
    测试极端情况和边界条件下的服务行为。
    """
    
    @pytest.fixture
    def service_with_null_handling(self):
        """创建支持空值处理的资产总览服务
        
        Returns:
            AssetOverviewService: 支持空值处理的资产总览服务
        """
        from src.services.asset_overview_service import AssetOverviewService
        mock_repo = Mock(spec=['count', 'count_by_date_range', 'get_category_distribution', 'get_expiring_assets'])
        return AssetOverviewService(asset_repository=mock_repo)
    
    def test_null_repository_handling(self, service_with_null_handling):
        """测试空仓储处理
        
        验证当仓储返回None时的处理逻辑。
        
        Expected: 返回合理的默认值而非抛出异常
        """
        service_with_null_handling.asset_repository.count.return_value = None
        result = service_with_null_handling.get_total_asset_count()
        assert result == 0 or result is not None
    
    def test_large_dataset_handling(self, service_with_null_handling):
        """测试大数据集处理
        
        验证处理大量数据时的性能和数据正确性。
        
        Expected: 能够正确处理大量资产数据
        """
        large_count = 1000000
        service_with_null_handling.asset_repository.count.return_value = large_count
        result = service_with_null_handling.get_total_asset_count()
        assert result == large_count
    
    def test_special_characters_in_category(self, service_with_null_handling):
        """测试分类名称特殊字符处理
        
        验证分类名称包含特殊字符时的处理。
        
        Expected: 正确处理并返回包含特殊字符的分类名称
        """
        mock_data = [
            {'category': '电子设备（特殊）', 'count': 100},
            {'category': 'IT设备 <服务器>', 'count': 200},
        ]
        service_with_null_handling.asset_repository.get_category_distribution.return_value = mock_data
        result = service_with_null_handling.get_category_statistics()
        assert len(result) == 2
        assert '电子设备（特殊）' in [item['category'] for item in result]


class TestDashboardPerformance:
    """仪表板性能测试类
    
    验证仪表板数据查询的性能指标。
    """
    
    def test_concurrent_requests_handling(self):
        """测试并发请求处理
        
        验证服务能够正确处理多个并发请求。
        
        Expected: 并发请求不导致数据不一致或服务崩溃
        """
        from src.services.asset_overview_service import AssetOverviewService
        import threading
        import time
        
        results = []
        errors = []
        
        def fetch_data():
            try:
                mock_repo = Mock()
                mock_repo.count.return_value = 100
                service = AssetOverviewService(asset_repository=mock_repo)
                results.append(service.get_total_asset_count())
            except Exception as e:
                errors.append(str(e))
        
        threads = [threading.Thread(target=fetch_data) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        assert len(errors) == 0
        assert len(results) == 10
        assert all(r == 100 for r in results)


# pytest配置标记
pytestmark = [
    pytest.mark.unit,
    pytest.mark.dashboard,
    pytest.mark.asset_overview,
]


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])