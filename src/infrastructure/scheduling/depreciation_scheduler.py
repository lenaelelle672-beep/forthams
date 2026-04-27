"""
资产折旧计提定时调度器

本模块实现折旧计提的自动定时任务与手动触发机制。
遵循 SWARM-2026-Q2-003 Iteration 2 规格要求。

ATB 参考:
- ATB-011: 定时任务 Cron 配置，每月末日 00:00 执行
- ATB-012: 手动触发单次计提接口
- ATB-013: 执行日志记录
- ATB-014: 失败重试机制（最多重试3次，间隔2分钟）
"""

import logging
from datetime import datetime
from typing import Optional
from decimal import Decimal
from dataclasses import dataclass, asdict
from enum import Enum

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR

logger = logging.getLogger(__name__)


class JobStatus(Enum):
    """任务执行状态枚举"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    RETRYING = "retrying"


class DepreciationJobLog:
    """折旧任务执行日志数据模型"""
    
    def __init__(
        self,
        job_id: str,
        executed_at: datetime,
        status: JobStatus,
        processed_count: int = 0,
        total_amount: Optional[Decimal] = None,
        duration_seconds: Optional[float] = None,
        error_message: Optional[str] = None,
        retry_count: int = 0
    ):
        self.job_id = job_id
        self.executed_at = executed_at
        self.status = status
        self.processed_count = processed_count
        self.total_amount = total_amount or Decimal("0")
        self.duration_seconds = duration_seconds
        self.error_message = error_message
        self.retry_count = retry_count
    
    def to_dict(self) -> dict:
        """转换为字典格式，用于日志记录"""
        return {
            "job_id": self.job_id,
            "executed_at": self.executed_at.isoformat(),
            "status": self.status.value,
            "processed_count": self.processed_count,
            "total_amount": str(self.total_amount),
            "duration_seconds": self.duration_seconds,
            "error_message": self.error_message,
            "retry_count": self.retry_count
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "DepreciationJobLog":
        """从字典创建实例"""
        return cls(
            job_id=data["job_id"],
            executed_at=datetime.fromisoformat(data["executed_at"]),
            status=JobStatus(data["status"]),
            processed_count=data.get("processed_count", 0),
            total_amount=Decimal(data.get("total_amount", "0")),
            duration_seconds=data.get("duration_seconds"),
            error_message=data.get("error_message"),
            retry_count=data.get("retry_count", 0)
        )


class DepreciationScheduler:
    """
    折旧计提调度器
    
    支持：
    - 每月末日自动计提折旧（Cron: 0 0 28-31 * *）
    - 手动触发单次计提
    - 执行日志记录
    - 失败自动重试（最多3次，间隔2分钟）
    
    幂等性：重复执行不产生重复折旧
    """
    
    JOB_ID = "monthly_depreciation_accrual"
    MAX_RETRIES = 3
    RETRY_INTERVAL_MINUTES = 2
    
    def __init__(self, depreciation_service=None, job_log_repository=None):
        """
        初始化折旧调度器
        
        Args:
            depreciation_service: 折旧服务实例，用于执行折旧计算
            job_log_repository: 任务日志仓库，用于记录执行日志
        """
        self._scheduler = BackgroundScheduler()
        self._depreciation_service = depreciation_service
        self._job_log_repository = job_log_repository
        self._retry_counts: dict[str, int] = {}
        
        self._setup_event_listeners()
    
    def _setup_event_listeners(self) -> None:
        """配置调度器事件监听器"""
        self._scheduler.add_listener(
            self._on_job_executed,
            EVENT_JOB_EXECUTED | EVENT_JOB_ERROR
        )
    
    def _on_job_executed(self, event) -> None:
        """
        任务执行回调
        
        Args:
            event: APScheduler 事件对象
        """
        job_id = event.job_id
        retry_key = f"{job_id}_{event.scheduled_run_time}"
        
        if event.exception:
            logger.error(f"任务 {job_id} 执行失败: {event.exception}")
            self._handle_job_failure(job_id, retry_key, str(event.exception))
        else:
            logger.info(f"任务 {job_id} 执行成功")
            self._retry_counts.pop(retry_key, None)
    
    def _handle_job_failure(self, job_id: str, retry_key: str, error_msg: str) -> None:
        """
        处理任务失败
        
        Args:
            job_id: 任务ID
            retry_key: 重试键
            error_msg: 错误信息
        """
        current_retry = self._retry_counts.get(retry_key, 0)
        
        if current_retry < self.MAX_RETRIES:
            self._retry_counts[retry_key] = current_retry + 1
            logger.warning(
                f"任务 {job_id} 第 {current_retry + 1} 次失败，"
                f"{self.RETRY_INTERVAL_MINUTES}分钟后重试"
            )
        else:
            logger.error(f"任务 {job_id} 已达到最大重试次数 {self.MAX_RETRIES}，标记为失败")
            self._log_job_failure(job_id, error_msg, self.MAX_RETRIES)
    
    def _log_job_failure(
        self,
        job_id: str,
        error_msg: str,
        retry_count: int
    ) -> None:
        """记录任务失败日志"""
        if self._job_log_repository:
            log_entry = DepreciationJobLog(
                job_id=job_id,
                executed_at=datetime.utcnow(),
                status=JobStatus.FAILED,
                error_message=error_msg,
                retry_count=retry_count
            )
            self._job_log_repository.save(log_entry.to_dict())
    
    def start(self) -> None:
        """启动调度器，注册每月末日折旧计提任务"""
        cron_expression = "0 0 28-31 * *"
        trigger = CronTrigger.from_crontab(cron_expression)
        
        self._scheduler.add_job(
            func=self._execute_depreciation_accrual,
            trigger=trigger,
            id=self.JOB_ID,
            name="月度折旧自动计提",
            replace_existing=True,
            misfire_grace_time=3600,
            coalesce=True
        )
        
        self._scheduler.start()
        logger.info(
            f"折旧调度器已启动，每月末日 00:00 执行折旧计提任务"
            f" (Cron: {cron_expression})"
        )
    
    def stop(self) -> None:
        """停止调度器"""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info("折旧调度器已停止")
    
    def _execute_depreciation_accrual(self) -> dict:
        """
        执行折旧计提内部方法
        
        Returns:
            包含处理结果的字典
        """
        start_time = datetime.utcnow()
        job_id = f"{self.JOB_ID}_{start_time.strftime('%Y%m%d%H%M%S')}"
        
        log_entry = DepreciationJobLog(
            job_id=job_id,
            executed_at=start_time,
            status=JobStatus.RUNNING
        )
        
        try:
            result = self._run_depreciation_calculation()
            
            end_time = datetime.utcnow()
            duration = (end_time - start_time).total_seconds()
            
            log_entry.status = JobStatus.SUCCESS
            log_entry.processed_count = result.get("processed_count", 0)
            log_entry.total_amount = result.get("total_amount", Decimal("0"))
            log_entry.duration_seconds = duration
            
            self._save_job_log(log_entry)
            
            logger.info(
                f"折旧计提任务完成: 处理 {log_entry.processed_count} 条资产，"
                f"总金额 {log_entry.total_amount}，耗时 {duration:.2f}s"
            )
            
            return asdict(log_entry)
            
        except Exception as e:
            log_entry.status = JobStatus.FAILED
            log_entry.error_message = str(e)
            self._save_job_log(log_entry)
            
            logger.error(f"折旧计提任务异常: {e}")
            raise
    
    def _run_depreciation_calculation(self) -> dict:
        """
        运行折旧计算逻辑
        
        Returns:
            计算结果字典
        """
        if self._depreciation_service:
            return self._depreciation_service.calculate_monthly_depreciation()
        
        return {
            "processed_count": 0,
            "total_amount": Decimal("0"),
            "message": "折旧服务未配置"
        }
    
    def _save_job_log(self, log_entry: DepreciationJobLog) -> None:
        """保存任务日志到仓库"""
        if self._job_log_repository:
            self._job_log_repository.save(log_entry.to_dict())
    
    def trigger_manual_accrual(self, period: Optional[str] = None) -> dict:
        """
        手动触发单次折旧计提
        
        幂等性：重复执行不产生重复折旧
        
        Args:
            period: 可选的期间（如 "2026-02"），默认使用当前月份
            
        Returns:
            执行结果字典
        """
        start_time = datetime.utcnow()
        job_id = f"manual_{self.JOB_ID}_{start_time.strftime('%Y%m%d%H%M%S')}"
        
        log_entry = DepreciationJobLog(
            job_id=job_id,
            executed_at=start_time,
            status=JobStatus.RUNNING
        )
        
        try:
            if period:
                result = self._run_depreciation_for_period(period)
            else:
                result = self._run_depreciation_calculation()
            
            end_time = datetime.utcnow()
            duration = (end_time - start_time).total_seconds()
            
            log_entry.status = JobStatus.SUCCESS
            log_entry.processed_count = result.get("processed_count", 0)
            log_entry.total_amount = result.get("total_amount", Decimal("0"))
            log_entry.duration_seconds = duration
            
            self._save_job_log(log_entry)
            
            logger.info(
                f"手动折旧计提完成: 处理 {log_entry.processed_count} 条资产，"
                f"总金额 {log_entry.total_amount}，耗时 {duration:.2f}s"
            )
            
            return {
                "job_id": job_id,
                "status": "success",
                "total_assets_processed": log_entry.processed_count,
                "total_amount": str(log_entry.total_amount),
                "duration_seconds": duration
            }
            
        except Exception as e:
            log_entry.status = JobStatus.FAILED
            log_entry.error_message = str(e)
            self._save_job_log(log_entry)
            
            return {
                "job_id": job_id,
                "status": "failed",
                "error": str(e)
            }
    
    def _run_depreciation_for_period(self, period: str) -> dict:
        """
        为指定期间运行折旧计算
        
        Args:
            period: 期间字符串（如 "2026-02"）
            
        Returns:
            计算结果字典
        """
        if self._depreciation_service:
            return self._depreciation_service.calculate_for_period(period)
        
        return {
            "processed_count": 0,
            "total_amount": Decimal("0"),
            "period": period
        }
    
    def get_job_log(self, job_id: str) -> Optional[dict]:
        """
        获取任务执行日志
        
        Args:
            job_id: 任务ID
            
        Returns:
            日志字典或 None
        """
        if self._job_log_repository:
            return self._job_log_repository.get(job_id)
        return None
    
    def get_recent_logs(self, limit: int = 10) -> list[dict]:
        """
        获取最近的任务执行日志
        
        Args:
            limit: 返回数量限制
            
        Returns:
            日志列表
        """
        if self._job_log_repository:
            return self._job_log_repository.get_recent(limit)
        return []
    
    @property
    def is_running(self) -> bool:
        """检查调度器是否正在运行"""
        return self._scheduler.running and self._scheduler.state == 1
    
    @property
    def next_run_time(self) -> Optional[datetime]:
        """获取下次任务执行时间"""
        job = self._scheduler.get_job(self.JOB_ID)
        if job:
            return job.next_run_time
        return None


# 调度器单例实例
_scheduler_instance: Optional[DepreciationScheduler] = None


def get_scheduler(
    depreciation_service=None,
    job_log_repository=None
) -> DepreciationScheduler:
    """
    获取调度器单例
    
    Args:
        depreciation_service: 折旧服务实例
        job_log_repository: 任务日志仓库
        
    Returns:
        DepreciationScheduler 单例
    """
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = DepreciationScheduler(
            depreciation_service=depreciation_service,
            job_log_repository=job_log_repository
        )
    return _scheduler_instance


def start_scheduler(depreciation_service=None, job_log_repository=None) -> DepreciationScheduler:
    """
    启动折旧调度器
    
    Args:
        depreciation_service: 折旧服务实例
        job_log_repository: 任务日志仓库
        
    Returns:
        启动后的调度器实例
    """
    scheduler = get_scheduler(depreciation_service, job_log_repository)
    if not scheduler.is_running:
        scheduler.start()
    return scheduler


def stop_scheduler() -> None:
    """停止折旧调度器"""
    global _scheduler_instance
    if _scheduler_instance and _scheduler_instance.is_running:
        _scheduler_instance.stop()
        _scheduler_instance = None