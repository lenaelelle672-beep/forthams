import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob, downloadCsvRecords, downloadCsvRows } from '@/utils/fileDownloader';

describe('fileDownloader', () => {
  const createObjectURL = vi.fn((_blob: Blob) => 'blob:test-url');
  const revokeObjectURL = vi.fn((_url: string) => undefined);

  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  it('downloads a Blob and revokes its object URL', () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });

    downloadBlob(blob, 'hello.txt');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    expect(document.querySelector('a[download="hello.txt"]')).not.toBeInTheDocument();
  });

  it('exports records as UTF-8 CSV with headers and escaped cells', async () => {
    downloadCsvRecords(
      [
        {
          name: '资产,一',
          note: '含"引号"',
          empty: null,
          lines: '第一行\n第二行',
        },
      ],
      'report.csv',
    );

    const blob = createObjectURL.mock.calls[0][0] as Blob;

    await expect(blob.text()).resolves.toBe(
      '\uFEFFname,note,empty,lines\r\n"资产,一","含""引号""",,"第一行\n第二行"',
    );
  });

  it('exports raw rows with blank separators', async () => {
    downloadCsvRows([['统计'], [], ['A 类', 2, 1000]], 'rows.csv');

    const blob = createObjectURL.mock.calls[0][0] as Blob;

    await expect(blob.text()).resolves.toBe('\uFEFF统计\r\n\r\nA 类,2,1000');
  });
});
