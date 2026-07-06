// Hook-local type re-exports (satisfies import './types' in useAuditLog.ts)
export type { GraphifyNode, GraphifyEdge } from '@/components/audit/GraphifyKnowledgeGraph';

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  operation: string;
  operatorId?: string;
  operatorName?: string;
  timestamp: string;
  changes?: Record<string, unknown>;
  field?: string;
  userId?: string;
  operator?: string;
  riskLevel?: string;
}

export interface AuditLogFilter {
  entityType?: string;
  entityId?: string;
  operation?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
}
