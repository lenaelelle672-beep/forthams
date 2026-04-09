package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CompensationCreateDTO {

    @NotNull(message = "资产ID不能为空")
    private Long assetId;

    @NotBlank(message = "赔偿类型不能为空")
    private String compensationType;

    @NotNull(message = "赔偿金额不能为空")
    private BigDecimal compensationAmount;

    @NotNull(message = "责任人不能为空")
    private Long responsibleUserId;

    private Long responsibleDeptId;
    private LocalDate incidentDate;
    private String description;
}
