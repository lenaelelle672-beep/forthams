package com.ams.datascope;

public enum DataScopeType {

    ALL(1, "全部数据"),
    CUSTOM(2, "自定义部门"),
    DEPT_ONLY(3, "本部门"),
    DEPT_AND_CHILD(4, "本部门及以下"),
    SELF_ONLY(5, "仅本人");

    private final int code;
    private final String description;

    DataScopeType(int code, String description) {
        this.code = code;
        this.description = description;
    }

    public int getCode() { return code; }

    public static DataScopeType fromCode(Integer code) {
        if (code == null) return ALL;
        for (DataScopeType t : values()) {
            if (t.code == code) return t;
        }
        return ALL;
    }
}
