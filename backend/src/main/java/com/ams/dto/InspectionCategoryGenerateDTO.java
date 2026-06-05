package com.ams.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 按类别批量生成检验记录请求 DTO
 */
@Data
public class InspectionCategoryGenerateDTO {

    /**
     * 资产类别ID
     */
    @NotNull(message = "资产类别ID不能为空")
    private Long assetCategoryId;
}
