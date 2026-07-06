import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VendorPortalPage from './VendorPortalPage';
import http from '@/utils/http';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockedHttp = vi.mocked(http);

describe('VendorPortalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockedHttp.get.mockResolvedValue([]);
  });

  it('loads vendor contracts with the vendor portal token header', async () => {
    localStorage.setItem('vendor_token', 'vendor-token');
    localStorage.setItem('vendor_id', '7');
    localStorage.setItem('vendor_name', '测试供应商');

    render(<VendorPortalPage />);

    await waitFor(() => {
      expect(mockedHttp.get).toHaveBeenCalledWith('/vendor-portal/contracts', {
        params: { vendorId: 7 },
        headers: { 'X-Vendor-Token': 'vendor-token' },
      });
    });
  });
});
