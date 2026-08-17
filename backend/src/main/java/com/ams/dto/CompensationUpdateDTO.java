package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CompensationUpdateDTO {
    @Positive(message = "资产ID必须为正数")
    private Long assetId;
    @JsonAlias({"type", "compensationType"})
    @Size(max = 32, message = "赔偿类型长度不能超过32个字符")
    private String compensationType;
    @JsonAlias({"amount", "compensationAmount"})
    @DecimalMin(value = "0.01", message = "赔偿金额必须大于0")
    @Digits(integer = 8, fraction = 2, message = "赔偿金额最多8位整数和2位小数")
    private BigDecimal compensationAmount;
    @JsonAlias({"reason", "description"})
    @Size(max = 500, message = "赔偿说明长度不能超过500个字符")
    private String description;
    @JsonAlias({"date", "incidentDate"})
    private LocalDate incidentDate;
    @JsonAlias({"employee", "responsibleUserId"})
    @Positive(message = "赔偿责任人ID必须为正数")
    private Long responsibleUserId;
    @JsonAlias({"department", "responsibleDeptId"})
    @Positive(message = "责任部门ID必须为正数")
    private Long responsibleDeptId;
}
