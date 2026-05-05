package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * DTO for log trend aggregation response.
 * Used by the SWARM-003 operational log dashboard API.
 * 
 * @since SWARM-003 Iteration 1
 * @see com.ams.controller.OperationLogDashboardController
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogTrendDTO {
    
    /**
     * Timestamp of the trend data point.
     * Format: ISO 8601 with timezone.
     */
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'")
    private LocalDateTime timestamp;
    
    /**
     * Total count of logs at this time point.
     */
    private Long count;
    
    /**
     * Breakdown of counts by dimension (e.g., action type, status).
     * Optional field, only present when breakdown parameter is requested.
     */
    private Map<String, Long> breakdown;
}