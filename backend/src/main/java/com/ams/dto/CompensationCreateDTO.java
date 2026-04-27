package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CompensationCreateDTO {
    private Long assetId;
    @JsonAlias({"type", "compensationType"})
    private String compensationType;
    @JsonAlias({"amount", "compensationAmount"})
    private BigDecimal compensationAmount;
    @JsonAlias({"reason", "description"})
    private String description;
    @JsonAlias({"date", "incidentDate"})
    private LocalDate incidentDate;
    @JsonAlias({"employee", "responsibleUserId"})
    private Long responsibleUserId;
    @JsonAlias({"department", "responsibleDeptId"})
    private Long responsibleDeptId;
}
