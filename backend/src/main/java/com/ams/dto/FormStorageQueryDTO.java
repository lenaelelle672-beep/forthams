package com.ams.dto;

import lombok.Data;

@Data
public class FormStorageQueryDTO {
    private String formKey;
    private Integer definitionVersion;
    private String status;
    private String keyword;
    private Boolean includeArchived;
    private Integer pageNum;
    private Integer pageSize;
}
