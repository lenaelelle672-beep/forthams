package com.ams.dto;

import lombok.Data;

@Data
public class AuditChange {
    private String field;
    private String oldValue;
    private String newValue;
    private String changedBy;
    private String changedAt;

    public AuditChange() {}

    public AuditChange(String field, String oldValue, String newValue,
                       String changedBy, String changedAt) {
        this.field = field;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.changedBy = changedBy;
        this.changedAt = changedAt;
    }
}
