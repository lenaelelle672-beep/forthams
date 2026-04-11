package com.ams.entity;

import lombok.Data;
import java.util.Date;

@Data
public class GeneralAuditEntry {
    private String traceId;
    private Date timestamp;
    private String action;
    private String beforeRecord;
    private String afterRecord;
}
