package com.ams.dto;

import lombok.Data;

import java.time.LocalDate;

/**
 * 更新借用单 DTO。
 */
@Data
public class AssetBorrowUpdateDTO {
    private LocalDate expectedReturnDate;
    private String purpose;
    private String remark;
}
