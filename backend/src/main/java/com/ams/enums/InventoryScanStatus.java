package com.ams.enums;

import java.util.Locale;

public enum InventoryScanStatus {
    MATCH(true),
    MISMATCH(false),
    SURPLUS(false),
    LOSS(false),
    DAMAGED(false),
    OTHER(false);

    private final boolean match;

    InventoryScanStatus(boolean match) {
        this.match = match;
    }

    public boolean isMatch() {
        return match;
    }

    public static InventoryScanStatus fromName(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Inventory scan status must not be blank");
        }
        return switch (value.trim().toUpperCase(Locale.ROOT)) {
            case "NORMAL" -> MATCH;
            case "DEFICIT" -> LOSS;
            default -> InventoryScanStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        };
    }
}
