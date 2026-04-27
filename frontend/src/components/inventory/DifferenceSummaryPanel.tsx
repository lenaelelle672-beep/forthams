/**
 * DifferenceSummaryPanel — 盘盈盘亏汇总面板
 *
 * 展示盘点任务的盘盈和盘亏差异汇总信息，包含两个 Tab（盘盈明细 / 盘亏明细），
 * 以及「提交核准」按钮（非只读模式下可见）。
 *
 * 遵循 ATB-006 验收标准：
 *  - 两个 Tab 分别展示盘盈/盘亏明细（资产编号、资产名称、原因）
 *  - 存在差异时「提交核准」按钮可见且 enabled
 *  - 无差异时显示「无差异」，「提交核准」按钮仍可见
 *  - 提交前弹出二次确认弹窗："确认提交核准？提交后不可修改。"
 *  - 提交后 invalidate 相关 query 使父页面切换为只读模式
 *
 * @module components/inventory/DifferenceSummaryPanel
 */

import React, { useCallback, useRef } from 'react';
import {
  Button,
  Card,
  message,
  Modal,
  Spin,
  Table,
  Tabs,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 差异明细条目 */
export interface DifferenceItem {
  /** 资产唯一标识 */
  assetId: string;
  /** 资产编号 */
  assetCode: string;
  /** 资产名称 */
  assetName: string;
  /** 盘盈/盘亏原因 */
  reason: string;
}

/** 汇总 API 响应结构 */
export interface SummaryResponse {
  /** 盘盈明细列表 */
  surplusItems: DifferenceItem[];
  /** 盘亏明细列表 */
  deficitItems: DifferenceItem[];
  /** 盘盈数量 */
  surplusCount: number;
  /** 盘亏数量 */
  deficitCount: number;
}

/** 组件 Props（与 SPEC 定义的 DifferenceSummaryPanelProps 一致） */
export interface DifferenceSummaryPanelProps {
  /** 盘点任务 ID */
  taskId: string;
  /** 是否只读模式（completed / submitted 状态时为 true） */
  readOnly: boolean;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * 获取盘点任务的盘盈盘亏汇总数据
 *
 * @param taskId - 盘点任务 ID
 * @returns 汇总数据（含盘盈/盘亏明细列表）
 * @throws 网络错误或后端异常时抛出 Error
 */
async function fetchSummary(taskId: string): Promise<SummaryResponse> {
  const res = await fetch(`/api/v1/inventory/tasks/${taskId}/summary`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`获取汇总数据失败 (HTTP ${res.status}): ${body}`);
  }
  return res.json() as Promise<SummaryResponse>;
}

/**
 * 提交盘点任务核准（不可逆操作）
 *
 * @param taskId - 盘点任务 ID
 * @throws 网络错误或后端异常时抛出 Error
 */
async function submitForApproval(taskId: string): Promise<void> {
  const res = await fetch(`/api/v1/inventory/tasks/${taskId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`提交核准失败 (HTTP ${res.status}): ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

/** 盘盈明细表格列配置 */
const surplusColumns: ColumnsType<DifferenceItem> = [
  {
    title: '资产编号',
    dataIndex: 'assetCode',
    key: 'assetCode',
    width: 180,
  },
  {
    title: '资产名称',
    dataIndex: 'assetName',
    key: 'assetName',
    ellipsis: true,
  },
  {
    title: '盘盈原因',
    dataIndex: 'reason',
    key: 'reason',
    ellipsis: true,
  },
];

/** 盘亏明细表格列配置 */
const deficitColumns: ColumnsType<DifferenceItem> = [
  {
    title: '资产编号',
    dataIndex: 'assetCode',
    key: 'assetCode',
    width: 180,
  },
  {
    title: '资产名称',
    dataIndex: 'assetName',
    key: 'assetName',
    ellipsis: true,
  },
  {
    title: '盘亏原因',
    dataIndex: 'reason',
    key: 'reason',
    ellipsis: true,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DifferenceSummaryPanel 盘盈盘亏汇总面板
 *
 * 接收 taskId 和 readOnly props，内部通过 React Query 获取汇总数据，
 * 并提供「提交核准」功能（含二次确认弹窗、防重复提交）。
 *
 * @param props - 组件属性
 * @param props.taskId   - 盘点任务 ID
 * @param props.readOnly - 是否只读模式
 */
const DifferenceSummaryPanel: React.FC<DifferenceSummaryPanelProps> = ({
  taskId,
  readOnly,
}) => {
  const queryClient = useQueryClient();

  /**
   * 防止在 Modal 打开期间重复点击「提交核准」按钮。
   * useMutation.isPending 只在 mutation 真正执行后为 true，
   * 而 Modal 打开→确认之间的间隙也需要保护。
   */
  const modalOpenedRef = useRef(false);

  // ---- Data fetching ----

  const {
    data: summary,
    isLoading,
    isError,
    refetch,
  } = useQuery<SummaryResponse, Error>({
    queryKey: ['inventory', 'tasks', taskId, 'summary'],
    queryFn: () => fetchSummary(taskId),
    enabled: !!taskId,
  });

  // ---- Submit mutation ----

  const submitMutation = useMutation({
    mutationFn: () => submitForApproval(taskId),
    onSuccess: () => {
      message.success('提交核准成功');
      // Invalidate task detail so parent page re-fetches and enters readOnly
      queryClient.invalidateQueries({
        queryKey: ['inventory', 'tasks', taskId],
      });
      // Invalidate summary to reflect final state
      queryClient.invalidateQueries({
        queryKey: ['inventory', 'tasks', taskId, 'summary'],
      });
    },
    onError: (err: Error) => {
      message.error(err.message || '提交核准失败，请重试');
    },
  });

  // ---- Handlers ----

  /**
   * 点击「提交核准」按钮的处理函数。
   * 弹出二次确认弹窗，确认后执行提交 mutation。
   */
  const handleSubmitClick = useCallback(() => {
    // 防重复提交：mutation 进行中 或 Modal 已打开时拒绝
    if (submitMutation.isPending || modalOpenedRef.current) return;
    modalOpenedRef.current = true;

    Modal.confirm({
      title: '确认提交核准？',
      icon: <ExclamationCircleOutlined />,
      content: '提交后不可修改。',
      okText: '确认提交',
      cancelText: '取消',
      onOk: async () => {
        await submitMutation.mutateAsync();
      },
      onCancel: () => {
        modalOpenedRef.current = false;
      },
      afterClose: () => {
        // 兜底：无论以何种方式关闭，都重置标记
        modalOpenedRef.current = false;
      },
    });
  }, [submitMutation]);

  // ---- Derived state ----

  const surplusItems = summary?.surplusItems ?? [];
  const deficitItems = summary?.deficitItems ?? [];
  const surplusCount = summary?.surplusCount ?? 0;
  const deficitCount = summary?.deficitCount ?? 0;
  const hasDifferences = surplusCount > 0 || deficitCount > 0;

  // ---- Render: loading ----

  if (isLoading) {
    return (
      <Card
        title="盘盈盘亏汇总"
        style={{ marginTop: 16 }}
        aria-label="盘盈盘亏汇总面板"
      >
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin tip="加载汇总数据..." />
        </div>
      </Card>
    );
  }

  // ---- Render: error with retry ----

  if (isError) {
    return (
      <Card
        title="盘盈盘亏汇总"
        style={{ marginTop: 16 }}
        aria-label="盘盈盘亏汇总面板"
      >
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Text type="danger">加载汇总数据失败</Text>
          <br />
          <Button type="link" onClick={() => refetch()} aria-label="重试加载汇总">
            重试
          </Button>
        </div>
      </Card>
    );
  }

  // ---- Render: main content ----

  return (
    <Card
      title={
        <span aria-label="盘盈盘亏汇总面板">
          <strong>盘盈盘亏汇总</strong>
        </span>
      }
      style={{ marginTop: 16 }}
      extra={
        !readOnly && (
          <Button
            type="primary"
            onClick={handleSubmitClick}
            loading={submitMutation.isPending}
            disabled={submitMutation.isPending || modalOpenedRef.current}
            aria-label="提交核准"
          >
            提交核准
          </Button>
        )
      }
    >
      {/* ATB-006 step 4: 无差异时显示「无差异」，提交按钮仍在 Card extra 中可见 */}
      {!hasDifferences ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <CheckCircleOutlined
            style={{ fontSize: 40, color: '#52c41a', marginBottom: 12 }}
          />
          <div>
            <Text type="secondary">无差异</Text>
          </div>
        </div>
      ) : (
        /* ATB-006 step 1 & 2: 两个 Tab — 盘盈明细 / 盘亏明细 */
        <Tabs
          defaultActiveKey="surplus"
          aria-label="盘盈盘亏明细"
          items={[
            {
              key: 'surplus',
              label: `盘盈明细 (${surplusItems.length})`,
              children: (
                <Table<DifferenceItem>
                  dataSource={surplusItems}
                  columns={surplusColumns}
                  rowKey="assetId"
                  size="small"
                  pagination={
                    surplusItems.length > 10 ? { pageSize: 10 } : false
                  }
                  locale={{ emptyText: '暂无盘盈记录' }}
                  aria-label="盘盈明细表格"
                />
              ),
            },
            {
              key: 'deficit',
              label: `盘亏明细 (${deficitItems.length})`,
              children: (
                <Table<DifferenceItem>
                  dataSource={deficitItems}
                  columns={deficitColumns}
                  rowKey="assetId"
                  size="small"
                  pagination={
                    deficitItems.length > 10 ? { pageSize: 10 } : false
                  }
                  locale={{ emptyText: '暂无盘亏记录' }}
                  aria-label="盘亏明细表格"
                />
              ),
            },
          ]}
        />
      )}
    </Card>
  );
};

DifferenceSummaryPanel.displayName = 'DifferenceSummaryPanel';

export default DifferenceSummaryPanel;