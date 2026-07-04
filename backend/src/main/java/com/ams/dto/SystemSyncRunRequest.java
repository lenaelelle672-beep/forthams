package com.ams.dto;

import lombok.Data;

@Data
public class SystemSyncRunRequest {

    private Boolean dryRun;
    private Boolean confirmRealRun;
    private String triggerSource;
    private String requestId;
    private String idempotencyKey;
    private String remark;
}
