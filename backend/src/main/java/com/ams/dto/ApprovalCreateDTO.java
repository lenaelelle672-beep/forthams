package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class ApprovalCreateDTO {
    @JsonAlias({"processType", "type"})
    private String processType;
    private String title;
    private String description;
    @JsonAlias({"businessId", "assetId"})
    private Long businessId = 0L;
    private String businessType;
    private Long applicantId;
    private String businessData;
}
