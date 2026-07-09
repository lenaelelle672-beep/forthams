package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.TodoFieldConfigDTO;
import com.ams.dto.TodoFieldOperationDTO;
import com.ams.dto.TodoFieldPreviewDTO;
import com.ams.dto.TodoFieldRoleOverrideDTO;
import com.ams.dto.TodoFieldSaveDTO;
import com.ams.entity.TodoFieldConfig;
import com.ams.entity.TodoFieldRoleOverride;
import com.ams.mapper.TodoFieldConfigMapper;
import com.ams.mapper.TodoFieldRoleOverrideMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TodoFieldConfigService {

    private static final Pattern SAFE_FORM_FIELD_PATTERN = Pattern.compile("^form\\.[A-Za-z][A-Za-z0-9_-]{0,63}$");
    private static final Pattern ROLE_CODE_PATTERN = Pattern.compile("^[A-Z][A-Z0-9_:-]{1,63}$");
    private static final Set<String> DEFAULT_FIELD_KEYS = Set.of("processName", "nodeName", "applicantName", "businessKey", "priority", "status", "createdAt", "dueAt", "slaStatus");
    private static final Set<String> SENSITIVE_FIELD_KEYS = Set.of("applicantName", "businessKey", "form.idCard", "form.phone", "form.secret");
    private static final Set<String> SENSITIVE_ALLOWED_ROLES = Set.of("SUPER_ADMIN", "PROCESS_ADMIN", "WORKFLOW_ADMIN", "AUDITOR");
    private static final Set<String> KNOWN_ROLE_CODES = Set.of("SUPER_ADMIN", "PROCESS_ADMIN", "WORKFLOW_ADMIN", "APPROVER", "AUDITOR", "USER");
    private static final Set<String> PROTOTYPE_KEYS = Set.of("__proto__", "constructor", "prototype");

    private final TodoFieldConfigMapper todoFieldConfigMapper;
    private final TodoFieldRoleOverrideMapper todoFieldRoleOverrideMapper;

    public List<TodoFieldConfigDTO> listFields(String roleCode) {
        String tenantId = TenantContext.requireTenantId();
        String normalizedRole = hasText(roleCode) ? normalizeRoleCode(roleCode) : null;
        List<TodoFieldConfigDTO> fields = loadConfigDtos(tenantId);
        if (normalizedRole != null) {
            applyOverrides(tenantId, normalizedRole, fields, false);
        }
        return stableSort(fields);
    }

    @Transactional(rollbackFor = Exception.class)
    public List<TodoFieldConfigDTO> saveFields(TodoFieldSaveDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        TodoFieldSaveDTO payload = dto == null ? new TodoFieldSaveDTO() : dto;
        requireHighRisk(payload.getConfirmed(), payload.getOperatorId(), payload.getReason(), payload.getAuditEvidence(), "待办字段保存");
        List<TodoFieldConfigDTO> normalized = normalizeFieldPayload(payload.getFields(), null, true);
        Map<String, TodoFieldConfig> existing = loadConfigEntities(tenantId).stream()
                .collect(Collectors.toMap(TodoFieldConfig::getFieldKey, Function.identity(), (left, right) -> left, LinkedHashMap::new));
        for (TodoFieldConfigDTO item : normalized) {
            TodoFieldConfig entity = existing.getOrDefault(item.getFieldKey(), new TodoFieldConfig());
            entity.setTenantId(tenantId);
            entity.setFieldKey(item.getFieldKey());
            entity.setFieldLabel(item.getFieldLabel());
            entity.setVisible(Boolean.TRUE.equals(item.getVisible()));
            entity.setSortOrder(item.getSortOrder());
            entity.setSensitive(Boolean.TRUE.equals(item.getSensitive()));
            entity.setDefaultField(Boolean.TRUE.equals(item.getDefaultField()));
            entity.setAuditSummary("保存待办字段配置；" + auditText(payload.getReason(), payload.getAuditEvidence()));
            entity.setUpdatedBy(payload.getOperatorId());
            entity.setDeleted(0);
            if (entity.getId() == null) {
                todoFieldConfigMapper.insert(entity);
            } else {
                todoFieldConfigMapper.updateById(entity);
            }
        }
        return normalized.stream().map(item -> enrichAudit(item, "保存待办字段配置")).toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public List<TodoFieldConfigDTO> saveSortOrder(TodoFieldSaveDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        TodoFieldSaveDTO payload = dto == null ? new TodoFieldSaveDTO() : dto;
        requireHighRisk(payload.getConfirmed(), payload.getOperatorId(), payload.getReason(), payload.getAuditEvidence(), "待办字段排序保存");
        List<TodoFieldConfigDTO> normalized = normalizeFieldPayload(payload.getFields(), null, false);
        Map<String, TodoFieldConfig> existing = loadConfigEntities(tenantId).stream()
                .collect(Collectors.toMap(TodoFieldConfig::getFieldKey, Function.identity(), (left, right) -> left, LinkedHashMap::new));
        for (TodoFieldConfigDTO item : normalized) {
            TodoFieldConfig entity = existing.get(item.getFieldKey());
            if (entity == null && !DEFAULT_FIELD_KEYS.contains(item.getFieldKey())) {
                throw new BusinessException("待办字段不存在，不能排序");
            }
            if (entity == null) {
                entity = defaultEntity(tenantId, item.getFieldKey(), item.getSortOrder());
            }
            entity.setSortOrder(item.getSortOrder());
            entity.setAuditSummary("保存待办字段排序；" + auditText(payload.getReason(), payload.getAuditEvidence()));
            entity.setUpdatedBy(payload.getOperatorId());
            if (entity.getId() == null) {
                todoFieldConfigMapper.insert(entity);
            } else {
                todoFieldConfigMapper.updateById(entity);
            }
        }
        return stableSort(normalized.stream().map(item -> enrichAudit(item, "保存稳定排序")).toList());
    }

    @Transactional(rollbackFor = Exception.class)
    public List<TodoFieldConfigDTO> saveRoleOverride(String roleCode, TodoFieldRoleOverrideDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        TodoFieldRoleOverrideDTO payload = dto == null ? new TodoFieldRoleOverrideDTO() : dto;
        String normalizedRole = normalizeRoleCode(firstPresent(roleCode, payload.getRoleCode()));
        requireHighRisk(payload.getConfirmed(), payload.getOperatorId(), payload.getReason(), payload.getAuditEvidence(), "待办字段角色覆盖");
        Map<String, TodoFieldConfigDTO> baseFields = loadConfigDtos(tenantId).stream()
                .collect(Collectors.toMap(TodoFieldConfigDTO::getFieldKey, Function.identity(), (left, right) -> left, LinkedHashMap::new));
        List<TodoFieldConfigDTO> normalized = normalizeFieldPayload(payload.getFields(), normalizedRole, false);
        Map<String, TodoFieldRoleOverride> existing = loadOverrideEntities(tenantId, normalizedRole).stream()
                .collect(Collectors.toMap(TodoFieldRoleOverride::getFieldKey, Function.identity(), (left, right) -> left, LinkedHashMap::new));
        for (TodoFieldConfigDTO item : normalized) {
            TodoFieldConfigDTO base = baseFields.get(item.getFieldKey());
            if (base == null) {
                throw new BusinessException("角色覆盖引用未知待办字段");
            }
            boolean sensitive = Boolean.TRUE.equals(base.getSensitive()) || isSensitiveField(item.getFieldKey());
            if (Boolean.TRUE.equals(item.getVisible()) && sensitive && !SENSITIVE_ALLOWED_ROLES.contains(normalizedRole)) {
                throw new BusinessException("角色无权展示敏感待办字段");
            }
            TodoFieldRoleOverride entity = existing.getOrDefault(item.getFieldKey(), new TodoFieldRoleOverride());
            entity.setTenantId(tenantId);
            entity.setRoleCode(normalizedRole);
            entity.setFieldKey(item.getFieldKey());
            entity.setOverrideVisible(item.getVisible());
            entity.setOverrideSortOrder(item.getSortOrder());
            entity.setExplanation(firstPresent(item.getExplanation(), payload.getExplanation(), "角色覆盖来源：overridden"));
            entity.setAuditSummary("保存角色覆盖；" + auditText(payload.getReason(), payload.getAuditEvidence()));
            entity.setUpdatedBy(payload.getOperatorId());
            entity.setDeleted(0);
            if (entity.getId() == null) {
                todoFieldRoleOverrideMapper.insert(entity);
            } else {
                todoFieldRoleOverrideMapper.updateById(entity);
            }
        }
        List<TodoFieldConfigDTO> result = loadConfigDtos(tenantId);
        applyOverrides(tenantId, normalizedRole, result, false);
        return stableSort(result);
    }

    @Transactional(rollbackFor = Exception.class)
    public List<TodoFieldConfigDTO> resetDefaults(TodoFieldOperationDTO operation) {
        String tenantId = TenantContext.requireTenantId();
        TodoFieldOperationDTO payload = operation == null ? new TodoFieldOperationDTO() : operation;
        requireHighRisk(payload.getConfirmed(), payload.getOperatorId(), payload.getReason(), payload.getAuditEvidence(), "恢复待办字段默认配置");
        Map<String, TodoFieldConfig> existing = loadConfigEntities(tenantId).stream()
                .collect(Collectors.toMap(TodoFieldConfig::getFieldKey, Function.identity(), (left, right) -> left, LinkedHashMap::new));
        List<TodoFieldConfigDTO> defaults = defaultDtos();
        for (TodoFieldConfigDTO item : defaults) {
            TodoFieldConfig entity = existing.getOrDefault(item.getFieldKey(), new TodoFieldConfig());
            entity.setTenantId(tenantId);
            entity.setFieldKey(item.getFieldKey());
            entity.setFieldLabel(item.getFieldLabel());
            entity.setVisible(item.getVisible());
            entity.setSortOrder(item.getSortOrder());
            entity.setSensitive(item.getSensitive());
            entity.setDefaultField(true);
            entity.setAuditSummary("恢复默认配置；" + auditText(payload.getReason(), payload.getAuditEvidence()));
            entity.setUpdatedBy(payload.getOperatorId());
            entity.setDeleted(0);
            if (entity.getId() == null) {
                todoFieldConfigMapper.insert(entity);
            } else {
                todoFieldConfigMapper.updateById(entity);
            }
        }
        return defaults.stream().map(item -> enrichAudit(item, "恢复默认配置，未物理删除历史记录")).toList();
    }

    public TodoFieldPreviewDTO preview(String roleCode) {
        String tenantId = TenantContext.requireTenantId();
        String normalizedRole = hasText(roleCode) ? normalizeRoleCode(roleCode) : "USER";
        List<TodoFieldConfigDTO> fields = loadConfigDtos(tenantId);
        applyOverrides(tenantId, normalizedRole, fields, true);
        List<TodoFieldConfigDTO> visible = stableSort(fields).stream().filter(item -> Boolean.TRUE.equals(item.getVisible())).toList();
        TodoFieldPreviewDTO preview = new TodoFieldPreviewDTO();
        preview.setRoleCode(normalizedRole);
        preview.setVisibleFields(visible);
        preview.setMaskedFields(visible.stream().filter(TodoFieldConfigDTO::getSensitive).toList());
        preview.setTotalVisible(visible.size());
        preview.setReadOnly(true);
        preview.setTenantScoped(true);
        preview.setAuditSummary("只读预览，敏感字段默认脱敏，不持久化敏感原值");
        preview.setPreviewedAt(LocalDateTime.now());
        return preview;
    }

    private List<TodoFieldConfigDTO> loadConfigDtos(String tenantId) {
        List<TodoFieldConfig> configs = loadConfigEntities(tenantId);
        if (configs.isEmpty()) {
            return defaultDtos();
        }
        return configs.stream().map(this::toDto).toList();
    }

    private List<TodoFieldConfig> loadConfigEntities(String tenantId) {
        List<TodoFieldConfig> configs = todoFieldConfigMapper.selectList(new LambdaQueryWrapper<TodoFieldConfig>()
                .eq(TodoFieldConfig::getTenantId, tenantId)
                .eq(TodoFieldConfig::getDeleted, 0)
                .orderByAsc(TodoFieldConfig::getSortOrder)
                .orderByAsc(TodoFieldConfig::getFieldKey));
        return configs == null ? List.of() : configs;
    }

    private List<TodoFieldRoleOverride> loadOverrideEntities(String tenantId, String roleCode) {
        List<TodoFieldRoleOverride> overrides = todoFieldRoleOverrideMapper.selectList(new LambdaQueryWrapper<TodoFieldRoleOverride>()
                .eq(TodoFieldRoleOverride::getTenantId, tenantId)
                .eq(TodoFieldRoleOverride::getRoleCode, roleCode)
                .eq(TodoFieldRoleOverride::getDeleted, 0));
        return overrides == null ? List.of() : overrides;
    }

    private void applyOverrides(String tenantId, String roleCode, List<TodoFieldConfigDTO> fields, boolean previewMode) {
        Map<String, TodoFieldRoleOverride> overrides = loadOverrideEntities(tenantId, roleCode).stream()
                .collect(Collectors.toMap(TodoFieldRoleOverride::getFieldKey, Function.identity(), (left, right) -> left, LinkedHashMap::new));
        for (TodoFieldConfigDTO field : fields) {
            TodoFieldRoleOverride override = overrides.get(field.getFieldKey());
            field.setRoleCode(roleCode);
            if (override != null) {
                field.setOverrideVisible(override.getOverrideVisible());
                field.setOverrideSortOrder(override.getOverrideSortOrder());
                field.setVisible(override.getOverrideVisible() == null ? field.getVisible() : override.getOverrideVisible());
                field.setSortOrder(override.getOverrideSortOrder() == null ? field.getSortOrder() : override.getOverrideSortOrder());
                field.setSource("overridden");
                field.setExplanation(firstPresent(override.getExplanation(), "角色覆盖来源：overridden"));
            } else {
                field.setSource(Boolean.TRUE.equals(field.getDefaultField()) ? "default" : "inherited");
                field.setExplanation(Boolean.TRUE.equals(field.getDefaultField()) ? "默认字段" : "继承全局字段配置");
            }
            if (previewMode) {
                maskPreviewField(field, roleCode);
            }
        }
    }

    private void maskPreviewField(TodoFieldConfigDTO field, String roleCode) {
        boolean sensitive = Boolean.TRUE.equals(field.getSensitive()) || isSensitiveField(field.getFieldKey());
        field.setSensitive(sensitive);
        if (sensitive) {
            field.setMaskedLabel("敏感字段已脱敏");
            field.setMaskedValue("******");
            if (!SENSITIVE_ALLOWED_ROLES.contains(roleCode)) {
                field.setVisible(false);
                field.setExplanation("角色无权查看敏感字段，仅保留脱敏解释");
            }
        } else {
            field.setMaskedLabel(field.getFieldLabel());
            field.setMaskedValue("预览值已脱敏");
        }
    }

    private List<TodoFieldConfigDTO> normalizeFieldPayload(List<TodoFieldConfigDTO> fields, String roleCode, boolean requireLabel) {
        if (fields == null || fields.isEmpty()) {
            throw new BusinessException("待办字段配置不能为空");
        }
        Set<String> seen = new java.util.HashSet<>();
        List<TodoFieldConfigDTO> result = new ArrayList<>();
        for (TodoFieldConfigDTO item : fields) {
            if (item == null) {
                throw new BusinessException("待办字段配置不能为空");
            }
            String fieldKey = normalizeFieldKey(item.getFieldKey());
            if (!seen.add(fieldKey)) {
                throw new BusinessException("待办字段 fieldKey 不能重复");
            }
            validateSortOrder(item.getSortOrder());
            if (roleCode != null && Boolean.TRUE.equals(item.getVisible()) && isSensitiveField(fieldKey) && !SENSITIVE_ALLOWED_ROLES.contains(roleCode)) {
                throw new BusinessException("角色无权展示敏感待办字段");
            }
            TodoFieldConfigDTO normalized = new TodoFieldConfigDTO();
            normalized.setId(item.getId());
            normalized.setFieldKey(fieldKey);
            normalized.setFieldLabel(requireLabel ? safeLabel(item.getFieldLabel()) : firstPresent(item.getFieldLabel(), fieldKey));
            normalized.setVisible(item.getVisible() == null || Boolean.TRUE.equals(item.getVisible()));
            normalized.setSortOrder(item.getSortOrder());
            normalized.setSensitive(Boolean.TRUE.equals(item.getSensitive()) || isSensitiveField(fieldKey));
            normalized.setDefaultField(Boolean.TRUE.equals(item.getDefaultField()) || DEFAULT_FIELD_KEYS.contains(fieldKey));
            normalized.setExplanation(item.getExplanation());
            result.add(normalized);
        }
        return stableSort(result);
    }

    private TodoFieldConfigDTO toDto(TodoFieldConfig entity) {
        TodoFieldConfigDTO dto = new TodoFieldConfigDTO();
        dto.setId(entity.getId());
        dto.setFieldKey(entity.getFieldKey());
        dto.setFieldLabel(entity.getFieldLabel());
        dto.setVisible(entity.getVisible());
        dto.setSortOrder(entity.getSortOrder());
        dto.setSensitive(Boolean.TRUE.equals(entity.getSensitive()) || isSensitiveField(entity.getFieldKey()));
        dto.setDefaultField(entity.getDefaultField());
        dto.setSource(Boolean.TRUE.equals(entity.getDefaultField()) ? "default" : "custom");
        dto.setAuditSummary(entity.getAuditSummary());
        dto.setCreateTime(entity.getCreateTime());
        dto.setUpdateTime(entity.getUpdateTime());
        return dto;
    }

    private TodoFieldConfig defaultEntity(String tenantId, String fieldKey, Integer sortOrder) {
        TodoFieldConfigDTO dto = defaultDtos().stream()
                .filter(item -> item.getFieldKey().equals(fieldKey))
                .findFirst()
                .orElseThrow(() -> new BusinessException("待办字段不存在"));
        TodoFieldConfig entity = new TodoFieldConfig();
        entity.setTenantId(tenantId);
        entity.setFieldKey(dto.getFieldKey());
        entity.setFieldLabel(dto.getFieldLabel());
        entity.setVisible(dto.getVisible());
        entity.setSortOrder(sortOrder == null ? dto.getSortOrder() : sortOrder);
        entity.setSensitive(dto.getSensitive());
        entity.setDefaultField(true);
        entity.setDeleted(0);
        return entity;
    }

    private List<TodoFieldConfigDTO> defaultDtos() {
        return List.of(
                field("processName", "流程名称", true, 10, false),
                field("nodeName", "节点名称", true, 20, false),
                field("applicantName", "申请人", true, 30, true),
                field("businessKey", "业务标识", true, 40, true),
                field("priority", "优先级", true, 50, false),
                field("status", "状态", true, 60, false),
                field("createdAt", "创建时间", true, 70, false),
                field("dueAt", "到期时间", true, 80, false),
                field("slaStatus", "SLA 状态", true, 90, false)
        );
    }

    private TodoFieldConfigDTO field(String key, String label, boolean visible, int sortOrder, boolean sensitive) {
        TodoFieldConfigDTO dto = new TodoFieldConfigDTO();
        dto.setFieldKey(key);
        dto.setFieldLabel(label);
        dto.setVisible(visible);
        dto.setSortOrder(sortOrder);
        dto.setSensitive(sensitive);
        dto.setDefaultField(true);
        dto.setSource("default");
        dto.setExplanation("默认字段");
        dto.setMaskedLabel(sensitive ? "敏感字段已脱敏" : label);
        dto.setMaskedValue(sensitive ? "******" : "预览值已脱敏");
        return dto;
    }

    private List<TodoFieldConfigDTO> stableSort(List<TodoFieldConfigDTO> fields) {
        return fields.stream()
                .sorted(Comparator.comparing(TodoFieldConfigDTO::getSortOrder, Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(TodoFieldConfigDTO::getFieldKey))
                .toList();
    }

    private TodoFieldConfigDTO enrichAudit(TodoFieldConfigDTO item, String summary) {
        item.setAuditSummary(summary);
        return item;
    }

    private String normalizeFieldKey(String fieldKey) {
        String key = textValue(fieldKey);
        String lower = key.toLowerCase(Locale.ROOT);
        if (PROTOTYPE_KEYS.contains(lower)) {
            throw new BusinessException("待办字段 fieldKey 包含原型污染风险");
        }
        if (DEFAULT_FIELD_KEYS.contains(key) || SAFE_FORM_FIELD_PATTERN.matcher(key).matches()) {
            return key;
        }
        throw new BusinessException("待办字段 fieldKey 不合法");
    }

    private String normalizeRoleCode(String roleCode) {
        String value = textValue(roleCode).toUpperCase(Locale.ROOT);
        if (!ROLE_CODE_PATTERN.matcher(value).matches() || !KNOWN_ROLE_CODES.contains(value)) {
            throw new BusinessException("未知角色编码");
        }
        return value;
    }

    private void validateSortOrder(Integer sortOrder) {
        if (sortOrder == null || sortOrder < 1 || sortOrder > 9999) {
            throw new BusinessException("待办字段 sortOrder 不合法");
        }
    }

    private void requireHighRisk(Boolean confirmed, Long operatorId, String reason, String auditEvidence, String actionName) {
        if (!Boolean.TRUE.equals(confirmed)) {
            throw new BusinessException(actionName + "需要二次确认");
        }
        if (operatorId == null || operatorId <= 0) {
            throw new BusinessException(actionName + "需要操作人");
        }
        if (!hasText(reason) && !hasText(auditEvidence)) {
            throw new BusinessException(actionName + "需要审计原因或审计证据");
        }
    }

    private boolean isSensitiveField(String fieldKey) {
        String key = textValue(fieldKey);
        String lower = key.toLowerCase(Locale.ROOT);
        return SENSITIVE_FIELD_KEYS.contains(key) || lower.contains("secret") || lower.contains("token") || lower.contains("password");
    }

    private String safeLabel(String label) {
        String value = textValue(label);
        if (value.isBlank()) {
            throw new BusinessException("字段名称不能为空");
        }
        String lower = value.toLowerCase(Locale.ROOT);
        if (lower.contains("<script") || lower.contains("javascript:") || lower.contains("onerror") || lower.contains("onload")) {
            throw new BusinessException("字段名称包含不安全内容");
        }
        return value.length() > 64 ? value.substring(0, 64) : value;
    }

    private String auditText(String reason, String auditEvidence) {
        return firstPresent(reason, auditEvidence, "审计证据已登记");
    }

    private String firstPresent(String... values) {
        for (String value : values) {
            if (hasText(value)) {
                return value;
            }
        }
        return "";
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String textValue(Object value) {
        return Objects.toString(value, "").trim();
    }
}
