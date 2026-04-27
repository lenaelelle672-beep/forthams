/**
 * ExportButton 组件 — 资产批量导出触发按钮
 *
 * 对应规格: [SWARM-P2-006-FE] FE-9 导出按钮与文件下载
 * 验收标准:
 *   ATB-015 — 无条件导出确认弹窗
 *   ATB-016 — 导出文件下载（文件名匹配 资产台账_YYYYMMDD_HHmmss.xlsx）
 *   ATB-017 — URL.revokeObjectURL 内存释放
 *
 * 职责:
 *   1. 接收来自 ExportFilterPanel 的筛选条件 (categoryCodes / statusCodes / locationCodes)
 *   2. 无筛选条件时弹出 Modal.confirm 确认是否导出全部 (ATB-015)
 *   3. 调用 POST /api/v1/assets/export，以 Blob + URL.createObjectURL 触发下载
 *   4. 下载完成后调用 URL.revokeObjectURL() 释放内存 (ATB-017)
 *   5. 文件名格式: 资产台账_YYYYMMDD_HHmmss.xlsx
 */
import React, { useState, useCallback } from 'react';
import { Button, Modal, notification } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useAssetExport } from '../hooks/useAssetExport';
import type { ExportFilterParams } from '../types';

/** ExportButton 组件属性 */
export interface ExportButtonProps {
  /** 当前筛选条件，由父级 ExportPanel / ExportFilterPanel 管理 */
  filters: ExportFilterParams;
  /** 是否禁用按钮 */
  disabled?: boolean;
}

/**
 * 资产导出按钮组件
 *
 * 点击后根据筛选条件调用后端导出接口，
 * 以 Blob + URL.createObjectURL 方式触发浏览器文件下载。
 */
const ExportButton: React.FC<ExportButtonProps> = ({ filters, disabled = false }) => {
  const [loading, setLoading] = useState(false);
  const { exportAssets } = useAssetExport();

  /**
   * 生成导出文件名
   * 格式: 资产台账_YYYYMMDD_HHmmss.xlsx（时间戳取前端当前时间）
   */
  const generateFilename = useCallback((): string => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `资产台账_${timestamp}.xlsx`;
  }, []);

  /**
   * 判断是否至少设置了一项筛选条件
   */
  const hasAnyFilter = useCallback((): boolean => {
    const { categoryCodes = [], statusCodes = [], locationCodes = [] } = filters;
    return (
      categoryCodes.length > 0 ||
      statusCodes.length > 0 ||
      locationCodes.length > 0
    );
  }, [filters]);

  /**
   * 执行导出操作
   *
   * 流程: 调用 useAssetExport → 获取 Blob → createObjectURL → <a>.click() → revokeObjectURL
   */
  const doExport = useCallback(async () => {
    setLoading(true);
    try {
      // 调用后端 POST /api/v1/assets/export，返回 Blob
      const blob: Blob = await exportAssets(filters);
      const filename = generateFilename();

      // Blob + URL.createObjectURL 触发浏览器下载
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.setAttribute('download', filename);
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();

      // 清理：移除临时 <a> 并释放 Object URL 内存 (ATB-017)
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      notification.success({
        message: '导出成功',
        description: `文件 ${filename} 已开始下载`,
      });
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error
          ? error.message
          : '导出过程中发生错误，请稍后重试';
      notification.error({
        message: '导出失败',
        description: errMsg,
      });
    } finally {
      setLoading(false);
    }
  }, [filters, exportAssets, generateFilename]);

  /**
   * 点击事件处理
   * - 有筛选条件 → 直接导出
   * - 无筛选条件 → Modal.confirm 确认后导出 (ATB-015)
   */
  const handleClick = useCallback(() => {
    if (!hasAnyFilter()) {
      Modal.confirm({
        title: '导出确认',
        content: '未设置筛选条件，将导出全部资产，是否继续？',
        okText: '确定',
        cancelText: '取消',
        onOk: () => {
          doExport();
        },
      });
    } else {
      doExport();
    }
  }, [hasAnyFilter, doExport]);

  return (
    <Button
      type="primary"
      icon={<DownloadOutlined />}
      onClick={handleClick}
      loading={loading}
      disabled={disabled || loading}
    >
      导出
    </Button>
  );
};

export default ExportButton;