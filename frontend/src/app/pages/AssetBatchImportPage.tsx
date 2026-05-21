/**
 * AssetBatchImportPage — 资产批量导入页面
 *
 * 编排文件选择、校验、上传状态机流转的容器页面。
 * 整合 ImportTemplateDownload 与 ImportResultTable，
 * 串联完整的资产批量导入业务闭环。
 *
 * 状态机：IDLE -> UPLOADING -> PARSING -> COMPLETED | PARTIAL_SUCCESS | FAILED
 * 文件格式：仅允许 .xlsx 和 .csv（正则校验 /\.(xlsx|csv)$/i）
 * 文件大小：单次上传硬性上限 10MB
 *
 * @module pages/AssetBatchImportPage
 * @since SWARM-019
 */

import React, { useState, useCallback, useRef } from 'react';
import { Upload, Loader2, FileText, AlertCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../utils/api';
import { ImportTemplateDownload } from '../components/import/ImportTemplateDownload';
import { ImportResultTable } from '../components/import/ImportResultTable';
import type { ImportDetailItem } from '../components/import/ImportResultTable';

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/**
 * 导入状态枚举
 *
 * @description 严格限制为 IDLE -> UPLOADING -> PARSING -> 终态
 */
export enum ImportStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PARSING = 'PARSING',
  COMPLETED = 'COMPLETED',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',
  FAILED = 'FAILED',
}

/**
 * 导入响应数据接口
 *
 * @description 后端 POST /api/assets/import 返回的数据结构
 */
export interface AssetImportResponse {
  /** 导入状态 */
  status: 'COMPLETED' | 'PARTIAL_SUCCESS' | 'FAILED';
  /** 成功条数 */
  successCount: number;
  /** 失败条数 */
  failCount: number;
  /** 导入明细 */
  details: ImportDetailItem[];
}

/**
 * 导出请求参数接口
 *
 * @description 后端 GET /api/assets/export 的查询参数
 */
export interface AssetExportParams {
  /** 搜索关键词 */
  keyword?: string;
  /** 资产状态过滤 */
  status?: string;
  /** 分类过滤 */
  categoryId?: string;
  /** 部门过滤 */
  departmentId?: string;
  /** 当前页码 */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  常量                                                               */
/* ------------------------------------------------------------------ */

/** 文件大小上限 10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 允许的文件扩展名正则 */
const VALID_FILE_PATTERN = /\.(xlsx|csv)$/i;

/* ------------------------------------------------------------------ */
/*  校验工具函数                                                       */
/* ------------------------------------------------------------------ */

/**
 * 校验文件类型
 *
 * @param fileName - 文件名
 * @returns 是否为合法的 xlsx/csv 文件
 */
export function validateFileType(fileName: string): boolean {
  return VALID_FILE_PATTERN.test(fileName);
}

/**
 * 校验文件大小
 *
 * @param fileSize - 文件字节大小
 * @returns 是否在 10MB 以内
 */
export function validateFileSize(fileSize: number): boolean {
  return fileSize <= MAX_FILE_SIZE;
}

/* ------------------------------------------------------------------ */
/*  API 请求函数                                                       */
/* ------------------------------------------------------------------ */

/**
 * 上传资产导入文件
 *
 * @param formData - 包含 file 字段的 FormData
 * @returns 导入结果响应
 */
export async function postAssetImportFile(
  formData: FormData,
): Promise<AssetImportResponse> {
  const response = await apiClient.post<AssetImportResponse>(
    '/assets/import',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
  return response.data;
}

/**
 * 导出资产列表文件
 *
 * @param params - 查询参数（包含过滤条件）
 * @returns Blob 二进制数据
 */
export async function getAssetExportFile(
  params: AssetExportParams,
): Promise<Blob> {
  const response = await apiClient.get('/assets/export', {
    params,
    responseType: 'blob',
  });
  return response.data instanceof Blob
    ? response.data
    : new Blob([response.data]);
}

/* ------------------------------------------------------------------ */
/*  页面组件                                                           */
/* ------------------------------------------------------------------ */

/**
 * AssetBatchImportPage — 资产批量导入页面容器
 *
 * 编排文件选择、前端校验、上传状态机流转、结果展示的完整导入流程。
 * 整合 ImportTemplateDownload（模板下载）与 ImportResultTable（结果表格）。
 *
 * @returns React 组件
 *
 * @example
 * ```tsx
 * // 在路由中使用
 * <Route path="/assets/batch-import" element={<AssetBatchImportPage />} />
 * ```
 */
export default function AssetBatchImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 导入状态机 */
  const [importStatus, setImportStatus] = useState<ImportStatus>(ImportStatus.IDLE);

  /** 导入结果 */
  const [importResponse, setImportResponse] = useState<AssetImportResponse | null>(null);

  /** 已选择的文件 */
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  /** 前端校验错误 */
  const [validationError, setValidationError] = useState<string | null>(null);

  /**
   * 处于上传中或解析中状态的标志
   *
   * @description UPLOADING 和 PARSING 状态下禁止重复触发上传
   */
  const isBusy =
    importStatus === ImportStatus.UPLOADING || importStatus === ImportStatus.PARSING;

  /**
   * 处理文件选择
   *
   * @param event - 文件输入变化事件
   */
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      setValidationError(null);
      setImportResponse(null);

      if (!file) return;

      // 文件格式校验
      if (!validateFileType(file.name)) {
        setValidationError('仅支持 .xlsx 或 .csv 格式');
        toast.error('仅支持 .xlsx 或 .csv 格式');
        return;
      }

      // 文件大小校验
      if (!validateFileSize(file.size)) {
        setValidationError('文件大小不能超过 10MB');
        toast.error('文件大小不能超过 10MB');
        return;
      }

      setSelectedFile(file);
    },
    [],
  );

  /**
   * 执行文件上传
   *
   * @description 严格遵循状态机：IDLE -> UPLOADING -> PARSING -> 终态
   * UPLOADING 和 PARSING 状态下禁止重复触发。
   */
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    if (isBusy) return;

    setValidationError(null);
    setImportStatus(ImportStatus.UPLOADING);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // 进入 PARSING 状态
      setImportStatus(ImportStatus.PARSING);

      const result = await postAssetImportFile(formData);

      setImportResponse(result);

      // 根据后端返回状态设置终态
      if (result.status === 'COMPLETED') {
        setImportStatus(ImportStatus.COMPLETED);
        toast.success(`导入完成：成功 ${result.successCount} 条`);
      } else if (result.status === 'PARTIAL_SUCCESS') {
        setImportStatus(ImportStatus.PARTIAL_SUCCESS);
        toast.warning(`部分成功：成功 ${result.successCount} 条，失败 ${result.failCount} 条`);
      } else {
        setImportStatus(ImportStatus.FAILED);
        toast.error(`导入失败：${result.failCount} 条数据未通过校验`);
      }
    } catch (error) {
      setImportStatus(ImportStatus.FAILED);
      const message =
        error instanceof Error ? error.message : '导入失败，请稍后重试';
      toast.error(message);
    }
  }, [selectedFile, isBusy]);

  /**
   * 重置导入流程
   *
   * @description 清空所有状态，回到 IDLE
   */
  const handleReset = useCallback(() => {
    setImportStatus(ImportStatus.IDLE);
    setImportResponse(null);
    setSelectedFile(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * 判断导入终态的状态（用于 ImportResultTable）
   */
  const resultStatus = importResponse?.status ?? 'FAILED';

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">资产批量导入</h1>
        <p className="mt-2 text-sm text-gray-400">
          上传标准 Excel/CSV 文件批量创建资产，支持 .xlsx 和 .csv 格式，单文件最大 10MB
        </p>
      </div>

      {/* 模板下载 */}
      <div className="mb-6">
        <ImportTemplateDownload disabled={isBusy} />
      </div>

      {/* 文件选择区 */}
      <div className="mb-6">
        <label
          htmlFor="asset-import-file"
          className={`flex flex-col items-center justify-center w-full h-48
            border-2 border-dashed rounded-xl cursor-pointer transition-colors
            ${
              isBusy
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                : 'border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50'
            }
            ${validationError ? 'border-red-300 bg-red-50' : ''}
          `}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {isBusy ? (
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
            ) : (
              <Upload className="w-10 h-10 text-gray-400 mb-3" />
            )}
            <p className="mb-1 text-sm text-gray-400">
              {isBusy
                ? importStatus === ImportStatus.UPLOADING
                  ? '正在上传...'
                  : '正在解析...'
                : '点击选择文件或拖拽至此处'}
            </p>
            <p className="text-xs text-gray-400">
              支持 .xlsx 和 .csv 格式，最大 10MB
            </p>
          </div>
          <input
            id="asset-import-file"
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileSelect}
            disabled={isBusy}
            className="hidden"
          />
        </label>

        {/* 校验错误提示 */}
        {validationError && (
          <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
      </div>

      {/* 已选择文件信息 + 操作按钮 */}
      {selectedFile && !importResponse && (
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-400">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
                  rounded-lg border border-gray-200 bg-white text-gray-700
                  hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                重置
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
                  rounded-lg bg-blue-600 text-white hover:bg-blue-700
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {importStatus === ImportStatus.UPLOADING ? '上传中...' : '解析中...'}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    开始导入
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导入结果展示 */}
      {importResponse && (
        <div className="space-y-6">
          <ImportResultTable
            details={importResponse.details}
            successCount={importResponse.successCount}
            failCount={importResponse.failCount}
            status={resultStatus as 'COMPLETED' | 'PARTIAL_SUCCESS' | 'FAILED'}
          />

          {/* 操作按钮 */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
                rounded-lg border border-gray-200 bg-white text-gray-700
                hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              重新导入
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
