package com.ams.dto;

import lombok.Data;

import java.time.LocalDate;

/**
 * 更新领用单 DTO。
 */
@Data
public class AssetAssignmentUpdateDTO {
    private Long assignedToUserId;
    private Long assignedToDeptId;
    private LocalDate expectedReturnDate;
    private String allocationType;
    private String returnCondition;
    private String remark;
}
