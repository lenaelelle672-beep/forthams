package com.ams.enums;

import java.util.Locale;

public enum CompensationStatus {
    PENDING,
    APPROVED,
    REJECTED,
    CANCELLED_REQUIRES_RESUBMISSION;

    public boolean canTransitionTo(CompensationStatus target) {
        return this == PENDING && (target == APPROVED || target == REJECTED);
    }

    public static CompensationStatus fromStoredValue(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Compensation status must not be blank");
        }
        return valueOf(value.trim().toUpperCase(Locale.ROOT));
    }
}
