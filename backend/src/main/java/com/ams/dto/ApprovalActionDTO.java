package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ApprovalActionDTO {

    @NotBlank(message = "审批结果不能为空")
    private String approveResult;

    private String approveOpinion;
}
