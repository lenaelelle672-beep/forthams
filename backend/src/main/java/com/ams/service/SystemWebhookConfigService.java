package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemWebhookConfigRequest;
import com.ams.dto.SystemWebhookConfigResponse;
import com.ams.dto.SystemWebhookConfigTestResponse;
import com.ams.entity.SystemWebhookConfig;
import com.ams.mapper.SystemWebhookConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SystemWebhookConfigService {

    private static final String STATUS_ENABLED = "ENABLED";
    private static final String STATUS_DISABLED = "DISABLED";
    private static final String SIGNING_NONE = "NONE";
    private static final String SIGNING_HMAC_SHA256 = "HMAC_SHA256";
    private static final String MASKED_VALUE = "******";
    private static final Set<String> ALLOWED_SIGNING_STRATEGIES = Set.of(SIGNING_NONE, SIGNING_HMAC_SHA256);
    private static final Set<String> ALLOWED_HOSTS = Set.of("hooks.example.com", "webhooks.example.com", "events.example.com");

    private final SystemWebhookConfigMapper webhookConfigMapper;

    public List<SystemWebhookConfigResponse> list() {
        return webhookConfigMapper.selectList(new QueryWrapper<SystemWebhookConfig>()
                        .eq("tenant_id", TenantContext.requireTenantId())
                        .orderByDesc("update_time"))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public SystemWebhookConfigResponse get(Long id) {
        return toResponse(getRequired(id));
    }

    @Transactional(rollbackFor = Exception.class)
    public SystemWebhookConfigResponse create(SystemWebhookConfigRequest request) {
        String tenantId = TenantContext.requireTenantId();
        LocalDateTime now = LocalDateTime.now();
        SystemWebhookConfig config = new SystemWebhookConfig();
        config.setTenantId(tenantId);
        config.setCreateTime(now);
        config.setUpdateTime(now);
        applyRequest(config, request, true);
        config.setEnabled(request.getEnabled() == null ? Boolean.TRUE : request.getEnabled());
        config.setStatus(Boolean.TRUE.equals(config.getEnabled()) ? STATUS_ENABLED : STATUS_DISABLED);
        config.setDeleted(0);
        webhookConfigMapper.insert(config);
        return toResponse(config);
    }

    @Transactional(rollbackFor = Exception.class)
    public SystemWebhookConfigResponse update(Long id, SystemWebhookConfigRequest request) {
        SystemWebhookConfig config = getRequired(id);
        applyRequest(config, request, false);
        if (request.getEnabled() != null) {
            config.setEnabled(request.getEnabled());
            config.setStatus(Boolean.TRUE.equals(request.getEnabled()) ? STATUS_ENABLED : STATUS_DISABLED);
        }
        config.setUpdateTime(LocalDateTime.now());
        webhookConfigMapper.updateById(config);
        return toResponse(config);
    }

    @Transactional(rollbackFor = Exception.class)
    public SystemWebhookConfigResponse updateStatus(Long id, boolean enabled) {
        SystemWebhookConfig config = getRequired(id);
        config.setEnabled(enabled);
        config.setStatus(enabled ? STATUS_ENABLED : STATUS_DISABLED);
        config.setUpdateTime(LocalDateTime.now());
        webhookConfigMapper.updateById(config);
        return toResponse(config);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        SystemWebhookConfig config = getRequired(id);
        if (Boolean.TRUE.equals(config.getEnabled())) {
            throw new BusinessException("请先停用 Webhook 配置后再删除");
        }
        webhookConfigMapper.deleteById(id);
    }

    public SystemWebhookConfigTestResponse testConfig(Long id) {
        SystemWebhookConfig config = getRequired(id);
        if (!Boolean.TRUE.equals(config.getEnabled())) {
            throw new BusinessException("禁用 Webhook 配置不能进行配置校验");
        }
        SystemWebhookConfigTestResponse testResponse = new SystemWebhookConfigTestResponse();
        testResponse.setConfigId(config.getId());
        testResponse.setValid(true);
        testResponse.setConfigOnly(true);
        testResponse.setTarget(config.getTargetUrl());
        testResponse.setMessage("Webhook 配置校验通过，未触发真实外部调用");
        return testResponse;
    }

    private void applyRequest(SystemWebhookConfig config, SystemWebhookConfigRequest request, boolean creating) {
        validateRequiredFields(request);
        URI targetUri = validateTargetUrl(request.getTargetUrl());
        String signingStrategy = normalizeSigningStrategy(request.getSigningStrategy());
        boolean signatureConfigured = hasText(request.getSigningSecret()) || (!creating && Boolean.TRUE.equals(config.getSignatureConfigured()));
        if (SIGNING_HMAC_SHA256.equals(signingStrategy) && !signatureConfigured) {
            throw new BusinessException("HMAC_SHA256 签名策略必须配置签名密钥");
        }

        Map<String, String> maskedHeaders = maskHeaders(request.getHeaders());
        config.setConfigName(request.getConfigName().trim());
        config.setEventType(request.getEventType().trim().toUpperCase(Locale.ROOT));
        config.setTargetUrl(maskTargetUrl(targetUri));
        config.setSigningStrategy(signingStrategy);
        config.setSignatureConfigured(SIGNING_HMAC_SHA256.equals(signingStrategy) && signatureConfigured);
        config.setSecretConfigured(hasText(request.getSecret()) || (!creating && Boolean.TRUE.equals(config.getSecretConfigured())));
        config.setMaskedHeaderNames(encodeHeaderNames(maskedHeaders));
    }

    private void validateRequiredFields(SystemWebhookConfigRequest request) {
        if (request == null) {
            throw new BusinessException("Webhook 配置不能为空");
        }
        if (!hasText(request.getConfigName())) {
            throw new BusinessException("Webhook 配置名称不能为空");
        }
        if (!hasText(request.getEventType())) {
            throw new BusinessException("Webhook 事件类型不能为空");
        }
    }

    private URI validateTargetUrl(String targetUrl) {
        if (!hasText(targetUrl)) {
            throw new BusinessException("Webhook 地址不能为空");
        }
        URI uri;
        try {
            uri = new URI(targetUrl.trim());
        } catch (URISyntaxException e) {
            throw new BusinessException("Webhook 地址格式不合法");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!Set.of("http", "https").contains(scheme) || !hasText(uri.getHost())) {
            throw new BusinessException("Webhook 地址仅允许 http 或 https 公共域名");
        }
        if (hasText(uri.getUserInfo())) {
            throw new BusinessException("Webhook 地址不允许包含用户凭据");
        }
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        if (isForbiddenHost(host) || !ALLOWED_HOSTS.contains(host)) {
            throw new BusinessException("Webhook 地址必须使用允许的公共域名");
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

    private String normalizeSigningStrategy(String signingStrategy) {
        String normalized = hasText(signingStrategy) ? signingStrategy.trim().toUpperCase(Locale.ROOT) : SIGNING_NONE;
        if (!ALLOWED_SIGNING_STRATEGIES.contains(normalized)) {
            throw new BusinessException("Webhook 签名策略不受支持");
        }
        return normalized;
    }

    private Map<String, String> maskHeaders(Map<String, String> headers) {
        if (headers == null || headers.isEmpty()) {
            return Map.of();
        }
        Map<String, String> masked = new LinkedHashMap<>();
        headers.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    String name = entry.getKey() == null ? "" : entry.getKey().trim();
                    if (!isAllowedHeaderName(name)) {
                        throw new BusinessException("Webhook 请求头不在白名单内");
                    }
                    masked.put(name, MASKED_VALUE);
                });
        return masked;
    }

    private boolean isAllowedHeaderName(String name) {
        if (!hasText(name) || name.contains("\n") || name.contains("\r")) {
            return false;
        }
        String normalized = name.toLowerCase(Locale.ROOT);
        return "authorization".equals(normalized) || normalized.startsWith("x-");
    }

    private String maskTargetUrl(URI uri) {
        StringBuilder builder = new StringBuilder();
        builder.append(uri.getScheme().toLowerCase(Locale.ROOT)).append("://").append(uri.getHost().toLowerCase(Locale.ROOT));
        if (uri.getPort() > -1) {
            builder.append(':').append(uri.getPort());
        }
        String path = uri.getRawPath();
        builder.append(hasText(path) ? path : "/");
        return builder.toString();
    }

    private SystemWebhookConfig getRequired(Long id) {
        SystemWebhookConfig config = webhookConfigMapper.selectOne(new QueryWrapper<SystemWebhookConfig>()
                .eq("id", id)
                .eq("tenant_id", TenantContext.requireTenantId())
                .last("limit 1"));
        if (config == null) {
            throw new BusinessException("Webhook 配置不存在");
        }
        return config;
    }

    private SystemWebhookConfigResponse toResponse(SystemWebhookConfig source) {
        SystemWebhookConfigResponse target = new SystemWebhookConfigResponse();
        target.setId(source.getId());
        target.setTenantId(source.getTenantId());
        target.setConfigName(source.getConfigName());
        target.setEventType(source.getEventType());
        target.setMaskedTargetUrl(source.getTargetUrl());
        target.setEnabled(source.getEnabled());
        target.setStatus(source.getStatus());
        target.setSigningStrategy(source.getSigningStrategy());
        target.setSecretConfigured(source.getSecretConfigured());
        target.setSignatureConfigured(source.getSignatureConfigured());
        target.setMaskedHeaders(decodeMaskedHeaders(source.getMaskedHeaderNames()));
        target.setCreateTime(source.getCreateTime());
        target.setUpdateTime(source.getUpdateTime());
        return target;
    }

    private String encodeHeaderNames(Map<String, String> headers) {
        if (headers == null || headers.isEmpty()) {
            return "";
        }
        return String.join("\n", headers.keySet());
    }

    private Map<String, String> decodeMaskedHeaders(String headerNames) {
        if (!hasText(headerNames)) {
            return Map.of();
        }
        Map<String, String> maskedHeaders = new LinkedHashMap<>();
        for (String name : headerNames.split("\\R")) {
            if (hasText(name)) {
                maskedHeaders.put(name, MASKED_VALUE);
            }
        }
        return maskedHeaders;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
