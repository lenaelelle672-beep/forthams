/**
 * Asset Import & Export Type Definitions
 *
 * Type definitions for the asset bulk import/export feature (SWARM-P2-006-FE).
 * Covers data structures for Excel template download, file upload/parse,
 * row-level validation preview, commit, and conditional export.
 */

// ============================================================
// Import — Core Data Types
// ============================================================

/**
 * Represents a single row of parsed asset data from the uploaded Excel file.
 * Each row corresponds to one asset record to be imported.
 *
 * Spec reference: AssetRow structure in Data Constraints.
 */
export interface AssetRow {
  /** Row number in the original Excel file (1-indexed) */
  rowNumber: number;
  /** Asset name */
  name: string;
  /** Asset category code */
  categoryCode: string;
  /** Asset status code */
  statusCode: string;
  /** Storage location code */
  locationCode: string;
  /** Purchase date string (e.g. "2024-01-15") */
  purchaseDate: string;
  /** Original asset value (monetary) */
  originalValue: number;
  /** Additional extensible fields from the Excel template */
  [key: string]: unknown;
}

/**
 * Represents a validation error on a specific field of a specific row.
 * Displayed as inline red text next to the offending cell in the preview table.
 *
 * Spec reference: RowError structure in Data Constraints.
 */
export interface RowError {
  /** Row number in the original Excel file (1-indexed) */
  rowNumber: number;
  /** The field name that failed validation (must match an AssetRow key) */
  field: string;
  /** Human-readable error message describing the validation failure */
  message: string;
}

/**
 * Response from POST /api/assets/import/parse.
 * Contains the parsed rows and any row-level validation errors.
 *
 * Spec reference: Parse return data structure in Data Constraints.
 */
export interface ParseResponse {
  /** Unique identifier for this parse session, required for commit */
  parseId: string;
  /** All parsed asset rows from the uploaded file */
  rows: AssetRow[];
  /** Row-level validation errors (may be empty if all rows are valid) */
  errors: RowError[];
}

/**
 * Request payload for POST /api/assets/import/commit.
 * Includes user-corrected rows after preview editing.
 *
 * Spec reference: Submit request structure in Data Constraints.
 */
export interface ImportCommitRequest {
  /** The parse session identifier from ParseResponse */
  parseId: string;
  /** The (potentially user-modified) asset rows to finalize import */
  rows: AssetRow[];
}

/**
 * Response from POST /api/v1/assets/import/commit.
 *
 * Spec reference: ATB-011 expected response format.
 */
export interface ImportCommitResponse {
  /** Whether the overall import operation was accepted */
  success: boolean;
  /** Number of rows successfully imported into the system */
  importedCount: number;
  /** Number of rows that failed to import */
  failedCount: number;
}

// ============================================================
// Export — Core Data Types
// ============================================================

/**
 * Request payload for POST /api/assets/export.
 * All filter dimensions are optional; empty arrays mean "no filter".
 * The endpoint returns a binary file stream (application/octet-stream).
 *
 * Spec reference: Export request structure in Data Constraints.
 */
export interface ExportRequest {
  /** Asset category codes to filter by (empty = all categories) */
  categoryCodes: string[];
  /** Asset status codes to filter by (empty = all statuses) */
  statusCodes: string[];
  /** Location codes to filter by (empty = all locations) */
  locationCodes: string[];
}

// ============================================================
// File Validation Types (Layer 0.3)
// ============================================================

/**
 * Result of client-side file validation (type + size checks).
 *
 * Spec reference: Layer 0.3 — validateUploadFile(file) returns { valid, message }.
 */
export interface FileValidationResult {
  /** Whether the file passed all client-side checks */
  valid: boolean;
  /** Error message if validation failed; empty string if valid */
  message: string;
}

/** Maximum allowed upload file size in bytes (10 MB) */
export const MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024; // 10,485,760 bytes

/** Allowed upload file extension */
export const ALLOWED_UPLOAD_EXTENSION = '.xlsx';

/** Allowed upload MIME type */
export const ALLOWED_UPLOAD_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ============================================================
// Upload State Types
// ============================================================

/**
 * Represents the current phase of the file upload lifecycle.
 * Used to drive the progress bar UI and button enable/disable states.
 */
export type UploadStatus = 'idle' | 'uploading' | 'parsing' | 'success' | 'error';

/**
 * Tracks upload progress for the progress bar component.
 * Bound to axios onUploadProgress callback.
 */
export interface UploadProgress {
  /** Current upload phase */
  status: UploadStatus;
  /** Upload progress percentage (0–100) */
  percent: number;
}

// ============================================================
// Preview Table — Extended Row Type
// ============================================================

/**
 * Extended row for the editable preview table.
 * Wraps AssetRow with client-side validation and correction tracking state.
 */
export interface PreviewRow extends AssetRow {
  /** Whether this row has any unresolved validation errors */
  hasErrors: boolean;
  /** Whether the user has manually edited any field on this row */
  isCorrected: boolean;
  /**
   * Map of field names to their current error messages.
   * Key = AssetRow field name, Value = error message string.
   * Empty object means no errors for this row.
   * When the user edits a field, the corresponding entry is removed.
   */
  fieldErrors: Record<string, string>;
}

// ============================================================
// Export Panel — Filter Data Source Types
// ============================================================

/**
 * Tree node for the asset category TreeSelect component.
 * Data source: GET /api/categories/tree
 */
export interface CategoryTreeNode {
  /** Category code used as the select value */
  value: string;
  /** Display label for the tree node */
  title: string;
  /** Nested child category nodes */
  children?: CategoryTreeNode[];
}

/**
 * Cascader option for the location Cascader component.
 * Data source: GET /api/locations/cascade
 */
export interface LocationCascaderOption {
  /** Location code used as the cascader value */
  value: string;
  /** Display label for the cascader option */
  label: string;
  /** Nested child location options (e.g. province → city → district) */
  children?: LocationCascaderOption[];
}

/**
 * Option for the asset status multi-select dropdown.
 * Hard-coded on the frontend per spec.
 */
export interface StatusOption {
  /** Status code used as the select value */
  value: string;
  /** Display label */
  label: string;
}

/** Pre-defined asset status options for the export filter panel */
export const ASSET_STATUS_OPTIONS: StatusOption[] = [
  { value: 'IN_USE', label: '在用' },
  { value: 'IDLE', label: '闲置' },
  { value: 'MAINTENANCE', label: '维修中' },
  { value: 'SCRAPPED', label: '报废' },
];