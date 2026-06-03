/**
 * @file components/asset/AttachmentList.tsx
 * @description 附件列表组件 — 非图片附件以文件列表展示，支持下载和删除
 */

import React from 'react';
import { useAssetAttachments, useDeleteAttachment } from '@/hooks/asset/useAssetAttachments';
import type { AssetAttachment } from '@/types/asset';

interface AttachmentListProps {
  assetId: number;
  readOnly?: boolean;
}

const IMAGE_MIME_PREFIXES = ['image/'];

function isNonImage(attachment: AssetAttachment): boolean {
  return !IMAGE_MIME_PREFIXES.some((prefix) => attachment.fileType?.startsWith(prefix))
    && !/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(attachment.fileName);
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '未知';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, string> = {
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    xls: '📊',
    xlsx: '📊',
    ppt: '📽️',
    pptx: '📽️',
    zip: '📦',
    rar: '📦',
    '7z': '📦',
    txt: '📃',
    csv: '📊',
    json: '📋',
    xml: '📋',
  };
  return iconMap[ext] || '📎';
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  } catch {
    return dateStr;
  }
}

export default function AttachmentList({ assetId, readOnly }: AttachmentListProps) {
  const { data: attachments, isLoading } = useAssetAttachments(assetId);
  const deleteMutation = useDeleteAttachment(assetId);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<number | null>(null);

  const nonImageAttachments = (attachments ?? []).filter(isNonImage);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#94a3b8] py-4">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#3b82f6]" />
        加载附件列表...
      </div>
    );
  }

  if (nonImageAttachments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-[#94a3b8] gap-2">
        <svg className="w-8 h-8 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        <span className="text-sm">暂无附件文件</span>
      </div>
    );
  }

  const handleDownload = (attachment: AssetAttachment) => {
    // 如果 filePath 是完整 URL 则直接打开，否则拼接
    const url = attachment.filePath?.startsWith('http')
      ? attachment.filePath
      : `/api/file/${attachment.filePath?.replace('/api/file/', '') || attachment.id}`;
    window.open(url, '_blank');
  };

  const handleDelete = (attachmentId: number) => {
    deleteMutation.mutate(attachmentId);
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-2">
      {nonImageAttachments.map((att) => (
        <div
          key={att.id}
          className="flex items-center justify-between p-3 rounded-lg border border-[#e5e7eb] bg-white hover:border-[#dbe1ff] hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-xl flex-shrink-0">{getFileIcon(att.fileName)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#334155] truncate" title={att.fileName}>
                {att.fileName}
              </p>
              <div className="flex items-center gap-3 text-xs text-[#94a3b8] mt-0.5">
                <span>{formatFileSize(att.fileSize)}</span>
                <span>{formatDate(att.createTime)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#004ac6] transition-colors"
              title="下载"
              onClick={() => handleDownload(att)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            {!readOnly && (
              <>
                {deleteConfirmId === att.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-xs font-medium"
                      onClick={() => handleDelete(att.id)}
                      disabled={deleteMutation.isPending}
                    >
                      确认
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded-md text-[#64748b] hover:bg-[#f1f5f9] transition-colors text-xs"
                      onClick={() => setDeleteConfirmId(null)}
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="p-1.5 rounded-md hover:bg-red-50 text-[#64748b] hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                    title="删除"
                    onClick={() => setDeleteConfirmId(att.id)}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
