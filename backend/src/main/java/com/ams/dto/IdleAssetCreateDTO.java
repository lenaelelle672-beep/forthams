package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class IdleAssetCreateDTO {
    @JsonAlias({"id", "assetId"})
    @NotNull(message = "资产ID不能为空")
    @Positive(message = "资产ID必须为正数")
    private Long assetId;
    @PositiveOrZero(message = "闲置天数不能为负数")
    @Max(value = 36500, message = "闲置天数超出允许范围")
    private Integer idleDays;
    @JsonAlias({"reason"})
    @Size(max = 500, message = "闲置原因长度不能超过500个字符")
    private String reason;
}
