import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Button,
  Card,
  message,
  Space,
  Typography,
  Alert,
  Divider,
} from 'antd';
import {
  DownloadOutlined,
  FileExcelOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

import ExportFilterPanel from './ExportFilterPanel';
import { useExportFilters } from '../hooks/useExportFilters';
import { useAssetExport } from '../hooks/useAssetExport';
import { useFileDownload } from '../hooks/useFileDownload';
import { downloadFileStream } from '../../../utils/fileDownloader';
import type { ExportFilterParams } from '../types';

const { Title, Text } = Typography;

/**
 * ExportTab – 导出标签页容器组件。
 *
 * 提供资产台账的多维度条件筛选导出功能，以及标准导入模板的下载入口。
 * 所有文件下载操作严格遵循前端流处理约束：后端返回二进制流 → Blob 组装 →
 * URL.createObjectURL 创建临时链接触发浏览器下载，并在组件卸载时释放内存。
 *
 * @component
 * @example
 * ```tsx
 * <Tabs.Items>
 *   <Tabs.Item label="导出"><ExportTab /></Tabs.Item>
 * </Tabs>
 * ```
 */
const ExportTab: React.FC = () => {
  /** 导出条件筛选状态（分类、状态、存放位置） */
  const { filters, updateFilter, resetFilters } = useExportFilters();

  /** 导出接口调用 hook —— 调用后端返回 Blob 二进制流 */
  const { exportAssets, loading: exportLoading } = useAssetExport();

  /** 模板下载 hook —— 封装模板二进制流请求与 Blob 下载 */
  const { downloadTemplate, loading: templateLoading } = useFileDownload();

  /** 错误提示信息（用于 Alert 展示） */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * 持有当前 Object URL 的引用，便于在组件卸载或下次下载前调用
   * URL.revokeObjectURL 释放浏览器内存。
   */
  const objectUrlRef = useRef<string | null>(null);

  /**
   * 释放当前持有的 Object URL，防止内存泄漏。
   *
   * 调用时机：
   * 1. 新的下载动作发起前（先释放旧的再创建新的）；
   * 2. 组件卸载时（通过 useEffect cleanup）。
   */
  const revokeCurrentObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  /** 组件卸载时释放尚未回收的 Object URL */
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  /**
   * 处理「导出资产台账」按钮点击。
   *
   * 流程：
   * 1. 清除上次错误信息；
   * 2. 释放上一次下载创建的 Object URL；
   * 3. 调用 exportAssets 发起带筛选条件的后端请求，获取 Blob；
   * 4. 通过 downloadFileStream 工具函数利用 Blob + URL.createObjectURL 触发下载；
   * 5. 成功后弹出 Toast 提示。
   */
  const handleExport = useCallback(async () => {
    try {
      setErrorMessage(null);
      revokeCurrentObjectUrl();

      const blob: Blob = await exportAssets(filters as ExportFilterParams);
      const filename = buildExportFilename();

      // downloadFileStream 内部通过 URL.createObjectURL 创建临时链接
      // 并在下载触发后执行 URL.revokeObjectURL 释放内存
      downloadFileStream(blob, filename);

      message.success(`资产台账已导出：${filename}`);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : '导出失败，请检查网络后重试';
      setErrorMessage(msg);
      message.error(msg);
    }
  }, [filters, exportAssets, revokeCurrentObjectUrl]);

  /**
   * 处理「下载导入模板」按钮点击。
   *
   * 模板下载由 useFileDownload hook 内部完成二进制流请求、
   * Blob 组装与 URL.createObjectURL 触发下载。
   */
  const handleDownloadTemplate = useCallback(async () => {
    try {
      setErrorMessage(null);
      revokeCurrentObjectUrl();

      await downloadTemplate();

      message.success('导入模板下载成功');
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : '模板下载失败，请重试';
      setErrorMessage(msg);
      message.error(msg);
    }
  }, [downloadTemplate, revokeCurrentObjectUrl]);

  /**
   * 处理「重置条件」按钮点击。
   *
   * 清空所有筛选条件（分类、状态、位置），同时移除页面上的错误提示。
   */
  const handleReset = useCallback(() => {
    resetFilters();
    setErrorMessage(null);
  }, [resetFilters]);

  /**
   * 关闭错误 Alert 的回调。
   */
  const handleDismissError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  /** 是否处于加载中（导出或模板下载） */
  const isLoading = exportLoading || templateLoading;

  return (
    <div className="export-tab" data-testid="export-tab">
      <Card bordered={false} style={{ maxWidth: 960 }}>
        {/* ── 标题区域 ── */}
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 8 }}>
            资产台账导出
          </Title>
          <Text type="secondary">
            按资产分类、状态、存放位置等维度筛选，导出符合条件的资产台账数据为
            Excel 文件
          </Text>
        </div>

        {/* ── 错误提示 ── */}
        {errorMessage && (
          <Alert
            message="操作失败"
            description={errorMessage}
            type="error"
            closable
            onClose={handleDismissError}
            showIcon
            style={{ marginBottom: 16 }}
            data-testid="export-error-alert"
          />
        )}

        {/* ── 导出条件筛选面板 ── */}
        <ExportFilterPanel
          filters={filters}
          onFilterChange={updateFilter}
          onReset={handleReset}
        />

        <Divider style={{ margin: '24px 0' }} />

        {/* ── 操作按钮组 ── */}
        <Space size="middle" wrap>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            loading={exportLoading}
            disabled={templateLoading}
            onClick={handleExport}
            data-testid="export-button"
          >
            导出资产台账
          </Button>

          <Button
            icon={<DownloadOutlined />}
            loading={templateLoading}
            disabled={exportLoading}
            onClick={handleDownloadTemplate}
            data-testid="download-template-button"
          >
            下载导入模板
          </Button>

          <Button
            icon={<ReloadOutlined />}
            disabled={isLoading}
            onClick={handleReset}
            data-testid="reset-filters-button"
          >
            重置条件
          </Button>
        </Space>

        {/* ── 当前筛选条件摘要 ── */}
        {hasActiveFilters(filters) && !isLoading && (
          <div style={{ marginTop: 16 }}>
            <Text type="secondary" data-testid="filter-summary">
              当前筛选条件：{formatFilterSummary(filters)}
            </Text>
          </div>
        )}
      </Card>
    </div>
  );
};

/* ================================================================
 *  辅助纯函数
 * ================================================================ */

/**
 * 根据当前日期生成导出文件名。
 *
 * 命名规则：asset_export_YYYY-MM-DD.xlsx
 *
 * @returns 符合系统约定的导出文件名字符串
 */
function buildExportFilename(): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  return `asset_export_${dateStr}.xlsx`;
}

/**
 * 判断筛选条件中是否存在至少一个已激活（非空）的值。
 *
 * @param filters - 当前筛选条件对象
 * @returns 存在已激活筛选条件时返回 true
 */
function hasActiveFilters(filters: Partial<ExportFilterParams>): boolean {
  return Boolean(filters.category || filters.status || filters.location);
}

/**
 * 将当前筛选条件格式化为可读的摘要文本。
 *
 * 输出示例："分类：电子设备 | 状态：闲置 | 位置：A区"
 *
 * @param filters - 当前筛选条件对象
 * @returns 以竖线分隔的筛选条件摘要字符串
 */
function formatFilterSummary(
  filters: Partial<ExportFilterParams>
): string {
  const parts: string[] = [];
  if (filters.category) parts.push(`分类：${filters.category}`);
  if (filters.status) parts.push(`状态：${filters.status}`);
  if (filters.location) parts.push(`位置：${filters.location}`);
  return parts.join(' | ');
}

export default ExportTab;