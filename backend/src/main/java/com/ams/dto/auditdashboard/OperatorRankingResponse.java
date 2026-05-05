package com.ams.dto.auditdashboard;

import lombok.*;

import java.io.Serializable;
import java.util.List;

/**
 * 操作人排行榜响应 DTO。
 * 包装 TOP 10 操作人排行列表，对应 ATB-007 / ATB-008 验收标准。
 *
 * <p>JSON 示例:
 * <pre>
 * {
 *   "ranking": [
 *     {"rank": 1, "operatorId": "user-001", "operatorName": "张三", "count": 50},
 *     {"rank": 2, "operatorId": "user-002", "operatorName": "李四", "count": 30}
 *   ]
 * }
 * </pre>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OperatorRankingResponse implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 操作人排行列表，按 count 降序排列，固定 TOP 10。
     * 无数据时返回空列表 []，禁止返回 null。
     */
    @Builder.Default
    private List<OperatorRankingItem> ranking = List.of();
}