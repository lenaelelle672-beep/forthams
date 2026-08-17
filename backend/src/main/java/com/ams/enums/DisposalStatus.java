package com.ams.enums;

public enum DisposalStatus {
    PENDING,
    APPROVED,
    REJECTED,
    CANCELLED_REQUIRES_RESUBMISSION,
    CANCELLED;

    public boolean canTransitionTo(DisposalStatus target) {
        return this == PENDING && (target == APPROVED || target == REJECTED || target == CANCELLED);
    }
}
