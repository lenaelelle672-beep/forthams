export type SystemModuleActionKey = 'create' | 'edit' | 'delete' | 'test' | 'preview' | 'dryRun' | 'retryLog' | 'refresh' | 'publish' | 'rollback' | 'disable' | 'archive' | 'export' | 'enable' | 'sort' | 'reset';

export type SystemModulePermissionMeta = {
  viewPermissions: readonly string[];
  actionPermissions: Partial<Record<SystemModuleActionKey, readonly string[]>>;
};

export type SystemModuleRegistryItem = {
  menuId: string;
  label: string;
  navGroup: string;
  workbenchPath: string;
  legacyRoute: string;
  permissionMeta: SystemModulePermissionMeta;
};

export const SYSTEM_INTERFACES_MENU_ID = 'system-interfaces';
export const SYSTEM_FIELD_MAPPING_MENU_ID = 'system-field-mapping';
export const SYSTEM_SYNC_RULES_MENU_ID = 'system-sync-rules';
export const SYSTEM_WEBHOOK_CONFIG_MENU_ID = 'system-webhook-config';
export const SYSTEM_EXTERNAL_SYSTEMS_MENU_ID = 'system-external-systems';
export const SYSTEM_BASE_PARAMS_MENU_ID = 'system-base-params';
export const SYSTEM_SECURITY_POLICY_MENU_ID = 'system-security-policy';
export const SYSTEM_AUDIT_LOG_MENU_ID = 'system-audit-log';
export const SYSTEM_MAIL_GATEWAY_MENU_ID = 'system-mail-gateway';
export const SYSTEM_MAIL_TEMPLATES_MENU_ID = 'system-mail-templates';
export const SYSTEM_MAIL_LOGS_MENU_ID = 'system-mail-logs';
export const SYSTEM_NOTIFICATION_TEMPLATES_MENU_ID = 'system-notification-templates';
export const SYSTEM_NOTIFICATION_CHANNELS_MENU_ID = 'system-notification-channels';
export const SYSTEM_NOTIFICATION_PREFERENCES_MENU_ID = 'system-notification-preferences';
export const SYSTEM_WORKFLOW_NOTIFICATION_SWITCH_MENU_ID = 'system-workflow-notification-switch';
export const SYSTEM_CACHE_MANAGEMENT_MENU_ID = 'system-cache-management';
export const SYSTEM_FILE_STORAGE_MENU_ID = 'system-file-storage';
export const SYSTEM_ASSET_CATEGORY_MENU_ID = 'system-asset-category';
export const SYSTEM_NUMBERING_RULES_MENU_ID = 'system-numbering-rules';
export const SYSTEM_CUSTOM_FIELDS_MENU_ID = 'system-custom-fields';
export const SYSTEM_CUSTOM_FIELD_SETS_MENU_ID = 'system-custom-field-sets';
export const SYSTEM_VENDOR_MANAGEMENT_MENU_ID = 'system-vendor-management';
export const SYSTEM_LOCATION_MANAGEMENT_MENU_ID = 'system-location-management';
export const SYSTEM_USER_MANAGEMENT_MENU_ID = 'system-user-management';
export const SYSTEM_DEPT_ORG_MENU_ID = 'system-dept-org';
export const SYSTEM_ROLE_PERMISSIONS_MENU_ID = 'system-role-permissions';
export const SYSTEM_MENU_PERMISSIONS_MENU_ID = 'system-menu-permissions';
export const SYSTEM_POST_MANAGEMENT_MENU_ID = 'system-post-management';
export const SYSTEM_TENANT_MANAGEMENT_MENU_ID = 'system-tenant-management';
export const SYSTEM_DATA_PERMISSIONS_MENU_ID = 'system-data-permissions';
export const SYSTEM_IMPORT_EXPORT_MENU_ID = 'system-import-export';
export const SYSTEM_HANDOVER_MENU_ID = 'system-handover';
export const SYSTEM_WORKFLOW_MAIL_MENU_ID = 'system-workflow-mail';
export const SYSTEM_DOC_CENTER_MENU_ID = 'system-doc-center';
export const SYSTEM_TECH_SUPPORT_MENU_ID = 'system-tech-support';
export const SYSTEM_FLOW_DEFINITION_MENU_ID = 'system-flow-definition';
export const SYSTEM_FLOW_DESIGNER_MENU_ID = 'system-flow-designer';
export const SYSTEM_FORM_CONFIG_MENU_ID = 'system-form-config';
export const SYSTEM_FORM_STORAGE_MENU_ID = 'system-form-storage';
export const SYSTEM_APPROVAL_RULES_MENU_ID = 'system-approval-rules';
export const SYSTEM_TODO_FIELDS_MENU_ID = 'system-todo-fields';
export const SYSTEM_SLA_CONFIG_MENU_ID = 'system-sla-config';
export const SYSTEM_RUNTIME_MONITOR_MENU_ID = 'system-runtime-monitor';
export const SYSTEM_SETTINGS_COMMAND_CENTER_MENU_ID = 'system-settings-command-center';

export const SYSTEM_INTERFACES_MODULE = {
  menuId: SYSTEM_INTERFACES_MENU_ID,
  label: '接口管理',
  navGroup: '集成配置',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-interfaces',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-interfaces',
  permissionMeta: {
    viewPermissions: ['system:integration:query'],
    actionPermissions: {
      create: ['system:integration:edit'],
      edit: ['system:integration:edit'],
      delete: ['system:integration:delete'],
      test: ['system:integration:test'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_FIELD_MAPPING_MODULE = {
  menuId: SYSTEM_FIELD_MAPPING_MENU_ID,
  label: '字段映射',
  navGroup: '集成配置',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-field-mapping',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-field-mapping',
  permissionMeta: {
    viewPermissions: ['system:integration:query'],
    actionPermissions: {
      create: ['system:integration:edit'],
      edit: ['system:integration:edit'],
      delete: ['system:integration:delete'],
      preview: ['system:integration:test'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_SYNC_RULES_MODULE = {
  menuId: SYSTEM_SYNC_RULES_MENU_ID,
  label: '同步规则',
  navGroup: '集成配置',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-sync-rules',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-sync-rules',
  permissionMeta: {
    viewPermissions: ['system:integration:query'],
    actionPermissions: {
      create: ['system:integration:edit'],
      edit: ['system:integration:edit'],
      delete: ['system:integration:delete'],
      dryRun: ['system:integration:test'],
      retryLog: ['system:integration:edit'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_WEBHOOK_CONFIG_MODULE = {
  menuId: SYSTEM_WEBHOOK_CONFIG_MENU_ID,
  label: 'Webhook 配置',
  navGroup: '集成配置',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-webhook-config',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-webhook-config',
  permissionMeta: {
    viewPermissions: ['system:integration:query'],
    actionPermissions: {
      create: ['system:integration:edit'],
      edit: ['system:integration:edit'],
      delete: ['system:integration:delete'],
      test: ['system:integration:test'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_EXTERNAL_SYSTEMS_MODULE = {
  menuId: SYSTEM_EXTERNAL_SYSTEMS_MENU_ID,
  label: '外部系统',
  navGroup: '集成配置',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-external-systems',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-external-systems',
  permissionMeta: {
    viewPermissions: ['system:integration:query'],
    actionPermissions: {
      create: ['system:integration:edit'],
      edit: ['system:integration:edit'],
      enable: ['system:integration:edit'],
      disable: ['system:integration:edit'],
      test: ['system:integration:test'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_BASE_PARAMS_MODULE = {
  menuId: SYSTEM_BASE_PARAMS_MENU_ID,
  label: '基础参数',
  navGroup: '系统参数',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-base-params',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-base-params',
  permissionMeta: {
    viewPermissions: ['system:config:query'],
    actionPermissions: {
      create: ['system:config:edit'],
      edit: ['system:config:edit'],
      delete: ['system:config:delete'],
      preview: ['system:config:preview'],
      refresh: ['system:config:refresh'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_SECURITY_POLICY_MODULE = {
  menuId: SYSTEM_SECURITY_POLICY_MENU_ID,
  label: '安全策略',
  navGroup: '系统参数',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-security-policy',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-security-policy',
  permissionMeta: {
    viewPermissions: ['system:config:query'],
    actionPermissions: {
      edit: ['system:config:edit'],
      preview: ['system:config:preview'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_AUDIT_LOG_MODULE = {
  menuId: SYSTEM_AUDIT_LOG_MENU_ID,
  label: '审计日志',
  navGroup: '系统参数',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-audit-log',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-audit-log',
  permissionMeta: {
    viewPermissions: ['system:audit-log:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_MAIL_GATEWAY_MODULE = {
  menuId: SYSTEM_MAIL_GATEWAY_MENU_ID,
  label: '邮件网关配置',
  navGroup: '消息与通知',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-mail-gateway',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-mail-gateway',
  permissionMeta: {
    viewPermissions: ['system:mail-gateway:query', 'system:mail-gateway:read', 'system:mail-gateway:meta'],
    actionPermissions: {
      preview: ['system:mail-gateway:preview'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_MAIL_TEMPLATES_MODULE = {
  menuId: SYSTEM_MAIL_TEMPLATES_MENU_ID,
  label: '邮件模板',
  navGroup: '消息与通知',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-mail-templates',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-mail-templates',
  permissionMeta: {
    viewPermissions: ['system:mail-template:query'],
    actionPermissions: {
      preview: ['system:mail-template:query'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_MAIL_LOGS_MODULE = {
  menuId: SYSTEM_MAIL_LOGS_MENU_ID,
  label: '邮件日志',
  navGroup: '消息与通知',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-mail-logs',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-mail-logs',
  permissionMeta: {
    viewPermissions: ['system:mail-log:query', 'system:mail-log:read', 'system:mail-log:meta'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_NOTIFICATION_TEMPLATES_MODULE = {
  menuId: SYSTEM_NOTIFICATION_TEMPLATES_MENU_ID,
  label: '通知模板',
  navGroup: '消息与通知',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-notification-templates',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-notification-templates',
  permissionMeta: {
    viewPermissions: ['system:notification-template:query'],
    actionPermissions: {
      preview: ['system:notification-template:query'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_NOTIFICATION_CHANNELS_MODULE = {
  menuId: SYSTEM_NOTIFICATION_CHANNELS_MENU_ID,
  label: '通知渠道',
  navGroup: '消息与通知',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-notification-channels',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-notification-channels',
  permissionMeta: {
    viewPermissions: ['system:notification-channel:query', 'system:notification-channel:read'],
    actionPermissions: {
      preview: ['system:notification-channel:preview'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_NOTIFICATION_PREFERENCES_MODULE = {
  menuId: SYSTEM_NOTIFICATION_PREFERENCES_MENU_ID,
  label: '通知偏好',
  navGroup: '消息与通知',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-notification-preferences',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-notification-preferences',
  permissionMeta: {
    viewPermissions: ['system:notification-preference:query', 'system:notification-preference:read'],
    actionPermissions: {
      preview: ['system:notification-preference:preview'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_WORKFLOW_NOTIFICATION_SWITCH_MODULE = {
  menuId: SYSTEM_WORKFLOW_NOTIFICATION_SWITCH_MENU_ID,
  label: '流程通知开关',
  navGroup: '消息与通知',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-workflow-notification-switch',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-workflow-notification-switch',
  permissionMeta: {
    viewPermissions: ['system:notification-switch:query', 'system:notification-switch:read'],
    actionPermissions: {
      preview: ['system:notification-switch:preview'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_CACHE_MANAGEMENT_MODULE = {
  menuId: SYSTEM_CACHE_MANAGEMENT_MENU_ID,
  label: '缓存管理',
  navGroup: '系统参数',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-cache-management',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-cache-management',
  permissionMeta: {
    viewPermissions: ['system:cache:query'],
    actionPermissions: {
      refresh: ['system:cache:refresh'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_FILE_STORAGE_MODULE = {
  menuId: SYSTEM_FILE_STORAGE_MENU_ID,
  label: '文件存储',
  navGroup: '系统参数',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-file-storage',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-file-storage',
  permissionMeta: {
    viewPermissions: ['system:file-storage:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_ASSET_CATEGORY_MODULE = {
  menuId: SYSTEM_ASSET_CATEGORY_MENU_ID,
  label: '资产分类',
  navGroup: '基础资料',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-asset-category',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-asset-category',
  permissionMeta: {
    viewPermissions: ['asset:category:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_NUMBERING_RULES_MODULE = {
  menuId: SYSTEM_NUMBERING_RULES_MENU_ID,
  label: '编号规则',
  navGroup: '基础资料',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-numbering-rules',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-numbering-rules',
  permissionMeta: {
    viewPermissions: ['system:numbering-rule:query', 'system:numbering-rule:read'],
    actionPermissions: {
      preview: ['system:numbering-rule:preview'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_CUSTOM_FIELDS_MODULE = {
  menuId: SYSTEM_CUSTOM_FIELDS_MENU_ID,
  label: '自定义字段',
  navGroup: '基础资料',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-custom-fields',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-custom-fields',
  permissionMeta: {
    viewPermissions: ['system:custom-field:query'],
    actionPermissions: {
      preview: ['system:custom-field:query'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_CUSTOM_FIELD_SETS_MODULE = {
  menuId: SYSTEM_CUSTOM_FIELD_SETS_MENU_ID,
  label: '字段集',
  navGroup: '基础资料',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-custom-field-sets',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-custom-field-sets',
  permissionMeta: {
    viewPermissions: ['system:custom-fieldset:query', 'system:custom-fieldset:read'],
    actionPermissions: {
      preview: ['system:custom-fieldset:preview'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_VENDOR_MANAGEMENT_MODULE = {
  menuId: SYSTEM_VENDOR_MANAGEMENT_MENU_ID,
  label: '供应商管理',
  navGroup: '基础资料',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-vendor-management',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-vendor-management',
  permissionMeta: {
    viewPermissions: ['vendor:vendor:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_LOCATION_MANAGEMENT_MODULE = {
  menuId: SYSTEM_LOCATION_MANAGEMENT_MENU_ID,
  label: '位置管理',
  navGroup: '基础资料',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-location-management',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-location-management',
  permissionMeta: {
    viewPermissions: ['location:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_USER_MANAGEMENT_MODULE = {
  menuId: SYSTEM_USER_MANAGEMENT_MENU_ID,
  label: '用户管理',
  navGroup: '组织权限',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-user-management',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-user-management',
  permissionMeta: {
    viewPermissions: ['system:user:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_DEPT_ORG_MODULE = {
  menuId: SYSTEM_DEPT_ORG_MENU_ID,
  label: '部门组织',
  navGroup: '组织权限',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-dept-org',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-dept-org',
  permissionMeta: {
    viewPermissions: ['system:dept:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_ROLE_PERMISSIONS_MODULE = {
  menuId: SYSTEM_ROLE_PERMISSIONS_MENU_ID,
  label: '角色权限',
  navGroup: '组织权限',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-role-permissions',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-role-permissions',
  permissionMeta: {
    viewPermissions: ['system:role-permission:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_MENU_PERMISSIONS_MODULE = {
  menuId: SYSTEM_MENU_PERMISSIONS_MENU_ID,
  label: '菜单权限',
  navGroup: '组织权限',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-menu-permissions',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-menu-permissions',
  permissionMeta: {
    viewPermissions: ['system:role-permission:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_POST_MANAGEMENT_MODULE = {
  menuId: SYSTEM_POST_MANAGEMENT_MENU_ID,
  label: '岗位管理',
  navGroup: '组织权限',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-post-management',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-post-management',
  permissionMeta: {
    viewPermissions: ['system:post:query', 'system:post:read', 'system:post:meta'],
    actionPermissions: {
      preview: ['system:post:preview'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_TENANT_MANAGEMENT_MODULE = {
  menuId: SYSTEM_TENANT_MANAGEMENT_MENU_ID,
  label: '租户管理',
  navGroup: '组织权限',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-tenant-management',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-tenant-management',
  permissionMeta: {
    viewPermissions: ['system:tenant:query', 'system:tenant:read', 'system:tenant:meta'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_DATA_PERMISSIONS_MODULE = {
  menuId: SYSTEM_DATA_PERMISSIONS_MENU_ID,
  label: '数据权限',
  navGroup: '组织权限',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-data-permissions',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-data-permissions',
  permissionMeta: {
    viewPermissions: ['system:role-permission:query'],
    actionPermissions: {
      edit: ['system:role-permission:edit'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_IMPORT_EXPORT_MODULE = {
  menuId: SYSTEM_IMPORT_EXPORT_MENU_ID,
  label: '导入导出',
  navGroup: '系统参数',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-import-export',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-import-export',
  permissionMeta: {
    viewPermissions: ['system:import-export:query', 'system:import-export:read'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_HANDOVER_MODULE = {
  menuId: SYSTEM_HANDOVER_MENU_ID,
  label: '交接管理',
  navGroup: '组织权限',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-handover',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-handover',
  permissionMeta: {
    viewPermissions: ['system:handover:query', 'system:handover:read'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_WORKFLOW_MAIL_MODULE = {
  menuId: SYSTEM_WORKFLOW_MAIL_MENU_ID,
  label: '流程邮件',
  navGroup: '消息与通知',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-workflow-mail',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-workflow-mail',
  permissionMeta: {
    viewPermissions: ['mail:workflow:query', 'mail:workflow:read'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_DOC_CENTER_MODULE = {
  menuId: SYSTEM_DOC_CENTER_MENU_ID,
  label: '文档中心',
  navGroup: '系统参数',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-doc-center',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-doc-center',
  permissionMeta: {
    viewPermissions: ['system:doc-center:query', 'system:doc-center:read'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_TECH_SUPPORT_MODULE = {
  menuId: SYSTEM_TECH_SUPPORT_MENU_ID,
  label: '技术支持',
  navGroup: '系统参数',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-tech-support',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-tech-support',
  permissionMeta: {
    viewPermissions: ['system:tech-support:query', 'system:tech-support:read'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_FLOW_DEFINITION_MODULE = {
  menuId: SYSTEM_FLOW_DEFINITION_MENU_ID,
  label: '流程定义',
  navGroup: '流程平台',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-flow-definition',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-flow-definition',
  permissionMeta: {
    viewPermissions: ['system:flow:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_FLOW_DESIGNER_MODULE = {
  menuId: SYSTEM_FLOW_DESIGNER_MENU_ID,
  label: '流程设计器',
  navGroup: '流程平台',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-flow-designer',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-flow-designer',
  permissionMeta: {
    viewPermissions: ['system:flow:query'],
    actionPermissions: {
      edit: ['workflow:designer:edit'],
      preview: ['workflow:designer:edit'],
      publish: ['workflow:designer:publish'],
      rollback: ['workflow:designer:rollback'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_FORM_CONFIG_MODULE = {
  menuId: SYSTEM_FORM_CONFIG_MENU_ID,
  label: '表单配置',
  navGroup: '流程平台',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-form-config',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-form-config',
  permissionMeta: {
    viewPermissions: ['workflow:form:list', 'workflow:form:view'],
    actionPermissions: {
      edit: ['workflow:form:update'],
      preview: ['workflow:form:update'],
      publish: ['workflow:form:publish'],
      disable: ['workflow:form:disable'],
      rollback: ['workflow:form:rollback'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_FORM_STORAGE_MODULE = {
  menuId: SYSTEM_FORM_STORAGE_MENU_ID,
  label: '表单存储',
  navGroup: '流程平台',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-form-storage',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-form-storage',
  permissionMeta: {
    viewPermissions: ['workflow:form-storage:view'],
    actionPermissions: {
      create: ['workflow:form-storage:create'],
      edit: ['workflow:form-storage:update'],
      archive: ['workflow:form-storage:archive'],
      delete: ['workflow:form-storage:delete'],
      export: ['workflow:form-storage:export'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_APPROVAL_RULES_MODULE = {
  menuId: SYSTEM_APPROVAL_RULES_MENU_ID,
  label: '审批规则',
  navGroup: '流程平台',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-approval-rules',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-approval-rules',
  permissionMeta: {
    viewPermissions: ['workflow:approval-rule:list'],
    actionPermissions: {
      create: ['workflow:approval-rule:create'],
      edit: ['workflow:approval-rule:update'],
      enable: ['workflow:approval-rule:enable'],
      disable: ['workflow:approval-rule:disable'],
      test: ['workflow:approval-rule:test'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_TODO_FIELDS_MODULE = {
  menuId: SYSTEM_TODO_FIELDS_MENU_ID,
  label: '待办字段配置',
  navGroup: '流程平台',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-todo-fields',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-todo-fields',
  permissionMeta: {
    viewPermissions: ['workflow:todo-field:list'],
    actionPermissions: {
      edit: ['workflow:todo-field:update'],
      sort: ['workflow:todo-field:update'],
      reset: ['workflow:todo-field:reset'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_SLA_CONFIG_MODULE = {
  menuId: SYSTEM_SLA_CONFIG_MENU_ID,
  label: 'SLA 配置',
  navGroup: '流程平台',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-sla-config',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-sla-config',
  permissionMeta: {
    viewPermissions: ['workflow:sla:list'],
    actionPermissions: {
      edit: ['workflow:sla:update'],
      enable: ['workflow:sla:enable'],
      disable: ['workflow:sla:disable'],
      test: ['workflow:sla:test'],
      export: ['workflow:sla:export'],
    },
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_RUNTIME_MONITOR_MODULE = {
  menuId: SYSTEM_RUNTIME_MONITOR_MENU_ID,
  label: '运行监控',
  navGroup: '流程平台',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-runtime-monitor',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-runtime-monitor',
  permissionMeta: {
    viewPermissions: ['system:runtime:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const SYSTEM_SETTINGS_COMMAND_CENTER_MODULE = {
  menuId: SYSTEM_SETTINGS_COMMAND_CENTER_MENU_ID,
  label: '流程控制台',
  navGroup: '流程平台',
  workbenchPath: '/fixed-assets/workbenchv3?menu=system-settings-command-center',
  legacyRoute: '/fixed-assets/workbenchv3?menu=system-settings-command-center',
  permissionMeta: {
    viewPermissions: ['system:flow:query', 'system:runtime:query'],
    actionPermissions: {},
  },
} as const satisfies SystemModuleRegistryItem;

export const systemModuleRegistry = [
  SYSTEM_INTERFACES_MODULE,
  SYSTEM_FIELD_MAPPING_MODULE,
  SYSTEM_SYNC_RULES_MODULE,
  SYSTEM_WEBHOOK_CONFIG_MODULE,
  SYSTEM_EXTERNAL_SYSTEMS_MODULE,
  SYSTEM_BASE_PARAMS_MODULE,
  SYSTEM_SECURITY_POLICY_MODULE,
  SYSTEM_AUDIT_LOG_MODULE,
  SYSTEM_MAIL_GATEWAY_MODULE,
  SYSTEM_MAIL_TEMPLATES_MODULE,
  SYSTEM_MAIL_LOGS_MODULE,
  SYSTEM_NOTIFICATION_TEMPLATES_MODULE,
  SYSTEM_NOTIFICATION_CHANNELS_MODULE,
  SYSTEM_NOTIFICATION_PREFERENCES_MODULE,
  SYSTEM_WORKFLOW_NOTIFICATION_SWITCH_MODULE,
  SYSTEM_CACHE_MANAGEMENT_MODULE,
  SYSTEM_FILE_STORAGE_MODULE,
  SYSTEM_ASSET_CATEGORY_MODULE,
  SYSTEM_NUMBERING_RULES_MODULE,
  SYSTEM_CUSTOM_FIELDS_MODULE,
  SYSTEM_CUSTOM_FIELD_SETS_MODULE,
  SYSTEM_VENDOR_MANAGEMENT_MODULE,
  SYSTEM_LOCATION_MANAGEMENT_MODULE,
  SYSTEM_USER_MANAGEMENT_MODULE,
  SYSTEM_DEPT_ORG_MODULE,
  SYSTEM_ROLE_PERMISSIONS_MODULE,
  SYSTEM_MENU_PERMISSIONS_MODULE,
  SYSTEM_POST_MANAGEMENT_MODULE,
  SYSTEM_TENANT_MANAGEMENT_MODULE,
  SYSTEM_DATA_PERMISSIONS_MODULE,
  SYSTEM_IMPORT_EXPORT_MODULE,
  SYSTEM_HANDOVER_MODULE,
  SYSTEM_WORKFLOW_MAIL_MODULE,
  SYSTEM_DOC_CENTER_MODULE,
  SYSTEM_TECH_SUPPORT_MODULE,
  SYSTEM_FLOW_DEFINITION_MODULE,
  SYSTEM_FLOW_DESIGNER_MODULE,
  SYSTEM_FORM_CONFIG_MODULE,
  SYSTEM_FORM_STORAGE_MODULE,
  SYSTEM_APPROVAL_RULES_MODULE,
  SYSTEM_TODO_FIELDS_MODULE,
  SYSTEM_SLA_CONFIG_MODULE,
  SYSTEM_RUNTIME_MONITOR_MODULE,
  SYSTEM_SETTINGS_COMMAND_CENTER_MODULE,
] as const satisfies readonly SystemModuleRegistryItem[];

const systemModuleByMenuId = new Map<string, SystemModuleRegistryItem>(
  systemModuleRegistry.map((module) => [module.menuId, module]),
);

export function getSystemModuleByMenuId(menuId: string | null | undefined): SystemModuleRegistryItem | undefined {
  return menuId ? systemModuleByMenuId.get(menuId) : undefined;
}

export function getSystemModuleActionPermissions(
  menuId: string | null | undefined,
  action: SystemModuleActionKey,
): readonly string[] {
  return getSystemModuleByMenuId(menuId)?.permissionMeta.actionPermissions[action] ?? [];
}
