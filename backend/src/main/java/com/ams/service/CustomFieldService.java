package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.CustomFieldDTO;
import com.ams.dto.CustomFieldMetaDTO;
import com.ams.dto.CustomFieldPreviewRequestDTO;
import com.ams.dto.CustomFieldPreviewRespDTO;
import com.ams.dto.CustomFieldQueryDTO;
import com.ams.entity.CustomField;
import com.ams.mapper.CustomFieldMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.net.URI;
import java.time.LocalDate;
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
public class CustomFieldService {

    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_META_LIMIT = 100;
    private static final int MAX_REGEX_LENGTH = 128;
    private static final int MAX_SAMPLE_LENGTH = 256;
    private static final String READONLY_BOUNDARY = "自定义字段定义只读 catalog + 无持久化校验预览；不提供字段定义 CRUD runtime、不完成字段集/资产字段值/运行时表单 schema/加密值存储。";
    private static final Set<String> SUPPORTED_TYPES = Set.of("TEXT", "NUMBER", "DATE", "DROPDOWN", "BOOLEAN", "URL", "EMAIL", "REGEX");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$", Pattern.CASE_INSENSITIVE);
    private static final Pattern SIMPLE_NESTED_QUANTIFIER = Pattern.compile("\\([^)]*[+*][^)]*\\)[+*?{]");

    private final CustomFieldMapper customFieldMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CustomFieldDTO.PageResult list(CustomFieldQueryDTO query) {
        String tenantId = TenantContext.requireTenantId();
        NormalizedQuery normalized = normalizeQuery(query);
        long total = customFieldMapper.countRecords(tenantId, normalized.fieldType(), normalized.status(), normalized.keyword());
        List<CustomFieldDTO> records = total == 0
                ? List.of()
                : customFieldMapper.selectPageRecords(
                        tenantId,
                        normalized.fieldType(),
                        normalized.status(),
                        normalized.keyword(),
                        normalized.pageSize(),
                        normalized.offset()
                ).stream().map(this::toDTO).toList();
        long pages = total == 0 ? 0 : (long) Math.ceil((double) total / normalized.pageSize());
        return CustomFieldDTO.PageResult.builder()
                .records(records)
                .total(total)
                .size(normalized.pageSize())
                .current(normalized.page())
                .pages(pages)
                .tenantScoped(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    public List<CustomFieldDTO> all() {
        String tenantId = TenantContext.requireTenantId();
        return customFieldMapper.selectAllEnabled(tenantId).stream().map(this::toDTO).toList();
    }

    public CustomFieldDTO detail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        if (id == null || id <= 0) {
            throw new BusinessException("自定义字段不存在");
        }
        CustomField field = customFieldMapper.selectByIdAndTenant(tenantId, id);
        if (field == null) {
            throw new BusinessException("自定义字段不存在");
        }
        return toDTO(field);
    }

    public CustomFieldMetaDTO meta() {
        String tenantId = TenantContext.requireTenantId();
        List<CustomFieldMetaDTO.Option> fieldTypes = mergeFieldTypeOptions(customFieldMapper.listFieldTypes(tenantId, MAX_META_LIMIT));
        return CustomFieldMetaDTO.builder()
                .fieldTypes(fieldTypes)
                .statuses(List.of(option("1", "启用"), option("0", "停用")))
                .previewPolicy(CustomFieldMetaDTO.PreviewPolicy.builder()
                        .noPersistence(true)
                        .tenantScoped(true)
                        .safeDisplay(true)
                        .encryptedSampleEcho(false)
                        .regexSafetyBounded(true)
                        .supportedTypes(new ArrayList<>(SUPPORTED_TYPES))
                        .rejectedEffects(List.of("字段定义 CRUD runtime", "字段集绑定", "资产字段值写入", "运行时表单 schema 生效", "加密值存储"))
                        .build())
                .readOnly(true)
                .tenantScoped(true)
                .noPersistencePreview(true)
                .fieldsetsDeferred(true)
                .assetValuesDeferred(true)
                .runtimeEffect(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .nonGoals(List.of("不创建/更新/删除字段定义", "不完成字段集", "不写资产字段值", "不接入资产表单运行时 schema", "不处理加密值存储或 secret"))
                .build();
    }

    public CustomFieldPreviewRespDTO preview(CustomFieldPreviewRequestDTO request) {
        String tenantId = TenantContext.requireTenantId();
        CustomFieldPreviewRequestDTO source = request == null ? new CustomFieldPreviewRequestDTO() : request;
        Map<String, Object> rawValues = source.getValues() == null ? Map.of() : source.getValues();
        Map<String, Object> values = normalizeValueKeys(rawValues);
        List<Long> fieldIds = normalizeFieldIds(source.getFieldIds(), rawValues.keySet());
        List<String> fieldNames = normalizeFieldNames(source.getFieldNames(), rawValues.keySet());
        List<CustomField> fields = customFieldMapper.selectPreviewDefinitions(tenantId, fieldIds, fieldNames);

        List<CustomFieldPreviewRespDTO.FieldIssue> missing = new ArrayList<>();
        List<CustomFieldPreviewRespDTO.FieldIssue> rejected = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        List<CustomFieldPreviewRespDTO.UsedField> usedFields = new ArrayList<>();

        for (CustomField field : fields) {
            Object value = firstValue(values, field);
            boolean supplied = value != null && !String.valueOf(value).isBlank();
            if (isRequired(field) && !supplied) {
                CustomFieldPreviewRespDTO.FieldIssue issue = issue(field, "必填字段未提供样例值");
                missing.add(issue);
                errors.add(issue.getFieldLabel() + "：必填字段未提供样例值");
            }
            if (supplied) {
                String rejection = validateValue(field, value);
                if (rejection != null) {
                    CustomFieldPreviewRespDTO.FieldIssue issue = issue(field, rejection);
                    rejected.add(issue);
                    errors.add(issue.getFieldLabel() + "：" + rejection);
                }
            }
            if (supplied || isRequired(field)) {
                usedFields.add(usedField(field));
            }
        }

        if (!fieldIds.isEmpty() || !fieldNames.isEmpty()) {
            recordUnmatchedRequestedFields(fieldIds, fieldNames, fields, rejected, errors);
        }

        return CustomFieldPreviewRespDTO.builder()
                .valid(missing.isEmpty() && rejected.isEmpty())
                .missing(missing)
                .rejected(rejected)
                .errors(errors)
                .usedFields(usedFields)
                .tenantScoped(true)
                .noPersistence(true)
                .runtimeEffect(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    private CustomFieldDTO toDTO(CustomField field) {
        return CustomFieldDTO.builder()
                .id(field.getId())
                .tenantId(field.getTenantId())
                .fieldName(escapeHtml(field.getFieldName()))
                .fieldLabel(escapeHtml(field.getFieldLabel()))
                .fieldType(cleanFieldType(field.getFieldType()))
                .fieldOptions(escapeHtml(field.getFieldOptions()))
                .validationPattern(escapeHtml(field.getValidationPattern()))
                .fieldOrder(field.getFieldOrder())
                .required(field.getRequired())
                .encrypted(field.getEncrypted())
                .status(field.getStatus())
                .createBy(field.getCreateBy())
                .createTime(field.getCreateTime())
                .updateBy(field.getUpdateBy())
                .updateTime(field.getUpdateTime())
                .tenantScoped(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    private String validateValue(CustomField field, Object rawValue) {
        String value = cleanSample(rawValue);
        if (value == null) {
            return isRequired(field) ? "必填字段未提供样例值" : null;
        }
        String fieldType = cleanFieldType(field.getFieldType());
        if (!SUPPORTED_TYPES.contains(fieldType)) {
            return "字段类型不在预览白名单内";
        }
        String typeError = switch (fieldType) {
            case "NUMBER" -> validateNumber(value);
            case "DATE" -> validateDate(value);
            case "DROPDOWN" -> validateDropdown(field, value);
            case "BOOLEAN" -> validateBoolean(value);
            case "URL" -> validateUrl(value);
            case "EMAIL" -> validateEmail(value);
            case "REGEX" -> validateRegex(field, value);
            default -> null;
        };
        if (typeError != null) {
            return typeError;
        }
        String pattern = cleanPattern(field.getValidationPattern());
        if (pattern != null) {
            return validateAgainstPattern(pattern, value);
        }
        return null;
    }

    private String validateNumber(String value) {
        try {
            new BigDecimal(value);
            return null;
        } catch (NumberFormatException ex) {
            return "数字格式不合法";
        }
    }

    private String validateDate(String value) {
        try {
            LocalDate.parse(value);
            return null;
        } catch (Exception ex) {
            return "日期必须使用 YYYY-MM-DD";
        }
    }

    private String validateDropdown(CustomField field, String value) {
        List<String> options = parseOptions(field.getFieldOptions());
        if (options.isEmpty()) {
            return "下拉选项为空或不可解析";
        }
        return options.contains(value) ? null : "不在下拉选项白名单内";
    }

    private String validateBoolean(String value) {
        String normalized = value.toLowerCase(Locale.ROOT);
        return Set.of("true", "false", "1", "0", "是", "否", "yes", "no").contains(normalized) ? null : "布尔值不合法";
    }

    private String validateUrl(String value) {
        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme();
            return scheme != null && Set.of("http", "https").contains(scheme.toLowerCase(Locale.ROOT)) ? null : "URL 仅允许 http/https";
        } catch (Exception ex) {
            return "URL 格式不合法";
        }
    }

    private String validateEmail(String value) {
        return EMAIL_PATTERN.matcher(value).matches() ? null : "邮箱格式不合法";
    }

    private String validateRegex(CustomField field, String value) {
        String pattern = cleanPattern(field.getValidationPattern());
        if (pattern == null) {
            return "REGEX 字段缺少安全正则";
        }
        return validateAgainstPattern(pattern, value);
    }

    private String validateAgainstPattern(String pattern, String value) {
        if (!isSafeRegex(pattern)) {
            return "正则模式不安全或超出长度限制";
        }
        try {
            return Pattern.compile(pattern).matcher(value).matches() ? null : "未匹配字段正则规则";
        } catch (Exception ex) {
            return "正则模式不合法";
        }
    }

    private boolean isSafeRegex(String pattern) {
        if (pattern.length() > MAX_REGEX_LENGTH || SIMPLE_NESTED_QUANTIFIER.matcher(pattern).find()) {
            return false;
        }
        return !pattern.contains("(?<=")
                && !pattern.contains("(?<!")
                && !pattern.contains("\\1")
                && !pattern.contains("\\2")
                && !pattern.contains(".*.*")
                && !pattern.contains(".+.+");
    }

    private CustomFieldPreviewRespDTO.FieldIssue issue(CustomField field, String reason) {
        return CustomFieldPreviewRespDTO.FieldIssue.builder()
                .fieldId(field.getId())
                .fieldName(escapeHtml(field.getFieldName()))
                .fieldLabel(escapeHtml(field.getFieldLabel()))
                .reason(escapeHtml(reason))
                .build();
    }

    private CustomFieldPreviewRespDTO.UsedField usedField(CustomField field) {
        return CustomFieldPreviewRespDTO.UsedField.builder()
                .fieldId(field.getId())
                .fieldName(escapeHtml(field.getFieldName()))
                .fieldLabel(escapeHtml(field.getFieldLabel()))
                .fieldType(cleanFieldType(field.getFieldType()))
                .required(isRequired(field))
                .encrypted(isEncrypted(field))
                .validationPattern(escapeHtml(field.getValidationPattern()))
                .options(parseOptions(field.getFieldOptions()).stream().map(this::escapeHtml).toList())
                .build();
    }

    private void recordUnmatchedRequestedFields(List<Long> fieldIds,
                                                List<String> fieldNames,
                                                List<CustomField> fields,
                                                List<CustomFieldPreviewRespDTO.FieldIssue> rejected,
                                                List<String> errors) {
        Set<Long> matchedIds = fields.stream().map(CustomField::getId).collect(LinkedHashSet::new, Set::add, Set::addAll);
        Set<String> matchedNames = fields.stream().map(CustomField::getFieldName).collect(LinkedHashSet::new, Set::add, Set::addAll);
        fieldIds.stream().filter(id -> !matchedIds.contains(id)).forEach(id -> {
            CustomFieldPreviewRespDTO.FieldIssue issue = CustomFieldPreviewRespDTO.FieldIssue.builder()
                    .fieldId(id)
                    .fieldName(String.valueOf(id))
                    .fieldLabel(String.valueOf(id))
                    .reason("字段不存在或不属于当前租户")
                    .build();
            rejected.add(issue);
            errors.add("字段 " + id + "：字段不存在或不属于当前租户");
        });
        fieldNames.stream().filter(name -> !matchedNames.contains(name)).forEach(name -> {
            CustomFieldPreviewRespDTO.FieldIssue issue = CustomFieldPreviewRespDTO.FieldIssue.builder()
                    .fieldName(escapeHtml(name))
                    .fieldLabel(escapeHtml(name))
                    .reason("字段不存在或不属于当前租户")
                    .build();
            rejected.add(issue);
            errors.add("字段 " + escapeHtml(name) + "：字段不存在或不属于当前租户");
        });
    }

    private Object firstValue(Map<String, Object> values, CustomField field) {
        if (field.getFieldName() != null && values.containsKey(field.getFieldName())) {
            return values.get(field.getFieldName());
        }
        String idKey = field.getId() == null ? null : String.valueOf(field.getId());
        return idKey != null && values.containsKey(idKey) ? values.get(idKey) : null;
    }

    private Map<String, Object> normalizeValueKeys(Map<String, Object> rawValues) {
        LinkedHashMap<String, Object> values = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : rawValues.entrySet()) {
            String key = cleanToken(entry.getKey(), 96);
            if (key != null) {
                values.put(key, entry.getValue());
            }
        }
        return values;
    }

    private List<Long> normalizeFieldIds(List<Long> declaredIds, Set<String> valueKeys) {
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        if (declaredIds != null) {
            declaredIds.stream().filter(id -> id != null && id > 0).forEach(ids::add);
        }
        for (String key : valueKeys) {
            try {
                long id = Long.parseLong(key);
                if (id > 0) {
                    ids.add(id);
                }
            } catch (NumberFormatException ignored) {
                // 非数字 key 按 fieldName 处理。
            }
        }
        return new ArrayList<>(ids);
    }

    private List<String> normalizeFieldNames(List<String> declaredNames, Set<String> valueKeys) {
        LinkedHashSet<String> names = new LinkedHashSet<>();
        if (declaredNames != null) {
            declaredNames.stream().map(name -> cleanToken(name, 96)).filter(name -> name != null && !isNumeric(name)).forEach(names::add);
        }
        valueKeys.stream().map(name -> cleanToken(name, 96)).filter(name -> name != null && !isNumeric(name)).forEach(names::add);
        return new ArrayList<>(names);
    }

    private List<String> parseOptions(String raw) {
        String text = cleanText(raw, 2048);
        if (text == null) {
            return List.of();
        }
        try {
            if (text.startsWith("[")) {
                return objectMapper.readValue(text, new TypeReference<List<String>>() {}).stream()
                        .map(value -> cleanText(value, 128))
                        .filter(value -> value != null)
                        .distinct()
                        .toList();
            }
            if (text.startsWith("{")) {
                return objectMapper.readValue(text, new TypeReference<Map<String, Object>>() {}).values().stream()
                        .map(String::valueOf)
                        .map(value -> cleanText(value, 128))
                        .filter(value -> value != null)
                        .distinct()
                        .toList();
            }
        } catch (Exception ignored) {
            // 选项兼容 JSON 与逗号分隔；解析失败时继续走逗号分隔。
        }
        return List.of(text.split(",")).stream()
                .map(value -> cleanText(value, 128))
                .filter(value -> value != null)
                .distinct()
                .toList();
    }

    private List<CustomFieldMetaDTO.Option> mergeFieldTypeOptions(List<String> observed) {
        LinkedHashMap<String, String> defaults = new LinkedHashMap<>();
        defaults.put("TEXT", "文本");
        defaults.put("NUMBER", "数字");
        defaults.put("DATE", "日期");
        defaults.put("DROPDOWN", "下拉");
        defaults.put("BOOLEAN", "布尔");
        defaults.put("URL", "链接");
        defaults.put("EMAIL", "邮箱");
        defaults.put("REGEX", "正则");
        if (observed != null) {
            observed.stream().map(this::cleanFieldType).filter(SUPPORTED_TYPES::contains).forEach(type -> defaults.putIfAbsent(type, type));
        }
        return defaults.entrySet().stream().map(entry -> option(entry.getKey(), entry.getValue())).toList();
    }

    private CustomFieldMetaDTO.Option option(String value, String label) {
        return CustomFieldMetaDTO.Option.builder().value(value).label(label).build();
    }

    private NormalizedQuery normalizeQuery(CustomFieldQueryDTO query) {
        CustomFieldQueryDTO source = query == null ? new CustomFieldQueryDTO() : query;
        int page = source.getPage() == null || source.getPage() < DEFAULT_PAGE ? DEFAULT_PAGE : source.getPage();
        int requestedSize = firstNumber(source.getPageSize(), source.getSize(), DEFAULT_PAGE_SIZE);
        int pageSize = requestedSize < 1 ? DEFAULT_PAGE_SIZE : Math.min(requestedSize, MAX_PAGE_SIZE);
        return new NormalizedQuery(
                page,
                pageSize,
                Math.max((page - 1) * pageSize, 0),
                normalizeFieldTypeFilter(source.getFieldType()),
                source.getStatus(),
                cleanText(source.getKeyword(), 80)
        );
    }

    private String normalizeFieldTypeFilter(String value) {
        String type = cleanFieldType(value);
        return SUPPORTED_TYPES.contains(type) ? type : null;
    }

    private String cleanFieldType(String value) {
        return value == null ? "TEXT" : cleanToken(value.toUpperCase(Locale.ROOT), 32);
    }

    private String cleanPattern(String value) {
        return cleanText(value, MAX_REGEX_LENGTH);
    }

    private String cleanSample(Object value) {
        if (value == null) {
            return null;
        }
        return cleanText(String.valueOf(value), MAX_SAMPLE_LENGTH);
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

    private boolean isNumeric(String value) {
        return value != null && value.matches("\\d+");
    }

    private boolean isRequired(CustomField field) {
        return Integer.valueOf(1).equals(field.getRequired());
    }

    private boolean isEncrypted(CustomField field) {
        return Integer.valueOf(1).equals(field.getEncrypted());
    }

    private String escapeHtml(String value) {
        return value == null ? null : value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private int firstNumber(Integer first, Integer second, int fallback) {
        if (first != null) {
            return first;
        }
        return second == null ? fallback : second;
    }

    private record NormalizedQuery(int page, int pageSize, int offset, String fieldType, Integer status, String keyword) {}
}
