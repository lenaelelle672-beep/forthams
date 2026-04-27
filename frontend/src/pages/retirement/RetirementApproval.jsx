import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Chip,
  Tooltip,
  IconButton,
  LinearProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  CheckCircle as ApprovedIcon,
  Close as RejectedIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  PlayArrow as SubmitIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import ApprovalHistoryDialog from './components/ApprovalHistoryDialog';
import { retirementApi } from '../../api/retirementApi';
import { format } from 'date-fns';

const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  marginBottom: theme.spacing(2),
}));

const StatusChip = styled(Chip)(({ status }) => ({
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 600,
  padding: '4px 10px',
  backgroundColor:
    status === 'approved'
      ? '#e8f5e9'
      : status === 'rejected'
      ? '#ffebee'
      : status === 'withdrawn'
      ? '#f3e5f5'
      : '#e3f2fd',
  color:
    status === 'approved'
      ? '#2e7d32'
      : status === 'rejected'
      ? '#c62828'
      : status === 'withdrawn'
      ? '#5e35b1'
      : '#1565c0',
}));

const ActionButton = styled(Button)(({ variant, disabled }) => ({
  borderRadius: 8,
  textTransform: 'none',
  fontWeight: 600,
  padding: '6px 16px',
  ...(variant === 'approve' && {
    backgroundColor: '#2e7d32',
    color: '#fff',
    '&:hover': { backgroundColor: '#1b5e20' },
  }),
  ...(variant === 'reject' && {
    backgroundColor: '#c62828',
    color: '#fff',
    '&:hover': { backgroundColor: '#880e0e' },
  }),
  ...(variant === 'edit' && {
    backgroundColor: '#f57c00',
    color: '#fff',
    '&:hover': { backgroundColor: '#ef6c00' },
  }),
  ...(variant === 'delete' && {
    backgroundColor: '#d84315',
    color: '#fff',
    '&:hover': { backgroundColor: '#bf360c' },
  }),
}));

const RetirementApproval = () => {
  const [applications, setApplications] = useState([]);
  const [assetStatus, setAssetStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Dialog states
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [actionComment, setActionComment] = useState('');

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await retirementApi.getPendingApplications();
      setApplications(data);
    } catch (err) {
      setError(err.message || 'Failed to load retirement applications');
      setSnackbar({ open: true, message: 'Failed to load applications', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAssetStatus = async (assetId) => {
    try {
      const status = await retirementApi.getAssetStatus(assetId);
      setAssetStatus((prev) => ({ ...prev, [assetId]: status }));
    } catch (err) {
      console.warn('Failed to fetch asset status', err);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleApprove = async (appId) => {
    if (!actionReason.trim()) {
      setSnackbar({ open: true, message: 'Please provide a reason for approval', severity: 'warning' });
      return;
    }
    try {
      await retirementApi.approveApplication(appId, actionReason, actionComment);
      setSnackbar({ open: true, message: 'Application approved successfully', severity: 'success' });
      setApprovalDialogOpen(false);
      setCurrentAction(null);
      setActionReason('');
      setActionComment('');
      fetchApplications();
    } catch (err) {
      setError(err.message);
      setSnackbar({ open: true, message: 'Approval failed', severity: 'error' });
    }
  };

  const handleReject = async (appId) => {
    if (!actionReason.trim()) {
      setSnackbar({ open: true, message: 'Please provide a reason for rejection', severity: 'warning' });
      return;
    }
    try {
      await retirementApi.rejectApplication(appId, actionReason, actionComment);
      setSnackbar({ open: true, message: 'Application rejected successfully', severity: 'success' });
      setApprovalDialogOpen(false);
      setCurrentAction(null);
      setActionReason('');
      setActionComment('');
      fetchApplications();
    } catch (err) {
      setError(err.message);
      setSnackbar({ open: true, message: 'Rejection failed', severity: 'error' });
    }
  };

  const handleWithdraw = async (appId) => {
    try {
      await retirementApi.withdrawApplication(appId);
      setSnackbar({ open: true, message: 'Application withdrawn successfully', severity: 'success' });
      fetchApplications();
    } catch (err) {
      setError(err.message);
      setSnackbar({ open: true, message: 'Withdrawal failed', severity: 'error' });
    }
  };

  const handleViewHistory = async (app) => {
    try {
      const history = await retirementApi.getRetirementHistory(app.assetId);
      setHistoryData(history);
      setSelectedApplication(app);
      setHistoryDialogOpen(true);
    } catch (err) {
      setError(err.message);
      setSnackbar({ open: true, message: 'Failed to load history', severity: 'error' });
    }
  };

  const getStatusDisplay = (status) => {
    const map = {
      draft: '草稿',
      pending: '待审批',
      approved: '已通过',
      rejected: '已驳回',
      withdrawn: '已撤回',
    };
    return map[status] || status;
  };

  if (loading) return <LinearProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        资产报废退役流程审批
      </Typography>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>申请编号</TableCell>
              <TableCell>资产编号</TableCell>
              <TableCell>资产名称</TableCell>
              <TableCell>申请人</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>申请时间</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {applications.map((app) => (
              <TableRow key={app.id} hover>
                <TableCell>{app.id}</TableCell>
                <TableCell>{app.assetCode}</TableCell>
                <TableCell>{app.assetName}</TableCell>
                <TableCell>{app.applicantName}</TableCell>
                <TableCell>
                  <StatusChip
                    label={getStatusDisplay(app.status)}
                    status={app.status}
                  />
                  {assetStatus[app.assetId] && (
                    <Tooltip title={`资产当前状态: ${assetStatus[app.assetId]}`}>
                      <RefreshIcon fontSize="small" sx={{ ml: 0.5, color: 'action.active' }} />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell>{format(new Date(app.createdAt), 'yyyy-MM-dd HH:mm')}</TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                    {app.status === 'pending' && (
                      <Tooltip title="审批">
                        <ActionButton
                          variant="approve"
                          size="small"
                          startIcon={<ApprovedIcon />}
                          onClick={() => {
                            setCurrentAction('approve');
                            setApprovalDialogOpen(true);
                          }}
                        >
                          审批
                        </ActionButton>
                      </Tooltip>
                    )}
                    {app.status === 'pending' && (
                      <Tooltip title="驳回">
                        <ActionButton
                          variant="reject"
                          size="small"
                          startIcon={<RejectedIcon />}
                          onClick={() => {
                            setCurrentAction('reject');
                            setApprovalDialogOpen(true);
                          }}
                        >
                          驳回
                        </ActionButton>
                      </Tooltip>
                    )}
                    {app.status === 'pending' && (
                      <Tooltip title="撤回">
                        <ActionButton
                          variant="edit"
                          size="small"
                          startIcon={<CancelIcon />}
                          onClick={() => handleWithdraw(app.id)}
                        >
                          撤回
                        </ActionButton>
                      </Tooltip>
                    )}
                    <Tooltip title="查看历史">
                      <IconButton
                        size="small"
                        onClick={() => handleViewHistory(app)}
                      >
                        <HistoryIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={approvalDialogOpen}
        onClose={() => setApprovalDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {currentAction === 'approve' ? '审批通过' : '审批驳回'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="审批原因"
            type="text"
            fullWidth
            required
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            placeholder="请输入审批原因..."
          />
          <TextField
            margin="dense"
            label="备注（可选）"
            type="text"
            fullWidth
            multiline
            rows={3}
            value={actionComment}
            onChange={(e) => setActionComment(e.target.value)}
            placeholder="请输入备注信息..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialogOpen(false)}>
            取消
          </Button>
          <Button
            onClick={() =>
              currentAction === 'approve'
                ? handleApprove(selectedApplication?.id)
                : handleReject(selectedApplication?.id)
            }
            variant="contained"
          >
            确认
          </Button>
        </DialogActions>
      </Dialog>

      <ApprovalHistoryDialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        application={selectedApplication}
        history={historyData}
      />
    </Box>
  );
};

export default RetirementApproval;