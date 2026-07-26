import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCatalogPage, type CatalogListResult } from '../useCatalogPage';

type Item = { id: string };

/**
 * Builds a controllable listFn whose promises we can resolve/reject manually,
 * so the stale-response guard can be tested deterministically. Do NOT call
 * `mockImplementation`/`mockResolvedValueOnce` on the returned spy — record
 * responses via `queue()` instead so the original promise-creating logic stays
 * intact and the `calls`/`pending` bookkeeping stays consistent.
 */
function makeControllableListFn<T extends Item>() {
  type Q = { page: number; pageSize: number } & Record<string, unknown>;
  const calls: Q[] = [];
  const pending: Array<{
    query: Q;
    resolve: (v: CatalogListResult<T>) => void;
    reject: (e: unknown) => void;
  }> = [];
  // Pre-queued responses ( FIFO ). Each fetch consumes the next one; if none is
  // queued the promise stays pending until resolved manually via `settle`.
  const queued: Array<{ kind: 'resolve'; value: CatalogListResult<T> } | { kind: 'reject'; err: unknown }> = [];
  const listFn = vi.fn((query: Q) => {
    calls.push({ ...query });
    return new Promise<CatalogListResult<T>>((resolve, reject) => {
      const next = queued.shift();
      if (next) {
        if (next.kind === 'resolve') resolve(next.value);
        else reject(next.err);
        return;
      }
      pending.push({ query, resolve, reject });
    });
  });
  const queue = (value: CatalogListResult<T>) => queued.push({ kind: 'resolve', value });
  const queueReject = (err: unknown) => queued.push({ kind: 'reject', err });
  const settle = (
    fn: 'resolve' | 'reject',
    value?: CatalogListResult<T> | unknown,
    indexFromEnd = 0,
  ) => {
    const target = pending[pending.length - 1 - indexFromEnd];
    if (!target) throw new Error('no pending listFn call to settle');
    pending.splice(pending.length - 1 - indexFromEnd, 1);
    if (fn === 'resolve') target.resolve(value as CatalogListResult<T>);
    else target.reject(value);
  };
  return { listFn, calls, pending, queue, queueReject, settle };
}

describe('useCatalogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts and loads the first page with default params', async () => {
    const listFn = vi.fn(async () => ({
      records: [{ id: 'a' }, { id: 'b' }] as Item[],
      total: 2,
    }));

    const { result } = renderHook(() =>
      useCatalogPage<Item>({ listFn, initialPageSize: 20, canView: true }),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.records).toEqual([]);
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(20);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.records).toHaveLength(2);
    expect(result.current.total).toBe(2);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.error).toBeNull();
    expect(listFn).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('changes page via setPage and refetches', async () => {
    const listFn = vi.fn(async (q: { page: number }) =>
      q.page === 1
        ? { records: Array.from({ length: 20 }, (_, i) => ({ id: `p1-${i}` })), total: 25 }
        : { records: [{ id: 'p2-0' }] as Item[], total: 25 },
    );

    const { result } = renderHook(() =>
      useCatalogPage<Item>({ listFn, initialPageSize: 20, canView: true }),
    );

    await waitFor(() => expect(result.current.records).toHaveLength(20));
    expect(result.current.totalPages).toBe(2);
    expect(result.current.page).toBe(1);

    act(() => {
      result.current.setPage(2);
    });

    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() => expect(result.current.records).toEqual([{ id: 'p2-0' }]));
    expect(listFn).toHaveBeenCalledTimes(2);
    expect(listFn).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 20 });
  });

  it('redacts any backend error to a generic message', async () => {
    const listFn = vi.fn(async () => {
      throw new Error('db password is hunter2');
    });

    const { result } = renderHook(() =>
      useCatalogPage<Item>({ listFn, initialPageSize: 20, canView: true }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('敏感细节已脱敏');
    expect(result.current.records).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it('discards stale responses when a newer load supersedes them', async () => {
    // First load (page 1): stays pending. Immediately setPage(2); the page-2
    // response must win even if the page-1 promise resolves last.
    const { listFn, calls, settle } = makeControllableListFn<Item>();

    const { result } = renderHook(() =>
      useCatalogPage<Item>({ listFn, initialPageSize: 20, canView: true }),
    );

    // Wait for the page-1 promise to be created, then advance to page 2.
    await waitFor(() => expect(listFn).toHaveBeenCalledTimes(1));
    act(() => {
      result.current.setPage(2);
    });
    await waitFor(() => expect(listFn).toHaveBeenCalledTimes(2));

    // Resolve the page-2 response first (the winning one).
    settle('resolve', { records: [{ id: 'fresh-2' }], total: 25 }, 0);
    // Then resolve the stale page-1 response — must be ignored.
    settle('resolve', { records: Array.from({ length: 20 }, (_, i) => ({ id: `stale-${i}` })), total: 25 }, 0);

    await waitFor(() => expect(result.current.records).toEqual([{ id: 'fresh-2' }]));
    expect(result.current.page).toBe(2);
    expect(result.current.loading).toBe(false);
    // Stale page-1 data never lands.
    expect(result.current.records.every((r) => r.id.startsWith('stale'))).toBe(false);
    expect(calls.map((c) => c.page)).toEqual([1, 2]);
  });

  it('skips fetching when canView is false', () => {
    const listFn = vi.fn(async () => ({ records: [] as Item[], total: 0 }));
    const { result } = renderHook(() =>
      useCatalogPage<Item>({ listFn, initialPageSize: 20, canView: false }),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.records).toEqual([]);
    expect(listFn).not.toHaveBeenCalled();
  });

  it('search applies a new query and resets to page 1', async () => {
    const listFn = vi.fn(
      async (q: { page: number; pageSize: number; keyword?: string }) => ({
        records: [{ id: `p${q.page}-kw-${q.keyword ?? 'none'}` }] as Item[],
        total: 1,
      }),
    );

    const { result } = renderHook(() =>
      useCatalogPage<Item>({ listFn, initialPageSize: 20, canView: true }),
    );

    await waitFor(() => expect(result.current.records).toHaveLength(1));
    expect(listFn).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 20 });

    act(() => {
      result.current.setPage(2);
    });
    await waitFor(() => expect(result.current.page).toBe(2));

    act(() => {
      result.current.search({ keyword: 'abc' });
    });

    await waitFor(() => expect(result.current.page).toBe(1));
    await waitFor(() =>
      expect(result.current.records).toEqual([{ id: 'p1-kw-abc' }]),
    );
    expect(result.current.currentQuery).toMatchObject({ keyword: 'abc' });
    expect(listFn).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, keyword: 'abc' });
  });

  it('reload re-fetches the current page once a previous load completed', async () => {
    const { listFn, queue, pending } = makeControllableListFn<Item>();
    queue({ records: [{ id: 'x' }], total: 1 });

    const { result } = renderHook(() =>
      useCatalogPage<Item>({ listFn, initialPageSize: 20, canView: true }),
    );

    await waitFor(() => expect(listFn).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // A reload once idle triggers exactly one more fetch.
    act(() => {
      result.current.reload();
    });
    await waitFor(() => expect(listFn).toHaveBeenCalledTimes(2));
    expect(pending).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('reload guard: a reload issued while loading is suppressed', async () => {
    // Keep the first load pending so `loading` stays true.
    const { listFn, pending } = makeControllableListFn<Item>();

    const { result } = renderHook(() =>
      useCatalogPage<Item>({ listFn, initialPageSize: 20, canView: true }),
    );

    await waitFor(() => expect(listFn).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(true);
    expect(pending).toHaveLength(1);

    // Reload while the first request is still in flight — must be ignored.
    act(() => {
      result.current.reload();
      result.current.reload();
    });

    // No additional fetch should have been kicked off.
    expect(listFn).toHaveBeenCalledTimes(1);
  });
});
