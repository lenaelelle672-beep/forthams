import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  Table, 
  Button, 
  Tag, 
  Space, 
  Modal, 
  Form, 
  Input, 
  Select, 
  DatePicker, 
  message, 
  Tooltip,
  Empty,
  Spin,
  Badge
} from 'antd';
import { 
  PlusOutlined, 
  EyeOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useRetirementRequests, useRetirementById } from '@/hooks/useRetirement';
import { useAssets } from '@/hooks/useAssets';
import { useAuth } from '@/hooks/useAuth';
import { StatusBadge } from '@/components/retirement/StatusBadge';
import { ProgressTracker } from '@/components/retirement/ProgressTracker';
import { ApprovalChain } from '@/components/retirement/ApprovalChain';
import type { 
  RetirementRequest, 
  RetirementStatus, 
  RetirementFormData,
  ApprovalStep,
  TransitionAction
} from '@/types/retirement';
import { RetirementStatusEnum, TransitionActionEnum } from '@/types/retirement';
import styles from './index.module.css';

/**
 * 资产报废/退役流程 - 申请列表页
 * 
 * 功能说明：
 * - 展示所有资产报废申请列表
 * - 支持创建新的报废申请
 * - 支持查看申请详情和审批进度
 * - 支持状态流转操作（提交、审批等）
 * 
 * 状态流转规则：
 * DRAFT → SUBMITTED → PENDING_L1 → PENDING_L2 → PENDING_L3 → APPROVED → DISPOSED
 *                          ↓              ↓              ↓
 *                       REJECTED      REJECTED       REJECTED
 * 
 * @since SWARM-002 Phase 5
 * @see {@link https://spec.internal/swarm-002|完整规格说明}
 */
const RetirementListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // 状态管理
  const [selectedStatus, setSelectedStatus] = useState<RetirementStatus | 'ALL'>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [form] = Form.useForm<RetirementFormData>();
  
  // 数据获取 hooks
  const { 
    data: retirementRequests, 
    isLoading: isLoadingRequests,
    refetch: refetchRequests 
  } = useRetirementRequests({
    status: selectedStatus === 'ALL' ? undefined : selectedStatus,
    keyword: searchKeyword || undefined
  });
  
  const { data: assets } = useAssets({ status: 'ACTIVE' });
  const { data: selectedRequest, isLoading: isLoadingDetail } = useRetirementById(selectedRequestId || '');
  
  // 过滤可选资产（排除已退役的）
  const availableAssets = useMemo(() => {
    if (!assets?.data) return [];
    return assets.data.filter(asset => asset.status !== 'RETIRED');
  }, [assets]);

  // 根据用户角色和请求状态确定可执行的操作
  const getAvailableActions = useCallback((request: RetirementRequest): TransitionAction[] => {
    const actions: TransitionAction[] = [];
    const { current_status: status, requester_id, approval_chain } = request;
    
    // REQUESTER 可以提交自己的草稿
    if (status === RetirementStatusEnum.DRAFT && user?.id === requester_id) {
      actions.push(TransitionActionEnum.SUBMIT);
    }
    
    // 审批链检查
    const pendingStep = approval_chain?.steps?.find(step => step.status === 'PENDING');
    if (pendingStep && user?.id === pendingStep.approver_id) {
      actions.push(TransitionActionEnum.APPROVE_L1);
      actions.push(TransitionActionEnum.REJECT);
    }
    
    // 管理员可以执行 DISPOSE
    if (status === RetirementStatusEnum.APPROVED && user?.role === 'ADMIN') {
      actions.push(TransitionActionEnum.DISPOSE);
    }
    
    return actions;
  }, [user]);

  // 状态统计
  const statusStats = useMemo(() => {
    if (!retirementRequests?.data) {
      return { total: 0, draft: 0, pending: 0, approved: 0, rejected: 0 };
    }
    
    const data = retirementRequests.data;
    return {
      total: data.length,
      draft: data.filter(r => r.current_status === RetirementStatusEnum.DRAFT).length,
      pending: data.filter(r => 
        r.current_status.includes('PENDING') || 
        r.current_status === RetirementStatusEnum.SUBMITTED
      ).length,
      approved: data.filter(r => r.current_status === RetirementStatusEnum.APPROVED).length,
      rejected: data.filter(r => r.current_status === RetirementStatusEnum.REJECTED).length
    };
  }, [retirementRequests]);

  // 创建报废申请
  const handleCreateRequest = useCallback(async (values: RetirementFormData) => {
    try {
      // ATB-001-01: 用户提交报废请求（资产ID + 理由）
      // POST /retirements 返回 201，状态为 DRAFT
      const response = await fetch('/api/retirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_ids: selectedAssetIds,
          reason: values.reason,
          estimated_value: values.estimated_value,
          preferred_date: values.preferred_date?.format('YYYY-MM-DD')
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        if (error.code === 'INVALID_ASSET_ID') {
          message.error('资产ID无效');
        } else if (error.code === 'ASSET_ALREADY_RETIRED') {
          message.error('资产已退役，无法提交报废申请');
        }
        return;
      }
      
      message.success('报废申请已创建');
      setIsCreateModalOpen(false);
      form.resetFields();
      setSelectedAssetIds([]);
      refetchRequests();
    } catch (error) {
      message.error('创建报废申请失败');
    }
  }, [selectedAssetIds, form, refetchRequests]);

  // 执行状态流转
  const handleTransition = useCallback(async (
    requestId: string, 
    action: TransitionAction,
    comment?: string
  ) => {
    try {
      // ATB-002: 状态流转引擎测试
      // transition(action="SUBMIT") 返回 current_status: SUBMITTED
      const response = await fetch(`/api/retirements/${requestId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment })
      });
      
      if (!response.ok) {
        const error = await response.json();
        if (error.code === 'INVALID_TRANSITION') {
          message.error('非法状态流转');
        } else if (error.code === 'STATE_LOCKED') {
          message.error('状态已锁定，无法执行操作');
        } else if (error.code === 'UNAUTHORIZED_APPROVER') {
          message.error('未授权审批人');
        } else if (error.code === 'SELF_APPROVAL_FORBIDDEN') {
          message.error('禁止自审批');
        }
        return;
      }
      
      message.success('操作成功');
      refetchRequests();
      
      // 如果打开了详情弹窗，刷新详情
      if (selectedRequestId) {
        // 刷新详情数据
      }
    } catch (error) {
      message.error('操作失败');
    }
  }, [refetchRequests, selectedRequestId]);

  // 查看详情
  const handleViewDetail = useCallback((requestId: string) => {
    setSelectedRequestId(requestId);
    setIsDetailModalOpen(true);
  }, []);

  // ATB-005-01: 查询当前进度
  // GET /retirements/{id}/progress 返回当前审批节点
  const getProgressInfo = useCallback(async (requestId: string) => {
    try {
      const response = await fetch(`/api/retirements/${requestId}/progress`);
      if (response.ok) {
        const data = await response.json();
        return {
          current_step: data.current_step,
          total_steps: data.total_steps,
          pending_approvers: data.pending_approvers,
          progress_status: data.progress_status
        };
      }
    } catch (error) {
      console.error('获取进度信息失败', error);
    }
    return null;
  }, []);

  // 表格列定义
  const columns: ColumnsType<RetirementRequest> = [
    {
      title: '申请编号',
      dataIndex: 'request_id',
      key: 'request_id',
      width: 150,
      render: (text: string) => (
        <Tooltip title={text}>
          <span className={styles.requestId}>{text.substring(0, 12)}...</span>
        </Tooltip>
      )
    },
    {
      title: '资产',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 180,
      render: (text: string, record: RetirementRequest) => (
        <div>
          <div className={styles.assetName}>{text || record.assets?.[0]?.name}</div>
          {record.assets && record.assets.length > 1 && (
            <div className={styles.assetCount}>+{record.assets.length - 1} 个资产</div>
          )}
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'current_status',
      key: 'current_status',
      width: 140,
      render: (status: RetirementStatus, record: RetirementRequest) => (
        <StatusBadge 
          status={status} 
          approvalTier={record.approval_tier}
        />
      ),
      filters: [
        { text: '草稿', value: RetirementStatusEnum.DRAFT },
        { text: '待L1审批', value: RetirementStatusEnum.PENDING_L1 },
        { text: '待L2审批', value: RetirementStatusEnum.PENDING_L2 },
        { text: '待L3审批', value: RetirementStatusEnum.PENDING_L3 },
        { text: '已批准', value: RetirementStatusEnum.APPROVED },
        { text: '已拒绝', value: RetirementStatusEnum.REJECTED },
        { text: '已退役', value: RetirementStatusEnum.DISPOSED }
      ],
      onFilter: (value, record) => record.current_status === value
    },
    {
      title: '申请人',
      dataIndex: 'requester_name',
      key: 'requester_name',
      width: 100
    },
    {
      title: '申请理由',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text?.substring(0, 50)}{text?.length > 50 ? '...' : ''}</span>
        </Tooltip>
      )
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      defaultSortOrder: 'descend'
    },
    {
      title: '当前审批人',
      dataIndex: 'current_approver',
      key: 'current_approver',
      width: 120,
      render: (_, record: RetirementRequest) => {
        const pendingStep = record.approval_chain?.steps?.find(
          (s: ApprovalStep) => s.status === 'PENDING'
        );
        return pendingStep ? (
          <span>{pendingStep.approver_name || '待分配'}</span>
        ) : (
          <span className={styles.noApprover}>-</span>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record: RetirementRequest) => {
        const actions = getAvailableActions(record);
        
        return (
          <Space size="small">
            <Button 
              type="link" 
              size="small" 
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record.request_id)}
            >
              详情
            </Button>
            
            {actions.includes(TransitionActionEnum.SUBMIT) && (
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleTransition(record.request_id, TransitionActionEnum.SUBMIT)}
              >
                提交
              </Button>
            )}
            
            {actions.includes(TransitionActionEnum.APPROVE_L1) && (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleTransition(record.request_id, TransitionActionEnum.APPROVE_L1)}
                >
                  通过
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleTransition(record.request_id, TransitionActionEnum.REJECT)}
                >
                  拒绝
                </Button>
              </>
            )}
            
            {actions.includes(TransitionActionEnum.DISPOSE) && (
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleTransition(record.request_id, TransitionActionEnum.DISPOSE)}
              >
                执行退役
              </Button>
            )}
          </Space>
        );
      }
    }
  ];

  // 渲染详情弹窗
  const renderDetailModal = () => {
    if (!selectedRequest) return null;
    
    return (
      <Modal
        title={`报废申请详情 - ${selectedRequest.request_id}`}
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setIsDetailModalOpen(false)}>
            关闭
          </Button>
        ]}
      >
        <div className={styles.detailContent}>
          {/* 基本信息 */}
          <Card title="基本信息" className={styles.detailCard}>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <label>申请编号:</label>
                <span>{selectedRequest.request_id}</span>
              </div>
              <div className={styles.infoItem}>
                <label>当前状态:</label>
                <StatusBadge 
                  status={selectedRequest.current_status}
                  approvalTier={selectedRequest.approval_tier}
                />
              </div>
              <div className={styles.infoItem}>
                <label>申请人:</label>
                <span>{selectedRequest.requester_name}</span>
              </div>
              <div className={styles.infoItem}>
                <label>申请时间:</label>
                <span>{dayjs(selectedRequest.created_at).format('YYYY-MM-DD HH:mm:ss')}</span>
              </div>
              <div className={styles.infoItem}>
                <label>审批层级:</label>
                <Tag color={selectedRequest.approval_tier === 'HIGH' ? 'red' : 'blue'}>
                  {selectedRequest.approval_tier === 'HIGH' ? '高价值资产' : '标准'}
                </Tag>
              </div>
            </div>
            
            <div className={styles.reasonSection}>
              <label>报废理由:</label>
              <p>{selectedRequest.reason}</p>
            </div>
          </Card>
          
          {/* 资产信息 */}
          <Card title="关联资产" className={styles.detailCard}>
            <div className={styles.assetList}>
              {selectedRequest.assets?.map((asset, index) => (
                <div key={index} className={styles.assetItem}>
                  <div className={styles.assetInfo}>
                    <span className={styles.assetName}>{asset.name}</span>
                    <span className={styles.assetId}>ID: {asset.asset_id}</span>
                  </div>
                  <div className={styles.assetValue}>
                    估值: ¥{asset.current_value?.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          
          {/* 审批链可视化 */}
          {/* ATB-005-02: 进度可视化数据结构 */}
          {/* 返回包含 current_step, total_steps, pending_approvers */}
          <Card title="审批进度" className={styles.detailCard}>
            <ApprovalChain 
              steps={selectedRequest.approval_chain?.steps || []}
              currentStatus={selectedRequest.current_status}
            />
          </Card>
          
          {/* 历史记录 */}
          {/* ATB-004-01: 状态变更记录 */}
          {/* GET /retirements/{id}/history 包含状态变更条目 */}
          <Card title="变更历史" className={styles.detailCard}>
            <div className={styles.historyList}>
              {selectedRequest.history?.map((entry, index) => (
                <div key={index} className={styles.historyItem}>
                  <div className={styles.historyTime}>
                    {dayjs(entry.timestamp).format('YYYY-MM-DD HH:mm')}
                  </div>
                  <div className={styles.historyContent}>
                    <span className={styles.historyAction}>{entry.action}</span>
                    <span className={styles.historyUser}>by {entry.operator_name}</span>
                    {entry.comment && (
                      <p className={styles.historyComment}>"{entry.comment}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Modal>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>资产报废/退役管理</h1>
          <p className={styles.subtitle}>管理资产报废申请、追踪审批进度</p>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => setIsCreateModalOpen(true)}
          className={styles.createButton}
        >
          新建报废申请
        </Button>
      </div>
      
      {/* 状态统计 */}
      <div className={styles.statsSection}>
        <Card className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{statusStats.total}</div>
            <div className={styles.statLabel}>全部申请</div>
          </div>
        </Card>
        <Card className={styles.statCard}>
          <div className={`${styles.statContent} ${styles.draft}`}>
            <div className={styles.statValue}>{statusStats.draft}</div>
            <div className={styles.statLabel}>草稿</div>
          </div>
        </Card>
        <Card className={styles.statCard}>
          <div className={`${styles.statContent} ${styles.pending}`}>
            <div className={styles.statValue}>{statusStats.pending}</div>
            <div className={styles.statLabel}>待审批</div>
          </div>
        </Card>
        <Card className={styles.statCard}>
          <div className={`${styles.statContent} ${styles.approved}`}>
            <div className={styles.statValue}>{statusStats.approved}</div>
            <div className={styles.statLabel}>已批准</div>
          </div>
        </Card>
        <Card className={styles.statCard}>
          <div className={`${styles.statContent} ${styles.rejected}`}>
            <div className={styles.statValue}>{statusStats.rejected}</div>
            <div className={styles.statLabel}>已拒绝</div>
          </div>
        </Card>
      </div>
      
      {/* 筛选区域 */}
      <Card className={styles.filterCard}>
        <Space size="large" wrap>
          <div className={styles.filterItem}>
            <span className={styles.filterLabel}>状态筛选:</span>
            <Select
              value={selectedStatus}
              onChange={setSelectedStatus}
              style={{ width: 150 }}
              options={[
                { label: '全部', value: 'ALL' },
                { label: '草稿', value: RetirementStatusEnum.DRAFT },
                { label: '待L1审批', value: RetirementStatusEnum.PENDING_L1 },
                { label: '待L2审批', value: RetirementStatusEnum.PENDING_L2 },
                { label: '待L3审批', value: RetirementStatusEnum.PENDING_L3 },
                { label: '已批准', value: RetirementStatusEnum.APPROVED },
                { label: '已拒绝', value: RetirementStatusEnum.REJECTED },
                { label: '已退役', value: RetirementStatusEnum.DISPOSED }
              ]}
            />
          </div>
          <div className={styles.filterItem}>
            <Input
              placeholder="搜索申请编号或资产名称"
              prefix={<SearchOutlined />}
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
          </div>
          <Button 
            icon={<ReloadOutlined />}
            onClick={() => refetchRequests()}
          >
            刷新
          </Button>
        </Space>
      </Card>
      
      {/* 数据表格 */}
      <Card className={styles.tableCard}>
        <Table
          columns={columns}
          dataSource={retirementRequests?.data || []}
          rowKey="request_id"
          loading={isLoadingRequests}
          pagination={{
            total: retirementRequests?.total || 0,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: (
              <Empty 
                description="暂无报废申请" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button 
                  type="primary" 
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  创建第一个申请
                </Button>
              </Empty>
            )
          }}
        />
      </Card>
      
      {/* 创建申请弹窗 */}
      <Modal
        title="新建报废申请"
        open={isCreateModalOpen}
        onCancel={() => {
          setIsCreateModalOpen(false);
          form.resetFields();
          setSelectedAssetIds([]);
        }}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateRequest}
        >
          <Form.Item
            name="asset_ids"
            label="选择资产"
            rules={[{ required: true, message: '请选择要报废的资产' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择资产（最多10个）"
              value={selectedAssetIds}
              onChange={setSelectedAssetIds}
              maxCount={10}
            >
              {availableAssets.map(asset => (
                <Select.Option key={asset.asset_id} value={asset.asset_id}>
                  <div className={styles.assetOption}>
                    <span>{asset.name}</span>
                    <span className={styles.assetOptionValue}>
                      ¥{asset.current_value?.toLocaleString()}
                    </span>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="reason"
            label="报废理由"
            rules={[
              { required: true, message: '请输入报废理由' },
              { max: 500, message: '报废理由不能超过500个字符' }
            ]}
          >
            <Input.TextArea
              rows={4}
              placeholder="请详细描述资产报废的原因..."
              showCount
              maxLength={500}
            />
          </Form.Item>
          
          <Form.Item
            name="estimated_value"
            label="预估残值"
          >
            <Input type="number" prefix="¥" placeholder="0.00" />
          </Form.Item>
          
          <Form.Item
            name="preferred_date"
            label="期望处理日期"
          >
            <DatePicker 
              style={{ width: '100%' }}
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
          
          <Form.Item className={styles.formActions}>
            <Space>
              <Button onClick={() => {
                setIsCreateModalOpen(false);
                form.resetFields();
                setSelectedAssetIds([]);
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={isLoadingRequests}>
                创建申请
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      
      {/* 详情弹窗 */}
      {renderDetailModal()}
    </div>
  );
};

export default RetirementListPage;