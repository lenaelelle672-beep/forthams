"""
Depreciation Job Log Table Migration
=====================================

Revision ID: 2026q2_depreciation_job_log_001
Revises: 2026q2_depreciation_tables_001
Create Date: 2026-04-15 00:00:00.000000

Description:
    创建折旧定时任务执行日志表 (depreciation_job_log)，用于记录
    每月末日自动计提折旧任务的执行状态、耗时和处理结果。

    此表为 SWARM-2026-Q2-003 Iteration 2 Phase 4 定时任务集成的核心数据基础设施。
"""

from typing import Optional

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

# revision identifiers
revision: str = "2026q2_depreciation_job_log_001"
down_revision: str = "2026q2_depreciation_tables_001"
branch_labels: Optional[str] = None
depends_on: Optional[str] = None


def upgrade() -> None:
    """
    创建 depreciation_job_log 表
    
    表结构说明:
    - job_id: 任务唯一标识 (UUID v4)
    - job_type: 任务类型 (SCHEDULED/MANUAL)
    - status: 执行状态 (PENDING/RUNNING/SUCCESS/FAILED/RETRY)
    - period: 折旧期间 (YYYY-MM 格式)
    - executed_at: 执行开始时间
    - completed_at: 执行完成时间
    - processed_count: 处理的资产数量
    - total_amount: 计提的总折旧金额
    - duration_seconds: 执行耗时 (秒)
    - error_message: 错误信息 (失败时)
    - retry_count: 重试次数
    - metadata: 附加元数据 (JSON)
    """
    op.create_table(
        "depreciation_job_log",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            default=sa.text("gen_random_uuid()"),
            comment="主键 ID"
        ),
        sa.Column(
            "job_id",
            UUID(as_uuid=True),
            nullable=False,
            unique=True,
            index=True,
            comment="任务唯一标识"
        ),
        sa.Column(
            "job_type",
            sa.Enum("SCHEDULED", "MANUAL", name="depreciation_job_type"),
            nullable=False,
            default="SCHEDULED",
            comment="任务类型: SCHEDULED=定时任务, MANUAL=手动触发"
        ),
        sa.Column(
            "status",
            sa.Enum("PENDING", "RUNNING", "SUCCESS", "FAILED", "RETRY", name="depreciation_job_status"),
            nullable=False,
            default="PENDING",
            index=True,
            comment="执行状态"
        ),
        sa.Column(
            "period",
            sa.String(7),
            nullable=False,
            index=True,
            comment="折旧期间 (YYYY-MM 格式)"
        ),
        sa.Column(
            "executed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
            comment="执行开始时间"
        ),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="执行完成时间"
        ),
        sa.Column(
            "processed_count",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="处理的资产数量"
        ),
        sa.Column(
            "total_amount",
            sa.Numeric(precision=18, scale=4),
            nullable=False,
            default=0,
            comment="计提的总折旧金额"
        ),
        sa.Column(
            "duration_seconds",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="执行耗时 (秒)"
        ),
        sa.Column(
            "error_message",
            sa.Text(),
            nullable=True,
            comment="错误信息 (失败时)"
        ),
        sa.Column(
            "retry_count",
            sa.Integer(),
            nullable=False,
            default=0,
            comment="重试次数"
        ),
        sa.Column(
            "metadata",
            JSONB(),
            nullable=True,
            comment="附加元数据"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
            comment="记录创建时间"
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
            onupdate=func.now(),
            comment="记录更新时间"
        ),
        comment="折旧定时任务执行日志表"
    )
    
    # 创建复合索引用于常用查询
    op.create_index(
        "ix_depreciation_job_log_period_status",
        "depreciation_job_log",
        ["period", "status"]
    )
    
    op.create_index(
        "ix_depreciation_job_log_executed_at",
        "depreciation_job_log",
        ["executed_at"]
    )


def downgrade() -> None:
    """删除 depreciation_job_log 表"""
    op.drop_index("ix_depreciation_job_log_executed_at", table_name="depreciation_job_log")
    op.drop_index("ix_depreciation_job_log_period_status", table_name="depreciation_job_log")
    op.drop_table("depreciation_job_log")
    
    # 删除枚举类型 (可选, 取决于其他表是否依赖)
    op.execute("DROP TYPE IF EXISTS depreciation_job_status")
    op.execute("DROP TYPE IF EXISTS depreciation_job_type")