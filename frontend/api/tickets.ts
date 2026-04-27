import { apiClient } from '@/app/utils/api';
import type { Ticket, TicketStatus, ApprovalAction } from '@/app/types/flow';

/**
 * Ticket API - Work Order Approval Flow
 *
 * Provides endpoints for querying and updating ticket approval status.
 * Aligns with backend TicketStateMachine: PENDING_APPROVAL -> APPROVING -> APPROVED|REJECTED -> ARCHIVED
 */

export type TicketListQuery = {
  status?: TicketStatus[];
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
};

export type TicketListItem = Pick<Ticket, 'id' | 'title' | 'status' | 'createdAt' | 'updatedAt' | 'currentApproverId'>;

export type TicketDetail = Ticket & {
  approvalHistory: ApprovalRecord[];
};

export type ApprovalRecord = {
  id: string;
  ticketId: string;
  approverId: string;
  action: ApprovalAction;
  comment?: string;
  createdAt: string;
  isActive: boolean;
};

export type ApproveTicketPayload = {
  approverId: string;
  comment?: string;
};

export type RejectTicketPayload = {
  approverId: string;
  comment?: string;
};

export type AssignTicketPayload = {
  approverId: string;
};

/**
 * Fetch paginated ticket list with optional status filter.
 * GET /api/tickets
 */
export async function getTickets(query?: TicketListQuery): Promise<TicketListItem[]> {
  const params = new URLSearchParams(
    Object.entries(query || {}).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach((v) => acc.append(key, String(v)));
        } else {
          acc.append(key, String(value));
        }
      }
      return acc;
    }, new URLSearchParams())
  );
  const res = await apiClient.get(`/tickets?${params.toString()}`);
  return res.data;
}

/**
 * Fetch a single ticket with its approval history.
 * GET /api/tickets/{id}
 */
export async function getTicket(id: string): Promise<TicketDetail> {
  const res = await apiClient.get(`/tickets/${id}`);
  return res.data;
}

/**
 * Submit a ticket for approval (creates PENDING_APPROVAL).
 * POST /api/tickets
 */
export async function submitTicket(ticket: { title: string; description?: string }): Promise<Ticket> {
  const res = await apiClient.post('/tickets', ticket);
  return res.data;
}

/**
 * Approve a ticket, transitioning APPROVING -> APPROVED.
 * POST /api/tickets/{id}/approve
 */
export async function approveTicket(id: string, body: ApproveTicketPayload): Promise<Ticket> {
  const res = await apiClient.post<Ticket>(`/tickets/${id}/approve`, body);
  return res.data;
}

/**
 * Reject a ticket, transitioning APPROVING -> REJECTED.
 * POST /api/tickets/{id}/reject
 */
export async function rejectTicket(id: string, body: RejectTicketPayload): Promise<Ticket> {
  const res = await apiClient.post<Ticket>(`/tickets/${id}/reject`, body);
  return res.data;
}

/**
 * Assign a ticket to an approver, transitioning PENDING_APPROVAL -> APPROVING.
 * POST /api/tickets/{id}/assign
 */
export async function assignTicket(id: string, body: AssignTicketPayload): Promise<Ticket> {
  const res = await apiClient.post<Ticket>(`/tickets/${id}/assign`, body);
  return res.data;
}

/**
 * Archive a ticket, transitioning any terminal state -> ARCHIVED.
 * POST /api/tickets/{id}/archive
 */
export async function archiveTicket(id: string): Promise<Ticket> {
  const res = await apiClient.post<Ticket>(`/tickets/${id}/archive`);
  return res.data;
}

/**
 * Fetch approval history for a ticket.
 * GET /api/tickets/{id}/history
 */
export async function getApprovalHistory(id: string): Promise<ApprovalRecord[]> {
  const res = await apiClient.get(`/tickets/${id}/history`);
  return res.data.records;
}