package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 添加物料请求 DTO。
 */
@Data
public class ExecutionMaterialCreateDTO {

    @NotNull(message = "执行ID不能为空")
    private Long executionId;

    @NotBlank(message = "物料名称不能为空")
    private String materialName;

    private String specification;

    @NotNull(message = "数量不能为空")
    @Positive(message = "数量必须大于0")
    private BigDecimal quantity;

    private BigDecimal unitPrice;

    /** 合计金额（客户端提交，后端会校验与 quantity*unitPrice 的一致性） */
    private BigDecimal totalPrice;

    private String sourceWarehouse;

    private String remark;
}
