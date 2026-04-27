/**
 * ExportPanel Component
 * 资产批量导出面板组件
 * 
 * 功能支持：
 * - CSV 格式导出
 * - Excel (.xlsx) 格式导出
 * - 支持筛选条件（分类、状态、时间范围）
 * 
 * @module components/ExportPanel
 * @version SWARM-2025-Q2-P2-006
 */

import React, { useState, useCallback } from 'react';
import { Button, Select, DatePicker, Space, message } from 'antd';
import { DownloadOutlined, FileTextOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

import { exportAssets } from '@/services/assetService';
import type { Asset, AssetType, AssetStatus } from '@/types/asset.types';

const { RangePicker } = DatePicker;

// 导出格式枚举
export type ExportFormat = 'csv' | 'xlsx';

// 筛选条件接口
export interface ExportFilter {
  assetType?: AssetType;
  status?: AssetStatus;
  dateRange?: [Dayjs, Dayjs];
}

interface ExportPanelProps {
  /** 默认筛选条件 */
  defaultFilter?: ExportFilter;
  /** 导出成功回调 */
  onExportSuccess?: (filename: string) => void;
  /** 导出失败回调 */
  onExportError?: (error: Error) => void;
  /** 是否禁用 */
  disabled?: boolean;
}

// 资产类型选项
const ASSET_TYPE_OPTIONS = [
  { label: '全部类型', value: '' },
  { label: '设备', value: 'EQUIPMENT' },
  { label: '家具', value: 'FURNITURE' },
  { label: '车辆', value: 'VEHICLE' },
  { label: 'IT硬件', value: 'IT_HARDWARE' },
  { label: '其他', value: 'OTHER' },
];

// 资产状态选项
const ASSET_STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '在用', value: 'ACTIVE' },
  { label: '闲置', value: 'INACTIVE' },
  { label: '维护中', value: 'MAINTENANCE' },
  { label: '已报废', value: 'RETIRED' },
];

// 导出格式选项
const EXPORT_FORMAT_OPTIONS = [
  { label: 'CSV 格式', value: 'csv', icon: <FileTextOutlined /> },
  { label: 'Excel 格式', value: 'xlsx', icon: <FileExcelOutlined /> },
];

/**
 * ExportPanel 组件
 * 提供资产数据批量导出功能
 * 
 * @param props - ExportPanelProps
 * @returns React 组件
 * 
 * @example
 * ```tsx
 * <ExportPanel 
 *   defaultFilter={{ status: 'ACTIVE' }}
 *   onExportSuccess={(filename) => console.log(`Downloaded: ${filename}`)}
 * />
 * ```
 */
const ExportPanel: React.FC<ExportPanelProps> = ({
  defaultFilter = {},
  onExportSuccess,
  onExportError,
  disabled = false,
}) => {
  // 状态管理
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [assetType, setAssetType] = useState<string>(defaultFilter.assetType || '');
  const [status, setStatus] = useState<string>(defaultFilter.status || '');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(
    defaultFilter.dateRange || null
  );
  const [loading, setLoading] = useState(false);

  /**
   * 处理导出格式变更
   * @param value - 选中的格式值
   */
  const handleFormatChange = useCallback((value: ExportFormat) => {
    setFormat(value);
  }, []);

  /**
   * 处理资产类型变更
   * @param value - 选中的资产类型
   */
  const handleAssetTypeChange = useCallback((value: string) => {
    setAssetType(value);
  }, []);

  /**
   * 处理资产状态变更
   * @param value - 选中的资产状态
   */
  const handleStatusChange = useCallback((value: string) => {
    setStatus(value);
  }, []);

  /**
   * 处理日期范围变更
   * @param dates - 选中的日期范围
   */
  const handleDateRangeChange = useCallback((dates: [Dayjs, Dayjs] | null) => {
    setDateRange(dates);
  }, []);

  /**
   * 构建导出参数
   * @returns 导出的查询参数
   */
  const buildExportParams = useCallback(() => {
    const params: Record<string, string | number> = {
      format,
    };

    if (assetType) {
      params.asset_type = assetType;
    }

    if (status) {
      params.status = status;
    }

    if (dateRange && dateRange.length === 2) {
      params.start_date = dateRange[0].format('YYYY-MM-DD');
      params.end_date = dateRange[1].format('YYYY-MM-DD');
    }

    return params;
  }, [format, assetType, status, dateRange]);

  /**
   * 处理导出操作
   * 触发 CSV 或 Excel 格式的资产数据导出
   */
  const handleExport = useCallback(async () => {
    try {
      setLoading(true);
      const params = buildExportParams();

      // 生成带时间戳的文件名
      const timestamp = dayjs().format('YYYYMMDD_HHmmss');
      const extension = format === 'xlsx' ? 'xlsx' : 'csv';
      const filename = `asset_export_${timestamp}.${extension}`;

      // 调用导出服务
      await exportAssets(params, filename);

      message.success(`导出成功: ${filename}`);
      onExportSuccess?.(filename);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '导出失败，请重试';
      message.error(errorMessage);
      onExportError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setLoading(false);
    }
  }, [buildExportParams, format, onExportSuccess, onExportError]);

  /**
   * 重置筛选条件
   */
  const handleReset = useCallback(() => {
    setAssetType('');
    setStatus('');
    setDateRange(null);
    setFormat('csv');
  }, []);

  return (
    <div className="export-panel" data-testid="export-panel">
      <div className="export-panel__filters">
        <Space direction="horizontal" size="middle" wrap>
          {/* 导出格式选择 */}
          <Select
            value={format}
            onChange={handleFormatChange}
            options={EXPORT_FORMAT_OPTIONS}
            style={{ width: 140 }}
            disabled={disabled}
            placeholder="选择导出格式"
          />

          {/* 资产类型筛选 */}
          <Select
            value={assetType}
            onChange={handleAssetTypeChange}
            options={ASSET_TYPE_OPTIONS}
            style={{ width: 120 }}
            disabled={disabled}
            placeholder="资产类型"
            allowClear
          />

          {/* 资产状态筛选 */}
          <Select
            value={status}
            onChange={handleStatusChange}
            options={ASSET_STATUS_OPTIONS}
            style={{ width: 120 }}
            disabled={disabled}
            placeholder="资产状态"
            allowClear
          />

          {/* 日期范围筛选 */}
          <RangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            disabled={disabled}
            placeholder={['开始日期', '结束日期']}
            format="YYYY-MM-DD"
          />
        </Space>
      </div>

      <div className="export-panel__actions">
        <Space direction="horizontal" size="middle">
          <Button
            onClick={handleReset}
            disabled={disabled || loading}
            title="重置筛选条件"
          >
            重置
          </Button>

          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            loading={loading}
            disabled={disabled}
            title={`导出为 ${format.toUpperCase()} 格式`}
          >
            导出{format === 'csv' ? 'CSV' : 'Excel'}
          </Button>
        </Space>
      </div>

      <style>
        {`
          .export-panel {
            padding: 16px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }

          .export-panel__filters {
            margin-bottom: 16px;
          }

          .export-panel__actions {
            display: flex;
            justify-content: flex-end;
          }
        `}
      </style>
    </div>
  );
};

export default ExportPanel;

// 导出子组件类型供外部使用
export type { ExportPanelProps, ExportFilter, ExportFormat };