"""
到期预警定时任务测试模块

本模块验证 ExpirationCheckTask 定时任务的核心功能：
- ATB-002-01: 扫描即将到期资产
- ATB-002-02: 重复执行不重复生成
- ATB-002-03: 过期资产跳过处理
- ATB-002-04: 定时任务执行日志

参考 SPEC: SWARM-DASH-001 仪表板数据看板规格说明书
"""

import pytest
from datetime import date, datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from uuid import uuid4

from app.scheduler.tasks.expiration_check_task import ExpirationCheckTask
from app.models.asset import Asset
from app.models.expiration_warning import ExpirationWarning
from app.repositories.asset_repository import AssetRepository
from app.services.notification_service import NotificationService


class TestExpirationCheckTask:
    """到期预警定时任务测试类"""

    @pytest.fixture
    def mock_asset_repository(self):
        """Mock AssetRepository"""
        return Mock(spec=AssetRepository)

    @pytest.fixture
    def mock_notification_service(self):
        """Mock NotificationService"""
        return Mock(spec=NotificationService)

    @pytest.fixture
    def sample_expiring_assets(self):
        """创建即将到期资产样本数据"""
        today = date.today()
        return [
            Asset(
                id=uuid4(),
                name=f"服务器-{i:02d}",
                category="服务器",
                status="在用",
                purchase_date=today - timedelta(days=365),
                expire_date=today + timedelta(days=15),
            )
            for i in range(1, 4)
        ]

    @pytest.fixture
    def sample_expired_assets(self):
        """创建已过期资产样本数据"""
        today = date.today()
        return [
            Asset(
                id=uuid4(),
                name="网络设备-已过期",
                category="网络设备",
                status="在用",
                purchase_date=today - timedelta(days=730),
                expire_date=today - timedelta(days=30),
            )
        ]

    @pytest.fixture
    def sample_expiring_with_existing_warning(self, sample_expiring_assets):
        """创建已有预警记录的即将到期资产"""
        assets = sample_expiring_assets[:2]
        return assets

    @pytest.fixture
    def mock_db_session(self):
        """Mock 数据库会话"""
        session = MagicMock()
        session.query.return_value.filter.return_value.all.return_value = []
        session.query.return_value.filter.return_value.first.return_value = None
        return session


class TestScanExpiringAssets:
    """ATB-002-01: 扫描即将到期资产"""

    def test_scan_expiring_assets(
        self,
        mock_asset_repository,
        mock_notification_service,
        mock_db_session,
        sample_expiring_assets,
    ):
        """
        测试场景: 扫描即将到期资产
        
        预期结果:
        - 生成预警记录，数量与到期资产一致
        - 预警记录包含正确的资产ID
        - 预警截止日期在配置范围内（默认30天）
        """
        # Arrange
        mock_asset_repository.get_expiring_assets.return_value = sample_expiring_assets
        mock_db_session.query.return_value.filter.return_value.all.return_value = []

        task = ExpirationCheckTask(
            asset_repository=mock_asset_repository,
            notification_service=mock_notification_service,
            db_session=mock_db_session,
        )

        # Act
        result = task.execute()

        # Assert
        assert result["scanned_count"] == 3
        assert result["warnings_generated"] == 3
        assert result["status"] == "success"
        
        # 验证第一条预警的资产ID正确
        assert result["warnings"][0]["asset_id"] == sample_expiring_assets[0].id
        assert result["warnings"][0]["asset_name"] == sample_expiring_assets[0].name
        assert result["warnings"][0]["expire_date"] == sample_expiring_assets[0].expire_date

    def test_scan_expiring_assets_no_matches(
        self,
        mock_asset_repository,
        mock_notification_service,
        mock_db_session,
    ):
        """
        测试场景: 无即将到期资产
        
        预期结果:
        - 返回扫描数量为0
        - 生成预警数量为0
        - 不触发通知服务
        """
        # Arrange
        mock_asset_repository.get_expiring_assets.return_value = []
        task = ExpirationCheckTask(
            asset_repository=mock_asset_repository,
            notification_service=mock_notification_service,
            db_session=mock_db_session,
        )

        # Act
        result = task.execute()

        # Assert
        assert result["scanned_count"] == 0
        assert result["warnings_generated"] == 0
        assert result["status"] == "success"
        mock_notification_service.send.assert_not_called()

    def test_scan_expiring_assets_custom_days(
        self,
        mock_asset_repository,
        mock_notification_service,
        mock_db_session,
        sample_expiring_assets,
    ):
        """
        测试场景: 自定义扫描天数范围
        
        预期结果:
        - 仅返回配置天数范围内的资产
        """
        # Arrange
        custom_days = 7
        task = ExpirationCheckTask(
            asset_repository=mock_asset_repository,
            notification_service=mock_notification_service,
            db_session=mock_db_session,
            warning_days=custom_days,
        )

        # Act
        result = task.execute()

        # Assert
        mock_asset_repository.get_expiring_assets.assert_called_once_with(custom_days)


class TestNoDuplicateWarning:
    """ATB-002-02: 重复执行不重复生成"""

    def test_no_duplicate_warning_same_day(
        self,
        mock_asset_repository,
        mock_notification_service,
        mock_db_session,
        sample_expiring_with_existing_warning,
    ):
        """
        测试场景: 同日重复执行不重复生成预警
        
        预期结果:
        - 同一资产同日仅生成一条预警
        - 已存在预警的资产不会被重复创建
        """
        # Arrange
        mock_asset_repository.get_expiring_assets.return_value = (
            sample_expiring_with_existing_warning
        )
        
        # 模拟已存在今日预警
        today = date.today()
        existing_warning = ExpirationWarning(
            id=uuid4(),
            asset_id=sample_expiring_with_existing_warning[0].id,
            warning_date=today,
            expire_date=today + timedelta(days=15),
        )
        mock_db_session.query.return_value.filter.return_value.first.return_value = (
            existing_warning
        )

        task = ExpirationCheckTask(
            asset_repository=mock_asset_repository,
            notification_service=mock_notification_service,
            db_session=mock_db_session,
        )

        # Act
        result = task.execute()

        # Assert
        # 第一条资产已存在预警，应只生成1条新预警
        assert result["warnings_generated"] == 1
        assert result["duplicates_skipped"] == 1

    def test_no_duplicate_warning_previous_day(
        self,
        mock_asset_repository,
        mock_notification_service,
        mock_db_session,
        sample_expiring_with_existing_warning,
    ):
        """
        测试场景: 昨日已生成预警，今日再次执行应生成新预警
        
        预期结果:
        - 不同日期可以重复生成预警
        """
        # Arrange
        mock_asset_repository.get_expiring_assets.return_value = (
            sample_expiring_with_existing_warning
        )
        
        # 模拟昨日存在预警
        yesterday = date.today() - timedelta(days=1)
        existing_warning = ExpirationWarning(
            id=uuid4(),
            asset_id=sample_expiring_with_existing_warning[0].id,
            warning_date=yesterday,
            expire_date=date.today() + timedelta(days=15),
        )
        mock_db_session.query.return_value.filter.return_value.first.return_value = None

        task = ExpirationCheckTask(
            asset_repository=mock_asset_repository,
            notification_service=mock_notification_service,
            db_session=mock_db_session,
        )

        # Act
        result = task.execute()

        # Assert
        assert result["warnings_generated"] == 2


class TestExpiredAssetsSkipped:
    """ATB-002-03: 过期资产跳过处理"""

    def test_expired_assets_skipped(
        self,
        mock_asset_repository,
        mock_notification_service,
        mock_db_session,
        sample_expired_assets,
    ):
        """
        测试场景: 已过期资产跳过处理
        
        预期结果:
        - 已过期资产不生成预警
        - 扫描数量不包含已过期资产
        """
        # Arrange
        mock_asset_repository.get_expiring_assets.return_value = []
        mock_asset_repository.get_expired_assets.return_value = sample_expired_assets

        task = ExpirationCheckTask(
            asset_repository=mock_asset_repository,
            notification_service=mock_notification_service,
            db_session=mock_db_session,
        )

        # Act
        result = task.execute()

        # Assert
        assert result["scanned_count"] == 0
        assert result["warnings_generated"] == 0
        assert result["expired_skipped"] == 1

    def test_mixed_expired_and_expiring(
        self,
        mock_asset_repository,
        mock_notification_service,
        mock_db_session,
        sample_expired_assets,
        sample_expiring_assets,
    ):
        """
        测试场景: 混合过期与即将到期资产
        
        预期结果:
        - 仅对即将到期资产生成预警
        - 过期资产被正确跳过
        """
        # Arrange
        mock_asset_repository.get_expiring_assets.return_value = sample_expiring_assets
        mock_asset_repository.get_expired_assets.return_value = sample_expired_assets
        mock_db_session.query.return_value.filter.return_value.all.return_value = []

        task = ExpirationCheckTask(
            asset_repository=mock_asset_repository,
            notification_service=mock_notification_service,
            db_session=mock_db_session,
        )

        # Act
        result = task.execute()

        # Assert
        assert result["warnings_generated"] == 3
        assert result["expired_skipped"] == 1


class TestTaskExecutionLog:
    """ATB-002-04: 定时任务执行日志"""

    def test_task_execution_log(
        self,
        mock_asset_repository,
        mock_notification_service,
        mock_db_session,
        sample_expiring_assets,
    ):
        """
        测试场景: 定时任务执行日志记录
        
        预期结果:
        - 日志记录包含执行时间
        - 日志记录包含扫描数量
        - 日志记录包含生成预警数量
        """
        # Arrange
        mock_asset_repository.get_expiring_assets.return_value = sample_expiring_assets
        mock_db_session.query.return_value.filter.return_value.all.return_value = []

        task = ExpirationCheckTask(
            asset_repository=mock_asset_repository,
            notification_service=mock_notification_service,
            db_session=mock_db_session,
        )

        # Act
        result = task.execute()

        # Assert
        assert "execution_time" in result
        assert result["execution_time"] is not None
        assert isinstance(result["execution_time"], datetime)
        
        assert "scanned_count" in result
        assert result["scanned_count"] == 3
        
        assert "warnings_generated" in result
        assert result["warnings_generated"] == 3

    def test_task_execution_log_error_handling(
        self,
        mock_asset_repository,
        mock_notification_service,
        mock_db_session,
    ):
        """
        测试场景: 任务执行异常时的日志记录
        
        预期结果:
        - 异常被捕获并记录
        - 返回 status 为 "failed"
        - 错误信息包含在结果中
        """
        # Arrange
        mock_asset_repository.get_expiring_assets.side_effect = Exception("Database connection failed")

        task = ExpirationCheckTask(
            asset_repository=mock_asset_repository,
            notification_service=mock_notification_service,
            db_session=mock_db_session,
        )

        # Act
        result = task.execute()

        # Assert
        assert result["status"] == "failed"
        assert "error" in result
        assert "Database connection failed" in result["error"]

    def test_task_execution_log_with_notification(
        self,
        mock_asset_repository,
        mock_notification_service,
        mock_db_session,
        sample_expiring_assets,
    ):
        """
        测试场景: 任务执行并发送通知时的日志记录
        
        预期结果:
        - 通知服务被正确调用
        - 通知调用次数与预警数量一致
        """
        # Arrange
        mock_asset_repository.get_expiring_assets.return_value = sample_expiring_assets
        mock_db_session.query.return_value.filter.return_value.all.return_value = []

        task = ExpirationCheckTask(
            asset_repository=mock_asset_repository,
            notification_service=mock_notification_service,
            db_session=mock_db_session,
        )

        # Act
        result = task.execute()

        # Assert
        assert mock_notification_service.send.call_count == 3
        assert result["notifications_sent"] == 3


class TestTaskIntegration:
    """任务集成测试"""

    def test_task_integration_full_workflow(
        self,
        mock_asset_repository,
        mock_notification_service,
        mock_db_session,
    ):
        """
        测试场景: 完整工作流程集成测试
        
        预期结果:
        - 资产扫描 -> 预警生成 -> 通知发送 全流程正常
        """
        # Arrange
        today = date.today()
        assets = [
            Asset(
                id=uuid4(),
                name="测试资产-A",
                category="服务器",
                status="在用",
                purchase_date=today - timedelta(days=365),
                expire_date=today + timedelta(days=10),
            ),
            Asset(
                id=uuid4(),
                name="测试资产-B",
                category="存储设备",
                status="在用",
                purchase_date=today - timedelta(days=200),
                expire_date=today + timedelta(days=20),
            ),
        ]
        mock_asset_repository.get_expiring_assets.return_value = assets
        mock_db_session.query.return_value.filter.return_value.all.return_value = []

        task = ExpirationCheckTask(
            asset_repository=mock_asset_repository,
            notification_service=mock_notification_service,
            db_session=mock_db_session,
        )

        # Act
        result = task.execute()

        # Assert
        assert result["status"] == "success"
        assert result["scanned_count"] == 2
        assert result["warnings_generated"] == 2
        assert mock_db_session.add.call_count == 2
        assert mock_db_session.commit.call_count >= 1
        assert mock_notification_service.send.call_count == 2

    def test_task_with_disabled_notification_service(
        self,
        mock_asset_repository,
        mock_notification_service,
        mock_db_session,
        sample_expiring_assets,
    ):
        """
        测试场景: 通知服务禁用时的任务执行
        
        预期结果:
        - 预警仍正常生成
        - 仅记录日志，不发送通知
        """
        # Arrange
        mock_asset_repository.get_expiring_assets.return_value = sample_expiring_assets
        mock_db_session.query.return_value.filter.return_value.all.return_value = []

        task = ExpirationCheckTask(
            asset_repository=mock_asset_repository,
            notification_service=mock_notification_service,
            db_session=mock_db_session,
            notification_enabled=False,
        )

        # Act
        result = task.execute()

        # Assert
        assert result["status"] == "success"
        assert result["warnings_generated"] == 3
        mock_notification_service.send.assert_not_called()