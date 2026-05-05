package com.ams.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class AssetValueTrendDTO {
    private LocalDate date;
    private BigDecimal totalValue;
    private BigDecimal netValue;
}
