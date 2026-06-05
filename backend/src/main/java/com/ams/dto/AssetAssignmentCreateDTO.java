package com.ams.dto;

import lombok.Data;

import java.time.LocalDate;

/**
 * 创建领用单 DTO。
 */
@Data
public class AssetAssignmentCreateDTO {
    private Long assetId;
    private Long assignedToUserId;
    private Long assignedToDeptId;
    private LocalDate expectedReturnDate;
    private String remark;

    /** 领用类型，默认 ASSIGNMENT */
    private String allocationType = "ASSIGNMENT";
}
