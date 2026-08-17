package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AssetClearanceDTO {

    @NotNull(message = "资产ID不能为空")
    @Positive(message = "资产ID必须为正数")
    private Long assetId;

    @NotBlank(message = "处置原因不能为空")
    @Size(max = 500, message = "处置原因长度不能超过500个字符")
    private String reason;
}
