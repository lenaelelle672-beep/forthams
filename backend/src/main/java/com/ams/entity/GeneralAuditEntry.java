package com.ams.entity;

import lombok.Data;
import java.util.Date;

@Data
public class GeneralAuditEntry {
    private Long id;
    private String traceId;
    private String action;
    private String beforeRecord;
    private String afterRecord;
    private Date timestamp;
}
