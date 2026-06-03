/**
 * @file components/asset/AssetAttachmentUpload.tsx
 * @description 资产附件上传组件 — 支持拖拽上传、图片缩略图预览、文件类型图标、排序、删除确认
 */

import React, { useCallback, useRef, useState } from 'react';
import { useAssetAttachments, useUploadAttachment, useDeleteAttachment } from '@/hooks/asset/useAssetAttachments';
import type { AssetAttachment } from '@/types/asset';
import { Button } from '@/components/ui/Button';
import { CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from 'sonner';
import {
  Upload,
  X,
  File,
  Image,
  FileText,
  FileArchive,
  Table,
  Loader2,
  Trash2,
  Paperclip,
} from 'lucide-react';

interface AssetAttachmentUploadProps {
  assetId: number | null;
  /** 是否处于只读模式（详情页展示） */
  readOnly?: boolean;
}

/** 判断文件是否为图片类型 */
function isImage(fileType: string): boolean {
  return fileType?.startsWith('image/');
}

/** 获取文件类型图标 */
function FileTypeIcon({ fileType, className }: { fileType: string; className?: string }) {
  if (isImage(fileType)) return <Image className={className} />;
  if (fileType?.includes('pdf')) return <FileText className={className} />;
  if (fileType?.includes('zip') || fileType?.includes('rar') || fileType?.includes('7z'))
    return <FileArchive className={className} />;
  if (fileType?.includes('spreadsheet') || fileType?.includes('excel') || fileType?.includes('csv'))
    return <Table className={className} />;
  return <File className={className} />;
}

/**
 * 带降级处理的图片组件 — 加载失败时显示文件类型图标。
 */
function ImagePreview({ src, alt, fileType }: { src: string; alt: string; fileType: string }) {
  const [imgError, setImgError] = useState(false);
  if (imgError) {
    return <FileTypeIcon fileType={fileType} className="w-6 h-6 text-[#64748b]" />;
  }
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      onError={() => setImgError(true)}
    />
  );
}

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function AssetAttachmentUpload({ assetId, readOnly = false }: AssetAttachmentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { data: attachments, isLoading } = useAssetAttachments(assetId);
  const uploadMutation = useUploadAttachment(assetId!);
  const deleteMutation = useDeleteAttachment(assetId!);

  const isPending = uploadMutation.isPending || deleteMutation.isPending;

  /**
   * 处理拖拽悬停。
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, [readOnly]);

  /**
   * 处理拖拽离开。
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  /**
   * 处理文件拖拽上传。
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  }, [readOnly, uploadMutation]);

  /**
   * 处理文件选择框变更。
   */
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
    // 重置 value 允许重复选择同一文件
    e.target.value = '';
  }, [uploadMutation]);

  /**
   * 执行文件上传。
   */
  const uploadFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('文件大小不能超过10MB');
      return;
    }
    uploadMutation.mutate(file);
  };

  /**
   * 处理附件删除确认。
   */
  const handleDelete = (attachment: AssetAttachment) => {
    if (window.confirm(`确认删除附件「${attachment.fileName}」？删除后不可恢复。`)) {
      deleteMutation.mutate(attachment.id);
    }
  };

  /**
   * 图片预览：在新标签页中打开完整图片 URL。
   */
  const previewImage = (attachment: AssetAttachment) => {
    const fullUrl = `${import.meta.env.VITE_API_BASE_URL}${attachment.filePath}`;
    window.open(fullUrl, '_blank');
  };

  // ── 加载态 ──
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── 上传区域（仅非只读且 assetId 存在时显示） ── */}
      {!readOnly && assetId && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200
            ${isDragOver
              ? 'border-[#004ac6] bg-blue-50/50 scale-[1.01]'
              : 'border-[#cbd5e1] hover:border-[#94a3b8] bg-[#f8fafc] hover:bg-white'
            }
            ${isPending ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={handleFileChange}
            disabled={isPending}
          />

          {isPending && uploadMutation.isPending ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-[#004ac6] animate-spin" />
              <p className="text-sm text-[#64748b]">正在上传...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-[#dbe1ff] flex items-center justify-center">
                <Upload className="w-6 h-6 text-[#004ac6]" />
              </div>
              <p className="text-sm font-semibold text-[#334155]">
                拖拽文件到此处，或<span className="text-[#004ac6] underline underline-offset-2">点击选择文件</span>
              </p>
              <p className="text-xs text-[#94a3b8]">支持任意文件格式，单个文件不超过 10MB</p>
            </div>
          )}
        </div>
      )}

      {/* ── 新建模式提示 ── */}
      {!assetId && !readOnly && (
        <div className="flex flex-col items-center justify-center py-6 text-[#94a3b8] gap-2">
          <Paperclip className="w-8 h-8 opacity-40" />
          <p className="text-sm font-medium">请先保存资产后再上传附件</p>
        </div>
      )}

      {/* ── 附件列表 ── */}
      {attachments && attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-[#e5e7eb] bg-white hover:border-[#dbe1ff] hover:shadow-sm transition-all group"
            >
              {/* 缩略图 / 文件类型图标 */}
              <div
                className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-[#f8fafc] flex items-center justify-center border border-[#e5e7eb] cursor-pointer"
                onClick={() => isImage(att.fileType) ? previewImage(att) : undefined}
              >
                {isImage(att.fileType) ? (
                  <ImagePreview
                    src={`${import.meta.env.VITE_API_BASE_URL}${att.filePath}`}
                    alt={att.fileName}
                    fileType={att.fileType}
                  />
                ) : (
                  <FileTypeIcon fileType={att.fileType} className="w-6 h-6 text-[#64748b]" />
                )}
              </div>

              {/* 文件信息 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0f172a] truncate" title={att.fileName}>
                  {att.fileName}
                </p>
                <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
                  <span>{formatFileSize(att.fileSize)}</span>
                  <span>·</span>
                  <span>{att.createTime ? new Date(att.createTime).toLocaleString('zh-CN') : ''}</span>
                </div>
              </div>

              {/* 删除按钮 */}
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => handleDelete(att)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[#94a3b8] hover:text-red-600 hover:bg-red-50"
                >
                  {deleteMutation.isPending && deleteMutation.variables === att.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : !isLoading && !readOnly && assetId ? (
        /* ── 空状态 ── */
        <div className="flex flex-col items-center justify-center py-6 text-[#94a3b8] gap-2">
          <Paperclip className="w-8 h-8 opacity-40" />
          <p className="text-sm font-medium">暂无附件</p>
          <p className="text-xs">拖拽或点击上方区域上传</p>
        </div>
      ) : !isLoading && readOnly && assetId ? (
        /* ── 只读空状态 ── */
        <div className="flex flex-col items-center justify-center py-6 text-[#94a3b8] gap-2">
          <Paperclip className="w-8 h-8 opacity-40" />
          <p className="text-sm font-medium">暂无附件</p>
        </div>
      ) : null}
    </div>
  );
}
