import { useState } from "react";
import { ArrowLeft, Check, ChevronRight, FileText, Save, Send } from "lucide-react";
import { useNavigate } from "react-router";

const workflowSteps = [
  { id: 1, name: "申请人填写", status: "current" },
  { id: 2, name: "资产转入人确认", status: "pending" },
  { id: 3, name: "转入部门资产管理员审批", status: "pending" },
  { id: 4, name: "资产转出人确认", status: "pending" },
  { id: 5, name: "转出部门资产管理员审批", status: "pending" },
];

export function AssetTransferForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    applicant: "张三", // Mock default
    processId: "TRF-" + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + "001",
    applyDate: new Date().toISOString().split('T')[0],
    assetIds: "",
    assetName: "",
    missingAccessories: "",
    associatedCompany: "",
    transferor: "张三",
    transferDeptCode: "D001",
    transferDept: "研发部",
    transferLedger: "深圳总账",
    transferArea: "南山科技园",
    receiver: "",
    receiveDeptCode: "",
    receiveDept: "",
    receiveLedger: "",
    receiveArea: "",
    transferReason: "",
    transferType: "其他资产转移",
    receiveDeptAdmin: "",
    transferDeptAdmin: "李管理",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/disposals')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">新建资产转移申请</h2>
            <p className="text-gray-600 mt-1">请填写以下资产转移信息，并提交审批流程</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
            <Save className="w-4 h-4" />
            保存草稿
          </button>
          <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2">
            <Send className="w-4 h-4" />
            提交审批
          </button>
        </div>
      </div>

      {/* Workflow Progress */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 overflow-hidden mb-6">
        <h3 className="text-base font-medium text-gray-900 mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          审批流程
        </h3>
        <div className="overflow-x-auto pb-4 custom-scrollbar">
          <nav aria-label="Progress" className="min-w-max px-2">
            <ol role="list" className="flex items-center">
              {workflowSteps.map((step, stepIdx) => (
                <li key={step.name} className={`relative ${stepIdx !== workflowSteps.length - 1 ? 'pr-16 lg:pr-24' : ''}`}>
                  <div className="flex items-center group">
                    <span className="flex flex-col items-center gap-2">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-full border-2 shrink-0
                        ${step.status === 'complete' ? 'bg-blue-600 border-blue-600' : 
                          step.status === 'current' ? 'border-blue-600 text-blue-600 bg-blue-50' : 
                          'border-gray-300 text-gray-500 bg-white'}`}>
                        {step.status === 'complete' ? (
                          <Check className="w-5 h-5 text-white" aria-hidden="true" />
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
                    {stepIdx !== workflowSteps.length - 1 && (
                      <div className="absolute top-4 left-[50%] w-full h-0.5 ml-4 bg-gray-200" />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>

      {/* Form Details */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">基础信息</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">流程编号</label>
            <input type="text" disabled value={formData.processId} className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">申请人 <span className="text-red-500">*</span></label>
            <input type="text" name="applicant" value={formData.applicant} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">申请日期 <span className="text-red-500">*</span></label>
            <input type="date" name="applyDate" value={formData.applyDate} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
          </div>

          <div className="md:col-span-3 border-t border-gray-100 pt-6 mt-2">
            <h4 className="text-base font-medium text-gray-900 mb-4">资产信息</h4>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">资产编号 (可多选) <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <input type="text" name="assetIds" placeholder="点击选择资产或输入编号" value={formData.assetIds} onChange={handleChange} className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md transition-colors">选择资产</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">资产名称</label>
            <input type="text" name="assetName" value={formData.assetName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50" readOnly />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">所缺配件</label>
            <input type="text" name="missingAccessories" placeholder="如无缺失可不填" value={formData.missingAccessories} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">关联公司 (IC段)</label>
            <input type="text" name="associatedCompany" value={formData.associatedCompany} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
          </div>

          <div className="md:col-span-3 border-t border-gray-100 pt-6 mt-2">
            <h4 className="text-base font-medium text-gray-900 mb-4">转移明细</h4>
          </div>

          {/* Transferor details */}
          <div className="p-4 bg-gray-50 rounded-lg md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 border border-gray-100">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">转出人 <span className="text-red-500">*</span></label>
              <input type="text" name="transferor" value={formData.transferor} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">转出部门编码</label>
              <input type="text" name="transferDeptCode" value={formData.transferDeptCode} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100 text-gray-600" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">转出部门</label>
              <input type="text" name="transferDept" value={formData.transferDept} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100 text-gray-600" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">转出账套</label>
              <input type="text" name="transferLedger" value={formData.transferLedger} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">转出区域</label>
              <input type="text" name="transferArea" value={formData.transferArea} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">转出部门资产管理员</label>
              <input type="text" name="transferDeptAdmin" value={formData.transferDeptAdmin} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" />
            </div>
          </div>

          <div className="flex items-center justify-center md:col-span-3 py-2">
            <div className="p-2 bg-blue-50 rounded-full">
              <ArrowLeft className="w-5 h-5 text-blue-600 rotate-[-90deg]" />
            </div>
          </div>

          {/* Receiver details */}
          <div className="p-4 bg-blue-50/30 rounded-lg md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 border border-blue-100">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">转入人 <span className="text-red-500">*</span></label>
              <input type="text" name="receiver" placeholder="请选择或输入转入人" value={formData.receiver} onChange={handleChange} className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm bg-white focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">转入部门编码 <span className="text-red-500">*</span></label>
              <input type="text" name="receiveDeptCode" value={formData.receiveDeptCode} onChange={handleChange} className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm bg-white focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">转入部门 <span className="text-red-500">*</span></label>
              <input type="text" name="receiveDept" value={formData.receiveDept} onChange={handleChange} className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm bg-white focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">转入账套</label>
              <input type="text" name="receiveLedger" value={formData.receiveLedger} onChange={handleChange} className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm bg-white focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">转入区域</label>
              <input type="text" name="receiveArea" value={formData.receiveArea} onChange={handleChange} className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm bg-white focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">转入部门资产管理员 <span className="text-red-500">*</span></label>
              <input type="text" name="receiveDeptAdmin" placeholder="审批人自动带出/手动指定" value={formData.receiveDeptAdmin} onChange={handleChange} className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm bg-white focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>

          <div className="md:col-span-3 border-t border-gray-100 pt-6 mt-2">
            <h4 className="text-base font-medium text-gray-900 mb-4">转移原因</h4>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">转移类型 <span className="text-red-500">*</span></label>
            <select name="transferType" value={formData.transferType} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 bg-white">
              <option value="其他资产转移">其他资产转移</option>
              <option value="员工离职交接">员工离职交接</option>
              <option value="员工换岗交接">员工换岗交接</option>
            </select>
          </div>
          
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">转移原因说明 <span className="text-red-500">*</span></label>
            <textarea 
              name="transferReason" 
              rows={3} 
              value={formData.transferReason} 
              onChange={handleChange} 
              placeholder="请详细描述资产转移的原因..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

        </div>
      </div>
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
