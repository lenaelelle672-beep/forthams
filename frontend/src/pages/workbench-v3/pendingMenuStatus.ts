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
