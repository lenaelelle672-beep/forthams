package com.ams.enums;

import lombok.Getter;

@Getter
public enum InsuranceStatusEnum {
    ACTIVE("ACTIVE", "生效中"),
    EXPIRED("EXPIRED", "已过期"),
    CANCELLED("CANCELLED", "已取消");

    private final String code;
    private final String description;

    InsuranceStatusEnum(String code, String description) {
        this.code = code;
        this.description = description;
    }

    public static InsuranceStatusEnum fromCode(String code) {
        for (InsuranceStatusEnum status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown insurance status: " + code);
    }
}