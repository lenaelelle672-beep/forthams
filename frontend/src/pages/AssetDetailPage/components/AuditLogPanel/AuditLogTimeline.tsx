/**
 * AuditLogTimeline Component
 * 
 * Renders a chronological timeline of audit log entries for asset changes.
 * Supports field-level diff visualization for @Auditable annotated fields.
 * 
 * @module AuditLogPanel/AuditLogTimeline
 * @requires React
 * @requires audit.types
 */

import React, { useState } from 'react';
import { 
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineSeparatorConnector,
  TimelineDot,
  TimelineContent,
  TimelineOppositeContent
} from '@mui/lab';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Collapse,
  Chip,
  IconButton,
  Tooltip,
  Stack
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';

import type { AuditLogEntry, ChangedField } from '../../types/audit.types';
import { getAuditOperationName, getOperationColor } from '../../types/audit.types';
import { FieldDiffView } from './FieldDiffView';

interface AuditLogTimelineProps {
  /** Array of audit log entries to display in timeline */
  logs: AuditLogEntry[];
  /** Callback when a log entry is expanded/collapsed */
  onLogExpand?: (eventId: string, expanded: boolean) => void;
}

/**
 * Operation icon mapping for visual differentiation
 */
const OPERATION_ICONS = {
  CREATE: AddIcon,
  UPDATE: EditIcon,
  DELETE: DeleteIcon,
} as const;

/**
 * Format ISO timestamp to human-readable date string
 * 
 * @param timestamp - ISO 8601 formatted timestamp
 * @returns Formatted date string (e.g., "2024-01-15 10:30")
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 * 
 * @param timestamp - ISO 8601 formatted timestamp
 * @returns Relative time string
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return formatTimestamp(timestamp);
}

/**
 * Get operation badge color based on operation type
 * 
 * @param operation - Operation type (CREATE, UPDATE, DELETE)
 * @returns MUI color variant
 */
function getOperationBadgeColor(operation: string): 'success' | 'warning' | 'error' | 'default' {
  switch (operation) {
    case 'CREATE':
      return 'success';
    case 'UPDATE':
      return 'warning';
    case 'DELETE':
      return 'error';
    default:
      return 'default';
  }
}

/**
 * Single audit log entry card component
 */
interface AuditLogEntryCardProps {
  /** The audit log entry data */
  log: AuditLogEntry;
  /** Whether this entry is expanded */
  expanded: boolean;
  /** Toggle expansion callback */
  onToggleExpand: () => void;
}

const AuditLogEntryCard: React.FC<AuditLogEntryCardProps> = ({
  log,
  expanded,
  onToggleExpand
}) => {
  const OperationIcon = OPERATION_ICONS[log.operation] || EditIcon;
  const operationColor = getOperationColor(log.operation);
  const badgeColor = getOperationBadgeColor(log.operation);

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        mb: 2,
        borderLeft: `4px solid ${operationColor}`,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: 2,
        }
      }}
      data-testid="audit-log-entry"
    >
      <CardContent sx={{ pb: expanded ? 2 : 1 }}>
        {/* Header Row */}
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1
          }}
        >
          {/* Operation Badge */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={<OperationIcon sx={{ fontSize: 16 }} />}
              label={getAuditOperationName(log.operation)}
              color={badgeColor}
              size="small"
              variant="outlined"
              data-testid="operation-badge"
            />
            {log.changedFields && log.changedFields.length > 0 && (
              <Chip
                label={`${log.changedFields.length} 个字段变更`}
                size="small"
                variant="soft"
                sx={{ 
                  bgcolor: 'action.hover',
                  fontSize: '0.75rem'
                }}
              />
            )}
          </Stack>

          {/* Expand/Collapse Button */}
          {log.changedFields && log.changedFields.length > 0 && (
            <Tooltip title={expanded ? '收起详情' : '查看变更'}>
              <IconButton
                onClick={onToggleExpand}
                size="small"
                aria-label={expanded ? '收起详情' : '展开详情'}
                data-testid="view-diff-btn"
                sx={{
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Metadata Row */}
        <Stack 
          direction="row" 
          spacing={3} 
          sx={{ mt: 2 }}
        >
          {/* Operator */}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography 
              variant="body2" 
              color="text.secondary"
              data-testid="operator-info"
            >
              {log.operator}
            </Typography>
          </Stack>

          {/* Timestamp */}
          <Stack direction="row" spacing={0.5} alignItems="center">
            <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Tooltip title={formatTimestamp(log.timestamp)}>
              <Typography 
                variant="body2" 
                color="text.secondary"
                data-testid="timestamp-info"
              >
                {formatRelativeTime(log.timestamp)}
              </Typography>
            </Tooltip>
          </Stack>

          {/* Asset Info */}
          {log.assetType && (
            <Chip
              label={log.assetType}
              size="small"
              variant="outlined"
              sx={{ height: 24, fontSize: '0.75rem' }}
            />
          )}
        </Stack>

        {/* Event ID for debugging */}
        <Typography 
          variant="caption" 
          color="text.disabled"
          sx={{ mt: 1, display: 'block' }}
        >
          事件ID: {log.eventId}
        </Typography>
      </CardContent>

      {/* Field Diff Section */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box 
          sx={{ 
            px: 3, 
            pb: 2,
            pt: 1,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'grey.50'
          }}
        >
          <Typography 
            variant="subtitle2" 
            sx={{ mb: 2, fontWeight: 600 }}
          >
            字段变更详情
          </Typography>
          <FieldDiffView changedFields={log.changedFields || []} />
        </Box>
      </Collapse>
    </Card>
  );
};

/**
 * AuditLogTimeline Component
 * 
 * Renders a vertical timeline of audit log entries with expandable
 * field-level diff views for @Auditable annotated fields.
 * 
 * @param props - Component props
 * @param props.logs - Array of audit log entries to display
 * @param props.onLogExpand - Optional callback when log expansion changes
 * @returns React component
 * 
 * @example
 * ```tsx
 * <AuditLogTimeline 
 *   logs={auditLogs} 
 *   onLogExpand={(id, expanded) => console.log(id, expanded)}
 * />
 * ```
 */
export const AuditLogTimeline: React.FC<AuditLogTimelineProps> = ({
  logs,
  onLogExpand
}) => {
  // Track expanded state for each log entry
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  /**
   * Toggle expanded state for a specific log entry
   */
  const handleToggleExpand = (eventId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      const isCurrentlyExpanded = next.has(eventId);
      
      if (isCurrentlyExpanded) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      
      // Notify parent if callback provided
      if (onLogExpand) {
        onLogExpand(eventId, !isCurrentlyExpanded);
      }
      
      return next;
    });
  };

  /**
   * Check if a log entry is expanded
   */
  const isExpanded = (eventId: string): boolean => {
    return expandedIds.has(eventId);
  };

  // Sort logs by timestamp (newest first)
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Empty state
  if (sortedLogs.length === 0) {
    return (
      <Box 
        sx={{ 
          textAlign: 'center', 
          py: 6,
          px: 3
        }}
        data-testid="audit-log-empty"
      >
        <Timeline />
        <Typography color="text.secondary" variant="body2">
          暂无审计日志记录
        </Typography>
        <Typography color="text.disabled" variant="caption">
          该资产暂无变更历史
        </Typography>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 11,
          top: 0,
          bottom: 0,
          width: 2,
          bgcolor: 'divider',
          borderRadius: 1,
        }
      }}
      data-testid="audit-log-timeline"
    >
      <Timeline
        sx={{
          p: 0,
          m: 0,
          '& .MuiTimelineItem-root': {
            minHeight: 'auto',
            '&:before': {
              display: 'none',
            },
          },
          '& .MuiTimelineDot-root': {
            m: 0,
            p: 0,
            bgcolor: 'transparent',
          },
          '& .MuiTimelineConnector-root': {
            bgcolor: 'transparent',
          },
          '& .MuiTimelineContent-root': {
            p: 0,
            pl: 3,
          },
        }}
      >
        {sortedLogs.map((log, index) => {
          const operationColor = getOperationColor(log.operation);
          const OperationIcon = OPERATION_ICONS[log.operation] || EditIcon;
          const isLast = index === sortedLogs.length - 1;

          return (
            <TimelineItem key={log.eventId}>
              <TimelineOppositeContent sx={{ display: 'none' }} />
              
              <TimelineSeparator>
                <TimelineDot
                  sx={{
                    bgcolor: operationColor,
                    width: 24,
                    height: 24,
                    boxShadow: 2,
                  }}
                >
                  <OperationIcon sx={{ fontSize: 14, color: 'white' }} />
                </TimelineDot>
                {!isLast && (
                  <TimelineSeparatorConnector 
                    sx={{ 
                      bgcolor: 'divider',
                      minHeight: 16,
                    }} 
                  />
                )}
              </TimelineSeparator>

              <TimelineContent>
                <AuditLogEntryCard
                  log={log}
                  expanded={isExpanded(log.eventId)}
                  onToggleExpand={() => handleToggleExpand(log.eventId)}
                />
              </TimelineContent>
            </TimelineItem>
          );
        })}
      </Timeline>
    </Box>
  );
};

export default AuditLogTimeline;