package com.ams.datascope;

import com.ams.annotation.DataScope;

public class DataScopeMeta {

    private final String deptColumn;
    private final String userColumn;
    private final boolean enabled;

    public DataScopeMeta(DataScope annotation) {
        this.deptColumn = annotation.deptColumn();
        this.userColumn = annotation.userColumn();
        this.enabled = annotation.enabled();
    }

    public String getDeptColumn() { return deptColumn; }
    public String getUserColumn() { return userColumn; }
    public boolean isEnabled() { return enabled; }
}
