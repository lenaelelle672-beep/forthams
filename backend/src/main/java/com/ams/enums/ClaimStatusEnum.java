package com.ams.enums;

import lombok.Getter;

@Getter
public enum ClaimStatusEnum {
    PENDING("PENDING", "待处理"),
    APPROVED("APPROVED", "已批准"),
    REJECTED("REJECTED", "已拒绝");

    private final String code;
    private final String description;

    ClaimStatusEnum(String code, String description) {
        this.code = code;
        this.description = description;
    }

    public static ClaimStatusEnum fromCode(String code) {
        for (ClaimStatusEnum status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown claim status: " + code);
    }
}