package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class MaintenanceUpdateDTO {
    @JsonAlias({"equipmentId", "assetId"})
    @Positive(message = "资产ID必须为正数")
    private Long assetId;
    @JsonAlias({"type", "maintenanceType"})
    @NotBlank(message = "维护类型不能为空")
    @Size(max = 32, message = "维护类型长度不能超过32个字符")
    private String maintenanceType;
    private LocalDate maintenanceDate;
    @JsonAlias({"technician", "executor"})
    @Size(max = 128, message = "执行人长度不能超过128个字符")
    private String executor;
    @JsonAlias({"duration"})
    @PositiveOrZero(message = "维护时长不能为负数")
    @Max(value = 525600, message = "维护时长超出允许范围")
    private Integer duration;
    @JsonAlias({"content", "description"})
    @Size(max = 4000, message = "维护内容长度不能超过4000个字符")
    private String content;
    @JsonAlias({"cost"})
    @DecimalMin(value = "0.00", message = "维护费用不能为负数")
    @Digits(integer = 8, fraction = 2, message = "维护费用最多8位整数和2位小数")
    private BigDecimal cost;
    private LocalDate nextMaintenanceDate;
    @JsonAlias({"result"})
    @Size(max = 32, message = "维护结果长度不能超过32个字符")
    private String result;
    @JsonAlias({"remark"})
    @Size(max = 1000, message = "维护备注长度不能超过1000个字符")
    private String remark;
}
