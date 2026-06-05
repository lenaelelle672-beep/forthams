package com.ams.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 入库验收创建 DTO。
 */
@Data
public class IntakeOrderCreateDTO {
    private Long vendorId;
    private LocalDate orderDate;
    private BigDecimal totalAmount;
    private String remark;
    private List<IntakeCheckItemDTO> checkItems;
    private List<IntakeAssetDTO> intakeAssets;
}
