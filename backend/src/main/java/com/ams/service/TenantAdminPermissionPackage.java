package com.ams.service;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 新租户首位管理员的受控业务权限包。
 *
 * <p>权限库存由版本化迁移登记；此目录只定义开通时允许绑定的最小、显式动作集合，
 * 不包含平台级或系统集成级权限。</p>
 */
public final class TenantAdminPermissionPackage {

    public static final String PACKAGE_CODE = "TENANT_ADMIN_BUSINESS_V2";

    private static final List<PermissionDefinition> DEFINITIONS = List.of(
            permission("资产查询", "asset:query"),
            permission("资产新建", "asset:create"),
            permission("资产更新", "asset:update"),
            permission("资产审批", "asset:approve"),
            permission("资产删除", "asset:delete"),
            permission("退役查询", "retirement:query"),
            permission("退役新建", "retirement:create"),
            permission("退役更新", "retirement:update"),
            permission("退役审批", "retirement:approve"),
            permission("退役删除", "retirement:delete"),
            permission("赔偿查询", "compensation:query"),
            permission("赔偿新建", "compensation:create"),
            permission("赔偿更新", "compensation:update"),
            permission("赔偿审批", "compensation:approve"),
            permission("赔偿删除", "compensation:delete"),
            permission("处置查询", "disposal:query"),
            permission("处置新建", "disposal:create"),
            permission("处置更新", "disposal:update"),
            permission("处置审批", "disposal:approve"),
            permission("处置删除", "disposal:delete"),
            permission("工单查询", "workorder:query"),
            permission("工单新建", "workorder:create"),
            permission("工单更新", "workorder:update"),
            permission("工单删除", "workorder:delete"),
            permission("工单提交", "workorder:submit"),
            permission("工单审批", "workorder:approve"),
            permission("工单执行", "workorder:execute"),
            permission("工单取消", "workorder:cancel"),
            permission("审批查询", "approval:query"),
            permission("审批创建", "approval:create"),
            permission("审批处理", "approval:approve"),
            permission("维护查询", "maintenance:query"),
            permission("维护新建", "maintenance:create"),
            permission("维护更新", "maintenance:update"),
            permission("维护删除", "maintenance:delete"),
            permission("闲置资产查询", "idleasset:query"),
            permission("闲置资产发布", "idleasset:create"),
            permission("闲置资产更新", "idleasset:update"),
            permission("闲置资产删除", "idleasset:delete"),
            permission("闲置资产认领", "idleasset:claim"),
            permission("用户查询", "user:query"),
            permission("用户新建", "user:create"),
            permission("用户更新", "user:update"),
            permission("用户重置密码", "user:reset-password"),
            permission("用户删除", "user:delete"),
            permission("角色查询", "role:query"),
            permission("角色新建", "role:create"),
            permission("角色更新", "role:update"),
            permission("角色删除", "role:delete"),
            permission("部门查询", "dept:query"),
            permission("部门新建", "dept:create"),
            permission("部门更新", "dept:update"),
            permission("部门删除", "dept:delete")
    );

    private static final Set<String> PERMISSION_CODES = DEFINITIONS.stream()
            .map(PermissionDefinition::permissionCode)
            .collect(java.util.stream.Collectors.collectingAndThen(
                    java.util.stream.Collectors.toCollection(LinkedHashSet::new),
                    Collections::unmodifiableSet));

    private TenantAdminPermissionPackage() {
    }

    public static List<PermissionDefinition> definitions() {
        return DEFINITIONS;
    }

    public static Set<String> permissionCodes() {
        return PERMISSION_CODES;
    }

    private static PermissionDefinition permission(String permissionName, String permissionCode) {
        return new PermissionDefinition(permissionName, permissionCode, permissionName + "动作权限");
    }

    public record PermissionDefinition(String permissionName, String permissionCode, String description) {
    }
}
