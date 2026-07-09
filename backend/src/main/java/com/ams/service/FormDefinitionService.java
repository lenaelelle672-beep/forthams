package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.FormDefinitionDTO;
import com.ams.dto.FormDefinitionOperationDTO;
import com.ams.dto.FormDefinitionPreviewDTO;
import com.ams.dto.FormDefinitionSaveDTO;
import com.ams.dto.FormDefinitionSchemaValidationResultDTO;
import com.ams.dto.FormDefinitionVersionDTO;
import com.ams.entity.FormDefinition;
import com.ams.entity.FormDefinitionVersion;
import com.ams.mapper.FormDefinitionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class FormDefinitionService {

    private static final String STATUS_DRAFT = "DRAFT";
    private static final String STATUS_PUBLISHED = "PUBLISHED";
    private static final String STATUS_DISABLED = "DISABLED";
    private static final Pattern SAFE_KEY_PATTERN = Pattern.compile("^[A-Za-z][A-Za-z0-9_-]{0,63}$");
    private static final int MAX_SCHEMA_JSON_LENGTH = 65535;
    private static final Set<String> ALLOWED_FIELD_TYPES = Set.of(
            "text", "number", "date", "datetime", "select", "textarea", "checkbox", "radio", "attachment-placeholder"
    );

    private final FormDefinitionMapper formDefinitionMapper;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;

    public List<FormDefinitionDTO> listDefinitions() {
        String tenantId = TenantContext.requireTenantId();
        return formDefinitionMapper.selectList(new LambdaQueryWrapper<FormDefinition>()
                        .eq(FormDefinition::getTenantId, tenantId)
                        .orderByDesc(FormDefinition::getUpdateTime)
                        .orderByAsc(FormDefinition::getFormKey))
                .stream()
                .map(this::toDto)
                .toList();
    }

    public FormDefinitionDTO getDefinition(String formKey) {
        return toDto(requireDefinition(TenantContext.requireTenantId(), formKey));
    }

    @Transactional(rollbackFor = Exception.class)
    public FormDefinitionDTO saveDraft(String formKey, FormDefinitionSaveDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        FormDefinitionSaveDTO payload = dto == null ? new FormDefinitionSaveDTO() : dto;
        Long operatorId = requireOperatorId(payload.getOperatorId());
        FormDefinitionSchemaValidationResultDTO validation = validateSchema(payload.getSchema());
        if (!validation.isValid()) {
            throw new BusinessException("表单 schema 校验失败：" + String.join("；", validation.getErrors()));
        }

        FormDefinition definition = findDefinition(tenantId, formKey);
        if (definition == null) {
            definition = new FormDefinition();
            definition.setTenantId(tenantId);
            definition.setFormKey(requireSafeFormKey(formKey));
            definition.setStatus(STATUS_DRAFT);
            definition.setVersion(0);
        } else if (STATUS_DISABLED.equals(definition.getStatus())) {
            throw new BusinessException("已停用表单需要先恢复版本后再保存草稿");
        } else {
            definition.setStatus(STATUS_DRAFT);
        }

        definition.setName(firstPresent(payload.getName(), definition.getName(), formKey));
        definition.setDescription(firstPresent(payload.getDescription(), definition.getDescription(), ""));
        definition.setSchemaJson(toJson(validation.getSanitizedSchema()));
        definition.setUpdatedBy(operatorId);

        if (definition.getId() == null) {
            formDefinitionMapper.insert(definition);
        } else {
            formDefinitionMapper.updateById(definition);
        }
        return toDto(definition);
    }

    public FormDefinitionSchemaValidationResultDTO validateSchema(FormDefinitionSaveDTO dto) {
        return validateSchema(dto == null ? null : dto.getSchema());
    }

    public FormDefinitionSchemaValidationResultDTO validateSchema(Map<String, Object> schema) {
        return evaluateSchema(schema);
    }

    @Transactional(rollbackFor = Exception.class)
    public FormDefinitionDTO publish(String formKey, FormDefinitionOperationDTO operation) {
        String tenantId = TenantContext.requireTenantId();
        FormDefinition definition = requireDefinition(tenantId, formKey);
        Long operatorId = requireOperatorId(operation == null ? null : operation.getOperatorId());
        requireOperation(operation, "发布");
        if (!STATUS_DRAFT.equals(definition.getStatus())) {
            throw new BusinessException("只有草稿状态的表单定义可以发布");
        }
        FormDefinitionSchemaValidationResultDTO validation = validateSchema(fromJson(definition.getSchemaJson(), Map.of()));
        if (!validation.isValid()) {
            throw new BusinessException("表单 schema 校验失败：" + String.join("；", validation.getErrors()));
        }

        definition.setSchemaJson(toJson(validation.getSanitizedSchema()));
        definition.setStatus(STATUS_PUBLISHED);
        definition.setVersion((definition.getVersion() == null ? 0 : definition.getVersion()) + 1);
        definition.setPublishedBy(operatorId);
        definition.setPublishedAt(LocalDateTime.now());
        definition.setUpdatedBy(operatorId);
        formDefinitionMapper.updateById(definition);
        insertVersionSnapshot(tenantId, definition, "PUBLISH", operation, null);
        return toDto(definition);
    }

    @Transactional(rollbackFor = Exception.class)
    public FormDefinitionDTO disable(String formKey, FormDefinitionOperationDTO operation) {
        String tenantId = TenantContext.requireTenantId();
        FormDefinition definition = requireDefinition(tenantId, formKey);
        Long operatorId = requireOperatorId(operation == null ? null : operation.getOperatorId());
        requireOperation(operation, "停用");
        if (!STATUS_PUBLISHED.equals(definition.getStatus())) {
            throw new BusinessException("只有已发布状态的表单定义可以停用");
        }

        definition.setStatus(STATUS_DISABLED);
        definition.setVersion((definition.getVersion() == null ? 0 : definition.getVersion()) + 1);
        definition.setUpdatedBy(operatorId);
        formDefinitionMapper.updateById(definition);
        insertVersionSnapshot(tenantId, definition, "DISABLE", operation, null);
        return toDto(definition);
    }

    public List<FormDefinitionVersionDTO> listVersions(String formKey) {
        String tenantId = TenantContext.requireTenantId();
        requireSafeFormKey(formKey);
        return queryVersions(tenantId, formKey, null).stream()
                .map(this::toVersionDto)
                .toList();
    }

    public FormDefinitionVersionDTO getVersion(String formKey, Integer version) {
        String tenantId = TenantContext.requireTenantId();
        return toVersionDto(requireVersion(tenantId, formKey, version));
    }

    @Transactional(rollbackFor = Exception.class)
    public FormDefinitionDTO rollback(String formKey, Integer version, FormDefinitionOperationDTO operation) {
        String tenantId = TenantContext.requireTenantId();
        FormDefinition definition = requireDefinition(tenantId, formKey);
        Long operatorId = requireOperatorId(operation == null ? null : operation.getOperatorId());
        requireOperation(operation, "回滚");
        if (STATUS_DRAFT.equals(definition.getStatus())) {
            throw new BusinessException("草稿状态不能直接回滚，请先发布或停用后再恢复版本");
        }
        FormDefinitionVersion sourceVersion = requireVersion(tenantId, formKey, version);
        FormDefinitionSchemaValidationResultDTO validation = validateSchema(fromJson(sourceVersion.getSchemaJson(), Map.of()));
        if (!validation.isValid()) {
            throw new BusinessException("目标版本 schema 校验失败：" + String.join("；", validation.getErrors()));
        }

        definition.setName(sourceVersion.getName());
        definition.setDescription(sourceVersion.getDescription());
        definition.setSchemaJson(toJson(validation.getSanitizedSchema()));
        definition.setStatus(STATUS_PUBLISHED);
        definition.setVersion((definition.getVersion() == null ? 0 : definition.getVersion()) + 1);
        definition.setPublishedBy(operatorId);
        definition.setPublishedAt(LocalDateTime.now());
        definition.setUpdatedBy(operatorId);
        formDefinitionMapper.updateById(definition);
        insertVersionSnapshot(tenantId, definition, "ROLLBACK", operation, version);
        return toDto(definition);
    }

    public FormDefinitionPreviewDTO preview(String formKey) {
        FormDefinition definition = requireDefinition(TenantContext.requireTenantId(), formKey);
        FormDefinitionSchemaValidationResultDTO validation = validateSchema(fromJson(definition.getSchemaJson(), Map.of()));
        FormDefinitionPreviewDTO dto = new FormDefinitionPreviewDTO();
        dto.setFormKey(definition.getFormKey());
        dto.setName(definition.getName());
        dto.setStatus(definition.getStatus());
        dto.setVersion(definition.getVersion());
        dto.setFieldCount(validation.getFieldCount());
        dto.setSensitiveFieldCount(validation.getSensitiveFieldCount());
        dto.setSchema(validation.getSanitizedSchema());
        dto.setWarnings(validation.getWarnings());
        return dto;
    }

    public Map<String, Object> references(String formKey) {
        FormDefinition definition = requireDefinition(TenantContext.requireTenantId(), formKey);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("formKey", definition.getFormKey());
        result.put("referenceCount", 0);
        result.put("references", List.of());
        result.put("bindingSources", List.of());
        result.put("note", "当前最小闭环未发现流程节点或实例引用；后续绑定接入后由真实引用分析扩展。");
        return result;
    }

    private FormDefinition findDefinition(String tenantId, String formKey) {
        return formDefinitionMapper.selectOne(new LambdaQueryWrapper<FormDefinition>()
                .eq(FormDefinition::getTenantId, tenantId)
                .eq(FormDefinition::getFormKey, requireSafeFormKey(formKey))
                .last("limit 1"));
    }

    private FormDefinition requireDefinition(String tenantId, String formKey) {
        FormDefinition definition = findDefinition(tenantId, formKey);
        if (definition == null) {
            throw new BusinessException("表单定义不存在");
        }
        return definition;
    }

    private String requireSafeFormKey(String formKey) {
        String value = textValue(formKey);
        if (!SAFE_KEY_PATTERN.matcher(value).matches()) {
            throw new BusinessException("表单标识不合法");
        }
        return value;
    }

    private Long requireOperatorId(Long operatorId) {
        if (operatorId == null || operatorId <= 0) {
            throw new BusinessException("表单定义操作人不能为空");
        }
        return operatorId;
    }

    private void requireOperation(FormDefinitionOperationDTO operation, String actionName) {
        if (operation == null || !Boolean.TRUE.equals(operation.getConfirmed())) {
            throw new BusinessException(actionName + "操作需要二次确认");
        }
        if (operation.getReason() == null || operation.getReason().isBlank()) {
            throw new BusinessException(actionName + "操作需要审计原因");
        }
        if (operation.getImpactScope() == null || operation.getImpactScope().isBlank()) {
            throw new BusinessException(actionName + "操作需要影响范围");
        }
        if (operation.getRollbackPlan() == null || operation.getRollbackPlan().isBlank()) {
            throw new BusinessException(actionName + "操作需要回滚预案");
        }
    }

    private FormDefinitionDTO toDto(FormDefinition definition) {
        FormDefinitionSchemaValidationResultDTO validation = validateSchema(fromJson(definition.getSchemaJson(), Map.of()));
        FormDefinitionDTO dto = new FormDefinitionDTO();
        dto.setId(definition.getId());
        dto.setFormKey(definition.getFormKey());
        dto.setName(definition.getName());
        dto.setDescription(definition.getDescription());
        dto.setSchema(validation.getSanitizedSchema());
        dto.setStatus(definition.getStatus());
        dto.setVersion(definition.getVersion());
        dto.setUpdatedBy(definition.getUpdatedBy());
        dto.setPublishedBy(definition.getPublishedBy());
        dto.setPublishedAt(definition.getPublishedAt());
        dto.setCreateTime(definition.getCreateTime());
        dto.setUpdateTime(definition.getUpdateTime());
        return dto;
    }

    private FormDefinitionSchemaValidationResultDTO evaluateSchema(Map<String, Object> schema) {
        FormDefinitionSchemaValidationResultDTO result = new FormDefinitionSchemaValidationResultDTO();
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Map<String, Object> sanitizedSchema = new LinkedHashMap<>();
        List<Map<String, Object>> sanitizedSections = new ArrayList<>();
        sanitizedSchema.put("sections", sanitizedSections);

        if (schema == null) {
            errors.add("schema.sections 不能为空");
            fillValidationResult(result, errors, warnings, sanitizedSchema, 0, 0);
            return result;
        }
        scanDangerousKeys(schema, warnings);

        Object sectionsObject = schema.get("sections");
        if (!(sectionsObject instanceof List<?> sections) || sections.isEmpty()) {
            errors.add("schema.sections 必须是非空数组");
            fillValidationResult(result, errors, warnings, sanitizedSchema, 0, 0);
            return result;
        }

        Set<String> fieldKeys = new HashSet<>();
        int fieldCount = 0;
        int sensitiveFieldCount = 0;
        for (Object sectionObject : sections) {
            if (!(sectionObject instanceof Map<?, ?> section)) {
                errors.add("section 必须是对象结构");
                continue;
            }
            String sectionKey = firstPresent(textValue(section.get("sectionKey")), textValue(section.get("id")));
            String sectionLabel = safeText(section.get("label"), warnings);
            if (!SAFE_KEY_PATTERN.matcher(sectionKey).matches()) {
                errors.add("sectionKey 不合法: " + (sectionKey.isBlank() ? "空" : sectionKey));
            }
            if (sectionLabel.isBlank()) {
                errors.add("section.label 不能为空");
            }

            Map<String, Object> sanitizedSection = new LinkedHashMap<>();
            sanitizedSection.put("sectionKey", sectionKey);
            sanitizedSection.put("label", sectionLabel);
            String description = safeText(section.get("description"), warnings);
            if (!description.isBlank()) {
                sanitizedSection.put("description", description);
            }
            List<Map<String, Object>> sanitizedFields = new ArrayList<>();
            sanitizedSection.put("fields", sanitizedFields);
            sanitizedSections.add(sanitizedSection);

            Object fieldsObject = section.get("fields");
            if (!(fieldsObject instanceof List<?> fields) || fields.isEmpty()) {
                errors.add("section.fields 必须是非空数组: " + sectionKey);
                continue;
            }
            for (Object fieldObject : fields) {
                if (!(fieldObject instanceof Map<?, ?> field)) {
                    errors.add("field 必须是对象结构");
                    continue;
                }
                String fieldKey = textValue(field.get("fieldKey"));
                String label = safeText(field.get("label"), warnings);
                String type = textValue(field.get("type")).toLowerCase(Locale.ROOT);
                if (!SAFE_KEY_PATTERN.matcher(fieldKey).matches()) {
                    errors.add("fieldKey 不合法: " + (fieldKey.isBlank() ? "空" : fieldKey));
                    continue;
                }
                if (!fieldKeys.add(fieldKey)) {
                    errors.add("fieldKey 重复: " + fieldKey);
                }
                if (label.isBlank()) {
                    errors.add("field.label 不能为空: " + fieldKey);
                }
                if (!ALLOWED_FIELD_TYPES.contains(type)) {
                    errors.add("非法字段类型: " + fieldKey);
                }

                Map<String, Object> sanitizedField = new LinkedHashMap<>();
                sanitizedField.put("fieldKey", fieldKey);
                sanitizedField.put("label", label);
                sanitizedField.put("type", type);
                sanitizedField.put("required", Boolean.TRUE.equals(field.get("required")));
                boolean sensitive = Boolean.TRUE.equals(field.get("sensitive")) || "sensitive".equalsIgnoreCase(textValue(field.get("sensitivity")));
                sanitizedField.put("sensitive", sensitive);
                if (sensitive) {
                    sensitiveFieldCount++;
                    if (field.containsKey("defaultValue")) {
                        sanitizedField.put("defaultValue", "******");
                        sanitizedField.put("masked", true);
                    }
                } else if (field.containsKey("defaultValue")) {
                    Object defaultValue = safeValue(field.get("defaultValue"), warnings);
                    if (defaultValue != null) {
                        sanitizedField.put("defaultValue", defaultValue);
                    }
                }
                putSafeString(sanitizedField, "placeholder", field.get("placeholder"), warnings);
                putSafeString(sanitizedField, "helpText", field.get("helpText"), warnings);
                List<Map<String, Object>> options = sanitizeOptions(field.get("options"), warnings);
                if (!options.isEmpty()) {
                    sanitizedField.put("options", options);
                }
                sanitizedFields.add(sanitizedField);
                fieldCount++;
            }
        }

        fillValidationResult(result, errors, warnings, sanitizedSchema, fieldCount, sensitiveFieldCount);
        return result;
    }

    private void fillValidationResult(FormDefinitionSchemaValidationResultDTO result,
                                      List<String> errors,
                                      List<String> warnings,
                                      Map<String, Object> sanitizedSchema,
                                      int fieldCount,
                                      int sensitiveFieldCount) {
        result.setErrors(errors);
        result.setWarnings(warnings);
        result.setValid(errors.isEmpty());
        result.setFieldCount(fieldCount);
        result.setSensitiveFieldCount(sensitiveFieldCount);
        result.setSanitizedSchema(sanitizedSchema);
    }

    private List<Map<String, Object>> sanitizeOptions(Object optionsObject, List<String> warnings) {
        if (!(optionsObject instanceof List<?> options)) {
            return List.of();
        }
        List<Map<String, Object>> sanitizedOptions = new ArrayList<>();
        for (Object optionObject : options) {
            if (!(optionObject instanceof Map<?, ?> option)) {
                continue;
            }
            String value = safeText(option.get("value"), warnings);
            String label = safeText(option.get("label"), warnings);
            if (value.isBlank() || label.isBlank()) {
                continue;
            }
            Map<String, Object> sanitizedOption = new LinkedHashMap<>();
            sanitizedOption.put("value", value);
            sanitizedOption.put("label", label);
            if (Boolean.TRUE.equals(option.get("disabled"))) {
                sanitizedOption.put("disabled", true);
            }
            sanitizedOptions.add(sanitizedOption);
        }
        return sanitizedOptions;
    }

    private void putSafeString(Map<String, Object> target, String key, Object value, List<String> warnings) {
        String text = safeText(value, warnings);
        if (!text.isBlank()) {
            target.put(key, text);
        }
    }

    private Object safeValue(Object value, List<String> warnings) {
        if (value == null || value instanceof Number || value instanceof Boolean) {
            return value;
        }
        String text = safeText(value, warnings);
        return text.isBlank() ? null : text;
    }

    private String safeText(Object value, List<String> warnings) {
        String text = textValue(value);
        if (text.isBlank()) {
            return "";
        }
        String lower = text.toLowerCase(Locale.ROOT);
        if (lower.contains("<script") || lower.contains("javascript:") || lower.contains("onerror") || lower.contains("onload") || lower.contains("expression(")) {
            warnings.add("已剥离危险文本片段");
            return "";
        }
        return text;
    }

    private void scanDangerousKeys(Object value, List<String> warnings) {
        if (value instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = Objects.toString(entry.getKey(), "");
                String lower = key.toLowerCase(Locale.ROOT);
                if (lower.contains("html") || lower.contains("source") || lower.contains("script") || lower.startsWith("on") || "style".equals(lower)) {
                    warnings.add("已剥离危险字段: " + key);
                    continue;
                }
                scanDangerousKeys(entry.getValue(), warnings);
            }
        } else if (value instanceof List<?> list) {
            list.forEach(item -> scanDangerousKeys(item, warnings));
        }
    }

    private void insertVersionSnapshot(String tenantId,
                                       FormDefinition definition,
                                       String actionType,
                                       FormDefinitionOperationDTO operation,
                                       Integer rollbackSourceVersion) {
        jdbcTemplate.update("""
                        INSERT INTO form_definition_version (
                            tenant_id, definition_id, form_key, version, action_type, status,
                            name, description, schema_json, audit_reason, impact_scope, rollback_plan,
                            rollback_source_version, operator_id, published_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                tenantId,
                definition.getId(),
                definition.getFormKey(),
                definition.getVersion(),
                actionType,
                definition.getStatus(),
                definition.getName(),
                definition.getDescription(),
                definition.getSchemaJson(),
                operation.getReason(),
                operation.getImpactScope(),
                operation.getRollbackPlan(),
                rollbackSourceVersion,
                operation.getOperatorId(),
                definition.getPublishedAt() == null ? LocalDateTime.now() : definition.getPublishedAt());
    }

    private FormDefinitionVersion requireVersion(String tenantId, String formKey, Integer version) {
        if (version == null || version <= 0) {
            throw new BusinessException("版本号不合法");
        }
        return queryVersions(tenantId, formKey, version).stream()
                .findFirst()
                .orElseThrow(() -> new BusinessException("表单版本不存在"));
    }

    private List<FormDefinitionVersion> queryVersions(String tenantId, String formKey, Integer version) {
        String sql = """
                SELECT id, tenant_id, definition_id, form_key, version, action_type, status,
                       name, description, schema_json, audit_reason, impact_scope, rollback_plan,
                       rollback_source_version, operator_id, published_at, create_time
                FROM form_definition_version
                WHERE tenant_id = ? AND form_key = ?
                """ + (version == null ? "ORDER BY version DESC, id DESC" : "AND version = ? ORDER BY id DESC LIMIT 1");
        if (version == null) {
            return jdbcTemplate.query(sql, versionRowMapper(), tenantId, formKey);
        }
        return jdbcTemplate.query(sql, versionRowMapper(), tenantId, formKey, version);
    }

    private RowMapper<FormDefinitionVersion> versionRowMapper() {
        return this::mapVersion;
    }

    private FormDefinitionVersion mapVersion(ResultSet rs, int rowNum) throws SQLException {
        FormDefinitionVersion version = new FormDefinitionVersion();
        version.setId(rs.getLong("id"));
        version.setTenantId(rs.getString("tenant_id"));
        version.setDefinitionId(rs.getLong("definition_id"));
        version.setFormKey(rs.getString("form_key"));
        version.setVersion(rs.getInt("version"));
        version.setActionType(rs.getString("action_type"));
        version.setStatus(rs.getString("status"));
        version.setName(rs.getString("name"));
        version.setDescription(rs.getString("description"));
        version.setSchemaJson(rs.getString("schema_json"));
        version.setAuditReason(rs.getString("audit_reason"));
        version.setImpactScope(rs.getString("impact_scope"));
        version.setRollbackPlan(rs.getString("rollback_plan"));
        Object rollbackSourceVersion = rs.getObject("rollback_source_version");
        version.setRollbackSourceVersion(rollbackSourceVersion instanceof Number number ? number.intValue() : null);
        version.setOperatorId(rs.getLong("operator_id"));
        version.setPublishedAt(toLocalDateTime(rs.getTimestamp("published_at")));
        version.setCreateTime(toLocalDateTime(rs.getTimestamp("create_time")));
        return version;
    }

    private LocalDateTime toLocalDateTime(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }

    private FormDefinitionVersionDTO toVersionDto(FormDefinitionVersion version) {
        FormDefinitionSchemaValidationResultDTO validation = validateSchema(fromJson(version.getSchemaJson(), Map.of()));
        FormDefinitionVersionDTO dto = new FormDefinitionVersionDTO();
        dto.setId(version.getId());
        dto.setDefinitionId(version.getDefinitionId());
        dto.setFormKey(version.getFormKey());
        dto.setVersion(version.getVersion());
        dto.setActionType(version.getActionType());
        dto.setStatus(version.getStatus());
        dto.setName(version.getName());
        dto.setDescription(version.getDescription());
        dto.setSchema(validation.getSanitizedSchema());
        dto.setAuditReason(version.getAuditReason());
        dto.setImpactScope(version.getImpactScope());
        dto.setRollbackPlan(version.getRollbackPlan());
        dto.setRollbackSourceVersion(version.getRollbackSourceVersion());
        dto.setOperatorId(version.getOperatorId());
        dto.setPublishedAt(version.getPublishedAt());
        dto.setCreateTime(version.getCreateTime());
        return dto;
    }

    private String toJson(Map<String, Object> schema) {
        try {
            String json = objectMapper.writeValueAsString(schema);
            if (json.length() > MAX_SCHEMA_JSON_LENGTH) {
                throw new BusinessException("表单 schema 超过最大长度");
            }
            return json;
        } catch (JsonProcessingException ex) {
            throw new BusinessException("表单 schema 序列化失败");
        }
    }

    private Map<String, Object> fromJson(String json, Map<String, Object> fallback) {
        if (json == null || json.isBlank()) {
            return fallback;
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException ex) {
            return fallback;
        }
    }

    private String firstPresent(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String firstPresent(String value, String fallback, String defaultValue) {
        String first = firstPresent(value, fallback);
        return first == null || first.isBlank() ? defaultValue : first;
    }

    private String textValue(Object value) {
        return Objects.toString(value, "").trim();
    }
}
