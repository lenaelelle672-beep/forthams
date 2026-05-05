/**
 * Custom hook for fetching and managing asset data by ID.
 * Integrates with AuditService for audit log binding and Graphify knowledge graph support.
 * 
 * @module useAssetById
 * @version 1.0.0
 * @author SWARM-051 Integration Team
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { assetService } from '../services/assetService';
import { auditService } from '../services/auditService';
import type { Asset } from '../types/asset.types';
import type { AuditLog, AuditQuery } from '../types/audit.types';

/**
 * Configuration options for the useAssetById hook.
 * 
 * @interface UseAssetByIdOptions
 */
export interface UseAssetByIdOptions {
  /** Enable audit log fetching on mount */
  fetchAuditLogs?: boolean;
  /** Maximum number of audit logs to fetch */
  auditLogLimit?: number;
  /** Enable Graphify nodes integration */
  enableGraphify?: boolean;
}

/**
 * State structure returned by the useAssetById hook.
 * 
 * @interface UseAssetByIdReturn
 */
export interface UseAssetByIdReturn {
  /** Currently selected asset data */
  asset: Asset | null;
  /** Associated audit logs for the asset */
  auditLogs: AuditLog[];
  /** Graphify knowledge graph nodes related to the asset */
  graphifyNodes: GraphifyNode[];
  /** Loading state for asset data */
  loading: boolean;
  /** Loading state for audit logs */
  auditLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Callback to refresh asset data */
  refreshAsset: () => Promise<void>;
  /** Callback to refresh audit logs */
  refreshAuditLogs: () => Promise<void>;
}

/**
 * Graphify node structure for knowledge graph visualization.
 * 
 * @interface GraphifyNode
 */
export interface GraphifyNode {
  /** Unique identifier for the node */
  id: string;
  /** Display label for the node */
  label: string;
  /** Node type (entity type) */
  type: string;
  /** Associated asset ID if applicable */
  assetId?: string;
  /** Node properties */
  properties: Record<string, unknown>;
  /** Connection status */
  connected: boolean;
}

/**
 * Custom hook for fetching and managing asset data by ID.
 * 
 * This hook provides a unified interface for:
 * - Fetching asset details by ID
 * - Loading associated audit logs
 * - Integrating with Graphify knowledge graph
 * 
 * @param {string | null} assetId - The ID of the asset to fetch
 * @param {UseAssetByIdOptions} [options] - Configuration options
 * @returns {UseAssetByIdReturn} Hook state and callbacks
 * 
 * @example
 * ```typescript
 * const { asset, auditLogs, graphifyNodes, loading } = useAssetById('asset-123', {
 *   fetchAuditLogs: true,
 *   enableGraphify: true
 * });
 * ```
 */
export function useAssetById(
  assetId: string | null,
  options: UseAssetByIdOptions = {}
): UseAssetByIdReturn {
  const {
    fetchAuditLogs = true,
    auditLogLimit = 100,
    enableGraphify = true
  } = options;

  // State management
  const [asset, setAsset] = useState<Asset | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [graphifyNodes, setGraphifyNodes] = useState<GraphifyNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetches asset data from the API.
   * Updates state with fetched asset or sets error state.
   * 
   * @returns {Promise<void>}
   */
  const fetchAsset = useCallback(async (): Promise<void> => {
    if (!assetId) {
      setAsset(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await assetService.getAssetById(assetId);
      setAsset(response.data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch asset');
      setError(error);
      setAsset(null);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  /**
   * Fetches audit logs associated with the current asset.
   * Integrates with AuditService for audit trail binding.
   * 
   * @returns {Promise<void>}
   */
  const fetchAuditLogsData = useCallback(async (): Promise<void> => {
    if (!assetId || !fetchAuditLogs) {
      setAuditLogs([]);
      return;
    }

    setAuditLoading(true);

    try {
      const query: AuditQuery = {
        entityType: 'Asset',
        entityId: assetId,
        limit: auditLogLimit,
        includeGraphify: enableGraphify
      };

      const response = await auditService.queryAuditLogs(query);
      setAuditLogs(response.logs || []);

      // Process Graphify nodes from audit data
      if (enableGraphify && response.graphifyNodes) {
        setGraphifyNodes(response.graphifyNodes);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setAuditLogs([]);
      // Don't throw - audit logs are supplementary data
    } finally {
      setAuditLoading(false);
    }
  }, [assetId, fetchAuditLogs, auditLogLimit, enableGraphify]);

  /**
   * Refreshes asset data from the API.
   * 
   * @returns {Promise<void>}
   */
  const refreshAsset = useCallback(async (): Promise<void> => {
    await fetchAsset();
  }, [fetchAsset]);

  /**
   * Refreshes audit logs for the current asset.
   * 
   * @returns {Promise<void>}
   */
  const refreshAuditLogs = useCallback(async (): Promise<void> => {
    await fetchAuditLogsData();
  }, [fetchAuditLogsData]);

  // Effect to fetch asset when assetId changes
  useEffect(() => {
    fetchAsset();
  }, [fetchAsset]);

  // Effect to fetch audit logs when assetId or options change
  useEffect(() => {
    fetchAuditLogsData();
  }, [fetchAuditLogsData]);

  // Memoized return value to prevent unnecessary re-renders
  const returnValue: UseAssetByIdReturn = useMemo(() => ({
    asset,
    auditLogs,
    graphifyNodes,
    loading,
    auditLoading,
    error,
    refreshAsset,
    refreshAuditLogs
  }), [
    asset,
    auditLogs,
    graphifyNodes,
    loading,
    auditLoading,
    error,
    refreshAsset,
    refreshAuditLogs
  ]);

  return returnValue;
}

export default useAssetById;