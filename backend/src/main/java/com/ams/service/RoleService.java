package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.convert.Convert;
import com.ams.common.exception.BusinessException;
import com.ams.dto.RoleCreateDTO;
import com.ams.dto.RoleUpdateDTO;
import com.ams.entity.Role;
import com.ams.mapper.RoleMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class RoleService {

    private final RoleMapper roleMapper;

    public RoleService(RoleMapper roleMapper) {
        this.roleMapper = roleMapper;
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
        validateRoleCodeUnique(getStrProp(dto, "roleCode"), null);

        Role role = new Role();
        BeanUtil.setProperty(role, "roleName", getStrProp(dto, "roleName"));
        BeanUtil.setProperty(role, "roleCode", getStrProp(dto, "roleCode"));
        BeanUtil.setProperty(role, "description", getStrProp(dto, "description"));
        BeanUtil.setProperty(role, "status", 1);
        roleMapper.insert(role);

        roleMapper.update(
            null,
            new UpdateWrapper<Role>()
                .eq("id", getLongProp(role, "id"))
                .set("sort_order", getIntProp(dto, "sortOrder") == null ? 0 : getIntProp(dto, "sortOrder"))
        );
        return role;
    }

    @Transactional(rollbackFor = Exception.class)
    public Role updateRole(Long id, RoleUpdateDTO dto) {
        Role role = getRoleById(id);
        validateRoleCodeUnique(getStrProp(dto, "roleCode"), id);

        BeanUtil.setProperty(role, "roleName", getStrProp(dto, "roleName"));
        BeanUtil.setProperty(role, "roleCode", getStrProp(dto, "roleCode"));
        BeanUtil.setProperty(role, "description", getStrProp(dto, "description"));
        roleMapper.updateById(role);

        roleMapper.update(
            null,
            new UpdateWrapper<Role>()
                .eq("id", id)
                .set("sort_order", getIntProp(dto, "sortOrder") == null ? 0 : getIntProp(dto, "sortOrder"))
        );
        return role;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteRole(Long id) {
        getRoleById(id);
        roleMapper.deleteById(id);
    }

    public List<Role> listAllRoles() {
        return roleMapper.selectList(new QueryWrapper<Role>().orderByAsc("role_name"));
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

    private Long getLongProp(Object bean, String fieldName) {
        return Convert.toLong(BeanUtil.getProperty(bean, fieldName));
    }

    private Integer getIntProp(Object bean, String fieldName) {
        return Convert.toInt(BeanUtil.getProperty(bean, fieldName));
    }

    private String getStrProp(Object bean, String fieldName) {
        return Convert.toStr(BeanUtil.getProperty(bean, fieldName));
    }
}
