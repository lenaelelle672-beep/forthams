/**
 * LocationFormDialog — 位置创建/编辑表单弹窗组件
 *
 * 基于 mode: 'create' | 'edit' 控制标题与提交逻辑。
 * 引入受控表单状态管理，支持 6 个标准字段的输入。
 * 当 mode='create' 时，接收 defaultParentId 用于静默绑定父级关系。
 *
 * @module components/location/LocationFormDialog
 * @since SWARM-048
 */

import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import {
  createLocation,
  updateLocation,
  type Location,
  type LocationCreateData,
  type LocationUpdateData,
} from "../../services/api";

/* ------------------------------------------------------------------ */
/*  表单数据类型                                                       */
/* ------------------------------------------------------------------ */

/**
 * 表单内部状态类型
 *
 * @description 对应后端 Location 实体的 6 个标准字段（id 除外），
 * 不包含 children 等非持久化字段。
 */
interface FormState {
  /** 位置名称 */
  name: string;
  /** 位置编码 */
  locationCode: string;
  /** 父级位置 ID */
  parentId: number | null;
  /** 排序号 */
  sortOrder: number;
  /** 描述 */
  description: string;
}

/** 空表单默认值 */
const EMPTY_FORM: FormState = {
  name: "",
  locationCode: "",
  parentId: null,
  sortOrder: 0,
  description: "",
};

/* ------------------------------------------------------------------ */
/*  组件 Props                                                         */
/* ------------------------------------------------------------------ */

/**
 * LocationFormDialog 组件的 Props 接口
 */
export interface LocationFormDialogProps {
  /** 弹窗是否可见 */
  open: boolean;
  /** 模式：'create' 创建 | 'edit' 编辑 */
  mode: "create" | "edit";
  /** 编辑时的目标节点数据，create 模式下可为 null */
  targetNode: Location | null;
  /** 创建子节点时隐式绑定的父节点 ID */
  defaultParentId?: number | null;
  /** 父节点名称（用于展示） */
  parentName?: string;
  /** 操作成功回调 */
  onSuccess: () => void;
  /** 关闭弹窗回调 */
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  LocationFormDialog 主组件                                          */
/* ------------------------------------------------------------------ */

/**
 * LocationFormDialog — 位置创建/编辑表单弹窗
 *
 * @description 基于 mode 控制标题与提交逻辑。
 * - mode='create': 空表单，defaultParentId 隐式绑定父级关系
 * - mode='edit': 回显目标节点当前值
 * 表单 onSubmit 时阻断默认事件，调用 Level 1 的 API 方法。
 * API 返回成功后调用 onSuccess 回调，失败时保持弹窗打开并显示错误。
 *
 * @param props - 组件属性
 * @returns React 节点
 */
export default function LocationFormDialog({
  open,
  mode,
  targetNode,
  defaultParentId,
  parentName,
  onSuccess,
  onClose,
}: LocationFormDialogProps) {
  /** 受控表单状态 */
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  /** 提交中状态 */
  const [submitting, setSubmitting] = useState(false);
  /** 错误信息（用于 ATB-05 错误态容错） */
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * 当弹窗打开或 mode/targetNode 变化时，初始化表单状态
   */
  useEffect(() => {
    if (!open) return;

    setFormError(null);

    if (mode === "edit" && targetNode) {
      /** 编辑模式：回显目标节点当前值 */
      setForm({
        name: targetNode.name ?? "",
        locationCode: targetNode.locationCode ?? "",
        parentId: targetNode.parentId ?? null,
        sortOrder: targetNode.sortOrder ?? 0,
        description: targetNode.description ?? "",
      });
    } else {
      /** 创建模式：空表单，隐式绑定 defaultParentId */
      setForm({
        ...EMPTY_FORM,
        parentId: defaultParentId ?? null,
      });
    }
  }, [open, mode, targetNode, defaultParentId]);

  /**
   * 处理表单字段变化
   *
   * @param field - 字段名
   * @param value - 字段值
   */
  const handleChange = (field: keyof FormState, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    /** 清除之前的错误 */
    setFormError(null);
  };

  /**
   * 获取父节点名称展示
   */
  const displayParentName = (): string => {
    if (form.parentId == null) return "（顶级）";
    return parentName ?? `ID: ${form.parentId}`;
  };

  /**
   * 处理表单提交
   *
   * @description 阻断默认事件，校验必填字段后调用对应 API 方法。
   * 成功时调用 onSuccess 并关闭弹窗；失败时保持弹窗打开并显示错误。
   *
   * @param e - 表单提交事件
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    /** 校验必填字段 */
    if (!form.name.trim()) {
      setFormError("位置名称不能为空");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      if (mode === "edit" && targetNode) {
        /** 编辑模式：调用 updateLocation */
        const data: LocationUpdateData = {
          name: form.name.trim(),
          locationCode: form.locationCode.trim(),
          parentId: form.parentId,
          sortOrder: form.sortOrder,
          description: form.description.trim(),
        };
        await updateLocation(targetNode.id, data);
      } else {
        /** 创建模式：调用 createLocation */
        const data: LocationCreateData = {
          name: form.name.trim(),
          locationCode: form.locationCode.trim(),
          parentId: form.parentId,
          sortOrder: form.sortOrder,
          description: form.description.trim(),
        };
        await createLocation(data);
      }

      /** 成功后通知父组件 */
      onSuccess();
    } catch (err) {
      /** ATB-05: API 异常态容错 — 保持弹窗打开，显示错误 */
      const message =
        err instanceof Error ? err.message : "操作失败，请稍后重试";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  /** 弹窗未打开时不渲染 */
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* 弹窗内容 */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        {/* 弹窗标题 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === "edit" ? "编辑位置" : "新增位置"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 错误提示 — ATB-05 要求 .error-message 语义 class */}
        {formError && (
          <div className="error-message mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {formError}
          </div>
        )}

        {/* 表单 */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* 上级位置（只读展示） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                上级位置
              </label>
              <div className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 text-gray-500">
                {displayParentName()}
              </div>
            </div>

            {/* 位置名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                位置名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="请输入位置名称"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                  bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                  focus:border-blue-500 transition-colors"
              />
            </div>

            {/* 位置编码 + 排序 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  位置编码
                </label>
                <input
                  type="text"
                  value={form.locationCode}
                  onChange={(e) => handleChange("locationCode", e.target.value)}
                  placeholder="请输入位置编码"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                    bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                    focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  排序号
                </label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => handleChange("sortOrder", Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                    bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                    focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* 描述 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                描述
              </label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="请输入位置描述"
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                  bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                  focus:border-blue-500 transition-colors resize-none"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300
                bg-white text-gray-700 hover:bg-gray-50
                disabled:opacity-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white
                hover:bg-blue-700 disabled:opacity-50
                disabled:cursor-not-allowed transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  提交中...
                </span>
              ) : mode === "edit" ? (
                "保存修改"
              ) : (
                "创建位置"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
