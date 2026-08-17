package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AssetTransferDTO {

    @NotNull(message = "资产ID不能为空")
    @Positive(message = "资产ID必须为正数")
    private Long assetId;

    @NotNull(message = "目标部门不能为空")
    @Positive(message = "目标部门ID必须为正数")
    private Long targetDeptId;

    @Positive(message = "目标用户ID必须为正数")
    private Long targetUserId;
    @Size(max = 256, message = "目标位置长度不能超过256个字符")
    private String targetLocation;
    @NotBlank(message = "处置原因不能为空")
    @Size(max = 500, message = "处置原因长度不能超过500个字符")
    private String reason;
}
