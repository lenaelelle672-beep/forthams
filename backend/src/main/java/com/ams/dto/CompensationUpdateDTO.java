package com.ams.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CompensationUpdateDTO {

    private Long assetId;
    private String compensationType;
    private BigDecimal compensationAmount;
    private Long responsibleUserId;
    private Long responsibleDeptId;
    private LocalDate incidentDate;
    private String description;
}
