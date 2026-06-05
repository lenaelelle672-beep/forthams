package com.ams.enums;

import lombok.Getter;

/**
 * 检验类型枚举
 */
@Getter
public enum InspectionTypeEnum {
    ANNUAL("ANNUAL", "年度检验"),
    PERIODIC("PERIODIC", "定期检验"),
    SPECIAL("SPECIAL", "专项检验");

    private final String code;
    private final String description;

    InspectionTypeEnum(String code, String description) {
        this.code = code;
        this.description = description;
    }

    public static InspectionTypeEnum fromCode(String code) {
        for (InspectionTypeEnum type : values()) {
            if (type.getCode().equals(code)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown inspection type: " + code);
    }
}