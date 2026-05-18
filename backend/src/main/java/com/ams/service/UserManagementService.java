package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.convert.Convert;
import com.ams.common.exception.BusinessException;
import com.ams.dto.UserCreateDTO;
import com.ams.dto.UserUpdateDTO;
import com.ams.entity.Role;
import com.ams.entity.User;
import com.ams.entity.UserRole;
import com.ams.mapper.RoleMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class UserManagementService {

    private final UserMapper userMapper;
    private final RoleMapper roleMapper;
    private final UserRoleMapper userRoleMapper;
    private final PasswordEncoder passwordEncoder;

    public UserManagementService(UserMapper userMapper, RoleMapper roleMapper, UserRoleMapper userRoleMapper,
                                 PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.roleMapper = roleMapper;
        this.userRoleMapper = userRoleMapper;
        this.passwordEncoder = passwordEncoder;
    }

    public Page<User> queryUsers(Integer page, Integer pageSize, String keyword, Long deptId, Integer status) {
        Page<User> pager = new Page<>(page, pageSize);
        QueryWrapper<User> wrapper = new QueryWrapper<>();

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

    /** 关键词搜索用户（用于流程设计器审批人选择） */
    public List<User> searchUsers(String keyword) {
        QueryWrapper<User> wrapper = new QueryWrapper<>();
        wrapper.eq("status", 1);
        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like("username", keyword)
                .or()
                .like("real_name", keyword)
                .or()
                .like("phone", keyword));
        }
        wrapper.select("id", "username", "real_name", "email", "phone", "dept_id", "status")
               .last("limit 50");
        List<User> users = userMapper.selectList(wrapper);
        users.forEach(user -> BeanUtil.setProperty(user, "password", null));
        return users;
    }

    /** 获取用户的角色ID列表 */
    public List<Long> getUserRoleIds(Long userId) {
        return userRoleMapper.selectRoleIdsByUserId(userId);
    }

    /** 获取用户的角色编码列表 */
    public List<String> getUserRoleCodes(Long userId) {
        return userRoleMapper.selectRoleCodesByUserId(userId);
    }

    public User getUserById(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        BeanUtil.setProperty(user, "password", null);
        return user;
    }

    /** 获取用户详情（附带角色信息） */
    public Map<String, Object> getUserDetailWithRoles(Long id) {
        User user = getUserById(id);
        List<Long> roleIds = getUserRoleIds(id);
        List<String> roleCodes = getUserRoleCodes(id);

        List<Map<String, Object>> roles = new ArrayList<>();
        for (Long roleId : roleIds) {
            Role role = roleMapper.selectById(roleId);
            if (role != null) {
                Map<String, Object> roleMap = new HashMap<>();
                roleMap.put("id", role.getId());
                roleMap.put("roleCode", role.getRoleCode());
                roleMap.put("roleName", role.getRoleName());
                roles.add(roleMap);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("id", user.getId());
        result.put("username", user.getUsername());
        result.put("realName", user.getRealName());
        result.put("email", user.getEmail());
        result.put("phone", user.getPhone());
        result.put("deptId", user.getDeptId());
        result.put("status", user.getStatus());
        result.put("roleIds", roleIds);
        result.put("roles", roles);
        result.put("roleCodes", roleCodes);
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public User createUser(UserCreateDTO dto) {
        User existingUser = userMapper.selectOne(
            new QueryWrapper<User>().eq("username", getStrProp(dto, "username"))
        );
        if (existingUser != null) {
            throw new BusinessException("用户名已存在");
        }

        User user = new User();
        BeanUtil.setProperty(user, "username", getStrProp(dto, "username"));
        String rawPassword = getStrProp(dto, "password");
        BeanUtil.setProperty(user, "password", passwordEncoder.encode(
                rawPassword == null || rawPassword.isBlank() ? "123456" : rawPassword));
        BeanUtil.setProperty(user, "realName", getStrProp(dto, "realName"));
        BeanUtil.setProperty(user, "email", getStrProp(dto, "email"));
        BeanUtil.setProperty(user, "phone", getStrProp(dto, "phone"));
        BeanUtil.setProperty(user, "deptId", getLongProp(dto, "deptId"));
        BeanUtil.setProperty(user, "status", 1);
        userMapper.insert(user);

        // 处理角色分配
        List<Long> roleIds = dto.getRoleIds();
        if (roleIds != null && !roleIds.isEmpty()) {
            assignRolesToUser(user.getId(), roleIds);
        } else {
            // 默认分配 USER 角色
            Role defaultRole = roleMapper.selectOne(
                new QueryWrapper<Role>().eq("role_code", "USER").last("limit 1")
            );
            if (defaultRole == null) {
                throw new BusinessException("默认角色USER不存在");
            }
            UserRole userRole = new UserRole();
            BeanUtil.setProperty(userRole, "userId", user.getId());
            BeanUtil.setProperty(userRole, "roleId", defaultRole.getId());
            userRoleMapper.insert(userRole);
        }

        BeanUtil.setProperty(user, "password", null);
        return user;
    }

    @Transactional(rollbackFor = Exception.class)
    public User updateUser(Long id, UserUpdateDTO dto) {
        User user = getUserEntityOrThrow(id);
        BeanUtil.setProperty(user, "realName", getStrProp(dto, "realName"));
        BeanUtil.setProperty(user, "email", getStrProp(dto, "email"));
        BeanUtil.setProperty(user, "phone", getStrProp(dto, "phone"));
        BeanUtil.setProperty(user, "deptId", getLongProp(dto, "deptId"));
        userMapper.updateById(user);

        // 处理角色更新：先删旧关联，再写入新关联
        List<Long> roleIds = dto.getRoleIds();
        if (roleIds != null) {
            userRoleMapper.deleteByUserId(id);
            if (!roleIds.isEmpty()) {
                assignRolesToUser(id, roleIds);
            }
        }

        BeanUtil.setProperty(user, "password", null);
        return user;
    }

    /** 为用户批量分配角色 */
    private void assignRolesToUser(Long userId, List<Long> roleIds) {
        for (Long roleId : roleIds) {
            Role role = roleMapper.selectById(roleId);
            if (role == null || role.getStatus() == null || role.getStatus() != 1) {
                throw new BusinessException("角色不存在或已禁用: roleId=" + roleId);
            }
            UserRole userRole = new UserRole();
            BeanUtil.setProperty(userRole, "userId", userId);
            BeanUtil.setProperty(userRole, "roleId", roleId);
            userRoleMapper.insert(userRole);
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void resetPassword(Long id) {
        User user = getUserEntityOrThrow(id);
        BeanUtil.setProperty(user, "password", passwordEncoder.encode("123456"));
        userMapper.updateById(user);
    }

    @Transactional(rollbackFor = Exception.class)
    public void updateStatus(Long id, Integer status) {
        User user = getUserEntityOrThrow(id);
        BeanUtil.setProperty(user, "status", status);
        userMapper.updateById(user);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteUser(Long id) {
        getUserEntityOrThrow(id);
        userMapper.deleteById(id);
    }

    private User getUserEntityOrThrow(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        return user;
    }

    private Long getLongProp(Object bean, String fieldName) {
        return Convert.toLong(BeanUtil.getProperty(bean, fieldName));
    }

    private String getStrProp(Object bean, String fieldName) {
        return Convert.toStr(BeanUtil.getProperty(bean, fieldName));
    }
}
