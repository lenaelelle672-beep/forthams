package com.ams.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class PurchaseOrderUpdateDTO {

    @Size(max = 200, message = "采购名称长度不能超过200")
    private String orderName;

    private BigDecimal totalAmount;

    private LocalDate orderDate;

    private LocalDate expectedDate;

    @Size(max = 500, message = "备注长度不能超过500")
    private String remark;

    private String status;
}
