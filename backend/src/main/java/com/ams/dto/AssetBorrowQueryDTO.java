package com.ams.dto;

import lombok.Data;

/**
 * 借用单查询 DTO。
 */
@Data
public class AssetBorrowQueryDTO {
    private String keyword;
    private Long assetId;
    private String status;
    private Integer page = 1;
    private Integer pageSize = 10;
}
