import React, { useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Button,
  Alert,
  Divider,
  Typography,
  Space,
  Tag,
  Table,
  Tooltip,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Interfaces — exported for use by parent components / hooks
// ---------------------------------------------------------------------------

/**
 * 单条差异明细记录。
 * 对应 SPEC ATB-05: "账面有实盘无（盘亏）" 与 "账面无实盘有（盘盈）"。
 */
export interface IDiffItem {
  /** 记录唯一标识 */
  id: string;
  /** 资产编码 */
  assetCode: string;
  /** 资产名称 */
  assetName: string;
  /** 差异类型: surplus = 盘盈(账面无实盘有), deficit = 盘亏(账面有实盘无) */
  diffType: 'surplus' | 'deficit';
  /** 账面状态 */
  bookStatus?: string;
  /** 实盘状态 */
  actualStatus?: string;
  /** 存放位置 */
  location?: string;
  /** 资产分类 */
  category?: string;
  /** 备注 */
  remark?: string;
}

/**
 * 盘点汇总统计数据。
 * SPEC: "前端需负责部分中间态计算（如进度百分比、分类汇总）"。
 */
export interface IInventorySummary {
  /** 总资产数 */
  totalCount: number;
  /** 已盘点数量 */
  countedCount: number;
  /** 盘盈数量（账面无，实盘有） */
  surplusCount: number;
  /** 盘亏数量（账面有，实盘无） */
  deficitCount: number;
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface DiffSummaryPanelProps {
  /** 汇总统计数据 */
  summary: IInventorySummary;
  /** 差异明细列表（由父组件通过 useDiffSummary hook 提供） */
  diffItems: IDiffItem[];
  /**
   * 提交核准回调。
   * SPEC: "提交核准必须与后端 API 交互，前端不得持久化存储盘点业务主数据。"
   * 父组件应在此回调中调用 POST /api/inventory/approve。
   */
  onApprove?: () => Promise<void>;
  /** 是否正在提交中 */
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// DiffSummaryPanel
// ---------------------------------------------------------------------------

/**
 * 盘点差异汇总面板。
 *
 * 渲染在盘点执行详情页底部，包含：
 * 1. 五个核心统计指标（总资产 / 已盘 / 未盘 / 盘盈 / 盘亏）
 * 2. 盘点进度条与差异率
 * 3. 差异明细表格（盘盈/盘亏逐条列表）
 * 4. "一键提交核准"按钮
 *
 * @param props - DiffSummaryPanelProps
 */
const DiffSummaryPanel: React.FC<DiffSummaryPanelProps> = ({
  summary,
  diffItems = [],
  onApprove,
  isSubmitting = false,
}) => {
  const { totalCount, countedCount, surplusCount, deficitCount } = summary;

  // ---- 前端中间态计算 (SPEC 要求) ----
  const progressPercent =
    totalCount > 0 ? Math.round((countedCount / totalCount) * 100) : 0;

  const uncountedCount = totalCount - countedCount;
  const discrepancyTotal = surplusCount + deficitCount;
  const discrepancyRate =
    totalCount > 0
      ? ((discrepancyTotal / totalCount) * 100).toFixed(2)
      : '0.00';

  const hasDiscrepancies = discrepancyTotal > 0;
  const isComplete = progressPercent === 100;

  // 只有盘点进度 100% 且未在提交中时才允许点击
  const canSubmit = isComplete && !isSubmitting && !!onApprove;

  // ---- 差异明细表格列定义 ----
  const columns: ColumnsType<IDiffItem> = useMemo(
    () => [
      {
        title: '资产编码',
        dataIndex: 'assetCode',
        key: 'assetCode',
        width: 140,
        ellipsis: true,
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
        align: 'center',
        render: (type: 'surplus' | 'deficit') =>
          type === 'surplus' ? (
            <Tag color="green" icon={<PlusCircleOutlined />}>
              盘盈
            </Tag>
          ) : (
            <Tag color="red" icon={<MinusCircleOutlined />}>
              盘亏
            </Tag>
          ),
      },
      {
        title: '账面状态',
        dataIndex: 'bookStatus',
        key: 'bookStatus',
        width: 120,
        ellipsis: true,
      },
      {
        title: '实盘状态',
        dataIndex: 'actualStatus',
        key: 'actualStatus',
        width: 120,
        ellipsis: true,
      },
      {
        title: '存放位置',
        dataIndex: 'location',
        key: 'location',
        width: 150,
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
        width: 200,
        ellipsis: true,
      },
    ],
    [],
  );

  // ---- Render ----
  return (
    <Card
      style={{
        marginTop: 24,
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
      title={
        <Space>
          <span style={{ fontSize: 16, fontWeight: 600 }}>盘点差异汇总</span>
          {hasDiscrepancies && (
            <Tag color="error" bordered={false}>
              {discrepancyTotal} 项账实不符
            </Tag>
          )}
          {isComplete && !hasDiscrepancies && (
            <Tag color="success" bordered={false}>
              账实相符
            </Tag>
          )}
        </Space>
      }
      extra={
        onApprove && (
          <Tooltip
            title={
              !isComplete
                ? '请先完成所有资产的盘点'
                : hasDiscrepancies
                  ? '存在差异，提交后将进入审批流程'
                  : '无差异，可直接提交核准'
            }
          >
            <Button
              type="primary"
              size="large"
              icon={<SendOutlined />}
              onClick={onApprove}
              loading={isSubmitting}
              disabled={!canSubmit}
              style={{ borderRadius: 4, fontWeight: 500 }}
            >
              一键提交核准
            </Button>
          </Tooltip>
        )
      }
    >
      {/* ====== 第一行：五个核心统计指标 ====== */}
      <Row gutter={[24, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Statistic
            title="资产总数"
            value={totalCount}
            valueStyle={{ fontSize: 24, fontWeight: 600 }}
          />
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Statistic
            title="已盘点"
            value={countedCount}
            suffix={`/ ${totalCount}`}
            prefix={
              <CheckCircleOutlined
                style={{ color: isComplete ? '#52c41a' : '#8c8c8c' }}
              />
            }
            valueStyle={{
              fontSize: 24,
              fontWeight: 600,
              color: isComplete ? '#52c41a' : undefined,
            }}
          />
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Statistic
            title="盘盈数量"
            value={surplusCount}
            prefix={
              <PlusCircleOutlined
                style={{ color: surplusCount > 0 ? '#52c41a' : '#8c8c8c' }}
              />
            }
            valueStyle={{
              fontSize: 24,
              fontWeight: 600,
              color: surplusCount > 0 ? '#52c41a' : undefined,
            }}
          />
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Statistic
            title="盘亏数量"
            value={deficitCount}
            prefix={
              <MinusCircleOutlined
                style={{ color: deficitCount > 0 ? '#ff4d4f' : '#8c8c8c' }}
              />
            }
            valueStyle={{
              fontSize: 24,
              fontWeight: 600,
              color: deficitCount > 0 ? '#ff4d4f' : undefined,
            }}
          />
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />

      {/* ====== 第二行：进度条 & 差异率 ====== */}
      <Row gutter={32} align="middle">
        <Col xs={24} lg={16}>
          <div
            style={{
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <Text strong>盘点进度</Text>
            <Text type={isComplete ? 'success' : 'secondary'}>
              {countedCount} / {totalCount}（{progressPercent}%）
            </Text>
          </div>
          <Progress
            percent={progressPercent}
            strokeColor={isComplete && !hasDiscrepancies ? '#52c41a' : '#1890ff'}
            showInfo={false}
            strokeWidth={12}
          />
          {!isComplete && (
            <Text
              type="secondary"
              style={{ fontSize: 12, marginTop: 4, display: 'block' }}
            >
              剩余 {uncountedCount} 项待盘点
            </Text>
          )}
        </Col>

        <Col xs={24} lg={8}>
          <div style={{ textAlign: 'right' }}>
            <Text
              type="secondary"
              style={{ display: 'block', marginBottom: 4 }}
            >
              差异率
            </Text>
            <span
              style={{
                fontSize: 32,
                fontWeight: 700,
                color:
                  parseFloat(discrepancyRate) > 5 ? '#ff4d4f' : '#1f1f1f',
              }}
            >
              {discrepancyRate}%
            </span>
          </div>
        </Col>
      </Row>

      <Divider style={{ margin: '24px 0' }} />

      {/* ====== 第三行：差异明细列表 (ATB-05 核心) ====== */}
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ fontSize: 15 }}>
          差异明细
        </Text>
        <Text type="secondary" style={{ marginLeft: 8 }}>
          共 {diffItems.length} 条记录
        </Text>
      </div>

      {diffItems.length > 0 ? (
        <Table<IDiffItem>
          dataSource={diffItems}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={
            diffItems.length > 10
              ? { pageSize: 10, size: 'small', showSizeChanger: false }
              : false
          }
          scroll={{ x: 1000 }}
          onRow={(record) => ({
            style: {
              backgroundColor:
                record.diffType === 'deficit' ? '#3b1c1c' : '#1a2e1a',
            },
          })}
        />
      ) : (
        <Empty
          description={
            isComplete
              ? '盘点完成，无差异记录'
              : '暂无差异记录，完成盘点后将自动汇总'
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}

      {/* ====== 第四行：状态提示 ====== */}
      <div style={{ marginTop: 20 }}>
        {hasDiscrepancies ? (
          <Alert
            message="差异核对提醒"
            description={
              <span>
                当前存在{' '}
                <Text strong>
                  {surplusCount} 项盘盈（账面无，实盘有）
                </Text>{' '}
                与{' '}
                <Text strong>
                  {deficitCount} 项盘亏（账面有，实盘无）
                </Text>
                ，请核实差异明细后再提交核准。
              </span>
            }
            type="warning"
            showIcon
            icon={<WarningOutlined />}
          />
        ) : isComplete ? (
          <Alert
            message="盘点完成"
            description="所有资产已盘点完毕，账实相符，可直接提交核准。"
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
          />
        ) : (
          <Alert
            message="盘点进行中"
            description={`当前进度 ${progressPercent}%，请继续完成剩余资产的盘点。`}
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
          />
        )}
      </div>
    </Card>
  );
};

export default DiffSummaryPanel;