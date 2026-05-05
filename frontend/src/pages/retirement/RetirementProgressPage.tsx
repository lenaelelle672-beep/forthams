/**
 * 资产报废进度跟踪页面
 * 
 * 功能说明:
 * - 展示报废申请的当前审批状态
 * - 显示审批时间线和历史记录
 * - 支持查看资产详情和审批人信息
 * 
 * 相关任务: SWARM-002 资产报废退役流程 - Iteration 1
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ArrowLeft,
  User,
  Calendar,
  FileText,
  Building
} from 'lucide-react';
import { retirementApi } from '@/api/retirementApi';
import type { 
  RetirementRequest, 
  RetirementProgress, 
  ApprovalRecord 
} from '@/types/retirement.types';
import { formatDateTime, formatRelativeTime } from '@/utils/formatters';
import styles from './RetirementProgressPage.module.css';

/**
 * 状态徽章组件
 * 根据审批状态显示不同颜色的标签
 */
const StatusBadge: React.FC<{ status: RetirementProgress['status'] }> = ({ status }) => {
  const statusConfig = {
    DRAFT: { label: '草稿', className: styles.statusDraft },
    PENDING: { label: '审批中', className: styles.statusPending },
    APPROVED: { label: '已批准', className: styles.statusApproved },
    REJECTED: { label: '已驳回', className: styles.statusRejected },
  };

  const config = statusConfig[status] || statusConfig.DRAFT;

  return (
    <span className={`${styles.statusBadge} ${config.className}`}>
      {config.label}
    </span>
  );
};

/**
 * 审批时间线组件
 * 展示审批流程的各个阶段
 */
const ApprovalTimeline: React.FC<{ 
  records: ApprovalRecord[]; 
  currentApprover?: string;
}> = ({ records, currentApprover }) => {
  if (records.length === 0) {
    return (
      <div className={styles.timelineEmpty}>
        <Clock size={24} />
        <p>暂无审批记录</p>
      </div>
    );
  }

  return (
    <div className={styles.timeline}>
      {records.map((record, index) => (
        <div 
          key={record.id} 
          className={`${styles.timelineItem} ${styles[`timelineItem${record.decision}`]}`}
        >
          <div className={styles.timelineIcon}>
            {record.decision === 'APPROVED' && <CheckCircle size={16} />}
            {record.decision === 'REJECTED' && <XCircle size={16} />}
            {record.decision === 'PENDING' && <AlertCircle size={16} />}
          </div>
          <div className={styles.timelineContent}>
            <div className={styles.timelineHeader}>
              <span className={styles.timelineApprover}>
                <User size={14} />
                {record.approverName || '待分配'}
              </span>
              <span className={styles.timelineTime}>
                {formatRelativeTime(record.decidedAt || record.createdAt)}
              </span>
            </div>
            <div className={styles.timelineDecision}>
              {record.decision === 'APPROVED' && '已批准'}
              {record.decision === 'REJECTED' && '已驳回'}
              {record.decision === 'PENDING' && '等待审批'}
            </div>
            {record.comment && (
              <div className={styles.timelineComment}>
                {record.comment}
              </div>
            )}
          </div>
        </div>
      ))}
      {currentApprover && (
        <div className={`${styles.timelineItem} ${styles.timelineItemCurrent}`}>
          <div className={styles.timelineIcon}>
            <Clock size={16} />
          </div>
          <div className={styles.timelineContent}>
            <div className={styles.timelineHeader}>
              <span className={styles.timelineApprover}>
                <User size={14} />
                {currentApprover}
              </span>
              <span className={styles.timelineTime}>当前审批人</span>
            </div>
            <div className={styles.timelineDecision}>等待处理</div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 资产信息卡片组件
 */
const AssetInfoCard: React.FC<{ assetId: string }> = ({ assetId }) => {
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAsset = async () => {
      try {
        const data = await retirementApi.getAssetInfo(assetId);
        setAsset(data);
      } catch (error) {
        console.error('获取资产信息失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAsset();
  }, [assetId]);

  if (loading) {
    return (
      <div className={styles.assetCard}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className={styles.assetCard}>
        <p className={styles.assetNotFound}>资产信息不可用</p>
      </div>
    );
  }

  return (
    <div className={styles.assetCard}>
      <h3 className={styles.cardTitle}>
        <Building size={18} />
        资产信息
      </h3>
      <div className={styles.assetDetails}>
        <div className={styles.assetRow}>
          <span className={styles.assetLabel}>资产编码</span>
          <span className={styles.assetValue}>{asset.assetCode}</span>
        </div>
        <div className={styles.assetRow}>
          <span className={styles.assetLabel}>资产名称</span>
          <span className={styles.assetValue}>{asset.name}</span>
        </div>
        <div className={styles.assetRow}>
          <span className={styles.assetLabel}>资产分类</span>
          <span className={styles.assetValue}>{asset.categoryName}</span>
        </div>
        <div className={styles.assetRow}>
          <span className={styles.assetLabel}>购置日期</span>
          <span className={styles.assetValue}>
            {asset.purchaseDate ? formatDateTime(asset.purchaseDate) : '-'}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * 报废申请详情组件
 */
const RequestDetails: React.FC<{ request: RetirementRequest }> = ({ request }) => {
  const reasonLabels: Record<string, string> = {
    DAMAGED: '损坏',
    OBSOLETE: '老旧淘汰',
    MAINTENANCE_COST_TOO_HIGH: '维护成本过高',
    TRANSFERRED: '已转移',
    OTHER: '其他',
  };

  return (
    <div className={styles.detailsCard}>
      <h3 className={styles.cardTitle}>
        <FileText size={18} />
        申请详情
      </h3>
      <div className={styles.detailsGrid}>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>申请编号</span>
          <span className={styles.detailValue}>{request.requestNo}</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>报废原因</span>
          <span className={styles.detailValue}>
            {reasonLabels[request.reason] || request.reason}
          </span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>申请时间</span>
          <span className={styles.detailValue}>
            {formatDateTime(request.createdAt)}
          </span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>申请人</span>
          <span className={styles.detailValue}>{request.applicantName}</span>
        </div>
        {request.description && (
          <div className={`${styles.detailItem} ${styles.detailFullWidth}`}>
            <span className={styles.detailLabel}>详细说明</span>
            <span className={styles.detailValue}>{request.description}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 审批进度跟踪页面主组件
 * 
 * 功能:
 * - 展示报废申请的整体信息
 * - 显示资产信息和申请详情
 * - 展示审批时间线和历史记录
 * - 支持返回列表操作
 */
const RetirementProgressPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [progress, setProgress] = useState<RetirementProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载报废进度数据
   */
  useEffect(() => {
    const fetchProgress = async () => {
      if (!id) {
        setError('缺少申请ID参数');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await retirementApi.getProgress(id);
        setProgress(data);
      } catch (err: any) {
        console.error('获取审批进度失败:', err);
        setError(err.message || '获取数据失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [id]);

  /**
   * 处理返回列表
   */
  const handleBack = () => {
    navigate('/retirement/list');
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <AlertCircle size={48} />
          <p>{error}</p>
          <button onClick={handleBack} className={styles.backButton}>
            返回列表
          </button>
        </div>
      </div>
    );
  }

  if (!progress || !progress.request) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <AlertCircle size={48} />
          <p>未找到相关申请</p>
          <button onClick={handleBack} className={styles.backButton}>
            返回列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 页面头部 */}
      <div className={styles.header}>
        <button onClick={handleBack} className={styles.backLink}>
          <ArrowLeft size={20} />
          返回列表
        </button>
        <div className={styles.headerTitle}>
          <h1>报废申请进度</h1>
          <StatusBadge status={progress.status} />
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className={styles.content}>
        {/* 左侧: 资产信息和申请详情 */}
        <div className={styles.leftPanel}>
          <AssetInfoCard assetId={progress.request.assetId} />
          <RequestDetails request={progress.request} />
        </div>

        {/* 右侧: 审批时间线 */}
        <div className={styles.rightPanel}>
          <div className={styles.timelineCard}>
            <h3 className={styles.cardTitle}>
              <Calendar size={18} />
              审批进度
            </h3>
            <ApprovalTimeline 
              records={progress.approvalHistory || []}
              currentApprover={progress.currentApproverName}
            />
          </div>

          {/* 操作提示 */}
          {progress.status === 'PENDING' && (
            <div className={styles.actionHint}>
              <AlertCircle size={16} />
              <span>等待审批人处理您的申请</span>
            </div>
          )}
          
          {progress.status === 'APPROVED' && (
            <div className={styles.successHint}>
              <CheckCircle size={16} />
              <span>报废申请已批准，资产已标记为报废</span>
            </div>
          )}
          
          {progress.status === 'REJECTED' && (
            <div className={styles.warningHint}>
              <XCircle size={16} />
              <span>报废申请已被驳回，如需继续请重新提交</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RetirementProgressPage;