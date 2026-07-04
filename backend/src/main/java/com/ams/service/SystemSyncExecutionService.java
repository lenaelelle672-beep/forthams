package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemSyncQueueSummaryResponse;
import com.ams.dto.SystemSyncRuleResponse;
import com.ams.dto.SystemSyncRunLogResponse;
import com.ams.dto.SystemSyncRunRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
public class SystemSyncExecutionService {

    private static final String STATUS_SUCCESS = "SUCCESS";
    private static final String STATUS_FAILED = "FAILED";
    private static final String MODE_DRY_RUN = "DRY_RUN";

    private final SystemSyncRuleService syncRuleService;
    private final AtomicLong idGenerator = new AtomicLong(1);
    private final Map<String, Map<Long, SystemSyncRunLogResponse>> logsByTenant = new ConcurrentHashMap<>();

    public SystemSyncRunLogResponse dryRunRule(Long ruleId, SystemSyncRunRequest request) {
        SystemSyncRunRequest normalized = normalizeRunRequest(request);
        normalized.setDryRun(true);
        SystemSyncRuleResponse rule = syncRuleService.getEnabledRuleForRun(ruleId);
        LocalDateTime now = LocalDateTime.now();
        SystemSyncRunLogResponse log = new SystemSyncRunLogResponse();
        log.setId(idGenerator.getAndIncrement());
        log.setTenantId(TenantContext.requireTenantId());
        log.setRuleId(rule.getId());
        log.setStatus(STATUS_SUCCESS);
        log.setTriggerSource(normalizeTriggerSource(normalized));
        log.setExecutionMode(MODE_DRY_RUN);
        log.setDryRun(true);
        log.setRequestId(hasText(normalized.getRequestId()) ? normalized.getRequestId().trim() : UUID.randomUUID().toString());
        log.setIdempotencyKey(trimToNull(normalized.getIdempotencyKey()));
        log.setAttempt(1);
        log.setMaxAttempt(Math.max(1, (rule.getRetryCount() == null ? 0 : rule.getRetryCount()) + 1));
        log.setTargetSummary("rule=" + rule.getRuleName() + "; interfaceId=" + rule.getInterfaceId());
        log.setMessage("同步规则 dry-run 预览完成；未触发真实同步");
        log.setStartedAt(now);
        log.setFinishedAt(now);
        tenantLogs().put(log.getId(), log);
        syncRuleService.updateLastRun(rule.getId(), STATUS_SUCCESS, now);
        return copy(log);
    }

    public SystemSyncRunLogResponse runRule(Long ruleId, SystemSyncRunRequest request) {
        SystemSyncRunRequest normalized = normalizeRunRequest(request);
        if (!Boolean.FALSE.equals(normalized.getDryRun())) {
            return dryRunRule(ruleId, normalized);
        }
        if (!Boolean.TRUE.equals(normalized.getConfirmRealRun())) {
            throw new BusinessException("真实同步默认关闭，请先执行 dry-run 并显式确认");
        }
        throw new BusinessException("真实同步执行默认关闭，当前 V3 契约不触发外部副作用");
    }

    public SystemSyncRunLogResponse retryLog(Long logId) {
        SystemSyncRunLogResponse log = getRequiredLog(logId);
        if (!STATUS_FAILED.equals(log.getStatus())) {
            throw new BusinessException("只有失败日志可以重试");
        }
        throw new BusinessException("真实重试已禁用，仅保留单条日志重试入口并 fail-closed");
    }

    public List<SystemSyncRunLogResponse> listLogs(Long ruleId) {
        TenantContext.requireTenantId();
        return tenantLogs().values().stream()
                .filter(log -> ruleId.equals(log.getRuleId()))
                .sorted(Comparator.comparing(SystemSyncRunLogResponse::getStartedAt).reversed())
                .map(this::copy)
                .toList();
    }

    public SystemSyncQueueSummaryResponse queueSummary() {
        TenantContext.requireTenantId();
        List<SystemSyncRunLogResponse> logs = tenantLogs().values().stream().toList();
        SystemSyncQueueSummaryResponse response = new SystemSyncQueueSummaryResponse();
        response.setPending(0L);
        response.setRunning(0L);
        response.setFailed(logs.stream().filter(log -> STATUS_FAILED.equals(log.getStatus())).count());
        response.setNextRetry(0L);
        response.setQueueConsumptionEnabled(false);
        response.setMode("READ_ONLY_SUMMARY");
        return response;
    }

    SystemSyncRunLogResponse addFailedLogForTest(Long ruleId) {
        LocalDateTime now = LocalDateTime.now();
        SystemSyncRunLogResponse log = new SystemSyncRunLogResponse();
        log.setId(idGenerator.getAndIncrement());
        log.setTenantId(TenantContext.requireTenantId());
        log.setRuleId(ruleId);
        log.setStatus(STATUS_FAILED);
        log.setTriggerSource("MANUAL");
        log.setExecutionMode(MODE_DRY_RUN);
        log.setDryRun(true);
        log.setAttempt(1);
        log.setMaxAttempt(2);
        log.setStartedAt(now);
        log.setFinishedAt(now);
        log.setMessage("失败日志测试夹具");
        tenantLogs().put(log.getId(), log);
        return copy(log);
    }

    private SystemSyncRunRequest normalizeRunRequest(SystemSyncRunRequest request) {
        SystemSyncRunRequest normalized = request == null ? new SystemSyncRunRequest() : request;
        if (normalized.getDryRun() == null) {
            normalized.setDryRun(true);
        }
        return normalized;
    }

    private String normalizeTriggerSource(SystemSyncRunRequest request) {
        return hasText(request.getTriggerSource()) ? request.getTriggerSource().trim().toUpperCase(Locale.ROOT) : "MANUAL";
    }

    private SystemSyncRunLogResponse getRequiredLog(Long logId) {
        SystemSyncRunLogResponse log = tenantLogs().get(logId);
        if (log == null) {
            throw new BusinessException("同步运行日志不存在");
        }
        return log;
    }

    private Map<Long, SystemSyncRunLogResponse> tenantLogs() {
        String tenantId = TenantContext.requireTenantId();
        return logsByTenant.computeIfAbsent(tenantId, ignored -> new ConcurrentHashMap<>());
    }

    private SystemSyncRunLogResponse copy(SystemSyncRunLogResponse source) {
        SystemSyncRunLogResponse target = new SystemSyncRunLogResponse();
        target.setId(source.getId());
        target.setTenantId(source.getTenantId());
        target.setRuleId(source.getRuleId());
        target.setStatus(source.getStatus());
        target.setTriggerSource(source.getTriggerSource());
        target.setExecutionMode(source.getExecutionMode());
        target.setDryRun(source.getDryRun());
        target.setRequestId(source.getRequestId());
        target.setIdempotencyKey(source.getIdempotencyKey());
        target.setAttempt(source.getAttempt());
        target.setMaxAttempt(source.getMaxAttempt());
        target.setTargetSummary(source.getTargetSummary());
        target.setMessage(source.getMessage());
        target.setErrorMessage(source.getErrorMessage());
        target.setStartedAt(source.getStartedAt());
        target.setFinishedAt(source.getFinishedAt());
        target.setNextRetryAt(source.getNextRetryAt());
        return target;
    }

    private String trimToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
