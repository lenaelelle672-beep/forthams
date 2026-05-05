package com.ams.dto.auditdashboard;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO representing a single entry in the operator ranking list.
 * Each item contains the operator's rank, identifier, display name,
 * and total operation count for the queried period.
 *
 * @see OperatorRankingResponse
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OperatorRankingItem {

    /**
     * The rank position of this operator in the leaderboard (1-based).
     */
    private Integer rank;

    /**
     * The unique identifier of the operator.
     */
    private String operatorId;

    /**
     * The display name of the operator.
     */
    private String operatorName;

    /**
     * Total number of operations performed by this operator
     * within the specified time range.
     */
    private Long count;
}