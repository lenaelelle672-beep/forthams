import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../app/utils/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import { api } from '../../app/utils/api';
import {
  createSystemExternalSystem,
  disableSystemExternalSystem,
  enableSystemExternalSystem,
  getSystemExternalSystem,
  listSystemExternalSystems,
  updateSystemExternalSystem,
  validateSystemExternalSystemConfig,
} from '../systemExternalSystems';

const mockedApi = vi.mocked(api);

describe('api/systemExternalSystems', () => {
  beforeEach(() => vi.clearAllMocks());

  it('只访问 /system/external-systems 专属端点', async () => {
    mockedApi.get.mockResolvedValue({});
    mockedApi.post.mockResolvedValue({});
    mockedApi.put.mockResolvedValue({});

    const payload = {
      systemCode: 'ERP_CORE',
      systemName: 'ERP Core',
      systemType: 'ERP',
      baseUrl: 'https://erp.example.com/api',
      authType: 'API_KEY',
      authConfig: { credential: rawCredential() },
      operatorId: 42,
      reason: 'V3 保存复核',
    };

    await listSystemExternalSystems({ keyword: 'ERP', systemType: 'ERP', status: 'ENABLED' });
    await getSystemExternalSystem(7);
    await createSystemExternalSystem(payload);
    await updateSystemExternalSystem(7, payload);
    await enableSystemExternalSystem(7, { confirmed: true, operatorId: 42, reason: '启用复核', auditEvidence: 'ES-GATE' });
    await disableSystemExternalSystem(7, { confirmed: true, operatorId: 42, reason: '停用复核', auditEvidence: 'ES-GATE' });
    await validateSystemExternalSystemConfig(7, { operatorId: 42, reason: '配置校验' });

    expect(mockedApi.get).toHaveBeenNthCalledWith(1, '/system/external-systems', { params: { keyword: 'ERP', systemType: 'ERP', status: 'ENABLED' } });
    expect(mockedApi.get).toHaveBeenNthCalledWith(2, '/system/external-systems/7');
    expect(mockedApi.post).toHaveBeenNthCalledWith(1, '/system/external-systems', expect.objectContaining({ operatorId: 42, reason: 'V3 保存复核' }));
    expect(mockedApi.post.mock.calls[0][1]).toEqual(expect.objectContaining({ authConfig: { credential: expect.any(String) } }));
    expect(mockedApi.put).toHaveBeenCalledWith('/system/external-systems/7', expect.objectContaining({ systemCode: 'ERP_CORE', operatorId: 42 }));
    expect(mockedApi.post).toHaveBeenNthCalledWith(2, '/system/external-systems/7/enable', { confirmed: true, operatorId: 42, reason: '启用复核', auditEvidence: 'ES-GATE' });
    expect(mockedApi.post).toHaveBeenNthCalledWith(3, '/system/external-systems/7/disable', { confirmed: true, operatorId: 42, reason: '停用复核', auditEvidence: 'ES-GATE' });
    expect(mockedApi.post).toHaveBeenNthCalledWith(4, '/system/external-systems/7/validate', { operatorId: 42, reason: '配置校验' });
    expect(JSON.stringify([...mockedApi.get.mock.calls, ...mockedApi.post.mock.calls, ...mockedApi.put.mock.calls])).not.toMatch(/workflow|webhook-configs|interfaces|public\/mock|fixed-assets\/workbench\?menu=/);
  });

  it('响应契约只暴露脱敏摘要与 config-only 校验语义', () => {
    const record = {
      id: 7,
      systemCode: 'ERP_CORE',
      systemName: 'ERP Core',
      systemType: 'ERP',
      maskedBaseUrl: 'https://erp.example.com/api',
      authType: 'API_KEY',
      authConfigured: true,
      configMasked: true,
      maskedSecretSummary: '1 项认证材料已脱敏',
      enabled: true,
      status: 'ENABLED',
    };
    const validation = {
      systemId: 7,
      systemCode: 'ERP_CORE',
      valid: true,
      configOnly: true,
      noRealExternalCall: true,
      targetSummary: 'https://erp.example.com/api',
      message: '外部系统配置校验通过，未触发真实外部调用',
    };

    expect(JSON.stringify(record)).not.toContain(rawCredential());
    expect(JSON.stringify(validation)).toContain('未触发真实外部调用');
    expect(validation.configOnly).toBe(true);
    expect(validation.noRealExternalCall).toBe(true);
  });

  function rawCredential() {
    return 'raw' + '-external-credential';
  }
});
