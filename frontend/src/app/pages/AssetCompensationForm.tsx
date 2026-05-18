import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2, Search, Paperclip, Settings } from "lucide-react";
import { toast } from "sonner";
import { approvalService } from "../services/approvalService";
import { assetService, type AssetRecord } from "../services/assetService";

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

function parseRequiredId(value: string, label: string): number {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label}必须填写正整数 ID`);
  }
  return parsed;
}

function parseOptionalId(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function AssetCompensationForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetSearchKeyword, setAssetSearchKeyword] = useState('');
  const [assetSearchResults, setAssetSearchResults] = useState<AssetRecord[]>([]);
  const [assetSearchLoading, setAssetSearchLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  const now = new Date();
  const defaultDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

  const [formData, setFormData] = useState({
    // Header Info
    operatorId: "",
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

  const handleSaveDraft = () => {
    try {
      window.localStorage.setItem("ams_draft_compensation", JSON.stringify(formData));
      toast.success("草稿保存成功");
    } catch {
      toast.error("草稿保存失败，请检查浏览器存储空间");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const compensationPayload = {
        assetId: parseRequiredId(formData.assetId, "资产ID"),
        responsibleUserId: parseRequiredId(formData.responsibleId, "赔偿责任人ID"),
        responsibleDeptId: parseOptionalId(formData.deptCode),
        compensationType: "ASSET_LOSS",
        description: formData.lossDescription,
        incidentDate: formData.lossDate,
      };
      const businessData = {
        ...formData,
        ...compensationPayload,
      };

      await approvalService.create({
        processType: "ASSET_COMPENSATION",
        businessType: "ASSET_COMPENSATION",
        businessId: compensationPayload.assetId,
        title: `资产赔偿申请 ${formData.assetId}`,
        description: compensationPayload.description,
        businessData: JSON.stringify(businessData),
      });
      window.localStorage.removeItem("ams_draft_compensation");
      navigate("/approval");
    } catch (err) {
      console.error('Failed to submit compensation:', err);
      setError(err instanceof Error ? err.message : '提交资产赔偿失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAssetSearch = useCallback(async () => {
    setAssetSearchLoading(true);
    try {
      const result = await assetService.searchPaged(assetSearchKeyword, 1, 10);
      setAssetSearchResults(result?.records ?? []);
    } catch {
      setAssetSearchResults([]);
    } finally {
      setAssetSearchLoading(false);
    }
  }, [assetSearchKeyword]);

  const handleSelectAsset = useCallback((asset: AssetRecord) => {
    setFormData(prev => ({
      ...prev,
      assetId: String(asset.id),
      assetName: asset.assetName ?? '',
      modelSpec: (asset as Record<string, unknown>).modelSpec as string ?? '',
      deptName: asset.departmentName ?? '',
    }));
    setShowAssetPicker(false);
    setAssetSearchKeyword('');
    setAssetSearchResults([]);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files);
    setUploadedFiles(prev => [...prev, ...newFiles]);
    setFormData(prev => ({
      ...prev,
      attachmentCount: String(Number(prev.attachmentCount) + newFiles.length),
    }));
    toast.success(`已添加 ${newFiles.length} 个附件`);
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
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
        <button onClick={() => navigate('/workflow-designer?businessType=ASSET_COMPENSATION')} type="button" className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-2">
          <Settings className="w-4 h-4" />
          配置流程
        </button>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">资产ID <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input type="text" name="assetId" required value={formData.assetId} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500" />
                <button type="button" onClick={() => setShowAssetPicker(true)} className="shrink-0 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-gray-600">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">附加文件 ({uploadedFiles.length} 个)</label>
              <div className="flex items-center gap-4">
                <label className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 flex items-center gap-2 transition-colors cursor-pointer">
                  <Paperclip className="w-4 h-4" /> 上传附件
                  <input type="file" multiple className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png,.zip" />
                </label>
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {uploadedFiles.map((file, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                        <Paperclip className="w-3 h-3" />
                        {file.name}
                        <button type="button" onClick={() => {
                          setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
                          setFormData(prev => ({ ...prev, attachmentCount: String(Math.max(0, Number(prev.attachmentCount) - 1)) }));
                        }} className="text-blue-400 hover:text-red-500">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
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
            onClick={handleSaveDraft}
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

      {showAssetPicker && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center z-50 p-4" onClick={() => setShowAssetPicker(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-100" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">选择资产</h3>
              <button onClick={() => setShowAssetPicker(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-4">
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="输入资产名称或编码搜索..."
                  value={assetSearchKeyword}
                  onChange={e => setAssetSearchKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAssetSearch()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={handleAssetSearch} disabled={assetSearchLoading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                  {assetSearchLoading ? '搜索中...' : '搜索'}
                </button>
              </div>
              <div className="max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg">
                {assetSearchResults.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500 text-sm">请输入关键词搜索资产</div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">ID</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">资产名称</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">分类</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">部门</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {assetSearchResults.map(asset => (
                        <tr key={asset.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{asset.id}</td>
                          <td className="px-4 py-2 text-sm font-medium">{asset.assetName ?? '-'}</td>
                          <td className="px-4 py-2 text-sm">{asset.categoryName ?? '-'}</td>
                          <td className="px-4 py-2 text-sm">{asset.departmentName ?? '-'}</td>
                          <td className="px-4 py-2 text-sm">
                            <button onClick={() => handleSelectAsset(asset)} className="text-blue-600 hover:text-blue-800 font-medium">选择</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
