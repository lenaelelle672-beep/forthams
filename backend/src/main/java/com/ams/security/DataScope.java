package com.ams.security;

import org.springframework.security.access.AccessDeniedException;

import java.util.Set;

public final class DataScope {

    private final boolean all;
    private final Long userId;
    private final Set<Long> deptIds;
    private final boolean includeSelf;

    private DataScope(boolean all, Long userId, Set<Long> deptIds, boolean includeSelf) {
        this.all = all;
        this.userId = userId;
        this.deptIds = deptIds == null ? Set.of() : Set.copyOf(deptIds);
        this.includeSelf = includeSelf;
    }

    public static DataScope all() {
        return new DataScope(true, null, Set.of(), false);
    }

    public static DataScope none() {
        return new DataScope(false, null, Set.of(), false);
    }

    public static DataScope filtered(Long userId, Set<Long> deptIds, boolean includeSelf) {
        return new DataScope(false, userId, deptIds, includeSelf);
    }

    public boolean seesAll() {
        return all;
    }

    public Long userId() {
        return userId;
    }

    public Set<Long> deptIds() {
        return deptIds;
    }

    public boolean includeSelf() {
        return includeSelf;
    }

    public boolean allows(Long assetDeptId, Long assetUserId) {
        if (all) {
            return true;
        }
        if (includeSelf && userId != null && userId.equals(assetUserId)) {
            return true;
        }
        return assetDeptId != null && deptIds.contains(assetDeptId);
    }

    public void assertAllows(Long assetDeptId, Long assetUserId) {
        if (!allows(assetDeptId, assetUserId)) {
            throw new AccessDeniedException("数据范围不足");
        }
    }
}
