"""
Asset Repository Unit Tests

测试资产相关Repository层的单元测试，覆盖仪表板数据看板功能：
- 资产总览数据查询
- 分类统计聚合查询
- 到期预警数据查询

AC Reference: SWARM-S5-003 Iteration 1
"""

import pytest
from datetime import date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from typing import List, Dict, Optional

# 测试目标模块
import sys
sys.path.insert(0, 'src')

from repositories.asset_repository import (
    AssetRepository,
    AssetOverviewQuery,
    AssetStatisticsQuery,
    AssetExpiringQuery
)
from models.asset import Asset, AssetType, AssetStatus


class TestAssetOverviewRepository:
    """ATB-1: 资产总览 API - Repository层测试"""

    @pytest.fixture
    def mock_db_session(self):
        """Mock数据库会话"""
        session = AsyncMock()
        session.execute = AsyncMock()
        session.scalar = AsyncMock()
        return session

    @pytest.fixture
    def asset_repository(self, mock_db_session):
        """创建AssetRepository实例"""
        return AssetRepository(db_session=mock_db_session)

    @pytest.mark.asyncio
    async def test_overview_returns_correct_structure(self, asset_repository, mock_db_session):
        """
        ATB-1 测试场景1: 返回正确的汇总数据结构
        
        预期: response中包含total_count, by_status, by_type
        """
        # 模拟查询结果
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([
            MagicMock(total_count=100, status='active', asset_type='equipment'),
            MagicMock(total_count=50, status='active', asset_type='license'),
            MagicMock(total_count=30, status='maintenance', asset_type='equipment'),
        ]))
        mock_db_session.execute.return_value = mock_result
        
        query = AssetOverviewQuery()
        result = await asset_repository.get_overview_stats(query)
        
        # 断言返回结构包含必要字段
        assert 'total_count' in result
        assert 'by_status' in result
        assert 'by_type' in result
        assert isinstance(result['by_status'], dict)
        assert isinstance(result['by_type'], dict)

    @pytest.mark.asyncio
    async def test_overview_empty_dataset_returns_zeros(self, asset_repository, mock_db_session):
        """
        ATB-1 测试场景2: 空数据集返回零值
        
        预期: 当无资产时，total_count=0, by_status全为0
        """
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([]))
        mock_db_session.execute.return_value = mock_result
        
        query = AssetOverviewQuery()
        result = await asset_repository.get_overview_stats(query)
        
        assert result['total_count'] == 0
        assert result['by_status'] == {}
        assert result['by_type'] == {}

    @pytest.mark.asyncio
    async def test_overview_statistics_accuracy(self, asset_repository, mock_db_session):
        """
        ATB-1 测试场景3: 模拟数据验证统计准确性
        
        预置5个资产，类型分布为[A:2, B:3]
        预期: by_type聚合结果与预置数据一致
        """
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([
            MagicMock(total_count=2, status='active', asset_type='equipment'),
            MagicMock(total_count=3, status='active', asset_type='license'),
            MagicMock(total_count=5, status='active', asset_type='contract'),
        ]))
        mock_db_session.execute.return_value = mock_result
        
        query = AssetOverviewQuery()
        result = await asset_repository.get_overview_stats(query)
        
        # 验证总数
        total = sum(result['by_type'].values())
        assert total == 10
        
        # 验证特定类型计数
        assert result['by_type'].get('equipment') == 2
        assert result['by_type'].get('license') == 3


class TestAssetStatisticsRepository:
    """ATB-2: 分类统计 API - Repository层测试"""

    @pytest.fixture
    def mock_db_session(self):
        """Mock数据库会话"""
        session = AsyncMock()
        session.execute = AsyncMock()
        return session

    @pytest.fixture
    def asset_repository(self, mock_db_session):
        """创建AssetRepository实例"""
        return AssetRepository(db_session=mock_db_session)

    @pytest.mark.asyncio
    async def test_statistics_group_by_type(self, asset_repository, mock_db_session):
        """
        ATB-2 测试场景1: 支持group_by参数过滤
        
        调用: POST /api/dashboard/assets/statistics, body: {"group_by": "asset_type"}
        预期: 返回按资产类型分组的聚合结果
        """
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([
            MagicMock(asset_type='equipment', count=50),
            MagicMock(asset_type='license', count=30),
            MagicMock(asset_type='contract', count=20),
        ]))
        mock_db_session.execute.return_value = mock_result
        
        query = AssetStatisticsQuery(group_by='asset_type')
        result = await asset_repository.get_statistics(query)
        
        assert isinstance(result, list)
        assert len(result) == 3
        assert result[0]['asset_type'] == 'equipment'
        assert result[0]['count'] == 50

    @pytest.mark.asyncio
    async def test_statistics_with_date_range(self, asset_repository, mock_db_session):
        """
        ATB-2 测试场景2: 支持时间范围过滤
        
        调用: body: {"date_from": "2024-01-01", "date_to": "2024-12-31"}
        预期: 仅返回落在该范围内的资产统计
        """
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([
            MagicMock(status='active', count=80),
            MagicMock(status='retired', count=20),
        ]))
        mock_db_session.execute.return_value = mock_result
        
        query = AssetStatisticsQuery(
            group_by='status',
            date_from=date(2024, 1, 1),
            date_to=date(2024, 12, 31)
        )
        result = await asset_repository.get_statistics(query)
        
        assert isinstance(result, list)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_statistics_invalid_group_by_raises_error(self, asset_repository, mock_db_session):
        """
        ATB-2 测试场景3: 无效group_by返回错误
        
        调用: body: {"group_by": "invalid_field"}
        预期: 抛出ValidationError
        """
        query = AssetStatisticsQuery(group_by='invalid_field')
        
        with pytest.raises(ValueError) as exc_info:
            await asset_repository.get_statistics(query)
        
        assert 'invalid_field' in str(exc_info.value)
        assert 'valid fields' in str(exc_info.value).lower()


class TestAssetExpiringRepository:
    """ATB-3: 到期预警 API - Repository层测试"""

    @pytest.fixture
    def mock_db_session(self):
        """Mock数据库会话"""
        session = AsyncMock()
        session.execute = AsyncMock()
        return session

    @pytest.fixture
    def asset_repository(self, mock_db_session):
        """创建AssetRepository实例"""
        return AssetRepository(db_session=mock_db_session)

    @pytest.mark.asyncio
    async def test_expiring_default_30_days_threshold(self, asset_repository, mock_db_session):
        """
        ATB-3 测试场景1: 默认30天阈值过滤
        
        预置: 资产A到期日=今天+15天, 资产B到期日=今天+45天
        预期: 仅返回资产A
        """
        today = date.today()
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([
            MagicMock(
                id=1,
                name='资产A',
                expiration_date=today + timedelta(days=15),
                days_until_expiry=15
            ),
        ]))
        mock_db_session.execute.return_value = mock_result
        
        query = AssetExpiringQuery()  # 默认30天
        result = await asset_repository.get_expiring_assets(query)
        
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0].days_until_expiry <= 30

    @pytest.mark.asyncio
    async def test_expiring_custom_threshold(self, asset_repository, mock_db_session):
        """
        ATB-3 测试场景2: 可配置阈值参数
        
        调用: GET /api/dashboard/assets/expiring?days=60
        预期: 返回60天内到期资产
        """
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([
            MagicMock(id=1, name='资产A', expiration_date=date.today() + timedelta(days=15)),
            MagicMock(id=2, name='资产B', expiration_date=date.today() + timedelta(days=45)),
        ]))
        mock_db_session.execute.return_value = mock_result
        
        query = AssetExpiringQuery(days=60)
        result = await asset_repository.get_expiring_assets(query)
        
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_expiring_sorted_by_urgency(self, asset_repository, mock_db_session):
        """
        ATB-3 测试场景3: 按严重程度排序
        
        预置: 资产A=7天, 资产B=3天, 资产C=14天
        预期: 返回顺序[B, A, C]
        """
        today = date.today()
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([
            MagicMock(id=1, name='资产B', days_until_expiry=3),
            MagicMock(id=2, name='资产A', days_until_expiry=7),
            MagicMock(id=3, name='资产C', days_until_expiry=14),
        ]))
        mock_db_session.execute.return_value = mock_result
        
        query = AssetExpiringQuery()
        result = await asset_repository.get_expiring_assets(query)
        
        assert result[0].days_until_expiry == 3
        assert result[1].days_until_expiry == 7
        assert result[2].days_until_expiry == 14

    @pytest.mark.asyncio
    async def test_expiring_no_results_returns_empty_list(self, asset_repository, mock_db_session):
        """
        ATB-3 测试场景4: 空结果返回空数组
        
        预置: 所有资产到期日>30天
        预期: 返回空列表
        """
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([]))
        mock_db_session.execute.return_value = mock_result
        
        query = AssetExpiringQuery()
        result = await asset_repository.get_expiring_assets(query)
        
        assert isinstance(result, list)
        assert len(result) == 0


class TestAssetModelConstraints:
    """ATB-4: 数据模型约束 - Repository层测试"""

    @pytest.fixture
    def mock_db_session(self):
        """Mock数据库会话"""
        session = AsyncMock()
        session.add = MagicMock()
        session.commit = AsyncMock()
        session.rollback = AsyncMock()
        return session

    @pytest.fixture
    def asset_repository(self, mock_db_session):
        """创建AssetRepository实例"""
        return AssetRepository(db_session=mock_db_session)

    @pytest.mark.asyncio
    async def test_asset_expiration_date_must_be_future(self, asset_repository, mock_db_session):
        """
        ATB-4 测试场景1: expiration_date必须为未来日期
        
        创建: Asset(name="测试", expiration_date=date.today()-1天)
        预期: 抛出ValidationError
        """
        from models.asset import Asset
        from sqlalchemy.exc import IntegrityError
        
        # 模拟过期的资产
        expired_asset = Asset(
            name="测试资产",
            asset_type=AssetType.EQUIPMENT,
            expiration_date=date.today() - timedelta(days=1)
        )
        mock_db_session.commit.side_effect = IntegrityError(
            'statement', 'params', 'expiration_date must be in the future'
        )
        
        with pytest.raises(ValueError) as exc_info:
            await asset_repository.create_asset(expired_asset)
        
        assert 'future' in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_asset_type_enum_validation(self, asset_repository):
        """
        ATB-4 测试场景2: asset_type枚举值限制
        
        合法: ["equipment", "license", "contract", "document"]
        非法: "invalid_type"
        预期: 非法值触发ValidationError
        """
        from models.asset import Asset
        
        # 测试非法类型
        invalid_asset = Asset(
            name="测试资产",
            asset_type="invalid_type",
            expiration_date=date.today() + timedelta(days=30)
        )
        
        with pytest.raises(ValueError) as exc_info:
            await asset_repository.create_asset(invalid_asset)
        
        assert 'invalid_type' in str(exc_info.value)


class TestAssetRepositoryPerformance:
    """ATB-5: 性能基准 - Repository层测试"""

    @pytest.fixture
    def mock_db_session(self):
        """Mock数据库会话"""
        session = AsyncMock()
        session.execute = AsyncMock()
        return session

    @pytest.fixture
    def asset_repository(self, mock_db_session):
        """创建AssetRepository实例"""
        return AssetRepository(db_session=mock_db_session)

    @pytest.mark.asyncio
    async def test_overview_query_time_limit(self, asset_repository, mock_db_session):
        """
        ATB-5 测试场景1: 查询响应时间监控
        
        预期: 超过配置阈值抛出TimeoutError
        """
        import time
        
        # 模拟慢查询
        async def slow_execute(*args, **kwargs):
            await asyncio.sleep(0.5)  # 模拟300ms延迟
            return MagicMock(__iter__=MagicMock(return_value=iter([])))
        
        mock_db_session.execute = slow_execute
        
        query = AssetOverviewQuery(timeout_ms=200)  # 200ms超时
        start = time.perf_counter()
        
        with pytest.raises(TimeoutError):
            await asset_repository.get_overview_stats(query)
        
        elapsed = time.perf_counter() - start
        assert elapsed < 1.0  # 确保没有无限等待

    @pytest.mark.asyncio
    async def test_overview_limit_exceeded_returns_error(self, asset_repository, mock_db_session):
        """
        ATB-5 测试场景2: 超过1000条触发分页错误
        
        调用: 查询参数limit=5000
        预期: 抛出ValueError提示查询限制
        """
        query = AssetOverviewQuery(limit=5000)
        
        with pytest.raises(ValueError) as exc_info:
            await asset_repository.get_overview_stats(query)
        
        assert 'limit' in str(exc_info.value).lower()
        assert '1000' in str(exc_info.value)


class TestAssetRepositoryEdgeCases:
    """边界情况测试"""

    @pytest.fixture
    def mock_db_session(self):
        """Mock数据库会话"""
        session = AsyncMock()
        session.execute = AsyncMock()
        return session

    @pytest.fixture
    def asset_repository(self, mock_db_session):
        """创建AssetRepository实例"""
        return AssetRepository(db_session=mock_db_session)

    @pytest.mark.asyncio
    async def test_statistics_with_empty_date_range(self, asset_repository, mock_db_session):
        """
        边界测试: date_from > date_to 时返回错误
        """
        query = AssetStatisticsQuery(
            group_by='status',
            date_from=date(2024, 12, 31),
            date_to=date(2024, 1, 1)
        )
        
        with pytest.raises(ValueError) as exc_info:
            await asset_repository.get_statistics(query)
        
        assert 'date_from' in str(exc_info.value).lower() or 'date' in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_expiring_with_zero_days_threshold(self, asset_repository, mock_db_session):
        """
        边界测试: days=0 只返回今天到期的资产
        """
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([
            MagicMock(id=1, name='今日到期', days_until_expiry=0),
        ]))
        mock_db_session.execute.return_value = mock_result
        
        query = AssetExpiringQuery(days=0)
        result = await asset_repository.get_expiring_assets(query)
        
        assert all(item.days_until_expiry == 0 for item in result)

    @pytest.mark.asyncio
    async def test_overview_with_all_status_filters(self, asset_repository, mock_db_session):
        """
        边界测试: 同时按多个状态过滤
        """
        mock_result = MagicMock()
        mock_result.__iter__ = MagicMock(return_value=iter([
            MagicMock(total_count=30, status='active', asset_type='equipment'),
            MagicMock(total_count=10, status='maintenance', asset_type='equipment'),
        ]))
        mock_db_session.execute.return_value = mock_result
        
        query = AssetOverviewQuery(status_filter=['active', 'maintenance'])
        result = await asset_repository.get_overview_stats(query)
        
        assert 'by_status' in result


# 辅助导入
import asyncio