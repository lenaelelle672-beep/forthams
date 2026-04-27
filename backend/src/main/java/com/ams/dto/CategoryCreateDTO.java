package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class CategoryCreateDTO {

    @JsonAlias({"name", "categoryName"})
    private String categoryName;
    @JsonAlias({"code", "categoryCode"})
    private String categoryCode;
    private Long parentId;
    private Integer sortOrder;
    private String description;
}
