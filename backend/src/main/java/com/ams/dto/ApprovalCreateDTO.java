package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ApprovalCreateDTO {

    @NotBlank(message = "流程类型不能为空")
    private String processType;

    @NotNull(message = "业务ID不能为空")
    private Long businessId;

    private String businessData;

    @NotNull(message = "申请人不能为空")
    private Long applicantId;
}
