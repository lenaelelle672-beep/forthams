import React, { useState, useMemo } from 'react';

/**
 * LogTable 组件属性接口
 * @description 定义日志表格组件接收的数据和回调函数
 */
export interface LogTableProps {
  /** 日志数据列表 */
  logs: LogEntry[];
  /** 总日志条数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 页码变化回调函数 */
  onPageChange: (page: number) => void;
  /** 每页条数变化回调函数 */
  onPageSizeChange: (pageSize: number) => void;
  /** 加载状态 */
  loading?: boolean;
  /** 错误信息 */
  error?: string | null;
}

/**
 * 日志条目类型
 * @description 表示单条操作日志的数据结构
 */
export interface LogEntry {
  id: string;
  timestamp: string;
  action: ActionType;
  description: string;
  operator_name: string;
  status: LogStatus;
  resource_type: string;
  resource_id: string;
  ip_address: string;
}

/**
 * 操作类型枚举
 * @description 定义支持的操作类型
 */
export type ActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'READ';

/**
 * 日志状态枚举
 * @description 定义操作结果状态
 */
export type LogStatus = 'SUCCESS' | 'FAILURE';

/**
 * 响应数据结构
 * @description API 返回的日志列表数据结构
 */
export interface LogListResponse {
  items: LogEntry[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * LogTable 组件
 * @description 渲染日志列表表格，支持分页和排序
 * @param props - LogTableProps
 * @returns React 组件
 */
export const LogTable: React.FC<LogTableProps> = ({
  logs,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  loading = false,
  error = null,
}) => {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof LogEntry | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  /**
   * 处理排序逻辑
   * @param key - 排序列的键名
   */
  const handleSort = (key: keyof LogEntry) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  /**
   * 排序后的日志数据
   */
  const sortedLogs = useMemo(() => {
    if (!sortConfig.key) return logs;

    return [...logs].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });
  }, [logs, sortConfig]);

  /**
   * 计算总页数
   */
  const totalPages = Math.ceil(total / pageSize);

  /**
   * 处理页码变化
   * @param newPage - 新的页码
   */
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      onPageChange(newPage);
    }
  };

  /**
   * 格式化时间戳
   * @param timestamp - ISO 格式时间戳
   * @returns 格式化后的时间字符串
   */
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  /**
   * 获取状态标签样式类名
   * @param status - 日志状态
   * @returns CSS 类名字符串
   */
  const getStatusBadgeClass = (status: LogStatus): string => {
    return status === 'SUCCESS'
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';
  };

  /**
   * 获取操作类型中文描述
   * @param action - 操作类型
   * @returns 中文描述字符串
   */
  const getActionLabel = (action: ActionType): string => {
    const labels: Record<ActionType, string> = {
      CREATE: '创建',
      UPDATE: '修改',
      DELETE: '删除',
      READ: '查询',
    };
    return labels[action] || action;
  };

  /**
   * 渲染排序图标
   * @param columnKey - 列键名
   * @returns React 节点
   */
  const renderSortIcon = (columnKey: keyof LogEntry) => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    return (
      <span className="text-blue-600 ml-1">
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  /**
   * 渲染加载状态
   */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  /**
   * 渲染错误状态
   */
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500 text-center">
          <p className="font-semibold">加载失败</p>
          <p className="text-sm text-gray-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  /**
   * 渲染空状态
   */
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <svg
          className="w-16 h-16 text-slate-600 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p className="text-gray-400 text-center">暂无日志记录</p>
        <p className="text-gray-400 text-sm mt-1">尝试调整筛选条件</p>
      </div>
    );
  }

  return (
    <div className="log-table-container">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#1e3a5f]">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-blue-50"
                onClick={() => handleSort('timestamp')}
              >
                时间 {renderSortIcon('timestamp')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-blue-50"
                onClick={() => handleSort('action')}
              >
                操作类型 {renderSortIcon('action')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
              >
                操作描述
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-blue-50"
                onClick={() => handleSort('operator_name')}
              >
                操作人 {renderSortIcon('operator_name')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-blue-50"
                onClick={() => handleSort('status')}
              >
                状态 {renderSortIcon('status')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
              >
                资源类型
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
              >
                资源ID
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
              >
                IP 地址
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#1e3a5f]">
            {sortedLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatTimestamp(log.timestamp)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      log.action === 'CREATE'
                        ? 'bg-blue-100 text-blue-800'
                        : log.action === 'UPDATE'
                        ? 'bg-yellow-100 text-yellow-800'
                        : log.action === 'DELETE'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-50 text-gray-800'
                    }`}
                  >
                    {getActionLabel(log.action)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">
                  {log.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {log.operator_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadgeClass(
                      log.status
                    )}`}
                  >
                    {log.status === 'SUCCESS' ? '成功' : '失败'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {log.resource_type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                  {log.resource_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                  {log.ip_address}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页控件 */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
        <div className="flex items-center text-sm text-gray-400">
          <span>显示 {(page - 1) * pageSize + 1} 至 </span>
          <span>{Math.min(page * pageSize, total)} </span>
          <span>条，共 {total} 条</span>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={20}>20 条/页</option>
            <option value={50}>50 条/页</option>
            <option value={100}>100 条/页</option>
          </select>

          <nav className="inline-flex rounded-md shadow-sm">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-200 rounded-l-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <span className="px-3 py-1 border-t border-b border-gray-200 text-sm font-medium text-gray-700 bg-white">
              第 {page} 页，共 {totalPages} 页
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1 border border-l-0 border-gray-200 rounded-r-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default LogTable;