import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import http from '@/utils/http';
import {
  createRelation,
  deleteRelation,
  getAssetTree,
  getRelations,
  updateRelation,
} from '@/api/assetParentChild';
import { AssetRelationType } from '@/types/asset';

const mockedHttp = vi.mocked(http);

describe('api/assetParentChild', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses relation endpoints and direct unwrapped return types', async () => {
    const payload = { parentAssetId: 8, childAssetId: 9, relationType: AssetRelationType.ACCESSORY, quantity: 1 };
    const patch = { relationType: AssetRelationType.SPARE_PART };

    mockedHttp.get.mockResolvedValue([]);
    mockedHttp.post.mockResolvedValue({});
    mockedHttp.put.mockResolvedValue({});
    mockedHttp.delete.mockResolvedValue(undefined);

    await getRelations(8);
    await createRelation(8, payload);
    await deleteRelation(8, 3);
    await getAssetTree(8);
    await updateRelation(8, 3, patch);

    expect(mockedHttp.get).toHaveBeenNthCalledWith(1, '/assets/8/relations');
    expect(mockedHttp.post).toHaveBeenCalledWith('/assets/8/relations', payload);
    expect(mockedHttp.delete).toHaveBeenCalledWith('/assets/8/relations/3');
    expect(mockedHttp.get).toHaveBeenNthCalledWith(2, '/assets/8/relations/tree');
    expect(mockedHttp.put).toHaveBeenCalledWith('/assets/8/relations/3', patch);
  });
});
