package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class CompensationCreateDTO {
    private Long assetId;
    private String compensationType;
    @JsonAlias({"amount", "compensationAmount"})
    private BigDecimal compensationAmount;
    private String description;
}
