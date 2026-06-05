package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 创建施工步骤请求 DTO。
 */
@Data
public class ExecutionStepCreateDTO {

    @NotNull(message = "执行ID不能为空")
    private Long executionId;

    @NotBlank(message = "步骤名称不能为空")
    private String stepName;

    private Integer stepOrder;

    private String description;

    private Long operatorId;

    private String operatorName;

    private BigDecimal laborHours;
}
