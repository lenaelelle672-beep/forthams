package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StocktakingCycleStatsDTO {
    private long totalCount;
    private long pendingCount;
    private long countedCount;
    private long adjustedCount;
    private long completedCount;
}
