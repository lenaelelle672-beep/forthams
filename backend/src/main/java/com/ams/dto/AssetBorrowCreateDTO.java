package com.ams.dto;

import lombok.Data;

import java.time.LocalDate;

/**
 * 创建借用单 DTO。
 */
@Data
public class AssetBorrowCreateDTO {
    private Long assetId;
    private LocalDate expectedReturnDate;
    private String purpose;
    private String remark;
}
