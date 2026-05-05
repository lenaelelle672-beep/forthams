/**
 * WorkOrderDetailPage Component
 * 
 * 工单详情页面 - 展示工单详情、审批历史并提供审批操作入口。
 * 支持查看工单基本信息、审批历史时间线，以及通过/拒绝/转交操作。
 * 
 * @module pages/WorkOrder
 * @requires react
 * @requires @tanstack/react-query
 * @requires @tanstack/react-router
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Tooltip,
  Stack
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  SwapHoriz as TransferIcon,
  History as HistoryIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Comment as CommentIcon,
  ArrowBack as BackIcon,
  Edit as EditIcon
} from '@mui/icons-material';

// ============================================================================
// Type Definitions
// ============================================================================

/** 工单状态枚举 */
type WorkOrderStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'TRANSFERRED';

/** 工单优先级 */
type WorkOrderPriority = 'low' | 'normal' | 'high' | 'urgent';

/** 审批历史记录 */
interface ApprovalHistoryRecord {
  id: string;
  operator: string;
  operatorAvatar?: string;
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'TRANSFER' | 'RECEIVE';
  comment?: string;
  createdAt: string;
  fromStatus?: WorkOrderStatus;
  toStatus: WorkOrderStatus;
}

/** 工单详情数据 */
interface WorkOrderDetail {
  id: string;
  title: string;
  description: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  submitter: string;
  submitterDept: string;
  currentApprover?: string;
  createdAt: string;
  updatedAt: string;
  approverComments?: string[];
}

/** 审批操作类型 */
type ApprovalAction = 'approve' | 'reject' | 'transfer';

/** 审批表单数据 */
interface ApprovalFormData {
  comment: string;
  toUserId?: string;
}

// ============================================================================
// Mock API Functions (Production: Replace with actual API calls)
// ============================================================================

/**
 * 获取工单详情
 * @param workOrderId - 工单ID
 * @returns 工单详情数据
 */
const fetchWorkOrderDetail = async (workOrderId: string): Promise<WorkOrderDetail> => {
  // TODO: Replace with actual API call
  // return api.get(`/workorders/${workOrderId}`);
  
  // Mock data for development
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: workOrderId,
        title: '设备采购申请 - 显示器采购',
        description: '因业务发展需要，现申请采购5台Dell U2720QM 27寸4K显示器，用于研发部门升级办公设备。预算约25000元。',
        status: 'PENDING',
        priority: 'normal',
        submitter: '张三',
        submitterDept: '研发部',
        currentApprover: '李四',
        createdAt: '2024-01-15T09:30:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        approverComments: []
      });
    }, 300);
  });
};

/**
 * 获取工单审批历史
 * @param workOrderId - 工单ID
 * @returns 审批历史记录列表
 */
const fetchApprovalHistory = async (workOrderId: string): Promise<ApprovalHistoryRecord[]> => {
  // TODO: Replace with actual API call
  // return api.get(`/workorders/${workOrderId}/history`);
  
  // Mock data for development
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          id: 'hist-001',
          operator: '张三',
          action: 'SUBMIT',
          comment: '提交工单审批申请',
          createdAt: '2024-01-15T09:30:00Z',
          fromStatus: 'DRAFT',
          toStatus: 'PENDING'
        },
        {
          id: 'hist-002',
          operator: '王五',
          action: 'TRANSFER',
          comment: '转交给李四审批',
          createdAt: '2024-01-15T09:45:00Z',
          fromStatus: 'PENDING',
          toStatus: 'TRANSFERRED'
        },
        {
          id: 'hist-003',
          operator: '李四',
          action: 'RECEIVE',
          comment: '接收转交的工单',
          createdAt: '2024-01-15T10:00:00Z',
          fromStatus: 'TRANSFERRED',
          toStatus: 'PENDING'
        }
      ]);
    }, 200);
  });
};

/**
 * 执行审批操作
 * @param workOrderId - 工单ID
 * @param action - 审批动作
 * @param data - 审批表单数据
 * @returns 更新后的工单状态
 */
const executeApprovalAction = async (
  workOrderId: string,
  action: ApprovalAction,
  data: ApprovalFormData
): Promise<{ status: WorkOrderStatus }> => {
  // TODO: Replace with actual API call
  // return api.post(`/workorders/${workOrderId}/${action}`, data);
  
  // Mock implementation
  return new Promise((resolve) => {
    setTimeout(() => {
      const statusMap: Record<ApprovalAction, WorkOrderStatus> = {
        approve: 'APPROVED',
        reject: 'REJECTED',
        transfer: 'TRANSFERRED'
      };
      resolve({ status: statusMap[action] });
    }, 500);
  });
};

/**
 * 获取可转交的用户列表
 * @returns 用户列表
 */
const fetchTransferableUsers = async (): Promise<Array<{ id: string; name: string }>> => {
  // TODO: Replace with actual API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { id: 'user-001', name: '张三' },
        { id: 'user-002', name: '李四' },
        { id: 'user-003', name: '王五' },
        { id: 'user-004', name: '赵六' }
      ]);
    }, 200);
  });
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 格式化日期时间
 * @param dateString - ISO格式日期字符串
 * @returns 格式化后的日期字符串
 */
const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 获取状态对应的颜色
 * @param status - 工单状态
 * @returns MUI Chip颜色
 */
const getStatusColor = (status: WorkOrderStatus): 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info' => {
  const colorMap: Record<WorkOrderStatus, 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info'> = {
    DRAFT: 'default',
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'error',
    TRANSFERRED: 'info'
  };
  return colorMap[status];
};

/**
 * 获取状态中文名称
 * @param status - 工单状态
 * @returns 中文状态名
 */
const getStatusLabel = (status: WorkOrderStatus): string => {
  const labelMap: Record<WorkOrderStatus, string> = {
    DRAFT: '草稿',
    PENDING: '待审批',
    APPROVED: '已通过',
    REJECTED: '已拒绝',
    TRANSFERRED: '已转交'
  };
  return labelMap[status];
};

/**
 * 获取审批动作中文名称
 * @param action - 审批动作
 * @returns 中文动作名
 */
const getActionLabel = (action: ApprovalHistoryRecord['action']): string => {
  const labelMap: Record<ApprovalHistoryRecord['action'], string> = {
    SUBMIT: '提交',
    APPROVE: '通过',
    REJECT: '拒绝',
    TRANSFER: '转交',
    RECEIVE: '接收'
  };
  return labelMap[action];
};

/**
 * 获取审批动作图标
 * @param action - 审批动作
 * @returns React组件
 */
const getActionIcon = (action: ApprovalHistoryRecord['action']): React.ReactElement => {
  const iconMap: Record<ApprovalHistoryRecord['action'], React.ReactElement> = {
    SUBMIT: <EditIcon />,
    APPROVE: <ApproveIcon />,
    REJECT: <RejectIcon />,
    TRANSFER: <TransferIcon />,
    RECEIVE: <PersonIcon />
  };
  return iconMap[action];
};

// ============================================================================
// Sub-Components
// ============================================================================

/** 状态徽章组件 */
interface StatusBadgeProps {
  status: WorkOrderStatus;
}

/**
 * StatusBadge - 显示工单状态的徽章组件
 * @param status - 工单状态
 */
const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <Chip
    data-testid="status-badge"
    label={getStatusLabel(status)}
    color={getStatusColor(status)}
    size="small"
    sx={{ fontWeight: 500 }}
  />
);

/** 审批历史时间线组件 */
interface HistoryTimelineProps {
  history: ApprovalHistoryRecord[];
}

/**
 * HistoryTimeline - 展示审批历史的时间线组件
 * @param history - 审批历史记录列表
 */
const HistoryTimeline: React.FC<HistoryTimelineProps> = ({ history }) => {
  return (
    <List data-testid="history-list" sx={{ width: '100%' }}>
      {history.map((record, index) => (
        <ListItem
          key={record.id}
          data-testid="history-item"
          alignItems="flex-start"
          sx={{
            mb: 2,
            opacity: 1,
            transition: 'opacity 0.2s',
            '&:hover': { opacity: 0.8 }
          }}
        >
          <ListItemAvatar>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              {getActionIcon(record.action)}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="subtitle2">{record.operator}</Typography>
                <Chip 
                  label={getActionLabel(record.action)} 
                  size="small" 
                  color={record.action === 'APPROVE' ? 'success' : record.action === 'REJECT' ? 'error' : 'default'}
                />
                {record.fromStatus && (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      {getStatusLabel(record.fromStatus)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">→</Typography>
                  </>
                )}
                <Typography variant="caption" color="text.secondary">
                  {getStatusLabel(record.toStatus)}
                </Typography>
              </Box>
            }
            secondary={
              <Box mt={0.5}>
                {record.comment && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {record.comment}
                  </Typography>
                )}
                <Box display="flex" alignItems="center" gap={0.5}>
                  <TimeIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.disabled">
                    {formatDateTime(record.createdAt)}
                  </Typography>
                </Box>
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  );
};

/** 审批操作对话框组件 */
interface ApprovalDialogProps {
  open: boolean;
  action: ApprovalAction | null;
  onClose: () => void;
  onConfirm: (data: ApprovalFormData) => void;
  loading: boolean;
  users?: Array<{ id: string; name: string }>;
}

/**
 * ApprovalDialog - 审批操作确认对话框
 * @param open - 是否打开
 * @param action - 审批动作
 * @param onClose - 关闭回调
 * @param onConfirm - 确认回调
 * @param loading - 加载状态
 * @param users - 可转交用户列表
 */
const ApprovalDialog: React.FC<ApprovalDialogProps> = ({
  open,
  action,
  onClose,
  onConfirm,
  loading,
  users = []
}) => {
  const [comment, setComment] = useState('');
  const [selectedUser, setSelectedUser] = useState('');

  const handleConfirm = () => {
    onConfirm({ 
      comment, 
      toUserId: action === 'transfer' ? selectedUser : undefined 
    });
    setComment('');
    setSelectedUser('');
  };

  const getDialogTitle = () => {
    const titles: Record<ApprovalAction, string> = {
      approve: '确认通过',
      reject: '确认拒绝',
      transfer: '转交审批'
    };
    return action ? titles[action] : '';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{getDialogTitle()}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="审批意见"
            multiline
            rows={3}
            fullWidth
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="请输入审批意见（可选）"
            data-testid="approval-comment"
          />
          {action === 'transfer' && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                选择转交对象
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {users.map((user) => (
                  <Chip
                    key={user.id}
                    label={user.name}
                    onClick={() => setSelectedUser(user.id)}
                    variant={selectedUser === user.id ? 'filled' : 'outlined'}
                    color={selectedUser === user.id ? 'primary' : 'default'}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>取消</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={action === 'reject' ? 'error' : 'primary'}
          disabled={loading || (action === 'transfer' && !selectedUser)}
          data-testid={`btn-${action}`}
        >
          {loading ? <CircularProgress size={24} /> : '确认'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * WorkOrderDetailPage - 工单详情页面主组件
 * 展示工单详情、审批历史，并提供审批操作入口
 */
const WorkOrderDetailPage: React.FC = () => {
  // Router hooks
  const navigate = useNavigate();
  const { workOrderId } = useParams({ from: '/workorders/$workOrderId' });
  
  // Query client for cache invalidation
  const queryClient = useQueryClient();
  
  // Local state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<ApprovalAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  // =========================================================================
  // Query Hooks
  // =========================================================================

  /**
   * 获取工单详情
   */
  const { 
    data: workOrder, 
    isLoading: isLoadingDetail,
    error: detailError 
  } = useQuery({
    queryKey: ['workorder', workOrderId],
    queryFn: () => fetchWorkOrderDetail(workOrderId),
    enabled: !!workOrderId
  });

  /**
   * 获取审批历史
   */
  const { 
    data: history = [],
    isLoading: isLoadingHistory 
  } = useQuery({
    queryKey: ['workorder', workOrderId, 'history'],
    queryFn: () => fetchApprovalHistory(workOrderId),
    enabled: !!workOrderId
  });

  /**
   * 获取可转交用户列表（仅在转交对话框打开时加载）
   */
  const { data: transferableUsers = [] } = useQuery({
    queryKey: ['users', 'transferable'],
    queryFn: fetchTransferableUsers,
    enabled: dialogOpen && currentAction === 'transfer'
  });

  // =========================================================================
  // Mutation Hooks
  // =========================================================================

  /**
   * 审批操作 mutation
   */
  const approvalMutation = useMutation({
    mutationFn: ({ action, data }: { action: ApprovalAction; data: ApprovalFormData }) =>
      executeApprovalAction(workOrderId, action, data),
    onSuccess: () => {
      // 刷新工单详情和历史数据
      queryClient.invalidateQueries({ queryKey: ['workorder', workOrderId] });
      setDialogOpen(false);
      setCurrentAction(null);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || '审批操作失败，请重试');
    }
  });

  // =========================================================================
  // Event Handlers
  // =========================================================================

  /**
   * 处理审批操作按钮点击
   * @param action - 审批动作类型
   */
  const handleActionClick = useCallback((action: ApprovalAction) => {
    setCurrentAction(action);
    setDialogOpen(true);
    setError(null);
  }, []);

  /**
   * 处理对话框关闭
   */
  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setCurrentAction(null);
    setError(null);
  }, []);

  /**
   * 处理审批确认
   * @param data - 审批表单数据
   */
  const handleApprovalConfirm = useCallback((data: ApprovalFormData) => {
    if (currentAction) {
      approvalMutation.mutate({ action: currentAction, data });
    }
  }, [currentAction, approvalMutation]);

  /**
   * 处理返回列表
   */
  const handleBack = useCallback(() => {
    navigate({ to: '/workorders' });
  }, [navigate]);

  // =========================================================================
  // Derived State
  // =========================================================================

  /** 是否可以执行审批操作 */
  const canApprove = useMemo(() => {
    return workOrder?.status === 'PENDING';
  }, [workOrder?.status]);

  /** 是否显示审批操作按钮 */
  const showApprovalActions = useMemo(() => {
    return canApprove;
  }, [canApprove]);

  // =========================================================================
  // Render
  // =========================================================================

  if (isLoadingDetail) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress data-testid="loading-spinner" />
      </Box>
    );
  }

  if (detailError || !workOrder) {
    return (
      <Alert severity="error" data-testid="error-alert">
        加载工单详情失败，请重试
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Tooltip title="返回列表">
          <IconButton onClick={handleBack} data-testid="btn-back">
            <BackIcon />
          </IconButton>
        </Tooltip>
        <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
          工单详情
        </Typography>
        <StatusBadge status={workOrder.status} />
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }} data-testid="error-message">
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '2fr 1fr' }} gap={3}>
        {/* Left Column - WorkOrder Details */}
        <Stack spacing={3}>
          {/* Basic Info Card */}
          <Card data-testid="workorder-info-card">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {workOrder.title}
              </Typography>
              <Divider sx={{ my: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    申请人
                  </Typography>
                  <Typography variant="body1">{workOrder.submitter}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    所属部门
                  </Typography>
                  <Typography variant="body1">{workOrder.submitterDept}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    优先级
                  </Typography>
                  <Chip 
                    label={workOrder.priority === 'high' || workOrder.priority === 'urgent' ? '高' : '普通'} 
                    color={workOrder.priority === 'urgent' ? 'error' : workOrder.priority === 'high' ? 'warning' : 'default'}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    创建时间
                  </Typography>
                  <Typography variant="body1">{formatDateTime(workOrder.createdAt)}</Typography>
                </Grid>
              </Grid>

              <Box mt={3}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  工单描述
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {workOrder.description}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Approval History Card */}
          <Card data-testid="approval-history-card">
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <HistoryIcon color="primary" />
                <Typography variant="h6">审批历史</Typography>
              </Box>
              
              {isLoadingHistory ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress size={24} />
                </Box>
              ) : history.length === 0 ? (
                <Typography color="text.secondary" align="center" py={4}>
                  暂无审批历史记录
                </Typography>
              ) : (
                <HistoryTimeline history={history} />
              )}
            </CardContent>
          </Card>
        </Stack>

        {/* Right Column - Actions */}
        <Box>
          <Card data-testid="approval-actions-card">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                审批操作
              </Typography>
              
              {showApprovalActions ? (
                <Stack spacing={2}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<ApproveIcon />}
                    fullWidth
                    onClick={() => handleActionClick('approve')}
                    data-testid="btn-approve"
                  >
                    通过
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<RejectIcon />}
                    fullWidth
                    onClick={() => handleActionClick('reject')}
                    data-testid="btn-reject"
                  >
                    拒绝
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<TransferIcon />}
                    fullWidth
                    onClick={() => handleActionClick('transfer')}
                    data-testid="btn-transfer"
                  >
                    转交
                  </Button>
                </Stack>
              ) : (
                <Alert severity="info">
                  当前状态不允许审批操作
                </Alert>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Approval Dialog */}
      <ApprovalDialog
        open={dialogOpen}
        action={currentAction}
        onClose={handleDialogClose}
        onConfirm={handleApprovalConfirm}
        loading={approvalMutation.isPending}
        users={transferableUsers}
      />
    </Box>
  );
};

// ============================================================================
// Helper Components
// ============================================================================

/** 简单的 Grid 组件替代 MUI Grid v2 */
interface GridProps {
  container?: boolean;
  item?: boolean;
  xs?: number | boolean;
  sm?: number | boolean;
  children: React.ReactNode;
}

const Grid: React.FC<GridProps> = ({ container, item, xs, sm, children }) => {
  const getGridSize = (size: number | boolean | undefined): string => {
    if (size === true || size === undefined) return '100%';
    if (typeof size === 'number') return `calc(${size / 12 * 100}% - 16px)`;
    return size;
  };

  if (container) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: sm ? `repeat(${typeof sm === 'number' ? sm : 2}, 1fr)` : 'repeat(2, 1fr)'
          },
          gap: 2
        }}
      >
        {children}
      </Box>
    );
  }

  if (item) {
    return (
      <Box
        sx={{
          gridColumn: xs ? `span ${xs}` : sm ? `span ${sm}` : undefined
        }}
      >
        {children}
      </Box>
    );
  }

  return <>{children}</>;
};

// ============================================================================
// Exports
// ============================================================================

export default WorkOrderDetailPage;

export { 
  WorkOrderDetailPage,
  StatusBadge,
  HistoryTimeline,
  ApprovalDialog,
  formatDateTime,
  getStatusColor,
  getStatusLabel,
  getActionLabel,
  getActionIcon
};

// Type exports for testing
export type {
  WorkOrderStatus,
  WorkOrderPriority,
  ApprovalHistoryRecord,
  WorkOrderDetail,
  ApprovalAction,
  ApprovalFormData
};