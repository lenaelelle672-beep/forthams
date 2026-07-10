import { describe, expect, it } from 'vitest';
import {
  SYSTEM_ASSET_CATEGORY_MENU_ID,
  SYSTEM_ASSET_CATEGORY_MODULE,
  SYSTEM_APPROVAL_RULES_MENU_ID,
  SYSTEM_APPROVAL_RULES_MODULE,
  SYSTEM_AUDIT_LOG_MENU_ID,
  SYSTEM_AUDIT_LOG_MODULE,
  SYSTEM_BASE_PARAMS_MENU_ID,
  SYSTEM_BASE_PARAMS_MODULE,
  SYSTEM_CACHE_MANAGEMENT_MENU_ID,
  SYSTEM_CACHE_MANAGEMENT_MODULE,
  SYSTEM_CUSTOM_FIELDS_MENU_ID,
  SYSTEM_CUSTOM_FIELDS_MODULE,
  SYSTEM_CUSTOM_FIELD_SETS_MENU_ID,
  SYSTEM_CUSTOM_FIELD_SETS_MODULE,
  SYSTEM_DEPT_ORG_MENU_ID,
  SYSTEM_DEPT_ORG_MODULE,
  SYSTEM_EXTERNAL_SYSTEMS_MENU_ID,
  SYSTEM_EXTERNAL_SYSTEMS_MODULE,
  SYSTEM_FILE_STORAGE_MENU_ID,
  SYSTEM_FILE_STORAGE_MODULE,
  SYSTEM_FLOW_DEFINITION_MENU_ID,
  SYSTEM_FLOW_DEFINITION_MODULE,
  SYSTEM_FLOW_DESIGNER_MENU_ID,
  SYSTEM_FLOW_DESIGNER_MODULE,
  SYSTEM_FORM_CONFIG_MENU_ID,
  SYSTEM_FORM_CONFIG_MODULE,
  SYSTEM_FORM_STORAGE_MENU_ID,
  SYSTEM_FORM_STORAGE_MODULE,
  SYSTEM_LOCATION_MANAGEMENT_MENU_ID,
  SYSTEM_LOCATION_MANAGEMENT_MODULE,
  SYSTEM_NUMBERING_RULES_MENU_ID,
  SYSTEM_NUMBERING_RULES_MODULE,
  SYSTEM_MAIL_GATEWAY_MENU_ID,
  SYSTEM_MAIL_GATEWAY_MODULE,
  SYSTEM_MAIL_LOGS_MENU_ID,
  SYSTEM_MAIL_LOGS_MODULE,
  SYSTEM_MAIL_TEMPLATES_MENU_ID,
  SYSTEM_MAIL_TEMPLATES_MODULE,
  SYSTEM_NOTIFICATION_TEMPLATES_MENU_ID,
  SYSTEM_NOTIFICATION_TEMPLATES_MODULE,
  SYSTEM_NOTIFICATION_CHANNELS_MENU_ID,
  SYSTEM_NOTIFICATION_CHANNELS_MODULE,
  SYSTEM_NOTIFICATION_PREFERENCES_MENU_ID,
  SYSTEM_NOTIFICATION_PREFERENCES_MODULE,
  SYSTEM_WORKFLOW_NOTIFICATION_SWITCH_MENU_ID,
  SYSTEM_WORKFLOW_NOTIFICATION_SWITCH_MODULE,
  SYSTEM_RUNTIME_MONITOR_MENU_ID,
  SYSTEM_RUNTIME_MONITOR_MODULE,
  SYSTEM_MENU_PERMISSIONS_MENU_ID,
  SYSTEM_MENU_PERMISSIONS_MODULE,
  SYSTEM_POST_MANAGEMENT_MENU_ID,
  SYSTEM_POST_MANAGEMENT_MODULE,
  SYSTEM_ROLE_PERMISSIONS_MENU_ID,
  SYSTEM_ROLE_PERMISSIONS_MODULE,
  SYSTEM_SECURITY_POLICY_MENU_ID,
  SYSTEM_SECURITY_POLICY_MODULE,
  SYSTEM_SETTINGS_COMMAND_CENTER_MENU_ID,
  SYSTEM_SETTINGS_COMMAND_CENTER_MODULE,
  SYSTEM_SLA_CONFIG_MENU_ID,
  SYSTEM_SLA_CONFIG_MODULE,
  SYSTEM_TODO_FIELDS_MENU_ID,
  SYSTEM_TODO_FIELDS_MODULE,
  SYSTEM_USER_MANAGEMENT_MENU_ID,
  SYSTEM_USER_MANAGEMENT_MODULE,
  SYSTEM_VENDOR_MANAGEMENT_MENU_ID,
  SYSTEM_VENDOR_MANAGEMENT_MODULE,
  SYSTEM_WEBHOOK_CONFIG_MENU_ID,
  SYSTEM_WEBHOOK_CONFIG_MODULE,
  getSystemModuleActionPermissions,
  getSystemModuleByMenuId,
  systemModuleRegistry,
} from '../pages/workspace-preview/system-hub/systemModuleRegistry';

describe('systemModuleRegistry 菜单权限合同', () => {
  it('新增 system-data-permissions 后为四十二个真实 V3 模块，仍非 44 项全量', () => {
    expect(systemModuleRegistry.map((module) => module.menuId)).toEqual([
      'system-interfaces',
      'system-field-mapping',
      'system-sync-rules',
      'system-webhook-config',
      'system-external-systems',
      'system-base-params',
      'system-security-policy',
      'system-audit-log',
      'system-mail-gateway',
      'system-mail-templates',
      'system-mail-logs',
      'system-notification-templates',
      'system-notification-channels',
      'system-notification-preferences',
      'system-workflow-notification-switch',
      'system-cache-management',
      'system-file-storage',
      'system-asset-category',
      'system-numbering-rules',
      'system-custom-fields',
      'system-custom-field-sets',
      'system-vendor-management',
      'system-location-management',
      'system-user-management',
      'system-dept-org',
      'system-role-permissions',
      'system-menu-permissions',
      'system-post-management',
      'system-tenant-management',
      'system-data-permissions',
      'system-import-export',
      'system-handover',
      'system-workflow-mail',
      'system-flow-definition',
      'system-flow-designer',
      'system-form-config',
      'system-form-storage',
      'system-approval-rules',
      'system-todo-fields',
      'system-sla-config',
      'system-runtime-monitor',
      'system-settings-command-center',
    ]);
    expect(systemModuleRegistry).toHaveLength(42);
    expect(systemModuleRegistry).not.toHaveLength(44);
    expect(SYSTEM_WEBHOOK_CONFIG_MENU_ID).toBe('system-webhook-config');
    expect(getSystemModuleByMenuId('system-webhook-config')).toBe(SYSTEM_WEBHOOK_CONFIG_MODULE);
    expect(SYSTEM_EXTERNAL_SYSTEMS_MENU_ID).toBe('system-external-systems');
    expect(getSystemModuleByMenuId('system-external-systems')).toBe(SYSTEM_EXTERNAL_SYSTEMS_MODULE);
    expect(SYSTEM_BASE_PARAMS_MENU_ID).toBe('system-base-params');
    expect(getSystemModuleByMenuId('system-base-params')).toBe(SYSTEM_BASE_PARAMS_MODULE);
    expect(SYSTEM_SECURITY_POLICY_MENU_ID).toBe('system-security-policy');
    expect(getSystemModuleByMenuId('system-security-policy')).toBe(SYSTEM_SECURITY_POLICY_MODULE);
    expect(SYSTEM_AUDIT_LOG_MENU_ID).toBe('system-audit-log');
    expect(getSystemModuleByMenuId('system-audit-log')).toBe(SYSTEM_AUDIT_LOG_MODULE);
    expect(SYSTEM_MAIL_GATEWAY_MENU_ID).toBe('system-mail-gateway');
    expect(getSystemModuleByMenuId('system-mail-gateway')).toBe(SYSTEM_MAIL_GATEWAY_MODULE);
    expect(SYSTEM_MAIL_TEMPLATES_MENU_ID).toBe('system-mail-templates');
    expect(getSystemModuleByMenuId('system-mail-templates')).toBe(SYSTEM_MAIL_TEMPLATES_MODULE);
    expect(SYSTEM_MAIL_LOGS_MENU_ID).toBe('system-mail-logs');
    expect(getSystemModuleByMenuId('system-mail-logs')).toBe(SYSTEM_MAIL_LOGS_MODULE);
    expect(SYSTEM_NOTIFICATION_TEMPLATES_MENU_ID).toBe('system-notification-templates');
    expect(getSystemModuleByMenuId('system-notification-templates')).toBe(SYSTEM_NOTIFICATION_TEMPLATES_MODULE);
    expect(SYSTEM_NOTIFICATION_CHANNELS_MENU_ID).toBe('system-notification-channels');
    expect(getSystemModuleByMenuId('system-notification-channels')).toBe(SYSTEM_NOTIFICATION_CHANNELS_MODULE);
    expect(SYSTEM_NOTIFICATION_PREFERENCES_MENU_ID).toBe('system-notification-preferences');
    expect(getSystemModuleByMenuId('system-notification-preferences')).toBe(SYSTEM_NOTIFICATION_PREFERENCES_MODULE);
    expect(SYSTEM_WORKFLOW_NOTIFICATION_SWITCH_MENU_ID).toBe('system-workflow-notification-switch');
    expect(getSystemModuleByMenuId('system-workflow-notification-switch')).toBe(SYSTEM_WORKFLOW_NOTIFICATION_SWITCH_MODULE);
    expect(SYSTEM_CACHE_MANAGEMENT_MENU_ID).toBe('system-cache-management');
    expect(getSystemModuleByMenuId('system-cache-management')).toBe(SYSTEM_CACHE_MANAGEMENT_MODULE);
    expect(SYSTEM_FILE_STORAGE_MENU_ID).toBe('system-file-storage');
    expect(getSystemModuleByMenuId('system-file-storage')).toBe(SYSTEM_FILE_STORAGE_MODULE);
    expect(SYSTEM_ASSET_CATEGORY_MENU_ID).toBe('system-asset-category');
    expect(getSystemModuleByMenuId('system-asset-category')).toBe(SYSTEM_ASSET_CATEGORY_MODULE);
    expect(SYSTEM_NUMBERING_RULES_MENU_ID).toBe('system-numbering-rules');
    expect(getSystemModuleByMenuId('system-numbering-rules')).toBe(SYSTEM_NUMBERING_RULES_MODULE);
    expect(SYSTEM_CUSTOM_FIELDS_MENU_ID).toBe('system-custom-fields');
    expect(getSystemModuleByMenuId('system-custom-fields')).toBe(SYSTEM_CUSTOM_FIELDS_MODULE);
    expect(SYSTEM_CUSTOM_FIELD_SETS_MENU_ID).toBe('system-custom-field-sets');
    expect(getSystemModuleByMenuId('system-custom-field-sets')).toBe(SYSTEM_CUSTOM_FIELD_SETS_MODULE);
    expect(SYSTEM_VENDOR_MANAGEMENT_MENU_ID).toBe('system-vendor-management');
    expect(getSystemModuleByMenuId('system-vendor-management')).toBe(SYSTEM_VENDOR_MANAGEMENT_MODULE);
    expect(SYSTEM_LOCATION_MANAGEMENT_MENU_ID).toBe('system-location-management');
    expect(getSystemModuleByMenuId('system-location-management')).toBe(SYSTEM_LOCATION_MANAGEMENT_MODULE);
    expect(SYSTEM_USER_MANAGEMENT_MENU_ID).toBe('system-user-management');
    expect(getSystemModuleByMenuId('system-user-management')).toBe(SYSTEM_USER_MANAGEMENT_MODULE);
    expect(SYSTEM_DEPT_ORG_MENU_ID).toBe('system-dept-org');
    expect(getSystemModuleByMenuId('system-dept-org')).toBe(SYSTEM_DEPT_ORG_MODULE);
    expect(SYSTEM_ROLE_PERMISSIONS_MENU_ID).toBe('system-role-permissions');
    expect(getSystemModuleByMenuId('system-role-permissions')).toBe(SYSTEM_ROLE_PERMISSIONS_MODULE);
    expect(SYSTEM_MENU_PERMISSIONS_MENU_ID).toBe('system-menu-permissions');
    expect(getSystemModuleByMenuId('system-menu-permissions')).toBe(SYSTEM_MENU_PERMISSIONS_MODULE);
    expect(SYSTEM_POST_MANAGEMENT_MENU_ID).toBe('system-post-management');
    expect(getSystemModuleByMenuId('system-post-management')).toBe(SYSTEM_POST_MANAGEMENT_MODULE);
    expect(SYSTEM_FLOW_DEFINITION_MENU_ID).toBe('system-flow-definition');
    expect(getSystemModuleByMenuId('system-flow-definition')).toBe(SYSTEM_FLOW_DEFINITION_MODULE);
    expect(SYSTEM_FLOW_DESIGNER_MENU_ID).toBe('system-flow-designer');
    expect(getSystemModuleByMenuId('system-flow-designer')).toBe(SYSTEM_FLOW_DESIGNER_MODULE);
    expect(SYSTEM_FORM_CONFIG_MENU_ID).toBe('system-form-config');
    expect(getSystemModuleByMenuId('system-form-config')).toBe(SYSTEM_FORM_CONFIG_MODULE);
    expect(SYSTEM_FORM_STORAGE_MENU_ID).toBe('system-form-storage');
    expect(getSystemModuleByMenuId('system-form-storage')).toBe(SYSTEM_FORM_STORAGE_MODULE);
    expect(SYSTEM_APPROVAL_RULES_MENU_ID).toBe('system-approval-rules');
    expect(getSystemModuleByMenuId('system-approval-rules')).toBe(SYSTEM_APPROVAL_RULES_MODULE);
    expect(SYSTEM_TODO_FIELDS_MENU_ID).toBe('system-todo-fields');
    expect(getSystemModuleByMenuId('system-todo-fields')).toBe(SYSTEM_TODO_FIELDS_MODULE);
    expect(SYSTEM_SLA_CONFIG_MENU_ID).toBe('system-sla-config');
    expect(getSystemModuleByMenuId('system-sla-config')).toBe(SYSTEM_SLA_CONFIG_MODULE);
    expect(SYSTEM_RUNTIME_MONITOR_MENU_ID).toBe('system-runtime-monitor');
    expect(getSystemModuleByMenuId('system-runtime-monitor')).toBe(SYSTEM_RUNTIME_MONITOR_MODULE);
    expect(SYSTEM_SETTINGS_COMMAND_CENTER_MENU_ID).toBe('system-settings-command-center');
    expect(getSystemModuleByMenuId('system-settings-command-center')).toBe(SYSTEM_SETTINGS_COMMAND_CENTER_MODULE);
  });

  it('基础资料、组织权限与流程平台 metadata 对齐查询、设计器编辑发布和回滚权限', () => {
    expect(SYSTEM_WEBHOOK_CONFIG_MODULE.permissionMeta.viewPermissions).toEqual(['system:integration:query']);
    expect(SYSTEM_WEBHOOK_CONFIG_MODULE.permissionMeta.actionPermissions).toEqual({
      create: ['system:integration:edit'],
      edit: ['system:integration:edit'],
      delete: ['system:integration:delete'],
      test: ['system:integration:test'],
    });
    expect(getSystemModuleActionPermissions('system-webhook-config', 'test')).toEqual(['system:integration:test']);
    expect(SYSTEM_EXTERNAL_SYSTEMS_MODULE.navGroup).toBe('集成配置');
    expect(SYSTEM_EXTERNAL_SYSTEMS_MODULE.permissionMeta.viewPermissions).toEqual(['system:integration:query']);
    expect(SYSTEM_EXTERNAL_SYSTEMS_MODULE.permissionMeta.actionPermissions).toEqual({
      create: ['system:integration:edit'],
      edit: ['system:integration:edit'],
      enable: ['system:integration:edit'],
      disable: ['system:integration:edit'],
      test: ['system:integration:test'],
    });
    expect(getSystemModuleActionPermissions('system-external-systems', 'enable')).toEqual(['system:integration:edit']);
    expect(getSystemModuleActionPermissions('system-external-systems', 'test')).toEqual(['system:integration:test']);
    expect(SYSTEM_BASE_PARAMS_MODULE.navGroup).toBe('系统参数');
    expect(SYSTEM_BASE_PARAMS_MODULE.permissionMeta.viewPermissions).toEqual(['system:config:query']);
    expect(SYSTEM_BASE_PARAMS_MODULE.permissionMeta.actionPermissions).toEqual({
      create: ['system:config:edit'],
      edit: ['system:config:edit'],
      delete: ['system:config:delete'],
      preview: ['system:config:preview'],
      refresh: ['system:config:refresh'],
    });
    expect(getSystemModuleActionPermissions('system-base-params', 'preview')).toEqual(['system:config:preview']);
    expect(getSystemModuleActionPermissions('system-base-params', 'refresh')).toEqual(['system:config:refresh']);
    expect(SYSTEM_SECURITY_POLICY_MODULE.navGroup).toBe('系统参数');
    expect(SYSTEM_SECURITY_POLICY_MODULE.permissionMeta.viewPermissions).toEqual(['system:config:query']);
    expect(SYSTEM_SECURITY_POLICY_MODULE.permissionMeta.actionPermissions).toEqual({
      edit: ['system:config:edit'],
      preview: ['system:config:preview'],
    });
    expect(getSystemModuleActionPermissions('system-security-policy', 'edit')).toEqual(['system:config:edit']);
    expect(getSystemModuleActionPermissions('system-security-policy', 'preview')).toEqual(['system:config:preview']);
    expect(SYSTEM_AUDIT_LOG_MODULE.navGroup).toBe('系统参数');
    expect(SYSTEM_AUDIT_LOG_MODULE.permissionMeta.viewPermissions).toEqual(['system:audit-log:query']);
    expect(SYSTEM_AUDIT_LOG_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-audit-log', 'export')).toEqual([]);
    expect(SYSTEM_MAIL_GATEWAY_MODULE.navGroup).toBe('消息与通知');
    expect(SYSTEM_MAIL_GATEWAY_MODULE.permissionMeta.viewPermissions).toEqual(['system:mail-gateway:query', 'system:mail-gateway:read', 'system:mail-gateway:meta']);
    expect(SYSTEM_MAIL_GATEWAY_MODULE.permissionMeta.actionPermissions).toEqual({
      preview: ['system:mail-gateway:preview'],
    });
    expect(getSystemModuleActionPermissions('system-mail-gateway', 'preview')).toEqual(['system:mail-gateway:preview']);
    expect(getSystemModuleActionPermissions('system-mail-gateway', 'edit')).toEqual([]);
    expect(getSystemModuleActionPermissions('system-mail-gateway', 'delete')).toEqual([]);
    expect(getSystemModuleActionPermissions('system-mail-gateway', 'test')).toEqual([]);
    expect(SYSTEM_MAIL_TEMPLATES_MODULE.navGroup).toBe('消息与通知');
    expect(SYSTEM_MAIL_TEMPLATES_MODULE.permissionMeta.viewPermissions).toEqual(['system:mail-template:query']);
    expect(SYSTEM_MAIL_TEMPLATES_MODULE.permissionMeta.actionPermissions).toEqual({
      preview: ['system:mail-template:query'],
    });
    expect(getSystemModuleActionPermissions('system-mail-templates', 'preview')).toEqual(['system:mail-template:query']);
    expect(getSystemModuleActionPermissions('system-mail-templates', 'edit')).toEqual([]);
    expect(SYSTEM_MAIL_LOGS_MODULE.navGroup).toBe('消息与通知');
    expect(SYSTEM_MAIL_LOGS_MODULE.permissionMeta.viewPermissions).toEqual(['system:mail-log:query', 'system:mail-log:read', 'system:mail-log:meta']);
    expect(SYSTEM_MAIL_LOGS_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-mail-logs', 'retryLog')).toEqual([]);
    expect(getSystemModuleActionPermissions('system-mail-logs', 'export')).toEqual([]);
    expect(SYSTEM_NOTIFICATION_TEMPLATES_MODULE.navGroup).toBe('消息与通知');
    expect(SYSTEM_NOTIFICATION_TEMPLATES_MODULE.permissionMeta.viewPermissions).toEqual(['system:notification-template:query']);
    expect(SYSTEM_NOTIFICATION_TEMPLATES_MODULE.permissionMeta.actionPermissions).toEqual({
      preview: ['system:notification-template:query'],
    });
    expect(getSystemModuleActionPermissions('system-notification-templates', 'preview')).toEqual(['system:notification-template:query']);
    expect(getSystemModuleActionPermissions('system-notification-templates', 'edit')).toEqual([]);
    expect(SYSTEM_NOTIFICATION_CHANNELS_MODULE.navGroup).toBe('消息与通知');
    expect(SYSTEM_NOTIFICATION_CHANNELS_MODULE.permissionMeta.viewPermissions).toEqual(['system:notification-channel:query', 'system:notification-channel:read']);
    expect(SYSTEM_NOTIFICATION_CHANNELS_MODULE.permissionMeta.actionPermissions).toEqual({
      preview: ['system:notification-channel:preview'],
    });
    expect(getSystemModuleActionPermissions('system-notification-channels', 'preview')).toEqual(['system:notification-channel:preview']);
    expect(getSystemModuleActionPermissions('system-notification-channels', 'edit')).toEqual([]);
    expect(getSystemModuleActionPermissions('system-notification-channels', 'delete')).toEqual([]);
    expect(getSystemModuleActionPermissions('system-notification-channels', 'test')).toEqual([]);
    expect(SYSTEM_NOTIFICATION_PREFERENCES_MODULE.navGroup).toBe('消息与通知');
    expect(SYSTEM_NOTIFICATION_PREFERENCES_MODULE.permissionMeta.viewPermissions).toEqual(['system:notification-preference:query', 'system:notification-preference:read']);
    expect(SYSTEM_NOTIFICATION_PREFERENCES_MODULE.permissionMeta.actionPermissions).toEqual({
      preview: ['system:notification-preference:preview'],
    });
    expect(getSystemModuleActionPermissions('system-notification-preferences', 'preview')).toEqual(['system:notification-preference:preview']);
    expect(getSystemModuleActionPermissions('system-notification-preferences', 'edit')).toEqual([]);
    expect(getSystemModuleActionPermissions('system-notification-preferences', 'delete')).toEqual([]);
    expect(SYSTEM_WORKFLOW_NOTIFICATION_SWITCH_MODULE.navGroup).toBe('消息与通知');
    expect(SYSTEM_WORKFLOW_NOTIFICATION_SWITCH_MODULE.permissionMeta.viewPermissions).toEqual(['system:notification-switch:query', 'system:notification-switch:read']);
    expect(SYSTEM_WORKFLOW_NOTIFICATION_SWITCH_MODULE.permissionMeta.actionPermissions).toEqual({
      preview: ['system:notification-switch:preview'],
    });
    expect(getSystemModuleActionPermissions('system-workflow-notification-switch', 'preview')).toEqual(['system:notification-switch:preview']);
    expect(getSystemModuleActionPermissions('system-workflow-notification-switch', 'edit')).toEqual([]);
    expect(getSystemModuleActionPermissions('system-workflow-notification-switch', 'delete')).toEqual([]);
    expect(getSystemModuleActionPermissions('system-workflow-notification-switch', 'enable')).toEqual([]);
    expect(getSystemModuleActionPermissions('system-workflow-notification-switch', 'disable')).toEqual([]);
    expect(SYSTEM_CACHE_MANAGEMENT_MODULE.permissionMeta.viewPermissions).toEqual(['system:cache:query']);
    expect(SYSTEM_CACHE_MANAGEMENT_MODULE.permissionMeta.actionPermissions).toEqual({
      refresh: ['system:cache:refresh'],
    });
    expect(getSystemModuleActionPermissions('system-cache-management', 'refresh')).toEqual(['system:cache:refresh']);
    expect(SYSTEM_FILE_STORAGE_MODULE.navGroup).toBe('系统参数');
    expect(SYSTEM_FILE_STORAGE_MODULE.permissionMeta.viewPermissions).toEqual(['system:file-storage:query']);
    expect(SYSTEM_FILE_STORAGE_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-file-storage', 'refresh')).toEqual([]);
    expect(SYSTEM_ASSET_CATEGORY_MODULE.navGroup).toBe('基础资料');
    expect(SYSTEM_ASSET_CATEGORY_MODULE.permissionMeta.viewPermissions).toEqual(['asset:category:query']);
    expect(SYSTEM_ASSET_CATEGORY_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-asset-category', 'refresh')).toEqual([]);
    expect(SYSTEM_NUMBERING_RULES_MODULE.navGroup).toBe('基础资料');
    expect(SYSTEM_NUMBERING_RULES_MODULE.permissionMeta.viewPermissions).toEqual(['system:numbering-rule:query', 'system:numbering-rule:read']);
    expect(SYSTEM_NUMBERING_RULES_MODULE.permissionMeta.actionPermissions).toEqual({
      preview: ['system:numbering-rule:preview'],
    });
    expect(getSystemModuleActionPermissions('system-numbering-rules', 'preview')).toEqual(['system:numbering-rule:preview']);
    expect(getSystemModuleActionPermissions('system-numbering-rules', 'edit')).toEqual([]);
    expect(getSystemModuleActionPermissions('system-numbering-rules', 'delete')).toEqual([]);
    expect(getSystemModuleActionPermissions('system-numbering-rules', 'refresh')).toEqual([]);
    expect(SYSTEM_CUSTOM_FIELDS_MODULE.navGroup).toBe('基础资料');
    expect(SYSTEM_CUSTOM_FIELDS_MODULE.permissionMeta.viewPermissions).toEqual(['system:custom-field:query']);
    expect(SYSTEM_CUSTOM_FIELDS_MODULE.permissionMeta.actionPermissions).toEqual({
      preview: ['system:custom-field:query'],
    });
    expect(getSystemModuleActionPermissions('system-custom-fields', 'preview')).toEqual(['system:custom-field:query']);
    expect(getSystemModuleActionPermissions('system-custom-fields', 'edit')).toEqual([]);
    expect(SYSTEM_CUSTOM_FIELD_SETS_MODULE.navGroup).toBe('基础资料');
    expect(SYSTEM_CUSTOM_FIELD_SETS_MODULE.permissionMeta.viewPermissions).toEqual(['system:custom-fieldset:query', 'system:custom-fieldset:read']);
    expect(SYSTEM_CUSTOM_FIELD_SETS_MODULE.permissionMeta.actionPermissions).toEqual({
      preview: ['system:custom-fieldset:preview'],
    });
    expect(getSystemModuleActionPermissions('system-custom-field-sets', 'preview')).toEqual(['system:custom-fieldset:preview']);
    expect(getSystemModuleActionPermissions('system-custom-field-sets', 'edit')).toEqual([]);
    expect(getSystemModuleActionPermissions('system-custom-field-sets', 'delete')).toEqual([]);
    expect(SYSTEM_VENDOR_MANAGEMENT_MODULE.navGroup).toBe('基础资料');
    expect(SYSTEM_VENDOR_MANAGEMENT_MODULE.permissionMeta.viewPermissions).toEqual(['vendor:vendor:query']);
    expect(SYSTEM_VENDOR_MANAGEMENT_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-vendor-management', 'refresh')).toEqual([]);
    expect(SYSTEM_LOCATION_MANAGEMENT_MODULE.navGroup).toBe('基础资料');
    expect(SYSTEM_LOCATION_MANAGEMENT_MODULE.permissionMeta.viewPermissions).toEqual(['location:query']);
    expect(SYSTEM_LOCATION_MANAGEMENT_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-location-management', 'refresh')).toEqual([]);
    expect(SYSTEM_USER_MANAGEMENT_MODULE.navGroup).toBe('组织权限');
    expect(SYSTEM_USER_MANAGEMENT_MODULE.permissionMeta.viewPermissions).toEqual(['system:user:query']);
    expect(SYSTEM_USER_MANAGEMENT_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-user-management', 'refresh')).toEqual([]);
    expect(SYSTEM_DEPT_ORG_MODULE.navGroup).toBe('组织权限');
    expect(SYSTEM_DEPT_ORG_MODULE.permissionMeta.viewPermissions).toEqual(['system:dept:query']);
    expect(SYSTEM_DEPT_ORG_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-dept-org', 'refresh')).toEqual([]);
    expect(SYSTEM_ROLE_PERMISSIONS_MODULE.navGroup).toBe('组织权限');
    expect(SYSTEM_ROLE_PERMISSIONS_MODULE.permissionMeta.viewPermissions).toEqual(['system:role-permission:query']);
    expect(SYSTEM_ROLE_PERMISSIONS_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-role-permissions', 'refresh')).toEqual([]);
    expect(SYSTEM_MENU_PERMISSIONS_MODULE.navGroup).toBe('组织权限');
    expect(SYSTEM_MENU_PERMISSIONS_MODULE.permissionMeta.viewPermissions).toEqual(['system:role-permission:query']);
    expect(SYSTEM_MENU_PERMISSIONS_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-menu-permissions', 'refresh')).toEqual([]);
    expect(SYSTEM_POST_MANAGEMENT_MODULE.navGroup).toBe('组织权限');
    expect(SYSTEM_POST_MANAGEMENT_MODULE.permissionMeta.viewPermissions).toEqual(['system:post:query', 'system:post:read', 'system:post:meta']);
    expect(SYSTEM_POST_MANAGEMENT_MODULE.permissionMeta.actionPermissions).toEqual({
      preview: ['system:post:preview'],
    });
    expect(getSystemModuleActionPermissions('system-post-management', 'preview')).toEqual(['system:post:preview']);
    expect(getSystemModuleActionPermissions('system-post-management', 'edit')).toEqual([]);
    expect(getSystemModuleActionPermissions('system-post-management', 'delete')).toEqual([]);
    expect(SYSTEM_FLOW_DEFINITION_MODULE.navGroup).toBe('流程平台');
    expect(SYSTEM_FLOW_DEFINITION_MODULE.permissionMeta.viewPermissions).toEqual(['system:flow:query']);
    expect(SYSTEM_FLOW_DEFINITION_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-flow-definition', 'refresh')).toEqual([]);
    expect(SYSTEM_FLOW_DESIGNER_MODULE.navGroup).toBe('流程平台');
    expect(SYSTEM_FLOW_DESIGNER_MODULE.permissionMeta.viewPermissions).toEqual(['system:flow:query']);
    expect(SYSTEM_FLOW_DESIGNER_MODULE.permissionMeta.actionPermissions).toEqual({
      edit: ['workflow:designer:edit'],
      preview: ['workflow:designer:edit'],
      publish: ['workflow:designer:publish'],
      rollback: ['workflow:designer:rollback'],
    });
    expect(getSystemModuleActionPermissions('system-flow-designer', 'publish')).toEqual(['workflow:designer:publish']);
    expect(getSystemModuleActionPermissions('system-flow-designer', 'rollback')).toEqual(['workflow:designer:rollback']);
    expect(SYSTEM_FORM_CONFIG_MODULE.navGroup).toBe('流程平台');
    expect(SYSTEM_FORM_CONFIG_MODULE.permissionMeta.viewPermissions).toEqual(['workflow:form:list', 'workflow:form:view']);
    expect(SYSTEM_FORM_CONFIG_MODULE.permissionMeta.actionPermissions).toEqual({
      edit: ['workflow:form:update'],
      preview: ['workflow:form:update'],
      publish: ['workflow:form:publish'],
      disable: ['workflow:form:disable'],
      rollback: ['workflow:form:rollback'],
    });
    expect(getSystemModuleActionPermissions('system-form-config', 'publish')).toEqual(['workflow:form:publish']);
    expect(getSystemModuleActionPermissions('system-form-config', 'disable')).toEqual(['workflow:form:disable']);
    expect(getSystemModuleActionPermissions('system-form-config', 'rollback')).toEqual(['workflow:form:rollback']);
    expect(SYSTEM_FORM_STORAGE_MODULE.navGroup).toBe('流程平台');
    expect(SYSTEM_FORM_STORAGE_MODULE.permissionMeta.viewPermissions).toEqual(['workflow:form-storage:view']);
    expect(SYSTEM_FORM_STORAGE_MODULE.permissionMeta.actionPermissions).toEqual({
      create: ['workflow:form-storage:create'],
      edit: ['workflow:form-storage:update'],
      archive: ['workflow:form-storage:archive'],
      delete: ['workflow:form-storage:delete'],
      export: ['workflow:form-storage:export'],
    });
    expect(getSystemModuleActionPermissions('system-form-storage', 'archive')).toEqual(['workflow:form-storage:archive']);
    expect(getSystemModuleActionPermissions('system-form-storage', 'export')).toEqual(['workflow:form-storage:export']);
    expect(SYSTEM_APPROVAL_RULES_MODULE.navGroup).toBe('流程平台');
    expect(SYSTEM_APPROVAL_RULES_MODULE.permissionMeta.viewPermissions).toEqual(['workflow:approval-rule:list']);
    expect(SYSTEM_APPROVAL_RULES_MODULE.permissionMeta.actionPermissions).toEqual({
      create: ['workflow:approval-rule:create'],
      edit: ['workflow:approval-rule:update'],
      enable: ['workflow:approval-rule:enable'],
      disable: ['workflow:approval-rule:disable'],
      test: ['workflow:approval-rule:test'],
    });
    expect(getSystemModuleActionPermissions('system-approval-rules', 'enable')).toEqual(['workflow:approval-rule:enable']);
    expect(getSystemModuleActionPermissions('system-approval-rules', 'test')).toEqual(['workflow:approval-rule:test']);
    expect(SYSTEM_TODO_FIELDS_MODULE.navGroup).toBe('流程平台');
    expect(SYSTEM_TODO_FIELDS_MODULE.permissionMeta.viewPermissions).toEqual(['workflow:todo-field:list']);
    expect(SYSTEM_TODO_FIELDS_MODULE.permissionMeta.actionPermissions).toEqual({
      edit: ['workflow:todo-field:update'],
      sort: ['workflow:todo-field:update'],
      reset: ['workflow:todo-field:reset'],
    });
    expect(getSystemModuleActionPermissions('system-todo-fields', 'sort')).toEqual(['workflow:todo-field:update']);
    expect(getSystemModuleActionPermissions('system-todo-fields', 'reset')).toEqual(['workflow:todo-field:reset']);
    expect(SYSTEM_SLA_CONFIG_MODULE.navGroup).toBe('流程平台');
    expect(SYSTEM_SLA_CONFIG_MODULE.permissionMeta.viewPermissions).toEqual(['workflow:sla:list']);
    expect(SYSTEM_SLA_CONFIG_MODULE.permissionMeta.actionPermissions).toEqual({
      edit: ['workflow:sla:update'],
      enable: ['workflow:sla:enable'],
      disable: ['workflow:sla:disable'],
      test: ['workflow:sla:test'],
      export: ['workflow:sla:export'],
    });
    expect(getSystemModuleActionPermissions('system-sla-config', 'enable')).toEqual(['workflow:sla:enable']);
    expect(getSystemModuleActionPermissions('system-sla-config', 'export')).toEqual(['workflow:sla:export']);
    expect(SYSTEM_RUNTIME_MONITOR_MODULE.navGroup).toBe('流程平台');
    expect(SYSTEM_RUNTIME_MONITOR_MODULE.permissionMeta.viewPermissions).toEqual(['system:runtime:query']);
    expect(SYSTEM_RUNTIME_MONITOR_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-runtime-monitor', 'refresh')).toEqual([]);
    expect(SYSTEM_SETTINGS_COMMAND_CENTER_MODULE.navGroup).toBe('流程平台');
    expect(SYSTEM_SETTINGS_COMMAND_CENTER_MODULE.permissionMeta.viewPermissions).toEqual(['system:flow:query', 'system:runtime:query']);
    expect(SYSTEM_SETTINGS_COMMAND_CENTER_MODULE.permissionMeta.actionPermissions).toEqual({});
    expect(getSystemModuleActionPermissions('system-settings-command-center', 'refresh')).toEqual([]);
  });
});
