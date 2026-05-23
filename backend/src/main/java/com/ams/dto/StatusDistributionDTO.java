package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 工单状态分布统计 DTO。
 *
 * <p>用于封装工单按状态分类的计数结果（如：已完成、进行中、待处理等）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatusDistributionDTO {

    /** 状态显示名称 */
    @JsonProperty("name")
    private String name;

    /** 该状态下的工单数量 */
    @JsonProperty("value")
    private long value;
}
