package com.ams.datascope;

import com.ams.entity.Role;
import com.ams.security.LoginUser;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class DataScopeDecisionService {

    private static final String SUPER_ADMIN = "SUPER_ADMIN";

    public DataScopeResult decide(LoginUser loginUser, List<Role> roles, Set<Long> customDeptIds) {
        if (loginUser == null) return DataScopeResult.none();

        if (isSuperAdmin(loginUser) || hasAllScope(roles)) {
            return DataScopeResult.all();
        }

        if (roles == null || roles.isEmpty()) {
            if (loginUser.getDeptId() != null) {
                return new DataScopeResult(DataScopeType.DEPT_ONLY, Set.of(loginUser.getDeptId()), null);
            }
            return DataScopeResult.none();
        }

        Set<Integer> scopes = roles.stream()
                .map(Role::getDataScope)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        if (scopes.contains(1)) return DataScopeResult.all();

        Set<Long> deptIds = new LinkedHashSet<>();
        if (scopes.contains(3) && loginUser.getDeptId() != null) {
            deptIds.add(loginUser.getDeptId());
        }
        if (scopes.contains(2) && customDeptIds != null) {
            deptIds.addAll(customDeptIds);
        }

        DataScopeType primaryType = DataScopeType.DEPT_ONLY;
        if (scopes.contains(5) && !scopes.contains(3) && !scopes.contains(2) && !scopes.contains(4)) {
            primaryType = DataScopeType.SELF_ONLY;
        } else if (scopes.contains(4)) {
            primaryType = DataScopeType.DEPT_AND_CHILD;
        } else if (scopes.contains(2)) {
            primaryType = DataScopeType.CUSTOM;
        }

        return new DataScopeResult(primaryType, deptIds, loginUser.getUserId());
    }

    private boolean isSuperAdmin(LoginUser loginUser) {
        return loginUser.getRoles() != null && loginUser.getRoles().contains(SUPER_ADMIN);
    }

    private boolean hasAllScope(List<Role> roles) {
        return roles != null && roles.stream().anyMatch(r -> r.getDataScope() != null && r.getDataScope() == 1);
    }
}
