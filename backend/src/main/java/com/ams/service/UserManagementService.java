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

    public User getUserById(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        BeanUtil.setProperty(user, "password", null);
        return user;
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
        BeanUtil.setProperty(user, "password", passwordEncoder.encode(getStrProp(dto, "password")));
        BeanUtil.setProperty(user, "realName", getStrProp(dto, "realName"));
        BeanUtil.setProperty(user, "email", getStrProp(dto, "email"));
        BeanUtil.setProperty(user, "phone", getStrProp(dto, "phone"));
        BeanUtil.setProperty(user, "deptId", getLongProp(dto, "deptId"));
        BeanUtil.setProperty(user, "status", 1);
        userMapper.insert(user);

        Role defaultRole = roleMapper.selectOne(
            new QueryWrapper<Role>().eq("role_code", "USER").last("limit 1")
        );
        if (defaultRole == null) {
            throw new BusinessException("默认角色USER不存在");
        }

        UserRole userRole = new UserRole();
        BeanUtil.setProperty(userRole, "userId", getLongProp(user, "id"));
        BeanUtil.setProperty(userRole, "roleId", getLongProp(defaultRole, "id"));
        userRoleMapper.insert(userRole);

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

        BeanUtil.setProperty(user, "password", null);
        return user;
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
