/**
 * LocationFormPage — 位置创建/编辑表单页面
 *
 * 根据 URL 路由参数判断创建模式或编辑模式：
 * - /locations/new          → 创建模式（空表单，可选 ?parentId= 预填父节点）
 * - /locations/:id/edit     → 编辑模式（回显数据）
 *
 * 数据通过 locationService 调用真实后端 API，无 Mock 逻辑。
 * 表单字段严格对齐 Location.java：name, locationCode, parentId, sortOrder, description。
 *
 * @module pages/location/LocationFormPage
 * @since SWARM-072
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  locationService,
  buildLocationTree,
} from "../../services/locationService";
import type { ILocationTreeNode } from "../../types/location";

/* ------------------------------------------------------------------ */
/*  类型与常量                                                         */
/* ------------------------------------------------------------------ */

/** 表单字段接口，严格对齐 Location.java（不含 id） */
interface LocationFormState {
  /** 位置名称 */
  name: string;
  /** 位置编码 */
  locationCode: string;
  /** 父级位置 ID，null 表示顶级位置 */
  parentId: number | null;
  /** 排序号 */
  sortOrder: number;
  /** 描述 */
  description: string;
}

/** 空表单初始值 */
const INITIAL_FORM: LocationFormState = {
  name: "",
  locationCode: "",
  parentId: null,
  sortOrder: 0,
  description: "",
};

/* ------------------------------------------------------------------ */
/*  页面组件                                                           */
/* ------------------------------------------------------------------ */

/**
 * LocationFormPage — 位置创建/编辑表单页面
 *
 * @description 通过 `useParams` 读取路由中的 `id` 判断当前模式：
 * - 有 id → 编辑模式，挂载时调用 `getById` 回填表单
 * - 无 id → 创建模式，初始化空表单，支持通过 URL 参数 `?parentId=` 预填父节点
 *
 * 提交时调用 `create` 或 `update`，成功后跳转至树页面。
 * 网络异常和后端业务异常（如 locationCode 唯一性冲突）均会弹出错误提示，
 * 阻断跳转，禁止静默失败。
 *
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <Route path="/locations/new" element={<LocationFormPage />} />
 * <Route path="/locations/:id/edit" element={<LocationFormPage />} />
 * ```
 */
export default function LocationFormPage() {
  /* ------------------------------------------------------------------ */
  /*  路由与导航                                                         */
  /* ------------------------------------------------------------------ */

  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  /** 是否为编辑模式 */
  const isEditMode = Boolean(id);

  /* ------------------------------------------------------------------ */
  /*  状态管理                                                           */
  /* ------------------------------------------------------------------ */

  /** 表单数据 */
  const [form, setForm] = useState<LocationFormState>(() => {
    // 创建模式下，如果 URL 包含 parentId 参数，预填
    const parentIdParam = searchParams.get("parentId");
    if (parentIdParam) {
      return { ...INITIAL_FORM, parentId: Number(parentIdParam) };
    }
    return INITIAL_FORM;
  });

  /** 位置树数据（用于 parentId 下拉选择） */
  const [treeData, setTreeData] = useState<ILocationTreeNode[]>([]);

  /** 页面加载状态（编辑模式下回显数据） */
  const [loading, setLoading] = useState(isEditMode);

  /** 表单提交中 */
  const [submitting, setSubmitting] = useState(false);

  /** 错误信息 */
  const [error, setError] = useState<string | null>(null);

  /* ------------------------------------------------------------------ */
  /*  数据加载                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 加载位置树数据（用于 parentId 选择器）和编辑模式下的详情数据
   */
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        // 加载位置树（用于 parentId 选择）
        const flatList = await locationService.fetchLocations();
        if (!cancelled) {
          setTreeData(buildLocationTree(Array.isArray(flatList) ? flatList : []));
        }

        // 编辑模式下加载详情数据
        if (id) {
          setLoading(true);
          const location = await locationService.getById(id);
          if (!cancelled) {
            setForm({
              name: location.name ?? "",
              locationCode: location.locationCode ?? "",
              parentId: location.parentId ?? null,
              sortOrder: location.sortOrder ?? 0,
              description: location.description ?? "",
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "获取位置信息失败";
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [id]);

  /* ------------------------------------------------------------------ */
  /*  表单交互                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 处理表单字段变化
   *
   * @param field - 字段名
   * @param value - 新值
   */
  const handleChange = useCallback(
    (field: keyof LocationFormState, value: string | number | null) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      if (error) setError(null);
    },
    [error],
  );

  /**
   * 表单提交处理器
   *
   * @description 验证必填字段后调用 create 或 update。
   * 成功后 toast 提示并导航回树页面。
   * 创建模式下 payload 不包含 id 字段。
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // 字段校验
      if (!form.name.trim()) {
        toast.error("位置名称不能为空");
        return;
      }

      if (!form.locationCode.trim()) {
        toast.error("位置编码不能为空");
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        /** 构建严格对齐 Location 实体的 payload（创建时不含 id） */
        const payload: Record<string, unknown> = {
          name: form.name.trim(),
          locationCode: form.locationCode.trim(),
          parentId: form.parentId,
          sortOrder: form.sortOrder,
          description: form.description.trim() || undefined,
        };

        if (isEditMode && id) {
          await locationService.update(id, payload);
          toast.success("位置更新成功");
        } else {
          await locationService.create(payload);
          toast.success("位置创建成功");
        }

        navigate("/locations");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "操作失败，请稍后重试";
        setError(message);
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [form, isEditMode, id, navigate],
  );

  /**
   * 返回树页面
   */
  const handleGoBack = useCallback(() => {
    navigate("/locations");
  }, [navigate]);

  /* ------------------------------------------------------------------ */
  /*  辅助：将树扁平化为选择项                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 将树形结构扁平化为选项列表（带缩进前缀）
   *
   * @param nodes - 树节点数组
   * @param prefix - 缩进前缀
   * @param excludeId - 需要排除的节点 ID（编辑时排除自身，防止循环引用）
   * @returns 扁平选项数组
   */
  function flattenTreeToOptions(
    nodes: ILocationTreeNode[],
    prefix = "",
    excludeId?: number,
  ): Array<{ value: number | null; label: string }> {
    const options: Array<{ value: number | null; label: string }> = [];

    for (const node of nodes) {
      if (excludeId !== undefined && node.id === excludeId) continue;

      options.push({
        value: node.id,
        label: `${prefix}${node.name || "-"}`,
      });

      if (node.children.length > 0) {
        options.push(
          ...flattenTreeToOptions(node.children, `${prefix}  `, excludeId),
        );
      }
    }

    return options;
  }

  /** parentId 下拉选项 */
  const parentOptions = flattenTreeToOptions(
    treeData,
    "",
    isEditMode ? Number(id) : undefined,
  );

  /** 查找选中的 parentId 对应的节点名称 */
  const selectedParentName = (() => {
    if (form.parentId == null) return "无（顶级位置）";
    const findName = (nodes: ILocationTreeNode[]): string | null => {
      for (const node of nodes) {
        if (node.id === form.parentId) return node.name ?? "";
        const found = findName(node.children);
        if (found) return found;
      }
      return null;
    };
    return findName(treeData) ?? "无（顶级位置）";
  })();

  /* ------------------------------------------------------------------ */
  /*  JSX 渲染                                                           */
  /* ------------------------------------------------------------------ */

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-gray-500 text-sm">加载位置信息...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* 页面标题 */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={handleGoBack}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="返回列表"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditMode ? "编辑位置" : "新增位置"}
        </h1>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 表单 */}
      <form onSubmit={handleSubmit} className="space-y-5">
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
            required
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
              bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:border-blue-500 transition-colors"
          />
        </div>

        {/* 位置编码 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            位置编码 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.locationCode}
            onChange={(e) => handleChange("locationCode", e.target.value)}
            placeholder="请输入位置编码（如 LOC-001）"
            required
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
              bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:border-blue-500 transition-colors font-mono"
          />
        </div>

        {/* 上级位置 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            上级位置
          </label>
          <select
            value={form.parentId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              handleChange("parentId", val === "" ? null : Number(val));
            }}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
              bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:border-blue-500 transition-colors"
          >
            <option value="">无（顶级位置）</option>
            {parentOptions.map((opt) => (
              <option key={opt.value ?? "root"} value={opt.value ?? ""}>
                {opt.label}
              </option>
            ))}
          </select>
          {form.parentId != null && (
            <p className="mt-1 text-xs text-gray-500">
              当前父位置：{selectedParentName}
            </p>
          )}
        </div>

        {/* 排序号 */}
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
              focus:border-blue-500 transition-colors resize-y"
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleGoBack}
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
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
              rounded-lg bg-blue-600 text-white hover:bg-blue-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                提交中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditMode ? "保存修改" : "创建位置"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
