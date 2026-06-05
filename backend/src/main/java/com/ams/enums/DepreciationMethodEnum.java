package com.ams.enums;

public enum DepreciationMethodEnum {
    STRAIGHT_LINE("直线法"),
    DOUBLE_DECLINING("双倍余额递减法"),
    SYD("年数总和法"),
    UOP("工作量法");

    private final String label;

    DepreciationMethodEnum(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
