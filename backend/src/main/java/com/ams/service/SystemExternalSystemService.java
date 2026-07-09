package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemExternalSystemDTO;
import com.ams.dto.SystemExternalSystemOperationDTO;
import com.ams.dto.SystemExternalSystemSaveDTO;
import com.ams.dto.SystemExternalSystemValidationResultDTO;
import com.ams.entity.SystemExternalSystem;
import com.ams.mapper.SystemExternalSystemMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SystemExternalSystemService {

    private static final String STATUS_ENABLED = "ENABLED";
    private static final String STATUS_DISABLED = "DISABLED";
    private static final String HEALTH_UNKNOWN = "UNKNOWN";
    private static final String HEALTH_CONFIGURED = "CONFIGURED";
    private static final String VALIDATION_VALID = "VALID";
    private static final String VALIDATION_INVALID = "INVALID";
    private static final String OPERATION_CREATE = "CREATE";
    private static final String OPERATION_UPDATE = "UPDATE";
    private static final String OPERATION_ENABLE = "ENABLE";
    private static final String OPERATION_DISABLE = "DISABLE";
    private static final String OPERATION_VALIDATE = "VALIDATE";
    private static final Set<String> ALLOWED_SYSTEM_TYPES = Set.of("ERP", "MES", "EHR", "PO", "CONTRACT", "FINANCE", "IOT", "OTHER");
    private static final Set<String> ALLOWED_AUTH_TYPES = Set.of("NONE", "API_KEY", "BEARER_TOKEN", "BASIC", "OAUTH_CLIENT", "HMAC", "MUTUAL_TLS");
    private static final Set<String> SENSITIVE_KEYS = Set.of(
            "secret", "token", "password", "clientsecret", "privatekey", "apikey", "bearertoken", "signingkey", "cert"
    );

    private final SystemExternalSystemMapper externalSystemMapper;

    public List<SystemExternalSystemDTO> list(String keyword, String systemType, String status) {
        String tenantId = TenantContext.requireTenantId();
        QueryWrapper<SystemExternalSystem> wrapper = new QueryWrapper<SystemExternalSystem>()
                .eq("tenant_id", tenantId)
                .eq("removed", 0)
                .orderByDesc("update_time");
        if (hasText(keyword)) {
            wrapper.and(query -> query.like("system_name", keyword.trim()).or().like("system_code", keyword.trim()));
        }
        if (hasText(systemType)) {
            wrapper.eq("system_type", normalizeSystemType(systemType));
        }
        if (hasText(status)) {
            wrapper.eq("status", normalizeStatus(status));
        }
        return externalSystemMapper.selectList(wrapper).stream().map(this::toDTO).toList();
    }

    public SystemExternalSystemDTO get(Long id) {
        return toDTO(getRequired(id));
    }

    @Transactional(rollbackFor = Exception.class)
    public SystemExternalSystemDTO create(SystemExternalSystemSaveDTO request, Long currentUserId) {
        String tenantId = TenantContext.requireTenantId();
        validateSaveRequest(request, currentUserId);
        String systemCode = normalizeCode(request.getSystemCode());
        ensureCodeAvailable(tenantId, systemCode, null);

        LocalDateTime now = LocalDateTime.now();
        SystemExternalSystem entity = new SystemExternalSystem();
        entity.setTenantId(tenantId);
        entity.setSystemCode(systemCode);
        entity.setCreateTime(now);
        entity.setUpdateTime(now);
        entity.setRemoved(0);
        applySaveRequest(entity, request, true);
        entity.setEnabled(request.getEnabled() == null ? Boolean.FALSE : request.getEnabled());
        entity.setStatus(Boolean.TRUE.equals(entity.getEnabled()) ? STATUS_ENABLED : STATUS_DISABLED);
        entity.setHealthStatus(HEALTH_UNKNOWN);
        entity.setLastOperatorId(currentUserId);
        entity.setLastOperation(OPERATION_CREATE);
        entity.setLastOperationReason(cleanAuditText(request.getReason(), "创建外部系统配置"));
        entity.setAuditEvidenceSummary(cleanAuditText(request.getAuditEvidence(), null));
        externalSystemMapper.insert(entity);
        return toDTO(entity);
    }

    @Transactional(rollbackFor = Exception.class)
    public SystemExternalSystemDTO update(Long id, SystemExternalSystemSaveDTO request, Long currentUserId) {
        validateSaveRequest(request, currentUserId);
        String tenantId = TenantContext.requireTenantId();
        SystemExternalSystem entity = getRequired(id);
        String systemCode = normalizeCode(request.getSystemCode());
        ensureCodeAvailable(tenantId, systemCode, id);
        entity.setSystemCode(systemCode);
        applySaveRequest(entity, request, false);
        if (request.getEnabled() != null) {
            entity.setEnabled(request.getEnabled());
            entity.setStatus(Boolean.TRUE.equals(request.getEnabled()) ? STATUS_ENABLED : STATUS_DISABLED);
        }
        entity.setLastOperatorId(currentUserId);
        entity.setLastOperation(OPERATION_UPDATE);
        entity.setLastOperationReason(cleanAuditText(request.getReason(), "更新外部系统配置"));
        entity.setAuditEvidenceSummary(cleanAuditText(request.getAuditEvidence(), null));
        entity.setUpdateTime(LocalDateTime.now());
        externalSystemMapper.updateById(entity);
        return toDTO(entity);
    }

    @Transactional(rollbackFor = Exception.class)
    public SystemExternalSystemDTO enable(Long id, SystemExternalSystemOperationDTO request, Long currentUserId) {
        return updateStatus(id, request, currentUserId, true);
    }

    @Transactional(rollbackFor = Exception.class)
    public SystemExternalSystemDTO disable(Long id, SystemExternalSystemOperationDTO request, Long currentUserId) {
        return updateStatus(id, request, currentUserId, false);
    }

    @Transactional(rollbackFor = Exception.class)
    public SystemExternalSystemValidationResultDTO validateConfig(Long id, SystemExternalSystemOperationDTO request, Long currentUserId) {
        String tenantId = TenantContext.requireTenantId();
        SystemExternalSystem entity = getRequired(id);
        if (!tenantId.equals(entity.getTenantId())) {
            throw new BusinessException("外部系统不存在");
        }
        if (request != null && request.getOperatorId() != null) {
            validateOperator(request.getOperatorId(), currentUserId);
            entity.setLastOperatorId(currentUserId);
            entity.setLastOperationReason(cleanAuditText(request.getReason(), "配置校验"));
            entity.setAuditEvidenceSummary(cleanAuditText(request.getAuditEvidence(), null));
        } else {
            entity.setLastOperatorId(currentUserId);
            entity.setLastOperationReason("配置校验");
        }

        boolean valid = Boolean.TRUE.equals(entity.getAuthConfigured()) || "NONE".equals(entity.getAuthType());
        entity.setLastOperation(OPERATION_VALIDATE);
        entity.setLastValidationAt(LocalDateTime.now());
        entity.setLastValidationStatus(valid ? VALIDATION_VALID : VALIDATION_INVALID);
        entity.setHealthStatus(valid ? HEALTH_CONFIGURED : HEALTH_UNKNOWN);
        entity.setLastValidationMessage(valid
                ? "外部系统配置校验通过，未触发真实外部调用"
                : "外部系统配置缺少认证摘要，未触发真实外部调用");
        entity.setUpdateTime(LocalDateTime.now());
        externalSystemMapper.updateById(entity);

        SystemExternalSystemValidationResultDTO result = new SystemExternalSystemValidationResultDTO();
        result.setSystemId(entity.getId());
        result.setSystemCode(entity.getSystemCode());
        result.setValid(valid);
        result.setConfigOnly(true);
        result.setNoRealExternalCall(true);
        result.setTargetSummary(entity.getBaseUrlMasked());
        result.setAuthSummary(entity.getMaskedSecretSummary());
        result.setMessage(entity.getLastValidationMessage());
        return result;
    }

    private SystemExternalSystemDTO updateStatus(Long id, SystemExternalSystemOperationDTO request, Long currentUserId, boolean enabled) {
        validateOperationRequest(request, currentUserId, true);
        SystemExternalSystem entity = getRequired(id);
        entity.setEnabled(enabled);
        entity.setStatus(enabled ? STATUS_ENABLED : STATUS_DISABLED);
        entity.setLastOperatorId(currentUserId);
        entity.setLastOperation(enabled ? OPERATION_ENABLE : OPERATION_DISABLE);
        entity.setLastOperationReason(cleanAuditText(request.getReason(), enabled ? "启用外部系统" : "停用外部系统"));
        entity.setAuditEvidenceSummary(cleanAuditText(request.getAuditEvidence(), null));
        entity.setUpdateTime(LocalDateTime.now());
        externalSystemMapper.updateById(entity);
        return toDTO(entity);
    }

    private void validateSaveRequest(SystemExternalSystemSaveDTO request, Long currentUserId) {
        if (request == null) {
            throw new BusinessException("外部系统配置不能为空");
        }
        if (!hasText(request.getSystemName())) {
            throw new BusinessException("外部系统名称不能为空");
        }
        if (!hasText(request.getSystemType())) {
            throw new BusinessException("外部系统类型不能为空");
        }
        if (!hasText(request.getBaseUrl())) {
            throw new BusinessException("外部系统地址不能为空");
        }
        validateOperator(request.getOperatorId(), currentUserId);
        if (!hasText(request.getReason()) && !hasText(request.getAuditEvidence())) {
            throw new BusinessException("外部系统操作必须提供原因或审计证据");
        }
    }

    private void validateOperationRequest(SystemExternalSystemOperationDTO request, Long currentUserId, boolean requireConfirmed) {
        if (request == null) {
            throw new BusinessException("外部系统操作不能为空");
        }
        if (requireConfirmed && !Boolean.TRUE.equals(request.getConfirmed())) {
            throw new BusinessException("外部系统启停必须确认");
        }
        validateOperator(request.getOperatorId(), currentUserId);
        if (!hasText(request.getReason()) && !hasText(request.getAuditEvidence())) {
            throw new BusinessException("外部系统操作必须提供原因或审计证据");
        }
    }

    private void validateOperator(Long operatorId, Long currentUserId) {
        if (operatorId == null || operatorId <= 0) {
            throw new BusinessException("外部系统操作人不能为空");
        }
        if (currentUserId == null || !operatorId.equals(currentUserId)) {
            throw new BusinessException("外部系统操作人不匹配");
        }
    }

    private void applySaveRequest(SystemExternalSystem entity, SystemExternalSystemSaveDTO request, boolean creating) {
        URI uri = validateBaseUrl(request.getBaseUrl());
        String authType = normalizeAuthType(request.getAuthType());
        Map<String, String> cleanConfig = cleanConfig(request.getAuthConfig());
        if (!"NONE".equals(authType) && cleanConfig.isEmpty() && (creating || !Boolean.TRUE.equals(entity.getAuthConfigured()))) {
            throw new BusinessException("外部系统认证摘要不能为空");
        }
        boolean authConfigured = "NONE".equals(authType) ? false : (!cleanConfig.isEmpty() || Boolean.TRUE.equals(entity.getAuthConfigured()));
        entity.setSystemName(request.getSystemName().trim());
        entity.setSystemType(normalizeSystemType(request.getSystemType()));
        entity.setBaseUrlMasked(maskBaseUrl(uri));
        entity.setAuthType(authType);
        entity.setAuthConfigured(authConfigured);
        entity.setConfigMasked(authConfigured || !cleanConfig.isEmpty());
        entity.setAuthConfigSummary(buildConfigSummary(cleanConfig, authConfigured));
        entity.setMaskedSecretSummary(buildMaskedSummary(cleanConfig, authConfigured));
        if (!cleanConfig.isEmpty()) {
            entity.setSecretFingerprint(fingerprint(cleanConfig));
        }
    }

    private URI validateBaseUrl(String baseUrl) {
        URI uri;
        try {
            uri = new URI(baseUrl.trim());
        } catch (URISyntaxException e) {
            throw new BusinessException("外部系统地址格式不合法");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!Set.of("http", "https").contains(scheme) || !hasText(uri.getHost())) {
            throw new BusinessException("外部系统地址仅允许 http 或 https 公共域名");
        }
        if (hasText(uri.getUserInfo())) {
            throw new BusinessException("外部系统地址不允许包含用户凭据");
        }
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        if (isForbiddenHost(host)) {
            throw new BusinessException("外部系统地址必须使用公共域名");
        }
        return uri;
    }

    private boolean isForbiddenHost(String host) {
        return "localhost".equals(host)
                || "0.0.0.0".equals(host)
                || "::1".equals(host)
                || host.startsWith("127.")
                || host.startsWith("10.")
                || host.startsWith("192.168.")
                || host.startsWith("169.254.")
                || isPrivate172Address(host)
                || host.startsWith("fc")
                || host.startsWith("fd");
    }

    private boolean isPrivate172Address(String host) {
        if (!host.startsWith("172.")) {
            return false;
        }
        String[] parts = host.split("\\.");
        if (parts.length < 2) {
            return false;
        }
        try {
            int second = Integer.parseInt(parts[1]);
            return second >= 16 && second <= 31;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private String maskBaseUrl(URI uri) {
        StringBuilder builder = new StringBuilder();
        builder.append(uri.getScheme().toLowerCase(Locale.ROOT)).append("://").append(uri.getHost().toLowerCase(Locale.ROOT));
        if (uri.getPort() > -1) {
            builder.append(':').append(uri.getPort());
        }
        String path = uri.getRawPath();
        builder.append(hasText(path) ? path : "/");
        return builder.toString();
    }

    private Map<String, String> cleanConfig(Map<String, String> config) {
        if (config == null || config.isEmpty()) {
            return Map.of();
        }
        return config.entrySet().stream()
                .filter(entry -> hasText(entry.getKey()) && hasText(entry.getValue()))
                .sorted(Map.Entry.comparingByKey())
                .collect(Collectors.toMap(
                        entry -> entry.getKey().trim(),
                        entry -> entry.getValue().trim(),
                        (left, right) -> right,
                        LinkedHashMap::new
                ));
    }

    private String buildConfigSummary(Map<String, String> config, boolean authConfigured) {
        if (!authConfigured) {
            return "无需认证配置";
        }
        int sensitiveCount = (int) config.keySet().stream().filter(this::isSensitiveKey).count();
        int total = Math.max(config.size(), 1);
        return "认证配置已脱敏，配置项 " + total + " 项，敏感项 " + sensitiveCount + " 项";
    }

    private String buildMaskedSummary(Map<String, String> config, boolean authConfigured) {
        if (!authConfigured) {
            return "未配置认证材料";
        }
        int total = Math.max(config.size(), 1);
        return total + " 项认证材料已脱敏";
    }

    private boolean isSensitiveKey(String key) {
        String normalized = key == null ? "" : key.replace("_", "").replace("-", "").toLowerCase(Locale.ROOT);
        return SENSITIVE_KEYS.stream().anyMatch(normalized::contains);
    }

    private String fingerprint(Map<String, String> config) {
        String source = config.entrySet().stream()
                .sorted(Comparator.comparing(Map.Entry::getKey))
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(Collectors.joining("&"));
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(source.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed).substring(0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new BusinessException("外部系统认证摘要生成失败");
        }
    }

    private void ensureCodeAvailable(String tenantId, String systemCode, Long currentId) {
        QueryWrapper<SystemExternalSystem> wrapper = new QueryWrapper<SystemExternalSystem>()
                .eq("tenant_id", tenantId)
                .eq("system_code", systemCode)
                .eq("removed", 0)
                .last("limit 1");
        SystemExternalSystem existing = externalSystemMapper.selectOne(wrapper);
        if (existing != null && (currentId == null || !currentId.equals(existing.getId()))) {
            throw new BusinessException("外部系统编码已存在");
        }
    }

    private SystemExternalSystem getRequired(Long id) {
        if (id == null) {
            throw new BusinessException("外部系统不存在");
        }
        SystemExternalSystem entity = externalSystemMapper.selectOne(new QueryWrapper<SystemExternalSystem>()
                .eq("id", id)
                .eq("tenant_id", TenantContext.requireTenantId())
                .eq("removed", 0)
                .last("limit 1"));
        if (entity == null) {
            throw new BusinessException("外部系统不存在");
        }
        return entity;
    }

    private String normalizeCode(String systemCode) {
        if (!hasText(systemCode)) {
            throw new BusinessException("外部系统编码不能为空");
        }
        String normalized = systemCode.trim().toUpperCase(Locale.ROOT);
        if (!normalized.matches("[A-Z0-9_-]{2,64}")) {
            throw new BusinessException("外部系统编码格式不合法");
        }
        return normalized;
    }

    private String normalizeSystemType(String systemType) {
        String normalized = hasText(systemType) ? systemType.trim().toUpperCase(Locale.ROOT) : "";
        if (!ALLOWED_SYSTEM_TYPES.contains(normalized)) {
            throw new BusinessException("外部系统类型不受支持");
        }
        return normalized;
    }

    private String normalizeAuthType(String authType) {
        String normalized = hasText(authType) ? authType.trim().toUpperCase(Locale.ROOT) : "NONE";
        if (!ALLOWED_AUTH_TYPES.contains(normalized)) {
            throw new BusinessException("外部系统认证方式不受支持");
        }
        return normalized;
    }

    private String normalizeStatus(String status) {
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!Set.of(STATUS_ENABLED, STATUS_DISABLED).contains(normalized)) {
            throw new BusinessException("外部系统状态不受支持");
        }
        return normalized;
    }

    private String cleanAuditText(String value, String fallback) {
        String source = hasText(value) ? value.trim() : fallback;
        if (!hasText(source)) {
            return null;
        }
        String cleaned = source.replaceAll("[\\r\\n]", " ")
                .replaceAll("(?i)(secret|token|password|clientSecret|privateKey|apiKey|bearerToken|signingKey|cert)\\s*[:=]\\s*[^\\s,;]+", "$1=******");
        return cleaned.substring(0, Math.min(cleaned.length(), 240));
    }

    private SystemExternalSystemDTO toDTO(SystemExternalSystem source) {
        SystemExternalSystemDTO target = new SystemExternalSystemDTO();
        target.setId(source.getId());
        target.setTenantId(source.getTenantId());
        target.setSystemCode(source.getSystemCode());
        target.setSystemName(source.getSystemName());
        target.setSystemType(source.getSystemType());
        target.setMaskedBaseUrl(source.getBaseUrlMasked());
        target.setAuthType(source.getAuthType());
        target.setAuthConfigSummary(source.getAuthConfigSummary());
        target.setAuthConfigured(source.getAuthConfigured());
        target.setConfigMasked(source.getConfigMasked());
        target.setMaskedSecretSummary(source.getMaskedSecretSummary());
        target.setEnabled(source.getEnabled());
        target.setStatus(source.getStatus());
        target.setHealthStatus(source.getHealthStatus());
        target.setLastValidationStatus(source.getLastValidationStatus());
        target.setLastValidationMessage(source.getLastValidationMessage());
        target.setLastValidationAt(source.getLastValidationAt());
        target.setLastOperatorId(source.getLastOperatorId());
        target.setLastOperation(source.getLastOperation());
        target.setLastOperationReason(source.getLastOperationReason());
        target.setAuditEvidenceSummary(source.getAuditEvidenceSummary());
        target.setCreateTime(source.getCreateTime());
        target.setUpdateTime(source.getUpdateTime());
        return target;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
