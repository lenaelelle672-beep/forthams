package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.NumberingRuleDTO;
import com.ams.dto.NumberingRuleMetaDTO;
import com.ams.dto.NumberingRulePreviewRequestDTO;
import com.ams.dto.NumberingRulePreviewRespDTO;
import com.ams.entity.SystemConfig;
import com.ams.mapper.SystemConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
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
public class NumberingRuleService {

    private static final String GROUP_SYSTEM = "SYSTEM";
    private static final String PREFIX = "numbering.rule.";
    private static final String AUTHORITY = "system_config:numbering.rule.*";
    private static final String SOURCE_CONFIG = "system_config";
    private static final String SOURCE_DEFAULT = "default";
    private static final String READONLY_BOUNDARY = "read-only numbering rule catalog + no-persistence deterministic preview；不写库、不刷新缓存、不预留序号、不改变运行时。";
    private static final LocalDateTime DEFAULT_SAMPLE_AT = LocalDateTime.of(2026, 1, 2, 3, 4, 5);
    private static final Pattern RULE_SUFFIX_PATTERN = Pattern.compile("[A-Za-z0-9_.-]{1,80}");
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{[A-Za-z0-9_]+}");
    private static final Pattern SAMPLE_SEQUENCE_PATTERN = Pattern.compile("[A-Za-z0-9_-]{1,24}");
    private static final Set<String> FORBIDDEN_UNKNOWN_INPUTS = Set.of(
            "tenantid", "userid", "assetid", "workorderid", "processid", "runtimecontext", "sequence", "sequenceid"
    );
    private static final List<String> ALLOWED_VARIABLES = List.of("{YYYYMMDD}", "{YYYY}", "{YY}", "{MM}", "{DD}", "{HH}", "{MI}", "{SS}", "{SEQ}");
    private static final Map<String, DefaultRule> DEFAULT_RULES = defaultRules();

    private final SystemConfigMapper systemConfigMapper;

    public List<NumberingRuleDTO> list() {
        String tenantId = TenantContext.requireTenantId();
        LinkedHashMap<String, NumberingRuleDTO> merged = new LinkedHashMap<>();
        DEFAULT_RULES.forEach((key, rule) -> merged.put(key, defaultDTO(tenantId, key, rule)));
        safeList(systemConfigMapper.selectList(baseWrapper(tenantId).likeRight("config_key", PREFIX).orderByAsc("config_key")))
                .forEach(item -> {
                    String key = normalizeRuleKeyOrNull(item.getConfigKey());
                    if (key != null) {
                        merged.put(key, toDTO(item));
                    }
                });
        return new ArrayList<>(merged.values());
    }

    public NumberingRuleDTO get(String ruleKey) {
        String tenantId = TenantContext.requireTenantId();
        String normalizedKey = normalizeRuleKeyOrThrow(ruleKey);
        SystemConfig entity = systemConfigMapper.selectOne(baseWrapper(tenantId)
                .eq("config_key", normalizedKey)
                .last("limit 1"));
        if (entity != null) {
            return toDTO(entity);
        }
        DefaultRule defaultRule = DEFAULT_RULES.get(normalizedKey);
        if (defaultRule == null) {
            throw new BusinessException(404, "编号规则不存在");
        }
        return defaultDTO(tenantId, normalizedKey, defaultRule);
    }

    public NumberingRuleMetaDTO meta() {
        String tenantId = TenantContext.requireTenantId();
        return NumberingRuleMetaDTO.builder()
                .defaultRules(DEFAULT_RULES.entrySet().stream()
                        .map(entry -> defaultDTO(tenantId, entry.getKey(), entry.getValue()))
                        .toList())
                .allowedVariables(variableOptions())
                .previewPolicy(NumberingRuleMetaDTO.PreviewPolicy.builder()
                        .deterministic(true)
                        .noPersistence(true)
                        .noSequenceReserved(true)
                        .runtimeEffect(false)
                        .cacheRefreshed(false)
                        .sequenceAllocated(false)
                        .persistent(false)
                        .readonlyBoundary(READONLY_BOUNDARY)
                        .rejectedInputFields(new ArrayList<>(FORBIDDEN_UNKNOWN_INPUTS))
                        .build())
                .tenantScoped(true)
                .readOnly(true)
                .noPersistencePreview(true)
                .noSequenceReserved(true)
                .runtimeEffect(false)
                .cacheRefreshed(false)
                .sequenceAllocated(false)
                .persistent(false)
                .authority(AUTHORITY)
                .readonlyBoundary(READONLY_BOUNDARY)
                .nonGoals(List.of("不分配或预留序列号", "不保证并发唯一", "不接入资产/工单/流程创建链路", "不完成基础资料组或 44 项全量覆盖"))
                .build();
    }

    public NumberingRulePreviewRespDTO preview(NumberingRulePreviewRequestDTO request) {
        String tenantId = TenantContext.requireTenantId();
        NumberingRulePreviewRequestDTO source = request == null ? new NumberingRulePreviewRequestDTO() : request;
        List<String> missingVariables = new ArrayList<>();
        List<String> rejectedVariables = new ArrayList<>();
        collectUnknownInputs(source.getUnknownInputs(), rejectedVariables);

        String normalizedKey = normalizeRuleKeyOrNull(source.getRuleKey());
        if (hasText(source.getRuleKey()) && normalizedKey == null) {
            rejectedVariables.add("ruleKey");
        }
        String template = cleanTemplate(source.getTemplate());
        if (!hasText(template)) {
            NumberingRuleDTO rule = resolveRuleForPreview(tenantId, normalizedKey == null ? PREFIX + "asset" : normalizedKey);
            normalizedKey = rule.getRuleKey();
            template = rule.getTemplate();
        }
        if (!hasText(template)) {
            missingVariables.add("template");
            template = DEFAULT_RULES.get(PREFIX + "asset").template();
        }

        LocalDateTime sampleAt = parseSampleAt(source.getSampleAt(), rejectedVariables);
        String sampleSequence = normalizeSampleSequence(source.getSampleSequence(), rejectedVariables);
        PreviewVariables previewVariables = buildPreviewVariables(sampleAt, sampleSequence);
        LinkedHashSet<String> usedVariables = new LinkedHashSet<>();
        String previewValue = renderTemplate(template, previewVariables.values(), usedVariables, rejectedVariables);

        return NumberingRulePreviewRespDTO.builder()
                .ruleKey(normalizedKey)
                .template(template)
                .previewValue(previewValue)
                .usedVariables(new ArrayList<>(usedVariables))
                .missingVariables(missingVariables)
                .rejectedVariables(rejectedVariables.stream().distinct().toList())
                .authority(AUTHORITY)
                .warnings(List.of("预览不会持久化、不刷新缓存、不预留或占用序号", "当前不保证并发唯一", "当前未接入资产/工单/流程创建链路"))
                .tenantScoped(true)
                .noPersistence(true)
                .noSequenceReserved(true)
                .runtimeEffect(false)
                .cacheRefreshed(false)
                .sequenceAllocated(false)
                .persistent(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    private NumberingRuleDTO resolveRuleForPreview(String tenantId, String normalizedKey) {
        SystemConfig entity = systemConfigMapper.selectOne(baseWrapper(tenantId)
                .eq("config_key", normalizedKey)
                .last("limit 1"));
        if (entity != null) {
            return toDTO(entity);
        }
        DefaultRule defaultRule = DEFAULT_RULES.getOrDefault(normalizedKey, DEFAULT_RULES.get(PREFIX + "asset"));
        return defaultDTO(tenantId, normalizedKey, defaultRule);
    }

    private QueryWrapper<SystemConfig> baseWrapper(String tenantId) {
        return new QueryWrapper<SystemConfig>()
                .eq("tenant_id", tenantId)
                .eq("config_group", GROUP_SYSTEM)
                .eq("removed", 0);
    }

    private NumberingRuleDTO toDTO(SystemConfig config) {
        String key = normalizeRuleKeyOrNull(config.getConfigKey());
        DefaultRule fallback = DEFAULT_RULES.get(key);
        String template = hasText(config.getConfigValue()) ? config.getConfigValue().trim() : fallback == null ? "" : fallback.template();
        return NumberingRuleDTO.builder()
                .id(config.getId())
                .tenantId(config.getTenantId())
                .ruleKey(key)
                .name(hasText(config.getConfigName()) ? config.getConfigName().trim() : fallback == null ? key : fallback.name())
                .template(template)
                .source(SOURCE_CONFIG)
                .authority(AUTHORITY)
                .defaultRule(false)
                .tenantScoped(true)
                .readOnly(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .variables(extractAllowedVariables(template))
                .updateTime(config.getUpdateTime())
                .build();
    }

    private NumberingRuleDTO defaultDTO(String tenantId, String ruleKey, DefaultRule rule) {
        return NumberingRuleDTO.builder()
                .tenantId(tenantId)
                .ruleKey(ruleKey)
                .name(rule.name())
                .template(rule.template())
                .source(SOURCE_DEFAULT)
                .authority(AUTHORITY)
                .defaultRule(true)
                .tenantScoped(true)
                .readOnly(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .variables(extractAllowedVariables(rule.template()))
                .build();
    }

    private List<NumberingRuleMetaDTO.VariableOption> variableOptions() {
        LinkedHashMap<String, String> labels = new LinkedHashMap<>();
        labels.put("{YYYYMMDD}", "年月日 8 位");
        labels.put("{YYYY}", "四位年份");
        labels.put("{YY}", "两位年份");
        labels.put("{MM}", "两位月份");
        labels.put("{DD}", "两位日期");
        labels.put("{HH}", "两位小时");
        labels.put("{MI}", "两位分钟");
        labels.put("{SS}", "两位秒");
        labels.put("{SEQ}", "样例序号，仅用于预览替换，不分配或预留");
        return labels.entrySet().stream()
                .map(entry -> NumberingRuleMetaDTO.VariableOption.builder().value(entry.getKey()).label(entry.getValue()).build())
                .toList();
    }

    private List<String> extractAllowedVariables(String template) {
        if (!hasText(template)) {
            return List.of();
        }
        LinkedHashSet<String> variables = new LinkedHashSet<>();
        Matcher matcher = VARIABLE_PATTERN.matcher(template);
        while (matcher.find()) {
            String variable = matcher.group();
            if (ALLOWED_VARIABLES.contains(variable)) {
                variables.add(variable);
            }
        }
        return new ArrayList<>(variables);
    }

    private String renderTemplate(String template, Map<String, String> variables, Set<String> usedVariables, List<String> rejectedVariables) {
        Matcher matcher = VARIABLE_PATTERN.matcher(template);
        StringBuffer result = new StringBuffer();
        while (matcher.find()) {
            String variable = matcher.group();
            String replacement = variables.get(variable);
            if (replacement == null) {
                rejectedVariables.add(variable);
                replacement = variable;
            } else {
                usedVariables.add(variable);
            }
            matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    private PreviewVariables buildPreviewVariables(LocalDateTime sampleAt, String sampleSequence) {
        LinkedHashMap<String, String> values = new LinkedHashMap<>();
        values.put("{YYYYMMDD}", sampleAt.format(DateTimeFormatter.ofPattern("yyyyMMdd")));
        values.put("{YYYY}", sampleAt.format(DateTimeFormatter.ofPattern("yyyy")));
        values.put("{YY}", sampleAt.format(DateTimeFormatter.ofPattern("yy")));
        values.put("{MM}", sampleAt.format(DateTimeFormatter.ofPattern("MM")));
        values.put("{DD}", sampleAt.format(DateTimeFormatter.ofPattern("dd")));
        values.put("{HH}", sampleAt.format(DateTimeFormatter.ofPattern("HH")));
        values.put("{MI}", sampleAt.format(DateTimeFormatter.ofPattern("mm")));
        values.put("{SS}", sampleAt.format(DateTimeFormatter.ofPattern("ss")));
        values.put("{SEQ}", sampleSequence);
        return new PreviewVariables(values);
    }

    private LocalDateTime parseSampleAt(String rawValue, List<String> rejectedVariables) {
        if (!hasText(rawValue)) {
            return DEFAULT_SAMPLE_AT;
        }
        String value = rawValue.trim();
        try {
            return LocalDateTime.parse(value, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDate.parse(value, DateTimeFormatter.ISO_LOCAL_DATE).atStartOfDay();
            } catch (DateTimeParseException e) {
                rejectedVariables.add("sampleAt");
                return DEFAULT_SAMPLE_AT;
            }
        }
    }

    private String normalizeSampleSequence(String rawValue, List<String> rejectedVariables) {
        if (!hasText(rawValue)) {
            return "001";
        }
        String value = rawValue.trim();
        if (SAMPLE_SEQUENCE_PATTERN.matcher(value).matches()) {
            return value;
        }
        rejectedVariables.add("sampleSequence");
        return "001";
    }

    private void collectUnknownInputs(Map<String, Object> unknownInputs, List<String> rejectedVariables) {
        if (unknownInputs == null || unknownInputs.isEmpty()) {
            return;
        }
        for (String field : unknownInputs.keySet()) {
            String normalized = field == null ? "" : field.replaceAll("[_\\-.]", "").toLowerCase(Locale.ROOT);
            if (FORBIDDEN_UNKNOWN_INPUTS.contains(normalized)) {
                rejectedVariables.add(field);
            } else {
                rejectedVariables.add(field == null ? "unknown" : field);
            }
        }
    }

    private String normalizeRuleKeyOrThrow(String rawValue) {
        String normalized = normalizeRuleKeyOrNull(rawValue);
        if (normalized == null) {
            throw new BusinessException(400, "编号规则编码必须以 numbering.rule. 开头，且只能包含字母、数字、点、下划线和中划线");
        }
        return normalized;
    }

    private String normalizeRuleKeyOrNull(String rawValue) {
        if (!hasText(rawValue)) {
            return null;
        }
        String value = rawValue.trim();
        if (!value.startsWith(PREFIX)) {
            value = PREFIX + value;
        }
        String suffix = value.substring(PREFIX.length());
        if (!RULE_SUFFIX_PATTERN.matcher(suffix).matches()) {
            return null;
        }
        return PREFIX + suffix;
    }

    private String cleanTemplate(String rawValue) {
        if (!hasText(rawValue)) {
            return null;
        }
        return rawValue.trim().substring(0, Math.min(rawValue.trim().length(), 160));
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private List<SystemConfig> safeList(List<SystemConfig> source) {
        return source == null ? List.of() : source;
    }

    private static Map<String, DefaultRule> defaultRules() {
        LinkedHashMap<String, DefaultRule> rules = new LinkedHashMap<>();
        rules.put(PREFIX + "asset", new DefaultRule("资产编号规则", "AUTO-{YYYYMMDD}-{SEQ}"));
        rules.put(PREFIX + "workorder", new DefaultRule("工单编号规则", "WO-{YYYYMMDD}-{SEQ}"));
        rules.put(PREFIX + "approval", new DefaultRule("审批流程编号规则", "AP-{YYYYMMDD}-{SEQ}"));
        rules.put(PREFIX + "retirement", new DefaultRule("退役申请编号规则", "RT-{YYYYMMDD}-{SEQ}"));
        rules.put(PREFIX + "compensation", new DefaultRule("赔偿流程编号规则", "CMP-{YYYYMMDD}-{SEQ}"));
        rules.put(PREFIX + "inventory", new DefaultRule("盘点任务编号规则", "INV-{YYYYMMDD}-{SEQ}"));
        return rules;
    }

    private record DefaultRule(String name, String template) {
    }

    private record PreviewVariables(Map<String, String> values) {
    }
}
