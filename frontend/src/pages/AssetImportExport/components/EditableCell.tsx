import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input, InputNumber, DatePicker, Select, Tag } from 'antd';
import type { SelectProps } from 'antd';
import dayjs from 'dayjs';

/**
 * 可编辑单元格组件
 *
 * 用于资产导入预览表格，仅校验失败的行允许内联编辑修正。
 *
 * 功能：
 * - 仅 hasError=true 时允许点击进入编辑模式（蓝色下划线标识）
 * - 支持 text / number / date / select 四种输入类型
 * - 失焦或回车保存，实时清除该字段错误提示
 * - 编辑完成后标记为「已修正」（橙色 badge）
 * - 校验通过的单元格不可编辑，仅展示值
 */

/** 字段输入类型 */
export type FieldType = 'text' | 'number' | 'date' | 'select';

/** 列配置，供父组件 ParsePreviewTable 构建列定义时使用 */
export interface ColumnConfig {
  /** 字段标识，对应 AssetRow 中的 key */
  dataIndex: string;
  /** 列标题 */
  title: string;
  /** 输入控件类型 */
  fieldType: FieldType;
  /** select 类型的可选项 */
  options?: SelectProps['options'];
}

/** EditableCell 组件属性 */
export interface EditableCellProps {
  /** 当前单元格值 */
  value: any;
  /** 列配置 */
  column: ColumnConfig;
  /** 值变更回调，编辑完成时触发 */
  onChange: (newValue: any) => void;
  /** 该单元格是否存在校验错误 */
  hasError: boolean;
  /** 校验错误信息文案 */
  errorMessage?: string;
  /** 是否已修正（曾有过错误并已编辑） */
  corrected?: boolean;
}

const EditableCell: React.FC<EditableCellProps> = ({
  value,
  column,
  onChange,
  hasError,
  errorMessage,
  corrected = false,
}) => {
  const [editing, setEditing] = useState(false);
  /** 使用 ref 跟踪编辑值，避免闭包过期导致保存旧值 */
  const editValueRef = useRef<any>(value);
  const inputRef = useRef<any>(null);

  // 进入编辑模式时自动聚焦输入控件
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  /** 仅校验失败行允许进入编辑 */
  const enterEdit = useCallback(() => {
    if (!hasError) return;
    setEditing(true);
    editValueRef.current = value;
  }, [hasError, value]);

  /** 保存编辑值并退出编辑模式 */
  const save = useCallback(() => {
    setEditing(false);
    const current = editValueRef.current;
    if (current !== value) {
      onChange(current);
    }
  }, [value, onChange]);

  /** 取消编辑，恢复原值 */
  const cancel = useCallback(() => {
    setEditing(false);
    editValueRef.current = value;
  }, [value]);

  /** 键盘事件：Enter 保存，Escape 取消 */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        save();
      } else if (e.key === 'Escape') {
        cancel();
      }
    },
    [save, cancel],
  );

  /** 渲染只读展示值（select 类型自动查找 label） */
  const renderDisplayValue = (): React.ReactNode => {
    if (value === undefined || value === null || value === '') {
      return <span style={{ color: '#bfbfbf' }}>-</span>;
    }
    if (column.fieldType === 'select' && column.options) {
      const matched = column.options.find((opt) => opt.value === value);
      return matched ? String(matched.label) : String(value);
    }
    return String(value);
  };

  // ===== 编辑模式 =====
  if (editing) {
    return (
      <div style={{ position: 'relative' }}>
        {column.fieldType === 'text' && (
          <Input
            ref={inputRef}
            defaultValue={value != null ? String(value) : ''}
            onChange={(e) => {
              editValueRef.current = e.target.value;
            }}
            onBlur={save}
            onKeyDown={handleKeyDown}
            size="small"
          />
        )}

        {column.fieldType === 'number' && (
          <InputNumber
            ref={inputRef}
            defaultValue={value ?? undefined}
            onChange={(val) => {
              editValueRef.current = val;
            }}
            onBlur={save}
            onKeyDown={handleKeyDown}
            size="small"
            style={{ width: '100%' }}
          />
        )}

        {column.fieldType === 'date' && (
          <DatePicker
            ref={inputRef}
            defaultValue={value ? dayjs(value) : undefined}
            onChange={(val) => {
              const formatted = val ? val.format('YYYY-MM-DD') : null;
              editValueRef.current = formatted;
              setEditing(false);
              if (formatted !== value) {
                onChange(formatted);
              }
            }}
            onOpenChange={(open) => {
              if (!open) {
                setEditing(false);
              }
            }}
            size="small"
            style={{ width: '100%' }}
          />
        )}

        {column.fieldType === 'select' && (
          <Select
            ref={inputRef}
            defaultValue={value}
            options={column.options}
            onChange={(val) => {
              editValueRef.current = val;
              setEditing(false);
              if (val !== value) {
                onChange(val);
              }
            }}
            onBlur={() => {
              setEditing(false);
            }}
            size="small"
            style={{ width: '100%' }}
            showSearch
            defaultOpen
          />
        )}

        {errorMessage && (
          <div style={{ color: '#ff4d4f', fontSize: 12, lineHeight: '18px', marginTop: 2 }}>
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  // ===== 只读模式（无错误且未修正 — 校验通过行的单元格） =====
  if (!hasError && !corrected) {
    return <div style={{ minHeight: 32, lineHeight: '32px' }}>{renderDisplayValue()}</div>;
  }

  // ===== 错误 / 已修正展示模式 =====
  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={hasError ? enterEdit : undefined}
        role={hasError ? 'button' : undefined}
        tabIndex={hasError ? 0 : undefined}
        style={{
          minHeight: 32,
          lineHeight: '32px',
          cursor: hasError ? 'pointer' : 'default',
          borderBottom: hasError ? '2px solid #1890ff' : undefined,
        }}
      >
        <span>{renderDisplayValue()}</span>
        {corrected && !hasError && (
          <Tag color="orange" style={{ fontSize: 11, marginLeft: 4, lineHeight: '16px' }}>
            已修正
          </Tag>
        )}
      </div>
      {errorMessage && hasError && (
        <div style={{ color: '#ff4d4f', fontSize: 12, lineHeight: '18px', marginTop: 2 }}>
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default EditableCell;