/**
 * @file hooks/asset/useAssetAttachments.ts
 * @description 资产附件 TanStack Query hooks — 查询/上传/删除 with 缓存失效
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAssetAttachments,
  uploadAssetAttachment,
  deleteAssetAttachment,
} from '@/api/asset';
import type { AssetAttachment } from '@/types/asset';
import { toast } from 'sonner';

export const attachmentKeys = {
  all:  ['asset-attachments'] as const,
  list: (assetId: number) => [...attachmentKeys.all, assetId] as const,
};

/**
 * 获取资产附件列表。
 */
export function useAssetAttachments(assetId: number | null) {
  return useQuery({
    queryKey: attachmentKeys.list(assetId!),
    queryFn:  () => getAssetAttachments(assetId!),
    enabled:  !!assetId,
    staleTime: 1000 * 30,
  });
}

/**
 * 上传资产附件。
 */
export function useUploadAttachment(assetId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAssetAttachment(assetId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attachmentKeys.list(assetId) });
      toast.success('附件上传成功');
    },
    onError: (err: Error) => {
      toast.error(err.message || '附件上传失败');
    },
  });
}

/**
 * 删除资产附件。
 */
export function useDeleteAttachment(assetId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: number) => deleteAssetAttachment(assetId, attachmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attachmentKeys.list(assetId) });
      toast.success('附件删除成功');
    },
    onError: (err: Error) => {
      toast.error(err.message || '附件删除失败');
    },
  });
}
