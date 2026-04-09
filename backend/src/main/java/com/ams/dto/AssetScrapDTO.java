package com.ams.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AssetScrapDTO {

    @NotNull(message = "资产ID不能为空")
    private Long assetId;

    private String reason;
}
