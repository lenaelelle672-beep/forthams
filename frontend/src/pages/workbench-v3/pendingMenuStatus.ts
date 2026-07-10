/**
 * V3 待接入菜单的建设状态元数据。
 *
 * 这些菜单已在 WorkbenchV3 的 44 项 IA 分组里登记，但尚未接入真组件（显示建设中占位）。
 * 每项记录其后端就绪程度与计划阶段，让管理员从占位页就能看清"还差什么"，
 * 而不是只看到一个泛化的"建设中"提示。
 *
 * 状态口径：
 * - backend: 'none'（从 0 建设）/ 'partial'（有部分能力，如 service 无 controller）/ 'ready'（后端就绪，待前端接入）
 * - phase: 计划阶段（P1/P2/...），与 expanded-prd 分期路线一致
 */

export type PendingBackendStatus = 'none' | 'partial' | 'ready';

export interface PendingMenuStatus {
  /** 后端就绪程度 */
  backend: PendingBackendStatus;
  /** 后端现状一句话说明 */
  backendNote: string;
  /** 计划阶段 */
  phase: 'P1' | 'P2' | 'P3';
  /** 建设内容简述 */
  plan: string;
}

export const pendingMenuStatus: Record<string, PendingMenuStatus> = {
  'system-data-permissions': {
    backend: 'partial',
    backendNote: '已有 RolePermissionCatalogController（角色-权限绑定目录），但数据权限规则（dataScope/规则引擎）的 entity/service/controller 尚未建设，sys_role 表无 data_scope 字段。',
    phase: 'P1',
    plan: '新建 data_permission_rule 表 + DataPermissionRule entity/service/controller（只收紧、CUSTOM 边界），前端接入只读规则目录与投影预览。',
  },
  'system-handover': {
    backend: 'none',
    backendNote: '后端零实现。仅 TenantContext 同名，与离职交接无关。',
    phase: 'P1',
    plan: '新建 handover 表 + 对象摘要 schema，明确 PENDING/IN_PROGRESS/COMPLETED/CANCELLED 状态机与真实资产/工单/审批对象转移的事务边界。',
  },
  'system-workflow-mail': {
    backend: 'none',
    backendNote: '后端零实现。无 WorkflowMail/BpmMailConfig 相关类，存在零业务调用风险。',
    phase: 'P2',
    plan: '校准流程节点邮件触发服务，接入流程平台发送决策链与模板渲染，补发送审计。',
  },
  'system-import-export': {
    backend: 'partial',
    backendNote: '已有 AssetImportExportService（资产专用导入导出，位于孤立 com.assetmanage 包），但无通用 ImportExportController/ImportTask/ExportTask。',
    phase: 'P1',
    plan: '泛化为按业务对象的通用异步导入导出任务，补错误报告与导出脱敏。',
  },
  'system-doc-center': {
    backend: 'none',
    backendNote: '后端零实现。',
    phase: 'P2',
    plan: '待定：内部文档中心还是外部知识库。需用户决策后设计 DocArticle/DocVersion + 附件安全。',
  },
  'system-tech-support': {
    backend: 'none',
    backendNote: '后端零实现。',
    phase: 'P2',
    plan: '设计 SupportTicket + 诊断包（强制脱敏，禁止导出敏感配置原值）与支持工单流转。',
  },
};

export function getPendingMenuStatus(menuId: string): PendingMenuStatus | undefined {
  return pendingMenuStatus[menuId];
}
