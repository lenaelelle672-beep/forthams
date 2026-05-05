import { useAuth } from '@/context/AuthContext';

/**
 * 资产清理表单权限配置接口
 */
export interface AssetClearancePermission {
  view: boolean;      // 查看清理表单
  edit: boolean;      // 编辑清理信息
  submit: boolean;    // 提交审批
  approve: boolean;   // 审批通过
}

/**
 * 完整权限接口
 */
export interface Permission {
  assetClearance: AssetClearancePermission;
}

/**
 * 角色权限映射表
 * 定义各角色对资产清理表单的操作权限
 */
const ROLE_PERMISSION_MAP: Record<string, AssetClearancePermission> = {
  ADMIN: {
    view: true,
    edit: true,
    submit: true,
    approve: true,
  },
  ASSET_MANAGER: {
    view: true,
    edit: true,
    submit: true,
    approve: false,
  },
  AUDITOR: {
    view: true,
    edit: false,
    submit: false,
    approve: false,
  },
  普通用户: {
    view: true,
    edit: false,
    submit: false,
    approve: false,
  },
};

/**
 * 默认权限（未匹配角色时的降级策略）
 */
const DEFAULT_PERMISSION: AssetClearancePermission = {
  view: true,
  edit: false,
  submit: false,
  approve: false,
};

/**
 * usePermissions Hook
 * 
 * 从全局权限上下文获取当前用户权限
 * 基于角色映射表动态解析资产清理表单相关权限
 * 
 * @returns Permission 包含 assetClearance 权限配置的对象
 * 
 * @example
 * ```tsx
 * const { assetClearance } = usePermissions();
 * const isEditable = !isReadOnly && assetClearance.edit;
 * 
 * return (
 *   <Input disabled={!isEditable} />
 * );
 * ```
 */
export const usePermissions = (): Permission => {
  const { user } = useAuth();
  
  // 从用户角色获取权限配置，若无匹配角色则使用默认权限
  const roleKey = user?.role || '普通用户';
  const assetClearance = ROLE_PERMISSION_MAP[roleKey] || DEFAULT_PERMISSION;
  
  return {
    assetClearance,
  };
};

/**
 * 权限检查工具函数
 * 用于在 handleChange/handleSubmit 中进行细粒度权限校验
 */
export const checkPermission = (
  permission: AssetClearancePermission,
  action: keyof AssetClearancePermission,
  isReadOnly: boolean
): boolean => {
  // 只读模式下任何权限检查都返回 false（权限校验被跳过）
  if (isReadOnly) {
    return false;
  }
  return permission[action] ?? false;
};