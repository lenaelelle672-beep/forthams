package com.ams.dto;

import com.ams.entity.PurchaseOrderItem;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class PurchaseOrderCreateDTO {

    @NotBlank(message = "采购单号不能为空")
    @Size(max = 50, message = "采购单号长度不能超过50")
    private String orderNo;

    @NotBlank(message = "采购名称不能为空")
    @Size(max = 200, message = "采购名称长度不能超过200")
    private String orderName;

    @NotNull(message = "供应商不能为空")
    private Long vendorId;

    private BigDecimal totalAmount;

    private LocalDate orderDate;

    private LocalDate expectedDate;

    @Size(max = 500, message = "备注长度不能超过500")
    private String remark;

    @NotEmpty(message = "采购明细不能为空")
    private List<PurchaseOrderItem> items;
}
