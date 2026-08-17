package com.ams.dto;

import com.ams.enums.ApprovalDecision;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ApprovalDecisionDTO {

    @NotNull(message = "审批结果不能为空")
    private ApprovalDecision result;

    @Size(max = 1000, message = "审批意见长度不能超过1000个字符")
    private String opinion;
}
