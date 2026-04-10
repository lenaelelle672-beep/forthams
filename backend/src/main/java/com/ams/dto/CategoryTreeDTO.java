package com.ams.dto;

import com.ams.entity.AssetCategory;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class CategoryTreeDTO extends AssetCategory {
    private List<CategoryTreeDTO> children;
}
