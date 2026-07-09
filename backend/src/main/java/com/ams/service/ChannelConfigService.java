package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.ChannelConfigDTO;
import com.ams.dto.ChannelConfigMetaDTO;
import com.ams.dto.ChannelConfigPreviewRequestDTO;
import com.ams.dto.ChannelConfigPreviewRespDTO;
import com.ams.dto.ChannelConfigQueryDTO;
import com.ams.entity.ChannelConfig;
import com.ams.mapper.ChannelConfigMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChannelConfigService {

    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_META_LIMIT = 100;
    private static final String READONLY_BOUNDARY = "只读通知渠道目录 + 无持久化、无发送、无外联的脱敏校验预览；不保存渠道、不发送测试消息、不调用外部 webhook。";
    private static final Pattern CHANNEL_TYPE_PATTERN = Pattern.compile("[A-Z][A-Z0-9_-]{0,63}");
    private static final Pattern SAMPLE_ENDPOINT_PATTERN = Pattern.compile("/[A-Za-z0-9._~:/?#\\[\\]@!$&'()*+,;=%-]{0,127}");
    private static final Set<String> RESERVED_CHANNEL_WORDS = Set.of("META", "PREVIEW", "TEST", "CREATE", "UPDATE", "DELETE", "SEND");
    private static final Set<String> SENSITIVE_INPUTS = Set.of(
            "webhookurl", "secret", "signature", "header", "headers", "payload", "raw", "debug", "providerrequest"
    );
    private static final Map<String, String> DEFAULT_CHANNEL_LABELS = defaultChannelLabels();

    private final ChannelConfigMapper channelConfigMapper;

    public ChannelConfigDTO.PageResult list(ChannelConfigQueryDTO query) {
        String tenantId = TenantContext.requireTenantId();
        NormalizedQuery normalized = normalizeQuery(query);
        long total = channelConfigMapper.countRecords(tenantId, normalized.channelType(), normalized.keyword());
        List<ChannelConfigDTO> records = total == 0
                ? List.of()
                : channelConfigMapper.selectPageRecords(
                        tenantId,
                        normalized.channelType(),
                        normalized.keyword(),
                        normalized.pageSize(),
                        normalized.offset()
                ).stream().map(this::toDTO).toList();
        long pages = total == 0 ? 0 : (long) Math.ceil((double) total / normalized.pageSize());
        return ChannelConfigDTO.PageResult.builder()
                .records(records)
                .total(total)
                .page(normalized.page())
                .pageSize(normalized.pageSize())
                .pages(pages)
                .tenantScoped(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    public ChannelConfigDTO detail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        if (id == null || id <= 0) {
            throw new BusinessException("通知渠道配置不存在");
        }
        ChannelConfig config = channelConfigMapper.selectByIdAndTenant(tenantId, id);
        if (config == null) {
            throw new BusinessException("通知渠道配置不存在");
        }
        return toDTO(config);
    }

    public ChannelConfigMetaDTO meta() {
        String tenantId = TenantContext.requireTenantId();
        return ChannelConfigMetaDTO.builder()
                .channelTypes(mergeChannelOptions(channelConfigMapper.listChannelTypes(tenantId, MAX_META_LIMIT)))
                .statuses(List.of(option("1", "启用"), option("0", "停用")))
                .previewPolicy(ChannelConfigMetaDTO.PreviewPolicy.builder()
                        .tenantScoped(true)
                        .noPersistence(true)
                        .noSend(true)
                        .runtimeEffect(false)
                        .forbiddenOperations(List.of("create", "update", "delete", "test-send", "external-webhook", "message-center", "mail-gateway", "workflow-switch"))
                        .rejectedInputFields(new ArrayList<>(SENSITIVE_INPUTS))
                        .build())
                .tenantScoped(true)
                .readOnly(true)
                .noPersistencePreview(true)
                .noSend(true)
                .runtimeEffect(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .nonGoals(List.of("不创建渠道", "不更新渠道", "不删除渠道", "不发送测试消息", "不调用外部 webhook", "不接入消息中心、邮件网关或流程通知开关"))
                .build();
    }

    public ChannelConfigPreviewRespDTO preview(ChannelConfigPreviewRequestDTO request) {
        TenantContext.requireTenantId();
        ChannelConfigPreviewRequestDTO source = request == null ? new ChannelConfigPreviewRequestDTO() : request;
        List<ChannelConfigPreviewRespDTO.RejectedInput> rejectedInputs = new ArrayList<>();
        collectUnknownInputs(source, rejectedInputs);

        String channelType = normalizeChannelType(source.getChannelType(), "channelType", rejectedInputs);
        String configName = cleanText(source.getConfigName(), 120);
        if (configName == null) {
            rejectedInputs.add(rejected("configName", "配置名称为空或超过 120 字符"));
        }
        boolean webhookConfigured = Boolean.TRUE.equals(source.getWebhookUrlConfigured());
        boolean signatureConfigured = Boolean.TRUE.equals(source.getSignatureConfigured());
        boolean enabled = normalizeEnabled(source.getEnabled(), rejectedInputs);
        boolean sampleEndpointAccepted = validateSampleEndpoint(source.getSampleEndpoint(), rejectedInputs);
        boolean configured = channelType != null && configName != null && webhookConfigured && enabled;
        boolean previewAccepted = rejectedInputs.isEmpty() && sampleEndpointAccepted;

        return ChannelConfigPreviewRespDTO.builder()
                .channelType(channelType)
                .configName(configName)
                .configured(configured)
                .webhookUrlConfigured(webhookConfigured)
                .webhookUrlMasked(webhookConfigured ? "已配置（脱敏）" : "未配置")
                .signatureConfigured(signatureConfigured)
                .enabled(enabled ? 1 : 0)
                .sampleEndpointAccepted(sampleEndpointAccepted)
                .previewAccepted(previewAccepted)
                .rejectedInputs(rejectedInputs)
                .tenantScoped(true)
                .noPersistence(true)
                .noSend(true)
                .runtimeEffect(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    private ChannelConfigDTO toDTO(ChannelConfig config) {
        return ChannelConfigDTO.builder()
                .id(config.getId())
                .tenantId(config.getTenantId())
                .channelType(config.getChannelType())
                .configName(config.getConfigName())
                .webhookUrlMasked(firstText(config.getWebhookUrlMasked(), Boolean.TRUE.equals(config.getWebhookUrlConfigured()) ? "已配置（脱敏）" : "未配置"))
                .webhookUrlConfigured(Boolean.TRUE.equals(config.getWebhookUrlConfigured()))
                .signatureConfigured(Boolean.TRUE.equals(config.getSignatureConfigured()))
                .enabled(config.getEnabled())
                .description(config.getDescription())
                .tenantScoped(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .createdAt(config.getCreatedAt())
                .updatedAt(config.getUpdatedAt())
                .build();
    }

    private NormalizedQuery normalizeQuery(ChannelConfigQueryDTO query) {
        ChannelConfigQueryDTO source = query == null ? new ChannelConfigQueryDTO() : query;
        int page = source.getPage() == null || source.getPage() < 1 ? DEFAULT_PAGE : source.getPage();
        int pageSize = source.getPageSize() == null || source.getPageSize() < 1 ? DEFAULT_PAGE_SIZE : Math.min(source.getPageSize(), MAX_PAGE_SIZE);
        String channelType = normalizeFilterChannelType(source.getChannelType());
        String keyword = cleanText(source.getKeyword(), 80);
        return new NormalizedQuery(page, pageSize, Math.max((page - 1) * pageSize, 0), channelType, keyword);
    }

    private String normalizeFilterChannelType(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        String channelType = rawValue.trim().toUpperCase(Locale.ROOT);
        if (RESERVED_CHANNEL_WORDS.contains(channelType) || !CHANNEL_TYPE_PATTERN.matcher(channelType).matches()) {
            return null;
        }
        return channelType;
    }

    private String normalizeChannelType(String rawValue, String field, List<ChannelConfigPreviewRespDTO.RejectedInput> rejectedInputs) {
        String channelType = normalizeFilterChannelType(rawValue);
        if (channelType == null) {
            rejectedInputs.add(rejected(field, "渠道类型为空、保留字或格式非法"));
        }
        return channelType;
    }

    private boolean normalizeEnabled(Integer rawValue, List<ChannelConfigPreviewRespDTO.RejectedInput> rejectedInputs) {
        if (rawValue == null) {
            return true;
        }
        if (rawValue == 0 || rawValue == 1) {
            return rawValue == 1;
        }
        rejectedInputs.add(rejected("enabled", "启停状态只允许 0 或 1"));
        return false;
    }

    private boolean validateSampleEndpoint(String rawValue, List<ChannelConfigPreviewRespDTO.RejectedInput> rejectedInputs) {
        if (rawValue == null || rawValue.isBlank()) {
            return true;
        }
        String endpoint = rawValue.trim();
        String lower = endpoint.toLowerCase(Locale.ROOT);
        if (lower.contains("http://") || lower.contains("https://") || endpoint.length() > 128 || !SAMPLE_ENDPOINT_PATTERN.matcher(endpoint).matches()) {
            rejectedInputs.add(rejected("sampleEndpoint", "样例 endpoint 仅允许不含域名和凭据的相对路径"));
            return false;
        }
        return true;
    }

    private void collectUnknownInputs(ChannelConfigPreviewRequestDTO source, List<ChannelConfigPreviewRespDTO.RejectedInput> rejectedInputs) {
        Map<String, Object> unknownInputs = source.getUnknownInputs();
        if (unknownInputs == null || unknownInputs.isEmpty()) {
            return;
        }
        for (String field : unknownInputs.keySet()) {
            String normalized = field == null ? "" : field.trim();
            String lower = normalized.toLowerCase(Locale.ROOT);
            if (SENSITIVE_INPUTS.contains(lower)) {
                rejectedInputs.add(rejected(normalized, "敏感原始配置字段已拒绝且未回显"));
            } else if (lower.equals("tenantid") || lower.equals("userid")) {
                rejectedInputs.add(rejected(normalized, "租户或用户覆盖字段已拒绝；租户仅来自 TenantContext"));
            } else {
                rejectedInputs.add(rejected(normalized, "预览只接受 channelType、configName、webhookUrlConfigured、signatureConfigured、enabled、sampleEndpoint"));
            }
        }
    }

    private List<ChannelConfigMetaDTO.Option> mergeChannelOptions(List<String> observed) {
        LinkedHashSet<String> channels = new LinkedHashSet<>(DEFAULT_CHANNEL_LABELS.keySet());
        if (observed != null) {
            observed.stream().map(this::normalizeFilterChannelType).filter(item -> item != null).forEach(channels::add);
        }
        return channels.stream()
                .map(channel -> option(channel, DEFAULT_CHANNEL_LABELS.getOrDefault(channel, channel)))
                .toList();
    }

    private ChannelConfigMetaDTO.Option option(String value, String label) {
        return ChannelConfigMetaDTO.Option.builder().value(value).label(label).build();
    }

    private ChannelConfigPreviewRespDTO.RejectedInput rejected(String field, String reason) {
        return ChannelConfigPreviewRespDTO.RejectedInput.builder()
                .field(field == null ? "" : field)
                .reason(reason)
                .build();
    }

    private String cleanText(String rawValue, int maxLength) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        String value = rawValue.trim();
        return value.length() > maxLength ? null : value;
    }

    private String firstText(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second;
    }

    private static Map<String, String> defaultChannelLabels() {
        LinkedHashMap<String, String> labels = new LinkedHashMap<>();
        labels.put("DINGTALK", "钉钉");
        labels.put("WECHAT", "企业微信");
        labels.put("EMAIL", "邮件");
        return labels;
    }

    private record NormalizedQuery(int page, int pageSize, int offset, String channelType, String keyword) {}
}
