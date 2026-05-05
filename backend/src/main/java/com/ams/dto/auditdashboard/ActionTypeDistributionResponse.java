package com.ams.dto.auditdashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 操作类型分布响应 DTO。
 * <p>
 * 返回 action_type 的全部枚举聚合结果，字段使用 camelCase。
 * 对应验收测试基准 ATB-005 / ATB-006。
 * </p>
 *
 * <pre>
 * 示例响应:
 * {
 *   "totalOperations": 17,
 *   "distribution": [
 *     {"actionType": "LOGIN", "count": 10, "percentage": 58.82},
 *     {"actionType": "CREATE", "count": 5, "percentage": 29.41},
 *     {"actionType": "DELETE", "count": 2, "percentage": 11.76}
 *   ]
 * }
 * </pre>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActionTypeDistributionResponse {

    /**
     * 所有操作类型的总操作次数。
     */
    private Long totalOperations;

    /**
     * 按 actionType 聚合的分布列表，按 count 降序排列。
     * 无数据时返回空列表 []，禁止返回 null。
     */
    private List<ActionTypeDistributionItem> distribution;

    /**
     * 单个操作类型的分布统计条目。
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActionTypeDistributionItem {

        /**
         * 操作类型名称（对应 AuditLog.actionType）。
         */
        private String actionType;

        /**
         * 该类型的操作次数。
         */
        private Long count;

        /**
         * 该类型占总操作次数的百分比，保留两位小数。
         * 计算公式：count / totalOperations * 100
         */
        private Double percentage;
    }
}