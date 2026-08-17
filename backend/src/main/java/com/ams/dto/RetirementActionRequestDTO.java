package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RetirementActionRequestDTO {

    @JsonAlias({"applicationId", "application_id", "retirementId", "retirement_id", "task_id"})
    @NotNull(message = "退役申请ID不能为空")
    @Positive(message = "退役申请ID必须为正数")
    private Long id;

    @JsonAlias({"comment", "opinion"})
    @Size(max = 500, message = "审批意见长度不能超过500个字符")
    private String reason;
}
