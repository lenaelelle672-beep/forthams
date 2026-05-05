package com.ams.dto;

import lombok.Data;

@Data
public class WorkflowStatusUpdateDTO {
    private String status;
    private Long operatorId;
}
