package com.ams.enums;

import lombok.Getter;

/**
 * 合格标志枚举
 */
@Getter
public enum QualifiedStatus {
    PASSED("PASSED", "通过"),
    FAILED("FAILED", "不通过"),
    PARTIAL("PARTIAL", "部分通过");

    private final String code;
    private final String description;

    QualifiedStatus(String code, String description) {
        this.code = code;
        this.description = description;
    }

    public static QualifiedStatus fromCode(String code) {
        for (QualifiedStatus status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown qualified status: " + code);
    }
}