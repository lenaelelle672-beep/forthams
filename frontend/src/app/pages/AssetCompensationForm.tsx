import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2, Search, Paperclip } from "lucide-react";
import { compensationService } from "../services/compensationService";

const steps = [
  { id: 1, name: "填写资产信息", status: "current" },
  { id: 2, name: "部门直接主管意见", status: "upcoming" },
  { id: 3, name: "资产原值", status: "upcoming" },
  { id: 4, name: "一级资产管理部门意见", status: "upcoming" },
  { id: 5, name: "资产管理处审批", status: "upcoming" },
  { id: 6, name: "信息安全审批", status: "upcoming" },
  { id: 7, name: "财务总监审批", status: "upcoming" },
  { id: 8, name: "库房接收资产", status: "upcoming" },
];

export function AssetCompensationForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const now = new Date();
  const defaultDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

  const [formData, setFormData] = useState({
    // Header Info
    operatorId: "chenchaojie 03361/uniview",
    applyDate: defaultDate,
    attachmentCount: "0",
    
    // Asset & Loss Info
    assetId: "",
    assetName: "",
    modelSpec: "",
    attachedItems: "",
    deptName: "",
    deptCode: "",
    userEmpId: "",
    startTime: "",
    productCode: "",
    userName: "",
    userPhone: "",
    lossLocation: "",
    responsibleId: "",
    responsibleName: "",
    lossDescription: "",
    lossDate: "",
    operatorName: "",
    operatorPhone: "",
    
    // Security Info
    needSecDeclaration: "是",
    hasBootPwd: "无",
    hasHddPwd: "无",
    secretFileList: "无",
    
    // Approval Config
    deptAssetAdminId: "",
    deptManagerId: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleRadioChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await compensationService.create(formData);
      navigate("/disposals");
    } catch (err) {
      console.error('Failed to submit compensation:', err);
      setError('提交资产赔偿失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">资产赔偿电子流</h2>
          <p className="text-sm text-gray-500 mt-1">当前状态：草稿 &nbsp;|&nbsp; 经办人：{formData.operatorId}</p>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 overflow-hidden">
        <div className="overflow-x-auto pb-4 custom-scrollbar">
          <nav aria-label="Progress" className="min-w-max px-2">
            <ol role="list" className="flex items-center">
              {steps.map((step, stepIdx) => (
                <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-12' : ''}`}>
                  <div className="flex items-center group">
                    <span className="flex flex-col items-center gap-2">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-full border-2 shrink-0
                        ${step.status === 'complete' ? 'bg-yellow-500 border-yellow-500' : 
                          step.status === 'current' ? 'border-yellow-500 text-yellow-600 bg-yellow-50' : 
                          'border-gray-300 text-gray-500 bg-white'}`}>
                        {step.status === 'complete' ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : (
                          <span className="text-sm font-medium">{step.id}</span>
                        )}
                      </span>
                      <span className={`text-xs font-medium whitespace-nowrap
                        ${step.status === 'current' ? 'text-yellow-600' : 
                          step.status === 'complete' ? 'text-gray-900' : 'text-gray-500'}`}>
                        {step.name}
                      </span>
                    </span>
                    {stepIdx !== steps.length - 1 && (
                      <div className={`absolute top-4 left-[50%] w-full h-0.5 ml-4 bg-gray-200`} />
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
        
        {/* Section 1: 经办人与表单基础 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50/80 border-b border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium w-24">经办人ID:</span>
              <span className="text-blue-600 font-medium">{formData.operatorId}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium w-24">填表日期:</span>
              <span className="text-blue-600 font-medium">{formData.applyDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium w-24">附件张数:</span>
              <div className="flex items-center gap-1">
                <input 
                  type="text" 
                  name="attachmentCount"
                  value={formData.attachmentCount}
                  onChange={handleChange}
                  className="w-16 px-2 py-1 text-center border border-gray-300 rounded text-blue-600 focus:ring-1 focus:ring-yellow-500"
                />
                <span className="text-gray-500">张</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: 资产信息 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50/30">
            <h3 className="text-lg font-semibold text-yellow-800 text-center">资产信息</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产编号 <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input type="text" name="assetId" required value={formData.assetId} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500" />
                <button type="button" className="shrink-0 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-gray-600">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产名称</label>
              <input type="text" name="assetName" value={formData.assetName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 bg-gray-50" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">规格型号</label>
              <input type="text" name="modelSpec" value={formData.modelSpec} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 bg-gray-50" readOnly />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">附属物品</label>
              <input type="text" name="attachedItems" value={formData.attachedItems} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 bg-gray-50" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">所在部门</label>
              <input type="text" name="deptName" value={formData.deptName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 bg-gray-50" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">所在部门编码</label>
              <input type="text" name="deptCode" value={formData.deptCode} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 bg-gray-50" readOnly />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">使用人工号</label>
              <input type="text" name="userEmpId" value={formData.userEmpId} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 bg-gray-50" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">启用时间</label>
              <input type="date" name="startTime" value={formData.startTime} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 bg-gray-50" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">产品编码</label>
              <input type="text" name="productCode" value={formData.productCode} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 bg-gray-50" readOnly />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">使用人姓名</label>
              <input type="text" name="userName" value={formData.userName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 bg-gray-50" readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">使用人联系电话(长号) <span className="text-red-500">*</span></label>
              <input type="text" name="userPhone" required value={formData.userPhone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产丢失的具体场所 <span className="text-red-500">*</span></label>
              <input type="text" name="lossLocation" required value={formData.lossLocation} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500" />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">资产赔偿责任人ID <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input type="text" name="responsibleId" required value={formData.responsibleId} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500" />
                <button type="button" className="shrink-0 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-gray-600">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产赔偿责任人姓名 <span className="text-red-500">*</span></label>
              <input type="text" name="responsibleName" required value={formData.responsibleName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500" />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">损失情况说明 <span className="text-red-500">*</span></label>
              <textarea name="lossDescription" rows={2} required value={formData.lossDescription} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 resize-none"></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">损失日期 (YYYY-MM-DD) <span className="text-red-500">*</span></label>
              <input type="date" name="lossDate" required value={formData.lossDate} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 text-red-600" />
            </div>

            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">经办人姓名 <span className="text-red-500">*</span></label>
              <input type="text" name="operatorName" required value={formData.operatorName} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500" />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">经办人联系电话(长号) <span className="text-red-500">*</span></label>
              <input type="text" name="operatorPhone" required value={formData.operatorPhone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500" />
            </div>
          </div>
        </div>

        {/* Section 3: 安全信息 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50/30">
            <h3 className="text-lg font-semibold text-yellow-800 text-center">安全信息</h3>
          </div>
          <div className="p-6 grid grid-cols-1 gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-4">
              <div className="mb-2 md:mb-0">
                <span className="text-sm font-medium text-gray-700">是否需要信息安全申报 <span className="text-red-500">*</span></span>
                <span className="ml-2 text-xs text-red-500">(便携机和台式机必须申报)</span>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="needSecDeclaration" value="是" checked={formData.needSecDeclaration === "是"} onChange={() => handleRadioChange("needSecDeclaration", "是")} className="text-yellow-600 focus:ring-yellow-500" /> 
                  <span className="text-sm">是</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="needSecDeclaration" value="否" checked={formData.needSecDeclaration === "否"} onChange={() => handleRadioChange("needSecDeclaration", "否")} className="text-yellow-600 focus:ring-yellow-500" /> 
                  <span className="text-sm">否</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-4">
              <span className="text-sm font-medium text-gray-700 mb-2 md:mb-0">是否有开机密码 <span className="text-red-500">*</span></span>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="hasBootPwd" value="有" checked={formData.hasBootPwd === "有"} onChange={() => handleRadioChange("hasBootPwd", "有")} className="text-yellow-600 focus:ring-yellow-500" /> 
                  <span className="text-sm text-purple-700">有</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="hasBootPwd" value="无" checked={formData.hasBootPwd === "无"} onChange={() => handleRadioChange("hasBootPwd", "无")} className="text-yellow-600 focus:ring-yellow-500" /> 
                  <span className="text-sm text-purple-700">无</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-4">
              <span className="text-sm font-medium text-gray-700 mb-2 md:mb-0">是否有硬盘密码 <span className="text-red-500">*</span></span>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="hasHddPwd" value="有" checked={formData.hasHddPwd === "有"} onChange={() => handleRadioChange("hasHddPwd", "有")} className="text-yellow-600 focus:ring-yellow-500" /> 
                  <span className="text-sm text-purple-700">有</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="hasHddPwd" value="无" checked={formData.hasHddPwd === "无"} onChange={() => handleRadioChange("hasHddPwd", "无")} className="text-yellow-600 focus:ring-yellow-500" /> 
                  <span className="text-sm text-purple-700">无</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">秘密级以上文件清单 <span className="text-red-500">*</span></label>
              <textarea 
                name="secretFileList" 
                rows={2} 
                required 
                value={formData.secretFileList} 
                onChange={handleChange} 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 resize-none"
                placeholder="(可以附件。若无清单，请填写“无”)"
              ></textarea>
            </div>
          </div>
        </div>

        {/* Section 4: 底部配置与附件 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">附加文件</label>
              <button type="button" className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 flex items-center gap-2 transition-colors">
                <Paperclip className="w-4 h-4" /> 上传附件
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">部门资产管理员ID</label>
              <div className="flex gap-2">
                <input type="text" name="deptAssetAdminId" value={formData.deptAssetAdminId} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500" />
                <button type="button" className="shrink-0 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-gray-600">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">部门直接主管ID</label>
              <div className="flex gap-2">
                <input type="text" name="deptManagerId" value={formData.deptManagerId} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500" />
                <button type="button" className="shrink-0 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-gray-600">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 sticky bottom-6 bg-white p-4 rounded-xl shadow-lg border border-gray-200 z-10">
          <button 
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            取消申请
          </button>
          <button 
            type="button"
            className="px-6 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 rounded-lg transition-colors"
          >
            保存草稿
          </button>
          <button 
            type="submit"
            className="px-6 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors shadow-sm"
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
