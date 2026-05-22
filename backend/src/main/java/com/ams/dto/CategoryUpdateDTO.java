package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CategoryUpdateDTO {

    @NotBlank(message = "分类名称不能为空")
    private String categoryName;

    private String categoryCode;

    private Long parentId;
    private Integer sortOrder;
    private String description;
}
