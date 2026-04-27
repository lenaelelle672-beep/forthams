/**
 * DataPreview Component
 * 
 * 资产批量导入导出 - 数据预览组件
 * 功能：CSV/Excel 导入文件的数据预览与校验结果展示
 * 
 * @package SWARM-2025-Q2-P2-006
 * @version v1.0
 */

import React, { useMemo, useCallback } from 'react';
import { Table, Alert, Badge, Button, Tooltip } from 'antd';
import { FileTextOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

export interface PreviewRow {
  rowIndex: number;
  data: Record<string, string | number | null>;
  hasError: boolean;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface DataPreviewProps {
  /** 预览数据行 */
  data: PreviewRow[];
  /** 总行数（包含预览范围外的行） */
  totalRows?: number;
  /** 预览行数限制，默认100 */
  maxPreviewRows?: number;
  /** 是否显示错误行 */
  showErrorsOnly?: boolean;
  /** 错误行数量 */
  errorCount?: number;
  /** 文件名 */
  fileName?: string;
  /** 文件类型 */
  fileType?: 'csv' | 'xlsx';
  /** 列配置 */
  columns?: Array<{
    key: string;
    title: string;
    width?: number;
    required?: boolean;
  }>;
  /** 下载错误报告回调 */
  onDownloadReport?: () => void;
  /** 预览行点击回调 */
  onRowClick?: (row: PreviewRow, index: number) => void;
  /** 加载状态 */
  loading?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  asset_id: '资产ID',
  asset_name: '资产名称',
  asset_type: '资产类型',
  serial_number: '序列号',
  purchase_date: '购置日期',
  purchase_price: '购置价格',
  currency: '货币',
  department: '部门',
  custodian: '保管人',
  status: '状态',
  location: '位置',
  remarks: '备注',
};

const FIELD_WIDTHS: Record<string, number> = {
  asset_id: 120,
  asset_name: 200,
  asset_type: 120,
  serial_number: 150,
  purchase_date: 120,
  purchase_price: 120,
  currency: 80,
  department: 120,
  custodian: 120,
  status: 100,
  location: 200,
  remarks: 250,
};

/**
 * 格式化单元格显示值
 * @param value 单元格原始值
 * @returns 格式化后的显示值
 */
const formatCellValue = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return String(value);
};

/**
 * 获取字段类型对应的Badge颜色
 * @param fieldKey 字段键名
 * @param value 字段值
 * @returns Badge颜色
 */
const getValueBadgeColor = (fieldKey: string, value: string | number | null): string => {
  if (value === null || value === undefined || value === '') {
    return 'default';
  }
  
  switch (fieldKey) {
    case 'asset_type':
      const typeColors: Record<string, string> = {
        EQUIPMENT: 'blue',
        FURNITURE: 'green',
        VEHICLE: 'orange',
        IT_HARDWARE: 'purple',
        OTHER: 'default',
      };
      return typeColors[String(value).toUpperCase()] || 'default';
    case 'status':
      const statusColors: Record<string, string> = {
        ACTIVE: 'success',
        INACTIVE: 'default',
        MAINTENANCE: 'warning',
        RETIRED: 'error',
      };
      return statusColors[String(value).toUpperCase()] || 'default';
    default:
      return 'default';
  }
};

/**
 * DataPreview 组件
 * 
 * 用于显示批量导入数据的预览，支持：
 * - CSV/Excel 数据表格展示
 * - 错误行高亮标记
 * - 字段级错误信息展示
 * - 错误报告下载
 */
const DataPreview: React.FC<DataPreviewProps> = ({
  data,
  totalRows,
  maxPreviewRows = 100,
  showErrorsOnly = false,
  errorCount = 0,
  fileName,
  fileType = 'csv',
  columns,
  onDownloadReport,
  onRowClick,
  loading = false,
}) => {
  // 过滤显示的数据
  const filteredData = useMemo(() => {
    if (showErrorsOnly) {
      return data.filter(row => row.hasError);
    }
    return data;
  }, [data, showErrorsOnly]);

  // 生成表格列配置
  const tableColumns = useMemo((): ColumnsType<PreviewRow> => {
    if (columns && columns.length > 0) {
      return columns.map(col => ({
        key: col.key,
        title: col.title,
        dataIndex: ['data', col.key],
        width: col.width || FIELD_WIDTHS[col.key] || 150,
        ellipsis: true,
        render: (value: string | number | null) => formatCellValue(value),
      }));
    }

    // 默认列配置：基于第一条数据的字段
    if (data.length > 0) {
      const firstRowKeys = Object.keys(data[0].data);
      return firstRowKeys.map(key => ({
        key,
        title: FIELD_LABELS[key] || key,
        dataIndex: ['data', key],
        width: FIELD_WIDTHS[key] || 150,
        ellipsis: true,
        render: (value: string | number | null, record: PreviewRow) => {
          const hasFieldError = record.errors?.some(e => e.field === key);
          
          if (hasFieldError) {
            return (
              <Tooltip title={record.errors?.find(e => e.field === key)?.message}>
                <span style={{ color: '#ff4d4f', fontWeight: 500 }}>
                  {formatCellValue(value)}
                </span>
              </Tooltip>
            );
          }
          
          return formatCellValue(value);
        },
      }));
    }

    return [];
  }, [columns, data]);

  // 行样式回调
  const getRowClassName = useCallback((record: PreviewRow, index: number) => {
    const classes = ['preview-row'];
    if (record.hasError) {
      classes.push('preview-row-error');
    }
    return classes.join(' ');
  }, []);

  // 预览范围信息
  const previewRangeText = useMemo(() => {
    if (totalRows && totalRows > maxPreviewRows) {
      return `显示前 ${maxPreviewRows} 行，共 ${totalRows} 行`;
    }
    return `共 ${data.length} 行`;
  }, [data.length, totalRows, maxPreviewRows]);

  // 空状态组件
  const renderEmptyState = () => (
    <div className="data-preview-empty">
      <FileTextOutlined style={{ fontSize: 48, color: '#999', marginBottom: 16 }} />
      <p>暂无数据预览</p>
      <p style={{ color: '#999', fontSize: 12 }}>请上传 CSV 或 Excel 文件</p>
    </div>
  );

  // 错误摘要组件
  const renderErrorSummary = () => {
    if (errorCount === 0) return null;
    
    return (
      <Alert
        message="数据校验结果"
        description={
          <div>
            <span>发现 {errorCount} 条数据存在错误</span>
            {onDownloadReport && (
              <Button 
                type="link" 
                size="small" 
                onClick={onDownloadReport}
                style={{ marginLeft: 16, padding: 0 }}
              >
                下载错误报告
              </Button>
            )}
          </div>
        }
        type="error"
        showIcon
        icon={<WarningOutlined />}
        style={{ marginBottom: 16 }}
      />
    );
  };

  // 成功摘要组件
  const renderSuccessSummary = () => {
    if (errorCount > 0 || data.length === 0) return null;
    
    return (
      <Alert
        message="数据校验通过"
        description={`所有 ${data.length} 条数据校验成功`}
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
        style={{ marginBottom: 16 }}
      />
    );
  };

  // 文件信息组件
  const renderFileInfo = () => {
    if (!fileName) return null;
    
    return (
      <div className="data-preview-file-info">
        <Badge count={fileType.toUpperCase()} style={{ backgroundColor: '#1890ff' }} />
        <span style={{ marginLeft: 8 }}>{fileName}</span>
        <span style={{ marginLeft: 16, color: '#999' }}>{previewRangeText}</span>
      </div>
    );
  };

  // 行点击处理
  const handleRowClick = useCallback((record: PreviewRow, index: number) => {
    if (onRowClick) {
      onRowClick(record, index);
    }
  }, [onRowClick]);

  // 加载状态处理
  if (loading) {
    return (
      <div className="data-preview-loading">
        <div className="data-preview-spinner" />
        <p>正在解析文件...</p>
      </div>
    );
  }

  // 空数据处理
  if (!data || data.length === 0) {
    return renderEmptyState();
  }

  return (
    <div className="data-preview">
      {renderFileInfo()}
      {renderErrorSummary()}
      {renderSuccessSummary()}
      
      <Table
        columns={tableColumns}
        dataSource={filteredData}
        rowKey={(record) => `row-${record.rowIndex}`}
        rowClassName={getRowClassName}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        size="small"
        scroll={{ x: 'max-content', y: 400 }}
        onRow={(record, index) => ({
          onClick: () => handleRowClick(record, index!),
          style: { cursor: 'pointer' },
        })}
      />
      
      <style>{`
        .data-preview {
          padding: 16px;
          background: #fafafa;
          border-radius: 8px;
        }
        
        .data-preview-file-info {
          margin-bottom: 16px;
          padding: 8px 12px;
          background: #fff;
          border-radius: 4px;
          display: flex;
          align-items: center;
        }
        
        .data-preview-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px 0;
        }
        
        .data-preview-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px 0;
        }
        
        .data-preview-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #1890ff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .preview-row-error {
          background-color: #fff2f0 !important;
        }
        
        .preview-row-error:hover > td {
          background-color: #fff1e6 !important;
        }
      `}</style>
    </div>
  );
};

export default DataPreview;