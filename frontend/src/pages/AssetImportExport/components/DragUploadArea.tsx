/**
 * DragUploadArea – 拖拽/点击上传组件
 *
 * 负责 .xlsx 文件的拖拽上传与点击上传，内含：
 *   - 文件格式校验（仅 .xlsx）
 *   - 文件大小校验（≤ 5 MB）
 *   - 拖拽悬停视觉反馈
 *   - 上传进度条展示
 *   - 解析中加载态
 *
 * @module AssetImportExport/components/DragUploadArea
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';

/** 允许的 MIME 类型 */
const ACCEPTED_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** 允许的扩展名（小写） */
const ACCEPTED_EXT = '.xlsx';

/** 最大文件尺寸（5 MB） */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** 格式不通过时的错误提示 */
const ERROR_FORMAT = '仅支持 .xlsx 格式文件';

/** 大小超限时的错误提示 */
const ERROR_SIZE = '文件大小不能超过 5MB';

/**
 * 校验单个文件是否满足格式与大小要求。
 *
 * @param file - 待校验的 File 对象
 * @returns 错误消息字符串；校验通过时返回 null
 */
function validateFile(file: File): string | null {
  // 扩展名校验
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith(ACCEPTED_EXT)) {
    return ERROR_FORMAT;
  }

  // MIME 校验（部分浏览器可能给出空字符串，此时仅依赖扩展名）
  if (file.type && file.type !== ACCEPTED_MIME) {
    return ERROR_FORMAT;
  }

  // 大小校验
  if (file.size > MAX_FILE_SIZE) {
    return ERROR_SIZE;
  }

  return null;
}

/**
 * DragUploadArea 组件属性
 */
export interface DragUploadAreaProps {
  /**
   * 文件上传回调。
   *
   * 当文件通过全部前端校验后触发，由父组件负责发起真正的网络请求。
   *
   * @param file - 已校验通过的 File 对象
   */
  onFileAccepted: (file: File) => void;

  /** 上传进度百分比 (0-100)；传入 -1 或 undefined 表示无进度信息 */
  uploadProgress?: number;

  /** 是否正在解析（上传完成、等待后端返回解析结果） */
  isParsing?: boolean;

  /** 额外的 CSS class */
  className?: string;
}

/**
 * DragUploadArea 组件
 *
 * 提供拖拽区域与隐藏的 `<input type="file">`，仅接受 `.xlsx` 文件，
 * 最大 5 MB。校验失败时展示内联错误信息，不触发 `onFileAccepted`。
 *
 * @param props - {@link DragUploadAreaProps}
 * @returns JSX 元素
 */
const DragUploadArea: React.FC<DragUploadAreaProps> = ({
  onFileAccepted,
  uploadProgress,
  isParsing = false,
  className = '',
}) => {
  /** 拖拽悬停状态 */
  const [isDragOver, setIsDragOver] = useState(false);

  /** 前端校验错误信息 */
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** 隐藏的 file input ref */
  const inputRef = useRef<HTMLInputElement>(null);

  /** 错误信息自动清除计时器 */
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 组件卸载时清理计时器 */
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  /**
   * 显示错误信息，并在 5 秒后自动清除。
   *
   * @param msg - 错误文本
   */
  const showError = useCallback((msg: string) => {
    setErrorMsg(msg);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 5000);
  }, []);

  /**
   * 处理通过校验的文件。
   *
   * @param file - 待上传的文件
   */
  const handleFile = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        showError(error);
        return;
      }
      setErrorMsg(null);
      onFileAccepted(file);
    },
    [onFileAccepted, showError],
  );

  // ────────── 拖拽事件 ──────────

  /**
   * 拖拽进入 / 悬停时阻止浏览器默认行为并标记激活态。
   */
  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDragOver) {
        setIsDragOver(true);
      }
    },
    [isDragOver],
  );

  /**
   * 拖拽离开时取消激活态。
   */
  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    },
    [],
  );

  /**
   * 拖拽放下时提取文件并处理。
   */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile],
  );

  // ────────── 点击上传 ──────────

  /**
   * 点击区域时触发隐藏 input 的文件选择。
   */
  const handleClick = useCallback(() => {
    if (isParsing) return;
    setErrorMsg(null);
    inputRef.current?.click();
  }, [isParsing]);

  /**
   * 隐藏 input 的 change 事件处理。
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // 重置 input value，以便同一文件可再次选择
      e.target.value = '';
    },
    [handleFile],
  );

  // ────────── 进度条计算 ──────────

  const showProgress =
    typeof uploadProgress === 'number' && uploadProgress >= 0;
  const progressPercent = showProgress
    ? Math.min(Math.round(uploadProgress!), 100)
    : 0;

  // ────────── 渲染 ──────────

  return (
    <div
      className={`drag-upload-area ${isDragOver ? 'drag-upload-area--active' : ''} ${isParsing ? 'drag-upload-area--parsing' : ''} ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="上传 Excel 文件"
      data-testid="drag-upload-area"
      style={{
        border: `2px dashed ${isDragOver ? '#1677ff' : '#d9d9d9'}`,
        borderRadius: 8,
        padding: '32px 24px',
        textAlign: 'center',
        cursor: isParsing ? 'wait' : 'pointer',
        background: isDragOver ? '#e6f4ff' : '#0f172a',
        transition: 'border-color 0.2s, background-color 0.2s',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* 隐藏的文件输入 */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXT}
        style={{ display: 'none' }}
        onChange={handleInputChange}
        data-testid="drag-upload-input"
      />

      {/* 解析中覆盖层 */}
      {isParsing && (
        <div
          className="drag-upload-area__parsing-overlay"
          data-testid="parsing-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.75)',
            borderRadius: 8,
            zIndex: 2,
          }}
        >
          <span style={{ fontSize: 14, color: '#666' }}>
            🔄 解析中，请稍候…
          </span>
        </div>
      )}

      {/* 默认提示文字 */}
      {!showProgress && !isParsing && (
        <div data-testid="upload-prompt">
          <p style={{ margin: '0 0 8px', fontSize: 16, color: '#333' }}>
            📁 点击或拖拽文件到此区域上传
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>
            仅支持 <strong>.xlsx</strong> 格式，文件大小不超过{' '}
            <strong>5MB</strong>
          </p>
        </div>
      )}

      {/* 进度条 */}
      {showProgress && (
        <div
          className="drag-upload-area__progress"
          data-testid="upload-progress"
          style={{ marginTop: 8 }}
        >
          <div
            style={{
              width: '100%',
              height: 12,
              background: '#f0f0f0',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <div
              className="drag-upload-area__progress-bar"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              data-testid="progress-bar"
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background:
                  progressPercent >= 100 ? '#52c41a' : '#1677ff',
                transition: 'width 0.3s ease',
                borderRadius: 6,
              }}
            />
          </div>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 13,
              color: progressPercent >= 100 ? '#52c41a' : '#666',
            }}
          >
            {progressPercent >= 100 ? '上传完成' : `上传中… ${progressPercent}%`}
          </p>
        </div>
      )}

      {/* 校验错误提示 */}
      {errorMsg && (
        <div
          className="drag-upload-area__error"
          role="alert"
          data-testid="upload-error"
          style={{
            marginTop: 12,
            padding: '8px 12px',
            color: '#ff4d4f',
            background: '#fef2f2',
            border: '1px solid #7f1d1d',
            borderRadius: 4,
            fontSize: 13,
          }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
};

export default DragUploadArea;