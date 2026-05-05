package com.ams.dto;

import lombok.Data;

@Data
public class AssetQueryDTO {

    private String assetNo;
    private String assetName;
    private String keyword;
    private Long categoryId;
    private String status;
    private Long deptId;
    private Integer isImportant;
    
    private Integer page = 1;
    private Integer pageSize = 10;

}
