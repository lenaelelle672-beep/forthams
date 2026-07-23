package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class ApprovalCreateDTO {
    @JsonAlias({"processType", "type"})
    @NotBlank
    @Size(max = 64)
    private String processType;
    @NotBlank
    @Size(max = 256)
    private String title;
    private String description;
    @JsonAlias({"businessId", "assetId"})
    private Long businessId = 0L;
    private String businessType;
    private Long applicantId;
    private String businessData;
}
