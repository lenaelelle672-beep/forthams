/**
 * Operation Log Dashboard - Main Container
 * 
 * Provides an audit-compliant dashboard for viewing operation logs
 * with integrated trend visualization and filtering capabilities.
 * 
 * @module pages/OperationLogDashboard
 * @version 1.0.0
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Spin, Empty, Pagination, DatePicker, Select, Button, message } from 'antd';
import { FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { TrendChart } from './components/TrendChart';
import { OperationTypeChart } from './components/OperationTypeChart';
import { useAuditLogs, AuditLogFilter } from '../../hooks/useAuditLogs';
import type { AuditLogEntry, AuditTrendData, OperationTypeDistribution } from '../../types/audit.types';
import './OperationLogDashboard.module.css';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface OperationLogDashboardProps {
  /** Initial filter configuration */
  initialFilter?: Partial<AuditLogFilter>;
  /** Enable auto-refresh */
  autoRefresh?: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
}

/**
 * Operation Log Dashboard Component
 * 
 * Renders a comprehensive dashboard view for operation logs including:
 * - Paginated log table
 * - Operation type distribution chart
 * - Trend visualization chart
 * 
 * @param props - Component props
 * @returns React component
 */
export const OperationLogDashboard: React.FC<OperationLogDashboardProps> = ({
  initialFilter = {},
  autoRefresh = false,
  refreshInterval = 30000,
}) => {
  const { t } = useTranslation();
  
  // State management
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [operationType, setOperationType] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  /**
   * Constructs filter object from current state
   * @returns AuditLogFilter - Filter configuration for API
   */
  const buildFilter = useCallback((): AuditLogFilter => {
    return {
      ...initialFilter,
      page,
      page_size: pageSize,
      start_date: dateRange?.[0] || undefined,
      end_date: dateRange?.[1] || undefined,
      operation_type: operationType || undefined,
    };
  }, [initialFilter, page, pageSize, dateRange, operationType]);

  // Fetch logs with filter
  const {
    data: logsData,
    isLoading,
    error,
    refetch,
  } = useAuditLogs(buildFilter());

  // Aggregate data for charts
  const trendData = useMemo((): AuditTrendData[] => {
    if (!logsData?.items) return [];
    // Group by date and aggregate counts
    const dateMap = new Map<string, AuditTrendData>();
    
    logsData.items.forEach((log) => {
      const dateKey = log.created_at?.split('T')[0] || 'unknown';
      const existing = dateMap.get(dateKey) || { date: dateKey, count: 0 };
      existing.count += 1;
      dateMap.set(dateKey, existing);
    });
    
    return Array.from(dateMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days
  }, [logsData]);

  const typeDistribution = useMemo((): OperationTypeDistribution[] => {
    if (!logsData?.items) return [];
    const typeMap = new Map<string, number>();
    
    logsData.items.forEach((log) => {
      const type = log.action_type || 'UNKNOWN';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });
    
    return Array.from(typeMap.entries()).map(([type, count]) => ({
      type,
      count,
    }));
  }, [logsData]);

  /**
   * Handles manual refresh action
   * @returns Promise<void>
   */
  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await refetch();
      message.success(t('dashboard.refreshSuccess'));
    } catch (err) {
      message.error(t('dashboard.refreshFailed'));
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, t]);

  /**
   * Handles date range change
   * @param dates - Selected date range
   */
  const handleDateRangeChange = useCallback((dates: [string, string] | null): void => {
    setDateRange(dates);
    setPage(1); // Reset to first page on filter change
  }, []);

  /**
   * Handles operation type filter change
   * @param type - Selected operation type
   */
  const handleOperationTypeChange = useCallback((type: string | null): void => {
    setOperationType(type);
    setPage(1);
  }, []);

  /**
   * Handles pagination change
   * @param newPage - New page number
   * @param newSize - New page size
   */
  const handlePageChange = useCallback((newPage: number, newSize: number): void => {
    setPage(newPage);
    setPageSize(newSize);
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;
    
    const intervalId = setInterval(() => {
      refetch();
    }, refreshInterval);
    
    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, refetch]);

  /**
   * Renders the log table rows
   * @returns React nodes
   */
  const renderLogRows = useMemo(() => {
    if (!logsData?.items?.length) return null;
    
    return logsData.items.map((log: AuditLogEntry) => (
      <tr key={log.id} data-testid="log-row">
        <td>{new Date(log.created_at).toLocaleString()}</td>
        <td>
          <span className={`operation-type-badge type-${log.action_type?.toLowerCase()}`}>
            {log.action_type}
          </span>
        </td>
        <td>{log.operator_name || log.operator_id || 'N/A'}</td>
        <td>{log.target_type}: {log.target_id}</td>
        <td data-testid="log-description">{log.description || '-'}</td>
      </tr>
    ));
  }, [logsData]);

  /**
   * Renders empty state when no logs available
   * @returns React component
   */
  const renderEmptyState = useMemo(() => (
    <Empty 
      data-testid="empty-state"
      description={t('dashboard.noLogsFound')}
      image={Empty.PRESENTED_IMAGE_SIMPLE}
    />
  ), [t]);

  if (error) {
    return (
      <Card className="operation-log-dashboard error-state">
        <Empty 
          description={t('dashboard.loadError')}
        />
      </Card>
    );
  }

  return (
    <div className="operation-log-dashboard" data-testid="audit-dashboard">
      {/* Header Section */}
      <div className="dashboard-header">
        <h1 data-testid="page-title">{t('dashboard.title')}</h1>
        <Button 
          icon={<ReloadOutlined spin={isRefreshing} />}
          onClick={handleRefresh}
          loading={isRefreshing}
        >
          {t('dashboard.refresh')}
        </Button>
      </div>

      {/* Filter Section */}
      <Card className="filter-section" data-testid="filter-bar">
        <div className="filter-row">
          <div className="filter-item">
            <label>{t('dashboard.dateRange')}</label>
            <RangePicker 
              onChange={(dates) => handleDateRangeChange(
                dates ? [dates[0]?.format('YYYY-MM-DD') || '', dates[1]?.format('YYYY-MM-DD') || ''] as [string, string] : null
              )}
              allowClear
            />
          </div>
          <div className="filter-item">
            <label>{t('dashboard.operationType')}</label>
            <Select
              placeholder={t('dashboard.selectType')}
              value={operationType}
              onChange={handleOperationTypeChange}
              allowClear
              style={{ width: 200 }}
            >
              <Option value="CREATE">CREATE</Option>
              <Option value="UPDATE">UPDATE</Option>
              <Option value="DELETE">DELETE</Option>
              <Option value="READ">READ</Option>
              <Option value="EXPORT">EXPORT</Option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Charts Section */}
      <div className="charts-section" data-testid="chart-section">
        <Card className="chart-card">
          <h3 data-testid="trend-chart-title">{t('dashboard.trendTitle')}</h3>
          {isLoading ? (
            <Spin size="large" />
          ) : (
            <TrendChart data={trendData} />
          )}
        </Card>
        <Card className="chart-card">
          <h3 data-testid="operation-type-chart">{t('dashboard.typeDistributionTitle')}</h3>
          {isLoading ? (
            <Spin size="large" />
          ) : (
            <OperationTypeChart data={typeDistribution} />
          )}
        </Card>
      </div>

      {/* Log List Section */}
      <Card className="log-list-section" data-testid="log-list-section">
        <div className="section-header">
          <h3>{t('dashboard.logListTitle')}</h3>
          <span className="total-count">
            {t('dashboard.totalRecords')}: {logsData?.total || 0}
          </span>
        </div>
        
        {isLoading ? (
          <div className="loading-container">
            <Spin size="large" tip={t('dashboard.loading')} />
          </div>
        ) : logsData?.items?.length ? (
          <>
            <div className="table-wrapper" data-testid="operation-log-table">
              <table className="log-table">
                <thead>
                  <tr>
                    <th>{t('dashboard.columns.time')}</th>
                    <th>{t('dashboard.columns.type')}</th>
                    <th>{t('dashboard.columns.operator')}</th>
                    <th>{t('dashboard.columns.target')}</th>
                    <th>{t('dashboard.columns.description')}</th>
                  </tr>
                </thead>
                <tbody>
                  {renderLogRows}
                </tbody>
              </table>
            </div>
            
            <div className="pagination-wrapper" data-testid="pagination">
              <Pagination
                current={page}
                pageSize={pageSize}
                total={logsData?.total || 0}
                onChange={handlePageChange}
                showSizeChanger
                showTotal={(total) => `${total} ${t('dashboard.records')}`}
              />
            </div>
          </>
        ) : (
          renderEmptyState
        )}
      </Card>
    </div>
  );
};

export default OperationLogDashboard;