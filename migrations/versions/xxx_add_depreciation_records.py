"""Add depreciation_records table

Revision ID: xxx_add_depreciation_records
Revises: 
Create Date: 2024-01-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'xxx_add_depreciation_records'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


class DepreciationMethod(sa.Enum):
    """折旧方法枚举"""
    STRAIGHT_LINE = 'straight_line'
    DOUBLE_DECLINING = 'double_declining'


def upgrade() -> None:
    """
    创建折旧记录表
    
    表结构说明:
    - asset_id: 关联资产ID
    - method: 折旧计算方法 (straight_line / double_declining)
    - calculated_date: 计算基准日期
    - period_year: 折旧期间-年
    - period_month: 折旧期间-月
    - annual_depreciation: 年折旧额
    - accumulated_depreciation: 累计折旧
    - net_book_value: 账面净值
    - created_at: 记录创建时间
    - updated_at: 记录更新时间
    """
    # 创建 depreciation_methods 枚举类型
    depreciation_method_enum = postgresql.ENUM(
        'straight_line', 'double_declining',
        name='depreciation_method',
        create_type=True
    )
    depreciation_method_enum.create(op.get_bind(), checkfirst=True)
    
    # 创建 depreciation_records 表
    op.create_table(
        'depreciation_records',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('asset_id', sa.BigInteger(), sa.ForeignKey('assets.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('method', sa.Enum('straight_line', 'double_declining', name='depreciation_method'), nullable=False),
        sa.Column('calculated_date', sa.Date(), nullable=False, index=True),
        sa.Column('period_year', sa.Integer(), nullable=False),
        sa.Column('period_month', sa.Integer(), nullable=False),
        sa.Column('annual_depreciation', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('accumulated_depreciation', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('net_book_value', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('monthly_depreciation', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('depreciation_rate', sa.Numeric(precision=6, scale=4), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 创建复合索引用于查询特定资产在特定期间内的折旧记录
    op.create_index(
        'ix_depreciation_records_asset_calculated',
        'depreciation_records',
        ['asset_id', 'calculated_date'],
        unique=False
    )
    
    # 创建唯一索引防止同一资产在同一期间重复计算
    op.create_index(
        'ix_depreciation_records_asset_period',
        'depreciation_records',
        ['asset_id', 'period_year', 'period_month', 'method'],
        unique=True
    )
    
    # 添加注释
    op.execute("COMMENT ON TABLE depreciation_records IS '资产折旧记录表，存储每期折旧计算结果'")
    op.execute("COMMENT ON COLUMN depreciation_records.asset_id IS '关联资产ID'")
    op.execute("COMMENT ON COLUMN depreciation_records.method IS '折旧方法: straight_line(直线法) 或 double_declining(双倍余额递减法)'")
    op.execute("COMMENT ON COLUMN depreciation_records.calculated_date IS '折旧计算基准日期'")
    op.execute("COMMENT ON COLUMN depreciation_records.period_year IS '折旧期间-年份'")
    op.execute("COMMENT ON COLUMN depreciation_records.period_month IS '折旧期间-月份'")
    op.execute("COMMENT ON COLUMN depreciation_records.annual_depreciation IS '年折旧额'")
    op.execute("COMMENT ON COLUMN depreciation_records.accumulated_depreciation IS '累计折旧'")
    op.execute("COMMENT ON COLUMN depreciation_records.net_book_value IS '账面净值'")
    op.execute("COMMENT ON COLUMN depreciation_records.monthly_depreciation IS '月折旧额（直线法）'")
    op.execute("COMMENT ON COLUMN depreciation_records.depreciation_rate IS '折旧率（双倍余额递减法）'")


def downgrade() -> None:
    """
    回滚折旧记录表
    
    注意: 如果有依赖此表的外键约束，需要先删除
    """
    op.drop_index('ix_depreciation_records_asset_period', table_name='depreciation_records')
    op.drop_index('ix_depreciation_records_asset_calculated', table_name='depreciation_records')
    op.drop_table('depreciation_records')
    
    # 删除枚举类型
    op.execute("DROP TYPE IF EXISTS depreciation_method")