package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomFieldQueryDTO {
    private Integer page;
    private Integer pageSize;
    private Integer size;
    private String keyword;
    private String fieldType;
    private Integer status;
}
