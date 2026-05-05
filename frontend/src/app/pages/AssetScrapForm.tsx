import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2, Search, Settings, Upload } from "lucide-react";
import { disposalService } from "../services/disposalService";

const steps = [
  { id: 1, name: "申请人填写", status: "current" },
  { id: 2, name: "直接主管审批", status: "upcoming" },
  { id: 3, name: "一级资源管理", status: "upcoming" },
  { id: 4, name: "进出口审批", status: "upcoming" },
  { id: 5, name: "资产原值", status: "upcoming" },
  { id: 6, name: "资产管理处审批", status: "upcoming" },
  { id: 7, name: "接收异地报废", status: "upcoming" },
  { id: 8, name: "处置异地报废", status: "upcoming" },
  { id: 9, name: "确认收款", status: "upcoming" },
  { id: 10, name: "资产核算处确认", status: "upcoming" },
];

export function AssetScrapForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Format current date and time
  const now = new Date();
  const defaultDateTime = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const [formData, setFormData] = useState({
    // Basic Info
    processId: "BF" + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + "4878",
    applicantId: "chenchaojie 03361/uniview",
    applyDate: defaultDateTime,
    applicantName: "陈超杰",
    contactPhone: "661628(661628)",
    
    // Asset Info
    assetId: "",
    assetName: "",
    modelSpec: "",
    attachedItems: "",
    userId: "",
    productCode: "",
    deptCode: "",
    deptName: "",
    startUseTime: "",
    userChineseName: "",
    assetLocation: "",
    assetLedger: "",
    foreignTradeContract: "",
    supervisionDate: "",
    
    // Attributes
    isPersonalLaptopTransfer: "否",
    isRemoteScrap: "否",
    hasStorageMedia: "否",
    isRnD: "否",
    
    // Reason & Attachment
    scrapReason: "",
    attachmentLinks: "",
    
    // Approval Personnel
    directManagerId: "",
    level1ResourceDeptId: "",
    officeAssetAdmin: "",
    mgmtOfficeSupport: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
      await disposalService.scrap(formData);
      navigate("/disposals");
    } catch (err) {
      console.error('Failed to submit scrap:', err);
      setError('提交资产报废转让失败');
    } finally {
      setLoading(false);
    }
  };

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
            <h2 className="text-2xl font-bold text-gray-900">资产报废转让电子流</h2>
            <p className="text-sm text-gray-500 mt-1">当前状态：草稿 &nbsp;|&nbsp; 流水号：{formData.processId}</p>
          </div>
        </div>
        <button onClick={() => navigate('/workflow-designer?businessType=ASSET_SCRAP')} type="button" className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-2">
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
        
        {/* Section 1: 基础申请信息 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">基础信息</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">申请人ID</label>
              <input 
                type="text" 
                name="applicantId"
                value={formData.applicantId}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700"
              />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">填表日期</label>
              <input 
                type="text" 
                name="applyDate"
                value={formData.applyDate}
                readOnly
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-500"
              />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">申请人姓名</label>
              <input 
                type="text" 
                name="applicantName"
                value={formData.applicantName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
              <input 
                type="text" 
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: 报废固定资产信息 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-purple-50/50 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-purple-900">报废固定资产信息</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产编号 <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  name="assetId"
                  required
                  value={formData.assetId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button type="button" className="shrink-0 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-200 flex items-center gap-1">
                  <Search className="w-4 h-4" /> 资产导入
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产名称 <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="assetName"
                required
                value={formData.assetName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">型号规格</label>
              <input 
                type="text" 
                name="modelSpec"
                value={formData.modelSpec}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">附属物品</label>
              <input 
                type="text" 
                name="attachedItems"
                value={formData.attachedItems}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">使用人ID</label>
              <input 
                type="text" 
                name="userId"
                value={formData.userId}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">产品编码</label>
              <input 
                type="text" 
                name="productCode"
                value={formData.productCode}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">所在部门编码</label>
              <input 
                type="text" 
                name="deptCode"
                value={formData.deptCode}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">所在部门名称</label>
              <input 
                type="text" 
                name="deptName"
                value={formData.deptName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始使用时间</label>
              <input 
                type="date" 
                name="startUseTime"
                value={formData.startUseTime}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">使用人(中文名)</label>
              <input 
                type="text" 
                name="userChineseName"
                value={formData.userChineseName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产存放地点</label>
              <input 
                type="text" 
                name="assetLocation"
                value={formData.assetLocation}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产帐套</label>
              <input 
                type="text" 
                name="assetLedger"
                value={formData.assetLedger}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">外贸合同号</label>
              <input 
                type="text" 
                name="foreignTradeContract"
                value={formData.foreignTradeContract}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">监管日期</label>
              <input 
                type="date" 
                name="supervisionDate"
                value={formData.supervisionDate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: 报废属性确认 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">报废属性确认</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">是否为个人用便携机转个人</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="isPersonalLaptopTransfer" value="是" checked={formData.isPersonalLaptopTransfer === "是"} onChange={() => handleRadioChange("isPersonalLaptopTransfer", "是")} className="text-blue-600 focus:ring-blue-500" /> 是
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="isPersonalLaptopTransfer" value="否" checked={formData.isPersonalLaptopTransfer === "否"} onChange={() => handleRadioChange("isPersonalLaptopTransfer", "否")} className="text-blue-600 focus:ring-blue-500" /> 否
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">是否异地报废</label>
              <div className="flex gap-4 mb-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="isRemoteScrap" value="是" checked={formData.isRemoteScrap === "是"} onChange={() => handleRadioChange("isRemoteScrap", "是")} className="text-blue-600 focus:ring-blue-500" /> 是
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="isRemoteScrap" value="否" checked={formData.isRemoteScrap === "否"} onChange={() => handleRadioChange("isRemoteScrap", "否")} className="text-blue-600 focus:ring-blue-500" /> 否
                </label>
              </div>
              <p className="text-xs text-red-500 leading-tight">异地报废指报废资产的实物不寄回嘉兴报废品库房（不包括便携机满四年转个人）</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">是否有存储介质</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="hasStorageMedia" value="是" checked={formData.hasStorageMedia === "是"} onChange={() => handleRadioChange("hasStorageMedia", "是")} className="text-blue-600 focus:ring-blue-500" /> 是
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="hasStorageMedia" value="否" checked={formData.hasStorageMedia === "否"} onChange={() => handleRadioChange("hasStorageMedia", "否")} className="text-blue-600 focus:ring-blue-500" /> 否
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">是否研发</label>
              <select 
                name="isRnD"
                value={formData.isRnD}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="是">是</option>
                <option value="否">否</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: 报废原因及证明材料 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">报废原因及证明材料</h3>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">报废原因 <span className="text-red-500">*</span></label>
              <textarea 
                name="scrapReason"
                rows={3}
                required
                value={formData.scrapReason}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="请详细描述报废原因..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                将办公设备维修电子流以文档链接方式粘贴、或上传工程师/供应商评估意见、权签后的设备报废立项评审表、公司的资产报废发文等资料：
              </label>
              <div className="mt-2">
                <textarea 
                  name="attachmentLinks"
                  rows={2}
                  value={formData.attachmentLinks}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
                  placeholder="在此粘贴文档链接..."
                />
                <button type="button" className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 flex items-center gap-2">
                  <Upload className="w-4 h-4" /> 上传附件资料
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: 审批人员配置 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">审批流转人员</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">直接主管 ID</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  name="directManagerId"
                  value={formData.directManagerId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button type="button" className="shrink-0 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">
                  <Search className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">一级资源管理部门 ID</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  name="level1ResourceDeptId"
                  value={formData.level1ResourceDeptId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button type="button" className="shrink-0 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">
                  <Search className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">外研所/办事处资产管理员/办事处秘书</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  name="officeAssetAdmin"
                  value={formData.officeAssetAdmin}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button type="button" className="shrink-0 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">
                  <Search className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">管理办/运作支持部</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  name="mgmtOfficeSupport"
                  value={formData.mgmtOfficeSupport}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button type="button" className="shrink-0 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">
                  <Search className="w-4 h-4 text-gray-600" />
                </button>
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
