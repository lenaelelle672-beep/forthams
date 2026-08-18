package com.ams.service;

import com.ams.entity.Dept;
import com.ams.entity.Role;
import com.ams.entity.User;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleDeptMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.security.DataScope;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DataScopeService {

    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final RoleDeptMapper roleDeptMapper;
    private final DeptMapper deptMapper;

    public DataScope resolveCurrent() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少数据权限上下文");
        }
        if (authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(ROLE_SUPER_ADMIN::equals)) {
            return DataScope.all();
        }
        String username = authentication.getName();
        if (username == null || username.isBlank()) {
            throw new AccessDeniedException("缺少数据权限上下文");
        }
        User user = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getUsername, username));
        if (user == null) {
            throw new AccessDeniedException("缺少数据权限上下文");
        }
        return resolve(user, userRoleMapper.selectRolesByUserId(user.getId()));
    }

    DataScope resolve(User user, List<Role> roles) {
        if (user == null || user.getId() == null) {
            return DataScope.none();
        }
        if (roles == null || roles.isEmpty()) {
            return DataScope.none();
        }
        boolean seeAll = false;
        boolean includeSelf = false;
        Set<Long> deptIds = new HashSet<>();
        List<Dept> allDepts = null;
        for (Role role : roles) {
            String scope = normalize(role == null ? null : role.getDataScope());
            switch (scope) {
                case "ALL" -> seeAll = true;
                case "SELF" -> includeSelf = true;
                case "DEPT" -> addOwnDept(user, deptIds);
                case "DEPT_AND_SUB" -> {
                    addOwnDept(user, deptIds);
                    if (allDepts == null) {
                        allDepts = deptMapper.selectList(null);
                    }
                    addDescendants(user.getDeptId(), allDepts, deptIds);
                }
                case "CUSTOM" -> {
                    if (role.getId() != null) {
                        List<Long> custom = roleDeptMapper.selectDeptIdsByRoleId(role.getId());
                        if (custom != null) {
                            deptIds.addAll(custom);
                        }
                    }
                }
                default -> {
                }
            }
        }
        if (seeAll) {
            return DataScope.all();
        }
        return DataScope.filtered(user.getId(), deptIds, includeSelf);
    }

    private static String normalize(String raw) {
        return raw == null ? "" : raw.trim().toUpperCase();
    }

    private static void addOwnDept(User user, Set<Long> deptIds) {
        if (user.getDeptId() != null && user.getDeptId() > 0) {
            deptIds.add(user.getDeptId());
        }
    }

    private static void addDescendants(Long rootDeptId, List<Dept> allDepts, Set<Long> deptIds) {
        if (rootDeptId == null || allDepts == null) {
            return;
        }
        Map<Long, List<Long>> children = new HashMap<>();
        for (Dept dept : allDepts) {
            if (dept.getId() == null || dept.getParentId() == null) {
                continue;
            }
            children.computeIfAbsent(dept.getParentId(), ignored -> new ArrayList<>()).add(dept.getId());
        }
        ArrayDeque<Long> queue = new ArrayDeque<>();
        queue.add(rootDeptId);
        while (!queue.isEmpty()) {
            Long current = queue.removeFirst();
            for (Long child : children.getOrDefault(current, List.of())) {
                if (deptIds.add(child)) {
                    queue.add(child);
                }
            }
        }
    }
}
