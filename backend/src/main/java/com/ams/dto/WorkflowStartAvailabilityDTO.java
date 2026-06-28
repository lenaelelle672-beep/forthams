package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowStartAvailabilityDTO {
    private String businessType;
    private boolean canStart;
    private String status;
    private Integer version;
    private Long definitionId;
    private String entryUrl;
    private String blockReason;
}
