/**
 * ExpiringWarningList Component
 *
 * 显示即将到期资产的预警列表组件。
 * 用于仪表板页面，展示30天内即将到期的资产信息。
 *
 * @module ExpiringWarningList
 * @version 1.0.0
 * @see SWARM-DASH-001
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Button, Space, Empty, Spin, Alert } from 'antd';
import { WarningOutlined, ReloadOutlined } from '@ant-design/icons';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';

import { dashboardService } from '@/services/dashboardService';

import styles from './ExpiringWarningList.module.css';

interface ExpiringWarningItem {
  /** 资产ID */
  assetId: string;
  /** 资产名称 */
  assetName: string;
  /** 资产分类 */
  category: string;
  /** 资产状态 */
  status: string;
  /** 到期日期 */
  expireDate: string;
  /** 剩余天数 */
  remainingDays: number;
  /** 预警等级 */
  warningLevel: 'critical' | 'warning' | 'info';
}

interface ExpiringWarningListProps {
  /** 自定义类名 */
  className?: string;
  /** 默认显示的天数范围 */
  defaultDays?: number;
  /** 最大显示数量 */
  maxCount?: number;
  /** 点击资产项的回调函数 */
  onAssetClick?: (assetId: string) => void;
  /** 是否显示刷新按钮 */
  showRefresh?: boolean;
  /** 是否显示分页 */
  showPagination?: boolean;
  /** 每页显示条数 */
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 10;

/**
 * 获取预警等级对应的颜色标签
 *
 * @param level - 预警等级
 * @returns 标签颜色类型
 */
const getWarningLevelColor = (level: string): string => {
  switch (level) {
    case 'critical':
      return 'red';
    case 'warning':
      return 'orange';
    case 'info':
      return 'blue';
    default:
      return 'default';
  }
};

/**
 * 获取预警等级对应的中文文本
 *
 * @param level - 预警等级
 * @returns 预警等级中文描述
 */
const getWarningLevelText = (level: string): string => {
  switch (level) {
    case 'critical':
      return '紧急';
    case 'warning':
      return '预警';
    case 'info':
      return '提示';
    default:
      return '未知';
  }
};

/**
 * 格式化日期显示
 *
 * @param dateString - 日期字符串
 * @returns 格式化后的日期字符串
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

/**
 * ExpiringWarningList 组件
 *
 * 用于展示即将到期的资产预警列表，支持：
 * - 数据加载和刷新
 * - 分页显示
 * - 预警等级显示
 * - 跳转到资产详情
 */
const ExpiringWarningList: React.FC<ExpiringWarningListProps> = ({
  className = '',
  defaultDays = 30,
  maxCount = 100,
  onAssetClick,
  showRefresh = true,
  showPagination = true,
  pageSize = DEFAULT_PAGE_SIZE,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [warningList, setWarningList] = useState<ExpiringWarningItem[]>([]);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: pageSize,
    total: 0,
    showSizeChanger: true,
    showTotal: (total: number) => `共 ${total} 条预警`,
    pageSizeOptions: ['5', '10', '20', '50'],
  });

  /**
   * 获取预警列表数据
   *
   * @returns Promise<ExpiringWarningItem[]>
   */
  const fetchWarningList = useCallback(async (): Promise<ExpiringWarningItem[]> => {
    try {
      const response = await dashboardService.getExpiringAssets({
        days: defaultDays,
        limit: maxCount,
      });
      return response.data || [];
    } catch (err) {
      console.error('获取预警列表失败:', err);
      throw err;
    }
  }, [defaultDays, maxCount]);

  /**
   * 加载数据
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWarningList();
      setWarningList(data);
      setPagination((prev) => ({
        ...prev,
        total: data.length,
      }));
    } catch (err) {
      setError('加载预警数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [fetchWarningList]);

  /**
   * 处理刷新按钮点击
   */
  const handleRefresh = useCallback(() => {
    loadData();
  }, [loadData]);

  /**
   * 处理表格变化
   */
  const handleTableChange = useCallback(
    (
      pag: TablePaginationConfig,
      filters: Record<string, FilterValue | null>,
      sorter: SorterResult<ExpiringWarningItem> | SorterResult<ExpiringWarningItem>[]
    ) => {
      setPagination((prev) => ({
        ...prev,
        current: pag.current || 1,
        pageSize: pag.pageSize || prev.pageSize,
      }));
    },
    []
  );

  /**
   * 处理资产项点击
   */
  const handleAssetClick = useCallback(
    (assetId: string) => {
      if (onAssetClick) {
        onAssetClick(assetId);
      }
    },
    [onAssetClick]
  );

  /**
   * 初始加载数据
   */
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * 表格列定义
   */
  const columns: TableColumnsType<ExpiringWarningItem> = [
    {
      title: '资产名称',
      dataIndex: 'assetName',
      key: 'assetName',
      width: 200,
      fixed: 'left',
      render: (name: string, record: ExpiringWarningItem) => (
        <Button
          type="link"
          onClick={() => handleAssetClick(record.assetId)}
          className={styles.assetLink}
        >
          {name}
        </Button>
      ),
    },
    {
      title: '资产分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      filters: [
        { text: '服务器', value: '服务器' },
        { text: '网络设备', value: '网络设备' },
        { text: '存储设备', value: '存储设备' },
        { text: '软件许可', value: '软件许可' },
        { text: '云资源', value: '云资源' },
      ],
      onFilter: (value, record) => record.category.indexOf(value as string) === 0,
    },
    {
      title: '资产状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          '在用': { color: 'green', text: '在用' },
          '闲置': { color: 'default', text: '闲置' },
          '维修中': { color: 'orange', text: '维修中' },
          '已报废': { color: 'red', text: '已报废' },
        };
        const config = statusMap[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '到期日期',
      dataIndex: 'expireDate',
      key: 'expireDate',
      width: 140,
      sorter: (a, b) => new Date(a.expireDate).getTime() - new Date(b.expireDate).getTime(),
      render: (date: string) => formatDate(date),
    },
    {
      title: '剩余天数',
      dataIndex: 'remainingDays',
      key: 'remainingDays',
      width: 100,
      sorter: (a, b) => a.remainingDays - b.remainingDays,
      render: (days: number) => {
        if (days <= 0) {
          return <Tag color="red">已过期</Tag>;
        }
        if (days <= 7) {
          return <Tag color="red">{days} 天</Tag>;
        }
        if (days <= 30) {
          return <Tag color="orange">{days} 天</Tag>;
        }
        return <Tag color="blue">{days} 天</Tag>;
      },
    },
    {
      title: '预警等级',
      dataIndex: 'warningLevel',
      key: 'warningLevel',
      width: 100,
      filters: [
        { text: '紧急', value: 'critical' },
        { text: '预警', value: 'warning' },
        { text: '提示', value: 'info' },
      ],
      onFilter: (value, record) => record.warningLevel.indexOf(value as string) === 0,
      render: (level: string) => (
        <Tag color={getWarningLevelColor(level)} icon={<WarningOutlined />}>
          {getWarningLevelText(level)}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record: ExpiringWarningItem) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            onClick={() => handleAssetClick(record.assetId)}
          >
            查看详情
          </Button>
        </Space>
      ),
    },
  ];

  /**
   * 渲染加载状态
   */
  const renderLoadingState = () => (
    <div className={styles.loadingContainer}>
      <Spin size="large" tip="加载预警数据..." />
    </div>
  );

  /**
   * 渲染空状态
   */
  const renderEmptyState = () => (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <span className={styles.emptyText}>
          暂无即将到期的资产预警
        </span>
      }
    >
      {showRefresh && (
        <Button type="primary" onClick={handleRefresh}>
          刷新
        </Button>
      )}
    </Empty>
  );

  /**
   * 渲染错误状态
   */
  const renderErrorState = () => (
    <Alert
      message="数据加载失败"
      description={error}
      type="error"
      showIcon
      action={
        <Button size="small" onClick={handleRefresh}>
          重试
        </Button>
      }
    />
  );

  return (
    <div className={`${styles.container} ${className}`} data-testid="warning-list">
      {/* 标题栏 */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <WarningOutlined className={styles.icon} />
          <h3 className={styles.title}>到期预警</h3>
          <Tag color="orange">{warningList.length}</Tag>
        </div>
        {showRefresh && (
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            刷新
          </Button>
        )}
      </div>

      {/* 内容区域 */}
      <div className={styles.content}>
        {loading && warningList.length === 0 ? (
          renderLoadingState()
        ) : error ? (
          renderErrorState()
        ) : warningList.length === 0 ? (
          renderEmptyState()
        ) : (
          <Table
            columns={columns}
            dataSource={warningList}
            rowKey="assetId"
            loading={loading}
            pagination={
              showPagination ? pagination : false
            }
            onChange={handleTableChange}
            scroll={{ x: 860 }}
            size="middle"
          />
        )}
      </div>
    </div>
  );
};

export default ExpiringWarningList;

/**
 * 组件Props类型导出
 */
export type { ExpiringWarningItem, ExpiringWarningListProps };