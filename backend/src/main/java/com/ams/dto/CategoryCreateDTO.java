package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CategoryCreateDTO {

    @NotBlank(message = "分类名称不能为空")
    private String categoryName;

    @NotBlank(message = "分类编码不能为空")
    private String categoryCode;

    private Long parentId;
    private Integer sortOrder;
    private String description;
}
