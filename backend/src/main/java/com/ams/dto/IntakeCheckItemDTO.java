package com.ams.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 验收检查项 DTO。
 */
@Data
public class IntakeCheckItemDTO {
    private String itemName;
    private String expectedValue;
    private String actualValue;
    private String result;
    private String remark;
}
