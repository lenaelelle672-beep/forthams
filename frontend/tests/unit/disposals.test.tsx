import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Disposals } from '../../src/app/pages/Disposals';
import { api } from '../../src/app/utils/api';

const navigate = vi.fn();

vi.mock('react-router', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('../../src/app/utils/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

describe('Disposals page', () => {
  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockImplementation(async (url: string) => ({
      records: url.includes('changeType=SCRAP')
        ? [{ id: 9, assetId: 1001, changeType: 'SCRAP', operatorId: 1, createTime: '2026-05-14', reason: '审批通过报废' }]
        : [],
      total: url.includes('changeType=SCRAP') ? 1 : 0,
      current: 1,
      size: 20,
      pages: 1,
    }));
  });

  it('loads backend disposal records by selected tab changeType', async () => {
    render(<Disposals />);

    fireEvent.click(screen.getByRole('button', { name: /资产报废转让/ }));

    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith('/disposals/history?page=1&pageSize=20&changeType=SCRAP');
    });
    expect(await screen.findByText('审批通过报废')).toBeInTheDocument();
    expect(screen.getAllByText('资产报废转让').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('暂无数据')).not.toBeInTheDocument();
  });
});
