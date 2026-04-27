package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonAlias;

@Data
public class CategoryCreateDTO {

    private String categoryName;
    @JsonAlias("name")

    private String categoryCode;

    private Long parentId;
    private Integer sortOrder;
    private String description;
}
