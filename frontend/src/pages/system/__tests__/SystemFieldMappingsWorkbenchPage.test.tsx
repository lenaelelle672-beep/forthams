import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemFieldMappingsWorkbenchPage from '../SystemFieldMappingsWorkbenchPage';
import { listSystemFieldMappings, previewSystemFieldMapping } from '../../../api/systemFieldMappings';

vi.mock('../../../api/systemFieldMappings', () => ({
  listSystemFieldMappings: vi.fn(),
  previewSystemFieldMapping: vi.fn(),
}));

const mockedList = vi.mocked(listSystemFieldMappings);
const mockedPreview = vi.mocked(previewSystemFieldMapping);

describe('SystemFieldMappingsWorkbenchPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('展示白名单表达式并执行预览', async () => {
    mockedList.mockResolvedValueOnce([{ id: 1, interfaceId: 1, mappingName: '资产名称', sourceField: 'name', targetField: 'assetName', transformExpression: 'trim(value)', enabled: true }]);
    mockedPreview.mockResolvedValueOnce({ sourceField: 'name', targetField: 'assetName', sampleValue: '  Laptop  ', transformExpression: 'trim(value)', transformedValue: 'Laptop', valid: true, message: '预览成功' });

    render(<SystemFieldMappingsWorkbenchPage embeddedInWorkbench />);

    expect(await screen.findByText('资产名称')).toBeInTheDocument();
    expect(screen.getByText(/trim\(value\)、upper\(value\)、lower\(value\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '预览转换' }));

    expect(await screen.findByText('预览结果：Laptop')).toBeInTheDocument();
  });

  it('错误态展示脱敏文案', async () => {
    mockedList.mockRejectedValueOnce(new Error('stack detail'));

    render(<SystemFieldMappingsWorkbenchPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('敏感细节已脱敏'));
  });
});
