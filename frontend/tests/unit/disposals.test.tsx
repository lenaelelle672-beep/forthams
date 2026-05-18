import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Disposals } from '../../src/app/pages/Disposals';
import { disposalService } from '../../src/app/services/disposalService';

const navigate = vi.fn();

vi.mock('react-router', () => ({
  useNavigate: () => navigate,
}));

vi.mock('../../src/app/services/disposalService', () => ({
  disposalService: {
    getHistory: vi.fn(),
  },
}));

describe('Disposals page', () => {
  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(disposalService.getHistory).mockReset();
    vi.mocked(disposalService.getHistory).mockImplementation(async (params?: Record<string, unknown>) => ({
      records: params?.changeType === 'SCRAP'
        ? [{ id: 9, assetId: 1001, changeType: 'SCRAP', operatorId: 1, createTime: '2026-05-14', reason: '审批通过报废' }]
        : [],
    }));
  });

  it('loads backend disposal records by selected tab changeType', async () => {
    render(<Disposals />);

    fireEvent.click(screen.getByRole('button', { name: /资产报废转让/ }));

    await waitFor(() => {
      expect(disposalService.getHistory).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 50,
        changeType: 'SCRAP',
      });
    });
    expect(await screen.findByText('审批通过报废')).toBeInTheDocument();
    expect(screen.getAllByText('资产报废转让').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('暂无数据')).not.toBeInTheDocument();
  });
});
