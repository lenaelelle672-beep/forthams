package com.ams.dto;

import lombok.Data;

@Data
public class MaintenancePlanQueryDTO {

    private Long assetId;

    private String triggerType;

    private String status;

    private Integer page = 1;

    private Integer pageSize = 10;
}
