package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.convert.Convert;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.RoleCreateDTO;
import com.ams.dto.RoleDataScopeUpdateDTO;
import com.ams.dto.RoleUpdateDTO;
import com.ams.entity.Dept;
import com.ams.entity.GeneralAuditEntry;
import com.ams.entity.Role;
import com.ams.entity.RoleDataScopeRule;
import com.ams.entity.RoleDept;
import com.ams.entity.User;
import com.ams.entity.UserRole;
import com.ams.enums.DataScope;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.AuditLogMapper;
import com.ams.mapper.RoleDataScopeMapper;
import com.ams.mapper.RoleDeptMapper;
import com.ams.mapper.RoleMapper;
import com.ams.mapper.UserRoleMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.time.LocalDateTime;

@Service
public class RoleService {

    private final RoleMapper roleMapper;
    private final RoleDataScopeMapper roleDataScopeMapper;
    private final RoleDeptMapper roleDeptMapper;
    private final DeptMapper deptMapper;
    private final UserRoleMapper userRoleMapper;
    private final TenantAuthorityService tenantAuthorityService;
    private final AuditLogMapper auditLogMapper;

    public RoleService(RoleMapper roleMapper, RoleDataScopeMapper roleDataScopeMapper,
                       RoleDeptMapper roleDeptMapper, DeptMapper deptMapper, UserRoleMapper userRoleMapper,
                       TenantAuthorityService tenantAuthorityService, AuditLogMapper auditLogMapper) {
        this.roleMapper = roleMapper;
        this.roleDataScopeMapper = roleDataScopeMapper;
        this.roleDeptMapper = roleDeptMapper;
        this.deptMapper = deptMapper;
        this.userRoleMapper = userRoleMapper;
        this.tenantAuthorityService = tenantAuthorityService;
        this.auditLogMapper = auditLogMapper;
    }

    public Page<Role> queryRoles(Integer page, Integer pageSize, String keyword) {
        String tenantId = TenantContext.requireTenantId();
        Page<Role> pager = new Page<>(page, pageSize);
        QueryWrapper<Role> wrapper = scopedRoleQuery(tenantId);

        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like("role_name", keyword)
                    .or()
                    .like("role_code", keyword));
        }
        wrapper.orderByAsc("sort_order", "id");
        return roleMapper.selectPage(pager, wrapper);
    }

    public Role getRoleById(Long id) {
        return getRoleById(id, TenantContext.requireTenantId());
    }

    @Transactional(rollbackFor = Exception.class)
    public Role createRole(RoleCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        String roleCode = getStrProp(dto, "roleCode");
        validateRoleCodeUnique(roleCode, null, tenantId);

        Role role = new Role();
        role.setTenantId(tenantId);
        BeanUtil.setProperty(role, "roleName", getStrProp(dto, "roleName"));
        BeanUtil.setProperty(role, "roleCode", roleCode);
        BeanUtil.setProperty(role, "description", getStrProp(dto, "description"));
        BeanUtil.setProperty(role, "status", 1);
        roleMapper.insert(role);
        return role;
    }

    @Transactional(rollbackFor = Exception.class)
    public Role updateRole(Long id, RoleUpdateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        Role role = getRoleById(id, tenantId);
        String requestedRoleCode = getStrProp(dto, "roleCode");
        if (requestedRoleCode != null && !requestedRoleCode.isBlank()) {
            validateRoleCodeUnique(requestedRoleCode, id, tenantId);
            BeanUtil.setProperty(role, "roleCode", requestedRoleCode);
        }

        BeanUtil.setProperty(role, "roleName", getStrProp(dto, "roleName"));
        BeanUtil.setProperty(role, "description", getStrProp(dto, "description"));
        int updated = roleMapper.update(role, new UpdateWrapper<Role>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .eq("deleted", 0));
        if (updated == 0) {
            throw new BusinessException("角色不存在");
        }
        return role;
    }

    @Transactional(rollbackFor = Exception.class)
    public void configureDataScope(Long id, RoleDataScopeUpdateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        User operator = requireTenantAdmin();
        getRoleById(id, tenantId);
        DataScope scope = DataScope.fromValue(dto.getDataScope())
                .orElseThrow(() -> new BusinessException("数据权限范围无效"));
        List<Long> requestedDeptIds = dto.getDeptIds() == null ? List.of() : dto.getDeptIds();
        Set<Long> deptIds = new LinkedHashSet<>(requestedDeptIds);
        if (scope == DataScope.CUSTOM && deptIds.isEmpty()) {
            throw new BusinessException("CUSTOM 数据范围必须配置至少一个部门");
        }
        if (scope == DataScope.CUSTOM && (deptIds.contains(null) || deptIds.size() != requestedDeptIds.size())) {
            throw new BusinessException("CUSTOM 数据范围不允许重复或无效部门");
        }
        if (scope != DataScope.CUSTOM && !deptIds.isEmpty()) {
            throw new BusinessException("仅 CUSTOM 数据范围允许配置角色部门关联");
        }
        if (scope == DataScope.CUSTOM) {
            validateActiveTenantDepartments(deptIds, tenantId);
        }

        RoleDataScopeRule existingRule = roleDataScopeMapper.selectOne(new QueryWrapper<RoleDataScopeRule>()
                .eq("tenant_id", tenantId)
                .eq("role_id", id));
        Set<Long> oldDeptIds = loadRoleDepartmentIds(id, tenantId);
        if (existingRule == null) {
            RoleDataScopeRule rule = new RoleDataScopeRule();
            rule.setTenantId(tenantId);
            rule.setRoleId(id);
            rule.setDataScope(scope.name());
            roleDataScopeMapper.insert(rule);
        } else {
            roleDataScopeMapper.update(null, new UpdateWrapper<RoleDataScopeRule>()
                    .eq("id", existingRule.getId())
                    .eq("tenant_id", tenantId)
                    .eq("role_id", id)
                    .set("data_scope", scope.name()));
        }

        roleDeptMapper.delete(new QueryWrapper<RoleDept>()
                .eq("tenant_id", tenantId)
                .eq("role_id", id));
        if (scope == DataScope.CUSTOM) {
            for (Long deptId : deptIds) {
                RoleDept association = new RoleDept();
                association.setTenantId(tenantId);
                association.setRoleId(id);
                association.setDeptId(deptId);
                roleDeptMapper.insert(association);
            }
        }
        recordDataScopeAudit(id, tenantId, operator, existingRule, oldDeptIds, scope, deptIds);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteRole(Long id) {
        String tenantId = TenantContext.requireTenantId();
        Role role = getRoleById(id, tenantId);
        Long userRoleCount = userRoleMapper.selectCount(new QueryWrapper<UserRole>().eq("role_id", role.getId()));
        if (userRoleCount != null && userRoleCount > 0) {
            throw new BusinessException("角色仍有关联用户，无法删除");
        }
        roleDataScopeMapper.delete(new QueryWrapper<RoleDataScopeRule>()
                .eq("tenant_id", tenantId)
                .eq("role_id", role.getId()));
        roleDeptMapper.delete(new QueryWrapper<RoleDept>()
                .eq("tenant_id", tenantId)
                .eq("role_id", role.getId()));
        int deleted = roleMapper.delete(new QueryWrapper<Role>()
                .eq("id", role.getId())
                .eq("tenant_id", tenantId));
        if (deleted == 0) {
            throw new BusinessException("角色不存在");
        }
    }

    public List<Role> listAllRoles() {
        String tenantId = TenantContext.requireTenantId();
        return roleMapper.selectList(scopedRoleQuery(tenantId).orderByAsc("role_name"));
    }

    private Role getRoleById(Long id, String tenantId) {
        Role role = roleMapper.selectOne(scopedRoleQuery(tenantId).eq("id", id));
        if (role == null) {
            throw new BusinessException("角色不存在");
        }
        return role;
    }

    private void validateRoleCodeUnique(String roleCode, Long excludeId, String tenantId) {
        if (roleCode == null || roleCode.isBlank()) {
            return;
        }
        QueryWrapper<Role> wrapper = scopedRoleQuery(tenantId).eq("role_code", roleCode);
        if (excludeId != null) {
            wrapper.ne("id", excludeId);
        }
        if (roleMapper.selectCount(wrapper) > 0) {
            throw new BusinessException("角色编码已存在");
        }
    }

    private void validateActiveTenantDepartments(Set<Long> deptIds, String tenantId) {
        List<Dept> departments = deptMapper.selectList(new QueryWrapper<Dept>()
                .eq("tenant_id", tenantId)
                .eq("deleted", 0)
                .in("id", deptIds));
        if (departments == null || departments.size() != deptIds.size()
                || departments.stream().anyMatch(dept -> !isEnabled(dept))) {
            throw new BusinessException("CUSTOM 部门不存在、停用或不属于当前租户");
        }
    }

    private QueryWrapper<Role> scopedRoleQuery(String tenantId) {
        return new QueryWrapper<Role>()
                .eq("tenant_id", tenantId)
                .eq("deleted", 0);
    }

    private boolean isEnabled(Dept dept) {
        return "1".equals(dept.getStatus()) || "ACTIVE".equalsIgnoreCase(dept.getStatus());
    }

    private String getStrProp(Object bean, String fieldName) {
        return Convert.toStr(BeanUtil.getProperty(bean, fieldName));
    }

    private User requireTenantAdmin() {
        if (tenantAuthorityService == null) {
            throw new BusinessException("数据权限配置服务未正确初始化");
        }
        User operator = tenantAuthorityService.requireTenantAdmin();
        if (operator == null || operator.getId() == null) {
            throw new BusinessException("当前操作者无效");
        }
        return operator;
    }

    private Set<Long> loadRoleDepartmentIds(Long roleId, String tenantId) {
        List<RoleDept> associations = roleDeptMapper.selectList(new QueryWrapper<RoleDept>()
                .eq("tenant_id", tenantId)
                .eq("role_id", roleId)
                .orderByAsc("dept_id"));
        Set<Long> deptIds = new LinkedHashSet<>();
        if (associations != null) {
            associations.stream()
                    .map(RoleDept::getDeptId)
                    .filter(java.util.Objects::nonNull)
                    .forEach(deptIds::add);
        }
        return deptIds;
    }

    private void recordDataScopeAudit(Long roleId, String tenantId, User operator,
                                      RoleDataScopeRule existingRule, Set<Long> oldDeptIds,
                                      DataScope newScope, Set<Long> newDeptIds) {
        if (auditLogMapper == null) {
            throw new BusinessException("数据权限审计服务未正确初始化");
        }
        GeneralAuditEntry audit = new GeneralAuditEntry();
        audit.setTenantId(tenantId);
        audit.setTimestamp(LocalDateTime.now());
        audit.setAction("ROLE_DATA_SCOPE_UPDATE");
        audit.setOperationType("ROLE_DATA_SCOPE_UPDATE");
        audit.setOperatorId(operator.getId());
        audit.setOperatorName(operator.getUsername());
        audit.setResourceType("ROLE");
        audit.setResourceId(String.valueOf(roleId));
        audit.setDescription("角色数据范围已更新");
        audit.setBeforeRecord(describeDataScope(existingRule == null ? null : existingRule.getDataScope(), oldDeptIds));
        audit.setAfterRecord(describeDataScope(newScope.name(), newDeptIds));
        audit.setStatus("SUCCESS");
        if (auditLogMapper.insertAuditEntry(audit) != 1) {
            throw new BusinessException("数据权限审计写入失败");
        }
    }

    private String describeDataScope(String scope, Set<Long> deptIds) {
        String normalizedScope = scope == null || scope.isBlank() ? "NONE" : scope;
        String joinedDeptIds = deptIds == null ? "" : deptIds.stream()
                .map(String::valueOf)
                .reduce((left, right) -> left + "," + right)
                .orElse("");
        return "scope=" + normalizedScope + ";customDeptIds=[" + joinedDeptIds + "]";
    }
}
