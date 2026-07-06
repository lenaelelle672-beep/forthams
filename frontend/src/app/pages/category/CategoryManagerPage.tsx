/**
 * CategoryManagerPage — 资产分类管理页面
 *
 * 提供资产分类的 CRUD 管理功能：
 * - 分页列表展示（树形缩进）
 * - 根据关键字搜索分类
 * - 新增/编辑分类弹窗（支持选择父级分类）
 * - 删除分类确认
 * - 对接后端 AssetCategoryController 全部 7 个端点
 *
 * @module pages/category/CategoryManagerPage
 */

import React, { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  X,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  categoryService,
  type AssetCategoryEntity,
  type CategoryTreeNode,
  type CategoryFormData,
} from "../../services/categoryService";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 20;

/* ------------------------------------------------------------------ */
/*  页面组件                                                           */
/* ------------------------------------------------------------------ */

export default function CategoryManagerPage() {
  const queryClient = useQueryClient();

  /* ---- 列表相关状态 ---- */
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  /* ---- 弹窗相关状态 ---- */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AssetCategoryEntity | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  /* ------------------------------------------------------------------ */
  /*  Data fetching with @tanstack/react-query                          */
  /* ------------------------------------------------------------------ */

  /** 获取分页列表 */
  const {
    data: pageData,
    isLoading: listLoading,
    isError: listError,
    refetch: refetchList,
  } = useQuery({
    queryKey: ["categories", "list", page, keyword],
    queryFn: () => categoryService.list({ page, pageSize: PAGE_SIZE, keyword: keyword || undefined }),
  });

  /** 获取树形数据（用于父级选择器） */
  const { data: treeData } = useQuery({
    queryKey: ["categories", "tree"],
    queryFn: () => categoryService.getTree(),
    staleTime: 1000 * 60 * 5,
  });

  /** 获取全量数据（用于无分页操作） */
  const { data: allCategories } = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => categoryService.getAll(),
    staleTime: 1000 * 60 * 5,
  });

  const records = pageData?.records ?? [];
  const total = pageData?.total ?? 0;
  const totalPages = pageData?.pages ?? 1;

  /* ------------------------------------------------------------------ */
  /*  Mutations                                                          */
  /* ------------------------------------------------------------------ */

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (data: CategoryFormData) => categoryService.create(data),
    onSuccess: () => {
      toast.success("分类创建成功");
      setModalOpen(false);
      invalidateQueries();
    },
    onError: (err: Error) => {
      toast.error(err.message || "创建失败");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CategoryFormData> }) =>
      categoryService.update(id, data),
    onSuccess: () => {
      toast.success("分类更新成功");
      setModalOpen(false);
      invalidateQueries();
    },
    onError: (err: Error) => {
      toast.error(err.message || "更新失败");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoryService.delete(id),
    onSuccess: () => {
      toast.success("分类删除成功");
      setDeleteConfirmId(null);
      invalidateQueries();
    },
    onError: (err: Error) => {
      toast.error(err.message || "删除失败，该分类下可能有关联资产");
    },
  });

  /* ------------------------------------------------------------------ */
  /*  Handlers                                                           */
  /* ------------------------------------------------------------------ */

  /** 搜索防抖（300ms） */
  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    const timer = setTimeout(() => {
      setKeyword(value);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  /** 打开新增弹窗 */
  const handleOpenCreate = useCallback(() => {
    setEditingCategory(null);
    setModalOpen(true);
  }, []);

  /** 打开编辑弹窗 */
  const handleOpenEdit = useCallback((category: AssetCategoryEntity) => {
    setEditingCategory(category);
    setModalOpen(true);
  }, []);

  /** 关闭弹窗 */
  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingCategory(null);
  }, []);

  /** 确认删除 */
  const handleConfirmDelete = useCallback((id: number) => {
    setDeleteConfirmId(id);
  }, []);

  /** 执行删除 */
  const handleDelete = useCallback(() => {
    if (deleteConfirmId !== null) {
      deleteMutation.mutate(deleteConfirmId);
    }
  }, [deleteConfirmId, deleteMutation]);

  /** 取消删除 */
  const handleCancelDelete = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  /** 提交表单 */
  const handleFormSubmit = useCallback(
    (formData: CategoryFormData) => {
      if (editingCategory) {
        updateMutation.mutate({ id: editingCategory.id, data: formData });
      } else {
        createMutation.mutate(formData);
      }
    },
    [editingCategory, createMutation, updateMutation],
  );

  /* ------------------------------------------------------------------ */
  /*  辅助函数                                                           */
  /* ------------------------------------------------------------------ */

  /** 计算分类名称的缩进级别 */
  const getIndentLevel = (category: AssetCategoryEntity): number => {
    if (!allCategories) return 0;
    let level = 0;
    let current = category.parentId;
    const catMap = new Map(allCategories.map((c) => [c.id, c]));
    while (current) {
      level++;
      const parent = catMap.get(current);
      current = parent?.parentId ?? null;
    }
    return level;
  };

  /** 将树形数据扁平化为选择器选项 */
  const flattenTree = (nodes: CategoryTreeNode[], depth = 0): { id: number; name: string; depth: number }[] => {
    const result: { id: number; name: string; depth: number }[] = [];
    for (const node of nodes) {
      if (!editingCategory || node.id !== editingCategory.id) {
        result.push({ id: node.id, name: node.categoryName, depth });
      }
      if (node.children?.length) {
        result.push(...flattenTree(node.children, depth + 1));
      }
    }
    return result;
  };

  const parentOptions = useMemo(
    () => (treeData ? flattenTree(treeData) : []),
    [treeData, editingCategory],
  );

  /** 表格行操作按钮 */
  const ActionButtons = ({ category }: { category: AssetCategoryEntity }) => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => handleOpenEdit(category)}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs
          rounded border border-gray-200 bg-white text-gray-700
          hover:bg-gray-50 transition-colors"
        title="编辑"
      >
        <Pencil className="w-3.5 h-3.5" />
        编辑
      </button>
      <button
        type="button"
        onClick={() => handleConfirmDelete(category.id)}
        disabled={deleteMutation.isPending}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs
          rounded border border-red-300 bg-white text-red-600
          hover:bg-red-50 disabled:opacity-50 transition-colors"
        title="删除"
      >
        <Trash2 className="w-3.5 h-3.5" />
        删除
      </button>
    </div>
  );

  /* ------------------------------------------------------------------ */
  /*  Render: Main                                                      */
  /* ------------------------------------------------------------------ */

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">资产分类管理</h1>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
            rounded-lg bg-blue-600 text-white hover:bg-blue-700
            transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Plus className="w-4 h-4" />
          新增分类
        </button>
      </div>

      {/* 搜索和刷新 */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索分类名称或编码..."
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200
              bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:border-blue-500 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={() => refetchList()}
          disabled={listLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm
            rounded-lg border border-gray-200 bg-white text-gray-700
            hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${listLoading ? "animate-spin" : ""}`} />
          刷新
        </button>
      </div>

      {/* 错误状态 */}
      {listError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          加载分类列表失败，请刷新重试
        </div>
      )}

      {/* 表格 */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                分类名称
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                分类编码
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                排序
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                描述
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {listLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  加载中...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                  {keyword ? "未找到匹配的分类" : "暂无分类数据"}
                </td>
              </tr>
            ) : (
              records.map((category) => {
                const indent = getIndentLevel(category);
                return (
                  <tr key={category.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <span style={{ marginLeft: `${indent * 1.5}rem` }}>
                        {indent > 0 && (
                          <span className="text-gray-400 mr-1">└</span>
                        )}
                        {category.categoryName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                      {category.categoryCode || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {category.sortOrder ?? 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                      {category.description || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <ActionButtons category={category} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {total > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            共 {total} 条记录
            {keyword && ` (搜索: "${keyword}")`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200
                bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50
                disabled:cursor-not-allowed transition-colors"
            >
              上一页
            </button>
            <span className="text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200
                bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50
                disabled:cursor-not-allowed transition-colors"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 新增/编辑弹窗                                                  */}
      {/* ============================================================ */}
      {modalOpen && (
        <CategoryFormModal
          category={editingCategory}
          parentOptions={parentOptions}
          submitting={isMutating}
          onClose={handleCloseModal}
          onSubmit={handleFormSubmit}
        />
      )}

      {/* ============================================================ */}
      {/* 删除确认弹窗                                                    */}
      {/* ============================================================ */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={handleCancelDelete} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              确认删除
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              确定要删除该分类吗？如果分类下存在资产，删除可能失败。
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200
                  bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white
                  hover:bg-red-700 disabled:opacity-50 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {deleteMutation.isPending ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  CategoryFormModal — 新增/编辑分类弹窗                                */
/* ================================================================== */

interface CategoryFormModalProps {
  category: AssetCategoryEntity | null;
  parentOptions: { id: number; name: string; depth: number }[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: CategoryFormData) => void;
}

function CategoryFormModal({
  category,
  parentOptions,
  submitting,
  onClose,
  onSubmit,
}: CategoryFormModalProps) {
  const isEditMode = category != null;

  /* ---- 表单状态 ---- */
  const [categoryName, setCategoryName] = useState(category?.categoryName ?? "");
  const [categoryCode, setCategoryCode] = useState(category?.categoryCode ?? "");
  const [parentId, setParentId] = useState<number | null>(category?.parentId ?? null);
  const [sortOrder, setSortOrder] = useState(category?.sortOrder ?? 0);
  const [description, setDescription] = useState(category?.description ?? "");

  /* ---- 字段校验 ---- */
  const [nameError, setNameError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const validate = useCallback((): boolean => {
    let valid = true;

    if (!categoryName.trim()) {
      setNameError("分类名称不能为空");
      valid = false;
    } else if (categoryName.trim().length > 100) {
      setNameError("分类名称不能超过100字");
      valid = false;
    } else {
      setNameError(null);
    }

    if (!categoryCode.trim()) {
      setCodeError("分类编码不能为空");
      valid = false;
    } else if (categoryCode.trim().length > 50) {
      setCodeError("分类编码不能超过50字");
      valid = false;
    } else {
      setCodeError(null);
    }

    return valid;
  }, [categoryName, categoryCode]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      onSubmit({
        categoryName: categoryName.trim(),
        categoryCode: categoryCode.trim(),
        parentId: parentId || null,
        sortOrder,
        description: description.trim(),
      });
    },
    [categoryName, categoryCode, parentId, sortOrder, description, validate, onSubmit],
  );

  const inputClass = (hasError: boolean) =>
    `w-full px-3 py-2 text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 transition-colors ${
      hasError
        ? "border-red-300 focus:ring-red-500"
        : "border-gray-200 focus:ring-blue-500 focus:border-blue-500"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditMode ? "编辑分类" : "新增分类"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 分类名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              分类名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => { setCategoryName(e.target.value); setNameError(null); }}
              placeholder="请输入分类名称"
              className={inputClass(!!nameError)}
            />
            {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
          </div>

          {/* 分类编码 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              分类编码 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={categoryCode}
              onChange={(e) => { setCategoryCode(e.target.value); setCodeError(null); }}
              placeholder="请输入分类编码（唯一）"
              className={inputClass(!!codeError)}
            />
            {codeError && <p className="mt-1 text-xs text-red-500">{codeError}</p>}
          </div>

          {/* 父级分类 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              父级分类
            </label>
            <select
              value={parentId ?? ""}
              onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200
                bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                focus:border-blue-500 transition-colors"
            >
              <option value="">（顶级分类）</option>
              {parentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {"　".repeat(opt.depth)}{opt.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              选择父级分类后，当前分类将成为子分类
            </p>
          </div>

          {/* 排序号 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              排序号
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              placeholder="排序号（越小越靠前）"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="分类说明..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200
                bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200
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
                  {isEditMode ? "保存修改" : "创建分类"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
