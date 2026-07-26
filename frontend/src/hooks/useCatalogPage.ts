/**
 * useCatalogPage Hook
 *
 * Extracts the ~80-90 lines of catalog workbench boilerplate duplicated across
 * the V3 read-only catalog pages (state management, load function, useEffect
 * with `ignored` stale-response guard, pagination + reload handlers, error
 * redaction). The hook is intentionally generic: it knows nothing about specific
 * record types or filter fields. Callers own their filter UI and pass a `listFn`
 * that already understands the query shape for their domain.
 *
 * @module hooks/useCatalogPage
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Result returned by a catalog list endpoint.
 */
export interface CatalogListResult<T> {
  records: T[];
  total: number;
  current?: number;
  pages?: number;
}

/**
 * Options accepted by {@link useCatalogPage}.
 *
 * @property listFn        - Fetches a page of records. Receives the active query
 *                          merged with `{ page, pageSize }` and should return
 *                          `{ records, total, current?, pages? }`.
 * @property initialPageSize - Page size for the first load (defaults to 20).
 * @property canView       - When `false`, the hook skips fetching entirely and
 *                           surfaces no data (mirrors the page-level permission gate).
 */
export interface UseCatalogPageOptions<T, Q> {
  listFn: (
    query: Q & { page: number; pageSize: number },
  ) => Promise<CatalogListResult<T>>;
  initialPageSize?: number;
  canView?: boolean;
}

/**
 * Stable handle returned by {@link useCatalogPage}.
 */
export interface UseCatalogPageReturn<T> {
  records: T[];
  total: number;
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Jump to an arbitrary page (clamped to `[1, totalPages]`). */
  setPage: (p: number) => void;
  /** Re-run the current query without changing page. No-op while loading. */
  reload: () => void;
  /** Apply a new query (filters/keyword) and reset to page 1. */
  search: (query: Record<string, unknown>) => void;
  /** Reset filters to empty and return to page 1. */
  resetPage: () => void;
  /** Convenience helpers wired up for prev/next buttons (no-op while loading). */
  prevPage: () => void;
  nextPage: () => void;
}

/**
 * Generic error surfaced to the UI for any catalog failure. The underlying
 * message is intentionally discarded so sensitive backend details are never
 * leaked to the page.
 */
const REDACTED_ERROR = '敏感细节已脱敏';

/**
 * Reusable catalog page hook.
 *
 * All fetching flows through a single effect keyed on `[canView, page,
 * loadToken]`; `search`, `reload`, and the pagination helpers simply mutate the
 * relevant state to retrigger that effect. This avoids the double-fetch races
 * present when a page keeps both an effect and a manual load function. An
 * `ignored` flag inside the effect discards responses from superseded loads so
 * a slow page-N response cannot clobber data after the user has moved on.
 *
 * @example
 * ```tsx
 * const { records, total, page, totalPages, loading, error, setPage, reload } =
 *   useCatalogPage<TenantRecord, TenantQuery>({
 *     listFn: (query) => listTenants(query),
 *     initialPageSize: 20,
 *     canView,
 *   });
 * ```
 */
export function useCatalogPage<T, Q extends Record<string, unknown> = Record<string, unknown>>(
  options: UseCatalogPageOptions<T, Q>,
): UseCatalogPageReturn<T> & { currentQuery: Q } {
  const { listFn, initialPageSize = 20, canView = true } = options;

  const [records, setRecords] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(1);
  const [pageSize] = useState(initialPageSize);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);
  // Monotonic token bumped to force a refetch without changing page/query.
  const [loadToken, setLoadToken] = useState(0);

  // Active query owned by the hook (filter fields chosen via `search`). Kept in
  // a ref so the effect dependency list stays minimal; `loadToken` triggers the
  // actual refetch when the query mutates.
  const queryRef = useRef<Q>({} as Q);
  // `listFn` is stored in a ref so a caller passing an inline arrow function
  // does not retrigger the effect on every render. We always invoke the latest.
  const listFnRef = useRef(listFn);
  listFnRef.current = listFn;
  // Reflects whether a load is in flight, for the `reload`/pagination guards.
  const loadingRef = useRef(canView);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Single source of truth for fetching: mount, page change, and forced
  // reloads (via loadToken) all funnel through here.
  useEffect(() => {
    if (!canView) {
      loadingRef.current = false;
      setLoading(false);
      return;
    }
    let ignored = false;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    listFnRef
      .current({ ...queryRef.current, page, pageSize })
      .then((data) => {
        if (ignored) return;
        setRecords(data?.records ?? []);
        setTotal(data?.total ?? 0);
      })
      .catch(() => {
        if (!ignored) {
          setRecords([]);
          setTotal(0);
          setError(REDACTED_ERROR);
        }
      })
      .finally(() => {
        loadingRef.current = false;
        if (!ignored) {
          setLoading(false);
        }
      });

    return () => {
      ignored = true;
    };
  }, [canView, page, pageSize, loadToken]);

  const setPage = useCallback((p: number) => {
    // Do NOT clamp against `totalPages`: total may still be 0 during the very
    // first load, which would make any forward navigation impossible. Callers
    // bound the page in their UI via `page <= 1` / `page >= totalPages` (which
    // read settled state). We only floor at 1 to stay 1-indexed.
    setPageState(Math.max(1, Math.floor(p)));
  }, []);

  const reload = useCallback(() => {
    // `loading` guard on reload: avoid stacking concurrent requests.
    if (loadingRef.current) return;
    setLoadToken((n) => n + 1);
  }, []);

  const search = useCallback((query: Record<string, unknown>) => {
    queryRef.current = { ...(query as Q) };
    setPageState(1);
    setLoadToken((n) => n + 1);
  }, []);

  const resetPage = useCallback(() => {
    queryRef.current = {} as Q;
    setPageState(1);
    setLoadToken((n) => n + 1);
  }, []);

  const prevPage = useCallback(() => {
    if (page <= 1 || loadingRef.current) return;
    setPageState((p) => Math.max(1, p - 1));
  }, [page]);

  const nextPage = useCallback(() => {
    if (page >= totalPages || loadingRef.current) return;
    setPageState((p) => Math.min(totalPages, p + 1));
  }, [page, totalPages]);

  return {
    records,
    total,
    loading,
    error,
    page,
    pageSize,
    totalPages,
    setPage,
    reload,
    search,
    resetPage,
    prevPage,
    nextPage,
    currentQuery: queryRef.current,
  };
}

export default useCatalogPage;
