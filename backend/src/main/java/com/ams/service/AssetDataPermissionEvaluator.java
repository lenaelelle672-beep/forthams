package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.entity.Dept;
import com.ams.entity.InventoryDetail;
import com.ams.entity.InventoryTask;
import com.ams.entity.RoleDataScopeRule;
import com.ams.entity.RoleDept;
import com.ams.entity.User;
import com.ams.enums.DataScope;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleDataScopeMapper;
import com.ams.mapper.RoleDeptMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.baomidou.mybatisplus.core.conditions.AbstractWrapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AssetDataPermissionEvaluator {

    private static final Map<String, String> APPROVAL_PROCESS_BUSINESS_TABLES = Map.of(
            "RETIREMENT", "retirement_application",
            "WORK_ORDER", "work_order",
            "COMPENSATION", "asset_compensation",
            "DISPOSAL", "disposal_application");

    private final UserMapper userMapper;
    private final RoleDataScopeMapper roleDataScopeMapper;
    private final RoleDeptMapper roleDeptMapper;
    private final DeptMapper deptMapper;
    private final TenantAuthorityService tenantAuthorityService;
    private final UserTenantMembershipMapper userTenantMembershipMapper;

    /**
     * 将当前用户全部 tenant-scoped 角色的数据范围以 AND 关系写入资产查询。
     * 多角色中的每个范围都必须满足，避免任一宽角色放大其他角色的访问范围。
     */
    public void applyTo(LambdaQueryWrapper<Asset> wrapper) {
        PermissionContext context = resolveContext();
        for (Map.Entry<Long, DataScope> entry : context.scopesByRoleId().entrySet()) {
            switch (entry.getValue()) {
                case ALL -> {
                    // tenant 谓词由调用方强制添加；ALL 不能移除该谓词。
                }
                case DEPT -> wrapper.eq(Asset::getDeptId, context.currentDeptId());
                case DEPT_AND_SUB -> wrapper.in(Asset::getDeptId, context.deptAndSubIds());
                case SELF -> wrapper.eq(Asset::getUserId, context.currentUser().getId());
                case CUSTOM -> wrapper.in(Asset::getDeptId, context.customDeptIdsByRoleId().get(entry.getKey()));
            }
        }
    }

    /**
     * 将同一数据范围应用到通过 asset_id 关联资产的业务记录查询。
     */
    public void applyToRelatedAsset(AbstractWrapper<?, ?, ?> wrapper) {
        PermissionContext context = resolveContext();
        List<Object> parameters = new ArrayList<>();
        StringBuilder predicate = new StringBuilder(
                "EXISTS (SELECT 1 FROM asset scoped_asset WHERE scoped_asset.id = asset_id"
                        + " AND scoped_asset.tenant_id = ");
        appendParameter(predicate, parameters, context.tenantId());
        predicate.append(" AND scoped_asset.deleted = 0");

        for (Map.Entry<Long, DataScope> entry : context.scopesByRoleId().entrySet()) {
            switch (entry.getValue()) {
                case ALL -> {
                    // tenant 谓词已经固定在关联资产上。
                }
                case DEPT -> {
                    predicate.append(" AND scoped_asset.dept_id = ");
                    appendParameter(predicate, parameters, context.currentDeptId());
                }
                case DEPT_AND_SUB -> appendDepartmentScope(predicate, parameters, context.deptAndSubIds());
                case SELF -> {
                    predicate.append(" AND scoped_asset.user_id = ");
                    appendParameter(predicate, parameters, context.currentUser().getId());
                }
                case CUSTOM -> appendDepartmentScope(predicate, parameters,
                        context.customDeptIdsByRoleId().get(entry.getKey()));
            }
        }
        predicate.append(')');
        wrapper.apply(predicate.toString(), parameters.toArray());
    }

    /**
     * 盘点任务不能仅依据用户提交的部门字符串授权。任务仅在它有至少一个真实关联资产，且所有
     * inventory_detail 关联资产均属于当前租户并满足当前数据范围时可见。任一孤儿、跨租户或
     * 范围外关联均使整项任务不可见，避免从任务元数据或明细泄露资产范围。
     */
    public void applyToInventoryTaskScope(LambdaQueryWrapper<InventoryTask> wrapper) {
        PermissionContext context = resolveContext();
        List<Object> parameters = new ArrayList<>();
        StringBuilder predicate = new StringBuilder();
        appendInventoryTaskAssetScope(predicate, parameters, context, "inventory_task");

        wrapper.eq(InventoryTask::getTenantId, context.tenantId());
        wrapper.apply(predicate.toString(), parameters.toArray());
    }

    /**
     * 明细查询重复同一 SQL 范围判定，避免任务与明细两次读取之间资产归属变化而泄露单条明细。
     */
    public void applyToInventoryTaskDetails(LambdaQueryWrapper<InventoryDetail> wrapper) {
        PermissionContext context = resolveContext();
        List<Object> parameters = new ArrayList<>();
        StringBuilder predicate = new StringBuilder("EXISTS (SELECT 1 FROM inventory_task scoped_task "
                + "WHERE scoped_task.id = inventory_detail.task_id "
                + "AND scoped_task.tenant_id = ");
        appendParameter(predicate, parameters, context.tenantId());
        predicate.append(" AND scoped_task.deleted = 0 AND ");
        appendInventoryTaskAssetScope(predicate, parameters, context, "scoped_task");
        predicate.append(')');

        wrapper.eq(InventoryDetail::getTenantId, context.tenantId());
        wrapper.apply(predicate.toString(), parameters.toArray());
    }

    /**
     * deptIds 是任务提交时的元数据，不是授权依据。只有所有角色均为 ALL 时才能原样对外展示；
     * 其余情形必须以真实 inventory_detail/asset 范围作为唯一可见性依据。
     */
    public boolean canExposeInventoryTaskDepartmentMetadata() {
        PermissionContext context = resolveContext();
        return context.scopesByRoleId().values().stream().allMatch(scope -> scope == DataScope.ALL);
    }

    private void appendInventoryTaskAssetScope(StringBuilder predicate, List<Object> parameters,
                                               PermissionContext context, String taskAlias) {
        predicate.append("EXISTS (SELECT 1 FROM inventory_detail task_asset "
                + "WHERE task_asset.tenant_id = ").append(taskAlias).append(".tenant_id "
                + "AND task_asset.task_id = ").append(taskAlias).append(".id) "
                + "AND NOT EXISTS (SELECT 1 FROM inventory_detail task_asset "
                + "WHERE task_asset.task_id = ").append(taskAlias).append(".id "
                + "AND task_asset.tenant_id <> ").append(taskAlias).append(".tenant_id) "
                + "AND NOT EXISTS (SELECT 1 FROM inventory_detail task_asset "
                + "WHERE task_asset.tenant_id = ").append(taskAlias).append(".tenant_id "
                + "AND task_asset.task_id = ").append(taskAlias).append(".id "
                + "AND NOT EXISTS (SELECT 1 FROM asset scoped_asset "
                + "WHERE scoped_asset.id = task_asset.asset_id "
                + "AND scoped_asset.tenant_id = ").append(taskAlias).append(".tenant_id "
                + "AND scoped_asset.deleted = 0");
        appendAssetScope(predicate, parameters, context, "scoped_asset");
        predicate.append("))");
    }

    /** 将资产范围统一应用到实际获准查看的审批流程类型。 */
    public void applyToApprovalProcesses(AbstractWrapper<?, ?, ?> wrapper, Set<String> processTypes) {
        if (processTypes == null || processTypes.isEmpty()) {
            throw deny("未提供获准查看的审批流程类型");
        }
        PermissionContext context = resolveContext();
        List<Object> parameters = new ArrayList<>();
        StringBuilder predicate = new StringBuilder("(");
        boolean first = true;
        for (String processType : processTypes) {
            String businessTable = APPROVAL_PROCESS_BUSINESS_TABLES.get(processType);
            if (businessTable == null) {
                throw deny("审批流程类型不支持资产数据范围校验");
            }
            if (!first) {
                predicate.append(" OR ");
            }
            appendApprovalProcessAssetScope(predicate, parameters, context, processType, businessTable);
            first = false;
        }
        predicate.append(')');
        wrapper.apply(predicate.toString(), parameters.toArray());
    }

    private void appendApprovalProcessAssetScope(StringBuilder predicate, List<Object> parameters,
                                                   PermissionContext context, String processType, String businessTable) {
        predicate.append("(UPPER(TRIM(process_type)) = ");
        appendParameter(predicate, parameters, processType);
        predicate.append(" AND EXISTS (SELECT 1 FROM ").append(businessTable).append(" scoped_business ")
                .append("INNER JOIN asset scoped_asset ON scoped_asset.id = scoped_business.asset_id ")
                .append("WHERE scoped_business.id = business_id")
                .append(" AND scoped_business.tenant_id = ");
        appendParameter(predicate, parameters, context.tenantId());
        predicate.append(" AND COALESCE(scoped_business.deleted, 0) = 0"
                + " AND scoped_asset.tenant_id = ");
        appendParameter(predicate, parameters, context.tenantId());
        predicate.append(" AND scoped_asset.deleted = 0");

        for (Map.Entry<Long, DataScope> entry : context.scopesByRoleId().entrySet()) {
            switch (entry.getValue()) {
                case ALL -> {
                    // tenant 谓词已经固定在关联资产上。
                }
                case DEPT -> {
                    predicate.append(" AND scoped_asset.dept_id = ");
                    appendParameter(predicate, parameters, context.currentDeptId());
                }
                case DEPT_AND_SUB -> appendDepartmentScope(predicate, parameters, context.deptAndSubIds());
                case SELF -> {
                    predicate.append(" AND scoped_asset.user_id = ");
                    appendParameter(predicate, parameters, context.currentUser().getId());
                }
                case CUSTOM -> appendDepartmentScope(predicate, parameters,
                        context.customDeptIdsByRoleId().get(entry.getKey()));
            }
        }
        predicate.append("))");
    }

    /** 在读取详情或修改既有资产前复用与列表相同的严格交集策略。 */
    public void assertCanAccess(Asset asset) {
        PermissionContext context = resolveContext();
        assertPermitted(asset, context);
    }

    /**
     * 写入时同时验证数据范围和目标部门/使用人仍属于当前 tenant，防止借写操作越权迁移资产。
     */
    public void assertCanWrite(Asset asset) {
        PermissionContext context = resolveContext();
        assertPermitted(asset, context);
        validateWritableReferences(asset, context.tenantId());
    }

    private PermissionContext resolveContext() {
        String tenantId = TenantContext.requireTenantId();
        User currentUser = tenantAuthorityService.requireCurrentTenantMember();
        Map<Long, DataScope> scopesByRoleId = resolveScopes(currentUser.getId(), tenantId);
        Map<Long, Set<Long>> customDeptIdsByRoleId = resolveCustomDeptIds(scopesByRoleId, tenantId);

        boolean needsDepartment = scopesByRoleId.containsValue(DataScope.DEPT)
                || scopesByRoleId.containsValue(DataScope.DEPT_AND_SUB);
        Long currentDeptId = needsDepartment ? requireActiveDepartmentId(currentUser, tenantId) : null;
        Set<Long> deptAndSubIds = scopesByRoleId.containsValue(DataScope.DEPT_AND_SUB)
                ? resolveDeptAndSubIds(currentDeptId, tenantId)
                : Set.of();
        return new PermissionContext(tenantId, currentUser, scopesByRoleId, customDeptIdsByRoleId,
                currentDeptId, deptAndSubIds);
    }

    private void assertPermitted(Asset asset, PermissionContext context) {
        if (asset == null || !context.tenantId().equals(asset.getTenantId())) {
            throw deny("资产不属于当前租户");
        }
        for (Map.Entry<Long, DataScope> entry : context.scopesByRoleId().entrySet()) {
            boolean permitted = switch (entry.getValue()) {
                case ALL -> true;
                case DEPT -> context.currentDeptId().equals(asset.getDeptId());
                case DEPT_AND_SUB -> context.deptAndSubIds().contains(asset.getDeptId());
                case SELF -> context.currentUser().getId().equals(asset.getUserId());
                case CUSTOM -> context.customDeptIdsByRoleId().get(entry.getKey()).contains(asset.getDeptId());
            };
            if (!permitted) {
                throw deny("资产不在当前角色的数据范围内");
            }
        }
    }

    private void appendDepartmentScope(StringBuilder predicate, List<Object> parameters, Set<Long> departmentIds) {
        appendDepartmentScope(predicate, parameters, "scoped_asset", departmentIds);
    }

    private void appendAssetScope(StringBuilder predicate, List<Object> parameters,
                                  PermissionContext context, String assetAlias) {
        for (Map.Entry<Long, DataScope> entry : context.scopesByRoleId().entrySet()) {
            switch (entry.getValue()) {
                case ALL -> {
                    // tenant 谓词由调用方固定在真实关联资产上。
                }
                case DEPT -> {
                    predicate.append(" AND ").append(assetAlias).append(".dept_id = ");
                    appendParameter(predicate, parameters, context.currentDeptId());
                }
                case DEPT_AND_SUB -> appendDepartmentScope(predicate, parameters, assetAlias,
                        context.deptAndSubIds());
                case SELF -> {
                    predicate.append(" AND ").append(assetAlias).append(".user_id = ");
                    appendParameter(predicate, parameters, context.currentUser().getId());
                }
                case CUSTOM -> appendDepartmentScope(predicate, parameters, assetAlias,
                        context.customDeptIdsByRoleId().get(entry.getKey()));
            }
        }
    }

    private void appendDepartmentScope(StringBuilder predicate, List<Object> parameters,
                                       String assetAlias, Set<Long> departmentIds) {
        if (departmentIds == null || departmentIds.isEmpty()) {
            predicate.append(" AND 1 = 0");
            return;
        }
        predicate.append(" AND ").append(assetAlias).append(".dept_id IN (");
        boolean first = true;
        for (Long departmentId : departmentIds) {
            if (!first) {
                predicate.append(", ");
            }
            appendParameter(predicate, parameters, departmentId);
            first = false;
        }
        predicate.append(')');
    }

    private void appendParameter(StringBuilder predicate, List<Object> parameters, Object value) {
        predicate.append('{').append(parameters.size()).append('}');
        parameters.add(value);
    }

    private Map<Long, DataScope> resolveScopes(Long userId, String tenantId) {
        List<RoleDataScopeRule> rules = roleDataScopeMapper.selectByUserIdAndTenantId(userId, tenantId);
        if (rules == null || rules.isEmpty()) {
            throw deny("未配置当前租户角色的数据权限规则");
        }

        Map<Long, DataScope> scopesByRoleId = new LinkedHashMap<>();
        for (RoleDataScopeRule rule : rules) {
            if (rule == null
                    || rule.getRoleId() == null
                    || !tenantId.equals(rule.getTenantId())
                    || scopesByRoleId.containsKey(rule.getRoleId())) {
                throw deny("角色数据权限规则不完整");
            }
            DataScope scope = DataScope.fromValue(rule.getDataScope())
                    .orElseThrow(() -> deny("角色数据权限范围为空或无效"));
            scopesByRoleId.put(rule.getRoleId(), scope);
        }
        return scopesByRoleId;
    }

    private Map<Long, Set<Long>> resolveCustomDeptIds(Map<Long, DataScope> scopesByRoleId, String tenantId) {
        List<Long> customRoleIds = scopesByRoleId.entrySet().stream()
                .filter(entry -> entry.getValue() == DataScope.CUSTOM)
                .map(Map.Entry::getKey)
                .toList();
        if (customRoleIds.isEmpty()) {
            return Map.of();
        }

        List<RoleDept> associations = roleDeptMapper.selectByTenantIdAndRoleIds(tenantId, customRoleIds);
        Map<Long, Set<Long>> deptIdsByRoleId = new HashMap<>();
        Set<Long> referencedDeptIds = new LinkedHashSet<>();
        if (associations != null) {
            for (RoleDept association : associations) {
                if (association == null
                        || association.getRoleId() == null
                        || association.getDeptId() == null
                        || !tenantId.equals(association.getTenantId())
                        || !customRoleIds.contains(association.getRoleId())) {
                    throw deny("CUSTOM 角色部门关联不完整");
                }
                if (!deptIdsByRoleId.computeIfAbsent(association.getRoleId(), ignored -> new LinkedHashSet<>())
                        .add(association.getDeptId())) {
                    throw deny("CUSTOM 角色部门关联重复");
                }
                referencedDeptIds.add(association.getDeptId());
            }
        }

        for (Long roleId : customRoleIds) {
            if (deptIdsByRoleId.get(roleId) == null || deptIdsByRoleId.get(roleId).isEmpty()) {
                throw deny("CUSTOM 角色未配置显式部门关联");
            }
        }
        assertActiveTenantDepartments(referencedDeptIds, tenantId);
        return deptIdsByRoleId;
    }

    private Long requireActiveDepartmentId(User user, String tenantId) {
        if (user.getDeptId() == null) {
            throw deny("当前用户未绑定部门");
        }
        requireActiveDepartment(user.getDeptId(), tenantId);
        return user.getDeptId();
    }

    private Set<Long> resolveDeptAndSubIds(Long rootDeptId, String tenantId) {
        List<Dept> departments = deptMapper.selectList(new QueryWrapper<Dept>()
                .eq("tenant_id", tenantId)
                .eq("deleted", 0));
        Map<Long, List<Long>> childDeptIdsByParentId = new HashMap<>();
        if (departments != null) {
            for (Dept department : departments) {
                if (department == null
                        || department.getId() == null
                        || department.getParentId() == null
                        || !isEnabled(department)) {
                    continue;
                }
                childDeptIdsByParentId.computeIfAbsent(department.getParentId(), ignored -> new ArrayList<>())
                        .add(department.getId());
            }
        }

        Set<Long> allowedDeptIds = new LinkedHashSet<>();
        Deque<Long> pendingDeptIds = new ArrayDeque<>();
        allowedDeptIds.add(rootDeptId);
        pendingDeptIds.add(rootDeptId);
        while (!pendingDeptIds.isEmpty()) {
            Long parentId = pendingDeptIds.removeFirst();
            for (Long childId : childDeptIdsByParentId.getOrDefault(parentId, List.of())) {
                if (allowedDeptIds.add(childId)) {
                    pendingDeptIds.addLast(childId);
                }
            }
        }
        return allowedDeptIds;
    }

    private void validateWritableReferences(Asset asset, String tenantId) {
        if (asset.getDeptId() != null) {
            requireActiveDepartment(asset.getDeptId(), tenantId);
        }
        if (asset.getUserId() != null) {
            User assignedUser = userMapper.selectOne(new LambdaQueryWrapper<User>()
                    .eq(User::getId, asset.getUserId())
                    .eq(User::getTenantId, tenantId)
                    .eq(User::getStatus, 1));
        if (assignedUser == null || assignedUser.getId() == null
                || userTenantMembershipMapper.countActiveMembership(assignedUser.getId(), tenantId) != 1) {
            throw deny("资产使用人不属于当前租户、未加入当前租户或已停用");
        }
        }
    }

    private void assertActiveTenantDepartments(Set<Long> departmentIds, String tenantId) {
        if (departmentIds.isEmpty()) {
            throw deny("CUSTOM 角色未配置显式部门关联");
        }
        List<Dept> departments = deptMapper.selectList(new QueryWrapper<Dept>()
                .eq("tenant_id", tenantId)
                .eq("deleted", 0)
                .in("id", departmentIds));
        Map<Long, Dept> departmentsById = new HashMap<>();
        if (departments != null) {
            departments.forEach(department -> {
                if (department != null && department.getId() != null) {
                    departmentsById.put(department.getId(), department);
                }
            });
        }
        for (Long departmentId : departmentIds) {
            Dept department = departmentsById.get(departmentId);
            if (department == null || !isEnabled(department)) {
                throw deny("CUSTOM 角色关联了不存在、停用或跨租户部门");
            }
        }
    }

    private Dept requireActiveDepartment(Long departmentId, String tenantId) {
        Dept department = deptMapper.selectOne(new QueryWrapper<Dept>()
                .eq("id", departmentId)
                .eq("tenant_id", tenantId)
                .eq("deleted", 0));
        if (department == null || !isEnabled(department)) {
            throw deny("部门不存在、停用或不属于当前租户");
        }
        return department;
    }

    private boolean isEnabled(Dept department) {
        return "1".equals(department.getStatus()) || "ACTIVE".equalsIgnoreCase(department.getStatus());
    }

    private AccessDeniedException deny(String reason) {
        return new AccessDeniedException("资产数据权限拒绝：" + reason);
    }

    private record PermissionContext(
            String tenantId,
            User currentUser,
            Map<Long, DataScope> scopesByRoleId,
            Map<Long, Set<Long>> customDeptIdsByRoleId,
            Long currentDeptId,
            Set<Long> deptAndSubIds
    ) {
    }
}
