package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.convert.Convert;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.AuthResponse;
import com.ams.dto.UserCreateDTO;
import com.ams.dto.UserUpdateDTO;
import com.ams.entity.Dept;
import com.ams.entity.Role;
import com.ams.entity.RoleDataScopeRule;
import com.ams.entity.User;
import com.ams.entity.UserRole;
import com.ams.entity.UserTenantMembership;
import com.ams.enums.DataScope;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleDataScopeMapper;
import com.ams.mapper.RoleMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class UserManagementService {

    private static final int MAX_PAGE_SIZE = 100;

    private final UserMapper userMapper;
    private final RoleMapper roleMapper;
    private final UserRoleMapper userRoleMapper;
    private final DeptMapper deptMapper;
    private final RoleDataScopeMapper roleDataScopeMapper;
    private final UserTenantMembershipMapper userTenantMembershipMapper;
    private final TenantAuthorityService tenantAuthorityService;
    private final PasswordEncoder passwordEncoder;

    public UserManagementService(UserMapper userMapper, RoleMapper roleMapper, UserRoleMapper userRoleMapper,
                                  DeptMapper deptMapper, RoleDataScopeMapper roleDataScopeMapper,
                                  UserTenantMembershipMapper userTenantMembershipMapper,
                                  TenantAuthorityService tenantAuthorityService,
                                  PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.roleMapper = roleMapper;
        this.userRoleMapper = userRoleMapper;
        this.deptMapper = deptMapper;
        this.roleDataScopeMapper = roleDataScopeMapper;
        this.userTenantMembershipMapper = userTenantMembershipMapper;
        this.tenantAuthorityService = tenantAuthorityService;
        this.passwordEncoder = passwordEncoder;
    }

    public Page<User> queryUsers(Integer page, Integer pageSize, String keyword, Long deptId, Integer status) {
        String tenantId = TenantContext.requireTenantId();
        Page<User> pager = new Page<>(normalizePage(page), normalizePageSize(pageSize));
        QueryWrapper<User> wrapper = new QueryWrapper<User>()
                .eq("tenant_id", tenantId)
                .apply("EXISTS (SELECT 1 FROM sys_user_tenant ut WHERE ut.user_id = sys_user.id "
                        + "AND ut.tenant_id = {0} AND ut.status = 1)", tenantId);

        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like("username", keyword)
                    .or()
                    .like("real_name", keyword)
                    .or()
                    .like("phone", keyword));
        }
        if (deptId != null) {
            wrapper.eq("dept_id", deptId);
        }
        if (status != null) {
            wrapper.eq("status", status);
        }

        wrapper.orderByDesc("create_time");
        Page<User> result = userMapper.selectPage(pager, wrapper);
        result.getRecords().forEach(user -> BeanUtil.setProperty(user, "password", null));
        return result;
    }

    public User getUserById(Long id) {
        User user = getUserEntityOrThrow(id, TenantContext.requireTenantId());
        BeanUtil.setProperty(user, "password", null);
        return user;
    }

    public AuthResponse getCurrentUser() {
        User user = tenantAuthorityService.requireCurrentTenantMember();
        String tenantId = TenantContext.requireTenantId();
        BeanUtil.setProperty(user, "password", null);
        return new AuthResponse(
                null,
                user.getId(),
                user.getUsername(),
                user.getRealName(),
                safeCodes(userRoleMapper.selectRoleCodesByUserIdAndTenantId(user.getId(), tenantId)),
                safeCodes(userRoleMapper.selectPermissionCodesByUserIdAndTenantId(user.getId(), tenantId)),
                user.getPlatformAdmin());
    }

    /** 供控制器在进入具体变更操作前先保护平台管理员目标账户。 */
    public void requireTargetManagementAuthority(Long id) {
        User target = getUserEntityOrThrow(id, TenantContext.requireTenantId());
        requireTargetManagementAuthority(target);
    }

    @Transactional(rollbackFor = Exception.class)
    public User createUser(UserCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        tenantAuthorityService.requireTenantAdmin();
        requirePermission("user:create");
        User existingUser = userMapper.selectOne(new QueryWrapper<User>().eq("username", getStrProp(dto, "username")));
        if (existingUser != null) {
            throw new BusinessException("用户名已存在");
        }

        Long deptId = getLongProp(dto, "deptId");
        if (deptId != null) {
            requireActiveTenantDept(deptId, tenantId);
        }

        Role defaultRole = roleMapper.selectOne(new QueryWrapper<Role>()
                .eq("tenant_id", tenantId)
                .eq("role_code", "USER")
                .eq("status", 1)
                .eq("deleted", 0));
        if (defaultRole == null) {
            throw new BusinessException("当前租户默认角色不存在");
        }
        requireValidDataScopeRule(defaultRole.getId(), tenantId);

        User user = new User();
        user.setTenantId(tenantId);
        BeanUtil.setProperty(user, "username", getStrProp(dto, "username"));
        String rawPassword = getStrProp(dto, "password");
        BeanUtil.setProperty(user, "password", passwordEncoder.encode(
                rawPassword == null || rawPassword.isBlank() ? generateTempPassword() : rawPassword));
        BeanUtil.setProperty(user, "realName", getStrProp(dto, "realName"));
        BeanUtil.setProperty(user, "email", getStrProp(dto, "email"));
        BeanUtil.setProperty(user, "phone", getStrProp(dto, "phone"));
        BeanUtil.setProperty(user, "deptId", deptId);
        BeanUtil.setProperty(user, "status", 1);
        user.setTokenVersion(0);
        user.setVersion(0);
        if (userMapper.insert(user) != 1 || user.getId() == null) {
            throw new BusinessException("用户创建失败");
        }

        UserTenantMembership membership = new UserTenantMembership();
        membership.setUserId(user.getId());
        membership.setTenantId(tenantId);
        membership.setStatus(1);
        if (userTenantMembershipMapper.insert(membership) != 1) {
            throw new BusinessException("用户租户成员关系创建失败");
        }

        UserRole userRole = new UserRole();
        BeanUtil.setProperty(userRole, "userId", getLongProp(user, "id"));
        BeanUtil.setProperty(userRole, "roleId", getLongProp(defaultRole, "id"));
        if (userRoleMapper.insert(userRole) != 1) {
            throw new BusinessException("用户默认角色绑定失败");
        }

        BeanUtil.setProperty(user, "password", null);
        return user;
    }

    @Transactional(rollbackFor = Exception.class)
    public User updateUser(Long id, UserUpdateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        requirePermission("user:update");
        User user = getUserEntityOrThrow(id, tenantId);
        requireTargetManagementAuthority(user);
        Long deptId = getLongProp(dto, "deptId");
        if (deptId != null) {
            requireActiveTenantDept(deptId, tenantId);
        }
        BeanUtil.setProperty(user, "realName", getStrProp(dto, "realName"));
        BeanUtil.setProperty(user, "email", getStrProp(dto, "email"));
        BeanUtil.setProperty(user, "phone", getStrProp(dto, "phone"));
        BeanUtil.setProperty(user, "deptId", deptId);
        int version = versionOf(user.getVersion());
        user.setVersion(version + 1);
        int updated = userMapper.update(user, new UpdateWrapper<User>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .eq("version", version));
        if (updated != 1) {
            throw new BusinessException("用户已变更，请刷新后重试");
        }

        BeanUtil.setProperty(user, "password", null);
        return user;
    }

    @Transactional(rollbackFor = Exception.class)
    public String resetPassword(Long id) {
        String tenantId = TenantContext.requireTenantId();
        requirePermission("user:reset-password");
        User user = getUserEntityOrThrow(id, tenantId);
        requireTargetManagementAuthority(user);
        String tempPassword = generateTempPassword();
        BeanUtil.setProperty(user, "password", passwordEncoder.encode(tempPassword));
        int version = versionOf(user.getVersion());
        user.setVersion(version + 1);
        user.setTokenVersion(tokenVersionOf(user.getTokenVersion()) + 1);
        int updated = userMapper.update(user, new UpdateWrapper<User>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .eq("version", version));
        if (updated != 1) {
            throw new BusinessException("用户已变更，请刷新后重试");
        }
        return tempPassword;
    }

    /** 生成随机临时密码（替代此前的硬编码 123456）。管理员应一次性传达给用户并要求首登修改。 */
    private String generateTempPassword() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    @Transactional(rollbackFor = Exception.class)
    public void updateStatus(Long id, Integer status) {
        String tenantId = TenantContext.requireTenantId();
        requirePermission("user:update");
        if (status == null || (status != 0 && status != 1)) {
            throw new BusinessException("用户状态只能为0或1");
        }
        User user = getUserEntityOrThrow(id, tenantId);
        requireTargetManagementAuthority(user);
        BeanUtil.setProperty(user, "status", status);
        int version = versionOf(user.getVersion());
        user.setVersion(version + 1);
        user.setTokenVersion(tokenVersionOf(user.getTokenVersion()) + 1);
        int updated = userMapper.update(user, new UpdateWrapper<User>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .eq("version", version));
        if (updated != 1) {
            throw new BusinessException("用户已变更，请刷新后重试");
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteUser(Long id) {
        String tenantId = TenantContext.requireTenantId();
        requirePermission("user:delete");
        User user = getUserEntityOrThrow(id, tenantId);
        requireTargetManagementAuthority(user);
        // 清理 user_role 映射，避免软删除用户后留下孤儿角色绑定。
        userRoleMapper.delete(new QueryWrapper<UserRole>().eq("user_id", id));
        userTenantMembershipMapper.update(null, new UpdateWrapper<UserTenantMembership>()
                .eq("user_id", id)
                .eq("tenant_id", tenantId)
                .set("status", 0));
        int deleted = userMapper.delete(new QueryWrapper<User>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .eq("version", versionOf(user.getVersion())));
        if (deleted != 1) {
            throw new BusinessException("用户已变更，请刷新后重试");
        }
    }

    private User getUserEntityOrThrow(Long id, String tenantId) {
        User user = userMapper.selectOne(new QueryWrapper<User>()
                .eq("id", id)
                .eq("tenant_id", tenantId));
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        Long activeMemberships = userTenantMembershipMapper.countActiveMembership(user.getId(), tenantId);
        if (activeMemberships == null || activeMemberships != 1) {
            throw new BusinessException("用户未加入当前租户");
        }
        return user;
    }

    private void requireValidDataScopeRule(Long roleId, String tenantId) {
        RoleDataScopeRule rule = roleDataScopeMapper.selectOne(new QueryWrapper<RoleDataScopeRule>()
                .eq("tenant_id", tenantId)
                .eq("role_id", roleId));
        if (rule == null || DataScope.fromValue(rule.getDataScope()).isEmpty()) {
            throw new BusinessException("当前租户默认角色未配置有效数据权限规则");
        }
    }

    /** 平台管理员账户只能由服务器显式识别的 platform-admin 操作，不能由 tenant-admin 触碰。 */
    private void requireTargetManagementAuthority(User target) {
        if (Boolean.TRUE.equals(target.getPlatformAdmin())) {
            tenantAuthorityService.requirePlatformAdmin();
            return;
        }
        tenantAuthorityService.requireTenantAdmin();
    }

    private void requireActiveTenantDept(Long deptId, String tenantId) {
        Dept dept = deptMapper.selectOne(new QueryWrapper<Dept>()
                .eq("id", deptId)
                .eq("tenant_id", tenantId)
                .eq("deleted", 0));
        if (dept == null || !("1".equals(dept.getStatus()) || "ACTIVE".equalsIgnoreCase(dept.getStatus()))) {
            throw new BusinessException("部门不存在、停用或不属于当前租户");
        }
    }

    private Long getLongProp(Object bean, String fieldName) {
        return Convert.toLong(BeanUtil.getProperty(bean, fieldName));
    }

    private String getStrProp(Object bean, String fieldName) {
        return Convert.toStr(BeanUtil.getProperty(bean, fieldName));
    }

    private int normalizePage(Integer page) {
        return page == null || page < 1 ? 1 : page;
    }

    private int normalizePageSize(Integer pageSize) {
        if (pageSize == null || pageSize < 1) {
            return 10;
        }
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }

    private int versionOf(Integer version) {
        return version == null ? 0 : version;
    }

    private int tokenVersionOf(Integer tokenVersion) {
        return tokenVersion == null ? 0 : tokenVersion;
    }

    private List<String> safeCodes(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .filter(value -> value != null && !value.isBlank())
                .toList();
    }

    private void requirePermission(String permission) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean permitted = authentication != null
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.isAuthenticated()
                && authentication.getAuthorities().stream().anyMatch(authority -> permission.equals(authority.getAuthority()));
        if (!permitted) {
            throw new AccessDeniedException("缺少用户管理权限: " + permission);
        }
    }
}
