import React from 'react';

/**
 * Import lifecycle states as defined in the SPEC:
 *   idle -> uploading -> parsing -> preview -> submitting -> completed
 *   Any stage may transition to "error" on failure.
 */
export type ImportStatus =
  | 'idle'
  | 'uploading'
  | 'parsing'
  | 'preview'
  | 'submitting'
  | 'completed'
  | 'error';

/** Props for the ProgressBar component. */
export interface ProgressBarProps {
  /** Upload / processing progress percentage (0-100). */
  progress: number;
  /** Current lifecycle stage. */
  status: ImportStatus;
  /** Optional informational message displayed below the bar. */
  message?: string;
  /** Error details shown when status is "error". */
  errorMessage?: string;
}

/**
 * ProgressBar — visual feedback widget for the asset import workflow.
 *
 * Displays a coloured progress bar together with a status indicator that
 * reflects the current import lifecycle stage.  When `progress` reaches 100 %
 * but the status is still `parsing`, a "waiting for server" hint is shown so
 * the user understands why the submit button is disabled (SPEC: interaction-
 * state constraint).
 */
const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  status,
  message,
  errorMessage,
}) => {
  /* ------------------------------------------------------------------ */
  /*  Helpers                                                           */
  /* ------------------------------------------------------------------ */

  /** Tailwind colour class for the filled portion of the bar. */
  const barColorClass = (): string => {
    switch (status) {
      case 'uploading':
        return 'bg-blue-500';
      case 'parsing':
        return 'bg-amber-500 animate-pulse';
      case 'preview':
        return 'bg-indigo-500';
      case 'submitting':
        return 'bg-blue-500 animate-pulse';
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'idle':
      default:
        return 'bg-gray-200';
    }
  };

  /** Human-readable label for the current stage. */
  const statusLabel = (): string => {
    switch (status) {
      case 'idle':
        return 'Ready';
      case 'uploading':
        return 'Uploading…';
      case 'parsing':
        return 'Parsing…';
      case 'preview':
        return 'Preview';
      case 'submitting':
        return 'Submitting…';
      case 'completed':
        return '✓ Complete';
      case 'error':
        return '✕ Error';
    }
  };

  /** Tailwind text colour class for the status label. */
  const labelColorClass = (): string => {
    switch (status) {
      case 'uploading':
      case 'submitting':
        return 'text-blue-600';
      case 'parsing':
        return 'text-amber-600';
      case 'preview':
        return 'text-indigo-600';
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Status icon                                                       */
  /* ------------------------------------------------------------------ */

  const StatusIcon: React.FC = () => {
    switch (status) {
      case 'uploading':
        return (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
          </span>
        );
      case 'parsing':
      case 'submitting':
        return (
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
        );
      case 'completed':
        return <span className="text-green-600 text-sm">✓</span>;
      case 'error':
        return <span className="text-red-600 text-sm">✕</span>;
      default:
        return null;
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */

  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className="w-full space-y-3 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
      {/* ---- Status header row ---- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon />
          <span className={`text-sm font-medium ${labelColorClass()}`}>
            {statusLabel()}
          </span>
        </div>

        <span
          className={`text-xs font-mono ${
            clampedProgress === 100 && status === 'completed'
              ? 'text-green-600'
              : 'text-slate-500'
          }`}
        >
          {clampedProgress}%
        </span>
      </div>

      {/* ---- Progress track ---- */}
      <div
        className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Upload progress"
      >
        <div
          className={`h-full transition-all duration-500 ease-out ${barColorClass()}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>

      {/* ---- Parsing wait hint (SPEC: interaction-state constraint) ---- */}
      {status === 'parsing' && clampedProgress >= 100 && (
        <div className="flex items-center gap-2 mt-3 p-2 bg-amber-50 rounded border border-amber-100">
          <span className="text-[11px] text-amber-700 font-medium uppercase tracking-wider">
            Server is validating data rows — please wait
          </span>
        </div>
      )}

      {/* ---- Informational message ---- */}
      {message && status !== 'error' && (
        <p className="text-xs mt-2 px-1 text-slate-600 italic">{message}</p>
      )}

      {/* ---- Error details ---- */}
      {status === 'error' && errorMessage && (
        <div className="mt-3 p-2 bg-red-50 rounded border border-red-100">
          <p className="text-[11px] text-red-700 font-medium mb-1">
            Error Details:
          </p>
          <p className="text-xs text-red-600 line-clamp-3">{errorMessage}</p>
        </div>
      )}
    </div>
  );
};

export default ProgressBar;