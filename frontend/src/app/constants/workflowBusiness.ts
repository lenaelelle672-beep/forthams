export const WORKFLOW_DRAFT_KEY_PREFIX = "forthAMS.workflowDesigner.draft";

export const businessFlowOptions = [
  {
    businessType: "ASSET_TRANSFER",
    name: "资产转移流程",
    description: "用于资产转出、转入确认及双方部门资产管理员审批的本地流程定义草稿。",
    businessName: "资产转移",
    formPath: "/disposals/transfer/new",
    stepCount: 5,
    accentClass: "from-blue-500 to-indigo-500",
  },
  {
    businessType: "ASSET_CLEARANCE",
    name: "资产清退流程",
    description: "用于闲置资产清退、部门审批、库房确认及 IT 审核的本地流程定义草稿。",
    businessName: "资产清退",
    formPath: "/disposals/clearance/new",
    stepCount: 5,
    accentClass: "from-emerald-500 to-teal-500",
  },
  {
    businessType: "ASSET_SCRAP",
    name: "资产报废转让流程",
    description: "用于资产报废转让多级审批、收款确认与核算归档的本地流程定义草稿。",
    businessName: "资产报废转让",
    formPath: "/disposals/scrap/new",
    stepCount: 5,
    accentClass: "from-orange-500 to-rose-500",
  },
  {
    businessType: "ASSET_COMPENSATION",
    name: "资产赔偿流程",
    description: "用于资产损失赔偿、信息安全审批、财务审批与库房接收的本地流程定义草稿。",
    businessName: "资产赔偿",
    formPath: "/disposals/compensation/new",
    stepCount: 5,
    accentClass: "from-amber-500 to-yellow-500",
  },
] as const;

export type BusinessType = (typeof businessFlowOptions)[number]["businessType"];

export function isBusinessType(value: string | null): value is BusinessType {
  return businessFlowOptions.some((option) => option.businessType === value);
}

export function getDraftStorageKey(businessType: BusinessType) {
  return `${WORKFLOW_DRAFT_KEY_PREFIX}.${businessType}`;
}
