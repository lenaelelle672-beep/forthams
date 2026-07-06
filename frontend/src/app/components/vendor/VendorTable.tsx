/**
 * @module frontend/src/app/components/vendor/VendorTable
 * @description Vendor data table component for displaying and managing vendor records.
 *
 * Renders a table with columns: 名称, 编码, 联系人, 电话, 邮箱, 操作.
 * Edit and Delete action buttons are provided per row with data-testid attributes.
 *
 * @since SWARM-046
 */

import React from "react";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import type { Vendor } from "../../services/vendorApi";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * VendorTable component props
 *
 * @param vendors - array of vendor records to display
 * @param loading - whether data is currently being loaded
 * @param onEdit - callback when edit button is clicked for a vendor
 * @param onDelete - callback when delete button is clicked for a vendor
 * @param deletingId - vendor ID currently being deleted (shows spinner)
 */
interface VendorTableProps {
  /** 供应商列表数据 */
  vendors: Vendor[];
  /** 是否加载中 */
  loading: boolean;
  /** 编辑回调 */
  onEdit: (vendor: Vendor) => void;
  /** 删除回调 */
  onDelete: (id: number) => void;
  /** 正在删除的供应商 ID */
  deletingId: number | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * VendorTable — renders vendor data in a table with edit/delete actions.
 *
 * Table columns: 名称, 编码, 联系人, 电话, 邮箱, 操作.
 * Each row has data-testid="btn-edit-vendor" and data-testid="btn-delete-vendor"
 * action buttons aligned with E2E test requirements (ATB-02, ATB-03, ATB-05).
 *
 * @param props - VendorTableProps
 * @returns React component
 */
export default function VendorTable({
  vendors,
  loading,
  onEdit,
  onDelete,
  deletingId,
}: VendorTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-[#1e3a5f]">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              供应商名称
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              编码
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              联系人
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              电话
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              邮箱
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-[#1e3a5f]">
          {loading ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-12 text-center text-gray-400"
              >
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                加载中...
              </td>
            </tr>
          ) : vendors.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-12 text-center text-gray-400"
              >
                暂无供应商数据
              </td>
            </tr>
          ) : (
            vendors.map((vendor) => (
              <tr
                key={vendor.id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3 text-sm text-gray-900">
                  {vendor.name || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                  {vendor.vendorCode || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {vendor.contactPerson || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {vendor.contactPhone || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {vendor.contactEmail || "-"}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="btn-edit-vendor"
                      onClick={() => onEdit(vendor)}
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
                      data-testid="btn-delete-vendor"
                      onClick={() => onDelete(vendor.id!)}
                      disabled={deletingId === vendor.id}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs
                        rounded border border-red-300 bg-white text-red-600
                        hover:bg-red-50 disabled:opacity-50
                        disabled:cursor-not-allowed transition-colors"
                      title="删除"
                    >
                      {deletingId === vendor.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
