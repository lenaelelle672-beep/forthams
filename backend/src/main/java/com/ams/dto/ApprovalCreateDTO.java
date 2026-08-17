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
    @Size(max = 2000)
    private String description;
    @JsonAlias({"businessId", "assetId"})
    @NotNull
    @Positive
    private Long businessId;
    @Size(max = 64)
    private String businessType;
    private Long applicantId;
    @Size(max = 4096)
    private String businessData;
}
