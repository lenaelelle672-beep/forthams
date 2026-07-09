package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.NotificationTemplateDTO;
import com.ams.dto.NotificationTemplateMetaDTO;
import com.ams.dto.NotificationTemplatePreviewRequestDTO;
import com.ams.dto.NotificationTemplatePreviewRespDTO;
import com.ams.dto.NotificationTemplateQueryDTO;
import com.ams.entity.NotificationTemplate;
import com.ams.mapper.NotificationTemplateMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationTemplateService {

    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_META_LIMIT = 100;
    private static final String READONLY_BOUNDARY = "通知模板 catalog + safe preview；不发送、不配置渠道、不保存偏好、不控制流程通知开关、不接入邮件网关。";
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{\\s*([A-Za-z][A-Za-z0-9_]{0,63})\\s*}}", Pattern.CASE_INSENSITIVE);
    private static final Pattern VARIABLE_NAME_PATTERN = Pattern.compile("[A-Za-z][A-Za-z0-9_]{0,63}");
    private static final Set<String> SENSITIVE_VARIABLES = Set.of(
            "password", "token", "secret", "apikey", "clientsecret", "privatekey",
            "authorization", "cookie", "credential", "accesskey", "refreshtoken"
    );

    private final NotificationTemplateMapper notificationTemplateMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public NotificationTemplateDTO.PageResult list(NotificationTemplateQueryDTO query) {
        String tenantId = TenantContext.requireTenantId();
        NormalizedQuery normalized = normalizeQuery(query);
        long total = notificationTemplateMapper.countRecords(
                tenantId,
                normalized.category(),
                normalized.channelType(),
                normalized.status(),
                normalized.keyword()
        );
        List<NotificationTemplateDTO> records = total == 0
                ? List.of()
                : notificationTemplateMapper.selectPageRecords(
                        tenantId,
                        normalized.category(),
                        normalized.channelType(),
                        normalized.status(),
                        normalized.keyword(),
                        normalized.pageSize(),
                        normalized.offset()
                ).stream().map(this::toDTO).toList();
        long pages = total == 0 ? 0 : (long) Math.ceil((double) total / normalized.pageSize());
        return NotificationTemplateDTO.PageResult.builder()
                .records(records)
                .total(total)
                .size(normalized.pageSize())
                .current(normalized.page())
                .pages(pages)
                .tenantScoped(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    public NotificationTemplateDTO detail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        if (id == null || id <= 0) {
            throw new BusinessException("通知模板不存在");
        }
        NotificationTemplate template = notificationTemplateMapper.selectByIdAndTenant(tenantId, id);
        if (template == null) {
            throw new BusinessException("通知模板不存在");
        }
        return toDTO(template);
    }

    public NotificationTemplateDTO getByCode(String templateCode) {
        String tenantId = TenantContext.requireTenantId();
        String code = cleanToken(templateCode, 96);
        if (code == null) {
            throw new BusinessException("通知模板不存在");
        }
        NotificationTemplate template = notificationTemplateMapper.selectByCodeAndTenant(tenantId, code);
        if (template == null) {
            throw new BusinessException("通知模板不存在");
        }
        return toDTO(template);
    }

    public NotificationTemplateMetaDTO meta() {
        String tenantId = TenantContext.requireTenantId();
        List<NotificationTemplateMetaDTO.Option> categories = mergeOptions(
                notificationTemplateMapper.listCategories(tenantId, MAX_META_LIMIT),
                Map.of("retirement", "退休/报废", "maintenance", "维保", "approval", "审批", "system", "系统", "general", "通用")
        );
        List<NotificationTemplateMetaDTO.Option> channelTypes = mergeOptions(
                notificationTemplateMapper.listChannelTypes(tenantId, MAX_META_LIMIT),
                Map.of("ALL", "全部渠道", "IN_APP", "站内信", "EMAIL", "邮件")
        );
        return NotificationTemplateMetaDTO.builder()
                .categories(categories)
                .channelTypes(channelTypes)
                .statuses(List.of(option("1", "启用"), option("0", "停用")))
                .previewVariablePolicy(NotificationTemplateMetaDTO.PreviewVariablePolicy.builder()
                        .htmlEscaped(true)
                        .whitelistOnly(true)
                        .nonPersistent(true)
                        .sensitiveVariableNames(new ArrayList<>(SENSITIVE_VARIABLES))
                        .examples(List.of("assetName", "operatorName", "dueDate", "ticketNo"))
                        .build())
                .tenantScoped(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .nonGoals(List.of("不发送通知", "不配置渠道", "不保存用户偏好", "不控制流程通知开关", "不接入邮件网关"))
                .build();
    }

    public NotificationTemplatePreviewRespDTO preview(NotificationTemplatePreviewRequestDTO request) {
        String tenantId = TenantContext.requireTenantId();
        NotificationTemplatePreviewRequestDTO source = request == null ? new NotificationTemplatePreviewRequestDTO() : request;
        NotificationTemplate template = resolveTemplateForPreview(tenantId, source);
        String titleTemplate = firstText(source.getTitleTemplate(), template == null ? null : template.getTitleTemplate(), "");
        String contentTemplate = firstText(source.getContentTemplate(), template == null ? null : template.getContentTemplate(), "");
        Set<String> placeholders = new LinkedHashSet<>();
        placeholders.addAll(extractPlaceholders(titleTemplate));
        placeholders.addAll(extractPlaceholders(contentTemplate));
        Set<String> whitelist = new LinkedHashSet<>(parseDeclaredVariables(template == null ? null : template.getVariables()));
        if (whitelist.isEmpty()) {
            whitelist.addAll(placeholders);
        }

        Map<String, Object> variables = source.getVariables() == null ? Map.of() : source.getVariables();
        Map<String, String> acceptedValues = new LinkedHashMap<>();
        List<NotificationTemplatePreviewRespDTO.RejectedVariable> rejected = new ArrayList<>();
        for (Map.Entry<String, Object> entry : variables.entrySet()) {
            String name = cleanVariableName(entry.getKey());
            if (name == null) {
                rejected.add(rejected(entry.getKey(), "变量名非法"));
                continue;
            }
            if (isSensitiveVariable(name)) {
                rejected.add(rejected(name, "敏感变量名已拒绝"));
                continue;
            }
            if (!whitelist.contains(name) || !placeholders.contains(name)) {
                rejected.add(rejected(name, "不在模板变量白名单或本次模板占位符中"));
                continue;
            }
            if (entry.getValue() == null) {
                continue;
            }
            acceptedValues.put(name, String.valueOf(entry.getValue()));
        }

        List<String> missing = placeholders.stream()
                .filter(name -> !acceptedValues.containsKey(name))
                .toList();
        List<String> used = placeholders.stream()
                .filter(acceptedValues::containsKey)
                .toList();

        return NotificationTemplatePreviewRespDTO.builder()
                .renderedTitle(renderEscaped(titleTemplate, acceptedValues))
                .renderedContent(renderEscaped(contentTemplate, acceptedValues))
                .missingVariables(missing)
                .rejectedVariables(rejected)
                .usedVariables(used)
                .nonPersistent(true)
                .htmlEscaped(true)
                .tenantScoped(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    private NotificationTemplate resolveTemplateForPreview(String tenantId, NotificationTemplatePreviewRequestDTO request) {
        if (request.getTemplateId() != null) {
            NotificationTemplate template = notificationTemplateMapper.selectByIdAndTenant(tenantId, request.getTemplateId());
            if (template == null) {
                throw new BusinessException("通知模板不存在");
            }
            return template;
        }
        String code = cleanToken(request.getTemplateCode(), 96);
        if (code != null) {
            NotificationTemplate template = notificationTemplateMapper.selectByCodeAndTenant(tenantId, code);
            if (template == null) {
                throw new BusinessException("通知模板不存在");
            }
            return template;
        }
        return null;
    }

    private NotificationTemplateDTO toDTO(NotificationTemplate template) {
        return NotificationTemplateDTO.builder()
                .id(template.getId())
                .tenantId(template.getTenantId())
                .templateCode(template.getTemplateCode())
                .templateName(template.getTemplateName())
                .category(template.getCategory())
                .channelType(template.getChannelType())
                .titleTemplate(template.getTitleTemplate())
                .contentTemplate(template.getContentTemplate())
                .variables(template.getVariables())
                .isBuiltin(template.getIsBuiltin())
                .status(template.getStatus())
                .createBy(template.getCreateBy())
                .createTime(template.getCreateTime())
                .updateBy(template.getUpdateBy())
                .updateTime(template.getUpdateTime())
                .tenantScoped(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    private NormalizedQuery normalizeQuery(NotificationTemplateQueryDTO query) {
        NotificationTemplateQueryDTO source = query == null ? new NotificationTemplateQueryDTO() : query;
        int page = source.getPage() == null || source.getPage() < DEFAULT_PAGE ? DEFAULT_PAGE : source.getPage();
        int requestedSize = firstNumber(source.getPageSize(), source.getSize(), DEFAULT_PAGE_SIZE);
        int pageSize = requestedSize < 1 ? DEFAULT_PAGE_SIZE : Math.min(requestedSize, MAX_PAGE_SIZE);
        return new NormalizedQuery(
                page,
                pageSize,
                Math.max((page - 1) * pageSize, 0),
                cleanToken(source.getCategory(), 64),
                cleanToken(source.getChannelType(), 32),
                source.getStatus(),
                cleanText(source.getKeyword(), 80)
        );
    }

    private List<NotificationTemplateMetaDTO.Option> mergeOptions(List<String> observed, Map<String, String> defaults) {
        LinkedHashMap<String, String> values = new LinkedHashMap<>(defaults);
        if (observed != null) {
            for (String item : observed) {
                String value = cleanToken(item, 64);
                if (value != null) {
                    values.putIfAbsent(value, value);
                }
            }
        }
        return values.entrySet().stream().map(entry -> option(entry.getKey(), entry.getValue())).toList();
    }

    private NotificationTemplateMetaDTO.Option option(String value, String label) {
        return NotificationTemplateMetaDTO.Option.builder().value(value).label(label).build();
    }

    private List<String> parseDeclaredVariables(String raw) {
        String text = cleanText(raw, 2048);
        if (text == null) {
            return List.of();
        }
        try {
            if (text.startsWith("[")) {
                return objectMapper.readValue(text, new TypeReference<List<String>>() {}).stream()
                        .map(this::cleanVariableName)
                        .filter(name -> name != null && !isSensitiveVariable(name))
                        .distinct()
                        .toList();
            }
            if (text.startsWith("{")) {
                return objectMapper.readValue(text, new TypeReference<Map<String, Object>>() {}).keySet().stream()
                        .map(this::cleanVariableName)
                        .filter(name -> name != null && !isSensitiveVariable(name))
                        .distinct()
                        .toList();
            }
        } catch (Exception ignored) {
            // 变量声明兼容逗号分隔与 JSON 两种形式，解析失败时回落到正则提取。
        }
        Matcher matcher = VARIABLE_NAME_PATTERN.matcher(text);
        List<String> variables = new ArrayList<>();
        while (matcher.find()) {
            String name = cleanVariableName(matcher.group());
            if (name != null && !isSensitiveVariable(name) && !variables.contains(name)) {
                variables.add(name);
            }
        }
        return variables;
    }

    private List<String> extractPlaceholders(String template) {
        String text = template == null ? "" : template;
        Matcher matcher = VARIABLE_PATTERN.matcher(text);
        List<String> names = new ArrayList<>();
        while (matcher.find()) {
            String name = cleanVariableName(matcher.group(1));
            if (name != null && !names.contains(name)) {
                names.add(name);
            }
        }
        return names;
    }

    private String renderEscaped(String template, Map<String, String> variables) {
        String text = template == null ? "" : template;
        Matcher matcher = VARIABLE_PATTERN.matcher(text);
        StringBuffer buffer = new StringBuffer();
        while (matcher.find()) {
            String name = cleanVariableName(matcher.group(1));
            String replacement = name != null && variables.containsKey(name) ? variables.get(name) : matcher.group();
            matcher.appendReplacement(buffer, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(buffer);
        return escapeHtml(buffer.toString());
    }

    private NotificationTemplatePreviewRespDTO.RejectedVariable rejected(String name, String reason) {
        return NotificationTemplatePreviewRespDTO.RejectedVariable.builder()
                .name(name == null ? "" : name)
                .reason(reason)
                .build();
    }

    private boolean isSensitiveVariable(String name) {
        String normalized = name.replaceAll("[_\\-.]", "").toLowerCase(Locale.ROOT);
        return SENSITIVE_VARIABLES.stream().anyMatch(normalized::contains);
    }

    private String escapeHtml(String value) {
        return value == null ? "" : value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String cleanVariableName(String value) {
        if (value == null) {
            return null;
        }
        String text = value.trim();
        return VARIABLE_NAME_PATTERN.matcher(text).matches() ? text : null;
    }

    private String cleanToken(String value, int maxLength) {
        String text = cleanText(value, maxLength);
        if (text == null) {
            return null;
        }
        return text.replaceAll("[^A-Za-z0-9_\\-]", "");
    }

    private String cleanText(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String text = value.trim();
        return text.length() > maxLength ? text.substring(0, maxLength) : text;
    }

    private String firstText(String first, String second, String fallback) {
        String firstClean = cleanText(first, 8192);
        if (firstClean != null) {
            return firstClean;
        }
        String secondClean = cleanText(second, 8192);
        return secondClean == null ? fallback : secondClean;
    }

    private int firstNumber(Integer first, Integer second, int fallback) {
        if (first != null) {
            return first;
        }
        return second == null ? fallback : second;
    }

    private record NormalizedQuery(int page, int pageSize, int offset, String category, String channelType, Integer status, String keyword) {}
}
