package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ApprovalRecoveryDTO {

    private Long processId;
    private String processType;
    private Long businessId;
    private String status;
    private String cancellationReason;
    private LocalDateTime cancelledAt;
    private String resubmissionAction;
    private String resubmissionInstruction;
}
