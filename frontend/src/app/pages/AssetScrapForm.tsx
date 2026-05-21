import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2, Search, Settings, Upload, Save } from "lucide-react";
import { toast } from "sonner";
import { approvalService } from "../services/approvalService";
import { type AssetRecord } from "../services/assetService";
import { AssetDisposalPickerModal } from "../components/disposal/AssetDisposalPicker";

/** Sanitize form data: strip File/Blob/function/symbol/undefined values */
function sanitizeFormData(data: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof File || value instanceof Blob) continue;
    if (typeof value === "function") continue;
    if (typeof value === "symbol") continue;
    if (typeof value === "undefined") continue;
    clean[key] = value;
  }
  return clean;
}

/** Save form data as a draft to localStorage. */
function saveDraftToStorage(formType: string, data: Record<string, unknown>): boolean {
  try {
    const sanitized = sanitizeFormData(data);
    const timestamp = Date.now();
    const dataKey = `ams_draft_${formType}_${timestamp}`;
    const indexKey = `ams_draft_latest_${formType}`;
    localStorage.setItem(dataKey, JSON.stringify(sanitized));
    localStorage.setItem(indexKey, dataKey);
    return true;
  } catch {
    return false;
  }
}

/** Load the latest draft for a given formType */
function loadLatestDraftFromStorage(formType: string): Record<string, unknown> | null {
  try {
    const indexKey = `ams_draft_latest_${formType}`;
    const dataKey = localStorage.getItem(indexKey);
    if (!dataKey) return null;
    const raw = localStorage.getItem(dataKey);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Clear draft data key and index key for a given formType */
function clearDraftFromStorage(formType: string): void {
  try {
    const indexKey = `ams_draft_latest_${formType}`;
    const dataKey = localStorage.getItem(indexKey);
    if (dataKey) {
      localStorage.removeItem(dataKey);
    }
    localStorage.removeItem(indexKey);
  } catch {
    // silently ignore
  }
}

function parseRequiredId(value: string, label: string): number {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label}必须填写正整数 ID`);
  }
  return parsed;
}

function readAssetField(asset: AssetRecord, keys: string[]): string {
  for (const key of keys) {
    const value = asset[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  return "";
}

function getAssetId(asset: AssetRecord): string {
  return readAssetField(asset, ["id", "assetId", "asset_id"]);
}

function getAssetDisplayName(asset: AssetRecord): string {
  return readAssetField(asset, ["assetName", "name", "asset_name", "title"]);
}

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
  const [draftData, setDraftData] = useState<Record<string, unknown> | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  
  // Format current date and time
  const now = new Date();
  const defaultDateTime = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const [formData, setFormData] = useState({
    // Basic Info
    processId: "BF" + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + "4878",
    applicantId: "",
    applyDate: defaultDateTime,
    applicantName: "",
    contactPhone: "",
    
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

  /** Detect and offer to restore draft on mount */
  useEffect(() => {
    const latestDraft = loadLatestDraftFromStorage("scrap");
    if (latestDraft) {
      setDraftData(latestDraft);
    }
  }, []);

  /** Restore draft data into form state */
  const handleRestoreDraft = useCallback(() => {
    if (draftData) {
      setFormData(prev => ({ ...prev, ...(draftData as Partial<typeof prev>) }));
      const restoredAssetId = String(draftData.assetId ?? "").trim();
      if (restoredAssetId) {
        setSelectedAssetId(restoredAssetId);
      }
      setDraftData(null);
    }
  }, [draftData]);

  /** Dismiss draft without restoring — clears from localStorage */
  const handleDismissDraft = useCallback(() => {
    clearDraftFromStorage("scrap");
    setDraftData(null);
  }, []);

  /** Save current form data as draft */
  const handleSaveDraft = useCallback(() => {
    const success = saveDraftToStorage("scrap", formData as unknown as Record<string, unknown>);
    if (success) {
      toast.success("草稿保存成功");
    } else {
      toast.error("草稿保存失败，请检查浏览器存储空间");
    }
  }, [formData]);

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

  const applyAssetRecord = useCallback((asset: AssetRecord) => {
    const assetId = getAssetId(asset);
    const assetName = getAssetDisplayName(asset);
    const departmentCode = readAssetField(asset, ["departmentCode", "deptCode", "departmentId", "deptId", "useDepartmentId"]);
    const departmentName = readAssetField(asset, ["departmentName", "deptName", "department", "dept", "useDepartmentName"]);
    const location = readAssetField(asset, ["locationName", "location", "areaName", "area", "storageLocation", "storeLocation"]);
    const userId = readAssetField(asset, ["userId", "user_id", "custodianId", "keeperId"]);
    const userChineseName = readAssetField(asset, ["custodianName", "keeperName", "userName", "ownerName", "responsibleName"]);
    const ledger = readAssetField(asset, ["ledgerName", "ledger", "accountBook", "bookName"]);
    const startUseTime = readAssetField(asset, ["firstUsageDate", "startUseTime", "startTime", "purchaseDate"]);

    setFormData((prev) => ({
      ...prev,
      assetId: assetId || prev.assetId,
      assetName: assetName || prev.assetName,
      deptCode: departmentCode || prev.deptCode,
      deptName: departmentName || prev.deptName,
      assetLocation: location || prev.assetLocation,
      userId: userId || prev.userId,
      userChineseName: userChineseName || prev.userChineseName,
      assetLedger: ledger || prev.assetLedger,
      startUseTime: startUseTime || prev.startUseTime,
    }));
  }, []);

  /** Handle asset selection from AssetDisposalPicker */
  const handlePickerSelect = useCallback((asset: AssetRecord) => {
    const assetId = getAssetId(asset);
    setSelectedAssetId(assetId);
    applyAssetRecord(asset);
    setAssetPickerOpen(false);
  }, [applyAssetRecord]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      if (!selectedAssetId) {
        throw new Error("请先从资产台账选择资产");
      }
      const scrapPayload = {
        assetId: parseRequiredId(formData.assetId, "资产ID"),
        reason: formData.scrapReason,
      };
      const businessData = {
        ...formData,
        ...scrapPayload,
      };

      await approvalService.create({
        processType: "ASSET_SCRAP",
        businessType: "ASSET_SCRAP",
        businessId: scrapPayload.assetId,
        title: `资产报废申请 ${formData.processId}`,
        description: scrapPayload.reason,
        businessData: JSON.stringify(businessData),
      });
      clearDraftFromStorage("scrap");
      navigate("/approval");
    } catch (err) {
      console.error('Failed to submit scrap:', err);
      setError(err instanceof Error ? err.message : '提交资产报废转让失败');
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
            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">资产报废转让电子流</h2>
            <p className="text-sm text-gray-400 mt-1">当前状态：草稿 &nbsp;|&nbsp; 流水号：{formData.processId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/workflow-designer?businessType=ASSET_SCRAP')} type="button" className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-2">
            <Settings className="w-4 h-4" />
            配置流程
          </button>
          <button onClick={handleSaveDraft} type="button" className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
            <Save className="w-4 h-4" />
            保存草稿
          </button>
        </div>
      </div>

      {/* Draft Restore Blocking Modal */}
      {draftData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="draft-restore-prompt">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 text-lg font-bold shrink-0">!</div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">检测到未完成的草稿</h3>
                <p className="text-sm text-gray-400 mt-0.5">是否恢复上次编辑的表单数据？</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={handleRestoreDraft}
                className="px-5 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
                data-testid="draft-restore-btn"
              >
                恢复
              </button>
              <button
                onClick={handleDismissDraft}
                className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                data-testid="draft-dismiss-btn"
              >
                放弃
              </button>
            </div>
          </div>
        </div>
      )}

      <AssetDisposalPickerModal
        open={assetPickerOpen}
        title="选择报废资产"
        onClose={() => setAssetPickerOpen(false)}
        onSelect={handlePickerSelect}
        selectedAssetId={selectedAssetId}
        label="搜索并选择要报废的资产"
      />

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
                          'border-gray-200 text-gray-400 bg-white'}`}>
                        {step.status === 'complete' ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : (
                          <span className="text-sm font-medium">{step.id}</span>
                        )}
                      </span>
                      <span className={`text-xs font-medium whitespace-nowrap
                        ${step.status === 'current' ? 'text-blue-600' : 
                          step.status === 'complete' ? 'text-gray-900' : 'text-gray-400'}`}>
                        {step.name}
                      </span>
                    </span>
                    {stepIdx !== steps.length - 1 && (
                      <div className={`absolute top-4 left-[50%] w-full h-0.5 ml-4 bg-blue-50`} />
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
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700"
              />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">填表日期</label>
              <input 
                type="text" 
                name="applyDate"
                value={formData.applyDate}
                readOnly
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400"
              />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">申请人姓名</label>
              <input 
                type="text" 
                name="applicantName"
                value={formData.applicantName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
              <input 
                type="text" 
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: 报废固定资产信息 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-purple-50/50 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-purple-900">从资产台账选择资产</h3>
          </div>
          <div className="p-6">
            <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {selectedAssetId ? `${formData.assetName || '未命名资产'}（ID ${formData.assetId}）` : '尚未选择资产'}
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  {selectedAssetId
                    ? `部门：${formData.deptName || '-'}；存放地点：${formData.assetLocation || '-'}`
                    : '点击按钮打开资产台账，选择后自动回填报废资产信息。'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssetPickerOpen(true)}
                className="shrink-0 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                data-testid="open-scrap-asset-picker"
              >
                {selectedAssetId ? '重新选择资产' : '选择资产'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">报废资产明细</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产ID <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="assetId"
                required
                value={formData.assetId}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50"
                readOnly
                data-testid="scrap-asset-id-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产名称 <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                name="assetName"
                required
                value={formData.assetName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">型号规格</label>
              <input 
                type="text" 
                name="modelSpec"
                value={formData.modelSpec}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">附属物品</label>
              <input 
                type="text" 
                name="attachedItems"
                value={formData.attachedItems}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">使用人ID</label>
              <input 
                type="text" 
                name="userId"
                value={formData.userId}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">产品编码</label>
              <input 
                type="text" 
                name="productCode"
                value={formData.productCode}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">所在部门编码</label>
              <input 
                type="text" 
                name="deptCode"
                value={formData.deptCode}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">所在部门名称</label>
              <input 
                type="text" 
                name="deptName"
                value={formData.deptName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始使用时间</label>
              <input 
                type="date" 
                name="startUseTime"
                value={formData.startUseTime}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">使用人(中文名)</label>
              <input 
                type="text" 
                name="userChineseName"
                value={formData.userChineseName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产存放地点</label>
              <input 
                type="text" 
                name="assetLocation"
                value={formData.assetLocation}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产帐套</label>
              <input 
                type="text" 
                name="assetLedger"
                value={formData.assetLedger}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">外贸合同号</label>
              <input 
                type="text" 
                name="foreignTradeContract"
                value={formData.foreignTradeContract}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">监管日期</label>
              <input 
                type="date" 
                name="supervisionDate"
                value={formData.supervisionDate}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
                  placeholder="在此粘贴文档链接..."
                />
                <button type="button" className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 flex items-center gap-2">
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
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button type="button" className="shrink-0 px-3 py-2 bg-blue-50 border border-gray-200 rounded-lg hover:bg-blue-50">
                  <Search className="w-4 h-4 text-gray-500" />
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
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button type="button" className="shrink-0 px-3 py-2 bg-blue-50 border border-gray-200 rounded-lg hover:bg-blue-50">
                  <Search className="w-4 h-4 text-gray-500" />
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
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button type="button" className="shrink-0 px-3 py-2 bg-blue-50 border border-gray-200 rounded-lg hover:bg-blue-50">
                  <Search className="w-4 h-4 text-gray-500" />
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
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button type="button" className="shrink-0 px-3 py-2 bg-blue-50 border border-gray-200 rounded-lg hover:bg-blue-50">
                  <Search className="w-4 h-4 text-gray-500" />
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
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
          >
            取消申请
          </button>
          <button 
            type="button"
            onClick={handleSaveDraft}
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
