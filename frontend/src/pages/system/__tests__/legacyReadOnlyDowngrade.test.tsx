import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

/**
 * 合同测试：旧版 system/custom-fields、system/custom-fieldsets 页面已降级为只读。
 *
 * 背景：后端 V3 controller 有意只读（list/get/meta/preview），但旧页面曾调用
 * create/update/delete 等不存在的写接口（详见契约漂移审计）。按 V3 只读 catalog
 * 设计意图，旧页面移除写按钮与 mutation，保留列表与只读预览。
 */
vi.mock('@/api/customField', () => ({
  getCustomFieldList: vi.fn().mockResolvedValue({ records: [], total: 0 }),
  getCustomFieldAll: vi.fn().mockResolvedValue([]),
  getCustomFieldsetList: vi.fn().mockResolvedValue({ records: [], total: 0 }),
  getFieldsetFields: vi.fn().mockResolvedValue([]),
  previewCustomField: vi.fn(),
  previewCustomFieldset: vi.fn(),
  // 写接口仍被 mock（避免 import 报错），但页面不应调用它们
  createCustomField: vi.fn(),
  updateCustomField: vi.fn(),
  deleteCustomField: vi.fn(),
  createCustomFieldset: vi.fn(),
  updateCustomFieldset: vi.fn(),
  deleteCustomFieldset: vi.fn(),
  assignFieldsToFieldset: vi.fn(),
  assignFieldsetToCategory: vi.fn(),
  saveAssetCustomFields: vi.fn(),
}));

function withProviders(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe('legacy custom-fields 页面只读降级', () => {
  it('不渲染新增字段按钮', async () => {
    const Mod = (await import('@/pages/system/custom-fields/index')).default;
    render(withProviders(<Mod />));
    expect(screen.queryByRole('button', { name: /新增字段/ })).toBeNull();
  });

  it('不渲染编辑与删除按钮', async () => {
    const Mod = (await import('@/pages/system/custom-fields/index')).default;
    const { container } = render(withProviders(<Mod />));
    // 编辑/删除按钮以 title 属性标记
    expect(container.querySelectorAll('[title="编辑"]')).toHaveLength(0);
    expect(container.querySelectorAll('[title="删除"]')).toHaveLength(0);
  });
});

describe('legacy custom-fieldsets 页面只读降级', () => {
  it('不渲染新增字段集按钮', async () => {
    const Mod = (await import('@/pages/system/custom-fieldsets/index')).default;
    render(withProviders(<Mod />));
    expect(screen.queryByRole('button', { name: /新增字段集/ })).toBeNull();
  });
});
