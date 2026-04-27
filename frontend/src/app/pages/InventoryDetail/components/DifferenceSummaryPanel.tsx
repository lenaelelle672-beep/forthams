import React, { useMemo, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Statistic,
  Button,
  Space,
  Typography,
  Tag,
  Alert,
  Modal,
  Empty,
  Tooltip,
  Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FileTextOutlined,
  SendOutlined,
  WarningOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/** 差异类型：盘盈（账面无实盘有）或 盘亏（账面有实盘无） */
export type DiffType = 'surplus' | 'deficit';

/** 单条差异明细记录 */
export interface IDiffItem {
  /** 唯一标识 */
  id: string;
  /** 资产编号 */
  assetCode: string;
  /** 资产名称 */
  assetName: string;
  /** 差异类型 */
  diffType: DiffType;
  /** 账面数量 */
  bookQuantity: number;
  /** 实盘数量 */
  actualQuantity: number;
  /** 差异数量（绝对值） */
  diffQuantity: number;
  /** 所属位置 */
  location?: string;
  /** 资产分类 */
  category?: string;
  /** 备注 */
  remark?: string;
}

/** 盘点汇总统计数据 */
export interface IInventorySummary {
  /** 任务范围内资产总数 */
  totalCount: number;
  /** 已盘点资产数 */
  countedCount: number;
  /** 盘盈数量 */
  surplusCount: number;
  /** 盘亏数量 */
  deficitCount: number;
}

// ---------------------------------------------------------------------------
// Component Props
// ---------------------------------------------------------------------------

interface DifferenceSummaryPanelProps {
  /** 差异明细列表 */
  diffItems: IDiffItem[];
  /** 盘点汇总统计 */
  summary: IInventorySummary;
  /** 点击"一键提交核准"后的回调，需返回 Promise */
  onSubmitApproval: () => Promise<void>;
  /** 是否正在提交中 */
  isSubmitting?: boolean;
  /** 是否允许提交（例如所有资产均已完成实盘确认） */
  canSubmit?: boolean;
  /** 提交失败的错误信息 */
  errorMsg?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 差异类型显示映射 */
const DIFF_TYPE_LABEL: Record<DiffType, { text: string; color: string }> = {
  surplus: { text: '盘盈', color: 'success' },
  deficit: { text: '盘亏', color: 'error' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DifferenceSummaryPanel – 盘点差异汇总面板
 *
 * 位于盘点执行详情页底部，负责：
 * 1. 展示盘盈 / 盘亏汇总统计卡片
 * 2. 以表格形式列出每条差异明细记录
 * 3. 提供"一键提交核准"操作入口，提交前弹出确认弹窗
 */
const DifferenceSummaryPanel: React.FC<DifferenceSummaryPanelProps> = ({
  diffItems,
  summary,
  onSubmitApproval,
  isSubmitting = false,
  canSubmit = true,
  errorMsg,
}) => {
  const [confirmVisible, setConfirmVisible] = useState(false);

  // ---- derived calculations ------------------------------------------------

  /** 盘点进度百分比 */
  const progressPercent = useMemo(() => {
    if (summary.totalCount <= 0) return 0;
    return Math.round((summary.countedCount / summary.totalCount) * 100);
  }, [summary.totalCount, summary.countedCount]);

  /** 差异率（盘盈 + 盘亏 / 总数） */
  const discrepancyRate = useMemo(() => {
    if (summary.totalCount <= 0) return 0;
    return Number(
      (
        ((summary.surplusCount + summary.deficitCount) / summary.totalCount) *
        100
      ).toFixed(1),
    );
  }, [summary.surplusCount, summary.deficitCount, summary.totalCount]);

  /** 是否存在差异 */
  const hasDifferences = summary.surplusCount > 0 || summary.deficitCount > 0;

  /** 提交按钮是否可点击 */
  const submitDisabled =
    !canSubmit ||
    isSubmitting ||
    (!hasDifferences && diffItems.length === 0);

  // ---- handlers -----------------------------------------------------------

  /** 打开确认弹窗 */
  const handleOpenConfirm = useCallback(() => {
    setConfirmVisible(true);
  }, []);

  /** 确认提交 */
  const handleConfirmSubmit = useCallback(async () => {
    try {
      await onSubmitApproval();
    } catch {
      // 错误由父组件通过 errorMsg prop 传入展示
    } finally {
      setConfirmVisible(false);
    }
  }, [onSubmitApproval]);

  /** 取消弹窗 */
  const handleCancelConfirm = useCallback(() => {
    setConfirmVisible(false);
  }, []);

  // ---- table columns ------------------------------------------------------

  const columns: ColumnsType<IDiffItem> = useMemo(
    () => [
      {
        title: '资产编号',
        dataIndex: 'assetCode',
        key: 'assetCode',
        width: 140,
        fixed: 'left' as const,
      },
      {
        title: '资产名称',
        dataIndex: 'assetName',
        key: 'assetName',
        width: 180,
        ellipsis: true,
      },
      {
        title: '差异类型',
        dataIndex: 'diffType',
        key: 'diffType',
        width: 100,
        align: 'center' as const,
        render: (type: DiffType) => {
          const cfg = DIFF_TYPE_LABEL[type];
          const icon =
            type === 'surplus' ? (
              <ArrowUpOutlined />
            ) : (
              <ArrowDownOutlined />
            );
          return (
            <Tag color={cfg.color} icon={icon}>
              {cfg.text}
            </Tag>
          );
        },
      },
      {
        title: '账面数量',
        dataIndex: 'bookQuantity',
        key: 'bookQuantity',
        width: 100,
        align: 'right' as const,
      },
      {
        title: '实盘数量',
        dataIndex: 'actualQuantity',
        key: 'actualQuantity',
        width: 100,
        align: 'right' as const,
      },
      {
        title: '差异数量',
        dataIndex: 'diffQuantity',
        key: 'diffQuantity',
        width: 100,
        align: 'right' as const,
        render: (val: number, record: IDiffItem) => (
          <Text
            strong
            style={{
              color: record.diffType === 'surplus' ? '#52c41a' : '#f5222d',
            }}
          >
            {record.diffType === 'surplus' ? `+${val}` : `-${val}`}
          </Text>
        ),
      },
      {
        title: '位置',
        dataIndex: 'location',
        key: 'location',
        width: 140,
        ellipsis: true,
      },
      {
        title: '分类',
        dataIndex: 'category',
        key: 'category',
        width: 120,
        ellipsis: true,
      },
      {
        title: '备注',
        dataIndex: 'remark',
        key: 'remark',
        width: 150,
        ellipsis: true,
      },
    ],
    [],
  );

  // ---- render -------------------------------------------------------------

  return (
    <>
      <Card
        data-testid="difference-summary-panel"
        title={
          <Space>
            <FileTextOutlined />
            <span>盘点差异汇总</span>
          </Space>
        }
        extra={
          <Space>
            {hasDifferences ? (
              <Tag color="error" icon={<ExclamationCircleOutlined />}>
                检测到 {summary.surplusCount + summary.deficitCount} 项差异资产需核实
              </Tag>
            ) : (
              <Tag color="success" icon={<CheckCircleOutlined />}>
                账实相符，无异常数据
              </Tag>
            )}
            <Tooltip
              title={
                !canSubmit
                  ? '请先完成所有资产的实盘确认'
                  : !hasDifferences
                    ? '当前无差异记录，无需提交'
                    : ''
              }
            >
              <Button
                data-testid="btn-submit-approval"
                type="primary"
                icon={<SendOutlined />}
                onClick={handleOpenConfirm}
                loading={isSubmitting}
                disabled={submitDisabled}
              >
                一键提交核准
              </Button>
            </Tooltip>
          </Space>
        }
        styles={{ body: { padding: '16px 24px' } }}
        style={{ marginTop: 24, borderRadius: 8 }}
      >
        {/* ---- Summary Statistics Row ---- */}
        <div
          data-testid="diff-summary-stats"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'center',
          }}
        >
          <Statistic
            title={
              <Space size={4}>
                <ArrowUpOutlined style={{ color: '#52c41a' }} />
                <span>盘盈</span>
              </Space>
            }
            value={summary.surplusCount}
            valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
            suffix="项"
          />

          <Divider type="vertical" style={{ height: 40 }} />

          <Statistic
            title={
              <Space size={4}>
                <ArrowDownOutlined style={{ color: '#f5222d' }} />
                <span>盘亏</span>
              </Space>
            }
            value={summary.deficitCount}
            valueStyle={{ color: '#f5222d', fontWeight: 'bold' }}
            suffix="项"
          />

          <Divider type="vertical" style={{ height: 40 }} />

          <Statistic
            title="差异率"
            value={discrepancyRate}
            suffix="%"
            precision={1}
            valueStyle={{
              color: discrepancyRate > 5 ? '#f5222d' : '#faad14',
              fontWeight: 'bold',
            }}
          />

          <Divider type="vertical" style={{ height: 40 }} />

          <Statistic
            title="盘点进度"
            value={progressPercent}
            suffix="%"
            valueStyle={{
              color: progressPercent === 100 ? '#52c41a' : '#1677ff',
              fontWeight: 'bold',
            }}
          />

          <Divider type="vertical" style={{ height: 40 }} />

          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              已盘 {summary.countedCount} / 总计 {summary.totalCount} 件资产
            </Text>
          </div>
        </div>

        {/* ---- Alert Messages ---- */}
        {!canSubmit && (
          <Alert
            data-testid="alert-cannot-submit"
            message="无法提交核准"
            description="请确保所有资产均已完成实盘确认，且差异数据已初步校对。"
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            style={{ marginTop: 16, borderRadius: 4 }}
          />
        )}
        {errorMsg && (
          <Alert
            data-testid="alert-submit-error"
            message="提交失败"
            description={errorMsg}
            type="error"
            showIcon
            closable
            style={{ marginTop: 12, borderRadius: 4 }}
          />
        )}

        {/* ---- Diff Detail Table ---- */}
        <div data-testid="diff-detail-table" style={{ marginTop: 16 }}>
          {diffItems.length > 0 ? (
            <Table<IDiffItem>
              dataSource={diffItems}
              columns={columns}
              rowKey="id"
              size="small"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条差异记录`,
              }}
              scroll={{ x: 1100 }}
              rowClassName={(record) =>
                record.diffType === 'surplus'
                  ? 'diff-row-surplus'
                  : 'diff-row-deficit'
              }
            />
          ) : (
            <Empty
              description="暂无差异记录"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </div>
      </Card>

      {/* ---- Confirmation Modal ---- */}
      <Modal
        data-testid="confirm-submit-modal"
        title="确认提交核准"
        open={confirmVisible}
        onOk={handleConfirmSubmit}
        onCancel={handleCancelConfirm}
        confirmLoading={isSubmitting}
        okText="确认提交"
        cancelText="取消"
        width={480}
      >
        <Space direction="vertical" size={12}>
          <Text>
            即将提交盘点差异核准申请，提交后数据将发送至审批流程。
          </Text>
          <div
            style={{
              background: '#fafafa',
              padding: '12px 16px',
              borderRadius: 6,
            }}
          >
            <Space size={24}>
              <Text>
                盘盈：<Text strong style={{ color: '#52c41a' }}>{summary.surplusCount}</Text> 项
              </Text>
              <Text>
                盘亏：<Text strong style={{ color: '#f5222d' }}>{summary.deficitCount}</Text> 项
              </Text>
              <Text>
                差异率：
                <Text
                  strong
                  style={{
                    color: discrepancyRate > 5 ? '#f5222d' : '#faad14',
                  }}
                >
                  {discrepancyRate}%
                </Text>
              </Text>
            </Space>
          </div>
          <Text type="warning" style={{ fontSize: 12 }}>
            <ExclamationCircleOutlined style={{ marginRight: 4 }} />
            提交后无法撤回，请确认数据无误。
          </Text>
        </Space>
      </Modal>
    </>
  );
};

export default DifferenceSummaryPanel;