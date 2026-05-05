package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.LogTrendDTO;
import com.ams.entity.OperationLog;
import com.ams.service.LogAggregationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Operation Log Dashboard Controller
 * 
 * Provides REST API endpoints for the operation log dashboard, enabling users to:
 * - Query and filter operation logs with multi-dimensional criteria
 * - Aggregate log trends by time granularity (day/week/month)
 * - View individual log details
 * 
 * @author SWARM-003 Team
 * @version 1.0.0
 * @since Iteration 1
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/logs")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class OperationLogDashboardController {

    private final LogAggregationService logAggregationService;

    /**
     * Query operation logs with multi-dimensional filtering and pagination.
     * 
     * Supports filtering by:
     * - Time range (start_time, end_time) - maximum 90 days span
     * - Action type (CREATE, UPDATE, DELETE, READ)
     * - Status (SUCCESS, FAILURE)
     * - Operator ID
     * - Resource type
     * 
     * Pagination parameters:
     * - page: page number (default 1)
     * - page_size: items per page (default 20, max 100)
     * - sort_by: field to sort by (default timestamp)
     * - order: sort order (asc/desc, default desc)
     *
     * @param page         page number (1-based index)
     * @param pageSize     number of items per page (max 100)
     * @param startTime    start of time range filter (ISO 8601 format)
     * @param endTime      end of time range filter (ISO 8601 format)
     * @param action       filter by action type (CREATE/UPDATE/DELETE/READ)
     * @param status       filter by status (SUCCESS/FAILURE)
     * @param operatorId   filter by operator ID
     * @param resourceType filter by resource type
     * @param sortBy       field to sort by (timestamp/action/status)
     * @param order        sort direction (asc/desc)
     * @return paginated list of operation logs
     */
    @GetMapping
    public ResponseEntity<Result<Map<String, Object>>> queryLogs(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer pageSize,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String operatorId,
            @RequestParam(required = false) String resourceType,
            @RequestParam(defaultValue = "timestamp") String sortBy,
            @RequestParam(defaultValue = "desc") String order) {

        // Validate time range (max 90 days)
        if (startTime != null && endTime != null) {
            long daysBetween = java.time.Duration.between(startTime, endTime).toDays();
            if (daysBetween > 90) {
                return ResponseEntity.badRequest().body(
                    Result.error("time_range_exceeds_limit", "Time range cannot exceed 90 days")
                );
            }
        }

        // Limit page size to 100
        pageSize = Math.min(pageSize, 100);

        log.info("Querying logs: page={}, pageSize={}, action={}, status={}, operatorId={}", 
                 page, pageSize, action, status, operatorId);

        Map<String, Object> result = logAggregationService.queryLogs(
            page, pageSize, startTime, endTime, action, status, operatorId, resourceType, sortBy, order
        );

        return ResponseEntity.ok(Result.success(result));
    }

    /**
     * Aggregate log trends by time granularity.
     * 
     * Returns time-series data points with optional breakdown by action or status.
     * Useful for visualizing log volume patterns over time.
     * 
     * Supported granularity options:
     * - day: daily aggregation
     * - week: weekly aggregation  
     * - month: monthly aggregation
     * 
     * Breakdown options:
     * - action: count grouped by action type
     * - status: count grouped by status
     * 
     * Time range is limited to 90 days maximum.
     *
     * @param startTime   start of time range (ISO 8601 format)
     * @param endTime     end of time range (ISO 8601 format)
     * @param granularity time bucket size (day/week/month, default day)
     * @param breakdown   grouping dimension (action/status, optional)
     * @return aggregated trend data points
     */
    @GetMapping("/trends")
    public ResponseEntity<Result<Map<String, Object>>> getLogTrends(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime,
            @RequestParam(defaultValue = "day") String granularity,
            @RequestParam(required = false) String breakdown) {

        // Validate time range (max 90 days)
        long daysBetween = java.time.Duration.between(startTime, endTime).toDays();
        if (daysBetween > 90) {
            return ResponseEntity.badRequest().body(
                Result.error("time_range_exceeds_limit", "Time range cannot exceed 90 days")
            );
        }

        // Validate granularity
        if (!List.of("day", "week", "month").contains(granularity.toLowerCase())) {
            return ResponseEntity.badRequest().body(
                Result.error("invalid_granularity", "Granularity must be day, week, or month")
            );
        }

        log.info("Getting log trends: startTime={}, endTime={}, granularity={}, breakdown={}", 
                 startTime, endTime, granularity, breakdown);

        Map<String, Object> trends = logAggregationService.getLogTrends(
            startTime, endTime, granularity, breakdown
        );

        return ResponseEntity.ok(Result.success(trends));
    }

    /**
     * Get detailed information for a specific operation log entry.
     *
     * @param id the unique identifier of the log entry
     * @return the full log entry details including metadata
     */
    @GetMapping("/{id}")
    public ResponseEntity<Result<OperationLog>> getLogById(@PathVariable String id) {
        log.info("Fetching log detail for id={}", id);
        
        OperationLog logEntry = logAggregationService.getLogById(id);
        
        if (logEntry == null) {
            return ResponseEntity.ok(Result.error("log_not_found", "Log entry not found with id: " + id));
        }
        
        return ResponseEntity.ok(Result.success(logEntry));
    }

    /**
     * Get aggregated statistics summary for the dashboard.
     * 
     * Returns key metrics including:
     * - Total log count in time range
     * - Breakdown by status (success/failure)
     * - Breakdown by action type
     * - Most active operators
     *
     * @param startTime start of time range (ISO 8601 format)
     * @param endTime   end of time range (ISO 8601 format)
     * @return summary statistics for the dashboard
     */
    @GetMapping("/summary")
    public ResponseEntity<Result<Map<String, Object>>> getLogSummary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {

        // Validate time range (max 90 days)
        long daysBetween = java.time.Duration.between(startTime, endTime).toDays();
        if (daysBetween > 90) {
            return ResponseEntity.badRequest().body(
                Result.error("time_range_exceeds_limit", "Time range cannot exceed 90 days")
            );
        }

        log.info("Getting log summary: startTime={}, endTime={}", startTime, endTime);

        Map<String, Object> summary = logAggregationService.getLogSummary(startTime, endTime);

        return ResponseEntity.ok(Result.success(summary));
    }
}