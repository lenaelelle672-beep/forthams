/**
 * @file components/PhotoUpload.tsx
 * @description 现场照片上传组件 — 复用 FileController 后端上传接口
 *
 * 流程：
 * 1. 用户选择文件
 * 2. 调用后端 maintenance/execution/{id}/upload-photo 接口上传
 * 3. 上传成功后显示缩略图列表
 *
 * Props：
 * - executionId: 执行记录ID
 * - onUploadComplete: 上传完成回调（可选）
 */

import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { executionApi } from '@/api/maintenanceExecution';
import { toast } from 'sonner';

interface PhotoUploadProps {
  executionId: number;
  onUploadComplete?: (fileName: string) => void;
}

interface UploadedFile {
  name: string;
  url: string;
}

export function PhotoUpload({ executionId, onUploadComplete }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 校验文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('仅支持 JPG/PNG/WebP/GIF 格式图片');
      return;
    }

    // 校验文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过 10MB');
      return;
    }

    setUploading(true);
    try {
      const fileName = await executionApi.uploadPhoto(executionId, file);
      setPhotos((prev) => [...prev, { name: fileName, url: '' }]);
      toast.success('照片上传成功');
      onUploadComplete?.(fileName);
    } catch (err) {
      toast.error('照片上传失败');
    } finally {
      setUploading(false);
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* 上传按钮 */}
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? '上传中...' : '选择照片'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileSelect}
        />
        <span className="text-xs text-muted-foreground">
          支持 JPG/PNG/WebP/GIF，单张不超过 10MB
        </span>
      </div>

      {/* 照片列表 */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {photos.map((photo, index) => (
            <div key={index} className="group relative aspect-square rounded-lg border bg-muted">
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <span className="absolute bottom-1 left-1 right-1 truncate rounded bg-background/80 px-1 text-xs">
                {photo.name}
              </span>
              <button
                type="button"
                className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => handleRemovePhoto(index)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          暂无现场照片
        </div>
      )}
    </div>
  );
}
