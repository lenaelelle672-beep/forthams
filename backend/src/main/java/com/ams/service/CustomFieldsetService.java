package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.CustomFieldDTO;
import com.ams.dto.CustomFieldsetDTO;
import com.ams.dto.CustomFieldsetMetaDTO;
import com.ams.dto.CustomFieldsetPreviewRequestDTO;
import com.ams.dto.CustomFieldsetPreviewRespDTO;
import com.ams.dto.CustomFieldsetQueryDTO;
import com.ams.entity.CustomField;
import com.ams.entity.CustomFieldset;
import com.ams.mapper.CustomFieldsetMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CustomFieldsetService {

    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final String READONLY_BOUNDARY = "字段集只读 catalog + 无持久化 assignment/category-binding preview；不提供字段集 CRUD runtime、不写字段分配/分类绑定、不影响资产模型/资产字段值/运行时表单 schema。";

    private final CustomFieldsetMapper customFieldsetMapper;

    public CustomFieldsetDTO.PageResult list(CustomFieldsetQueryDTO query) {
        String tenantId = TenantContext.requireTenantId();
        NormalizedQuery normalized = normalizeQuery(query);
        long total = customFieldsetMapper.countRecords(tenantId, normalized.status(), normalized.categoryId(), normalized.keyword());
        List<CustomFieldsetDTO> records = total == 0
                ? List.of()
                : customFieldsetMapper.selectPageRecords(
                        tenantId,
                        normalized.status(),
                        normalized.categoryId(),
                        normalized.keyword(),
                        normalized.pageSize(),
                        normalized.offset()
                ).stream().map(this::toDTO).toList();
        long pages = total == 0 ? 0 : (long) Math.ceil((double) total / normalized.pageSize());
        return CustomFieldsetDTO.PageResult.builder()
                .records(records)
                .total(total)
                .size(normalized.pageSize())
                .current(normalized.page())
                .pages(pages)
                .tenantScoped(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    public List<CustomFieldsetDTO> all() {
        String tenantId = TenantContext.requireTenantId();
        return customFieldsetMapper.selectAllEnabled(tenantId).stream().map(this::toDTO).toList();
    }

    public CustomFieldsetDTO detail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        CustomFieldset fieldset = requireFieldset(tenantId, id);
        return toDTO(fieldset);
    }

    public List<CustomFieldDTO> fields(Long id) {
        String tenantId = TenantContext.requireTenantId();
        requireFieldset(tenantId, id);
        return customFieldsetMapper.selectFieldsByFieldsetId(tenantId, id).stream().map(this::toFieldDTO).toList();
    }

    public CustomFieldsetDTO byCategory(Long categoryId) {
        String tenantId = TenantContext.requireTenantId();
        if (categoryId == null || categoryId <= 0) {
            throw new BusinessException("字段集分类不存在");
        }
        CustomFieldset fieldset = customFieldsetMapper.selectByCategory(tenantId, categoryId);
        return fieldset == null ? null : toDTO(fieldset);
    }

    public CustomFieldsetMetaDTO meta() {
        String tenantId = TenantContext.requireTenantId();
        return CustomFieldsetMetaDTO.builder()
                .statuses(List.of(option("1", "启用"), option("0", "停用")))
                .previewPolicy(CustomFieldsetMetaDTO.PreviewPolicy.builder()
                        .tenantScoped(true)
                        .noPersistence(true)
                        .runtimeEffect(false)
                        .validatesFieldIds(true)
                        .validatesCategoryId(true)
                        .rejectedEffects(List.of("字段集 CRUD runtime", "字段分配写入", "分类绑定写入", "资产模型更新", "资产字段值写入", "运行时表单 schema 生效"))
                        .build())
                .allowedRoutes(List.of(
                        "GET /system/custom-fieldsets",
                        "GET /system/custom-fieldsets/all",
                        "GET /system/custom-fieldsets/{id}",
                        "GET /system/custom-fieldsets/{id}/fields",
                        "GET /system/custom-fieldsets/by-category/{categoryId}",
                        "GET /system/custom-fieldsets/meta",
                        "POST /system/custom-fieldsets/preview"
                ))
                .readOnly(true)
                .tenantScoped(true)
                .noPersistencePreview(true)
                .runtimeEffect(false)
                .categoryBindingDeferred(true)
                .assignmentMutationDeferred(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .deferredEffects(List.of("字段分配保存", "分类绑定保存", "资产模型更新", "资产字段值读写", "运行时资产表单 schema"))
                .nonGoals(List.of("不创建/更新/删除字段集", "不保存字段分配", "不保存分类绑定", "不完成资产字段值链路", "不声明基础资料组完成"))
                .build();
    }

    public CustomFieldsetPreviewRespDTO preview(CustomFieldsetPreviewRequestDTO request) {
        String tenantId = TenantContext.requireTenantId();
        CustomFieldsetPreviewRequestDTO source = request == null ? new CustomFieldsetPreviewRequestDTO() : request;
        List<CustomFieldsetPreviewRespDTO.FieldIssue> missing = new ArrayList<>();
        List<CustomFieldsetPreviewRespDTO.FieldIssue> rejected = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        List<CustomFieldsetPreviewRespDTO.UsedField> usedFields = new ArrayList<>();

        CustomFieldset fieldset = null;
        if (source.getFieldsetId() != null) {
            fieldset = customFieldsetMapper.selectByIdAndTenant(tenantId, source.getFieldsetId());
            if (fieldset == null) {
                CustomFieldsetPreviewRespDTO.FieldIssue issue = issue(source.getFieldsetId(), String.valueOf(source.getFieldsetId()), "字段集不存在或不属于当前租户");
                rejected.add(issue);
                errors.add("字段集 " + source.getFieldsetId() + "：字段集不存在或不属于当前租户");
            }
        }

        List<Long> requestedFieldIds = normalizeFieldIds(source.getFieldIds(), rejected, errors);
        List<CustomField> matchedFields = requestedFieldIds.isEmpty()
                ? (fieldset == null ? List.of() : customFieldsetMapper.selectFieldsByFieldsetId(tenantId, fieldset.getId()))
                : customFieldsetMapper.selectPreviewFields(tenantId, requestedFieldIds);
        matchedFields = matchedFields == null ? List.of() : matchedFields;
        usedFields.addAll(matchedFields.stream().map(this::usedField).toList());
        recordUnmatchedRequestedFields(requestedFieldIds, matchedFields, missing, errors);

        boolean wouldBindCategory = validateCategoryPreview(tenantId, source.getCategoryId(), fieldset, rejected, errors);
        return CustomFieldsetPreviewRespDTO.builder()
                .valid(missing.isEmpty() && rejected.isEmpty())
                .missingFields(missing)
                .rejectedFields(rejected)
                .usedFields(usedFields)
                .wouldBindCategory(wouldBindCategory)
                .tenantScoped(true)
                .noPersistence(true)
                .runtimeEffect(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .errors(errors)
                .build();
    }

    private boolean validateCategoryPreview(String tenantId,
                                            Long categoryId,
                                            CustomFieldset fieldset,
                                            List<CustomFieldsetPreviewRespDTO.FieldIssue> rejected,
                                            List<String> errors) {
        if (categoryId == null) {
            return false;
        }
        if (categoryId <= 0) {
            CustomFieldsetPreviewRespDTO.FieldIssue issue = issue(categoryId, String.valueOf(categoryId), "分类 ID 不合法");
            rejected.add(issue);
            errors.add("分类 " + categoryId + "：分类 ID 不合法");
            return false;
        }
        if (fieldset == null) {
            long tenantBindings = customFieldsetMapper.countCategoryBindings(tenantId, categoryId);
            if (tenantBindings <= 0) {
                CustomFieldsetPreviewRespDTO.FieldIssue issue = issue(categoryId, String.valueOf(categoryId), "需要当前租户字段集才能预览分类绑定");
                rejected.add(issue);
                errors.add("分类 " + categoryId + "：需要当前租户字段集才能预览分类绑定");
                return false;
            }
        }
        return true;
    }

    private CustomFieldset requireFieldset(String tenantId, Long id) {
        if (id == null || id <= 0) {
            throw new BusinessException("字段集不存在");
        }
        CustomFieldset fieldset = customFieldsetMapper.selectByIdAndTenant(tenantId, id);
        if (fieldset == null) {
            throw new BusinessException("字段集不存在");
        }
        return fieldset;
    }

    private CustomFieldsetDTO toDTO(CustomFieldset fieldset) {
        return CustomFieldsetDTO.builder()
                .id(fieldset.getId())
                .tenantId(fieldset.getTenantId())
                .name(escapeHtml(fieldset.getName()))
                .description(escapeHtml(fieldset.getDescription()))
                .categoryId(fieldset.getCategoryId())
                .sortOrder(fieldset.getSortOrder())
                .status(fieldset.getStatus())
                .fieldCount(fieldset.getFieldCount() == null ? 0 : fieldset.getFieldCount())
                .createTime(fieldset.getCreateTime())
                .updateTime(fieldset.getUpdateTime())
                .tenantScoped(true)
                .noPersistence(true)
                .runtimeEffect(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    private CustomFieldDTO toFieldDTO(CustomField field) {
        return CustomFieldDTO.builder()
                .id(field.getId())
                .tenantId(field.getTenantId())
                .fieldName(escapeHtml(field.getFieldName()))
                .fieldLabel(escapeHtml(field.getFieldLabel()))
                .fieldType(field.getFieldType())
                .fieldOptions(escapeHtml(field.getFieldOptions()))
                .validationPattern(escapeHtml(field.getValidationPattern()))
                .fieldOrder(field.getFieldOrder())
                .required(field.getRequired())
                .encrypted(field.getEncrypted())
                .status(field.getStatus())
                .tenantScoped(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    private CustomFieldsetPreviewRespDTO.UsedField usedField(CustomField field) {
        return CustomFieldsetPreviewRespDTO.UsedField.builder()
                .fieldId(field.getId())
                .fieldName(escapeHtml(field.getFieldName()))
                .fieldLabel(escapeHtml(field.getFieldLabel()))
                .fieldType(field.getFieldType())
                .required(Integer.valueOf(1).equals(field.getRequired()))
                .encrypted(Integer.valueOf(1).equals(field.getEncrypted()))
                .build();
    }

    private void recordUnmatchedRequestedFields(List<Long> requestedFieldIds,
                                                List<CustomField> matchedFields,
                                                List<CustomFieldsetPreviewRespDTO.FieldIssue> missing,
                                                List<String> errors) {
        Set<Long> matchedIds = matchedFields.stream().map(CustomField::getId).collect(LinkedHashSet::new, Set::add, Set::addAll);
        requestedFieldIds.stream().filter(id -> !matchedIds.contains(id)).forEach(id -> {
            CustomFieldsetPreviewRespDTO.FieldIssue issue = issue(id, String.valueOf(id), "字段不存在、不启用或不属于当前租户");
            missing.add(issue);
            errors.add("字段 " + id + "：字段不存在、不启用或不属于当前租户");
        });
    }

    private List<Long> normalizeFieldIds(List<Long> source,
                                         List<CustomFieldsetPreviewRespDTO.FieldIssue> rejected,
                                         List<String> errors) {
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        if (source == null) {
            return List.of();
        }
        for (Long id : source) {
            if (id == null || id <= 0) {
                CustomFieldsetPreviewRespDTO.FieldIssue issue = issue(id, String.valueOf(id), "字段 ID 不合法");
                rejected.add(issue);
                errors.add("字段 " + id + "：字段 ID 不合法");
                continue;
            }
            if (!ids.add(id)) {
                CustomFieldsetPreviewRespDTO.FieldIssue issue = issue(id, String.valueOf(id), "字段 ID 重复，预览已去重");
                rejected.add(issue);
                errors.add("字段 " + id + "：字段 ID 重复，预览已去重");
            }
        }
        return new ArrayList<>(ids);
    }

    private CustomFieldsetPreviewRespDTO.FieldIssue issue(Long id, String label, String reason) {
        return CustomFieldsetPreviewRespDTO.FieldIssue.builder()
                .fieldId(id)
                .fieldName(escapeHtml(label))
                .fieldLabel(escapeHtml(label))
                .reason(escapeHtml(reason))
                .build();
    }

    private CustomFieldsetMetaDTO.Option option(String value, String label) {
        return CustomFieldsetMetaDTO.Option.builder().value(value).label(label).build();
    }

    private NormalizedQuery normalizeQuery(CustomFieldsetQueryDTO query) {
        CustomFieldsetQueryDTO source = query == null ? new CustomFieldsetQueryDTO() : query;
        int page = source.getPage() == null || source.getPage() < DEFAULT_PAGE ? DEFAULT_PAGE : source.getPage();
        int requestedSize = firstNumber(source.getPageSize(), source.getSize(), DEFAULT_PAGE_SIZE);
        int pageSize = requestedSize < 1 ? DEFAULT_PAGE_SIZE : Math.min(requestedSize, MAX_PAGE_SIZE);
        Long categoryId = source.getCategoryId() == null || source.getCategoryId() <= 0 ? null : source.getCategoryId();
        return new NormalizedQuery(
                page,
                pageSize,
                Math.max((page - 1) * pageSize, 0),
                source.getStatus(),
                categoryId,
                cleanText(source.getKeyword(), 80)
        );
    }

    private String cleanText(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String text = value.trim();
        return text.length() > maxLength ? text.substring(0, maxLength) : text;
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

    private record NormalizedQuery(int page, int pageSize, int offset, Integer status, Long categoryId, String keyword) {}
}
