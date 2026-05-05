/**
 * AuditLogModule - 审计日志模块
 * 
 * 功能说明：
 * - 展示资产关联的审计日志列表
 * - 支持筛选（操作类型、时间范围、操作人）
 * - 支持审计记录详情展开
 * - 高亮显示 @Auditable 注解标记的字段变更
 * 
 * 依赖服务：
 * - AuditService: 获取审计日志数据
 * - useAuditLogs: 审计日志数据 Hook
 * - useAuditableFields: @Auditable 字段可视化 Hook
 * 
 * @module AuditLogModule
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Space, Typography, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';

import { AuditTable } from './AuditTable';
import { AuditFilter, type AuditFilterValues } from './AuditFilter';
import { AuditDetailDrawer } from './AuditDetailDrawer';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { useAuditableFields } from '@/hooks/useAuditableFields';
import type { AuditLogEntry, AuditLogResponse, AuditFilterParams } from '@/types/audit.types';

const { Title, Text } = Typography;

export interface AuditLogModuleProps {
  /** 资产 ID */
  assetId: string;
  /** 是否显示筛选器 */
  showFilter?: boolean;
  /** 是否显示刷新按钮 */
  showRefresh?: boolean;
  /** 默认每页条数 */
  defaultPageSize?: number;
  /** 自定义类名 */
  className?: string;
  /** 加载状态外部控制 */
  externalLoading?: boolean;
  /** 数据加载完成回调 */
  onDataLoaded?: (data: AuditLogEntry[]) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

/**
 * 审计日志模块主组件
 * 
 * @param props - 组件属性
 * @returns 审计日志模块组件
 * 
 * @example
 * ```tsx
 * <AuditLogModule 
 *   assetId="asset-123" 
 *   showFilter={true}
 *   onDataLoaded={(data) => console.log('Loaded', data)}
 * />
 * ```
 */
export const AuditLogModule: React.FC<AuditLogModuleProps> = ({
  assetId,
  showFilter = true,
  showRefresh = true,
  defaultPageSize = 20,
  className,
  externalLoading,
  onDataLoaded,
  onError,
}) => {
  // ============================================
  // 状态管理
  // ============================================
  
  /** 筛选参数状态 */
  const [filterParams, setFilterParams] = useState<AuditFilterParams>({
    operationType: undefined,
    startDate: undefined,
    endDate: undefined,
    operator: undefined,
  });

  /** 分页状态 */
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: defaultPageSize,
  });

  /** 排序状态 */
  const [sorter, setSorter] = useState<SorterResult<AuditLogEntry> | undefined>(undefined);

  /** 详情抽屉状态 */
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogEntry | null>(null);

  /** 消息提示实例 */
  const [messageApi, contextHolder] = message.useMessage();

  // ============================================
  // 数据 Hook
  // ============================================
  
  /** 审计日志数据 Hook */
  const {
    data: auditLogData,
    loading: auditLoading,
    error: auditError,
    refresh: refreshAuditLogs,
  } = useAuditLogs(assetId, {
    ...filterParams,
    page: pagination.current,
    pageSize: pagination.pageSize,
    sortField: sorter?.field as string | undefined,
    sortOrder: sorter?.order as 'ascend' | 'descend' | undefined,
  });

  /** @Auditable 字段可视化 Hook */
  const { getAuditableHighlight, formatFieldChange } = useAuditableFields();

  // ============================================
  // 副作用处理
  // ============================================
  
  /** 错误处理 */
  React.useEffect(() => {
    if (auditError) {
      messageApi.error(`加载审计日志失败: ${auditError.message}`);
      onError?.(auditError);
    }
  }, [auditError, messageApi, onError]);

  /** 数据加载完成回调 */
  React.useEffect(() => {
    if (auditLogData?.data) {
      onDataLoaded?.(auditLogData.data);
    }
  }, [auditLogData, onDataLoaded]);

  // ============================================
  // 事件处理
  // ============================================
  
  /**
   * 筛选参数变更处理
   * @param values - 筛选表单值
   */
  const handleFilterChange = useCallback((values: AuditFilterValues) => {
    setFilterParams({
      operationType: values.operationType,
      startDate: values.dateRange?.[0],
      endDate: values.dateRange?.[1],
      operator: values.operator,
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  }, []);

  /**
   * 筛选重置处理
   */
  const handleFilterReset = useCallback(() => {
    setFilterParams({
      operationType: undefined,
      startDate: undefined,
      endDate: undefined,
      operator: undefined,
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  }, []);

  /**
   * 分页变更处理
   * @param page - 当前页码
   * @param pageSize - 每页条数
   */
  const handlePageChange = useCallback((page: number, pageSize: number) => {
    setPagination({ current: page, pageSize });
  }, []);

  /**
   * 排序变更处理
   * @param sorter - 排序结果
   */
  const handleSorterChange = useCallback((
    sorter: SorterResult<AuditLogEntry> | SorterResult<AuditLogEntry>[]
  ) => {
    const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    setSorter(singleSorter);
  }, []);

  /**
   * 刷新处理
   */
  const handleRefresh = useCallback(() => {
    refreshAuditLogs();
    messageApi.success('审计日志已刷新');
  }, [refreshAuditLogs, messageApi]);

  /**
   * 查看详情处理
   * @param record - 审计日志记录
   */
  const handleViewDetail = useCallback((record: AuditLogEntry) => {
    setSelectedAuditLog(record);
    setDetailDrawerVisible(true);
  }, []);

  /**
   * 关闭详情抽屉处理
   */
  const handleCloseDetailDrawer = useCallback(() => {
    setDetailDrawerVisible(false);
    setSelectedAuditLog(null);
  }, []);

  // ============================================
  // 派生数据
  // ============================================
  
  /** 表格数据源（包含高亮处理） */
  const tableDataSource = useMemo(() => {
    if (!auditLogData?.data) return [];
    
    return auditLogData.data.map(log => ({
      ...log,
      changes: log.changes?.map(change => ({
        ...change,
        ...getAuditableHighlight(change),
      })),
    }));
  }, [auditLogData?.data, getAuditableHighlight]);

  /** 合并加载状态 */
  const isLoading = externalLoading ?? auditLoading;

  // ============================================
  // 渲染
  // ============================================
  
  return (
    <div className={`audit-log-module ${className ?? ''}`}>
      {contextHolder}
      
      {/* 标题栏 */}
      <div className="audit-log-module__header">
        <Space align="center" size="middle">
          <Title level={5} style={{ margin: 0 }}>
            审计日志
          </Title>
          {auditLogData?.pagination && (
            <Text type="secondary">
              共 {auditLogData.pagination.total} 条记录
            </Text>
          )}
        </Space>
        
        {showRefresh && (
          <a onClick={handleRefresh} title="刷新">
            <ReloadOutlined spin={isLoading} />
          </a>
        )}
      </div>

      {/* 筛选器 */}
      {showFilter && (
        <AuditFilter
          initialValues={filterParams}
          onFilterChange={handleFilterChange}
          onReset={handleFilterReset}
          loading={isLoading}
        />
      )}

      {/* 审计日志表格 */}
      <AuditTable
        dataSource={tableDataSource}
        loading={isLoading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: auditLogData?.pagination?.total ?? 0,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
        }}
        onChange={(
          paginationConfig,
          filters,
          sorterConfig
        ) => {
          if (paginationConfig.current && paginationConfig.pageSize) {
            handlePageChange(
              paginationConfig.current as number,
              paginationConfig.pageSize as number
            );
          }
          handleSorterChange(sorterConfig as SorterResult<AuditLogEntry>);
        }}
        onViewDetail={handleViewDetail}
        formatFieldChange={formatFieldChange}
      />

      {/* 详情抽屉 */}
      <AuditDetailDrawer
        visible={detailDrawerVisible}
        auditLog={selectedAuditLog}
        onClose={handleCloseDetailDrawer}
        formatFieldChange={formatFieldChange}
        getAuditableHighlight={getAuditableHighlight}
      />
    </div>
  );
};

/**
 * 带错误边界的审计日志模块
 * 
 * @example
 * ```tsx
 * <AuditLogModuleWithErrorBoundary assetId="asset-123" />
 * ```
 */
export class AuditLogModuleWithErrorBoundary extends React.Component<
  AuditLogModuleProps,
  { hasError: boolean; error: Error | null }
> {
  constructor(props: AuditLogModuleProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AuditLogModule Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Title level={4}>审计日志加载失败</Title>
            <Text type="secondary">
              {this.state.error?.message ?? '未知错误'}
            </Text>
            <br />
            <a onClick={() => window.location.reload()}>
              点击刷新页面
            </a>
          </div>
        </Card>
      );
    }

    return <AuditLogModule {...this.props} />;
  }
}

export default AuditLogModule;