import React, { useCallback } from 'react';
import { Button, Space, Typography, Tooltip, message } from 'antd';
import { CheckOutlined } from '@ant-design/icons';

const { Text } = Typography;

/** 单次批量确认上限条数（交互约束 #7） */
const BATCH_CONFIRM_LIMIT = 100;

/**
 * 资产清单表格批量操作栏组件
 *
 * 在盘点执行详情页中，显示于资产清单表格上方，
 * 提供"批量确认"功能，并展示当前选中数量。
 *
 * 交互规则（对齐 SPEC 交互约束）：
 * - 未勾选任何行时，批量确认按钮置灰不可点击（约束 #4）
 * - 勾选行后，显示"已选 N 项"文案，按钮可点击
 * - 单次批量上限 100 条，超出截断并提示用户（约束 #7）
 * - readOnly 模式下整个工具栏不渲染（ATB-007）
 * - loading 期间按钮禁用，防止重复提交（约束 #6）
 */
const AssetTableToolbar: React.FC<AssetTableToolbarProps> = ({
  selectedAssetIds,
  readOnly,
  onBatchConfirm,
  loading = false,
}) => {
  const selectedCount = selectedAssetIds.length;

  /**
   * 处理批量确认点击
   *
   * 若选中数量超过上限则截断并提示；
   * 若当前处于 loading 状态则忽略点击（防重复提交）。
   */
  const handleBatchConfirm = useCallback(() => {
    if (selectedCount === 0 || loading) return;

    let idsToConfirm = selectedAssetIds;

    if (selectedCount > BATCH_CONFIRM_LIMIT) {
      message.warning(
        `单次批量确认上限 ${BATCH_CONFIRM_LIMIT} 条，已自动截断`,
      );
      idsToConfirm = selectedAssetIds.slice(0, BATCH_CONFIRM_LIMIT);
    }

    onBatchConfirm(idsToConfirm);
  }, [selectedAssetIds, selectedCount, loading, onBatchConfirm]);

  // 只读模式下不渲染工具栏（ATB-007：已完成/已提交时确认按钮不可见）
  if (readOnly) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 0',
        marginBottom: 8,
      }}
      role="toolbar"
      aria-label="资产批量操作栏"
    >
      <Space size="middle">
        {selectedCount > 0 && (
          <Text type="secondary" aria-live="polite">
            已选 {selectedCount} 项
          </Text>
        )}
        <Tooltip
          title={selectedCount === 0 ? '请先勾选需要确认的资产行' : undefined}
        >
          <Button
            icon={<CheckOutlined />}
            disabled={selectedCount === 0 || loading}
            loading={loading}
            onClick={handleBatchConfirm}
            aria-label={
              selectedCount > 0
                ? `批量确认 ${selectedCount} 项资产`
                : '批量确认（未选择资产）'
            }
          >
            批量确认
          </Button>
        </Tooltip>
      </Space>
    </div>
  );
};

/**
 * 资产清单表格批量操作栏 Props
 */
export interface AssetTableToolbarProps {
  /** 当前选中资产 ID 列表 */
  selectedAssetIds: string[];
  /** 是否只读模式（任务状态为已完成/已提交/草稿时为 true） */
  readOnly: boolean;
  /** 批量确认回调，传入待确认的资产 ID 数组 */
  onBatchConfirm: (assetIds: string[]) => void;
  /** 是否正在执行批量确认请求（防重复提交） */
  loading?: boolean;
}

export default AssetTableToolbar;
