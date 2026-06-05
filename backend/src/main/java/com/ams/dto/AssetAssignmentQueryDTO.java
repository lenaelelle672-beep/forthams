package com.ams.dto;

import lombok.Data;

/**
 * 领用单查询 DTO。
 */
@Data
public class AssetAssignmentQueryDTO {
    private String keyword;
    private Long assetId;
    private String status;
    private Long applicantId;

    /** 按领用类型筛选 */
    private String allocationType;

    private Integer page = 1;
    private Integer pageSize = 10;
}
