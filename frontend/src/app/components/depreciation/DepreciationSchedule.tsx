/**
 * DepreciationSchedule Component
 * 
 * 折旧计划报表组件 - 用于展示资产折旧明细与汇总信息
 * 
 * 功能特性:
 * - 按资产维度展示折旧明细列表
 * - 支持月度/年度筛选
 * - 展示累计折旧与账面净值
 * - 资产详情页关联视图跳转
 * 
 * @module DepreciationSchedule
 * @since 2025-01
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Table, Card, DatePicker, Select, Button, Tag, Space, Tooltip, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { 
  DownloadOutlined, 
  FilterOutlined, 
  ReloadOutlined,
  LinkOutlined,
  CalculatorOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useDepreciationReport, useAssetDepreciationSchedule } from '@/hooks/useDepreciation';
import type { 
  DepreciationRecord, 
  DepreciationSummary,
  DepreciationMethod,
  DepreciationScheduleFilters 
} from '@/types/depreciation.types';

const { RangePicker } = DatePicker;

/**
 * 折旧方法显示映射
 */
const METHOD_LABELS: Record<DepreciationMethod, { text: string; color: string }> = {
  straight_line: { text: '直线法', color: 'blue' },
  double_declining: { text: '双倍余额递减法', color: 'purple' },
};

/**
 * DepreciationSchedule 组件属性接口
 */
export interface DepreciationScheduleProps {
  /** 资产ID - 当从资产详情页跳转时传入 */
  assetId?: string;
  /** 是否显示筛选器 */
  showFilters?: boolean;
  /** 是否显示导出按钮 */
  showExport?: boolean;
  /** 是否启用实时同步 */
  enableSync?: boolean;
  /** 组件类名 */
  className?: string;
  /** 内联样式 */
  style?: React.CSSProperties;
  /** 筛选默认值 */
  defaultFilters?: Partial<DepreciationScheduleFilters>;
  /** 资产详情跳转回调 */
  onAssetNavigate?: (assetId: string) => void;
  /** 导出回调 */
  onExport?: (records: DepreciationRecord[]) => void;
}

/**
 * 折旧记录表格列配置
 */
const DEPRECIATION_COLUMNS: ColumnsType<DepreciationRecord> = [
  {
    title: '期间',
    dataIndex: 'period',
    key: 'period',
    width: 100,
    sorter: (a, b) => a.period.localeCompare(b.period),
    render: (period: string) => (
      <Tag color="default">{period}</Tag>
    ),
  },
  {
    title: '资产编号',
    dataIndex: ['asset', 'assetCode'],
    key: 'assetCode',
    width: 120,
    render: (assetCode: string, record: DepreciationRecord) => (
      <Space>
        <span>{assetCode}</span>
        <Tooltip title="查看资产详情">
          <Button 
            type="link" 
            size="small" 
            icon={<LinkOutlined />}
            onClick={() => record.asset?.id && window.open(`/assets/${record.asset.id}`, '_blank')}
          />
        </Tooltip>
      </Space>
    ),
  },
  {
    title: '资产名称',
    dataIndex: ['asset', 'assetName'],
    key: 'assetName',
    ellipsis: true,
  },
  {
    title: '折旧方法',
    dataIndex: 'calculationMethod',
    key: 'calculationMethod',
    width: 130,
    render: (method: DepreciationMethod) => {
      const { text, color } = METHOD_LABELS[method] || { text: method, color: 'default' };
      return <Tag color={color}>{text}</Tag>;
    },
  },
  {
    title: '原值',
    dataIndex: 'originalValue',
    key: 'originalValue',
    width: 120,
    align: 'right',
    render: (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
  },
  {
    title: '月折旧额',
    dataIndex: 'monthlyDepreciation',
    key: 'monthlyDepreciation',
    width: 120,
    align: 'right',
    render: (value: number) => (
      <span style={{ color: '#1890ff' }}>
        ¥{value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
      </span>
    ),
  },
  {
    title: '累计折旧',
    dataIndex: 'accumulatedDepreciation',
    key: 'accumulatedDepreciation',
    width: 120,
    align: 'right',
    render: (value: number) => (
      <span style={{ color: '#fa8c16' }}>
        ¥{value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
      </span>
    ),
  },
  {
    title: '账面净值',
    dataIndex: 'currentNetValue',
    key: 'currentNetValue',
    width: 120,
    align: 'right',
    render: (value: number) => (
      <span style={{ color: value < 0 ? '#f5222d' : '#52c41a' }}>
        ¥{value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
      </span>
    ),
  },
  {
    title: '折旧日期',
    dataIndex: 'depreciationDate',
    key: 'depreciationDate',
    width: 100,
    render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
  },
];

/**
 * DepreciationSchedule - 折旧计划报表组件
 * 
 * @description 提供折旧明细列表展示、筛选、导出功能
 * 支持按资产/期间/折旧方法进行筛选
 * 
 * @example
 * ```tsx
 * // 基础用法 - 全量折旧报表
 * <DepreciationSchedule />
 * 
 * // 资产详情页关联视图
 * <DepreciationSchedule 
 *   assetId="ASSET-001"
 *   showFilters={false}
 *   onAssetNavigate={(id) => navigate(`/assets/${id}`)}
 * />
 * ```
 * 
 * @param props - DepreciationScheduleProps
 * @returns React Component
 */
const DepreciationSchedule: React.FC<DepreciationScheduleProps> = ({
  assetId,
  showFilters = true,
  showExport = true,
  enableSync = true,
  className,
  style,
  defaultFilters,
  onAssetNavigate,
  onExport,
}) => {
  // 状态管理
  const [filters, setFilters] = useState<DepreciationScheduleFilters>(() => ({
    year: dayjs().year(),
    month: dayjs().month() + 1,
    assetId: assetId,
    calculationMethod: undefined,
    ...defaultFilters,
  }));

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // 数据获取 - 使用折旧报表 Hook
  const {
    data: reportData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useDepreciationReport(filters, {
    enabled: enableSync,
    refreshInterval: 60000, // 1分钟刷新
  });

  // 如果传入了 assetId，获取该资产的折旧计划
  const {
    data: assetSchedule,
    isLoading: isScheduleLoading,
  } = useAssetDepreciationSchedule(assetId!, {
    enabled: !!assetId,
  });

  // 计算汇总数据
  const summary = useMemo<DepreciationSummary | null>(() => {
    if (assetId && assetSchedule) {
      return {
        totalDepreciation: assetSchedule.reduce((sum, r) => sum + r.monthlyDepreciation, 0),
        assetCount: 1,
        averageDepreciation: assetSchedule.length > 0 
          ? assetSchedule.reduce((sum, r) => sum + r.monthlyDepreciation, 0) / assetSchedule.length 
          : 0,
        details: assetSchedule,
      };
    }
    return reportData?.summary || null;
  }, [assetId, assetSchedule, reportData]);

  // 表格数据源
  const tableData = useMemo(() => {
    if (assetId && assetSchedule) {
      return assetSchedule;
    }
    return reportData?.records || [];
  }, [assetId, assetSchedule, reportData]);

  // 筛选条件变化处理
  const handleFilterChange = useCallback((key: keyof DepreciationScheduleFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // 重置筛选
  const handleReset = useCallback(() => {
    setFilters({
      year: dayjs().year(),
      month: dayjs().month() + 1,
      assetId: undefined,
      calculationMethod: undefined,
    });
    setSelectedRowKeys([]);
  }, []);

  // 导出选中记录
  const handleExport = useCallback(async () => {
    if (!showExport) return;
    
    setIsExporting(true);
    try {
      const dataToExport = selectedRowKeys.length > 0
        ? tableData.filter(r => selectedRowKeys.includes(r.id))
        : tableData;
      
      if (onExport) {
        onExport(dataToExport);
      } else {
        // 默认导出逻辑：CSV 格式
        const headers = ['期间', '资产编号', '资产名称', '折旧方法', '原值', '月折旧额', '累计折旧', '账面净值'];
        const rows = dataToExport.map(r => [
          r.period,
          r.asset?.assetCode || '',
          r.asset?.assetName || '',
          r.calculationMethod,
          r.originalValue,
          r.monthlyDepreciation,
          r.accumulatedDepreciation,
          r.currentNetValue,
        ]);
        
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `depreciation_report_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsExporting(false);
    }
  }, [selectedRowKeys, tableData, showExport, onExport]);

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  // 筛选器内容
  const renderFilters = () => {
    if (!showFilters) return null;

    return (
      <Card size="small" className="mb-4">
        <Space wrap size="middle">
          {/* 年度选择 */}
          <div>
            <span className="mr-2">年度:</span>
            <Select
              value={filters.year}
              onChange={(value) => handleFilterChange('year', value)}
              style={{ width: 120 }}
              options={Array.from({ length: 10 }, (_, i) => dayjs().year() - i)
                .map(year => ({ value: year, label: `${year}年` }))}
            />
          </div>

          {/* 月份选择 */}
          <div>
            <span className="mr-2">月份:</span>
            <Select
              value={filters.month}
              onChange={(value) => handleFilterChange('month', value)}
              style={{ width: 100 }}
              options={Array.from({ length: 12 }, (_, i) => i + 1)
                .map(month => ({ value: month, label: `${month}月` }))}
            />
          </div>

          {/* 折旧方法筛选 */}
          <div>
            <span className="mr-2">折旧方法:</span>
            <Select
              value={filters.calculationMethod}
              onChange={(value) => handleFilterChange('calculationMethod', value)}
              style={{ width: 150 }}
              allowClear
              placeholder="全部方法"
              options={[
                { value: 'straight_line', label: '直线法' },
                { value: 'double_declining', label: '双倍余额递减法' },
              ]}
            />
          </div>

          {/* 操作按钮 */}
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => refetch()}
              loading={isRefetching}
            >
              刷新
            </Button>
            <Button 
              icon={<FilterOutlined />}
              onClick={handleReset}
            >
              重置
            </Button>
          </Space>
        </Space>
      </Card>
    );
  };

  // 汇总信息卡片
  const renderSummaryCards = () => {
    if (!summary) return null;

    return (
      <div className="grid grid-cols-4 gap-4 mb-4">
        <Card size="small">
          <div className="text-gray-400 text-sm">本月折旧总额</div>
          <div className="text-xl font-bold text-blue-600">
            ¥{summary.totalDepreciation.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
          </div>
        </Card>
        <Card size="small">
          <div className="text-gray-400 text-sm">资产数量</div>
          <div className="text-xl font-bold">
            {summary.assetCount}
          </div>
        </Card>
        <Card size="small">
          <div className="text-gray-400 text-sm">平均月折旧</div>
          <div className="text-xl font-bold text-purple-600">
            ¥{summary.averageDepreciation.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
          </div>
        </Card>
        <Card size="small">
          <div className="text-gray-400 text-sm">记录数量</div>
          <div className="text-xl font-bold">
            {tableData.length}
          </div>
        </Card>
      </div>
    );
  };

  // 资产详情页视图头部
  const renderAssetDetailHeader = () => {
    if (!assetId || !assetSchedule?.length) return null;

    const firstRecord = assetSchedule[0];
    return (
      <Card size="small" className="mb-4 bg-blue-50">
        <Space>
          <CalculatorOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <div>
            <div className="font-medium">
              {firstRecord.asset?.assetName || '资产折旧计划'}
            </div>
            <div className="text-gray-400 text-sm">
              资产编号: {firstRecord.asset?.assetCode} | 
              折旧方法: {METHOD_LABELS[firstRecord.calculationMethod as DepreciationMethod]?.text}
            </div>
          </div>
        </Space>
      </Card>
    );
  };

  // 空状态展示
  if (error) {
    return (
      <Card className={className} style={style}>
        <Empty 
          description={
            <span className="text-red-500">
              加载折旧数据失败: {error.message}
            </span>
          }
        >
          <Button type="primary" onClick={() => refetch()}>
            重试
          </Button>
        </Empty>
      </Card>
    );
  }

  return (
    <div className={className} style={style} data-testid="depreciation-report-container">
      {/* 资产详情页头部 */}
      {renderAssetDetailHeader()}

      {/* 筛选器 */}
      {renderFilters()}

      {/* 汇总卡片 */}
      {renderSummaryCards()}

      {/* 工具栏 */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-gray-500">
          {assetId ? '折旧计划明细' : '折旧报表'}
        </div>
        <Space>
          {selectedRowKeys.length > 0 && (
            <span className="text-gray-400">
              已选择 {selectedRowKeys.length} 条记录
            </span>
          )}
          {showExport && (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              loading={isExporting}
            >
              导出{selectedRowKeys.length > 0 ? '选中' : '全部'}
            </Button>
          )}
        </Space>
      </div>

      {/* 数据表格 */}
      <Table
        data-testid="depreciation-table"
        columns={DEPRECIATION_COLUMNS}
        dataSource={tableData}
        rowKey="id"
        loading={isLoading || isScheduleLoading}
        rowSelection={rowSelection}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
        scroll={{ x: 1200 }}
        size="middle"
      />

      {/* 折旧明细列表 - 用于资产详情页关联视图 */}
      {assetId && assetSchedule && (
        <div data-testid="depreciation-list" className="mt-4">
          <div className="text-gray-500 font-medium mb-2">折旧明细列表</div>
          <ul className="list-disc pl-5">
            {assetSchedule.slice(0, 12).map((record) => (
              <li key={record.id} className="text-sm py-1">
                {record.period}: 月折旧额 ¥{record.monthlyDepreciation.toFixed(2)}, 
                累计折旧 ¥{record.accumulatedDepreciation.toFixed(2)}, 
                账面净值 ¥{record.currentNetValue.toFixed(2)}
              </li>
            ))}
            {assetSchedule.length > 12 && (
              <li className="text-gray-400">
                ... 还有 {assetSchedule.length - 12} 条记录
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DepreciationSchedule;

/**
 * 使用示例
 * 
 * 1. 折旧报表页面:
 * ```tsx
 * <DepreciationSchedule 
 *   showFilters={true}
 *   showExport={true}
 *   enableSync={true}
 * />
 * ```
 * 
 * 2. 资产详情页关联视图:
 * ```tsx
 * <DepreciationSchedule 
 *   assetId={asset.id}
 *   showFilters={false}
 *   showExport={false}
 *   onAssetNavigate={(id) => history.push(`/assets/${id}`)}
 * />
 * ```
 * 
 * 3. 自定义筛选:
 * ```tsx
 * <DepreciationSchedule 
 *   defaultFilters={{
 *     year: 2024,
 *     month: 12,
 *     calculationMethod: 'straight_line'
 *   }}
 * />
 * ```
 */