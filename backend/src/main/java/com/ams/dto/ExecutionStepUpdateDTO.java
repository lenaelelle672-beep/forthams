package com.ams.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 更新施工步骤请求 DTO。
 */
@Data
public class ExecutionStepUpdateDTO {

    private String stepName;

    private Integer stepOrder;

    private String description;

    private Long operatorId;

    private String operatorName;

    private BigDecimal laborHours;
}
