import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

import http from '@/utils/http';
import {
  disableSlaConfig,
  enableSlaConfig,
  exportSlaTimeoutRecords,
  getSlaConfig,
  getSlaRuntimeSummary,
  listSlaConfigs,
  listSlaTimeoutRecords,
  simulateSlaConfig,
  updateSlaConfig,
} from '@/api/slaConfig';

const mockedHttp = vi.mocked(http);

describe('api/slaConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('user_info', JSON.stringify({ id: 42 }));
  });

  it('uses unified SLA config paths and relies on the shared http unwrapping contract', async () => {
    const payload = {
      responseHours: 2,
      resolveHours: 8,
      warningRatio: 0.75,
    };

    mockedHttp.get.mockResolvedValue([]);
    mockedHttp.put.mockResolvedValue({
      id: 1,
      priority: 'HIGH',
      responseHours: 2,
      resolveHours: 8,
      warningRatio: 0.75,
      status: 1,
    });
    mockedHttp.post.mockResolvedValue({});

    await listSlaConfigs();
    await getSlaConfig(1);
    await updateSlaConfig(1, payload);
    await enableSlaConfig(1, { confirmed: true, reason: '启用复核', auditEvidence: 'SLA_GATE' });
    await disableSlaConfig(1, { confirmed: true, reason: '停用复核', auditEvidence: 'SLA_GATE' });
    await simulateSlaConfig({ processKey: 'ASSET_APPROVAL', nodeKey: 'MANAGER_REVIEW', priority: 'HIGH', variables: { amount: 1200 }, confirmed: true, reason: '模拟复核' });
    await getSlaRuntimeSummary();
    await listSlaTimeoutRecords({ processKey: 'ASSET_APPROVAL', status: 'OPEN', riskLevel: 'HIGH' });
    await exportSlaTimeoutRecords({ processKey: 'ASSET_APPROVAL', confirmed: true, reason: '导出复核', auditEvidence: 'SLA_EXPORT_GATE' });

    expect(mockedHttp.get).toHaveBeenCalledWith('/sla-config');
    expect(mockedHttp.get).toHaveBeenCalledWith('/sla-config/1');
    expect(mockedHttp.put).toHaveBeenCalledWith('/sla-config/1', payload);
    expect(mockedHttp.post).toHaveBeenCalledWith('/sla-config/1/enable', expect.objectContaining({ confirmed: true, operatorId: 42, auditEvidence: 'SLA_GATE' }));
    expect(mockedHttp.post).toHaveBeenCalledWith('/sla-config/1/disable', expect.objectContaining({ confirmed: true, operatorId: 42, reason: '停用复核' }));
    expect(mockedHttp.post).toHaveBeenCalledWith('/sla-config/simulate', expect.objectContaining({ processKey: 'ASSET_APPROVAL', operatorId: 42, confirmed: true }));
    expect(mockedHttp.get).toHaveBeenCalledWith('/sla-config/runtime-summary');
    expect(mockedHttp.get).toHaveBeenCalledWith('/sla-config/timeout-records', { params: { processKey: 'ASSET_APPROVAL', status: 'OPEN', riskLevel: 'HIGH' } });
    expect(mockedHttp.post).toHaveBeenCalledWith('/sla-config/export', expect.objectContaining({ processKey: 'ASSET_APPROVAL', operatorId: 42, confirmed: true, auditEvidence: 'SLA_EXPORT_GATE' }));
  });
});
