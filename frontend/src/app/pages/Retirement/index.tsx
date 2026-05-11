/**
 * 资产报废/退役流程主页面
 * 
 * 功能模块：
 * - 报废申请列表
 * - 发起新报废申请
 * - 报废审批历史记录展示
 * 
 * @module Retirement
 * @version SWARM-002-Iter1
 */

import React, { useState, useCallback } from 'react';
import { Plus, History, AlertCircle, X } from 'lucide-react';
import { useRetirementList } from '../../hooks/useRetirementList';
import { useRetirementSubmit } from '../../hooks/useRetirementSubmit';
import {
  RetirementApplication,
  RetirementStatus,
  RetirementReason,
  RETIREMENT_REASON_OPTIONS,
} from '../../types/retirement.types';
import { retirementService } from '../../services/retirementService';

/** Local type for history records matching the service return shape */
interface HistoryRecord {
  id: string;
  assetId: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  timestamp: string;
  operator: string;
  reason?: string;
}

interface RetirementFormValues {
  assetId: string;
  reason: RetirementReason;
  description: string;
  attachmentUrls?: string[];
}

/** Default fallback for unknown status display */
const DEFAULT_STATUS_STYLE = { bg: 'bg-gray-100 text-gray-800', text: '未知', label: '未知' };

/** Map status to Tailwind badge styles and display text — aligned with RetirementStatus enum (NORMAL, RETIRING, RETIRED) */
const STATUS_STYLE_MAP: Record<RetirementStatus, { bg: string; text: string; label: string }> = {
  [RetirementStatus.NORMAL]: { bg: 'bg-gray-100 text-gray-800', text: '正常', label: '正常' },
  [RetirementStatus.RETIRING]: { bg: 'bg-blue-100 text-blue-800', text: '退役中', label: '退役中' },
  [RetirementStatus.RETIRED]: { bg: 'bg-green-100 text-green-800', text: '已报废', label: '已报废' },
};

/** Safe lookup: returns matched style or a fallback for unknown status values */
function getStatusStyle(status: RetirementStatus | string): { bg: string; text: string; label: string } {
  return (STATUS_STYLE_MAP as Record<string, { bg: string; text: string; label: string }>)[status] ?? DEFAULT_STATUS_STYLE;
}

/**
 * 资产报废/退役流程主页面组件
 * 
 * @description 提供报废申请管理界面，包括：
 * - 报废申请列表展示
 * - 发起新的报废申请
 * - 查看审批历史记录
 */
export const RetirementPage: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RetirementApplication | null>(null);

  // Form fields managed via simple state (replaces antd Form)
  const [formAssetId, setFormAssetId] = useState('');
  const [formReason, setFormReason] = useState<RetirementReason | ''>('');
  const [formDescription, setFormDescription] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: retirementList, isLoading, refetch } = useRetirementList();
  const submitMutation = useRetirementSubmit();

  /**
   * Reset form fields to initial state
   */
  const resetForm = useCallback(() => {
    setFormAssetId('');
    setFormReason('');
    setFormDescription('');
    setFormErrors({});
  }, []);

  /**
   * Open the new retirement application modal
   */
  const handleOpenModal = useCallback(() => {
    setIsModalVisible(true);
    resetForm();
  }, [resetForm]);

  /**
   * Close the new retirement application modal
   */
  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
    resetForm();
  }, [resetForm]);

  /**
   * Validate form and submit retirement application
   */
  const handleSubmitRetirement = useCallback(async () => {
    const errors: Record<string, string> = {};
    if (!formAssetId) errors.assetId = '请选择要报废的资产';
    if (!formReason) errors.reason = '请选择报废原因';
    if (!formDescription) errors.description = '请输入详细说明';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      await submitMutation.mutateAsync({
        assetId: formAssetId,
        reason: formReason as RetirementReason,
        description: formDescription,
        attachmentUrls: [],
      });
      setNotice('报废申请已提交');
      handleCloseModal();
      refetch();
    } catch (error) {
      setNotice('提交失败，请重试');
    }
  }, [submitMutation, refetch, handleCloseModal, formAssetId, formReason, formDescription]);

  /**
   * View retirement history for a given asset
   * 
   * @param assetId - Asset ID to look up history for
   */
  const handleViewHistory = useCallback(async (assetId: string) => {
    setSelectedAssetId(assetId);
    try {
      const history = await retirementService.getRetirementHistory(assetId);
      setHistoryRecords(history);
      setIsHistoryVisible(true);
    } catch (error) {
      setNotice('获取历史记录失败');
    }
  }, []);

  /**
   * Close the history records modal
   */
  const handleCloseHistory = useCallback(() => {
    setIsHistoryVisible(false);
    setSelectedAssetId(null);
    setHistoryRecords([]);
  }, []);

  /**
   * Confirm and execute delete operation
   * 
   * @param record - The retirement application record to delete
   */
  const handleConfirmDelete = useCallback(async (record: RetirementApplication) => {
    try {
      await retirementService.deleteRetirement(record.id);
      setNotice('删除成功');
      setConfirmDelete(null);
      refetch();
    } catch (error) {
      setNotice('删除失败');
    }
  }, [refetch]);

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

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">资产报废/退役管理</h2>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          发起报废
        </button>
      </div>

      {/* Retirement application table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">申请编号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">资产编号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">资产名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">报废原因</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">申请人</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">申请时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-sm text-gray-500 text-center">加载中...</td>
                </tr>
              ) : (!retirementList || retirementList.length === 0) ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-sm text-gray-500 text-center">暂无数据</td>
                </tr>
              ) : (
                retirementList.map((record: RetirementApplication) => {
                  const statusInfo = getStatusStyle(record.status);
                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-blue-600">{record.retirementNo}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{record.assetId}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{record.assetId}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{record.reason}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.bg}`}>
                          {statusInfo.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{record.applicant?.name ?? '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{new Date(record.createdAt).toLocaleString('zh-CN')}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewHistory(record.assetId)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                          >
                            <History className="w-3 h-3" />
                            历史
                          </button>
                          {record.status === RetirementStatus.NORMAL && (
                            <button
                              onClick={() => setConfirmDelete(record)}
                              className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded transition-colors"
                            >
                              删除
                            </button>
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
      </div>

      {/* New retirement application modal */}
      {isModalVisible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCloseModal}>
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">发起报废申请</h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Asset select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">资产 <span className="text-red-500">*</span></label>
                <select
                  value={formAssetId}
                  onChange={(e) => { setFormAssetId(e.target.value); setFormErrors(prev => ({ ...prev, assetId: '' })); }}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.assetId ? 'border-red-300' : 'border-gray-300'}`}
                >
                  <option value="">请选择资产</option>
                  {/* Asset options will be populated from API */}
                </select>
                {formErrors.assetId && <p className="text-xs text-red-600 mt-1">{formErrors.assetId}</p>}
              </div>

              {/* Reason select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">报废原因 <span className="text-red-500">*</span></label>
                <select
                  value={formReason}
                  onChange={(e) => { setFormReason(e.target.value as RetirementReason); setFormErrors(prev => ({ ...prev, reason: '' })); }}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${formErrors.reason ? 'border-red-300' : 'border-gray-300'}`}
                >
                  <option value="">请选择报废原因</option>
                  {RETIREMENT_REASON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {formErrors.reason && <p className="text-xs text-red-600 mt-1">{formErrors.reason}</p>}
              </div>

              {/* Description textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">详细说明 <span className="text-red-500">*</span></label>
                <textarea
                  rows={4}
                  value={formDescription}
                  onChange={(e) => { setFormDescription(e.target.value); setFormErrors(prev => ({ ...prev, description: '' })); }}
                  placeholder="请详细描述报废原因和资产当前状况"
                  maxLength={1000}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${formErrors.description ? 'border-red-300' : 'border-gray-300'}`}
                />
                {formErrors.description && <p className="text-xs text-red-600 mt-1">{formErrors.description}</p>}
                <p className="text-xs text-gray-400 mt-1">{formDescription.length}/1000</p>
              </div>

              {/* Form actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitRetirement}
                  disabled={submitMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitMutation.isPending ? '提交中...' : '提交申请'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
                <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
              </div>
              <p className="text-sm text-gray-600 mb-6">确定要删除这条报废申请吗？</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => handleConfirmDelete(confirmDelete)}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval history modal */}
      {isHistoryVisible && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCloseHistory}>
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">报废审批历史</h3>
              <button onClick={handleCloseHistory} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6">
              {historyRecords.length > 0 ? (
                <div className="space-y-4">
                  {historyRecords.map((record, index) => (
                    <div key={index} className="flex items-start gap-3">
                      {/* Timeline dot */}
                      <div className={`mt-1.5 w-3 h-3 rounded-full flex-shrink-0 ${
                        record.action === 'APPROVE' ? 'bg-green-500' :
                        record.action === 'REJECT' ? 'bg-red-500' : 'bg-blue-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-semibold text-gray-900">{record.operator}</span>
                          <span className="text-xs text-gray-500">{new Date(record.timestamp).toLocaleString('zh-CN')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            record.action === 'APPROVE' ? 'bg-green-100 text-green-800' :
                            record.action === 'REJECT' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {record.action}
                          </span>
                          <span className="text-sm text-gray-500">{record.reason}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 text-center py-8">暂无审批历史记录</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetirementPage;
