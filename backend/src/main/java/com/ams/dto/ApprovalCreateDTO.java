package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ApprovalCreateDTO {
    @NotBlank(message = "审批流程类型不能为空")
    @JsonAlias({"processType", "type"})
    private String processType;
    @NotBlank(message = "审批标题不能为空")
    private String title;
    private String description;
    @NotNull(message = "业务ID不能为空")
    @JsonAlias({"businessId", "assetId"})
    private Long businessId = 0L;
    private String businessType;
    @NotNull(message = "申请人不能为空")
    private Long applicantId;
    private String businessData;
}
