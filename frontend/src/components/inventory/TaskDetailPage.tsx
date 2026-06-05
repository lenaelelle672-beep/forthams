/**
 * TaskDetailPage - 盘点执行详情页主容器
 *
 * 负责组装 ProgressSummary、AssetTable、DifferenceSummaryPanel 等子组件，
 * 根据任务状态（draft / in_progress / completed / submitted）控制只读模式，
 * 并提供批量确认、提交核准等全局操作入口。
 *
 * 路由：/inventory/tasks/:taskId
 *
 * @see SWARM-P3-010-FE P3-010-C / P3-010-D / P3-010-E
 * @see ATB-003 进度条与统计摘要
 * @see ATB-004 逐条确认资产
 * @see ATB-005 批量确认资产
 * @see ATB-006 盘盈盘亏汇总 + 提交核准
 * @see ATB-007 只读模式验证
 * @see ATB-008 防重复提交
 */

import React, { useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Breadcrumb,
  Space,
  Typography,
  Alert,
  Spin,
  Modal,
  message,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  HomeOutlined,
  EditOutlined,
  WarningOutlined,
} from '@ant-design/icons';

// --- 子组件（spec Step 5 / 6 / 7）---
import ProgressSummary from './ProgressSummary';
import AssetTable from './AssetTable';
import AssetTableToolbar from './AssetTableToolbar';
import DifferenceSummaryPanel from './DifferenceSummaryPanel';

// --- React Query hooks（spec Layer 2）---
import {
  useTaskDetail,
  useAssets,
  useSummary,
  useConfirmMutation,
  useBatchConfirmMutation,
  useSubmitMutation,
} from '../../hooks/useInventory';

// --- Zustand store（客户端 UI 状态）---
import { useInventoryStore } from '../../stores/useInventoryStore';

// --- 类型定义（spec Layer 1）---
import type {
  InventoryTask,
  ActualStatus,
} from '../../types/inventory';

const { Title, Text } = Typography;

const t = (key: string, params?: Record<string, string | number>) => {
  const dict: Record<string, string> = {
    batchConfirmLimitWarning: `单次批量确认上限 ${params?.limit ?? 100} 条，已自动截断`,
    batchConfirmSuccess: '批量确认成功',
    batchConfirmError: '批量确认失败，请重试',
    submitSuccess: '盘点结果已提交核准',
    submitError: '提交核准失败，请重试',
    loading: '加载中…',
    loadFailed: '数据加载失败，请重试',
    taskNotFound: '盘点任务不存在',
    backToList: '返回列表',
    breadcrumbRoot: '盘点管理',
    breadcrumbDetail: '任务详情',
    draftWarningTip: '草稿状态下不能提交或确认资产',
    draftWarning: '草稿状态',
    submitApproval: '提交核准',
    readOnlyTip: '当前任务已提交或完成，仅可查看',
    readOnlyBadge: '只读模式',
    draftStatusMessage: '请先将任务状态变更为进行中',
    progressSectionLabel: '盘点进度',
    assetTableSectionLabel: '资产清单',
    diffSummarySectionLabel: '盘盈盘亏汇总',
    batchConfirmDialogTitle: '批量确认',
    confirm: '确认',
    cancel: '取消',
    submitConfirmTitle: '确认提交核准',
    submitConfirmContent: '提交后将不可继续修改盘点结果，请确认。',
    selectedCount: `已选 ${params?.count ?? 0} 项`,
  };
  return dict[key] ?? key;
};



// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 批量确认单次上限 */
const BATCH_CONFIRM_LIMIT = 100;

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/**
 * 根据 taskId 和统计数据计算精确到 1 位小数的进度百分比。
 *
 * @param counted  - 已盘数
 * @param total    - 总资产数
 * @returns 0-100 的进度值，保留 1 位小数；total 为 0 时返回 0
 */
function calcProgress(counted: number, total: number): number {
  if (total <= 0) return 0;
  const pct = (counted / total) * 100;
  return Math.round(pct * 10) / 10; // 精确到小数点后 1 位
}

/**
 * 判断当前任务是否为只读模式。
 * - `completed` / `submitted` 状态 → 完全只读
 * - `draft` 状态 → 下拉/输入可操作但不可确认，需提示变更状态
 *
 * @param status - 任务状态
 * @returns `'full'` | `'draft'` | `false`
 */
function getReadOnlyLevel(status: InventoryTask['status']): 'full' | 'draft' | false {
  if (status === 'completed' || status === 'submitted') return 'full';
  if (status === 'draft') return 'draft';
  return false;
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

/**
 * TaskDetailPage — 盘点执行详情页
 *
 * 负责加载任务详情、资产清单、盘盈盘亏汇总，并根据任务状态渲染不同的交互模式。
 * 仅 `in_progress` 状态允许编辑操作（实盘状态、备注、确认按钮）。
 */
export default function TaskDetailPage() {
  const { taskId = '' } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  // --- Zustand 客户端状态 ---
  const selectedAssetIds = useInventoryStore((s) => s.selectedAssetIds);
  const clearSelected = useInventoryStore((s) => s.clearSelected);

  // --- 本地 UI 状态 ---
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  // --- React Query 数据获取 ---
  const {
    data: task,
    isLoading: taskLoading,
    error: taskError,
  } = useTaskDetail(taskId);

  const {
    data: summary,
    isLoading: summaryLoading,
  } = useSummary(taskId);

  // --- React Query 变更 mutations ---
  const confirmMutation = useConfirmMutation();
  const batchConfirmMutation = useBatchConfirmMutation();
  const submitMutation = useSubmitMutation();

  // --- 只读级别 ---
  const readOnlyLevel = useMemo(
    () => (task ? getReadOnlyLevel(task.status) : 'full'),
    [task],
  );

  /** 是否完全只读（completed / submitted） */
  const isReadOnly = readOnlyLevel === 'full';

  /** 是否为草稿模式 */
  const isDraft = readOnlyLevel === 'draft';

  // --- 计算属性 ---
  const progress = useMemo(() => {
    if (!task) return 0;
    return calcProgress(task.countedAssets, task.totalAssets);
  }, [task]);

  const uncounted = useMemo(() => {
    if (!task) return 0;
    return task.totalAssets - task.countedAssets;
  }, [task]);

  // --- 批量确认处理 ---
  /**
   * 点击"批量确认"按钮时的处理逻辑。
   * 检查选中数量，超出上限时截断并提示。
   */
  const handleBatchConfirm = useCallback(
    (actualStatus: ActualStatus, remark: string) => {
      if (selectedAssetIds.length === 0) return;

      let assetIds = [...selectedAssetIds];

      // 单次批量确认上限 100 条
      if (assetIds.length > BATCH_CONFIRM_LIMIT) {
        assetIds = assetIds.slice(0, BATCH_CONFIRM_LIMIT);
        message.warning(
          t('batchConfirmLimitWarning', { limit: BATCH_CONFIRM_LIMIT }),
        );
      }

      batchConfirmMutation.mutate(
        { taskId, payload: { assetIds, actualStatus, remark } },
        {
          onSuccess: () => {
            message.success(t('batchConfirmSuccess'));
            setBatchDialogOpen(false);
            clearSelected();
          },
          onError: () => {
            message.error(t('batchConfirmError'));
          },
        },
      );
    },
    [selectedAssetIds, batchConfirmMutation, clearSelected],
  );

  // --- 提交核准处理 ---
  /**
   * 提交核准二次确认后的回调。
   * 提交核准为不可逆操作。
   */
  const handleSubmitApproval = useCallback(() => {
    submitMutation.mutate(taskId, {
      onSuccess: () => {
        message.success(t('submitSuccess'));
        setSubmitDialogOpen(false);
      },
      onError: () => {
        message.error(t('submitError'));
      },
    });
  }, [taskId, submitMutation]);

  // --- 加载状态 ---
  if (taskLoading || summaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip={t('loading')} />
      </div>
    );
  }

  // --- 错误状态 ---
  if (taskError || !task) {
    return (
      <Alert
        type="error"
        message={t('loadFailed')}
        description={taskError?.message || t('taskNotFound')}
        showIcon
        action={
          <Button size="small" type="primary" onClick={() => navigate('/inventory')}>
            {t('backToList')}
          </Button>
        }
      />
    );
  }

  // -----------------------------------------------------------------------
  // 渲染
  // -----------------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto p-6 pb-20">
      {/* ---- 面包屑导航 ---- */}
      <Breadcrumb
        className="mb-4"
        items={[
          {
            title: (
              <a onClick={() => navigate('/inventory')}>
                <HomeOutlined /> {t('breadcrumbRoot')}
              </a>
            ),
          },
          { title: t('breadcrumbDetail') },
          { title: task.taskName },
        ]}
      />

      {/* ---- 页头：返回 + 标题 + 操作按钮 ---- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/inventory')}
            className="mb-1 -ml-2 text-gray-400 hover:text-blue-600"
            aria-label={t('backToList')}
          >
            {t('backToList')}
          </Button>
          <div className="flex items-center gap-3">
            <Title level={3} style={{ margin: 0 }}>
              {task.taskName}
            </Title>
            {/* 状态标签 */}
            <Text type="secondary">#{taskId.slice(0, 8)}</Text>
          </div>
        </div>

        {/* 右侧操作区 */}
        <Space size="middle">
          {/* 草稿提示 */}
          {isDraft && (
            <Tooltip title={t('draftWarningTip')}>
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                message={t('draftWarning')}
                className="py-1"
              />
            </Tooltip>
          )}

          {/* 提交核准按钮：仅在 in_progress 状态下显示 */}
          {!isReadOnly && !isDraft && (
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => setSubmitDialogOpen(true)}
              loading={submitMutation.isPending}
              size="large"
              aria-label={t('submitApproval')}
            >
              {t('submitApproval')}
            </Button>
          )}

          {/* 只读状态标记 */}
          {isReadOnly && (
            <Tooltip title={t('readOnlyTip')}>
              <Text type="secondary">
                <ExclamationCircleOutlined className="mr-1" />
                {t('readOnlyBadge')}
              </Text>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* ---- 草稿状态提示条 ---- */}
      {isDraft && (
        <Alert
          type="info"
          showIcon
          icon={<EditOutlined />}
          message={t('draftStatusMessage')}
          className="mb-6"
          closable={false}
        />
      )}

      {/* ---- P3-010-C：进度条 + 统计摘要 ---- */}
      <section aria-label={t('progressSectionLabel')} className="mb-6">
        <ProgressSummary
          total={task.totalAssets}
          counted={task.countedAssets}
          surplus={task.surplusAssets}
          deficit={task.deficitAssets}
          progress={progress}
        />
      </section>

      {/* ---- P3-010-D：资产清单表格 ---- */}
      <section aria-label={t('assetTableSectionLabel')} className="mb-6">
        {!isReadOnly && !isDraft && (
          <AssetTableToolbar
            selectedAssetIds={selectedAssetIds}
            readOnly={isReadOnly || !!isDraft}
            onBatchConfirm={() => setBatchDialogOpen(true)}
            loading={batchConfirmMutation.isPending}
          />
        )}
        <AssetTable
          taskId={taskId}
          readOnly={isReadOnly || !!isDraft}
        />
      </section>

      {/* ---- P3-010-E：盘盈盘亏汇总面板 ---- */}
      <section aria-label={t('diffSummarySectionLabel')}>
        <DifferenceSummaryPanel
          taskId={taskId}
          readOnly={isReadOnly || !!isDraft}
        />
      </section>

      {/* ---- 批量确认对话框 ---- */}
      {!isReadOnly && !isDraft && batchDialogOpen && (
        <Modal
          open={batchDialogOpen}
          title={t('batchConfirmDialogTitle')}
          okText={t('confirm')}
          cancelText={t('cancel')}
          onOk={() => setBatchDialogOpen(false)}
          onCancel={() => setBatchDialogOpen(false)}
          confirmLoading={batchConfirmMutation.isPending}
          destroyOnClose
          aria-label={t('batchConfirmDialogTitle')}
        >
          <BatchConfirmForm
            selectedCount={selectedAssetIds.length}
            onConfirm={handleBatchConfirm}
            onCancel={() => setBatchDialogOpen(false)}
            loading={batchConfirmMutation.isPending}
          />
        </Modal>
      )}

      {/* ---- 提交核准二次确认弹窗 ---- */}
      {!isReadOnly && !isDraft && (
        <Modal
          open={submitDialogOpen}
          title={
            <Space>
              <ExclamationCircleOutlined style={{ color: '#faad14' }} />
              {t('submitConfirmTitle')}
            </Space>
          }
          okText={t('submitApproval')}
          cancelText={t('cancel')}
          okButtonProps={{ danger: true, loading: submitMutation.isPending }}
          onOk={() => setBatchDialogOpen(false)}
          onCancel={() => setSubmitDialogOpen(false)}
          closable={false}
          destroyOnClose
          aria-label={t('submitConfirmTitle')}
        >
          <p>{t('submitConfirmMessage')}</p>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 批量确认表单（内联子组件）
// ---------------------------------------------------------------------------

/**
 * BatchConfirmForm — 批量确认对话框中的表单。
 * 要求用户统一选择实盘状态，可选填统一备注。
 *
 * ATB-005 Step 4: "弹出批量确认对话框，要求统一选择实盘状态（下拉），可选填统一备注"
 */
import { Select, Input, Form } from 'antd';

const { TextArea } = Input;

/** 实盘状态选项 */
const ACTUAL_STATUS_OPTIONS: { value: ActualStatus; label: string }[] = [
  { value: 'normal', label: '正常' },
  { value: 'surplus', label: '盘盈' },
  { value: 'deficit', label: '盘亏' },
  { value: 'damaged', label: '损坏' },
  { value: 'other', label: '其他' },
];

interface BatchConfirmFormProps {
  /** 已勾选的资产数量 */
  selectedCount: number;
  /** 确认回调 */
  onConfirm: (actualStatus: ActualStatus, remark: string) => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 是否正在提交 */
  loading: boolean;
}

/**
 * 批量确认表单组件
 *
 * 提供统一的实盘状态下拉和备注输入区域，在批量确认弹窗中使用。
 *
 * @param props - 表单属性
 */
function BatchConfirmForm({
  selectedCount,
  onConfirm,
  onCancel,
  loading,
}: BatchConfirmFormProps) {
  const [actualStatus, setActualStatus] = useState<ActualStatus | undefined>(undefined);
  const [remark, setRemark] = useState('');

  /**
   * 表单提交处理。
   * 验证实盘状态必填后调用 onConfirm。
   */
  const handleSubmit = useCallback(() => {
    if (!actualStatus) {
      message.warning(t('pleaseSelectActualStatus'));
      return;
    }
    onConfirm(actualStatus, remark.trim());
  }, [actualStatus, remark, onConfirm]);

  return (
    <Form layout="vertical" onFinish={handleSubmit}>
      {/* 已选数量提示 */}
      <Form.Item label={t('selectedAssetsCount')}>
        <Text strong>
          {t('batchSelectedInfo', { count: selectedCount })}
        </Text>
      </Form.Item>

      {/* 统一实盘状态 */}
      <Form.Item
        label={t('actualStatusLabel')}
        required
        extra={t('batchConfirmStatusTip')}
      >
        <Select
          value={actualStatus}
          onChange={setActualStatus}
          placeholder={t('pleaseSelectActualStatus')}
          options={ACTUAL_STATUS_OPTIONS}
          aria-label={t('actualStatusLabel')}
          style={{ width: '100%' }}
        />
      </Form.Item>

      {/* 统一备注（可选） */}
      <Form.Item label={t('remarkLabel')}>
        <TextArea
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder={t('remarkPlaceholder')}
          maxLength={200}
          showCount
          rows={3}
          aria-label={t('remarkLabel')}
        />
      </Form.Item>

      {/* 操作按钮 */}
      <Form.Item className="mb-0 text-right">
        <Space>
          <Button onClick={onCancel} disabled={loading}>
            {t('cancel')}
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            disabled={!actualStatus}
          >
            {t('confirmBatch')}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}