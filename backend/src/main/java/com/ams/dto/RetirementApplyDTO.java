package com.ams.dto;

import com.ams.entity.RetirementApplication;
import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
public class RetirementApplyDTO {
    @JsonAlias("asset_id")
    @NotNull(message = "资产ID不能为空")
    @Positive(message = "资产ID必须为正数")
    private Long assetId;
    @NotBlank(message = "报废原因不能为空")
    @Size(max = 500, message = "报废原因长度不能超过500个字符")
    private String reason;
    @JsonAlias("estimated_residual_value")
    @DecimalMin(value = "0.00", message = "预计残值不能为负数")
    @Digits(integer = 13, fraction = 2, message = "预计残值最多13位整数和2位小数")
    private BigDecimal estimatedResidualValue;
    @JsonAlias("retirement_type")
    @NotNull(message = "退役类型不能为空")
    private RetirementApplication.RetirementType retirementType;
    @Size(max = 4096, message = "附件信息长度不能超过4096个字符")
    private String attachments;
    @Size(max = 1000, message = "备注长度不能超过1000个字符")
    private String remark;
}
