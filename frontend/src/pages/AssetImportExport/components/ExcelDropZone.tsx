import React, { useState, useRef, useCallback } from 'react';
import { message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

/**
 * ExcelDropZone 拖拽上传区域组件
 *
 * 支持拖拽 & 点击选择 xlsx 文件，限制单文件、≤10MB。
 * 交付物 G-3: ExcelDropZone 组件
 *
 * 安全约束 (B-5): 文件扩展名和 MIME type 双重检查，拒绝非 xlsx 文件
 * 文件约束 (B-1): 仅 .xlsx 格式，最大 10MB (10,485,760 bytes)
 * 交互约束 (B-4): 虚线边框矩形区域，拖拽文件进入时边框高亮变色
 * 错误提示 (B-4): 校验失败通过 Ant Design message.error 全局提示
 *
 * @example
 * ```tsx
 * <ExcelDropZone
 *   onFileSelect={(file) => handleUpload(file)}
 *   disabled={isUploading}
 * />
 * ```
 */

/** 交付物 G-3: ExcelDropZone 组件 Props */
export interface ExcelDropZoneProps {
  /** 合法文件被选中后的回调函数 */
  onFileSelect: (file: File) => void;
  /** 是否禁用交互（上传进行中时置为 true，防止重复提交 ATB-09） */
  disabled?: boolean;
}

/** B-1: 最大文件大小 10MB (10,485,760 bytes) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** B-1/B-5: 允许的 xlsx MIME type */
const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const ExcelDropZone: React.FC<ExcelDropZoneProps> = ({
  onFileSelect,
  disabled = false,
}) => {
  const { t } = useTranslation('assetImportExport');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 校验文件的扩展名和 MIME type (B-5 双重检查) 以及大小 (B-1)
   *
   * 校验失败时通过 Ant Design message.error 全局提示 (B-4)，
   * 不使用 alert()。
   *
   * @param file - 待校验的文件对象
   * @returns 是否通过校验
   */
  const validateFile = useCallback(
    (file: File): boolean => {
      const fileName = file.name.toLowerCase();
      const isXlsxExtension = fileName.endsWith('.xlsx');
      // 某些浏览器可能不设置 MIME type，仅当 MIME 存在且不匹配时拒绝
      const hasValidMime = !file.type || file.type === XLSX_MIME_TYPE;

      if (!isXlsxExtension || !hasValidMime) {
        message.error(
          t('excelDropZone.error.format', '仅支持 .xlsx 格式文件'),
        );
        return false;
      }

      if (file.size > MAX_FILE_SIZE) {
        message.error(
          t('excelDropZone.error.size', '文件大小不能超过 10MB'),
        );
        return false;
      }

      return true;
    },
    [t],
  );

  /**
   * 处理选中的文件列表：校验后回调 onFileSelect
   *
   * G-3: 限制单文件上传，仅取 files[0]
   * 校验通过后重置 input value 以允许重复选择同一文件
   *
   * @param files - 用户选择或拖拽的文件列表
   */
  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0]; // G-3: 单文件上传

      if (validateFile(file)) {
        onFileSelect(file);
      }

      // 重置 input value，允许重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [validateFile, onFileSelect],
  );

  /**
   * 拖拽进入/经过事件处理：阻止默认行为并高亮边框 (B-4)
   *
   * @param e - 拖拽事件对象
   */
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled],
  );

  /**
   * 拖拽离开事件处理：取消高亮
   *
   * @param e - 拖拽事件对象
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  /**
   * 拖拽释放事件处理：取消高亮并处理文件
   *
   * @param e - 拖拽释放事件对象
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (!disabled) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, handleFiles],
  );

  /**
   * 点击区域事件处理：触发隐藏 input 的文件选择对话框
   */
  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  /**
   * 键盘事件处理：Enter/Space 触发文件选择（无障碍支持）
   *
   * @param e - 键盘事件对象
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [disabled],
  );

  /**
   * 隐藏 input 的 change 事件处理：将文件列表传递给 handleFiles
   *
   * @param e - input change 事件对象
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles],
  );

  return (
    <div
      data-testid="drop-zone"
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={t('excelDropZone.ariaLabel', '上传 Excel 文件')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        border: `2px dashed ${isDragging ? '#1677ff' : '#d9d9d9'}`,
        borderRadius: 8,
        padding: '40px 20px',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: isDragging ? '#e6f4ff' : '#0f172a',
        transition: 'border-color 0.3s, background-color 0.3s',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
        outline: 'none',
      }}
    >
      {/* 隐藏的 file input，ATB-02 通过 data-testid="file-input" 定位 */}
      <input
        data-testid="file-input"
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={handleInputChange}
        disabled={disabled}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      <InboxOutlined
        style={{
          fontSize: 48,
          color: isDragging ? '#1677ff' : '#bfbfbf',
          marginBottom: 16,
          display: 'block',
        }}
      />

      <p style={{ fontSize: 16, color: 'rgba(0, 0, 0, 0.85)', marginBottom: 4 }}>
        {t('excelDropZone.dragTitle', '拖拽文件到此区域上传')}
      </p>

      <p style={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.45)', marginBottom: 4 }}>
        {t('excelDropZone.orClick', '或点击选择文件')}
      </p>

      <p style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.25)', marginTop: 8 }}>
        {t(
          'excelDropZone.hint',
          '仅支持 .xlsx 格式，文件大小不超过 10MB',
        )}
      </p>
    </div>
  );
};

export default ExcelDropZone;