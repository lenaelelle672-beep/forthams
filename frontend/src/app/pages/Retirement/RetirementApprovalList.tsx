/**
 * 资产退役审批列表组件
 * 
 * 功能说明：
 * - 展示待审批的资产退役申请列表
 * - 支持审批操作（批准/驳回）
 * - 支持状态筛选和搜索
 * - 显示申请详情和审批历史
 * 
 * @_SWARM-502 资产报废/退役流程
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Eye,
  Search,
  Filter,
  Clock,
  AlertCircle,
  Trash2,
  X,
} from 'lucide-react';
import dayjs from 'dayjs';

import { useApprovalPermission } from '@/composables/useApprovalPermission';
import { useApprovalBinding } from '@/composables/useApprovalBinding';
import { approvalService } from '@/services/approvalService';
import { retirementService } from '@/services/retirementService';
import type { RetirementApplication, RetirementStatus, ApprovalRecord } from '../types/retirement.types';

// ==================== 类型定义 ====================

/** 筛选器状态 */
interface FilterState {
  status: RetirementStatus | 'ALL';
  department: string | 'ALL';
  dateRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
  keyword: string;
}

/** 审批操作表单 */
interface ApprovalFormValues {
  action: 'approve' | 'reject';
  comment: string;
  effectiveDate?: string;
}

// ==================== 常量配置 ====================

/** 状态配置映射 — Tailwind badge styles */
const STATUS_CONFIG: Record<
  RetirementStatus,
  { bg: string; label: string; description: string }
> = {
  DRAFT: { bg: 'bg-gray-100 text-gray-800', label: '草稿', description: '申请人正在编辑' },
  PENDING_APPROVAL: {
    bg: 'bg-blue-100 text-blue-800',
    label: '待审批',
    description: '等待审批人审核',
  },
  APPROVED: { bg: 'bg-green-100 text-green-800', label: '已批准', description: '审批通过，待执行' },
  REJECTED: { bg: 'bg-red-100 text-red-800', label: '已驳回', description: '审批未通过' },
  CANCELLED: { bg: 'bg-gray-100 text-gray-800', label: '已撤回', description: '申请人主动撤回' },
  RETIRED: { bg: 'bg-green-100 text-green-800', label: '已退役', description: '资产已完成退役' },
};

/** 状态选项 */
const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, config]) => ({
  value: value as RetirementStatus,
  label: config.label,
}));

// ==================== 组件实现 ====================

/**
 * 资产退役审批列表组件
 * 
 * @description
 * 展示系统中所有资产退役申请，支持审批操作和状态筛选。
 * 使用 Tailwind CSS + 原生 HTML 元素替代 antd。
 * 
 * @example
 * ```tsx
 * <RetirementApprovalList />
 * ```
 */
export const RetirementApprovalList: React.FC = () => {
  // ==================== State 管理 ====================
  const [applications, setApplications] = useState<RetirementApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 筛选状态
  const [filters, setFilters] = useState<FilterState>({
    status: 'ALL',
    department: 'ALL',
    dateRange: null,
    keyword: '',
  });

  // 详情弹窗
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [currentApplication, setCurrentApplication] = useState<RetirementApplication | null>(null);

  // 审批弹窗
  const [approvalModalVisible, setApprovalModalVisible] = useState<boolean>(false);
  const [approvalLoading, setApprovalLoading] = useState<boolean>(false);

  // Simple form state (replaces antd Form)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalComment, setApprovalComment] = useState('');
  const [approvalEffectiveDate, setApprovalEffectiveDate] = useState('');
  const [approvalCommentError, setApprovalCommentError] = useState('');

  // Notification state (replaces antd message)
  const [notice, setNotice] = useState<string | null>(null);

  // Confirm batch dialog
  const [confirmBatchVisible, setConfirmBatchVisible] = useState(false);

  // ==================== Hooks ====================
  const navigate = useNavigate();
  const { canApprove, canView, userInfo } = useApprovalPermission();
  const { bindApprovalContext, unbindApprovalContext } = useApprovalBinding();

  // ==================== 数据加载 ====================

  /**
   * 加载退役申请列表
   */
  const loadApplications = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        status: filters.status === 'ALL' ? undefined : filters.status,
        department: filters.department === 'ALL' ? undefined : filters.department,
        keyword: filters.keyword || undefined,
        startDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
      };

      const response = await retirementService.getApplications(params);
      setApplications(response.items || []);
      setPagination(prev => ({
        ...prev,
        total: response.total || 0,
      }));
    } catch (error) {
      setNotice('加载申请列表失败');
      console.error('Load applications error:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  /**
   * 初始化加载
   */
  useEffect(() => {
    if (canView) {
      loadApplications();
    }
  }, [canView, loadApplications]);

  // ==================== 事件处理 ====================

  /**
   * 处理表格分页变化
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      setPagination(prev => ({
        ...prev,
        current: newPage,
      }));
    },
    []
  );

  /**
   * 处理筛选变化
   */
  const handleFilterChange = useCallback(
    (key: keyof FilterState, value: FilterState[keyof FilterState]) => {
      setFilters(prev => ({ ...prev, [key]: value }));
      setPagination(prev => ({ ...prev, current: 1 }));
    },
    []
  );

  /**
   * 重置筛选器
   */
  const handleResetFilters = useCallback(() => {
    setFilters({
      status: 'ALL',
      department: 'ALL',
      dateRange: null,
      keyword: '',
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  }, []);

  /**
   * 查看详情
   */
  const handleViewDetail = useCallback(async (record: RetirementApplication) => {
    try {
      const detail = await retirementService.getApplicationById(record.id);
      setCurrentApplication(detail);
      setDetailModalVisible(true);
      bindApprovalContext(record.id, 'VIEW');
    } catch (error) {
      setNotice('加载详情失败');
    }
  }, [bindApprovalContext]);

  /**
   * 打开审批弹窗
   */
  const handleOpenApproval = useCallback(
    (record: RetirementApplication, action: 'approve' | 'reject') => {
      setCurrentApplication(record);
      setApprovalAction(action);
      setApprovalComment('');
      setApprovalEffectiveDate('');
      setApprovalCommentError('');
      setApprovalModalVisible(true);
      bindApprovalContext(record.id, action === 'approve' ? 'APPROVE' : 'REJECT');
    },
    [bindApprovalContext]
  );

  /**
   * 关闭审批弹窗
   */
  const handleCloseApproval = useCallback(() => {
    setApprovalModalVisible(false);
    setApprovalComment('');
    setApprovalEffectiveDate('');
    setApprovalCommentError('');
    if (currentApplication) {
      unbindApprovalContext(currentApplication.id);
    }
  }, [currentApplication, unbindApprovalContext]);

  /**
   * 提交审批
   */
  const handleSubmitApproval = useCallback(async () => {
    // Validate
    if (!approvalComment.trim()) {
      setApprovalCommentError('请输入意见或原因');
      return;
    }
    if (approvalComment.length > 200) {
      setApprovalCommentError('意见不能超过200字符');
      return;
    }
    if (!currentApplication) return;

    try {
      setApprovalLoading(true);

      if (approvalAction === 'approve') {
        await approvalService.approveRetirement(currentApplication.id, {
          comment: approvalComment,
          effectiveDate: approvalEffectiveDate || undefined,
        });
        setNotice('审批通过');
      } else {
        await approvalService.rejectRetirement(currentApplication.id, {
          reason: approvalComment,
        });
        setNotice('已驳回申请');
      }

      handleCloseApproval();
      loadApplications();
    } catch (error) {
      setNotice('审批操作失败');
      console.error('Approval error:', error);
    } finally {
      setApprovalLoading(false);
    }
  }, [approvalAction, approvalComment, approvalEffectiveDate, currentApplication, handleCloseApproval, loadApplications]);

  /**
   * 批量审批
   */
  const handleBatchApprove = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      setNotice('请先选择要审批的申请');
      return;
    }

    try {
      setApprovalLoading(true);
      await approvalService.batchApprove(selectedRowKeys as string[]);
      setNotice(`成功审批 ${selectedRowKeys.length} 条申请`);
      setSelectedRowKeys([]);
      setConfirmBatchVisible(false);
      loadApplications();
    } catch (error) {
      setNotice('批量审批失败');
    } finally {
      setApprovalLoading(false);
    }
  }, [selectedRowKeys, loadApplications]);

  /**
   * 撤销选择
   */
  const handleClearSelection = useCallback(() => {
    setSelectedRowKeys([]);
  }, []);

  /**
   * Toggle row selection
   */
  const handleToggleRow = useCallback((id: React.Key, status: string) => {
    if (status !== 'PENDING_APPROVAL') return;
    setSelectedRowKeys(prev =>
      prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
    );
  }, []);

  // ==================== 统计计算 ====================

  /**
   * 计算统计数据
   */
  const statistics = useMemo(() => {
    const pending = applications.filter(app => app.status === 'PENDING_APPROVAL').length;
    const approved = applications.filter(app => app.status === 'APPROVED').length;
    const rejected = applications.filter(app => app.status === 'REJECTED').length;
    const retired = applications.filter(app => app.status === 'RETIRED').length;
    return { pending, approved, rejected, retired };
  }, [applications]);

  // ==================== 权限检查 ====================

  if (!canView) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">您没有权限查看此页面</p>
      </div>
    );
  }

  // ==================== 主渲染 ====================

  /** Total pages for pagination */
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));

  return (
    <div className="space-y-6">
      {/* Notification banner */}
      {notice && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page title */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">资产退役审批</h2>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">待审批</p>
              <p className="text-3xl font-semibold text-yellow-600 mt-2">{statistics.pending}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">已批准</p>
              <p className="text-3xl font-semibold text-green-600 mt-2">{statistics.approved}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">已驳回</p>
              <p className="text-3xl font-semibold text-red-600 mt-2">{statistics.rejected}</p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">已完成退役</p>
              <p className="text-3xl font-semibold text-blue-600 mt-2">{statistics.retired}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          {/* Status filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <Filter className="w-3 h-3 inline mr-1" />
              状态筛选
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value as RetirementStatus | 'ALL')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">全部状态</option>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Keyword search */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <Search className="w-3 h-3 inline mr-1" />
              关键词搜索
            </label>
            <input
              type="text"
              placeholder="搜索资产编号/名称"
              value={filters.keyword}
              onChange={(e) => handleFilterChange('keyword', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date range (simple inputs) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">日期范围</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filters.dateRange?.[0]?.format('YYYY-MM-DD') || ''}
                onChange={(e) => {
                  const start = e.target.value ? dayjs(e.target.value) : null;
                  setFilters(prev => ({
                    ...prev,
                    dateRange: start ? [start, prev.dateRange?.[1] || start] : null,
                  }));
                }}
                className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                value={filters.dateRange?.[1]?.format('YYYY-MM-DD') || ''}
                onChange={(e) => {
                  const end = e.target.value ? dayjs(e.target.value) : null;
                  setFilters(prev => ({
                    ...prev,
                    dateRange: end ? [prev.dateRange?.[0] || end, end] : null,
                  }));
                }}
                className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              重置
            </button>
            <button
              onClick={() => loadApplications()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              应用筛选
            </button>
          </div>
        </div>
      </div>

      {/* 表格区域 */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* Table header bar */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              共 {pagination.total} 条申请记录
            </span>
            {selectedRowKeys.length > 0 && (
              <>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {selectedRowKeys.length}
                </span>
                <button
                  onClick={handleClearSelection}
                  className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  清除选择
                </button>
                {canApprove && (
                  <button
                    onClick={() => setConfirmBatchVisible(true)}
                    className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
                    disabled={approvalLoading}
                  >
                    {approvalLoading ? '处理中...' : '批量批准'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="px-6 py-8 text-sm text-gray-500 text-center">加载中...</div>
        ) : (
          <>
            {/* HTML Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {canApprove && (
                      <th className="px-4 py-3 text-left w-10">
                        <input
                          type="checkbox"
                          checked={selectedRowKeys.length > 0 && selectedRowKeys.length === applications.filter(a => a.status === 'PENDING_APPROVAL').length}
                          onChange={() => {
                            const pendingIds = applications.filter(a => a.status === 'PENDING_APPROVAL').map(a => a.id);
                            if (selectedRowKeys.length === pendingIds.length) {
                              setSelectedRowKeys([]);
                            } else {
                              setSelectedRowKeys(pendingIds);
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">申请编号</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">资产编号</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">资产名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">申请人</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">所属部门</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">退役原因</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">计划退役日期</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">申请时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {applications.length === 0 ? (
                    <tr>
                      <td colSpan={canApprove ? 11 : 10} className="px-6 py-8 text-sm text-gray-500 text-center">暂无数据</td>
                    </tr>
                  ) : (
                    applications.map((record) => {
                      const statusConfig = STATUS_CONFIG[record.status] || STATUS_CONFIG.DRAFT;
                      const isSelected = selectedRowKeys.includes(record.id);
                      return (
                        <tr
                          key={record.id}
                          className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                        >
                          {canApprove && (
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleRow(record.id, record.status)}
                                disabled={record.status !== 'PENDING_APPROVAL'}
                                className="rounded border-gray-300 disabled:opacity-50"
                              />
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm font-semibold text-blue-600">{record.applicationNo}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{record.assetCode}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-[180px] truncate">{record.assetName}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{record.applicantName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{record.department}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate" title={record.retirementReason}>{record.retirementReason}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{record.plannedRetirementDate ? dayjs(record.plannedRetirementDate).format('YYYY-MM-DD') : '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bg}`}>
                              {record.status === 'PENDING_APPROVAL' && <Clock className="w-3 h-3" />}
                              {statusConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{dayjs(record.createdAt).format('YYYY-MM-DD HH:mm')}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleViewDetail(record)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                详情
                              </button>
                              {record.status === 'PENDING_APPROVAL' && canApprove && (
                                <>
                                  <button
                                    onClick={() => handleOpenApproval(record, 'approve')}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded transition-colors"
                                  >
                                    <CheckCircle className="w-3 h-3" />
                                    批准
                                  </button>
                                  <button
                                    onClick={() => handleOpenApproval(record, 'reject')}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    驳回
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.total > pagination.pageSize && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  共 {pagination.total} 条
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(pagination.current - 1)}
                    disabled={pagination.current <= 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    上一页
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      // Show first, last, and pages near current
                      return page === 1 || page === totalPages || Math.abs(page - pagination.current) <= 1;
                    })
                    .map((page, idx, arr) => (
                      <React.Fragment key={page}>
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                        <button
                          onClick={() => handlePageChange(page)}
                          className={`px-3 py-1.5 text-sm rounded transition-colors ${
                            page === pagination.current
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    ))}
                  <button
                    onClick={() => handlePageChange(pagination.current + 1)}
                    disabled={pagination.current >= totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ==================== 详情弹窗 ==================== */}
      {detailModalVisible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDetailModalVisible(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">退役申请详情</h3>
              <button onClick={() => setDetailModalVisible(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6">
              {currentApplication && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">申请编号：</span>
                      <span className="text-sm font-semibold text-gray-900">{currentApplication.applicationNo}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">状态：</span>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${(STATUS_CONFIG[currentApplication.status] || STATUS_CONFIG.DRAFT).bg}`}>
                        {(STATUS_CONFIG[currentApplication.status] || STATUS_CONFIG.DRAFT).label}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">资产编号：</span>
                      <span className="text-sm font-semibold text-gray-900">{currentApplication.assetCode}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">资产名称：</span>
                      <span className="text-sm font-semibold text-gray-900">{currentApplication.assetName}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">申请人：</span>
                      <span className="text-sm font-semibold text-gray-900">{currentApplication.applicantName}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">所属部门：</span>
                      <span className="text-sm font-semibold text-gray-900">{currentApplication.department}</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">退役原因</h4>
                    <p className="text-sm text-gray-600">{currentApplication.retirementReason || '未填写'}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">计划退役日期：</span>
                      <span className="text-sm text-gray-900">{dayjs(currentApplication.plannedRetirementDate).format('YYYY-MM-DD')}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">申请时间：</span>
                      <span className="text-sm text-gray-900">{dayjs(currentApplication.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                    </div>
                    {currentApplication.actualRetirementDate && (
                      <div>
                        <span className="text-sm text-gray-500">实际退役日期：</span>
                        <span className="text-sm text-gray-900">{dayjs(currentApplication.actualRetirementDate).format('YYYY-MM-DD')}</span>
                      </div>
                    )}
                  </div>

                  {/* 审批历史 */}
                  {currentApplication.approvalHistory && currentApplication.approvalHistory.length > 0 && (
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">审批历史</h4>
                      <div className="space-y-3">
                        {currentApplication.approvalHistory.map((record, index) => (
                          <div key={record.id || index} className="flex items-start gap-3">
                            <div className={`mt-1.5 w-3 h-3 rounded-full flex-shrink-0 ${
                              record.action === 'APPROVE' ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="text-sm font-semibold text-gray-900">{record.approverName}</span>
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  record.action === 'APPROVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {record.action === 'APPROVE' ? '批准' : '驳回'}
                                </span>
                              </div>
                              {record.comment && (
                                <p className="text-sm text-gray-600">「{record.comment}」</p>
                              )}
                              <span className="text-xs text-gray-400">{dayjs(record.actionTime).format('YYYY-MM-DD HH:mm')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== 审批弹窗 ==================== */}
      {approvalModalVisible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCloseApproval}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {approvalAction === 'approve' ? '批准退役申请' : '驳回退役申请'}
              </h3>
              <button onClick={handleCloseApproval} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Comment textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {approvalAction === 'approve' ? '审批意见' : '驳回原因'}
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <textarea
                  rows={4}
                  value={approvalComment}
                  onChange={(e) => { setApprovalComment(e.target.value); setApprovalCommentError(''); }}
                  placeholder={
                    approvalAction === 'approve'
                      ? '请输入审批意见（选填）'
                      : '请输入驳回原因（必填）'
                  }
                  maxLength={200}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${approvalCommentError ? 'border-red-300' : 'border-gray-300'}`}
                />
                {approvalCommentError && <p className="text-xs text-red-600 mt-1">{approvalCommentError}</p>}
                <p className="text-xs text-gray-400 mt-1">{approvalComment.length}/200</p>
              </div>

              {/* Effective date (approve only) */}
              {approvalAction === 'approve' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">生效日期</label>
                  <input
                    type="date"
                    value={approvalEffectiveDate}
                    onChange={(e) => setApprovalEffectiveDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCloseApproval}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitApproval}
                  disabled={approvalLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {approvalLoading ? '处理中...' : `确认${approvalAction === 'approve' ? '批准' : '驳回'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 批量审批确认弹窗 ==================== */}
      {confirmBatchVisible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmBatchVisible(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
                <h3 className="text-lg font-semibold text-gray-900">确认批量审批</h3>
              </div>
              <p className="text-sm text-gray-600 mb-6">确认批量审批 {selectedRowKeys.length} 条申请？</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmBatchVisible(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleBatchApprove}
                  disabled={approvalLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {approvalLoading ? '处理中...' : '确认'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetirementApprovalList;
