import React, { useState, useCallback, useRef } from 'react';
import { InboxOutlined } from '@ant-design/icons';
import { message, Progress, Button, Typography } from 'antd';

const { Text } = Typography;

/** Maximum allowed file size: 10MB in bytes */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Props for DragUploadZone component */
export interface DragUploadZoneProps {
  /** Called when file upload and server-side parsing succeeds */
  onParseSuccess: (data: any) => void;
  /** Called when file upload or parsing fails */
  onParseError?: (error: string) => void;
  /**
   * Function to upload and parse the file on the server.
   * Receives the file and a progress callback, returns a promise that resolves
   * with the parsed data from POST /api/v1/assets/import/parse.
   */
  uploadFile: (file: File, onProgress: (percent: number) => void) => Promise<any>;
}

/**
 * DragUploadZone provides a drag-and-drop upload area for .xlsx asset import files.
 *
 * Features:
 * - Drag-and-drop with visual highlight (blue dashed border on drag enter)
 * - Click to select file via hidden file input (accept=".xlsx")
 * - File type validation: only .xlsx allowed
 * - File size validation: max 10MB
 * - Real-time upload progress with percentage display
 * - Failure state: red progress bar with retry button
 * - Concurrent upload protection via synchronous ref mutex
 * - Saves file reference for retry after failure
 */
const DragUploadZone: React.FC<DragUploadZoneProps> = ({
  onParseSuccess,
  onParseError,
  uploadFile,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

  /** Synchronous mutex to prevent race conditions on rapid double-clicks */
  const uploadingRef = useRef(false);
  /** Saved file reference for retry after upload failure */
  const lastFileRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /**
   * Counter to track nested drag enter/leave events.
   * Prevents flickering when dragging over child elements inside the zone.
   */
  const dragCounterRef = useRef(0);

  /**
   * Validate the selected file against type and size constraints.
   * @param file - The file to validate
   * @returns Error message string if validation fails, null if valid
   */
  const validateFile = useCallback((file: File): string | null => {
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx')) {
      return '仅支持 .xlsx 格式文件';
    }
    if (file.size > MAX_FILE_SIZE) {
      return '文件大小不能超过 10MB';
    }
    return null;
  }, []);

  /**
   * Execute the file upload: validate, set state, call uploadFile prop,
   * and handle success or failure.
   * @param file - The file to upload
   */
  const handleUpload = useCallback(
    async (file: File) => {
      // Synchronous guard against concurrent uploads
      if (uploadingRef.current) {
        message.warning('当前有文件正在上传，请等待完成');
        return;
      }

      const validationError = validateFile(file);
      if (validationError) {
        message.error(validationError);
        return;
      }

      // Lock immediately (synchronous) to prevent race conditions
      uploadingRef.current = true;
      lastFileRef.current = file;
      setUploading(true);
      setProgress(0);
      setUploadError(null);
      setHasFailed(false);

      try {
        const data = await uploadFile(file, (percent: number) => {
          setProgress(percent);
        });
        setProgress(100);
        onParseSuccess(data);
      } catch (err: any) {
        const errorMsg =
          err?.response?.data?.message || err?.message || '上传失败，请重试';
        setUploadError(errorMsg);
        setHasFailed(true);
        onParseError?.(errorMsg);
      } finally {
        uploadingRef.current = false;
        setUploading(false);
      }
    },
    [validateFile, uploadFile, onParseSuccess, onParseError],
  );

  /** Retry the upload using the last file that was attempted */
  const handleRetry = useCallback(() => {
    if (lastFileRef.current) {
      handleUpload(lastFileRef.current);
    }
  }, [handleUpload]);

  /**
   * Handle dragenter: increment counter and set dragging state on first entry.
   * Uses a counter to handle child elements firing extra enter/leave events.
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragging(true);
    }
  }, []);

  /**
   * Handle dragleave: decrement counter and clear dragging state when
   * counter reaches zero (cursor fully left the zone).
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  /** Handle dragover: prevent default to allow drop */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * Handle file drop: reset drag state, check concurrent upload lock,
   * then upload the first dropped file.
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      if (uploadingRef.current) {
        message.warning('当前有文件正在上传，请等待完成');
        return;
      }

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleUpload(files[0]);
      }
    },
    [handleUpload],
  );

  /** Handle file selection via the hidden file input */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (uploadingRef.current) {
          message.warning('当前有文件正在上传，请等待完成');
          return;
        }
        handleUpload(file);
      }
      // Reset input value so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleUpload],
  );

  /** Handle click on the upload zone to trigger the hidden file input */
  const handleZoneClick = useCallback(() => {
    if (uploadingRef.current) {
      message.warning('当前有文件正在上传，请等待完成');
      return;
    }
    fileInputRef.current?.click();
  }, []);

  /** Shared inline styles for the zone container */
  const zoneBaseStyle: React.CSSProperties = {
    borderRadius: 8,
    padding: '40px 24px',
    textAlign: 'center',
    transition: 'all 0.3s ease',
  };

  // ─── Render: Failure state with red progress bar and retry button ───
  if (hasFailed && uploadError) {
    return (
      <div
        role="alert"
        aria-label="上传失败"
        style={{
          ...zoneBaseStyle,
          border: '2px dashed #ff4d4f',
          backgroundColor: '#fff2f0',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16, color: '#ff4d4f' }}>
          <InboxOutlined />
        </div>
        <Typography.Title level={5} style={{ color: '#ff4d4f', marginBottom: 8 }}>
          上传失败
        </Typography.Title>
        <Text type="danger" style={{ display: 'block', marginBottom: 16 }}>
          {uploadError}
        </Text>
        <Progress
          percent={progress}
          status="exception"
          showInfo={false}
          style={{ maxWidth: 400, margin: '0 auto 16px' }}
        />
        <Button type="primary" danger onClick={handleRetry}>
          重试
        </Button>
      </div>
    );
  }

  // ─── Render: Uploading state with progress bar ───
  if (uploading) {
    return (
      <div
        aria-label={`上传进度 ${progress}%`}
        style={{
          ...zoneBaseStyle,
          border: '2px dashed #1890ff',
          backgroundColor: '#e6f7ff',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16, color: '#1890ff' }}>
          <InboxOutlined />
        </div>
        <Typography.Title level={5} style={{ marginBottom: 8 }}>
          {progress >= 100 ? '解析中...' : `上传中 ${progress}%`}
        </Typography.Title>
        <Progress
          percent={progress}
          status="active"
          strokeColor="#1890ff"
          style={{ maxWidth: 400, margin: '0 auto' }}
        />
      </div>
    );
  }

  // ─── Render: Default drag-and-drop zone ───
  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleZoneClick}
      role="button"
      aria-label="上传文件区域"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleZoneClick();
        }
      }}
      style={{
        ...zoneBaseStyle,
        border: isDragging ? '2px dashed #1890ff' : '2px dashed #d9d9d9',
        cursor: 'pointer',
        backgroundColor: isDragging ? '#e6f7ff' : '#fafafa',
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <div style={{ fontSize: 48, marginBottom: 16, color: '#1890ff' }}>
        <InboxOutlined />
      </div>
      <Text style={{ display: 'block', fontSize: 16 }}>
        将 .xlsx 文件拖到此处，或<span style={{ color: '#1890ff' }}>点击选择文件</span>
      </Text>
      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
        支持格式：.xlsx，文件大小不超过 10MB
      </Text>
    </div>
  );
};

export default DragUploadZone;