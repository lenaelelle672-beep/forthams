# tests/unit/test_schedule_engine.py
"""
Schedule Task Engine Unit Tests

测试目标: 定时任务调度与防重机制
对应规格: SWARM-2026-Q2-003 Iteration 3
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
from decimal import Decimal
import time


class TestScheduleTaskEngine:
    """
    ATB-ID: ATB-3.3
    验证目标: 定时任务调度与防重机制
    
    测试场景:
    - 验证同一账期任务防重机制
    - 验证执行超时处理
    - 验证任务状态流转
    """

    def test_duplicate_execution_blocked(self):
        """
        ATB-ID: ATB-3.3
        物理测试期待:
        - 准备: 任务表中存在状态为'running'的2026-04计提任务
        - 执行: 触发同一账期计提任务
        - 验证: 
          1. 抛出 DepreciationTaskLockException
          2. 不创建新任务记录
        
        测试数据:
        - 已有任务: TASK-001, period='2026-04', status='running'
        """
        # Arrange: 模拟已存在的 running 状态任务
        mock_repo = Mock()
        existing_task = {
            'task_id': 'TASK-001',
            'period': '2026-04',
            'status': 'running',
            'started_at': datetime.now() - timedelta(minutes=30)
        }
        mock_repo.find_running_task.return_value = existing_task
        
        # Mock task creation (should NOT be called)
        mock_repo.create_task.return_value = None
        
        # Act & Assert: 尝试在同一账期创建新任务应被阻止
        with pytest.raises(DepreciationTaskLockException) as exc_info:
            from src.swarm_003.depreciation.services.schedule_engine import ScheduleTaskEngine
            engine = ScheduleTaskEngine(task_repository=mock_repo)
            engine.trigger_depreciation_task(period='2026-04', asset_ids=['AST-001', 'AST-002'])
        
        # 验证错误消息包含账期信息
        assert '2026-04' in str(exc_info.value)
        
        # 验证不会创建新任务记录
        mock_repo.create_task.assert_not_called()

    def test_execution_timeout_raises_exception(self):
        """
        ATB-ID: ATB-3.4
        物理测试期待:
        - Mock: 计算引擎耗时 > 300秒
        - 执行: run_depreciation_task(task_id='T001')
        - 验证: 任务状态更新为'failed'，错误码'TIMEOUT_EXCEEDED'
        
        测试约束:
        - 执行超时阈值: 300秒
        - 重试策略: 失败任务自动重试1次，间隔60秒
        """
        # Arrange: 模拟计算引擎超时
        mock_calculator = Mock()
        
        def slow_calculate(*args, **kwargs):
            """模拟超过300秒的计算过程"""
            time.sleep(0.1)  # 使用0.1秒模拟，实际场景为301秒
            raise TimeoutError("Calculation exceeded 300 seconds")
        
        mock_calculator.calculate.side_effect = slow_calculate
        
        # Mock Repository
        mock_repo = Mock()
        task_record = {
            'task_id': 'T001',
            'period': '2026-04',
            'status': 'pending',
            'created_at': datetime.now()
        }
        mock_repo.get_task.return_value = task_record
        
        # Act: 执行折旧任务
        from src.swarm_003.depreciation.services.schedule_engine import ScheduleTaskEngine
        engine = ScheduleTaskEngine(
            task_repository=mock_repo,
            depreciation_calculator=mock_calculator
        )
        
        result = engine.run_depreciation_task(task_id='T001')
        
        # Assert: 验证任务状态更新为 failed，错误码为 TIMEOUT_EXCEEDED
        assert result['status'] == 'failed'
        assert result['error_code'] == 'TIMEOUT_EXCEEDED'
        assert 'timeout' in result['error_message'].lower()

    def test_successful_task_execution(self):
        """
        ATB-ID: ATB-3.3 (补充测试)
        验证正常任务执行流程
        """
        # Arrange: 准备模拟数据
        mock_repo = Mock()
        mock_repo.find_running_task.return_value = None  # 无进行中任务
        
        mock_calculator = Mock()
        mock_calculator.calculate.return_value = {
            'asset_id': 'AST-001',
            'period': '2026-04',
            'depreciation_amount': Decimal('1000.00'),
            'accumulated': Decimal('5000.00'),
            'net_book_value': Decimal('15000.00')
        }
        
        task_record = {
            'task_id': 'T002',
            'period': '2026-04',
            'status': 'pending',
            'created_at': datetime.now()
        }
        mock_repo.get_task.return_value = task_record
        
        # Act
        from src.swarm_003.depreciation.services.schedule_engine import ScheduleTaskEngine
        engine = ScheduleTaskEngine(
            task_repository=mock_repo,
            depreciation_calculator=mock_calculator
        )
        
        result = engine.run_depreciation_task(task_id='T002')
        
        # Assert
        assert result['status'] == 'completed'
        assert mock_repo.update_task_status.called

    def test_task_retry_on_failure(self):
        """
        ATB-ID: ATB-3.4 (补充测试)
        验证失败任务自动重试机制
        """
        # Arrange: 模拟首次失败
        mock_repo = Mock()
        mock_repo.find_running_task.return_value = None
        
        mock_calculator = Mock()
        call_count = 0
        
        def failing_then_success(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("First attempt failed")
            return {'depreciation': Decimal('100.00')}
        
        mock_calculator.calculate.side_effect = failing_then_success
        
        # Act
        from src.swarm_003.depreciation.services.schedule_engine import ScheduleTaskEngine
        engine = ScheduleTaskEngine(
            task_repository=mock_repo,
            depreciation_calculator=mock_calculator,
            max_retries=1,
            retry_interval=60
        )
        
        result = engine.run_depreciation_task(task_id='T003')
        
        # Assert: 验证重试后成功
        assert call_count == 2
        assert result['status'] == 'completed'


class TestDepreciationTaskLockException:
    """
    ATB-ID: ATB-3.3 (补充)
    验证防重异常类定义
    """
    
    def test_lock_exception_contains_period_info(self):
        """验证异常包含账期信息"""
        from src.swarm_003.depreciation.exceptions import DepreciationTaskLockException
        
        exc = DepreciationTaskLockException(period='2026-04', task_id='T001')
        assert '2026-04' in str(exc)
        assert exc.period == '2026-04'
    
    def test_lock_exception_is_instantiable(self):
        """验证异常可正常实例化"""
        from src.swarm_003.depreciation.exceptions import DepreciationTaskLockException
        
        exc = DepreciationTaskLockException(period='2026-03')
        assert exc is not None


class TestScheduleTaskConfiguration:
    """
    ATB-ID: ATB-3.4 (补充)
    验证调度任务配置
    """
    
    def test_timeout_threshold_300_seconds(self):
        """验证超时阈值配置为300秒"""
        from src.swarm_003.depreciation.config import ScheduleTaskConfig
        
        config = ScheduleTaskConfig()
        assert config.execution_timeout == 300
    
    def test_retry_interval_60_seconds(self):
        """验证重试间隔配置为60秒"""
        from src.swarm_003.depreciation.config import ScheduleTaskConfig
        
        config = ScheduleTaskConfig()
        assert config.retry_interval == 60
    
    def test_max_retries_1(self):
        """验证最大重试次数为1"""
        from src.swarm_003.depreciation.config import ScheduleTaskConfig
        
        config = ScheduleTaskConfig()
        assert config.max_retries == 1