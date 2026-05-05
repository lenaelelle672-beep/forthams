import { X, MapPin, User, Calendar, DollarSign, Package, FileText, History } from "lucide-react";
import { getAssetStatusMeta } from "../constants/assetStatus";

interface AssetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset?: {
    id: string;
    name: string;
    category: string;
    department: string;
    user: string;
    location: string;
    status: string;
    value: string;
    purchaseDate: string;
  };
}

export function AssetDetailModal({ isOpen, onClose, asset }: AssetDetailModalProps) {
  if (!isOpen || !asset) return null;
  const statusMeta = getAssetStatusMeta(asset.status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">{asset.name}</h3>
            <p className="text-sm text-gray-600 mt-1">资产编号: {asset.id}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6">
          {/* 基本信息 */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              固定资产明细
            </h4>
            <div className="overflow-hidden rounded-sm">
              <table className="w-full border-collapse border border-gray-300 text-sm text-left">
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">资产编号: </span> 
                      <span className="text-gray-900 ml-1">{asset.id}</span>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">资产名称: </span> 
                      <span className="text-gray-900 ml-1">{asset.name}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">使用保管人: </span> 
                      <span className="text-gray-900 ml-1">{asset.user}</span>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">使用人工号: </span> 
                      <span className="text-gray-900 ml-1">03361</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">使用部门: </span> 
                      <span className="text-gray-900 ml-1">{asset.department}</span>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">部门编码: </span> 
                      <span className="text-gray-900 ml-1">D0010</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">首次领用日期: </span> 
                      <span className="text-gray-900 ml-1">{asset.purchaseDate || "2024/01/22"}</span>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">附属物品: </span> 
                      <span className="text-gray-900 ml-1">电源适配器</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">外贸合同号: </span> 
                      <span className="text-gray-900 ml-1">-</span>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">监管期限: </span> 
                      <span className="text-gray-900 ml-1">-</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">关联公司: </span> 
                      <span className="text-gray-900 ml-1">UNIVIEW</span>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">PO号: </span> 
                      <span className="text-gray-900 ml-1">PO20240101</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">帐套: </span> 
                      <span className="text-gray-900 ml-1">深圳总账</span>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">最新转移时间: </span> 
                      <span className="text-gray-900 ml-1">2024/01/22</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">资产序列号: </span> 
                      <span className="text-gray-900 ml-1">7J1L33</span>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 w-1/2 bg-white">
                      <span className="text-gray-600 font-medium">区域: </span> 
                      <span className="text-gray-900 ml-1">NA</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 状态信息 */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">当前状态</h4>
            <div className="flex items-center gap-4">
              <span className={`px-4 py-2 text-sm font-medium rounded-full ${statusMeta.badgeClass}`}>
                {statusMeta.label}
              </span>
              <span className="text-sm text-gray-600">最后更新: 2024-03-08 14:30</span>
            </div>
          </div>

          {/* 变更历史 */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <History className="w-5 h-5" />
              变更历史
            </h4>
            <div className="space-y-3">
              <div className="flex gap-4 pb-3 border-b border-gray-200 last:border-0">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">资产转移</p>
                    <span className="text-sm text-gray-500">2024-03-01</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">从研发部转移至设计部 | 操作人: 张三</p>
                </div>
              </div>
              <div className="flex gap-4 pb-3 border-b border-gray-200 last:border-0">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">资产入库</p>
                    <span className="text-sm text-gray-500">{asset.purchaseDate}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">资产采购入库 | 操作人: 李四</p>
                </div>
              </div>
            </div>
          </div>

          {/* 附件信息 */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">附件文档</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">采购合同.pdf</p>
                    <p className="text-xs text-gray-500">2.3 MB</p>
                  </div>
                </div>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  下载
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">资产照片.jpg</p>
                    <p className="text-xs text-gray-500">1.8 MB</p>
                  </div>
                </div>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  下载
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            关闭
          </button>
          <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            编辑资产
          </button>
          <button className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
            转移资产
          </button>
        </div>
      </div>
    </div>
  );
}
