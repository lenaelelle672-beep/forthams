package com.ams.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/**
 * 批量生成检验记录请求 DTO
 */
@Data
public class InspectionBatchGenerateDTO {

    /**
     * 资产ID列表
     */
    @NotEmpty(message = "资产ID列表不能为空")
    private List<Long> assetIds;
}
