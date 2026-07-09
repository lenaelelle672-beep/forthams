package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.FormStorageAttachmentDTO;
import com.ams.dto.FormStorageExportDTO;
import com.ams.dto.FormStorageFieldValueDTO;
import com.ams.dto.FormStorageOperationDTO;
import com.ams.dto.FormStorageQueryDTO;
import com.ams.dto.FormStorageRecordDTO;
import com.ams.dto.FormStorageSaveDTO;
import com.ams.entity.FormAttachment;
import com.ams.entity.FormFieldValue;
import com.ams.entity.FormInstance;
import com.ams.mapper.FormAttachmentMapper;
import com.ams.mapper.FormFieldValueMapper;
import com.ams.mapper.FormInstanceMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FormStorageService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_ARCHIVED = "ARCHIVED";
    private static final String STATUS_DELETED = "DELETED";
    private static final String ATTACHMENT_STATUS_ACTIVE = "ACTIVE";
    private static final Pattern SAFE_KEY_PATTERN = Pattern.compile("^[A-Za-z][A-Za-z0-9_-]{0,63}$");
    private static final Set<String> ALLOWED_VALUE_TYPES = Set.of("text", "number", "date", "datetime", "boolean", "select", "json", "attachment");

    private final FormInstanceMapper formInstanceMapper;
    private final FormFieldValueMapper formFieldValueMapper;
    private final FormAttachmentMapper formAttachmentMapper;
    private final ObjectMapper objectMapper;

    public List<FormStorageRecordDTO> listRecords(FormStorageQueryDTO query) {
        String tenantId = TenantContext.requireTenantId();
        FormStorageQueryDTO safeQuery = query == null ? new FormStorageQueryDTO() : query;
        LambdaQueryWrapper<FormInstance> wrapper = new LambdaQueryWrapper<FormInstance>()
                .eq(FormInstance::getTenantId, tenantId)
                .eq(FormInstance::getDeleted, 0);
        if (hasText(safeQuery.getFormKey())) {
            wrapper.eq(FormInstance::getFormKey, requireSafeKey(safeQuery.getFormKey(), "表单标识不合法"));
        }
        if (safeQuery.getDefinitionVersion() != null) {
            wrapper.eq(FormInstance::getDefinitionVersion, requirePositiveVersion(safeQuery.getDefinitionVersion()));
        }
        if (hasText(safeQuery.getStatus())) {
            wrapper.eq(FormInstance::getStatus, normalizeStatus(safeQuery.getStatus()));
        } else if (!Boolean.TRUE.equals(safeQuery.getIncludeArchived())) {
            wrapper.ne(FormInstance::getStatus, STATUS_ARCHIVED);
        }
        wrapper.ne(FormInstance::getStatus, STATUS_DELETED);
        if (hasText(safeQuery.getKeyword())) {
            String keyword = safeLike(safeQuery.getKeyword());
            wrapper.and(item -> item.like(FormInstance::getBusinessKey, keyword)
                    .or()
                    .like(FormInstance::getFormKey, keyword));
        }
        wrapper.orderByDesc(FormInstance::getUpdateTime).orderByDesc(FormInstance::getId);
        int pageSize = clamp(safeQuery.getPageSize(), 1, 50, 20);
        int pageNum = clamp(safeQuery.getPageNum(), 1, 10000, 1);
        int offset = (pageNum - 1) * pageSize;
        wrapper.last("limit " + offset + "," + pageSize);
        List<FormInstance> instances = formInstanceMapper.selectList(wrapper);
        return (instances == null ? List.<FormInstance>of() : instances).stream()
                .map(this::toRecordDto)
                .toList();
    }

    public FormStorageRecordDTO getRecord(Long instanceId) {
        FormInstance instance = requireInstance(TenantContext.requireTenantId(), instanceId);
        return toRecordDto(instance);
    }

    @Transactional(rollbackFor = Exception.class)
    public FormStorageRecordDTO createRecord(FormStorageSaveDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        FormStorageSaveDTO payload = dto == null ? new FormStorageSaveDTO() : dto;
        Long operatorId = requireOperatorId(payload.getOperatorId(), "表单实例保存");
        List<FormStorageFieldValueDTO> fields = requireFields(payload.getFieldValues());

        FormInstance instance = new FormInstance();
        instance.setTenantId(tenantId);
        instance.setFormKey(requireSafeKey(payload.getFormKey(), "表单标识不合法"));
        instance.setDefinitionVersion(requirePositiveVersion(payload.getDefinitionVersion()));
        instance.setBusinessKey(safePlainText(payload.getBusinessKey(), "业务标识"));
        instance.setStatus(STATUS_ACTIVE);
        instance.setCreatedBy(operatorId);
        instance.setUpdatedBy(operatorId);
        instance.setDeleted(0);
        instance.setAuditSummary("创建表单实例，字段值已脱敏响应");
        formInstanceMapper.insert(instance);

        List<FormFieldValue> storedFields = upsertFields(tenantId, instance, fields);
        List<FormAttachment> storedAttachments = new ArrayList<>();
        List<FormStorageAttachmentDTO> attachmentPayloads = payload.getAttachments() == null ? List.of() : payload.getAttachments();
        for (FormStorageAttachmentDTO attachment : attachmentPayloads) {
            storedAttachments.add(createAttachmentEntity(tenantId, instance, attachment, operatorId));
        }
        instance.setFieldSummary(maskedFieldSummary(storedFields));
        instance.setAttachmentSummary(maskedAttachmentSummary(storedAttachments));
        formInstanceMapper.updateById(instance);
        return toRecordDto(instance, storedFields, storedAttachments);
    }

    @Transactional(rollbackFor = Exception.class)
    public FormStorageRecordDTO updateRecord(Long instanceId, FormStorageSaveDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        FormInstance instance = requireInstance(tenantId, instanceId);
        requireMutable(instance);
        FormStorageSaveDTO payload = dto == null ? new FormStorageSaveDTO() : dto;
        Long operatorId = requireOperatorId(payload.getOperatorId(), "表单实例更新");
        List<FormStorageFieldValueDTO> fields = requireFields(payload.getFieldValues());
        if (hasText(payload.getBusinessKey())) {
            instance.setBusinessKey(safePlainText(payload.getBusinessKey(), "业务标识"));
        }
        instance.setUpdatedBy(operatorId);
        instance.setAuditSummary("更新表单实例，字段原值不回显");
        List<FormFieldValue> storedFields = upsertFields(tenantId, instance, fields);
        List<FormAttachment> storedAttachments = loadAttachmentEntities(tenantId, instance.getId());
        instance.setFieldSummary(maskedFieldSummary(storedFields));
        instance.setAttachmentSummary(maskedAttachmentSummary(storedAttachments));
        formInstanceMapper.updateById(instance);
        return toRecordDto(instance, storedFields, storedAttachments);
    }

    @Transactional(rollbackFor = Exception.class)
    public FormStorageRecordDTO archiveRecord(Long instanceId, FormStorageOperationDTO operation) {
        String tenantId = TenantContext.requireTenantId();
        requireHighRiskOperation(operation, "归档");
        FormInstance instance = requireInstance(tenantId, instanceId);
        if (STATUS_ARCHIVED.equals(instance.getStatus())) {
            throw new BusinessException("表单实例已归档，不能重复归档");
        }
        if (STATUS_DELETED.equals(instance.getStatus())) {
            throw new BusinessException("已删除表单实例不能归档");
        }
        instance.setStatus(STATUS_ARCHIVED);
        instance.setArchivedBy(operation.getOperatorId());
        instance.setArchivedAt(LocalDateTime.now());
        instance.setArchiveReason(firstPresent(operation.getReason(), operation.getAuditEvidence()));
        instance.setAuditSummary("归档表单实例，审计证据已登记");
        formInstanceMapper.updateById(instance);
        return toRecordDto(instance);
    }

    @Transactional(rollbackFor = Exception.class)
    public FormStorageRecordDTO markDeleted(Long instanceId, FormStorageOperationDTO operation) {
        String tenantId = TenantContext.requireTenantId();
        requireHighRiskOperation(operation, "删除留痕");
        FormInstance instance = requireInstance(tenantId, instanceId);
        if (STATUS_DELETED.equals(instance.getStatus())) {
            throw new BusinessException("表单实例已删除，不能重复删除");
        }
        instance.setStatus(STATUS_DELETED);
        instance.setDeletedBy(operation.getOperatorId());
        instance.setDeletedAt(LocalDateTime.now());
        instance.setDeleteReason(firstPresent(operation.getReason(), operation.getAuditEvidence()));
        instance.setAuditSummary("删除留痕已登记，字段和附件仅保留脱敏摘要");
        formInstanceMapper.updateById(instance);
        return toRecordDto(instance);
    }

    public List<FormStorageAttachmentDTO> listAttachments(Long instanceId) {
        String tenantId = TenantContext.requireTenantId();
        requireInstance(tenantId, instanceId);
        return loadAttachmentEntities(tenantId, instanceId).stream()
                .map(this::toAttachmentDto)
                .toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public FormStorageAttachmentDTO registerAttachment(Long instanceId, FormStorageAttachmentDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        FormInstance instance = requireInstance(tenantId, instanceId);
        requireMutable(instance);
        Long operatorId = requireOperatorId(dto == null ? null : dto.getOperatorId(), "附件引用登记");
        FormAttachment attachment = createAttachmentEntity(tenantId, instance, dto, operatorId);
        List<FormAttachment> attachments = loadAttachmentEntities(tenantId, instanceId);
        instance.setAttachmentSummary(maskedAttachmentSummary(attachments));
        instance.setAuditSummary("附件引用已登记，仅返回脱敏摘要");
        formInstanceMapper.updateById(instance);
        return toAttachmentDto(attachment);
    }

    @Transactional(rollbackFor = Exception.class)
    public FormStorageAttachmentDTO removeAttachment(Long instanceId, Long attachmentId, FormStorageOperationDTO operation) {
        String tenantId = TenantContext.requireTenantId();
        requireHighRiskOperation(operation, "附件引用删除");
        FormInstance instance = requireInstance(tenantId, instanceId);
        requireMutable(instance);
        FormAttachment attachment = requireAttachment(tenantId, instanceId, attachmentId);
        if (STATUS_DELETED.equals(attachment.getStatus())) {
            throw new BusinessException("附件引用已删除，不能重复删除");
        }
        attachment.setStatus(STATUS_DELETED);
        attachment.setDeletedBy(operation.getOperatorId());
        attachment.setDeletedAt(LocalDateTime.now());
        attachment.setAuditSummary("附件引用删除留痕已登记");
        formAttachmentMapper.updateById(attachment);
        List<FormAttachment> attachments = loadAttachmentEntities(tenantId, instanceId);
        instance.setAttachmentSummary(maskedAttachmentSummary(attachments));
        formInstanceMapper.updateById(instance);
        return toAttachmentDto(attachment);
    }

    public FormStorageExportDTO exportMasked(FormStorageOperationDTO operation) {
        String tenantId = TenantContext.requireTenantId();
        requireHighRiskOperation(operation, "导出");
        FormStorageQueryDTO query = operation.getQuery() == null ? new FormStorageQueryDTO() : operation.getQuery();
        List<FormStorageRecordDTO> records = listRecords(query);
        FormStorageExportDTO export = new FormStorageExportDTO();
        export.setExportId("form-storage-export-" + UUID.randomUUID());
        export.setExportedAt(LocalDateTime.now());
        export.setOperatorId(operation.getOperatorId());
        export.setAuditEvidence(firstPresent(operation.getAuditEvidence(), operation.getReason()));
        export.setRecords(records);
        export.setTotal(records.size());
        export.setQuerySummary(querySummary(tenantId, query));
        export.setMaskedFields(records.stream().flatMap(record -> record.getFieldSummaries().stream()).toList());
        export.setMaskedAttachments(records.stream().flatMap(record -> record.getAttachmentSummaries().stream()).toList());
        return export;
    }

    private FormInstance requireInstance(String tenantId, Long instanceId) {
        if (instanceId == null || instanceId <= 0) {
            throw new BusinessException("表单实例不存在");
        }
        FormInstance instance = formInstanceMapper.selectOne(new LambdaQueryWrapper<FormInstance>()
                .eq(FormInstance::getTenantId, tenantId)
                .eq(FormInstance::getId, instanceId)
                .eq(FormInstance::getDeleted, 0)
                .last("limit 1"));
        if (instance == null) {
            throw new BusinessException("表单实例不存在");
        }
        return instance;
    }

    private FormAttachment requireAttachment(String tenantId, Long instanceId, Long attachmentId) {
        if (attachmentId == null || attachmentId <= 0) {
            throw new BusinessException("附件引用不存在");
        }
        FormAttachment attachment = formAttachmentMapper.selectOne(new LambdaQueryWrapper<FormAttachment>()
                .eq(FormAttachment::getTenantId, tenantId)
                .eq(FormAttachment::getInstanceId, instanceId)
                .eq(FormAttachment::getId, attachmentId)
                .eq(FormAttachment::getDeleted, 0)
                .last("limit 1"));
        if (attachment == null) {
            throw new BusinessException("附件引用不存在");
        }
        return attachment;
    }

    private void requireMutable(FormInstance instance) {
        if (STATUS_ARCHIVED.equals(instance.getStatus())) {
            throw new BusinessException("已归档表单实例不能更新");
        }
        if (STATUS_DELETED.equals(instance.getStatus())) {
            throw new BusinessException("已删除表单实例不能更新");
        }
    }

    private void requireHighRiskOperation(FormStorageOperationDTO operation, String actionName) {
        if (operation == null || !Boolean.TRUE.equals(operation.getConfirmed())) {
            throw new BusinessException(actionName + "操作需要二次确认");
        }
        requireOperatorId(operation.getOperatorId(), actionName);
        if (!hasText(operation.getReason()) && !hasText(operation.getAuditEvidence())) {
            throw new BusinessException(actionName + "操作需要审计原因或审计证据");
        }
    }

    private List<FormStorageFieldValueDTO> requireFields(List<FormStorageFieldValueDTO> fields) {
        if (fields == null || fields.isEmpty()) {
            throw new BusinessException("表单字段值不能为空");
        }
        return fields;
    }

    private List<FormFieldValue> upsertFields(String tenantId, FormInstance instance, List<FormStorageFieldValueDTO> fields) {
        Map<String, FormFieldValue> existingByFieldKey = loadFieldEntities(tenantId, instance.getId()).stream()
                .collect(Collectors.toMap(FormFieldValue::getFieldKey, Function.identity(), (left, right) -> left, LinkedHashMap::new));
        List<FormFieldValue> stored = new ArrayList<>();
        for (FormStorageFieldValueDTO dto : fields) {
            FormFieldValue value = existingByFieldKey.getOrDefault(requireSafeKey(dto.getFieldKey(), "字段标识不合法"), new FormFieldValue());
            value.setTenantId(tenantId);
            value.setInstanceId(instance.getId());
            value.setFormKey(instance.getFormKey());
            value.setFieldKey(requireSafeKey(dto.getFieldKey(), "字段标识不合法"));
            value.setFieldLabel(safePlainText(firstPresent(dto.getFieldLabel(), dto.getFieldKey()), "字段名称"));
            value.setValueType(normalizeValueType(dto.getValueType()));
            value.setSensitive(Boolean.TRUE.equals(dto.getSensitive()));
            fillStoredValue(value, dto.getRawValue());
            value.setMaskedValue(maskValue(dto.getRawValue(), Boolean.TRUE.equals(dto.getSensitive())));
            if (value.getId() == null) {
                formFieldValueMapper.insert(value);
            } else {
                formFieldValueMapper.updateById(value);
            }
            stored.add(value);
        }
        return stored;
    }

    private FormAttachment createAttachmentEntity(String tenantId, FormInstance instance, FormStorageAttachmentDTO dto, Long operatorId) {
        if (dto == null) {
            throw new BusinessException("附件引用不能为空");
        }
        FormAttachment attachment = new FormAttachment();
        attachment.setTenantId(tenantId);
        attachment.setInstanceId(instance.getId());
        attachment.setFormKey(instance.getFormKey());
        attachment.setFileName(safePlainText(dto.getFileName(), "附件名称"));
        attachment.setContentType(safePlainText(firstPresent(dto.getContentType(), "application/octet-stream"), "附件类型"));
        attachment.setFileSize(dto.getFileSize() == null || dto.getFileSize() < 0 ? 0L : dto.getFileSize());
        attachment.setReferenceKey(requireSafeKey(firstPresent(dto.getReferenceKey(), "attachmentRef"), "附件引用标识不合法"));
        String referenceSecret = firstPresent(dto.getStorageKey(), dto.getUrl(), dto.getReferenceKey(), dto.getFileName());
        attachment.setStorageRefHash(hashReference(referenceSecret));
        attachment.setMaskedStorageKey(maskReference(dto.getStorageKey(), "storageKey"));
        attachment.setMaskedUrl(maskReference(dto.getUrl(), "url"));
        attachment.setStatus(ATTACHMENT_STATUS_ACTIVE);
        attachment.setAuditSummary("附件引用已登记，未保存二进制文件");
        attachment.setCreatedBy(operatorId);
        attachment.setDeleted(0);
        formAttachmentMapper.insert(attachment);
        return attachment;
    }

    private List<FormFieldValue> loadFieldEntities(String tenantId, Long instanceId) {
        if (instanceId == null) {
            return List.of();
        }
        List<FormFieldValue> values = formFieldValueMapper.selectList(new LambdaQueryWrapper<FormFieldValue>()
                .eq(FormFieldValue::getTenantId, tenantId)
                .eq(FormFieldValue::getInstanceId, instanceId)
                .orderByAsc(FormFieldValue::getId));
        return values == null ? List.of() : values;
    }

    private List<FormAttachment> loadAttachmentEntities(String tenantId, Long instanceId) {
        if (instanceId == null) {
            return List.of();
        }
        List<FormAttachment> attachments = formAttachmentMapper.selectList(new LambdaQueryWrapper<FormAttachment>()
                .eq(FormAttachment::getTenantId, tenantId)
                .eq(FormAttachment::getInstanceId, instanceId)
                .eq(FormAttachment::getDeleted, 0)
                .ne(FormAttachment::getStatus, STATUS_DELETED)
                .orderByAsc(FormAttachment::getId));
        return attachments == null ? List.of() : attachments;
    }

    private FormStorageRecordDTO toRecordDto(FormInstance instance) {
        String tenantId = TenantContext.requireTenantId();
        return toRecordDto(instance, loadFieldEntities(tenantId, instance.getId()), loadAttachmentEntities(tenantId, instance.getId()));
    }

    private FormStorageRecordDTO toRecordDto(FormInstance instance, List<FormFieldValue> fields, List<FormAttachment> attachments) {
        FormStorageRecordDTO dto = new FormStorageRecordDTO();
        dto.setId(instance.getId());
        dto.setFormKey(instance.getFormKey());
        dto.setDefinitionVersion(instance.getDefinitionVersion());
        dto.setBusinessKey(instance.getBusinessKey());
        dto.setStatus(instance.getStatus());
        dto.setFieldSummaries(fields.stream().map(this::toFieldDto).toList());
        dto.setAttachmentSummaries(attachments.stream().map(this::toAttachmentDto).toList());
        dto.setFieldSummary(firstPresent(instance.getFieldSummary(), maskedFieldSummary(fields)));
        dto.setAttachmentSummary(firstPresent(instance.getAttachmentSummary(), maskedAttachmentSummary(attachments)));
        dto.setAuditSummary(instance.getAuditSummary());
        dto.setCreatedBy(instance.getCreatedBy());
        dto.setUpdatedBy(instance.getUpdatedBy());
        dto.setArchivedBy(instance.getArchivedBy());
        dto.setArchivedAt(instance.getArchivedAt());
        dto.setArchiveReason(instance.getArchiveReason());
        dto.setDeletedBy(instance.getDeletedBy());
        dto.setDeletedAt(instance.getDeletedAt());
        dto.setDeleteReason(instance.getDeleteReason());
        dto.setCreateTime(instance.getCreateTime());
        dto.setUpdateTime(instance.getUpdateTime());
        return dto;
    }

    private FormStorageFieldValueDTO toFieldDto(FormFieldValue value) {
        FormStorageFieldValueDTO dto = new FormStorageFieldValueDTO();
        dto.setId(value.getId());
        dto.setFieldKey(value.getFieldKey());
        dto.setFieldLabel(value.getFieldLabel());
        dto.setValueType(value.getValueType());
        dto.setSensitive(Boolean.TRUE.equals(value.getSensitive()));
        dto.setMaskedValue(firstPresent(value.getMaskedValue(), "******"));
        dto.setMaskedSummary(value.getFieldLabel() + "：" + dto.getMaskedValue());
        return dto;
    }

    private FormStorageAttachmentDTO toAttachmentDto(FormAttachment attachment) {
        FormStorageAttachmentDTO dto = new FormStorageAttachmentDTO();
        dto.setId(attachment.getId());
        dto.setInstanceId(attachment.getInstanceId());
        dto.setFileName(attachment.getFileName());
        dto.setContentType(attachment.getContentType());
        dto.setFileSize(attachment.getFileSize());
        dto.setReferenceKey(attachment.getReferenceKey());
        dto.setMaskedStorageKey(firstPresent(attachment.getMaskedStorageKey(), "storageKey 已脱敏"));
        dto.setMaskedUrl(firstPresent(attachment.getMaskedUrl(), "url 已脱敏"));
        dto.setStatus(attachment.getStatus());
        dto.setAuditSummary(attachment.getAuditSummary());
        dto.setCreateTime(attachment.getCreateTime());
        dto.setUpdateTime(attachment.getUpdateTime());
        return dto;
    }

    private void fillStoredValue(FormFieldValue value, Object rawValue) {
        if (rawValue == null || rawValue instanceof Number || rawValue instanceof Boolean || rawValue instanceof CharSequence) {
            value.setValueText(rawValue == null ? null : Objects.toString(rawValue, ""));
            value.setValueJson(null);
            return;
        }
        value.setValueText(null);
        try {
            value.setValueJson(objectMapper.writeValueAsString(rawValue));
        } catch (JsonProcessingException ex) {
            throw new BusinessException("字段值格式不合法");
        }
    }

    private String maskValue(Object rawValue, boolean sensitive) {
        if (sensitive) {
            return "******";
        }
        if (rawValue == null) {
            return "空值";
        }
        String text = Objects.toString(rawValue, "").trim();
        if (text.isBlank()) {
            return "空值";
        }
        return "已记录" + Math.min(text.length(), 64) + "字符";
    }

    private String maskedFieldSummary(List<FormFieldValue> fields) {
        if (fields == null || fields.isEmpty()) {
            return "字段摘要为空";
        }
        long sensitiveCount = fields.stream().filter(field -> Boolean.TRUE.equals(field.getSensitive())).count();
        return "字段 " + fields.size() + " 个，敏感字段 " + sensitiveCount + " 个，响应仅含 maskedValue";
    }

    private String maskedAttachmentSummary(List<FormAttachment> attachments) {
        if (attachments == null || attachments.isEmpty()) {
            return "附件引用为空";
        }
        return "附件引用 " + attachments.size() + " 个，URL/storageKey 已脱敏";
    }

    private Map<String, Object> querySummary(String tenantId, FormStorageQueryDTO query) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("tenantScoped", true);
        summary.put("tenantRef", hashReference(tenantId));
        if (hasText(query.getFormKey())) {
            summary.put("formKey", requireSafeKey(query.getFormKey(), "表单标识不合法"));
        }
        if (query.getDefinitionVersion() != null) {
            summary.put("definitionVersion", requirePositiveVersion(query.getDefinitionVersion()));
        }
        if (hasText(query.getStatus())) {
            summary.put("status", normalizeStatus(query.getStatus()));
        }
        summary.put("includeArchived", Boolean.TRUE.equals(query.getIncludeArchived()));
        return summary;
    }

    private Long requireOperatorId(Long operatorId, String actionName) {
        if (operatorId == null || operatorId <= 0) {
            throw new BusinessException(actionName + "需要操作人");
        }
        return operatorId;
    }

    private Integer requirePositiveVersion(Integer version) {
        if (version == null || version <= 0) {
            throw new BusinessException("表单定义版本不合法");
        }
        return version;
    }

    private String requireSafeKey(String key, String message) {
        String value = textValue(key);
        if (!SAFE_KEY_PATTERN.matcher(value).matches()) {
            throw new BusinessException(message);
        }
        return value;
    }

    private String normalizeValueType(String valueType) {
        String value = textValue(firstPresent(valueType, "text")).toLowerCase(Locale.ROOT);
        if (!ALLOWED_VALUE_TYPES.contains(value)) {
            throw new BusinessException("字段值类型不合法");
        }
        return value;
    }

    private String normalizeStatus(String status) {
        String value = textValue(status).toUpperCase(Locale.ROOT);
        if (!Set.of(STATUS_ACTIVE, STATUS_ARCHIVED, STATUS_DELETED).contains(value)) {
            throw new BusinessException("表单实例状态不合法");
        }
        return value;
    }

    private String safePlainText(String value, String fieldName) {
        String text = textValue(value);
        if (text.isBlank()) {
            throw new BusinessException(fieldName + "不能为空");
        }
        String lower = text.toLowerCase(Locale.ROOT);
        if (lower.contains("<script") || lower.contains("javascript:") || lower.contains("onerror") || lower.contains("onload") || lower.contains("select ") || lower.contains(" from ")) {
            throw new BusinessException(fieldName + "包含不安全内容");
        }
        return text.length() > 256 ? text.substring(0, 256) : text;
    }

    private String safeLike(String value) {
        return textValue(value).replace("%", "").replace("_", "");
    }

    private String maskReference(String value, String label) {
        if (!hasText(value)) {
            return label + " 已脱敏";
        }
        return label + " 已脱敏(" + hashReference(value).substring(0, 12) + ")";
    }

    private String hashReference(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(textValue(value).getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte item : digest) {
                builder.append(String.format("%02x", item));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new BusinessException("引用摘要生成失败");
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private int clamp(Integer value, int min, int max, int fallback) {
        if (value == null) {
            return fallback;
        }
        return Math.max(min, Math.min(max, value));
    }

    private String firstPresent(String... values) {
        for (String value : values) {
            if (hasText(value)) {
                return value;
            }
        }
        return "";
    }

    private String textValue(Object value) {
        return Objects.toString(value, "").trim();
    }
}
