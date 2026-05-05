import React, { useMemo, useCallback, useState } from 'react';
import {
  Card,
  Statistic,
  Row,
  Col,
  Button,
  Divider,
  Table,
  Tag,
  Space,
  Progress,
  Modal,
  message,
  Empty,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FileTextOutlined,
  SendOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/**
 * 差异明细项接口 —— 表示单条资产盘盈或盘亏的记录。
 *
 * 业务规则：
 * - `diffType === 'surplus'` 表示"账面无，实盘有"（盘盈），此时 expectedCount 为 0。
 * - `diffType === 'deficit'` 表示"账面有，实盘无"（盘亏），此时 actualCount 为 0。
 */
export interface IInventoryDiffItem {
  /** 记录唯一标识 */
  id: string;
  /** 资产名称 */
  assetName: string;
  /** 资产编号 */
  assetCode: string;
  /** 存放位置 */
  location: string;
  /** 账面数量（应有数量） */
  expectedCount: number;
  /** 实盘数量 */
  actualCount: number;
  /** 差异数 = actualCount - expectedCount */
  diffCount: number;
  /** 差异类型：surplus=盘盈 / deficit=盘亏 */
  diffType: 'surplus' | 'deficit';
}

/**
 * DiffSummaryPanel 组件属性接口
 */
export interface IDiffSummaryPanelProps {
  /** 范围内资产总数 */
  totalCount: number;
  /** 已完成盘点的资产数 */
  countedCount: number;
  /** 盘盈资产数量 */
  surplusCount: number;
  /** 盘亏资产数量 */
  deficitCount: number;
  /** 盘盈盘亏差异明细列表 */
  diffItems?: IInventoryDiffItem[];
  /** 一键提交核准回调（由父容器调用 POST /api/inventory/approve） */
  onSubmitApproval?: () => Promise<void>;
  /** 导出盘点报告回调 */
  onExportReport?: () => void;
  /** 外部加载态（如接口请求中） */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// 子组件：统计卡片
// ---------------------------------------------------------------------------

interface StatCardProps {
  title: string;
  value: number;
  prefix?: React.ReactNode;
  valueStyle?: React.CSSProperties;
}

/**
 * StatCard —— 单个统计指标卡片，封装 Ant Design Statistic。
 */
const StatCard: React.FC<StatCardProps> = ({ title, value, prefix, valueStyle }) => (
  <Card size="small" bordered={false} style={{ background: '#fafafa', borderRadius: 8 }}>
    <Statistic title={title} value={value} prefix={prefix} valueStyle={valueStyle} />
  </Card>
);

// ---------------------------------------------------------------------------
// 主组件：DiffSummaryPanel
// ---------------------------------------------------------------------------

/**
 * DiffSummaryPanel —— 盘点差异汇总面板
 *
 * 职责：
 * 1. 展示盘点进度条与核心统计指标（总资产 / 已盘 / 未盘 / 盘盈 / 盘亏）。
 * 2. 渲染差异资产明细表格（支持分页与滚动），每行标注盘盈/盘亏类型。
 * 3. 提供「一键提交核准」与「导出报告」操作按钮；提交前弹出确认弹窗。
 *
 * @param props - {@link IDiffSummaryPanelProps}
 */
const DiffSummaryPanel: React.FC<IDiffSummaryPanelProps> = ({
  totalCount,
  countedCount,
  surplusCount,
  deficitCount,
  diffItems = [],
  onSubmitApproval,
  onExportReport,
  loading = false,
}) => {
  const [submitting, setSubmitting] = useState(false);

  // ---- 派生计算 ----

  /** 未盘点数量 */
  const unCountedCount = useMemo<number>(
    () => Math.max(totalCount - countedCount, 0),
    [totalCount, countedCount],
  );

  /** 盘点进度百分比 */
  const progressPercent = useMemo<number>(
    () => (totalCount > 0 ? Math.round((countedCount / totalCount) * 100) : 0),
    [totalCount, countedCount],
  );

  /** 是否全部盘点完成 */
  const isAllCounted = useMemo<boolean>(
    () => totalCount > 0 && countedCount >= totalCount,
    [totalCount, countedCount],
  );

  // ---- 表格列定义 ----

  /** 差异明细表格列配置 */
  const diffColumns: ColumnsType<IInventoryDiffItem> = useMemo(
    () => [
      {
        title: '资产编号',
        dataIndex: 'assetCode',
        key: 'assetCode',
        width: 140,
      },
      {
        title: '资产名称',
        dataIndex: 'assetName',
        key: 'assetName',
        ellipsis: true,
      },
      {
        title: '存放位置',
        dataIndex: 'location',
        key: 'location',
        ellipsis: true,
      },
      {
        title: '账面数量',
        dataIndex: 'expectedCount',
        key: 'expectedCount',
        width: 100,
        align: 'right',
      },
      {
        title: '实盘数量',
        dataIndex: 'actualCount',
        key: 'actualCount',
        width: 100,
        align: 'right',
      },
      {
        title: '差异数',
        dataIndex: 'diffCount',
        key: 'diffCount',
        width: 100,
        align: 'right',
        /** 渲染差异数值，正数绿色带 + 前缀，负数红色 */
        render: (val: number) => (
          <span
            style={{
              color: val > 0 ? '#3f8600' : val < 0 ? '#cf1322' : undefined,
              fontWeight: 500,
            }}
          >
            {val > 0 ? `+${val}` : val}
          </span>
        ),
      },
      {
        title: '差异类型',
        dataIndex: 'diffType',
        key: 'diffType',
        width: 100,
        align: 'center',
        /** 根据差异类型渲染不同颜色标签 */
        render: (type: 'surplus' | 'deficit') =>
          type === 'surplus' ? (
            <Tag color="green" icon={<ArrowUpOutlined />}>
              盘盈
            </Tag>
          ) : (
            <Tag color="red" icon={<ArrowDownOutlined />}>
              盘亏
            </Tag>
          ),
      },
    ],
    [],
  );

  // ---- 事件处理 ----

  /**
   * 处理一键提交核准操作。
   * 弹出确认弹窗 → 用户确认 → 调用 onSubmitApproval → 成功后由父容器处理路由跳转。
   */
  const handleSubmitApproval = useCallback(() => {
    if (!onSubmitApproval) return;

    Modal.confirm({
      title: '提交核准确认',
      content:
        deficitCount > 0
          ? `当前存在 ${deficitCount} 项盘亏资产，确认提交核准申请？`
          : '确认将盘点结果提交核准？',
      okText: '确认提交',
      cancelText: '取消',
      okButtonProps: { danger: deficitCount > 0 },
      onOk: async () => {
        try {
          setSubmitting(true);
          await onSubmitApproval();
          message.success('盘点结果已成功提交核准');
        } catch {
          message.error('提交核准失败，请检查网络后重试');
        } finally {
          setSubmitting(false);
        }
      },
    });
  }, [onSubmitApproval, deficitCount]);

  /** 处理导出报告操作 */
  const handleExportReport = useCallback(() => {
    onExportReport?.();
  }, [onExportReport]);

  // ---- 渲染 ----

  return (
    <Card
      title="盘点差异汇总"
      className="inventory-diff-summary-panel"
      style={{ marginTop: 24 }}
      styles={{ body: { padding: '16px 24px' } }}
    >
      {/* ── 进度条 ── */}
      <Row align="middle" gutter={16} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Progress
            percent={progressPercent}
            status={isAllCounted ? 'success' : 'active'}
            strokeColor={isAllCounted ? '#52c41a' : '#1890ff'}
          />
        </Col>
        <Col>
          <span style={{ fontSize: 13, color: '#8c8c8c' }}>
            已盘 {countedCount} / 未盘 {unCountedCount} / 总计 {totalCount}
          </span>
        </Col>
      </Row>

      {/* ── 核心统计指标卡片（ATB-03 五项指标） ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
        <Col span={4}>
          <StatCard title="总资产" value={totalCount} />
        </Col>
        <Col span={4}>
          <StatCard
            title="已盘"
            value={countedCount}
            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          />
        </Col>
        <Col span={4}>
          <StatCard
            title="未盘"
            value={unCountedCount}
            valueStyle={{ color: unCountedCount > 0 ? '#faad14' : undefined }}
          />
        </Col>
        <Col span={4}>
          <StatCard
            title="盘盈"
            value={surplusCount}
            prefix={<ArrowUpOutlined />}
            valueStyle={{ color: surplusCount > 0 ? '#3f8600' : undefined }}
          />
        </Col>
        <Col span={4}>
          <StatCard
            title="盘亏"
            value={deficitCount}
            prefix={<ArrowDownOutlined />}
            valueStyle={{ color: deficitCount > 0 ? '#cf1322' : undefined }}
          />
        </Col>
        {/* 操作按钮区 */}
        <Col span={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Space>
            <Button
              icon={<FileTextOutlined />}
              onClick={handleExportReport}
              disabled={countedCount === 0}
            >
              导出报告
            </Button>
            <Button
              type="primary"
              danger={deficitCount > 0}
              icon={<SendOutlined />}
              loading={submitting || loading}
              disabled={!isAllCounted || !onSubmitApproval}
              onClick={handleSubmitApproval}
            >
              一键提交核准
            </Button>
          </Space>
        </Col>
      </Row>

      <Divider style={{ margin: '16px 0' }} />

      {/* ── 差异明细列表（ATB-05） ── */}
      <div>
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 500, fontSize: 15 }}>
            差异资产清单{' '}
            <Tag color={diffItems.length > 0 ? 'error' : 'default'}>
              {diffItems.length} 项
            </Tag>
          </span>
        </div>

        {diffItems.length > 0 ? (
          <Table
            dataSource={diffItems}
            columns={diffColumns}
            rowKey="id"
            pagination={{ pageSize: 5, showSizeChanger: false }}
            size="small"
            bordered
            scroll={{ y: 300 }}
            locale={{ emptyText: '暂无差异资产' }}
          />
        ) : (
          <Empty
            image={<CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />}
            description="账实相符，暂无差异资产"
            style={{ padding: '32px 0' }}
          />
        )}
      </div>

      {/* ── 盘亏风险提示 ── */}
      {deficitCount > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: '8px 12px',
            background: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: 4,
          }}
        >
          <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
          <span style={{ color: '#ff4d4f' }}>
            注意：当前存在 {deficitCount} 项盘亏资产，请在提交核准前仔细核对差异明细。
          </span>
        </div>
      )}
    </Card>
  );
};

export default DiffSummaryPanel;