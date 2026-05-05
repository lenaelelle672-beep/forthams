package com.ams.dto;

import lombok.Data;

@Data
public class DeptAssetDistributionDTO {
    private Long deptId;
    private String deptName;
    private Long assetCount;
}
