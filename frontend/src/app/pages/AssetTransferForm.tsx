import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Check, FileText, Save, Send, Settings } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { approvalService } from "../services/approvalService";
import { type AssetRecord } from "../services/assetService";
import { AssetDisposalPickerModal } from "../components/disposal/AssetDisposalPicker";
import { deptService, type DeptRecord } from "../services/deptService";
import { userService, type UserRecord } from "../services/userService";

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

/** Save form data as a draft to localStorage. Data key: ams_draft_{formType}_{timestamp}, Index key: ams_draft_latest_{formType} */
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

/** Load the latest draft for a given formType using the index key */
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
  const firstValue = getFirstDelimitedValue(value);
  const parsed = Number(firstValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label}必须填写正整数 ID`);
  }
  return parsed;
}

function getFirstDelimitedValue(value: string) {
  return value.split(/[,\s，、]+/).find(Boolean)?.trim() ?? "";
}

function parseRequiredText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label}必须填写`);
  }
  return trimmed;
}

function readRecordField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  return "";
}

function readAssetField(asset: AssetRecord, keys: string[]): string {
  return readRecordField(asset, keys);
}

function getAssetId(asset: AssetRecord): string {
  return readAssetField(asset, ["id", "assetId", "asset_id"]);
}

function getAssetDisplayName(asset: AssetRecord): string {
  return readAssetField(asset, ["assetName", "name", "asset_name", "title"]);
}

function getAssetDepartmentName(asset: AssetRecord): string {
  return readAssetField(asset, [
    "departmentName",
    "deptName",
    "department",
    "dept",
    "useDepartmentName",
    "usingDepartmentName",
    "ownerDepartmentName",
  ]);
}

function getAssetDepartmentCode(asset: AssetRecord): string {
  return readAssetField(asset, [
    "departmentCode",
    "deptCode",
    "departmentId",
    "deptId",
    "useDepartmentId",
    "usingDepartmentId",
  ]);
}

function getAssetLocation(asset: AssetRecord): string {
  return readAssetField(asset, [
    "locationName",
    "location",
    "areaName",
    "area",
    "storageLocation",
    "storeLocation",
  ]);
}

function normalizeRecordList<T>(response: unknown): T[] {
  if (Array.isArray(response)) {
    return response as T[];
  }

  if (response && typeof response === "object") {
    const record = response as Record<string, unknown>;
    if (Array.isArray(record.records)) {
      return record.records as T[];
    }
    if (record.data) {
      return normalizeRecordList<T>(record.data);
    }
  }

  return [];
}

function flattenDeptRecords(records: DeptRecord[]): DeptRecord[] {
  return records.flatMap((dept) => [dept, ...flattenDeptRecords(normalizeRecordList<DeptRecord>(dept.children))]);
}

function getDeptId(dept: DeptRecord): string {
  return readRecordField(dept, ["id", "deptId", "dept_id"]);
}

function getDeptDisplayName(dept: DeptRecord): string {
  return readRecordField(dept, ["deptName", "dept_name", "name", "title"]);
}

function getUserId(user: UserRecord): string {
  return readRecordField(user, ["id", "userId", "user_id"]);
}

function getUserDisplayName(user: UserRecord): string {
  return readRecordField(user, ["realName", "real_name", "name", "username"]);
}

function getUserDeptId(user: UserRecord): string {
  return readRecordField(user, ["deptId", "dept_id", "departmentId", "department_id"]);
}

const workflowSteps = [
  { id: 1, name: "申请人填写", status: "current" },
  { id: 2, name: "资产转入人确认", status: "pending" },
  { id: 3, name: "转入部门资产管理员审批", status: "pending" },
  { id: 4, name: "资产转出人确认", status: "pending" },
  { id: 5, name: "转出部门资产管理员审批", status: "pending" },
];

export function AssetTransferForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftData, setDraftData] = useState<Record<string, unknown> | null>(null);
  const [userOptions, setUserOptions] = useState<UserRecord[]>([]);
  const [deptOptions, setDeptOptions] = useState<DeptRecord[]>([]);
  const [peopleLookupMessage, setPeopleLookupMessage] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetStatus, setSelectedAssetStatus] = useState<string | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [formData, setFormData] = useState({
    applicant: "",
    processId: "TRF-" + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + "001",
    applyDate: new Date().toISOString().split('T')[0],
    assetIds: "",
    assetName: "",
    missingAccessories: "",
    associatedCompany: "",
    transferor: "",
    transferDeptCode: "",
    transferDept: "",
    transferLedger: "",
    transferArea: "",
    receiver: "",
    receiveDeptCode: "",
    receiveDept: "",
    receiveLedger: "",
    receiveArea: "",
    transferReason: "",
    transferType: "其他资产转移",
    receiveDeptAdmin: "",
    transferDeptAdmin: "",
  });

  const findDeptById = useCallback(
    (deptId: string) => deptOptions.find((dept) => getDeptId(dept) === deptId),
    [deptOptions],
  );

  const findUserById = useCallback(
    (userId: string) => userOptions.find((user) => getUserId(user) === userId),
    [userOptions],
  );

  const applyAssetRecord = useCallback((asset: AssetRecord) => {
    const assetId = getAssetId(asset);
    const assetName = getAssetDisplayName(asset);
    const departmentCode = getAssetDepartmentCode(asset);
    const department = departmentCode ? findDeptById(departmentCode) : undefined;
    const departmentName = getAssetDepartmentName(asset) || (department ? getDeptDisplayName(department) : "");
    const location = getAssetLocation(asset);
    const assetUserId = readAssetField(asset, ["userId", "user_id", "custodianId", "keeperId", "ownerId", "responsibleUserId"]);
    const assetUser = assetUserId ? findUserById(assetUserId) : undefined;
    const transferor = readAssetField(asset, ["custodianName", "keeperName", "userName", "ownerName", "responsibleName"])
      || (assetUser ? getUserDisplayName(assetUser) : assetUserId);
    const ledger = readAssetField(asset, ["ledgerName", "ledger", "accountBook", "bookName"]);
    const deptAdmin = readAssetField(asset, ["departmentAdmin", "deptAdmin", "assetManager", "managerName", "adminName"]);

    setFormData((prev) => ({
      ...prev,
      assetIds: assetId || prev.assetIds,
      assetName: assetName || prev.assetName,
      transferor: transferor || prev.transferor,
      transferDeptCode: departmentCode || prev.transferDeptCode,
      transferDept: departmentName || prev.transferDept,
      transferLedger: ledger || prev.transferLedger,
      transferArea: location || prev.transferArea,
      transferDeptAdmin: deptAdmin || prev.transferDeptAdmin,
    }));
  }, [findDeptById, findUserById]);

  const loadPeopleOptions = useCallback(async () => {
    try {
      setPeopleLookupMessage(null);
      const [usersResponse, deptsResponse] = await Promise.all([
        userService.list({ page: 1, pageSize: 100 }),
        deptService.getAll(),
      ]);
      setUserOptions(normalizeRecordList<UserRecord>(usersResponse));
      setDeptOptions(flattenDeptRecords(normalizeRecordList<DeptRecord>(deptsResponse)));
    } catch {
      setPeopleLookupMessage("人员或部门列表暂时无法加载，可手工输入 ID 继续提交");
    }
  }, []);

  /** Detect and offer to restore draft on mount */
  useEffect(() => {
    const latestDraft = loadLatestDraftFromStorage("transfer");
    if (latestDraft) {
      setDraftData(latestDraft);
    }
  }, []);

  useEffect(() => {
    void loadPeopleOptions();
  }, [loadPeopleOptions]);

  /** Restore draft data into form state */
  const handleRestoreDraft = useCallback(() => {
    if (draftData) {
      setFormData(prev => ({ ...prev, ...(draftData as Partial<typeof prev>) }));
      const restoredAssetId = String(draftData.assetIds ?? draftData.assetId ?? "").trim();
      if (restoredAssetId) {
        setSelectedAssetId(restoredAssetId);
      }
      setDraftData(null);
    }
  }, [draftData]);

  /** Dismiss draft without restoring — clears from localStorage */
  const handleDismissDraft = useCallback(() => {
    clearDraftFromStorage("transfer");
    setDraftData(null);
  }, []);

  /** Save current form data as draft */
  const handleSaveDraft = useCallback(() => {
    const success = saveDraftToStorage("transfer", formData as unknown as Record<string, unknown>);
    if (success) {
      toast.success("草稿保存成功");
    } else {
      toast.error("草稿保存失败，请检查浏览器存储空间");
    }
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleReceiverSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedUserId = e.target.value;
    if (!selectedUserId) return;

    const selectedUser = findUserById(selectedUserId);
    const userDeptId = selectedUser ? getUserDeptId(selectedUser) : "";
    const userDept = userDeptId ? findDeptById(userDeptId) : undefined;

    setFormData((prev) => ({
      ...prev,
      receiver: selectedUserId,
      receiveDeptCode: userDeptId || prev.receiveDeptCode,
      receiveDept: userDept ? getDeptDisplayName(userDept) : prev.receiveDept,
    }));
  };

  const handleReceiveDeptSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedDeptId = e.target.value;
    if (!selectedDeptId) return;

    const selectedDept = findDeptById(selectedDeptId);
    setFormData((prev) => ({
      ...prev,
      receiveDeptCode: selectedDeptId,
      receiveDept: selectedDept ? getDeptDisplayName(selectedDept) : prev.receiveDept,
    }));
  };

  /** Handle asset selection from AssetDisposalPicker */
  const handlePickerSelect = useCallback((asset: AssetRecord) => {
    const assetId = getAssetId(asset);
    setSelectedAssetId(assetId);
    setSelectedAssetStatus(readAssetField(asset, ["status"]) || null);
    applyAssetRecord(asset);
    setAssetPickerOpen(false);
  }, [applyAssetRecord]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!selectedAssetId) {
        throw new Error("请先从资产台账选择资产");
      }
      const BLOCKED_TRANSFER_STATUSES = new Set(["CLEARED", "RETIRED", "SCRAPPED"]);
      if (selectedAssetStatus && BLOCKED_TRANSFER_STATUSES.has(selectedAssetStatus.toUpperCase())) {
        throw new Error(`资产当前状态为${selectedAssetStatus}，不允许转移。仅闲置、使用中、维修中的资产可转移`);
      }
      const reason = parseRequiredText(formData.transferReason, "转移原因");
      const transferPayload = {
        assetId: parseRequiredId(formData.assetIds, "资产ID"),
        targetDeptId: parseRequiredId(formData.receiveDeptCode, "转入部门ID"),
        targetUserId: parseRequiredId(formData.receiver, "转入人ID"),
        targetLocation: formData.receiveArea.trim() || formData.receiveDept.trim(),
        reason,
      };
      const businessData = {
        ...formData,
        ...transferPayload,
      };
      const description = [
        `原因：${reason}`,
        formData.assetName.trim() ? `资产：${formData.assetName.trim()}` : null,
        formData.transferDept.trim() ? `转出部门：${formData.transferDept.trim()}` : null,
        formData.receiveDept.trim() ? `转入部门：${formData.receiveDept.trim()}` : null,
        formData.receiveArea.trim() ? `转入区域：${formData.receiveArea.trim()}` : null,
      ].filter(Boolean).join("；");

      await approvalService.create({
        processType: "ASSET_TRANSFER",
        businessType: "ASSET_TRANSFER",
        businessId: transferPayload.assetId,
        title: `资产转移申请 ${formData.processId}`,
        description,
        businessData: JSON.stringify(businessData),
      });
      clearDraftFromStorage("transfer");
      toast.success("资产转移申请已提交");
      navigate('/approval');
    } catch (err) {
      console.error('Failed to submit transfer:', err);
      setError(err instanceof Error ? err.message : '提交资产转移失败');
    } finally {
      setLoading(false);
    }
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
          <button onClick={() => navigate('/workflow-designer?businessType=ASSET_TRANSFER')} type="button" className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-2">
            <Settings className="w-4 h-4" />
            配置流程
          </button>
          <button type="button" onClick={handleSaveDraft} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
            <Save className="w-4 h-4" />
            保存草稿
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2">
            <Send className="w-4 h-4" />
            {loading ? '提交中...' : '提交审批'}
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* Draft Restore Blocking Modal */}
      {draftData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="draft-restore-prompt">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 text-lg font-bold shrink-0">!</div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">检测到未完成的草稿</h3>
                <p className="text-sm text-gray-500 mt-0.5">是否恢复上次编辑的表单数据？</p>
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
                className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
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
        title="选择转移资产"
        onClose={() => setAssetPickerOpen(false)}
        onSelect={handlePickerSelect}
        selectedAssetId={selectedAssetId}
        label="搜索并选择要转移的资产"
      />

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
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-base font-medium text-gray-900">从资产台账选择资产</h4>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedAssetId
                    ? `已选择：${formData.assetName || '未命名资产'}（ID ${formData.assetIds}）`
                    : '先从真实资产台账选择资产，系统会自动回填转出部门、地点和使用人。'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssetPickerOpen(true)}
                className="shrink-0 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                data-testid="open-transfer-asset-picker"
              >
                {selectedAssetId ? '重新选择资产' : '选择资产'}
              </button>
            </div>
          </div>

          <div className="md:col-span-3 border-t border-gray-100 pt-6 mt-2">
            <h4 className="text-base font-medium text-gray-900 mb-4">资产信息</h4>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">资产ID <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="assetIds"
              value={formData.assetIds}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
              readOnly
              data-testid="transfer-asset-id-input"
            />
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
              <label className="block text-sm font-medium text-gray-700 mb-1">转入人ID <span className="text-red-500">*</span></label>
              <div className="space-y-2">
                <input type="text" name="receiver" placeholder="请输入数字用户 ID" value={formData.receiver} onChange={handleChange} className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm bg-white focus:ring-blue-500 focus:border-blue-500" />
                <select
                  aria-label="选择转入人"
                  data-testid="receiver-select"
                  value={userOptions.some((user) => getUserId(user) === formData.receiver) ? formData.receiver : ""}
                  onChange={handleReceiverSelect}
                  disabled={userOptions.length === 0}
                  className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm bg-white focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">{userOptions.length ? "从人员列表选择" : "暂无可选人员，请输入用户 ID"}</option>
                  {userOptions.map((user) => {
                    const userId = getUserId(user);
                    const userName = getUserDisplayName(user) || "未命名人员";
                    return (
                      <option key={userId || userName} value={userId}>
                        {userId ? `${userId} - ${userName}` : userName}
                      </option>
                    );
                  })}
                </select>
                {peopleLookupMessage ? <p className="text-xs text-amber-600" data-testid="people-lookup-message">{peopleLookupMessage}</p> : null}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">转入部门ID <span className="text-red-500">*</span></label>
              <div className="space-y-2">
                <input type="text" name="receiveDeptCode" value={formData.receiveDeptCode} onChange={handleChange} className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm bg-white focus:ring-blue-500 focus:border-blue-500" />
                <select
                  aria-label="选择转入部门"
                  data-testid="receive-dept-select"
                  value={deptOptions.some((dept) => getDeptId(dept) === formData.receiveDeptCode) ? formData.receiveDeptCode : ""}
                  onChange={handleReceiveDeptSelect}
                  disabled={deptOptions.length === 0}
                  className="w-full px-3 py-2 border border-blue-200 rounded-md text-sm bg-white focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">{deptOptions.length ? "从部门列表选择" : "暂无可选部门，请输入部门 ID"}</option>
                  {deptOptions.map((dept) => {
                    const deptId = getDeptId(dept);
                    const deptName = getDeptDisplayName(dept) || "未命名部门";
                    return (
                      <option key={deptId || deptName} value={deptId}>
                        {deptId ? `${deptId} - ${deptName}` : deptName}
                      </option>
                    );
                  })}
                </select>
              </div>
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
