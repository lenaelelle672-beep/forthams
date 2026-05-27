package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.RoleCreateDTO;
import com.ams.dto.RoleUpdateDTO;
import com.ams.entity.Role;
import com.ams.entity.SysRoleDept;
import com.ams.entity.SysRoleMenu;
import com.ams.mapper.RoleMapper;
import com.ams.mapper.SysRoleDeptMapper;
import com.ams.mapper.SysRoleMenuMapper;
import com.ams.security.SecurityUserCacheService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 角色管理 Service
 *
 * <p>使用显式 setter 赋值替代 Hutool BeanUtil 反射，确保 IDE 重构检查与编译期类型安全。</p>
 */
@Service
public class RoleService {

    private final RoleMapper roleMapper;
    private final SysRoleMenuMapper sysRoleMenuMapper;
    private final SysRoleDeptMapper sysRoleDeptMapper;
    private final SecurityUserCacheService securityUserCacheService;

    public RoleService(RoleMapper roleMapper,
                        SysRoleMenuMapper sysRoleMenuMapper,
                        SysRoleDeptMapper sysRoleDeptMapper,
                        SecurityUserCacheService securityUserCacheService) {
        this.roleMapper = roleMapper;
        this.sysRoleMenuMapper = sysRoleMenuMapper;
        this.sysRoleDeptMapper = sysRoleDeptMapper;
        this.securityUserCacheService = securityUserCacheService;
    }

    public Page<Role> queryRoles(Integer page, Integer pageSize, String keyword) {
        Page<Role> pager = new Page<>(page, pageSize);
        QueryWrapper<Role> wrapper = new QueryWrapper<>();

        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like("role_name", keyword)
                .or()
                .like("role_code", keyword));
        }
        wrapper.orderByDesc("create_time");
        return roleMapper.selectPage(pager, wrapper);
    }

    public Role getRoleById(Long id) {
        Role role = roleMapper.selectById(id);
        if (role == null) {
            throw new BusinessException("角色不存在");
        }
        return role;
    }

    @Transactional(rollbackFor = Exception.class)
    public Role createRole(RoleCreateDTO dto) {
        validateRoleCodeUnique(dto.getRoleCode(), null);

        Role role = new Role();
        role.setRoleName(dto.getRoleName());
        role.setRoleCode(dto.getRoleCode());
        role.setDescription(dto.getDescription());
        role.setSortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : 0);
        role.setDataScope(dto.getDataScope() != null ? dto.getDataScope() : 1);
        role.setMenuCheckStrictly(dto.getMenuCheckStrictly() != null ? dto.getMenuCheckStrictly() : 1);
        role.setDeptCheckStrictly(dto.getDeptCheckStrictly() != null ? dto.getDeptCheckStrictly() : 1);
        role.setStatus(1);
        roleMapper.insert(role);
        securityUserCacheService.evictAll();

        return role;
    }

    @Transactional(rollbackFor = Exception.class)
    public Role updateRole(Long id, RoleUpdateDTO dto) {
        Role role = getRoleById(id);
        validateRoleCodeUnique(dto.getRoleCode(), id);

        role.setRoleName(dto.getRoleName());
        role.setRoleCode(dto.getRoleCode());
        role.setDescription(dto.getDescription());
        if (dto.getSortOrder() != null) {
            role.setSortOrder(dto.getSortOrder());
        }
        if (dto.getDataScope() != null) {
            role.setDataScope(dto.getDataScope());
        }
        if (dto.getMenuCheckStrictly() != null) {
            role.setMenuCheckStrictly(dto.getMenuCheckStrictly());
        }
        if (dto.getDeptCheckStrictly() != null) {
            role.setDeptCheckStrictly(dto.getDeptCheckStrictly());
        }
        if (dto.getStatus() != null) {
            role.setStatus(dto.getStatus());
        }
        roleMapper.updateById(role);
        securityUserCacheService.evictAll();

        return role;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteRole(Long id) {
        getRoleById(id);
        roleMapper.deleteById(id);
        securityUserCacheService.evictAll();
    }

    public List<Role> listAllRoles() {
        return roleMapper.selectList(new QueryWrapper<Role>().orderByAsc("role_name"));
    }

    /**
     * 分配角色菜单权限：先删除旧关联，再批量插入新关联
     */
    @Transactional(rollbackFor = Exception.class)
    public void assignMenus(Long roleId, List<Long> menuIds) {
        getRoleById(roleId);
        sysRoleMenuMapper.deleteByRoleId(roleId);
        if (menuIds != null && !menuIds.isEmpty()) {
            List<SysRoleMenu> list = menuIds.stream()
                .map(menuId -> {
                    SysRoleMenu rm = new SysRoleMenu();
                    rm.setRoleId(roleId);
                    rm.setMenuId(menuId);
                    return rm;
                })
                .collect(Collectors.toList());
            sysRoleMenuMapper.insertBatch(list);
        }
        securityUserCacheService.evictAll();
    }

    /**
     * 分配角色部门数据权限：先删除旧关联，再批量插入新关联
     */
    @Transactional(rollbackFor = Exception.class)
    public void assignDepts(Long roleId, List<Long> deptIds) {
        getRoleById(roleId);
        sysRoleDeptMapper.deleteByRoleId(roleId);
        if (deptIds != null && !deptIds.isEmpty()) {
            List<SysRoleDept> list = deptIds.stream()
                .map(deptId -> {
                    SysRoleDept rd = new SysRoleDept();
                    rd.setRoleId(roleId);
                    rd.setDeptId(deptId);
                    return rd;
                })
                .collect(Collectors.toList());
            sysRoleDeptMapper.insertBatch(list);
        }
        securityUserCacheService.evictAll();
    }

    private void validateRoleCodeUnique(String roleCode, Long excludeId) {
        QueryWrapper<Role> wrapper = new QueryWrapper<Role>().eq("role_code", roleCode);
        if (excludeId != null) {
            wrapper.ne("id", excludeId);
        }
        if (roleMapper.selectCount(wrapper) > 0) {
            throw new BusinessException("角色编码已存在");
        }
    }
}
