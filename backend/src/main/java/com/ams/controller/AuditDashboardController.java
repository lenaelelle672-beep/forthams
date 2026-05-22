package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.*;
import com.ams.entity.GeneralAuditEntry;
import com.ams.service.AuditDashboardService;
import com.ams.service.AuditService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/audit-logs", "/v1/audit-log", "/v1/audit"})
@RequiredArgsConstructor
public class AuditDashboardController {

    private final AuditDashboardService auditDashboardService;
    private final AuditService auditService;

    @GetMapping({"", "/list"})
    public ResponseEntity<Result<Page<GeneralAuditEntry>>> getLogs(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
            @RequestParam Map<String, String> params) {
        Result<Page<GeneralAuditEntry>> result = auditService.queryLogs(
                page,
                size,
                firstParam(params, "start_time", "startTime", "startDate"),
                firstParam(params, "end_time", "endTime", "endDate"),
                firstParam(params, "operation_type", "action_type", "operationType"),
                firstParam(params, "operator_id", "operatorId"),
                firstParam(params, "module", "resourceType"));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/count")
    public ResponseEntity<Result<Long>> getCount(@RequestParam Map<String, String> params) {
        long count = auditService.queryLogs(
                0,
                1,
                firstParam(params, "start_time", "startTime", "startDate"),
                firstParam(params, "end_time", "endTime", "endDate"),
                firstParam(params, "operation_type", "action_type", "operationType"),
                firstParam(params, "operator_id", "operatorId"),
                firstParam(params, "module", "resourceType"))
                .getData()
                .getTotal();
        return ResponseEntity.ok(Result.success(count));
    }

    @GetMapping({"/trends", "/trend"})
    public Result<TrendVO> getTrends(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "daily") String granularity,
            @RequestParam Map<String, String> params) {
        LocalDate effectiveEnd = endDate != null
                ? endDate
                : parseDateParam(firstParam(params, "end_time", "endDate"), LocalDate.now());
        LocalDate effectiveStart = startDate != null
                ? startDate
                : parseDateParam(firstParam(params, "start_time", "startDate"), effectiveEnd.minusDays(6));
        return Result.success(auditDashboardService.getTrend(
                effectiveStart,
                effectiveEnd,
                granularity,
                firstParam(params, "operation_type", "action_type", "operationType"),
                firstParam(params, "operator_id", "operatorId"),
                firstParam(params, "module", "resourceType")));
    }

    @GetMapping("/action-type-distribution")
    public Result<TypeDistributionVO> getTypeDistribution(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        LocalDate effectiveEnd = endDate != null ? endDate : LocalDate.now();
        LocalDate effectiveStart = startDate != null ? startDate : effectiveEnd.minusDays(30);
        return Result.success(auditDashboardService.getTypeDistribution(effectiveStart, effectiveEnd));
    }

    @GetMapping("/operator-ranking")
    public Result<List<OperatorRankingVO>> getOperatorRanking(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "10") int limit) {
        LocalDate effectiveEnd = endDate != null ? endDate : LocalDate.now();
        LocalDate effectiveStart = startDate != null ? startDate : effectiveEnd.minusDays(30);
        return Result.success(auditDashboardService.getOperatorRanking(effectiveStart, effectiveEnd, limit));
    }

    @GetMapping("/meta")
    public Result<List<String>> getOperationTypes() {
        return Result.success(auditDashboardService.getOperationTypes());
    }

    @GetMapping("/{id}")
    public Result<GeneralAuditEntry> getDetail(@PathVariable Long id) {
        GeneralAuditEntry entry = auditService.queryLogById(id);
        return Result.success(entry);
    }

    private String firstParam(Map<String, String> params, String... keys) {
        for (String key : keys) {
            String value = params.get(key);
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private LocalDate parseDateParam(String value, LocalDate fallback) {
        if (!StringUtils.hasText(value)) {
            return fallback;
        }

        String trimmed = value.trim();
        int dateTimeSeparator = trimmed.indexOf('T');
        String dateOnly = dateTimeSeparator > 0 ? trimmed.substring(0, dateTimeSeparator) : trimmed;
        try {
            return LocalDate.parse(dateOnly);
        } catch (DateTimeParseException ignored) {
        }

        try {
            return Instant.parse(trimmed).atZone(ZoneId.systemDefault()).toLocalDate();
        } catch (DateTimeParseException ignored) {
            return fallback;
        }
    }
}
