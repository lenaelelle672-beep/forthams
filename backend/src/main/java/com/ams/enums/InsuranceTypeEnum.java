package com.ams.enums;

import lombok.Getter;

@Getter
public enum InsuranceTypeEnum {
    PROPERTY("PROPERTY", "财产险"),
    LIABILITY("LIABILITY", "责任险"),
    VEHICLE("VEHICLE", "车险");

    private final String code;
    private final String description;

    InsuranceTypeEnum(String code, String description) {
        this.code = code;
        this.description = description;
    }

    public static InsuranceTypeEnum fromCode(String code) {
        for (InsuranceTypeEnum type : values()) {
            if (type.getCode().equals(code)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown insurance type: " + code);
    }
}