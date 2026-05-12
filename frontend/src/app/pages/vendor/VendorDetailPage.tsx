/**
 * VendorDetailPage — 供应商详情页面
 *
 * 展示单个供应商的完整信息，包括基本信息和扩展字段。
 * 通过 URL 参数 :id 从后端 API 获取供应商数据。
 * 提供返回列表和编辑供应商的快捷操作。
 *
 * @module pages/vendor/VendorDetailPage
 * @since SWARM-058
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Pencil, Loader2, Mail, Phone, User, Hash } from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "../../services/vendorService";
import type { VendorRecord } from "../../services/vendorService";

/* ------------------------------------------------------------------ */
/*  页面组件                                                           */
/* ------------------------------------------------------------------ */

/**
 * VendorDetailPage — 供应商详情页面
 *
 * 通过 `useParams` 读取路由中的 `id`，调用 `getVendorById` 获取完整数据。
 * 页面展示供应商编码、名称、联系人、联系电话、联系邮箱等信息。
 * 提供返回列表和编辑跳转的快捷按钮。
 *
 * @returns React 组件
 *
 * @example
 * ```tsx
 * <Route path="/vendors/:id" element={<VendorDetailPage />} />
 * ```
 */
export default function VendorDetailPage() {
  /* ------------------------------------------------------------------ */
  /*  路由与导航                                                         */
  /* ------------------------------------------------------------------ */

  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  /* ------------------------------------------------------------------ */
  /*  状态管理                                                           */
  /* ------------------------------------------------------------------ */

  /** 供应商详情数据 */
  const [vendor, setVendor] = useState<VendorRecord | null>(null);

  /** 页面加载状态 */
  const [loading, setLoading] = useState(true);

  /** 错误信息 */
  const [error, setError] = useState<string | null>(null);

  /* ------------------------------------------------------------------ */
  /*  数据获取                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 通过 `getVendorById` 从后端获取供应商详情
   */
  useEffect(() => {
    if (!id) {
      setError("缺少供应商 ID");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadVendor() {
      setLoading(true);
      setError(null);
      try {
        const data = await vendorService.getVendorById(id);
        if (!cancelled) {
          setVendor(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "获取供应商详情失败";
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadVendor();

    return () => {
      cancelled = true;
    };
  }, [id]);

  /* ------------------------------------------------------------------ */
  /*  导航操作                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * 返回供应商列表页
   */
  const handleGoBack = useCallback(() => {
    navigate("/vendors");
  }, [navigate]);

  /**
   * 跳转至编辑供应商页面
   */
  const handleGoEdit = useCallback(() => {
    if (id) {
      navigate(`/vendors/${id}/edit`);
    }
  }, [navigate, id]);

  /* ------------------------------------------------------------------ */
  /*  JSX 渲染                                                           */
  /* ------------------------------------------------------------------ */

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-gray-500 text-sm">加载供应商详情...</p>
        </div>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={handleGoBack}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="返回列表"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">供应商详情</h1>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error || "供应商数据不存在"}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGoBack}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="返回列表"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">供应商详情</h1>
        </div>
        <button
          type="button"
          onClick={handleGoEdit}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm
            rounded-lg bg-blue-600 text-white hover:bg-blue-700
            transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Pencil className="w-4 h-4" />
          编辑
        </button>
      </div>

      {/* 详情卡片 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* 供应商名称 */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">
            {vendor.name || "未命名供应商"}
          </h2>
          {vendor.status !== undefined && (
            <span
              className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full ${
                vendor.status === 1
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {vendor.status === 1 ? "启用" : "禁用"}
            </span>
          )}
        </div>

        {/* 信息列表 */}
        <div className="divide-y divide-gray-100">
          {/* 供应商编码 */}
          <DetailRow
            icon={<Hash className="w-4 h-4 text-gray-400" />}
            label="供应商编码"
            value={vendor.vendorCode}
          />

          {/* 联系人 */}
          <DetailRow
            icon={<User className="w-4 h-4 text-gray-400" />}
            label="联系人"
            value={vendor.contactPerson}
          />

          {/* 联系电话 */}
          <DetailRow
            icon={<Phone className="w-4 h-4 text-gray-400" />}
            label="联系电话"
            value={vendor.contactPhone}
          />

          {/* 联系邮箱 */}
          <DetailRow
            icon={<Mail className="w-4 h-4 text-gray-400" />}
            label="联系邮箱"
            value={vendor.contactEmail}
          />

          {/* 地址 */}
          {vendor.address && (
            <DetailRow
              icon={<span className="w-4 h-4 text-gray-400 text-xs">📍</span>}
              label="地址"
              value={vendor.address}
            />
          )}

          {/* 创建时间 */}
          {vendor.createTime && (
            <DetailRow
              icon={<span className="w-4 h-4 text-gray-400 text-xs">🕐</span>}
              label="创建时间"
              value={vendor.createTime}
            />
          )}

          {/* 更新时间 */}
          {vendor.updateTime && (
            <DetailRow
              icon={<span className="w-4 h-4 text-gray-400 text-xs">🕐</span>}
              label="更新时间"
              value={vendor.updateTime}
            />
          )}
        </div>
      </div>

      {/* Contract Info 区块 — UI 骨架预留，硬编码空状态 */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-base font-semibold text-gray-900">Contract Info</h3>
        </div>
        <div className="px-6 py-8 text-center text-gray-400 text-sm" data-testid="contract-empty-state">
          暂无合同数据
        </div>
      </div>

      {/* Audit History 区块 — UI 骨架预留，硬编码空状态 */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-base font-semibold text-gray-900">Audit History</h3>
        </div>
        <div className="px-6 py-8 text-center text-gray-400 text-sm" data-testid="audit-empty-state">
          暂无审计记录
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  辅助组件                                                           */
/* ------------------------------------------------------------------ */

/**
 * DetailRow — 详情行展示组件
 *
 * 用于在详情页面中展示单行键值对信息。
 *
 * @param props.icon - 左侧图标
 * @param props.label - 字段标签
 * @param props.value - 字段值
 * @returns React 组件
 */
function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-center px-6 py-3">
      <div className="flex items-center gap-2 w-32 shrink-0">
        {icon}
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <span className="text-sm text-gray-900">{value || "-"}</span>
    </div>
  );
}
