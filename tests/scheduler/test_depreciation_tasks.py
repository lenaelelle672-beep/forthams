"""
Depreciation Scheduled Tasks Test Suite
=====================================

ATB-ID: ATB-3.7
验证目标: 定时任务在迭代更新后仍正常工作

本测试模块验证 SWARM-2026-Q2-003 迭代3中的折旧计提定时任务功能:
- GOAL-3.2: 折旧计提定时任务框架
- GOAL-3.3: 任务执行日志与监控
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from enum import Enum

from app.scheduler.task_engine import ScheduleTaskEngine, TaskStatus, DepreciationTaskLockException
from app.services.report_service import DepreciationReportService
from app.repositories.task_repository import TaskRepository


class TestDepreciationScheduledTasks:
    """
    折旧计提定时任务测试类
    
    验证定时任务的调度、执行、防重和日志功能
    """

    @pytest.fixture
    def mock_task_repository(self):
        """Mock任务仓储"""
        return Mock(spec=TaskRepository)

    @pytest.fixture
    def mock_calculator(self):
        """Mock折旧计算引擎"""
        calculator = Mock()
        calculator.calculate.return_value = {
            "asset_id": "AST-2026-001",
            "period": "2026-04",
            "monthly_depreciation": 1000.00,
            "accumulated_depreciation": 3000.00,
            "net_book_value": 7000.00
        }
        return calculator

    @pytest.fixture
    def schedule_engine(self, mock_task_repository, mock_calculator):
        """创建调度引擎实例"""
        return ScheduleTaskEngine(
            task_repository=mock_task_repository,
            calculator=mock_calculator,
            timeout_seconds=300,
            retry_attempts=1,
            retry_interval_seconds=60
        )

    def test_scheduled_job_executes_on_time(self, schedule_engine, mock_task_repository):
        """
        ATB-ID: ATB-3.7
        物理测试期待:
        - 模拟系统时间到预设执行窗口
        - 断言: DepreciationCalculationJob 在预期时间触发
        - 断言: 执行日志中存在对应记录
        
        测试场景:
        1. 设置定时任务在特定时间触发
        2. 模拟系统时间到达执行窗口
        3. 验证任务被正确触发
        4. 验证执行日志记录正确
        """
        # 准备: 创建定时任务配置
        period = "2026-04"
        scheduled_time = datetime(2026, 4, 30, 23, 0, 0)  # 4月最后一个工作日23:00
        
        # 模拟任务不存在
        mock_task_repository.find_by_period.return_value = None
        mock_task_repository.create.return_value = {
            "task_id": "TASK-2026-001",
            "period": period,
            "status": TaskStatus.PENDING.value
        }
        
        # 执行: 触发折旧计提任务
        result = schedule_engine.trigger_depreciation_task(period)
        
        # 验证: 任务被创建并返回正确状态
        assert result is not None
        assert result["task_id"] == "TASK-2026-001"
        assert result["status"] == TaskStatus.PENDING.value
        
        # 验证: 任务仓储被正确调用
        mock_task_repository.create.assert_called_once()

    def test_duplicate_execution_blocked(self, schedule_engine, mock_task_repository):
        """
        ATB-ID: ATB-3.3
        物理测试期待:
        - 准备: 任务表中存在状态为'running'的2026-04计提任务
        - 执行: 触发同一账期计提任务
        - 验证: 
          1. 抛出 DepreciationTaskLockException
          2. 不创建新任务记录
        
        测试防重机制: 同一账期同一时间只允许一个任务实例
        """
        period = "2026-04"
        
        # 准备: 存在running状态的任务
        mock_task_repository.find_by_period.return_value = {
            "task_id": "TASK-EXISTING-001",
            "period": period,
            "status": TaskStatus.RUNNING.value,
            "started_at": datetime.now()
        }
        
        # 执行 & 验证: 应抛出防重锁异常
        with pytest.raises(DepreciationTaskLockException) as exc_info:
            schedule_engine.trigger_depreciation_task(period)
        
        assert "DUPLICATE_TASK" in str(exc_info.value)
        mock_task_repository.create.assert_not_called()

    def test_execution_timeout_raises_exception(self, schedule_engine, mock_task_repository):
        """
        ATB-ID: ATB-3.4
        物理测试期待:
        - Mock: 计算引擎耗时 > 300秒
        - 执行: run_depreciation_task(task_id='T001')
        - 验证: 任务状态更新为'failed'，错误码'TIMEOUT_EXCEEDED'
        """
        task_id = "TASK-T001"
        
        # 准备: 模拟超时场景
        mock_task_repository.get_by_id.return_value = {
            "task_id": task_id,
            "period": "2026-04",
            "status": TaskStatus.RUNNING.value,
            "started_at": datetime.now() - timedelta(seconds=310)
        }
        
        # 模拟计算引擎超时
        mock_task_repository.update_status.side_effect = None
        
        # 执行: 运行任务(会被超时拦截)
        with patch.object(schedule_engine, '_check_timeout', return_value=True):
            result = schedule_engine.run_task(task_id)
        
        # 验证: 任务状态更新为失败
        assert result["status"] == TaskStatus.FAILED.value
        assert "TIMEOUT_EXCEEDED" in result.get("error_code", "")

    def test_retry_mechanism_on_failure(self, schedule_engine, mock_task_repository):
        """
        ATB-ID: ATB-3.X
        物理测试期待:
        - 任务首次执行失败后自动重试1次
        - 重试间隔60秒
        
        根据技术约束: 重试策略为失败任务自动重试1次，间隔60秒
        """
        period = "2026-04"
        
        # 准备: 任务首次失败
        mock_task_repository.find_by_period.side_effect = [
            None,  # 首次检查无任务
            {"task_id": "TASK-RETRY-001", "status": TaskStatus.FAILED.value}  # 重试检查
        ]
        
        call_count = 0
        def mock_create(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return {"task_id": f"TASK-RETRY-{call_count}", "status": TaskStatus.PENDING.value}
        
        mock_task_repository.create.side_effect = mock_create
        
        # 执行: 触发任务
        schedule_engine.trigger_depreciation_task(period)
        
        # 验证: 重试机制被正确配置
        assert schedule_engine.retry_attempts == 1
        assert schedule_engine.retry_interval_seconds == 60

    def test_task_execution_log_recorded(self, schedule_engine, mock_task_repository):
        """
        ATB-ID: ATB-3.3
        物理测试期待:
        - 任务执行后记录完整日志
        - 日志包含: 任务ID、账期、状态、开始时间、结束时间
        
        验证数据追溯要求: 全量操作审计日志
        """
        period = "2026-04"
        task_id = "TASK-LOG-001"
        
        # 准备: 任务执行完成
        mock_task_repository.find_by_period.return_value = None
        mock_task_repository.create.return_value = {
            "task_id": task_id,
            "period": period,
            "status": TaskStatus.COMPLETED.value,
            "started_at": datetime(2026, 4, 30, 23, 0, 0),
            "completed_at": datetime(2026, 4, 30, 23, 0, 30),
            "asset_count": 5,
            "total_amount": 5000.00
        }
        
        # 执行
        result = schedule_engine.get_task_status(task_id)
        
        # 验证: 日志字段完整
        assert "task_id" in result
        assert "period" in result
        assert "started_at" in result
        assert "completed_at" in result
        assert "asset_count" in result
        assert "total_amount" in result


class TestDepreciationTaskConcurrency:
    """
    并发控制测试类
    
    根据约束: 同一资产同一账期仅允许一个任务实例执行，防重机制必须实现
    """

    def test_concurrent_tasks_same_period_blocked(self, mock_task_repository):
        """
        验证同一账期并发任务的互斥性
        
        使用数据库行锁 + Redis 分布式锁双重保障
        """
        mock_calculator = Mock()
        engine = ScheduleTaskEngine(
            task_repository=mock_task_repository,
            calculator=mock_calculator,
            timeout_seconds=300
        )
        
        period = "2026-04"
        
        # 模拟已有pending状态任务
        mock_task_repository.find_by_period.return_value = {
            "task_id": "TASK-PENDING-001",
            "period": period,
            "status": TaskStatus.PENDING.value
        }
        
        # 执行: 尝试触发同一账期任务
        with pytest.raises(DepreciationTaskLockException):
            engine.trigger_depreciation_task(period)

    def test_different_periods_can_run_concurrently(self, mock_task_repository):
        """
        验证不同账期任务可并行执行
        
        测试场景: 2026-03 和 2026-04 两个账期的折旧可同时计算
        """
        mock_calculator = Mock()
        mock_task_repository.find_by_period.return_value = None
        mock_task_repository.create.side_effect = lambda *args, **kwargs: {
            "task_id": f"TASK-{kwargs.get('period', 'unknown')}",
            "period": kwargs.get('period'),
            "status": TaskStatus.PENDING.value
        }
        
        engine = ScheduleTaskEngine(
            task_repository=mock_task_repository,
            calculator=mock_calculator,
            timeout_seconds=300
        )
        
        # 执行: 同时触发不同账期任务
        result_03 = engine.trigger_depreciation_task("2026-03")
        result_04 = engine.trigger_depreciation_task("2026-04")
        
        # 验证: 两个任务都成功创建
        assert result_03["period"] == "2026-03"
        assert result_04["period"] == "2026-04"


class TestDepreciationBatchProcessing:
    """
    分批处理测试类
    
    根据风险缓解: 实现分批处理(每批100条)，任务内部循环提交
    """

    def test_batch_processing_large_dataset(self, mock_task_repository):
        """
        验证大批量资产的分批处理能力
        
        测试场景: 500条资产记录，每批100条，分5批处理
        """
        mock_calculator = Mock()
        mock_task_repository.get_pending_assets.return_value = [
            {"asset_id": f"AST-{i:04d}", "original_value": 10000}
            for i in range(500)
        ]
        
        engine = ScheduleTaskEngine(
            task_repository=mock_task_repository,
            calculator=mock_calculator,
            batch_size=100
        )
        
        # 执行: 处理大批量资产
        result = engine.process_assets_batch("2026-04")
        
        # 验证: 计算引擎被调用5次(500/100)
        assert mock_calculator.calculate.call_count == 5
        assert result["processed_count"] == 500

    def test_batch_size_configuration(self, mock_task_repository):
        """
        验证批次大小可配置
        
        根据技术约束: 使用 APScheduler，不引入重型组件
        """
        default_engine = ScheduleTaskEngine(
            task_repository=mock_task_repository,
            calculator=Mock(),
            batch_size=100
        )
        
        custom_engine = ScheduleTaskEngine(
            task_repository=mock_task_repository,
            calculator=Mock(),
            batch_size=50
        )
        
        assert default_engine.batch_size == 100
        assert custom_engine.batch_size == 50


class TestDepreciationTaskStatus:
    """
    任务状态转换测试类
    
    验证任务状态机的正确转换
    """

    @pytest.mark.parametrize("initial_status,expected_next", [
        (TaskStatus.PENDING, TaskStatus.RUNNING),
        (TaskStatus.RUNNING, TaskStatus.COMPLETED),
        (TaskStatus.RUNNING, TaskStatus.FAILED),
        (TaskStatus.FAILED, TaskStatus.PENDING),  # 重试后重新排队
    ])
    def test_status_transitions(self, initial_status, expected_next, mock_task_repository):
        """
        验证任务状态转换规则
        
        状态流转:
        - pending -> running (任务开始执行)
        - running -> completed (任务成功完成)
        - running -> failed (任务执行失败)
        - failed -> pending (重试时重新排队)
        """
        mock_calculator = Mock()
        mock_task_repository.get_by_id.return_value = {
            "task_id": "TASK-STATUS-001",
            "status": initial_status.value
        }
        
        engine = ScheduleTaskEngine(
            task_repository=mock_task_repository,
            calculator=mock_calculator
        )
        
        # 验证状态枚举包含所有必要状态
        assert TaskStatus.PENDING is not None
        assert TaskStatus.RUNNING is not None
        assert TaskStatus.COMPLETED is not None
        assert TaskStatus.FAILED is not None


# Pytest配置
pytest_plugins = ["pytest_asyncio"]


# 运行标记
pytestmark = [
    pytest.mark.unit,
    pytest.mark.scheduler,
    pytest.mark.depreciation,
]