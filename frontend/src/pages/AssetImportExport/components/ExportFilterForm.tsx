/**
 * ExportFilterForm – 导出条件筛选表单组件
 *
 * 提供按资产分类（category）、资产状态（status）、存放位置（location）
 * 三个维度的条件检索表单，并在用户点击"导出"按钮后触发导出接口请求，
 * 通过后端返回的二进制流利用 Blob + URL.createObjectURL 触发下载。
 *
 * 遵循边界约束 #3：所有文件下载动作采用 Blob 对象组装，
 * 利用 URL.createObjectURL 创建临时链接触发下载，
 * 禁止使用服务端直接返回静态文件 URL 的重定向方式。
 *
 * @module AssetImportExport/components/ExportFilterForm
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/** 导出筛选条件的字段值类型 */
export interface ExportFilterValues {
  /** 资产分类 */
  category: string;
  /** 资产状态 */
  status: string;
  /** 存放位置 */
  location: string;
}

/** ExportFilterForm 组件属性 */
export interface ExportFilterFormProps {
  /** 导出成功后的回调函数，参数为下载文件名 */
  onExportSuccess?: (filename: string) => void;
  /** 导出失败后的回调函数，参数为错误对象 */
  onExportError?: (error: Error) => void;
  /** 额外的自定义 CSS 类名 */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  常量选项                                                           */
/* ------------------------------------------------------------------ */

/** 资产分类选项列表 */
const CATEGORY_OPTIONS: ReadonlyArray<{ readonly label: string; readonly value: string }> = [
  { label: '全部', value: '' },
  { label: '电子设备', value: '电子设备' },
  { label: '办公家具', value: '办公家具' },
  { label: '交通工具', value: '交通工具' },
  { label: '生产设备', value: '生产设备' },
  { label: '其他', value: '其他' },
] as const;

/** 资产状态选项列表 */
const STATUS_OPTIONS: ReadonlyArray<{ readonly label: string; readonly value: string }> = [
  { label: '全部', value: '' },
  { label: '在用', value: '在用' },
  { label: '闲置', value: '闲置' },
  { label: '维修中', value: '维修中' },
  { label: '已报废', value: '已报废' },
] as const;

/** 存放位置选项列表 */
const LOCATION_OPTIONS: ReadonlyArray<{ readonly label: string; readonly value: string }> = [
  { label: '全部', value: '' },
  { label: 'A区', value: 'A区' },
  { label: 'B区', value: 'B区' },
  { label: 'C区', value: 'C区' },
  { label: '仓库', value: '仓库' },
] as const;

/** 初始筛选条件（全部为"全部"） */
const INITIAL_FILTER_VALUES: ExportFilterValues = {
  category: '',
  status: '',
  location: '',
};

/* ------------------------------------------------------------------ */
/*  工具函数                                                           */
/* ------------------------------------------------------------------ */

/**
 * 通过 Blob + URL.createObjectURL 触发浏览器文件保存行为。
 *
 * 创建临时 <a> 元素模拟点击下载，完成后释放 Object URL 防止内存泄漏。
 * 严格遵循边界约束 #3 的前端流处理要求。
 *
 * @param blob  - 后端返回的二进制流 Blob 对象
 * @param filename - 下载文件的名称（含扩展名）
 */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const blobUrl: string = URL.createObjectURL(blob);

  const anchor: HTMLAnchorElement = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  // 延迟清理，确保浏览器已启动下载流程
  setTimeout(() => {
    if (anchor.parentNode) {
      anchor.parentNode.removeChild(anchor);
    }
    URL.revokeObjectURL(blobUrl);
  }, 300);
}

/**
 * 调用后端导出接口，获取二进制 Blob 并解析文件名。
 *
 * 构造包含筛选条件的 URL 查询参数（仅包含非空值），
 * 以 responseType 等效方式（fetch + .blob()）获取二进制响应，
 * 并从响应头 Content-Disposition 中提取服务端建议的文件名。
 *
 * @param filters - 当前筛选条件对象
 * @returns 包含 blob（二进制数据）与 filename（文件名）的 Promise
 * @throws 网络异常或后端返回非成功 HTTP 状态码时抛出 Error
 */
async function fetchExportBlob(
  filters: ExportFilterValues,
): Promise<{ blob: Blob; filename: string }> {
  const params = new URLSearchParams();

  // 仅附加非空筛选值到查询参数，确保请求 Payload 包含有效条件
  if (filters.category) {
    params.append('category', filters.category);
  }
  if (filters.status) {
    params.append('status', filters.status);
  }
  if (filters.location) {
    params.append('location', filters.location);
  }

  const queryString: string = params.toString();
  const url: string = `/api/asset/export${queryString ? `?${queryString}` : ''}`;

  const response: Response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });

  if (!response.ok) {
    throw new Error(
      `导出请求失败，HTTP 状态码: ${response.status}`,
    );
  }

  const blob: Blob = await response.blob();

  // 从 Content-Disposition 响应头提取文件名
  const disposition: string = response.headers.get('Content-Disposition') || '';
  const filenameMatch: RegExpMatchArray | null = disposition.match(
    /filename\*?=(?:UTF-8''|"?)([^";]+)/i,
  );
  const filename: string = filenameMatch
    ? decodeURIComponent(filenameMatch[1])
    : `asset_export_${Date.now()}.xlsx`;

  return { blob, filename };
}

/**
 * 渲染单个 <select> 筛选字段。
 *
 * 统一渲染 label + select 结构，绑定受控 value 与 onChange，
 * 同时输出 data-testid 以便 Playwright 定位。
 *
 * @param id         - select 元素的 id 及 label 的 htmlFor
 * @param testId     - data-testid 属性值
 * @param labelText  - 显示的标签文本
 * @param name       - 表单字段名（对应 ExportFilterValues 的 key）
 * @param value      - 当前选中值
 * @param options    - 可选项列表
 * @param onChange   - 值变更回调
 * @param disabled   - 是否禁用
 */
function renderSelectField(
  id: string,
  testId: string,
  labelText: string,
  name: string,
  value: string,
  options: ReadonlyArray<{ readonly label: string; readonly value: string }>,
  onChange: (field: keyof ExportFilterValues, val: string) => void,
  disabled: boolean,
): React.ReactNode {
  return (
    <div className="filter-field">
      <label htmlFor={id} className="filter-label">
        {labelText}
      </label>
      <select
        id={id}
        name={name}
        data-testid={testId}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          onChange(name as keyof ExportFilterValues, e.target.value)
        }
        className="filter-select"
        disabled={disabled}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  主组件                                                             */
/* ------------------------------------------------------------------ */

/**
 * ExportFilterForm – 导出条件筛选表单组件
 *
 * 提供按资产分类、资产状态、存放位置三个维度的条件检索表单，
 * 支持重置筛选条件及触发条件导出下载。
 *
 * 状态管理层：
 * - filters: 管理三个筛选维度的当前值，实现重置与条件提交逻辑。
 * - loading: 导出请求进行中的加载态。
 * - blobUrlRef: 追踪已创建的 Object URL，组件卸载时释放内存。
 *
 * @param props - 组件属性
 */
export const ExportFilterForm: React.FC<ExportFilterFormProps> = ({
  onExportSuccess,
  onExportError,
  className = '',
}) => {
  const [filters, setFilters] = useState<ExportFilterValues>(INITIAL_FILTER_VALUES);
  const [loading, setLoading] = useState<boolean>(false);

  /** 追踪未释放的 Object URL，用于组件卸载时清理 */
  const blobUrlRef = useRef<string | null>(null);

  /**
   * 组件卸载时释放所有未清理的 Object URL，防止内存泄漏。
   * 严格遵循基础设施层要求：在组件卸载时调用 URL.revokeObjectURL。
   */
  useEffect(() => {
    return (): void => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  /**
   * 更新单个筛选条件字段值。
   *
   * 采用函数式 setState 确保在快速连续操作时状态一致性。
   *
   * @param field - 要更新的字段名（category / status / location）
   * @param value - 新的字段值
   */
  const handleFilterChange = useCallback(
    (field: keyof ExportFilterValues, value: string): void => {
      setFilters((prev: ExportFilterValues) => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  /**
   * 重置所有筛选条件为初始值。
   *
   * 将 category、status、location 全部重置为空字符串（即"全部"），
   * 表单状态正确绑定，确保 UI 同步更新。
   */
  const handleReset = useCallback((): void => {
    setFilters(INITIAL_FILTER_VALUES);
  }, []);

  /**
   * 处理导出操作。
   *
   * 将当前筛选条件作为查询参数发送至后端导出接口，
   * 获取二进制流后通过 Blob + URL.createObjectURL 触发文件下载。
   * 导出期间按钮置灰防止重复提交，成功/失败后通过回调通知父组件。
   */
  const handleExport = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const { blob, filename } = await fetchExportBlob(filters);

      // 记录新创建的 blob URL 用于后续清理
      const newBlobUrl: string = URL.createObjectURL(blob);
      blobUrlRef.current = newBlobUrl;

      triggerBlobDownload(blob, filename);
      onExportSuccess?.(filename);
    } catch (error: unknown) {
      const err: Error =
        error instanceof Error
          ? error
          : new Error(String(error));
      onExportError?.(err);
    } finally {
      setLoading(false);
    }
  }, [filters, onExportSuccess, onExportError]);

  return (
    <form
      className={`export-filter-form ${className}`}
      onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handleExport();
      }}
      data-testid="export-filter-form"
    >
      {/* 资产分类筛选 */}
      {renderSelectField(
        'export-filter-category',
        'filter-category',
        '资产分类',
        'category',
        filters.category,
        CATEGORY_OPTIONS,
        handleFilterChange,
        loading,
      )}

      {/* 资产状态筛选 */}
      {renderSelectField(
        'export-filter-status',
        'filter-status',
        '资产状态',
        'status',
        filters.status,
        STATUS_OPTIONS,
        handleFilterChange,
        loading,
      )}

      {/* 存放位置筛选 */}
      {renderSelectField(
        'export-filter-location',
        'filter-location',
        '存放位置',
        'location',
        filters.location,
        LOCATION_OPTIONS,
        handleFilterChange,
        loading,
      )}

      {/* 操作按钮区 */}
      <div className="filter-actions">
        <button
          type="button"
          className="btn-reset"
          data-testid="filter-reset-btn"
          onClick={handleReset}
          disabled={loading}
        >
          重置
        </button>
        <button
          type="submit"
          className="btn-export"
          data-testid="filter-export-btn"
          disabled={loading}
        >
          {loading ? '导出中...' : '导出 Excel'}
        </button>
      </div>
    </form>
  );
};

export default ExportFilterForm;