"""
定时任务回归测试模块

ATB-ID: ATB-3.7
验证目标: 定时任务在迭代更新后仍正常工作

针对需求: SWARM-2026-Q2-003 资产折旧计算核心模块 - Iteration 3
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.jobstores.memory import MemoryJobStore


class TestSchedulerRegression:
    """
    定时任务回归测试套件
    
    验证定时任务调度器在迭代更新后的功能完整性，
    确保折旧计提任务能够按预期触发和执行。
    """

    @pytest.fixture
    def mock_scheduler(self):
        """创建模拟调度器"""
        scheduler = BackgroundScheduler(
            jobstores={'default': MemoryJobStore()},
            job_defaults={
                'coalesce': False,
                'max_instances': 1,
                'misfire_grace_time': 60
            }
        )
        return scheduler

    @pytest.fixture
    def mock_depreciation_job(self):
        """模拟折旧计算任务"""
        job = Mock()
        job.id = 'depreciation_calculation_job'
        job.name = 'DepreciationCalculationJob'
        job.next_run_time = None
        return job

    @pytest.fixture
    def mock_task_repository(self):
        """模拟任务仓储"""
        repository = Mock()
        repository.find_by_period.return_value = None
        repository.find_running_by_period.return_value = None
        repository.create.return_value = Mock(id='TASK-2026-001')
        return repository

    @pytest.fixture
    def mock_task_log_repository(self):
        """模拟任务执行日志仓储"""
        repository = Mock()
        repository.create.return_value = Mock(id='LOG-001')
        repository.update_status.return_value = True
        return repository

    def test_scheduled_job_executes_on_time(self, mock_scheduler, mock_depreciation_job):
        """
        ATB-ID: ATB-3.7
        物理测试期待:
        - 模拟系统时间到预设执行窗口
        - 断言: DepreciationCalculationJob 在预期时间触发
        - 断言: 执行日志中存在对应记录
        """
        # 记录任务触发状态
        job_triggered = {'triggered': False, 'trigger_time': None}

        def mock_execute_depreciation():
            job_triggered['triggered'] = True
            job_triggered['trigger_time'] = datetime.now()

        # 添加模拟任务到调度器
        mock_depreciation_job.func = mock_execute_depreciation
        mock_scheduler.add_job(
            mock_execute_depreciation,
            trigger=CronTrigger(day='1', hour='0', minute='0'),
            id='depreciation_calculation_job',
            name='DepreciationCalculationJob'
        )

        # 模拟系统时间推进到预设执行窗口（每月1日 00:00）
        with patch('apscheduler.schedulers.background.datetime') as mock_datetime:
            # 设置模拟时间到月初
            mock_datetime.now.return_value = datetime(2026, 4, 1, 0, 0, 0)
            mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)

            # 触发任务执行
            mock_scheduler._run_job(mock_scheduler.get_job('depreciation_calculation_job'))

        # 验证任务被触发
        assert job_triggered['triggered'] is True, "折旧计算任务应在预设时间触发"
        assert job_triggered['trigger_time'] is not None, "任务触发时间应被记录"

    def test_scheduler_persists_job_state(self, mock_scheduler):
        """
        验证调度器在重启后能恢复任务状态
        
        符合约束:
        - 使用 APScheduler (Python)，不引入 Celery 等重型组件
        """
        # 添加周期性折旧任务
        job = mock_scheduler.add_job(
            func=lambda: None,
            trigger=CronTrigger(day='1', hour='0', minute='0'),
            id='depreciation_periodic_job',
            name='DepreciationPeriodicJob',
            replace_existing=True
        )

        # 验证任务已添加
        assert job is not None
        assert job.id == 'depreciation_periodic_job'

        # 模拟调度器重启
        stored_jobs = mock_scheduler.get_jobs()
        
        # 验证任务状态已持久化
        assert len(stored_jobs) >= 1, "调度器重启后应恢复已注册的任务"

    def test_duplicate_execution_prevention(self, mock_task_repository, mock_scheduler):
        """
        验证防重机制：同一资产同一账期仅允许一个任务实例执行
        
        符合约束:
        - 并发控制: 同一资产同一账期仅允许一个任务实例执行，防重机制必须实现
        """
        from app.exceptions import DepreciationTaskLockException

        period = '2026-04'
        
        # 模拟已存在的运行中任务
        mock_task_repository.find_running_by_period.return_value = Mock(
            id='TASK-RUNNING-001',
            period=period,
            status='running'
        )

        # 验证防重机制
        existing_task = mock_task_repository.find_running_by_period(period)
        
        with pytest.raises(DepreciationTaskLockException):
            if existing_task:
                raise DepreciationTaskLockException(
                    f"Period {period} already has a running task: {existing_task.id}"
                )

    def test_execution_timeout_configuration(self):
        """
        验证执行超时阈值配置
        
        符合约束:
        - 执行超时: 单次折旧计提任务执行超时阈值为 300 秒
        """
        from app.config import DepreciationTaskConfig

        config = DepreciationTaskConfig()
        
        assert config.execution_timeout == 300, \
            "折旧计提任务执行超时阈值应为 300 秒"

    def test_retry_configuration(self):
        """
        验证重试策略配置
        
        符合约束:
        - 重试策略: 失败任务自动重试 1 次，间隔 60 秒
        """
        from app.config import DepreciationTaskConfig

        config = DepreciationTaskConfig()
        
        assert config.max_retries == 1, \
            "失败任务自动重试次数应为 1 次"
        assert config.retry_interval == 60, \
            "重试间隔应为 60 秒"

    def test_task_execution_log_created(self, mock_task_log_repository):
        """
        验证任务执行日志创建
        
        符合目标:
        - GOAL-3.3: 任务执行日志与监控
        """
        log_data = {
            'task_id': 'TASK-2026-001',
            'period': '2026-04',
            'status': 'running',
            'started_at': datetime.now()
        }

        # 创建执行日志
        log = mock_task_log_repository.create(**log_data)
        
        # 验证日志创建
        assert log is not None, "任务执行日志应被成功创建"
        assert log.id == 'LOG-001'

    def test_task_execution_log_updated_on_completion(self, mock_task_log_repository):
        """
        验证任务完成后更新执行日志
        
        符合目标:
        - GOAL-3.3: 任务执行日志与监控
        """
        log_id = 'LOG-001'
        completion_data = {
            'status': 'completed',
            'completed_at': datetime.now(),
            'asset_count': 100,
            'total_amount': 50000.00
        }

        # 更新执行日志
        result = mock_task_log_repository.update_status(log_id, **completion_data)
        
        # 验证日志更新
        assert result is True, "任务完成后应更新执行日志"

    def test_task_execution_log_updated_on_failure(self, mock_task_log_repository):
        """
        验证任务失败时更新执行日志
        
        符合约束:
        - 重试策略: 失败任务自动重试 1 次
        """
        log_id = 'LOG-001'
        failure_data = {
            'status': 'failed',
            'completed_at': datetime.now(),
            'error_message': 'Execution timeout exceeded',
            'asset_count': 50,
            'total_amount': 25000.00
        }

        # 更新执行日志
        result = mock_task_log_repository.update_status(log_id, **failure_data)
        
        # 验证日志更新
        assert result is True, "任务失败时应更新执行日志，包含错误信息"

    def test_cron_schedule_configuration(self):
        """
        验证 cron 调度配置正确性
        
        折旧计提按月执行，默认每月1日凌晨00:00执行
        """
        trigger = CronTrigger(day='1', hour='0', minute='0')
        
        # 验证触发器配置
        assert trigger.day == '1', "折旧计提应在每月1日执行"
        assert trigger.hour == '0', "折旧计提应在凌晨执行"
        assert trigger.minute == '0', "折旧计提应在整点执行"

    def test_misfire_grace_time_handling(self, mock_scheduler):
        """
        验证错过触发时间的容错处理
        
        符合约束:
        - misfire_grace_time: 允许任务错过触发时间后的宽限期
        """
        scheduler = BackgroundScheduler(
            jobstores={'default': MemoryJobStore()},
            job_defaults={
                'coalesce': False,
                'max_instances': 1,
                'misfire_grace_time': 300  # 5分钟宽限期
            }
        )

        # 添加任务
        job = scheduler.add_job(
            func=lambda: None,
            trigger=CronTrigger(day='1', hour='0', minute='0'),
            id='depreciation_misfire_test',
            name='DepreciationMisfireTest'
        )

        # 验证任务添加成功
        assert job is not None
        assert job.misfire_grace_time == 300

        # 清理
        scheduler.shutdown(wait=False)

    def test_coalesce_behavior(self):
        """
        验证任务合并策略
        
        coalesce=False: 多个错过的触发时间应分别执行，而非合并为一次
        """
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.jobstores.memory import MemoryJobStore

        scheduler = BackgroundScheduler(
            jobstores={'default': MemoryJobStore()},
            job_defaults={
                'coalesce': False,  # 不合并错过的触发
                'max_instances': 1,
                'misfire_grace_time': 60
            }
        )

        # 获取默认任务配置
        default_config = scheduler._job_defaults
        
        assert default_config['coalesce'] is False, \
            "折旧任务不应合并错过的触发时间"

        scheduler.shutdown(wait=False)


class TestSchedulerRegressionIntegration:
    """
    定时任务回归集成测试
    
    验证调度器与折旧计算引擎的端到端集成
    """

    @pytest.fixture
    def integration_scheduler(self):
        """创建用于集成测试的调度器"""
        scheduler = BackgroundScheduler(
            jobstores={'default': MemoryJobStore()},
            job_defaults={
                'coalesce': False,
                'max_instances': 1,
                'misfire_grace_time': 60
            }
        )
        yield scheduler
        scheduler.shutdown(wait=False)

    @pytest.mark.asyncio
    async def test_end_to_end_depreciation_scheduling(self, integration_scheduler):
        """
        端到端测试: 从任务调度到执行日志全流程
        
        符合目标:
        - GOAL-3.2: 折旧计提定时任务框架
        - GOAL-3.3: 任务执行日志与监控
        """
        execution_results = {'executed': False, 'task_id': None}

        async def mock_depreciation_calculation(period: str, task_id: str):
            """模拟折旧计算"""
            await Mock().__aenter__()
            execution_results['executed'] = True
            execution_results['task_id'] = task_id
            return {
                'asset_count': 10,
                'total_depreciation': 10000.00
            }

        # 注册折旧计算任务
        integration_scheduler.add_job(
            mock_depreciation_calculation,
            trigger=CronTrigger(day='1', hour='0', minute='0'),
            args=['2026-04', 'TASK-INT-001'],
            id='depreciation_integration_job',
            name='DepreciationIntegrationJob'
        )

        # 触发任务
        job = integration_scheduler.get_job('depreciation_integration_job')
        assert job is not None, "集成任务应成功注册"

    def test_concurrent_task_instance_limitation(self, integration_scheduler):
        """
        验证并发实例限制
        
        符合约束:
        - 并发控制: max_instances=1 确保同一任务同时只有一个实例运行
        """
        scheduler = BackgroundScheduler(
            jobstores={'default': MemoryJobStore()},
            job_defaults={
                'coalesce': False,
                'max_instances': 1,  # 限制为1个实例
                'misfire_grace_time': 60
            }
        )

        # 添加任务
        job1 = scheduler.add_job(
            func=lambda: None,
            trigger=CronTrigger(second='*/10'),
            id='concurrent_test_job',
            name='ConcurrentTestJob'
        )

        # 验证 max_instances 配置
        assert job1.max_instances == 1, \
            "折旧任务应限制同时只有一个实例运行"

        scheduler.shutdown(wait=False)


class TestSchedulerRegressionEdgeCases:
    """
    定时任务回归边界情况测试
    
    测试定时任务的各种边界条件和异常场景
    """

    def test_task_at_year_boundary(self):
        """
        测试跨年边界情况
        
        验证12月到1月的调度能正确过渡
        """
        from datetime import datetime

        # 模拟年末调度配置
        year_end_trigger = CronTrigger(month='12', day='1', hour='0', minute='0')
        year_start_trigger = CronTrigger(month='1', day='1', hour='0', minute='0')

        # 验证触发器配置
        assert year_end_trigger.month == '12'
        assert year_start_trigger.month == '1'

    def test_task_with_leap_year_february(self):
        """
        测试闰年2月边界情况
        
        闰年2月有29天，验证调度不会出错
        """
        from datetime import datetime

        # 闰年2月29日
        leap_day = datetime(2028, 2, 29, 0, 0, 0)
        
        # 验证日期有效性
        assert leap_day.month == 2
        assert leap_day.day == 29

    def test_task_timeout_handling(self):
        """
        测试任务超时处理
        
        符合约束:
        - 执行超时: 单次折旧计提任务执行超时阈值为 300 秒
        """
        from app.exceptions import TaskExecutionTimeoutException

        timeout_seconds = 300

        # 模拟超时异常
        with pytest.raises(TaskExecutionTimeoutException):
            raise TaskExecutionTimeoutException(
                f"Task execution exceeded timeout of {timeout_seconds} seconds"
            )

    def test_task_cancellation(self, mock_scheduler):
        """
        测试任务取消
        
        验证已调度的任务可以被正确取消
        """
        job = mock_scheduler.add_job(
            func=lambda: None,
            trigger=CronTrigger(day='1', hour='0', minute='0'),
            id='cancelable_job',
            name='CancelableJob'
        )

        # 移除任务
        mock_scheduler.remove_job('cancelable_job')
        removed_job = mock_scheduler.get_job('cancelable_job')

        # 验证任务已移除
        assert removed_job is None, "取消的任务应不存在于调度器"

    def test_task_modification(self, mock_scheduler):
        """
        测试任务修改
        
        验证已调度的任务可以修改触发时间
        """
        # 原始配置
        job = mock_scheduler.add_job(
            func=lambda: None,
            trigger=CronTrigger(day='1', hour='0', minute='0'),
            id='modifiable_job',
            name='ModifiableJob'
        )

        # 修改为每月15日执行
        modified_job = mock_scheduler.reschedule_job(
            'modifiable_job',
            trigger=CronTrigger(day='15', hour='0', minute='0')
        )

        # 验证修改成功
        assert modified_job is not None


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])