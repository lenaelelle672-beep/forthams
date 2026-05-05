package com.ams.enums;

import java.util.Locale;

public enum AssetStatus {
    IDLE(false),
    IN_USE(false),
    MAINTENANCE(false),
    PENDING_RETIREMENT(false),
    RETIRED(true),
    SCRAPPED(true),
    CLEARED(true);

    private final boolean terminal;

    AssetStatus(boolean terminal) {
        this.terminal = terminal;
    }

    public boolean isTerminal() {
        return terminal;
    }

    public boolean canTransitionTo(AssetStatus nextStatus) {
        if (nextStatus == null) {
            return false;
        }
        if (this == nextStatus) {
            return true;
        }
        if (terminal) {
            return false;
        }

        return switch (this) {
            case IDLE, IN_USE, MAINTENANCE -> nextStatus == IDLE
                    || nextStatus == IN_USE
                    || nextStatus == MAINTENANCE
                    || nextStatus == PENDING_RETIREMENT
                    || nextStatus == SCRAPPED
                    || nextStatus == CLEARED;
            case PENDING_RETIREMENT -> nextStatus == IDLE
                    || nextStatus == IN_USE
                    || nextStatus == MAINTENANCE
                    || nextStatus == RETIRED
                    || nextStatus == SCRAPPED;
            case RETIRED, SCRAPPED, CLEARED -> false;
        };
    }

    public boolean matches(String value) {
        try {
            return this == fromName(value);
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    public static AssetStatus fromNameOrDefault(String value, AssetStatus defaultStatus) {
        if (value == null || value.isBlank()) {
            return defaultStatus;
        }
        return fromName(value);
    }

    public static AssetStatus fromName(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Asset status must not be blank");
        }

        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "ACTIVE", "USING", "USED", "NORMAL" -> IN_USE;
            case "INACTIVE", "AVAILABLE", "UNUSED" -> IDLE;
            case "SCRAP", "DISPOSED" -> SCRAPPED;
            case "RETIRING", "PENDING_RETIRE", "PENDING_SCRAP", "PENDING_SCRAPPED" -> PENDING_RETIREMENT;
            case "RETIREMENT" -> RETIRED;
            default -> AssetStatus.valueOf(normalized);
        };
    }
}
