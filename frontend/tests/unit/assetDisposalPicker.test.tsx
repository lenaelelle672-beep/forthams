import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AssetDisposalPicker } from '../../src/app/components/disposal/AssetDisposalPicker';
import { assetService } from '../../src/app/services/assetService';

vi.mock('../../src/app/services/assetService', () => ({
  assetService: {
    list: vi.fn(),
  },
}));

const mockAssets = [
  { id: 1, assetName: 'Laptop A', categoryName: 'IT', departmentName: 'Engineering', status: 'IN_USE' },
  { id: 2, assetName: 'Monitor B', categoryName: 'IT', departmentName: 'Marketing', status: 'IN_USE' },
  { id: 3, assetName: 'Printer C', categoryName: 'Office', departmentName: 'HR', status: 'IDLE' },
];

function makePagedResponse(records: typeof mockAssets, total = records.length) {
  return { records, total, size: 20, current: 1, pages: Math.ceil(total / 20) };
}

describe('AssetDisposalPicker', () => {
  beforeEach(() => {
    vi.mocked(assetService.list).mockReset();
  });

  it('calls assetService.list with keyword, page, pageSize on mount', async () => {
    vi.mocked(assetService.list).mockResolvedValue(makePagedResponse(mockAssets));

    const onSelect = vi.fn();
    render(<AssetDisposalPicker onSelect={onSelect} />);

    await waitFor(() => {
      expect(assetService.list).toHaveBeenCalledWith({
        keyword: undefined,
        page: 1,
        pageSize: 20,
      });
    });
  });

  it('renders asset rows from the API response', async () => {
    vi.mocked(assetService.list).mockResolvedValue(makePagedResponse(mockAssets));

    render(<AssetDisposalPicker onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('asset-row-1')).toBeInTheDocument();
      expect(screen.getByTestId('asset-row-2')).toBeInTheDocument();
      expect(screen.getByTestId('asset-row-3')).toBeInTheDocument();
    });

    expect(screen.getByText('Laptop A')).toBeInTheDocument();
    expect(screen.getByText('Monitor B')).toBeInTheDocument();
  });

  it('calls onSelect with the real assetId when user selects an asset', async () => {
    vi.mocked(assetService.list).mockResolvedValue(makePagedResponse(mockAssets));

    const onSelect = vi.fn();
    render(<AssetDisposalPicker onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByTestId('asset-row-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('asset-row-2'));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, assetName: 'Monitor B' }),
    );
  });

  it('sends keyword parameter when user searches', async () => {
    vi.mocked(assetService.list)
      .mockResolvedValueOnce(makePagedResponse(mockAssets))
      .mockResolvedValueOnce(makePagedResponse([mockAssets[0]]));

    render(<AssetDisposalPicker onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(assetService.list).toHaveBeenCalledTimes(1);
    });

    const input = screen.getByTestId('asset-search-input');
    fireEvent.change(input, { target: { value: 'Laptop' } });
    fireEvent.click(screen.getByTestId('asset-search-btn'));

    await waitFor(() => {
      expect(assetService.list).toHaveBeenLastCalledWith({
        keyword: 'Laptop',
        page: 1,
        pageSize: 20,
      });
    });
  });

  it('requests next page when next button is clicked', async () => {
    const manyAssets = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      assetName: `Asset ${i + 1}`,
      categoryName: 'IT',
      departmentName: 'Dept',
      status: 'IN_USE',
    }));

    vi.mocked(assetService.list)
      .mockResolvedValueOnce(makePagedResponse(manyAssets, 25))
      .mockResolvedValueOnce(makePagedResponse([mockAssets[0]], 25));

    render(<AssetDisposalPicker onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('asset-picker-next')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('asset-picker-next'));

    await waitFor(() => {
      expect(assetService.list).toHaveBeenLastCalledWith({
        keyword: undefined,
        page: 2,
        pageSize: 20,
      });
    });
  });

  it('shows empty state message when no assets found', async () => {
    vi.mocked(assetService.list).mockResolvedValue(makePagedResponse([], 0));

    render(<AssetDisposalPicker onSelect={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('asset-picker-message')).toHaveTextContent('未查询到可选资产');
    });
  });
});
