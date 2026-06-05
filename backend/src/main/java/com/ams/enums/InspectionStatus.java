package com.ams.enums;

import lombok.Getter;

/**
 * 检验状态枚举
 */
@Getter
public enum InspectionStatus {
    PENDING("PENDING", "待处理"),
    IN_PROGRESS("IN_PROGRESS", "进行中"),
    COMPLETED("COMPLETED", "已完成"),
    CANCELLED("CANCELLED", "已取消"),
    OVERDUE("OVERDUE", "已逾期");

    private final String code;
    private final String description;

    InspectionStatus(String code, String description) {
        this.code = code;
        this.description = description;
    }

    public static InspectionStatus fromCode(String code) {
        for (InspectionStatus status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown inspection status: " + code);
    }
}