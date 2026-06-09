import { describe, expect, it } from 'vitest';
import { resolveAssetAttachmentUrl } from './AssetAttachmentUpload';

describe('resolveAssetAttachmentUrl', () => {
  it('keeps absolute attachment URLs unchanged', () => {
    expect(resolveAssetAttachmentUrl({ id: 1, filePath: 'https://cdn.example.com/a.png' })).toBe(
      'https://cdn.example.com/a.png',
    );
  });

  it('normalizes relative attachment paths through the backend file endpoint', () => {
    expect(resolveAssetAttachmentUrl({ id: 2, filePath: '/uploads/assets/a.png' })).toBe(
      '/api/file/uploads/assets/a.png',
    );
    expect(resolveAssetAttachmentUrl({ id: 3, filePath: '/api/file/uploads/assets/b.png' })).toBe(
      '/api/file/uploads/assets/b.png',
    );
  });

  it('falls back to attachment id when filePath is empty', () => {
    expect(resolveAssetAttachmentUrl({ id: 4, filePath: '' })).toBe('/api/file/4');
  });
});
