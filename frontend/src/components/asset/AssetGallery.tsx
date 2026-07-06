/**
 * @file components/asset/AssetGallery.tsx
 * @description 资产图片画廊组件 — 支持图片网格预览、点击放大、无图空态
 */

import React, { useState } from 'react';
import { useAssetAttachments } from '@/hooks/asset/useAssetAttachments';
import type { AssetAttachment } from '@/types/asset';

interface AssetGalleryProps {
  assetId: number;
  readOnly?: boolean;
}

const IMAGE_MIME_PREFIXES = ['image/', 'application/octet-stream'];

function isImage(attachment: AssetAttachment): boolean {
  return IMAGE_MIME_PREFIXES.some((prefix) => attachment.fileType?.startsWith(prefix))
    || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(attachment.fileName);
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

export default function AssetGallery({ assetId, readOnly }: AssetGalleryProps) {
  const { data: attachments, isLoading } = useAssetAttachments(assetId);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const images = (attachments ?? []).filter(isImage);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#94a3b8] py-4">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#3b82f6]" />
        加载图片中...
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8] gap-2">
        <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm">暂无图片附件</span>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
        {images.map((img, index) => (
          <button
            key={img.id}
            type="button"
            className="group relative aspect-square rounded-lg overflow-hidden border border-[#e5e7eb] bg-[#f8fafc] hover:border-[#3b82f6] hover:shadow-md transition-all"
            onClick={() => setLightboxIndex(index)}
          >
            <img
              src={img.filePath}
              alt={img.fileName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.classList.add('flex', 'items-center', 'justify-center');
                (e.target as HTMLImageElement).parentElement!.innerHTML = `
                  <svg class="w-6 h-6 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                `;
              }}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-[10px] text-white truncate">{img.fileName}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
            onClick={() => setLightboxIndex(null)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <img
            src={images[lightboxIndex].filePath}
            alt={images[lightboxIndex].fileName}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {lightboxIndex < images.length - 1 && (
            <button
              className="absolute right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <div className="absolute bottom-4 text-center text-white/80 text-sm">
            {images[lightboxIndex].fileName}
            <span className="mx-2">·</span>
            {lightboxIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}
