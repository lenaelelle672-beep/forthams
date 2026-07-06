import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FaultCodeSelector from './FaultCodeSelector';

vi.mock('@/api/faultCode', () => ({
  getFaultCodeTree: vi.fn(),
  getFaultCodeChildren: vi.fn(),
}));

import { getFaultCodeChildren, getFaultCodeTree } from '@/api/faultCode';

const mockedGetFaultCodeTree = vi.mocked(getFaultCodeTree);
const mockedGetFaultCodeChildren = vi.mocked(getFaultCodeChildren);

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  );
}

describe('FaultCodeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads unwrapped fault code arrays and emits the selected third-level code', async () => {
    const onChange = vi.fn();
    mockedGetFaultCodeTree.mockResolvedValue([
      { id: 1, code: 'P01', faultPhenomenon: '异响', status: 'ACTIVE' },
    ] as never);
    mockedGetFaultCodeChildren
      .mockResolvedValueOnce([
        { id: 2, code: 'C01', faultCause: '轴承磨损', parentId: 1, status: 'ACTIVE' },
      ] as never)
      .mockResolvedValueOnce([
        { id: 3, code: 'S01', solution: '更换轴承', parentId: 2, status: 'ACTIVE' },
      ] as never);

    renderWithQueryClient(<FaultCodeSelector onChange={onChange} />);

    await screen.findByRole('option', { name: /\[P01\] 异响/ });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '1' } });

    await waitFor(() => {
      expect(screen.getAllByRole('combobox')).toHaveLength(2);
    });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '2' } });

    await waitFor(() => {
      expect(screen.getAllByRole('combobox')).toHaveLength(3);
    });
    fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: '3' } });

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(3, 'P01 / C01 / S01');
    });
  });
});
