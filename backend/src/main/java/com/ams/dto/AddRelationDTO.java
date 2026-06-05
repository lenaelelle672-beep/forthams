package com.ams.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 添加资产父子关系请求 DTO。
 */
@Data
public class AddRelationDTO {

    @NotNull(message = "父资产ID不能为空")
    private Long parentAssetId;

    @NotNull(message = "子资产ID不能为空")
    private Long childAssetId;

    /** 关系类型：SPARE_PART/ACCESSORY/UPGRADE/ATTACHMENT/OTHER */
    private String relationType;

    /** 数量（默认 1） */
    @Min(value = 1, message = "数量不能小于 1")
    @Max(value = 9999, message = "数量不能超过 9999")
    private Integer quantity;

    /** 备注 */
    private String remark;

}
