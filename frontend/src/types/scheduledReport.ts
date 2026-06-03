/**
 * @file types/scheduledReport.ts
 * @description 定时报表类型定义
 */

export interface ScheduledReport {
  id: number;
  savedReportId: number | null;
  cronExpr: string;
  recipientEmails: string;
  format: 'PDF' | 'EXCEL';
  status: 'ACTIVE' | 'PAUSED';
  lastRunAt: string | null;
  nextRunAt: string | null;
  subject: string;
  createTime: string;
}
