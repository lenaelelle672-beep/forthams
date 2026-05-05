package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
public class RetirementApplyDTO {
    @JsonAlias("asset_id")
    private Long assetId;
    private String reason;
    @JsonAlias("estimated_residual_value")
    private BigDecimal estimatedResidualValue;
    @JsonAlias("retirement_type")
    private String retirementType;
    private String attachments;
    private String remark;
}
