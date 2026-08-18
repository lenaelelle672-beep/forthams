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

    public boolean allows(Long recordDeptId, Long... recordUserIds) {
        if (all) {
            return true;
        }
        if (includeSelf && userId != null && recordUserIds != null) {
            for (Long candidate : recordUserIds) {
                if (userId.equals(candidate)) {
                    return true;
                }
            }
        }
        return recordDeptId != null && deptIds.contains(recordDeptId);
    }

    public boolean overlapsDeptCsv(String rawDeptIds) {
        if (all || deptIds.isEmpty() || rawDeptIds == null || rawDeptIds.isBlank()) {
            return all;
        }
        for (String part : rawDeptIds.replace("[", "").replace("]", "").split("[,，;\\s]+")) {
            if (part.isBlank()) {
                continue;
            }
            try {
                if (deptIds.contains(Long.parseLong(part.trim()))) {
                    return true;
                }
            } catch (NumberFormatException ignored) {
                // ignore malformed historical fragments
            }
        }
        return false;
    }

    public void assertAllows(Long recordDeptId, Long... recordUserIds) {
        if (!allows(recordDeptId, recordUserIds)) {
            throw new AccessDeniedException("数据范围不足");
        }
    }
}
