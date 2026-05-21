/**
 * DataPreview.tsx
 * 资产批量导入 - 数据预览组件
 * 
 * 功能说明:
 * - 展示导入文件的前100行数据预览
 * - 高亮显示校验失败的行
 * - 支持 CSV/Excel 格式数据渲染
 * 
 * 约束:
 * - 单次导入上限 5000 条记录
 * - 文件大小上限 10 MB
 * - 支持字段数: 固定 12 个核心字段
 */

import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Box, Typography, Chip } from '@mui/material';
import { Alert, AlertTitle } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';

export interface ValidationError {
  row: number;
  field: string;
  value: string;
  reason: string;
}

export interface DataPreviewProps {
  /** 解析后的数据行数组 */
  data: Record<string, string>[];
  /** CSV 原始列名列表 */
  headers: string[];
  /** 校验错误列表 */
  errors?: ValidationError[];
  /** 最大预览行数，默认100 */
  maxPreviewRows?: number;
  /** 是否显示加载状态 */
  loading?: boolean;
}

// 字段中文映射
const FIELD_LABELS: Record<string, string> = {
  asset_id: '资产编号',
  asset_name: '资产名称',
  asset_type: '资产类型',
  serial_number: '序列号',
  purchase_date: '购置日期',
  purchase_price: '购置价格',
  currency: '币种',
  department: '部门',
  custodian: '保管人',
  status: '状态',
  location: '存放地点',
  remarks: '备注',
};

// 资产类型枚举标签
const ASSET_TYPE_LABELS: Record<string, string> = {
  EQUIPMENT: '设备',
  FURNITURE: '家具',
  VEHICLE: '车辆',
  IT_HARDWARE: 'IT设备',
  OTHER: '其他',
};

// 状态枚举标签
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '在用',
  INACTIVE: '闲置',
  MAINTENANCE: '维修中',
  RETIRED: '已报废',
};

/**
 * 获取字段的中文显示标签
 */
const getFieldLabel = (field: string): string => {
  return FIELD_LABELS[field] || field;
};

/**
 * 获取枚举值的中文显示
 */
const getEnumLabel = (field: string, value: string): string => {
  if (field === 'asset_type') {
    return ASSET_TYPE_LABELS[value] || value;
  }
  if (field === 'status') {
    return STATUS_LABELS[value] || value;
  }
  return value;
};

/**
 * DataPreview 组件
 * 
 * 用于展示导入文件的数据预览，支持:
 * - 前100行数据表格展示
 * - 校验失败行高亮显示
 * - 错误汇总信息展示
 */
export const DataPreview: React.FC<DataPreviewProps> = ({
  data,
  headers,
  errors = [],
  maxPreviewRows = 100,
  loading = false,
}) => {
  // 计算有错误的行号集合
  const errorRows = useMemo(() => {
    const rows = new Set<number>();
    errors.forEach((error) => {
      rows.add(error.row);
    });
    return rows;
  }, [errors]);

  // 获取每行的错误信息
  const getRowErrors = (rowIndex: number): ValidationError[] => {
    return errors.filter((error) => error.row === rowIndex);
  };

  // 截取预览行数
  const previewData = useMemo(() => {
    return data.slice(0, maxPreviewRows);
  }, [data, maxPreviewRows]);

  // 渲染错误行高亮样式
  const getRowStyle = (rowIndex: number): React.CSSProperties => {
    if (errorRows.has(rowIndex)) {
      return {
        backgroundColor: 'rgba(244, 67, 54, 0.08)',
        borderLeft: '3px solid #f44336',
      };
    }
    return {};
  };

  // 加载状态
  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="textSecondary">正在加载数据预览...</Typography>
      </Box>
    );
  }

  // 空数据状态
  if (!data || data.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="textSecondary">暂无数据</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* 数据统计信息 */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="textSecondary">
          共 {data.length} 条数据，预览前 {previewData.length} 条
          {data.length > maxPreviewRows && (
            <Chip size="small" label="已截断" sx={{ ml: 1 }} />
          )}
        </Typography>
        {errors.length > 0 && (
          <Chip
            icon={<WarningIcon />}
            label={`${errors.length} 个校验错误`}
            color="error"
            size="small"
          />
        )}
      </Box>

      {/* 错误汇总 */}
      {errors.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>数据校验警告</AlertTitle>
          发现 {errors.length} 个校验错误，请查看下表中高亮行。如需下载完整错误报告，请点击"下载错误报告"按钮。
        </Alert>
      )}

      {/* 数据表格 */}
      <TableContainer component={Paper} sx={{ maxHeight: 500, overflow: 'auto' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#ffffff', minWidth: 60 }}>
                行号
              </TableCell>
              {headers.map((header) => (
                <TableCell key={header} sx={{ fontWeight: 'bold', backgroundColor: '#ffffff', minWidth: 100 }}>
                  {getFieldLabel(header)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {previewData.map((row, rowIndex) => {
              const rowErrors = getRowErrors(rowIndex);
              const hasError = rowErrors.length > 0;

              return (
                <TableRow
                  key={rowIndex}
                  sx={getRowStyle(rowIndex)}
                  hover={hasError}
                >
                  <TableCell sx={{ fontWeight: hasError ? 'bold' : 'normal', color: hasError ? 'error.main' : 'inherit' }}>
                    {rowIndex + 1}
                    {hasError && (
                      <Chip
                        size="small"
                        label={`${rowErrors.length}个错误`}
                        color="error"
                        sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                      />
                    )}
                  </TableCell>
                  {headers.map((header) => {
                    const cellError = rowErrors.find((e) => e.field === header);
                    const value = row[header] || '';

                    return (
                      <TableCell
                        key={header}
                        sx={{
                          color: cellError ? 'error.main' : 'inherit',
                          fontStyle: cellError ? 'italic' : 'normal',
                        }}
                        title={cellError ? `${cellError.reason}: ${cellError.value}` : value}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {cellError && (
                            <WarningIcon sx={{ fontSize: 16, color: 'error.main' }} />
                          )}
                          <span>
                            {header === 'asset_type' || header === 'status'
                              ? getEnumLabel(header, value)
                              : value}
                          </span>
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 底部统计 */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Typography variant="body2" color="textSecondary">
          预览: {previewData.length} / {data.length} 条
        </Typography>
        {errorRows.size > 0 && (
          <Typography variant="body2" color="error">
            错误: {errorRows.size} 行
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default DataPreview;