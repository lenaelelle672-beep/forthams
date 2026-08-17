package com.ams.enums;

import java.util.Locale;
import java.util.Optional;

public enum DataScope {
    ALL,
    DEPT_AND_SUB,
    DEPT,
    SELF,
    CUSTOM;

    public static Optional<DataScope> fromValue(String value) {
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(DataScope.valueOf(value.trim().toUpperCase(Locale.ROOT)));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
