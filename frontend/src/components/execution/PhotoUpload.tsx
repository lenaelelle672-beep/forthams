/**
 * @file components/execution/PhotoUpload.tsx
 * @description 现场照片上传组件（多图上传、预览、删除）
 */

import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, X, Eye, Image } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import http from '@/utils/http';

interface PhotoUploadProps {
  workOrderId: number;
  existingPhotos?: string[];
  onPhotosChange?: (urls: string[]) => void;
}

export default function PhotoUpload({ workOrderId, existingPhotos = [], onPhotosChange }: PhotoUploadProps) {
  const [photos, setPhotos] = useState<string[]>(existingPhotos);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await http.post('/file/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return (res as any)?.data || '';
    },
    onSuccess: (url) => {
      if (url) {
        const newPhotos = [...photos, url];
        setPhotos(newPhotos);
        onPhotosChange?.(newPhotos);
        toast.success('照片上传成功');
      }
    },
    onError: (err: any) => toast.error(err?.message || '上传失败'),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadMutation.mutate(files[0]);
    }
    // 重置 input 以便重复选择同一文件
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePhoto(index: number) {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    onPhotosChange?.(newPhotos);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-4 h-4" />
          现场照片
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 上传按钮 */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            loading={uploadMutation.isPending}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            上传照片
          </Button>
        </div>

        {/* 照片列表 */}
        {photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((url, index) => (
              <div key={index} className="relative group">
                <img
                  src={url}
                  alt={`现场照片 ${index + 1}`}
                  className="w-full h-20 object-cover rounded-lg cursor-pointer"
                  onClick={() => setPreviewUrl(url)}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPreviewUrl(url)}
                    className="p-1 bg-white/80 rounded text-gray-700 hover:bg-white"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removePhoto(index)}
                    className="p-1 bg-white/80 rounded text-red-600 hover:bg-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">暂无现场照片</p>
        )}

        {/* 预览弹窗 */}
        {previewUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8"
            onClick={() => setPreviewUrl(null)}
          >
            <img
              src={previewUrl}
              alt="预览"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
