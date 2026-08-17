package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RetirementRejectRequestDTO {

    @JsonAlias({"comment", "opinion"})
    @Size(max = 500, message = "审批意见长度不能超过500个字符")
    private String reason;
}
