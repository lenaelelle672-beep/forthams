package com.ams.dto.auditdashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 操作类型分布统计项 DTO
 * 用于展示不同操作类型的日志数量占比情况
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActionTypeDistributionItem {

    /**
     * 操作类型名称 (例如: CREATE, UPDATE, DELETE 等)
     */
    private String actionType;

    /**
     * 该操作类型的日志总数
     */
    private Long count;

    /**
     * 该操作类型占总数的百分比 (0.0 - 100.0)，保留两位小数
     */
    private Double percentage;
}