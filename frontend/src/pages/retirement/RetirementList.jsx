import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Box,
  Chip,
  TablePagination,
  TableSortLabel,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  PlayArrow as PlayArrowIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useAuth } from '../../contexts/AuthContext';
import { retirementApi } from '../../api/retirementApi';
import { format } from 'date-fns';

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const STATUS_LABELS = {
  normal: { label: '正常', color: 'success' },
  pending_retirement: { label: '待审批', color: 'warning' },
  retired: { label: '已退役', color: 'primary' },
};

const ACTION_LABELS = {
  created: '创建申请',
  withdrawn: '已撤回',
  approved: '审批通过',
  rejected: '审批驳回',
  status_changed: '状态变更',
};

export const RetirementList = () => {
  const { user } = useAuth();
  const [retirements, setRetirements] = useState([]);
  const [history, setHistory] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [order, setOrder] = useState('desc');
  const [orderBy, setOrderBy] = useState('createdAt');
  const [selectedRetirement, setSelectedRetirement] = useState(null);
  const [openDetail, setOpenDetail] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchRetirements = async () => {
    try {
      const data = await retirementApi.listMyApplications();
      setRetirements(data);
    } catch (error) {
      console.error('Failed to fetch retirements:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (assetId) => {
    try {
      const data = await retirementApi.getAssetHistory(assetId);
      setHistory((prev) => ({ ...prev, [assetId]: data }));
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRetirements();
    }
  }, [user]);

  const handleWithdraw = async (id) => {
    try {
      await retirementApi.withdrawApplication(id);
      fetchRetirements();
    } catch (error) {
      console.error('Failed to withdraw:', error);
    }
  };

  const handleApprove = async (id, action) => {
    try {
      await retirementApi.adminAction(id, action);
      fetchRetirements();
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleRequestRetirement = async (assetId) => {
    try {
      await retirementApi.createApplication(assetId);
      fetchRetirements();
    } catch (error) {
      console.error('Failed to create application:', error);
    }
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedRetirements = retirements.sort((a, b) => {
    const aVal = a[orderBy];
    const bVal = b[orderBy];
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        资产报废申请管理
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'assetCode'}
                  direction={orderBy === 'assetCode' ? order : 'asc'}
                  onClick={() => handleSort('assetCode')}
                >
                  资产编号
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'assetName'}
                  direction={orderBy === 'assetName' ? order : 'asc'}
                  onClick={() => handleSort('assetName')}
                >
                  资产名称
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === 'status'}
                  direction={orderBy === 'status' ? order : 'asc'}
                  onClick={() => handleSort('status')}
                >
                  当前状态
                </TableSortLabel>
              </TableCell>
              <TableCell>申请原因</TableCell>
              <TableCell>期望退役日期</TableCell>
              <TableCell>申请人</TableCell>
              <TableCell>创建时间</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRetirements.map((retire) => {
              const assetStatus = retire.asset?.status || 'normal';
              const canWithdraw = retire.status === 'pending';
              const canApprove = user?.role === 'admin' && retire.status === 'pending';

              return (
                <StyledTableRow key={retire.id}>
                  <TableCell>{retire.asset?.assetCode || '-'}</TableCell>
                  <TableCell>{retire.asset?.name || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={STATUS_LABELS[assetStatus]?.label || assetStatus}
                      color={STATUS_LABELS[assetStatus]?.color || 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{retire.reason}</TableCell>
                  <TableCell>
                    {retire.expectedDate
                      ? format(new Date(retire.expectedDate), 'yyyy-MM-dd')
                      : '-'}
                  </TableCell>
                  <TableCell>{retire.applicant?.name || '-'}</TableCell>
                  <TableCell>
                    {format(new Date(retire.createdAt), 'yyyy-MM-dd HH:mm')}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="查看历史">
                      <IconButton
                        size="small"
                        onClick={() => {
                          fetchHistory(retire.asset?.id || retire.assetId);
                          setSelectedRetirement(retire);
                          setOpenHistory(true);
                        }}
                      >
                        <HistoryIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canWithdraw && (
                      <Tooltip title="撤回申请">
                        <IconButton
                          size="small"
                          onClick={() => handleWithdraw(retire.id)}
                        >
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canApprove && (
                      <>
                        <Tooltip title="审批通过">
                          <IconButton
                            size="small"
                            onClick={() => handleApprove(retire.id, 'approve')}
                          >
                            <CheckCircleIcon fontSize="small" color="success" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="审批驳回">
                          <IconButton
                            size="small"
                            onClick={() => handleApprove(retire.id, 'reject')}
                          >
                            <BlockIcon fontSize="small" color="error" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </StyledTableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={100}
        page={page}
        onPageChange={(e, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[10, 25, 50]}
      />

      {/* 资产历史详情弹窗 */}
      <Dialog
        open={openHistory}
        onClose={() => setOpenHistory(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          资产退役历史 - {selectedRetirement?.asset?.assetCode}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {history[selectedRetirement?.asset?.id]?.map((h) => (
              <Box
                key={h.id}
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <Typography variant="subtitle2" fontWeight="bold">
                  {ACTION_LABELS[h.action] || h.action}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {format(new Date(h.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                </Typography>
                {h.previousStatus && (
                  <Typography>
                    变更: {h.previousStatus} → {h.newStatus}
                  </Typography>
                )}
                {h.performedBy && (
                  <Typography>操作人: {h.performedBy.name}</Typography>
                )}
                {h.comment && <Typography>备注: {h.comment}</Typography>}
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenHistory(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RetirementList;