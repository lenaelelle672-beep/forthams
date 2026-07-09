package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.MailGatewayDTO;
import com.ams.dto.MailGatewayMetaDTO;
import com.ams.dto.MailGatewayPreviewRequestDTO;
import com.ams.dto.MailGatewayPreviewRespDTO;
import com.ams.dto.MailGatewayQueryDTO;
import com.ams.entity.MailGateway;
import com.ams.mapper.MailGatewayMapper;
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
public class MailGatewayService {

    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_META_LIMIT = 100;
    private static final String READONLY_BOUNDARY = "metadata-only mail gateway catalog + dry-run preview；不持久化、不发送、不联网、不暴露凭据、不刷新缓存。";
    private static final Pattern CODE_PATTERN = Pattern.compile("[A-Za-z0-9_.-]{1,64}");
    private static final Set<String> ALLOWED_TLS_MODES = Set.of("NONE", "STARTTLS", "TLS", "SSL");
    private static final List<String> SENSITIVE_INPUT_FIELDS = List.of(
            "password",
            "secret",
            "token",
            "authHeader",
            "authorization",
            "smtpPassword",
            "rawCredential",
            "rawHeaders",
            "providerRequest",
            "sendTo",
            "messageBody"
    );
    private static final Set<String> SENSITIVE_INPUT_KEYS = normalizedSet(SENSITIVE_INPUT_FIELDS);

    private final MailGatewayMapper mailGatewayMapper;

    public MailGatewayDTO.PageResult list(MailGatewayQueryDTO query) {
        String tenantId = TenantContext.requireTenantId();
        NormalizedQuery normalized = normalizeQuery(query);
        long total = mailGatewayMapper.countRecords(
                tenantId,
                normalized.keyword(),
                normalized.tlsMode(),
                normalized.enabled(),
                normalized.authConfigured()
        );
        List<MailGatewayDTO> records = total == 0
                ? List.of()
                : safeList(mailGatewayMapper.selectPageRecords(
                        tenantId,
                        normalized.keyword(),
                        normalized.tlsMode(),
                        normalized.enabled(),
                        normalized.authConfigured(),
                        normalized.pageSize(),
                        normalized.offset()
                )).stream().map(this::toDTO).toList();
        long pages = total == 0 ? 0 : (long) Math.ceil((double) total / normalized.pageSize());
        return MailGatewayDTO.PageResult.builder()
                .records(records)
                .total(total)
                .page(normalized.page())
                .pageSize(normalized.pageSize())
                .pages(pages)
                .tenantScoped(true)
                .readOnly(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    public MailGatewayDTO detail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        if (id == null || id <= 0) {
            throw new BusinessException("邮件网关不存在");
        }
        MailGateway gateway = mailGatewayMapper.selectByIdAndTenant(tenantId, id);
        if (gateway == null) {
            throw new BusinessException("邮件网关不存在");
        }
        return toDTO(gateway);
    }

    public MailGatewayMetaDTO meta() {
        String tenantId = TenantContext.requireTenantId();
        return MailGatewayMetaDTO.builder()
                .tlsModes(mergeOptions(mailGatewayMapper.listTlsModes(tenantId, MAX_META_LIMIT), tlsDefaults()))
                .lastTestStatuses(mergeOptions(mailGatewayMapper.listLastTestStatuses(tenantId, MAX_META_LIMIT), statusDefaults()))
                .allowedPreviewFields(List.of("gatewayCode", "gatewayName", "hostMasked", "port", "tlsMode", "authConfigured", "senderMasked", "priority", "enabled"))
                .previewPolicy(previewPolicy())
                .tenantScoped(true)
                .readOnly(true)
                .noPersistencePreview(true)
                .noSend(true)
                .noNetwork(true)
                .runtimeEffect(false)
                .cacheRefreshed(false)
                .credentialExposed(false)
                .smtpConnect(false)
                .javaMailSenderUsed(false)
                .mailSenderProviderUsed(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .nonGoals(nonGoals())
                .build();
    }

    public MailGatewayPreviewRespDTO preview(MailGatewayPreviewRequestDTO request) {
        TenantContext.requireTenantId();
        MailGatewayPreviewRequestDTO source = request == null ? new MailGatewayPreviewRequestDTO() : request;
        List<MailGatewayPreviewRespDTO.RejectedInput> rejectedInputs = new ArrayList<>();
        LinkedHashSet<String> acceptedFields = new LinkedHashSet<>();

        validateGatewayCode(source.getGatewayCode(), rejectedInputs, acceptedFields);
        validateGatewayName(source.getGatewayName(), rejectedInputs, acceptedFields);
        boolean hostPresent = validateMaskedText("hostMasked", source.getHostMasked(), 160, rejectedInputs, acceptedFields, true);
        boolean senderPresent = validateMaskedText("senderMasked", source.getSenderMasked(), 160, rejectedInputs, acceptedFields, false);
        boolean portValid = validatePort(source.getPort(), rejectedInputs, acceptedFields);
        boolean tlsValid = validateTlsMode(source.getTlsMode(), rejectedInputs, acceptedFields);
        validatePriority(source.getPriority(), rejectedInputs, acceptedFields);
        acceptBoolean("authConfigured", source.getAuthConfigured(), acceptedFields);
        acceptBoolean("enabled", source.getEnabled(), acceptedFields);
        collectUnknownInputs(source.getUnknownInputs(), rejectedInputs);

        List<String> warnings = new ArrayList<>();
        warnings.add("dry-run preview only: noPersistence=true、noSend=true、noNetwork=true、runtimeEffect=false");
        warnings.add("未连接 SMTP，未使用 JavaMailSender 或 MailSenderProvider，未刷新缓存");
        warnings.add("不代表邮件子系统、真实凭据管理、连接验证或发送链路完成");
        if (!senderPresent) {
            warnings.add("senderMasked 未提供或为空，仅作为本地校验提示");
        }

        return MailGatewayPreviewRespDTO.builder()
                .previewAccepted(rejectedInputs.isEmpty())
                .configured(hostPresent && portValid && tlsValid)
                .acceptedFields(new ArrayList<>(acceptedFields))
                .rejectedInputs(rejectedInputs.stream().distinct().toList())
                .warnings(warnings)
                .tenantScoped(true)
                .readOnly(true)
                .noPersistence(true)
                .noSend(true)
                .noNetwork(true)
                .runtimeEffect(false)
                .cacheRefreshed(false)
                .credentialExposed(false)
                .smtpConnect(false)
                .javaMailSenderUsed(false)
                .mailSenderProviderUsed(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    private MailGatewayDTO toDTO(MailGateway gateway) {
        return MailGatewayDTO.builder()
                .id(gateway.getId())
                .gatewayCode(gateway.getGatewayCode())
                .gatewayName(gateway.getGatewayName())
                .hostMasked(gateway.getHostMasked())
                .port(gateway.getPort())
                .tlsMode(gateway.getTlsMode())
                .authConfigured(gateway.getAuthConfigured())
                .senderMasked(gateway.getSenderMasked())
                .priority(gateway.getPriority())
                .enabled(gateway.getEnabled())
                .lastTestStatus(gateway.getLastTestStatus())
                .lastTestAt(gateway.getLastTestAt())
                .tenantScoped(true)
                .readOnly(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    private NormalizedQuery normalizeQuery(MailGatewayQueryDTO query) {
        MailGatewayQueryDTO source = query == null ? new MailGatewayQueryDTO() : query;
        int page = source.getPage() == null || source.getPage() < DEFAULT_PAGE ? DEFAULT_PAGE : source.getPage();
        int requestedSize = firstNumber(source.getPageSize(), source.getSize(), DEFAULT_PAGE_SIZE);
        int pageSize = requestedSize < 1 ? DEFAULT_PAGE_SIZE : Math.min(requestedSize, MAX_PAGE_SIZE);
        return new NormalizedQuery(
                page,
                pageSize,
                Math.max((page - 1) * pageSize, 0),
                cleanText(source.getKeyword(), 80),
                normalizeTlsMode(source.getTlsMode()),
                source.getEnabled(),
                source.getAuthConfigured()
        );
    }

    private MailGatewayMetaDTO.PreviewPolicy previewPolicy() {
        return MailGatewayMetaDTO.PreviewPolicy.builder()
                .tenantScoped(true)
                .noPersistence(true)
                .noSend(true)
                .noNetwork(true)
                .runtimeEffect(false)
                .cacheRefreshed(false)
                .credentialExposed(false)
                .smtpConnect(false)
                .javaMailSenderUsed(false)
                .mailSenderProviderUsed(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .rejectedInputFields(SENSITIVE_INPUT_FIELDS)
                .build();
    }

    private List<String> nonGoals() {
        return List.of(
                "不保存或展示原始凭据",
                "不连接 SMTP 或外部网络",
                "不发送邮件或执行 test-send",
                "不刷新缓存或改变运行时",
                "不接入 workflow mail、消息中心、队列、重试或通知发送 pipeline",
                "不代表邮件子系统、消息与通知组或 Workbench V3 全量完成"
        );
    }

    private boolean validateGatewayCode(String value,
                                        List<MailGatewayPreviewRespDTO.RejectedInput> rejectedInputs,
                                        Set<String> acceptedFields) {
        String text = cleanText(value, 64);
        if (text == null) {
            return false;
        }
        if (!CODE_PATTERN.matcher(text).matches()) {
            reject(rejectedInputs, "gatewayCode", "网关编码只能包含字母、数字、点、下划线和中划线，且长度不超过 64");
            return false;
        }
        acceptedFields.add("gatewayCode");
        return true;
    }

    private boolean validateGatewayName(String value,
                                        List<MailGatewayPreviewRespDTO.RejectedInput> rejectedInputs,
                                        Set<String> acceptedFields) {
        String text = cleanText(value, 80);
        if (text == null) {
            return false;
        }
        if (text.length() > 80) {
            reject(rejectedInputs, "gatewayName", "网关名称长度不超过 80");
            return false;
        }
        acceptedFields.add("gatewayName");
        return true;
    }

    private boolean validateMaskedText(String field,
                                       String value,
                                       int maxLength,
                                       List<MailGatewayPreviewRespDTO.RejectedInput> rejectedInputs,
                                       Set<String> acceptedFields,
                                       boolean required) {
        String text = cleanText(value, maxLength);
        if (text == null) {
            if (required) {
                reject(rejectedInputs, field, "必须提供脱敏元数据字段");
            }
            return false;
        }
        if (value.trim().length() > maxLength) {
            reject(rejectedInputs, field, "字段长度超过 " + maxLength);
            return false;
        }
        acceptedFields.add(field);
        return true;
    }

    private boolean validatePort(Integer port,
                                 List<MailGatewayPreviewRespDTO.RejectedInput> rejectedInputs,
                                 Set<String> acceptedFields) {
        if (port == null) {
            reject(rejectedInputs, "port", "端口不能为空");
            return false;
        }
        if (port < 1 || port > 65535) {
            reject(rejectedInputs, "port", "端口必须在 1-65535 之间");
            return false;
        }
        acceptedFields.add("port");
        return true;
    }

    private boolean validateTlsMode(String value,
                                    List<MailGatewayPreviewRespDTO.RejectedInput> rejectedInputs,
                                    Set<String> acceptedFields) {
        String tlsMode = normalizeTlsMode(value);
        if (tlsMode == null) {
            reject(rejectedInputs, "tlsMode", "TLS 模式仅支持 NONE、STARTTLS、TLS、SSL");
            return false;
        }
        acceptedFields.add("tlsMode");
        return true;
    }

    private boolean validatePriority(Integer priority,
                                     List<MailGatewayPreviewRespDTO.RejectedInput> rejectedInputs,
                                     Set<String> acceptedFields) {
        if (priority == null) {
            return false;
        }
        if (priority < 0 || priority > 9999) {
            reject(rejectedInputs, "priority", "优先级必须在 0-9999 之间");
            return false;
        }
        acceptedFields.add("priority");
        return true;
    }

    private void acceptBoolean(String field, Boolean value, Set<String> acceptedFields) {
        if (value != null) {
            acceptedFields.add(field);
        }
    }

    private void collectUnknownInputs(Map<String, Object> unknownInputs,
                                      List<MailGatewayPreviewRespDTO.RejectedInput> rejectedInputs) {
        if (unknownInputs == null || unknownInputs.isEmpty()) {
            return;
        }
        for (String field : unknownInputs.keySet()) {
            String displayField = field == null || field.isBlank() ? "unknown" : field;
            String normalized = normalizeInputKey(displayField);
            if (SENSITIVE_INPUT_KEYS.contains(normalized)) {
                reject(rejectedInputs, displayField, "敏感或运行时输入被拒绝，值未读取、未回显、未持久化");
            } else if ("tenantid".equals(normalized)) {
                reject(rejectedInputs, displayField, "tenant 由 TenantContext 提供，request/body 不允许覆盖");
            } else {
                reject(rejectedInputs, displayField, "非 metadata-only preview 允许字段");
            }
        }
    }

    private List<MailGatewayMetaDTO.Option> mergeOptions(List<String> observed, Map<String, String> defaults) {
        LinkedHashMap<String, String> values = new LinkedHashMap<>(defaults);
        if (observed != null) {
            for (String item : observed) {
                String value = cleanText(item, 64);
                if (value != null) {
                    values.putIfAbsent(value, value);
                }
            }
        }
        return values.entrySet().stream()
                .map(entry -> MailGatewayMetaDTO.Option.builder().value(entry.getKey()).label(entry.getValue()).build())
                .toList();
    }

    private Map<String, String> tlsDefaults() {
        LinkedHashMap<String, String> values = new LinkedHashMap<>();
        values.put("NONE", "无传输加密元数据");
        values.put("STARTTLS", "STARTTLS 元数据");
        values.put("TLS", "TLS 元数据");
        values.put("SSL", "SSL 元数据");
        return values;
    }

    private Map<String, String> statusDefaults() {
        LinkedHashMap<String, String> values = new LinkedHashMap<>();
        values.put("NEVER_TESTED", "未验证");
        values.put("SUCCESS", "最近验证成功");
        values.put("FAILED", "最近验证失败");
        values.put("UNKNOWN", "未知");
        return values;
    }

    private String normalizeTlsMode(String value) {
        String text = cleanText(value, 16);
        if (text == null) {
            return null;
        }
        String upper = text.toUpperCase(Locale.ROOT);
        return ALLOWED_TLS_MODES.contains(upper) ? upper : null;
    }

    private String cleanText(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String text = value.trim();
        return text.length() > maxLength ? text.substring(0, maxLength) : text;
    }

    private int firstNumber(Integer first, Integer second, int fallback) {
        if (first != null) {
            return first;
        }
        return second == null ? fallback : second;
    }

    private List<MailGateway> safeList(List<MailGateway> source) {
        return source == null ? List.of() : source;
    }

    private void reject(List<MailGatewayPreviewRespDTO.RejectedInput> rejectedInputs, String field, String reason) {
        rejectedInputs.add(MailGatewayPreviewRespDTO.RejectedInput.builder().field(field).reason(reason).build());
    }

    private static Set<String> normalizedSet(List<String> values) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (String value : values) {
            result.add(normalizeInputKey(value));
        }
        return result;
    }

    private static String normalizeInputKey(String value) {
        return value == null ? "" : value.replaceAll("[_\\-.]", "").toLowerCase(Locale.ROOT);
    }

    private record NormalizedQuery(int page, int pageSize, int offset, String keyword, String tlsMode, Boolean enabled, Boolean authConfigured) {}
}
