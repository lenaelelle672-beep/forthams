package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemFieldMappingPreviewRequest;
import com.ams.dto.SystemFieldMappingPreviewResponse;
import com.ams.dto.SystemFieldMappingRequest;
import com.ams.dto.SystemFieldMappingResponse;
import com.ams.dto.SystemIntegrationInterfaceResponse;
import lombok.RequiredArgsConstructor;
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
@RequiredArgsConstructor
public class SystemFieldMappingService {

    private static final String STATUS_ENABLED = "ENABLED";
    private static final String STATUS_DISABLED = "DISABLED";
    private static final Set<String> ALLOWED_TRANSFORMS = Set.of("trim(value)", "upper(value)", "lower(value)");
    private static final String TRANSFORM_ERROR = "转换表达式只允许 trim(value)、upper(value)、lower(value)";

    private final SystemIntegrationInterfaceService interfaceService;
    private final AtomicLong idGenerator = new AtomicLong(1);
    private final Map<String, Map<Long, SystemFieldMappingResponse>> recordsByTenant = new ConcurrentHashMap<>();

    public List<SystemFieldMappingResponse> list() {
        return tenantRecords().values().stream()
                .sorted(Comparator.comparing(SystemFieldMappingResponse::getUpdateTime).reversed())
                .map(this::copy)
                .toList();
    }

    public SystemFieldMappingResponse get(Long id) {
        return copy(getRequired(id));
    }

    public SystemFieldMappingResponse create(SystemFieldMappingRequest request) {
        validateRequest(request);
        requireEnabledInterface(request.getInterfaceId());
        validateUnique(request.getInterfaceId(), request.getSourceField(), request.getTargetField(), null);
        String tenantId = TenantContext.requireTenantId();
        LocalDateTime now = LocalDateTime.now();
        SystemFieldMappingResponse response = new SystemFieldMappingResponse();
        response.setId(idGenerator.getAndIncrement());
        response.setTenantId(tenantId);
        applyRequest(response, request);
        response.setEnabled(request.getEnabled() == null ? Boolean.TRUE : request.getEnabled());
        response.setStatus(Boolean.TRUE.equals(response.getEnabled()) ? STATUS_ENABLED : STATUS_DISABLED);
        response.setCreateTime(now);
        response.setUpdateTime(now);
        tenantRecords().put(response.getId(), response);
        return copy(response);
    }

    public SystemFieldMappingResponse update(Long id, SystemFieldMappingRequest request) {
        validateRequest(request);
        requireEnabledInterface(request.getInterfaceId());
        SystemFieldMappingResponse response = getRequired(id);
        validateUnique(request.getInterfaceId(), request.getSourceField(), request.getTargetField(), id);
        applyRequest(response, request);
        if (request.getEnabled() != null) {
            response.setEnabled(request.getEnabled());
            response.setStatus(Boolean.TRUE.equals(request.getEnabled()) ? STATUS_ENABLED : STATUS_DISABLED);
        }
        response.setUpdateTime(LocalDateTime.now());
        return copy(response);
    }

    public SystemFieldMappingResponse updateStatus(Long id, boolean enabled) {
        SystemFieldMappingResponse response = getRequired(id);
        if (enabled) {
            requireEnabledInterface(response.getInterfaceId());
        }
        response.setEnabled(enabled);
        response.setStatus(enabled ? STATUS_ENABLED : STATUS_DISABLED);
        response.setUpdateTime(LocalDateTime.now());
        return copy(response);
    }

    public void delete(Long id) {
        tenantRecords().remove(getRequired(id).getId());
    }

    public SystemFieldMappingPreviewResponse preview(SystemFieldMappingPreviewRequest request) {
        if (request == null || !hasText(request.getSourceField()) || !hasText(request.getTargetField())) {
            throw new BusinessException("源字段和目标字段不能为空");
        }
        validateTransformExpression(request.getTransformExpression());
        SystemFieldMappingPreviewResponse response = new SystemFieldMappingPreviewResponse();
        response.setSourceField(request.getSourceField().trim());
        response.setTargetField(request.getTargetField().trim());
        response.setSampleValue(request.getSampleValue());
        response.setTransformedValue(applyTransform(request.getSampleValue(), request.getTransformExpression()));
        response.setValid(true);
        response.setMessage("预览成功");
        return response;
    }

    public boolean hasEnabledMappingForInterface(Long interfaceId) {
        TenantContext.requireTenantId();
        return tenantRecords().values().stream()
                .anyMatch(mapping -> interfaceId != null
                        && interfaceId.equals(mapping.getInterfaceId())
                        && Boolean.TRUE.equals(mapping.getEnabled()));
    }

    private void validateRequest(SystemFieldMappingRequest request) {
        if (request == null || request.getInterfaceId() == null) {
            throw new BusinessException("字段映射必须关联接口");
        }
        if (!hasText(request.getSourceField()) || !hasText(request.getTargetField())) {
            throw new BusinessException("源字段和目标字段不能为空");
        }
        validateTransformExpression(request.getTransformExpression());
    }

    private void requireEnabledInterface(Long interfaceId) {
        SystemIntegrationInterfaceResponse response = interfaceService.get(interfaceId);
        if (!Boolean.TRUE.equals(response.getEnabled())) {
            throw new BusinessException("字段映射必须关联已启用接口");
        }
    }

    private void validateUnique(Long interfaceId, String sourceField, String targetField, Long excludedId) {
        String source = sourceField.trim();
        String target = targetField.trim();
        boolean duplicate = tenantRecords().values().stream()
                .anyMatch(mapping -> !mapping.getId().equals(excludedId)
                        && interfaceId.equals(mapping.getInterfaceId())
                        && (source.equals(mapping.getSourceField()) || target.equals(mapping.getTargetField())));
        if (duplicate) {
            throw new BusinessException("同一接口下源字段或目标字段已存在");
        }
    }

    private void applyRequest(SystemFieldMappingResponse response, SystemFieldMappingRequest request) {
        response.setInterfaceId(request.getInterfaceId());
        response.setMappingName(hasText(request.getMappingName()) ? request.getMappingName().trim() : request.getSourceField().trim() + " -> " + request.getTargetField().trim());
        response.setSourceField(request.getSourceField().trim());
        response.setTargetField(request.getTargetField().trim());
        response.setTransformExpression(trimToNull(request.getTransformExpression()));
        response.setDefaultValue(trimToNull(request.getDefaultValue()));
    }

    private SystemFieldMappingResponse getRequired(Long id) {
        SystemFieldMappingResponse response = tenantRecords().get(id);
        if (response == null) {
            throw new BusinessException("字段映射不存在");
        }
        return response;
    }

    private Map<Long, SystemFieldMappingResponse> tenantRecords() {
        String tenantId = TenantContext.requireTenantId();
        return recordsByTenant.computeIfAbsent(tenantId, ignored -> new ConcurrentHashMap<>());
    }

    private void validateTransformExpression(String expression) {
        if (!hasText(expression)) {
            return;
        }
        if (!ALLOWED_TRANSFORMS.contains(expression.trim())) {
            throw new BusinessException(TRANSFORM_ERROR);
        }
    }

    private String applyTransform(String value, String expression) {
        if (!hasText(expression)) {
            return value;
        }
        String safeValue = value == null ? "" : value;
        return switch (expression.trim()) {
            case "trim(value)" -> safeValue.trim();
            case "upper(value)" -> safeValue.toUpperCase(Locale.ROOT);
            case "lower(value)" -> safeValue.toLowerCase(Locale.ROOT);
            default -> throw new BusinessException(TRANSFORM_ERROR);
        };
    }

    private SystemFieldMappingResponse copy(SystemFieldMappingResponse source) {
        SystemFieldMappingResponse target = new SystemFieldMappingResponse();
        target.setId(source.getId());
        target.setTenantId(source.getTenantId());
        target.setInterfaceId(source.getInterfaceId());
        target.setMappingName(source.getMappingName());
        target.setSourceField(source.getSourceField());
        target.setTargetField(source.getTargetField());
        target.setTransformExpression(source.getTransformExpression());
        target.setDefaultValue(source.getDefaultValue());
        target.setEnabled(source.getEnabled());
        target.setStatus(source.getStatus());
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
