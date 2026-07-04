package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemIntegrationInterfaceRequest;
import com.ams.dto.SystemIntegrationInterfaceResponse;
import com.ams.dto.SystemInterfaceTestResponse;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class SystemIntegrationInterfaceService {

    private static final String STATUS_ENABLED = "ENABLED";
    private static final String STATUS_DISABLED = "DISABLED";
    private static final Set<String> ALLOWED_METHODS = Set.of("GET", "POST", "PUT", "PATCH", "DELETE");

    private final AtomicLong idGenerator = new AtomicLong(1);
    private final Map<String, Map<Long, SystemIntegrationInterfaceResponse>> recordsByTenant = new ConcurrentHashMap<>();

    public List<SystemIntegrationInterfaceResponse> list() {
        return tenantRecords().values().stream()
                .sorted(Comparator.comparing(SystemIntegrationInterfaceResponse::getUpdateTime).reversed())
                .map(this::copy)
                .toList();
    }

    public SystemIntegrationInterfaceResponse get(Long id) {
        return copy(getRequired(id));
    }

    public SystemIntegrationInterfaceResponse create(SystemIntegrationInterfaceRequest request) {
        validateRequest(request);
        String tenantId = TenantContext.requireTenantId();
        LocalDateTime now = LocalDateTime.now();
        SystemIntegrationInterfaceResponse response = new SystemIntegrationInterfaceResponse();
        response.setId(idGenerator.getAndIncrement());
        response.setTenantId(tenantId);
        applyRequest(response, request);
        response.setEnabled(request.getEnabled() == null ? Boolean.TRUE : request.getEnabled());
        response.setStatus(Boolean.TRUE.equals(response.getEnabled()) ? STATUS_ENABLED : STATUS_DISABLED);
        response.setConfigMasked(true);
        response.setCreateTime(now);
        response.setUpdateTime(now);
        tenantRecords().put(response.getId(), response);
        return copy(response);
    }

    public SystemIntegrationInterfaceResponse update(Long id, SystemIntegrationInterfaceRequest request) {
        validateRequest(request);
        SystemIntegrationInterfaceResponse response = getRequired(id);
        applyRequest(response, request);
        if (request.getEnabled() != null) {
            response.setEnabled(request.getEnabled());
            response.setStatus(Boolean.TRUE.equals(request.getEnabled()) ? STATUS_ENABLED : STATUS_DISABLED);
        }
        response.setUpdateTime(LocalDateTime.now());
        return copy(response);
    }

    public SystemIntegrationInterfaceResponse updateStatus(Long id, boolean enabled) {
        SystemIntegrationInterfaceResponse response = getRequired(id);
        response.setEnabled(enabled);
        response.setStatus(enabled ? STATUS_ENABLED : STATUS_DISABLED);
        response.setUpdateTime(LocalDateTime.now());
        return copy(response);
    }

    public void delete(Long id) {
        SystemIntegrationInterfaceResponse response = getRequired(id);
        if (Boolean.TRUE.equals(response.getEnabled())) {
            throw new BusinessException("请先停用接口后再删除");
        }
        tenantRecords().remove(id);
    }

    public SystemInterfaceTestResponse testInterface(Long id) {
        SystemIntegrationInterfaceResponse response = getRequired(id);
        if (!Boolean.TRUE.equals(response.getEnabled())) {
            throw new BusinessException("禁用接口不能进行配置校验");
        }
        SystemInterfaceTestResponse testResponse = new SystemInterfaceTestResponse();
        testResponse.setInterfaceId(response.getId());
        testResponse.setValid(true);
        testResponse.setConfigOnly(true);
        testResponse.setTarget(response.getMethod() + " " + response.getPath());
        testResponse.setMessage("接口配置校验通过，未触发真实外部调用");
        return testResponse;
    }

    private void validateRequest(SystemIntegrationInterfaceRequest request) {
        if (request == null || request.getExternalSystemId() == null) {
            throw new BusinessException("接口必须关联外部系统");
        }
        if (!hasText(request.getInterfaceName())) {
            throw new BusinessException("接口名称不能为空");
        }
        String method = normalizeMethod(request.getMethod());
        if (!ALLOWED_METHODS.contains(method)) {
            throw new BusinessException("接口方法不受支持");
        }
        if (!hasText(request.getPath()) || !request.getPath().trim().startsWith("/")) {
            throw new BusinessException("接口路径必须以 / 开头");
        }
    }

    private void applyRequest(SystemIntegrationInterfaceResponse response, SystemIntegrationInterfaceRequest request) {
        response.setExternalSystemId(request.getExternalSystemId());
        response.setInterfaceName(request.getInterfaceName().trim());
        response.setMethod(normalizeMethod(request.getMethod()));
        response.setPath(request.getPath().trim());
        response.setRequestSchema(trimToNull(request.getRequestSchema()));
        response.setResponseSchema(trimToNull(request.getResponseSchema()));
    }

    private SystemIntegrationInterfaceResponse getRequired(Long id) {
        SystemIntegrationInterfaceResponse response = tenantRecords().get(id);
        if (response == null) {
            throw new BusinessException("接口不存在");
        }
        return response;
    }

    private Map<Long, SystemIntegrationInterfaceResponse> tenantRecords() {
        String tenantId = TenantContext.requireTenantId();
        return recordsByTenant.computeIfAbsent(tenantId, ignored -> new ConcurrentHashMap<>());
    }

    private SystemIntegrationInterfaceResponse copy(SystemIntegrationInterfaceResponse source) {
        SystemIntegrationInterfaceResponse target = new SystemIntegrationInterfaceResponse();
        target.setId(source.getId());
        target.setTenantId(source.getTenantId());
        target.setExternalSystemId(source.getExternalSystemId());
        target.setInterfaceName(source.getInterfaceName());
        target.setMethod(source.getMethod());
        target.setPath(source.getPath());
        target.setRequestSchema(source.getRequestSchema());
        target.setResponseSchema(source.getResponseSchema());
        target.setEnabled(source.getEnabled());
        target.setStatus(source.getStatus());
        target.setConfigMasked(source.getConfigMasked());
        target.setCreateTime(source.getCreateTime());
        target.setUpdateTime(source.getUpdateTime());
        return target;
    }

    private String normalizeMethod(String method) {
        return hasText(method) ? method.trim().toUpperCase(Locale.ROOT) : "GET";
    }

    private String trimToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
