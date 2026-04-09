package com.ams.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AssetTransferDTO {

    @NotNull(message = "资产ID不能为空")
    private Long assetId;

    @NotNull(message = "目标部门不能为空")
    private Long targetDeptId;

    private Long targetUserId;
    private String targetLocation;
    private String reason;
}
