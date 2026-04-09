package com.ams.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class IdleAssetCreateDTO {

    @NotNull(message = "资产ID不能为空")
    private Long assetId;

    @NotNull(message = "闲置天数不能为空")
    private Integer idleDays;
}
