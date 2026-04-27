import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useRetirementService } from '@/app/services/retirementService';
import { useApprovalService } from '@/app/services/approvalService';
import { useAssetService } from '@/app/services/assetService';
import { format } from 'date-fns';

/**
 * RetirementDetail
 * - Displays detailed information for a single retirement application.
 * - Allows applicant to withdraw (if pending) and owner/manager to approve/reject.
 * - Shows a chronological audit/history of status changes and approvals.
 */
export const RetirementDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const retirementService = useRetirementService();
  const approvalService = useApprovalService();
  const assetService = useAssetService();

  const [application, setApplication] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState('');

  const fetchDetail = async () => {
    try {
      const [app, hist] = await Promise.all([
        retirementService.getApplicationDetail(id),
        retirementService.getApplicationHistory(id),
      ]);
      setApplication(app);
      setHistory(hist);
    } catch (err) {
      console.error('Failed to load retirement detail', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleWithdraw = async () => {
    try {
      await retirementService.withdrawApplication(id);
      fetchDetail();
    } catch (err) {
      console.error('Withdraw failed', err);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await approvalService.approveRetirement(id, comment);
      fetchDetail();
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      await approvalService.rejectRetirement(id, comment);
      fetchDetail();
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (value) => {
    try {
      await retirementService.updateApplicationStatus(id, value);
      fetchDetail();
    } catch (err) {
      console.error('Status update failed', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading retirement detail...</div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold">Application not found</h3>
              <p className="text-sm text-muted-foreground">
                The requested retirement application could not be located.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate('/retirement/list')}
              >
                Back to List
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const map = {
      draft: 'secondary',
      pending: 'warning',
      approved: 'success',
      rejected: 'destructive',
      withdrawn: 'secondary',
      retired: 'default',
    };
    return map[status] || 'default';
  };

  const getHistoryActions = () => {
    const actions = [];
    history.forEach((h) => {
      const actionLabel = {
        created: 'Application created',
        withdrawn: 'Application withdrawn',
        approved: `Approved by ${h.performedBy}`,
        rejected: `Rejected by ${h.performedBy}`,
        status_changed: `Status changed to ${h.newStatus}`,
      }[h.action] || h.action;
      actions.push({
        time: h.createdAt,
        label: actionLabel,
        by: h.performedBy,
        comment: h.comment,
      });
    });
    return actions;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Retirement Application #{application.id}
        </h2>
        <p className="text-sm text-muted-foreground">
          Asset: {application.assetCode} | Status:{' '}
          <Badge variant={getStatusColor(application.status)}>
            {application.status}
          </Badge>{' '}
          | Applicant: {application.applicantName}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application Details</CardTitle>
          <CardDescription>
            Review and manage the retirement request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Asset Code</label>
              <input
                value={application.assetCode}
                readOnly
                className="flex h-9 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Current Status</label>
              <Select
                value={application.status}
                onValueChange={handleStatusChange}
                disabled={!['pending', 'draft'].includes(application.status)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Reason</label>
              <input
                value={application.reason}
                readOnly
                className="flex h-9 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Expected Date</label>
              <input
                type="date"
                value={application.expectedDate || ''}
                readOnly
                className="flex h-9 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Comments / Notes</label>
            <Textarea
              rows={3}
              placeholder="Enter additional notes..."
              value={application.notes || ''}
              readOnly
            />
          </div>
        </CardContent>
      </Card>

      {(application.status === 'pending' || application.status === 'draft') && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Button variant="outline" onClick={handleWithdraw}>
              Withdraw Application
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium block">Approval Comment</label>
              <Textarea
                rows={2}
                placeholder="Enter approval comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={handleApprove}>Approve</Button>
              <Button variant="secondary" onClick={handleReject}>
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Retirement History</CardTitle>
          <CardDescription>
            Chronological record of all status changes and approvals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Comment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getHistoryActions().length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No history records found.
                    </TableCell>
                  </TableRow>
                )}
                {getHistoryActions().map((h, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs">
                      {format(new Date(h.time), 'yyyy-MM-dd HH:mm:ss')}
                    </TableCell>
                    <TableCell>{h.label}</TableCell>
                    <TableCell>{h.by || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {h.comment || '-'}&nbsp;
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};