package com.ams.datascope;

import java.util.Set;

public class DataScopeResult {

    private final DataScopeType type;
    private final Set<Long> deptIds;
    private final Long userId;

    public DataScopeResult(DataScopeType type, Set<Long> deptIds, Long userId) {
        this.type = type;
        this.deptIds = deptIds;
        this.userId = userId;
    }

    public static DataScopeResult all() { return new DataScopeResult(DataScopeType.ALL, null, null); }
    public static DataScopeResult none() { return new DataScopeResult(DataScopeType.SELF_ONLY, Set.of(), null); }

    public DataScopeType getType() { return type; }
    public Set<Long> getDeptIds() { return deptIds != null ? deptIds : Set.of(); }
    public Long getUserId() { return userId; }

    public boolean isAll() { return type == DataScopeType.ALL; }
    public boolean isSelfOnly() { return type == DataScopeType.SELF_ONLY; }
    public boolean isEnabled() { return type != DataScopeType.ALL; }
}
