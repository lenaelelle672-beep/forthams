import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { disposalService } from "../services/disposalService";

const steps = [
  { id: 1, name: "申请人填写", status: "current" },
  { id: 2, name: "清退部门及资产管理员审批", status: "upcoming" },
  { id: 3, name: "清退部门主管审批", status: "upcoming" },
  { id: 4, name: "回收库房管理员确认实物", status: "upcoming" },
  { id: 5, name: "IT判断人员审核", status: "upcoming" },
];

const idleAssetTypes = [
  "便携机",
  "机器设备",
  "其他办公设备（打印机、扫描仪、会议终端、云终端等）",
  "其他专用设备（工装夹具、模具、测试设备等）",
  "台式机"
];

const clearanceReasons = [
  "闲置公用便携机已使用满5年，无需发布闲置公告",
  "闲置台式机已使用满6年，无需发布闲置公告",
  "闲置资产性能不佳，尚有利用价值，集中清退库房后期利用（一般为IT建议）",
  "资产状态良好，已发布闲置公告满三个月"
];

export function AssetClearanceForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    applicant: "张三",
    processId: "CL-" + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + String(new Date().getDate()).padStart(2, '0') + "-001",
    applyDate: new Date().toISOString().split("T")[0],
    assetId: "",
    assetName: "",
    missingAccessories: "无",
    attachedItems: "电源适配器、鼠标",
    user: "张三",
    firstUsageDate: "",
    deptCode: "DEPT-RD-01",
    department: "研发部",
    directManager: "李四",
    level1Admin: "王五",
    idleAssetType: "",
    clearanceReason: "",
    storageLocation: "",
    assetLedger: "深圳总部账套"
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await disposalService.clearance(formData);
      navigate("/disposals");
    } catch (err) {
      console.error('Failed to submit clearance:', err);
      setError('提交资产清退失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">资产清退申请</h2>
          <p className="text-sm text-gray-500 mt-1">请填写资产清退信息，提交后将进入对应审批流程</p>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 overflow-hidden">
        <div className="overflow-x-auto pb-4 custom-scrollbar">
          <nav aria-label="Progress" className="min-w-max px-2">
            <ol role="list" className="flex items-center">
              {steps.map((step, stepIdx) => (
                <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-16 lg:pr-24' : ''}`}>
                  <div className="flex items-center group">
                    <span className="flex flex-col items-center gap-2">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-full border-2 shrink-0
                        ${step.status === 'complete' ? 'bg-blue-600 border-blue-600' : 
                          step.status === 'current' ? 'border-blue-600 text-blue-600 bg-blue-50' : 
                          'border-gray-300 text-gray-500 bg-white'}`}>
                        {step.status === 'complete' ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : (
                          <span className="text-sm font-medium">{step.id}</span>
                        )}
                      </span>
                      <span className={`text-xs font-medium whitespace-nowrap
                        ${step.status === 'current' ? 'text-blue-600' : 
                          step.status === 'complete' ? 'text-gray-900' : 'text-gray-500'}`}>
                        {step.name}
                      </span>
                    </span>
                    {stepIdx !== steps.length - 1 && (
                      <div className="absolute top-4 left-[50%] w-full h-0.5 ml-4 bg-gray-200" />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="text-sm text-red-600">{error}</div>}
        {/* Section 1: 基础申请信息 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">基础申请信息</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">流程编号</label>
              <input 
                type="text" 
                name="processId"
                value={formData.processId}
                disabled
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">申请人</label>
              <input 
                type="text" 
                name="applicant"
                value={formData.applicant}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">申请日期</label>
              <input 
                type="date" 
                name="applyDate"
                value={formData.applyDate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: 资产明细 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">清退资产明细</h3>
            <button type="button" className="text-sm text-blue-600 hover:text-blue-800 font-medium">从台账选择资产</button>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产编号 <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="assetId"
                required
                placeholder="例如: AS-2024-001"
                value={formData.assetId}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产名称 <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="assetName"
                required
                placeholder="例如: ThinkPad X1 Carbon"
                value={formData.assetName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产账套</label>
              <input 
                type="text" 
                name="assetLedger"
                value={formData.assetLedger}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">首次领用日期</label>
              <input 
                type="date" 
                name="firstUsageDate"
                value={formData.firstUsageDate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">附属物品</label>
              <input 
                type="text" 
                name="attachedItems"
                placeholder="电源适配器、说明书等"
                value={formData.attachedItems}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">所缺配件</label>
              <input 
                type="text" 
                name="missingAccessories"
                placeholder="如无所缺配件，请填无"
                value={formData.missingAccessories}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: 归属与人员信息 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">使用与管理人员</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">使用人</label>
              <input 
                type="text" 
                name="user"
                value={formData.user}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">使用部门</label>
              <input 
                type="text" 
                name="department"
                value={formData.department}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">使用部门编码</label>
              <input 
                type="text" 
                name="deptCode"
                value={formData.deptCode}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">直接主管</label>
              <input 
                type="text" 
                name="directManager"
                value={formData.directManager}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">一级资产管理员</label>
              <input 
                type="text" 
                name="level1Admin"
                value={formData.level1Admin}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 4: 清退原因及信息 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">清退信息</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">闲置资产类型 <span className="text-red-500">*</span></label>
                <select 
                  name="idleAssetType"
                  required
                  value={formData.idleAssetType}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="" disabled>请选择闲置资产类型</option>
                  {idleAssetTypes.map((type, idx) => (
                    <option key={idx} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">清退原因 <span className="text-red-500">*</span></label>
                <select 
                  name="clearanceReason"
                  required
                  value={formData.clearanceReason}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="" disabled>请选择清退原因</option>
                  {clearanceReasons.map((reason, idx) => (
                    <option key={idx} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">存放地点 <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="storageLocation"
                required
                placeholder="请详细描述待清退资产当前的存放位置"
                value={formData.storageLocation}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">提交流程须知</p>
                <ul className="list-disc pl-4 space-y-1 text-blue-700/80">
                  <li>提交申请后，将依次流转至直接主管、一级资产管理员审批。</li>
                  <li>请确保资产的附属物品和实物配件信息填写准确，后续库房管理员将进行实物比对。</li>
                  <li>如未找到完全匹配的清退原因，请选择最接近的一项。</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 sticky bottom-6 bg-white p-4 rounded-xl shadow-lg border border-gray-200">
          <button 
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            取消申请
          </button>
          <button 
            type="button"
            className="px-6 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors"
          >
            保存草稿
          </button>
          <button 
            type="submit"
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
          >
            {loading ? '提交中...' : '提交审批'}
          </button>
        </div>
      </form>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
