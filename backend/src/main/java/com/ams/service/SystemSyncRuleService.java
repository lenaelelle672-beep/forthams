package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemIntegrationInterfaceResponse;
import com.ams.dto.SystemSyncRuleRequest;
import com.ams.dto.SystemSyncRuleResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
public class SystemSyncRuleService {

    private static final String STATUS_ENABLED = "ENABLED";
    private static final String STATUS_DISABLED = "DISABLED";

    private final SystemIntegrationInterfaceService interfaceService;
    private final SystemFieldMappingService fieldMappingService;
    private final AtomicLong idGenerator = new AtomicLong(1);
    private final Map<String, Map<Long, SystemSyncRuleResponse>> recordsByTenant = new ConcurrentHashMap<>();

    public List<SystemSyncRuleResponse> list() {
        return tenantRecords().values().stream()
                .sorted(Comparator.comparing(SystemSyncRuleResponse::getUpdateTime).reversed())
                .map(this::copy)
                .toList();
    }

    public SystemSyncRuleResponse get(Long id) {
        return copy(getRequired(id));
    }

    public SystemSyncRuleResponse getEnabledRuleForRun(Long id) {
        SystemSyncRuleResponse response = getRequired(id);
        if (!Boolean.TRUE.equals(response.getEnabled())) {
            throw new BusinessException("禁用规则不能运行");
        }
        return copy(response);
    }

    public SystemSyncRuleResponse create(SystemSyncRuleRequest request) {
        validateRequest(request);
        boolean enabled = request.getEnabled() == null || Boolean.TRUE.equals(request.getEnabled());
        requireEnabledDependencies(request.getInterfaceId(), enabled);
        String tenantId = TenantContext.requireTenantId();
        LocalDateTime now = LocalDateTime.now();
        SystemSyncRuleResponse response = new SystemSyncRuleResponse();
        response.setId(idGenerator.getAndIncrement());
        response.setTenantId(tenantId);
        applyRequest(response, request);
        response.setEnabled(enabled);
        response.setStatus(enabled ? STATUS_ENABLED : STATUS_DISABLED);
        response.setCreateTime(now);
        response.setUpdateTime(now);
        tenantRecords().put(response.getId(), response);
        return copy(response);
    }

    public SystemSyncRuleResponse update(Long id, SystemSyncRuleRequest request) {
        validateRequest(request);
        SystemSyncRuleResponse response = getRequired(id);
        boolean enabled = request.getEnabled() == null ? Boolean.TRUE.equals(response.getEnabled()) : Boolean.TRUE.equals(request.getEnabled());
        requireEnabledDependencies(request.getInterfaceId(), enabled);
        applyRequest(response, request);
        if (request.getEnabled() != null) {
            response.setEnabled(enabled);
            response.setStatus(enabled ? STATUS_ENABLED : STATUS_DISABLED);
        }
        response.setUpdateTime(LocalDateTime.now());
        return copy(response);
    }

    public SystemSyncRuleResponse updateStatus(Long id, boolean enabled) {
        SystemSyncRuleResponse response = getRequired(id);
        requireEnabledDependencies(response.getInterfaceId(), enabled);
        response.setEnabled(enabled);
        response.setStatus(enabled ? STATUS_ENABLED : STATUS_DISABLED);
        response.setUpdateTime(LocalDateTime.now());
        return copy(response);
    }

    public void delete(Long id) {
        SystemSyncRuleResponse response = getRequired(id);
        if (Boolean.TRUE.equals(response.getEnabled())) {
            throw new BusinessException("请先停用同步规则后再删除");
        }
        tenantRecords().remove(id);
    }

    void updateLastRun(Long id, String status, LocalDateTime runAt) {
        SystemSyncRuleResponse response = getRequired(id);
        response.setLastStatus(status);
        response.setLastRunAt(runAt);
        response.setUpdateTime(LocalDateTime.now());
    }

    private void validateRequest(SystemSyncRuleRequest request) {
        if (request == null || request.getInterfaceId() == null) {
            throw new BusinessException("同步规则必须关联接口");
        }
        if (!hasText(request.getRuleName())) {
            throw new BusinessException("同步规则名称不能为空");
        }
        if (!hasText(request.getTriggerType()) && !hasText(request.getCronExpression())) {
            throw new BusinessException("触发方式不能为空");
        }
        int retryCount = request.getRetryCount() == null ? 0 : request.getRetryCount();
        if (retryCount < 0 || retryCount > 10) {
            throw new BusinessException("重试次数必须在 0-10 之间");
        }
    }

    private void requireEnabledDependencies(Long interfaceId, boolean enabled) {
        SystemIntegrationInterfaceResponse integrationInterface = interfaceService.get(interfaceId);
        if (enabled && !Boolean.TRUE.equals(integrationInterface.getEnabled())) {
            throw new BusinessException("同步规则必须关联已启用接口");
        }
        if (enabled && !fieldMappingService.hasEnabledMappingForInterface(interfaceId)) {
            throw new BusinessException("启用同步规则前必须至少配置一条启用的字段映射");
        }
    }

    private void applyRequest(SystemSyncRuleResponse response, SystemSyncRuleRequest request) {
        response.setInterfaceId(request.getInterfaceId());
        response.setRuleName(request.getRuleName().trim());
        response.setTriggerType(hasText(request.getTriggerType()) ? request.getTriggerType().trim().toUpperCase(Locale.ROOT) : null);
        response.setCronExpression(trimToNull(request.getCronExpression()));
        response.setRetryCount(request.getRetryCount() == null ? 0 : request.getRetryCount());
    }

    private SystemSyncRuleResponse getRequired(Long id) {
        SystemSyncRuleResponse response = tenantRecords().get(id);
        if (response == null) {
            throw new BusinessException("同步规则不存在");
        }
        return response;
    }

    private Map<Long, SystemSyncRuleResponse> tenantRecords() {
        String tenantId = TenantContext.requireTenantId();
        return recordsByTenant.computeIfAbsent(tenantId, ignored -> new ConcurrentHashMap<>());
    }

    private SystemSyncRuleResponse copy(SystemSyncRuleResponse source) {
        SystemSyncRuleResponse target = new SystemSyncRuleResponse();
        target.setId(source.getId());
        target.setTenantId(source.getTenantId());
        target.setInterfaceId(source.getInterfaceId());
        target.setRuleName(source.getRuleName());
        target.setTriggerType(source.getTriggerType());
        target.setCronExpression(source.getCronExpression());
        target.setRetryCount(source.getRetryCount());
        target.setEnabled(source.getEnabled());
        target.setStatus(source.getStatus());
        target.setLastStatus(source.getLastStatus());
        target.setLastRunAt(source.getLastRunAt());
        target.setNextRunAt(source.getNextRunAt());
        target.setCreateTime(source.getCreateTime());
        target.setUpdateTime(source.getUpdateTime());
        return target;
    }

    private String trimToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
