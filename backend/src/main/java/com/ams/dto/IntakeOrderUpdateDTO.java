package com.ams.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 入库验收更新 DTO。
 */
@Data
public class IntakeOrderUpdateDTO {
    private String remark;
    private LocalDate orderDate;
    private BigDecimal totalAmount;
}
