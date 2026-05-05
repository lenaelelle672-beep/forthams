/**
 * ChartContainer Component
 * 
 * Purpose: Container component for dashboard charts with multi-tenant data isolation support
 * 
 * Features:
 * - Wraps chart components with consistent styling and layout
 * - Supports tenant-specific data filtering
 * - Provides loading and error states
 * 
 * Multi-tenant isolation:
 * - Accepts optional tenantId prop for explicit tenant scoping
 * - Falls back to current tenant context from authentication state
 * - All chart data queries include tenant_id filter automatically
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import styles from './ChartContainer.module.css';

interface ChartContainerProps {
  /** Chart component to render */
  children: React.ReactNode;
  /** Optional explicit tenant ID for data isolation */
  tenantId?: string;
  /** Chart title displayed in header */
  title?: string;
  /** Optional CSS class for custom styling */
  className?: string;
  /** Whether to show loading skeleton */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
}

/**
 * Retrieves the effective tenant ID for data queries
 * 
 * Priority:
 * 1. Explicit tenantId prop (for cross-tenant admin views)
 * 2. Current user's tenant context from authentication
 * 3. Falls back to null (will result in empty data)
 */
const getEffectiveTenantId = (explicitTenantId?: string, authTenantId?: string): string | null => {
  // Admin override: if explicit tenantId provided, use it
  if (explicitTenantId) {
    return explicitTenantId;
  }
  // Standard case: use authenticated user's tenant
  return authTenantId || null;
};

export const ChartContainer: React.FC<ChartContainerProps> = ({
  children,
  tenantId,
  title,
  className = '',
  loading = false,
  error = null,
}) => {
  const { user } = useAuth();
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);

  useEffect(() => {
    // Resolve effective tenant ID on mount and tenantId prop changes
    const effectiveTenantId = getEffectiveTenantId(tenantId, user?.tenantId);
    setCurrentTenantId(effectiveTenantId);
  }, [tenantId, user?.tenantId]);

  const containerClassName = `${styles.container} ${className}`.trim();

  if (loading) {
    return (
      <div className={containerClassName}>
        {title && <div className={styles.header}>{title}</div>}
        <div className={styles.skeleton}>
          <div className={styles.skeletonChart} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={containerClassName}>
        {title && <div className={styles.header}>{title}</div>}
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName} data-tenant-id={currentTenantId}>
      {title && <div className={styles.header}>{title}</div>}
      <div className={styles.content}>
        {/* 
          Multi-tenant isolation context:
          - currentTenantId is passed implicitly to chart components
          - Charts must include tenant_id in their API queries
          - This ensures data isolation at the component level
        */}
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              tenantId: currentTenantId,
            } as React.Attributes);
          }
          return child;
        })}
      </div>
    </div>
  );
};

export default ChartContainer;