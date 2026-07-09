package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomFieldsetQueryDTO {
    private Integer page;
    private Integer pageSize;
    private Integer size;
    private String keyword;
    private Integer status;
    private Long categoryId;
}
