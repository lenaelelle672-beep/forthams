package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemPostDTO;
import com.ams.dto.SystemPostMetaDTO;
import com.ams.dto.SystemPostPreviewRequestDTO;
import com.ams.dto.SystemPostPreviewRespDTO;
import com.ams.dto.SystemPostQueryDTO;
import com.ams.entity.SystemPost;
import com.ams.mapper.SystemPostMapper;
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
public class PostManagementService {

    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_META_LIMIT = 100;
    private static final String READONLY_BOUNDARY =
            "metadata-only post catalog + dry-run preview；不持久化、不分配用户、不改变权限、不刷新缓存。";
    private static final Pattern CODE_PATTERN = Pattern.compile("[A-Za-z0-9_.-]{1,64}");
    private static final Set<String> ALLOWED_STATUSES = Set.of("ENABLED", "DISABLED");
    private static final List<String> REJECTED_INPUT_FIELDS = List.of(
            "userIds",
            "userList",
            "postIds",
            "permissionCodes",
            "roleIds",
            "dataScope",
            "assignmentPayload",
            "tenantIdOverride"
    );
    private static final Set<String> REJECTED_INPUT_KEYS = normalizedSet(REJECTED_INPUT_FIELDS);

    private final SystemPostMapper systemPostMapper;

    public SystemPostDTO.PageResult list(SystemPostQueryDTO query) {
        String tenantId = TenantContext.requireTenantId();
        NormalizedQuery normalized = normalizeQuery(query);
        long total = systemPostMapper.countRecords(tenantId, normalized.keyword(), normalized.status());
        List<SystemPostDTO> records = total == 0
                ? List.of()
                : safeList(systemPostMapper.selectPageRecords(
                        tenantId,
                        normalized.keyword(),
                        normalized.status(),
                        normalized.pageSize(),
                        normalized.offset()
                )).stream().map(this::toDTO).toList();
        long pages = total == 0 ? 0 : (long) Math.ceil((double) total / normalized.pageSize());
        return SystemPostDTO.PageResult.builder()
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

    public List<SystemPostDTO> all(SystemPostQueryDTO query) {
        String tenantId = TenantContext.requireTenantId();
        NormalizedQuery normalized = normalizeQuery(query);
        return safeList(systemPostMapper.selectAllRecords(tenantId, normalized.keyword(), normalized.status()))
                .stream()
                .map(this::toDTO)
                .toList();
    }

    public SystemPostDTO detail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        if (id == null || id <= 0) {
            throw new BusinessException("岗位不存在");
        }
        SystemPost post = systemPostMapper.selectByIdAndTenant(tenantId, id);
        if (post == null) {
            throw new BusinessException("岗位不存在");
        }
        return toDTO(post);
    }

    public SystemPostMetaDTO meta() {
        String tenantId = TenantContext.requireTenantId();
        return SystemPostMetaDTO.builder()
                .statuses(mergeOptions(systemPostMapper.listStatuses(tenantId, MAX_META_LIMIT), statusDefaults()))
                .allowedPreviewFields(List.of("postCode", "postName", "sortOrder", "status", "remark"))
                .previewPolicy(previewPolicy())
                .tenantScoped(true)
                .readOnly(true)
                .noPersistencePreview(true)
                .noAssignment(true)
                .noPermissionEffect(true)
                .runtimeEffect(false)
                .cacheRefreshed(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .nonGoals(nonGoals())
                .build();
    }

    public SystemPostPreviewRespDTO preview(SystemPostPreviewRequestDTO request) {
        String tenantId = TenantContext.requireTenantId();
        SystemPostPreviewRequestDTO source = request == null ? new SystemPostPreviewRequestDTO() : request;
        List<SystemPostPreviewRespDTO.RejectedInput> rejectedInputs = new ArrayList<>();
        LinkedHashSet<String> acceptedFields = new LinkedHashSet<>();

        String postCode = validatePostCode(source.getPostCode(), rejectedInputs, acceptedFields);
        validatePostName(source.getPostName(), rejectedInputs, acceptedFields);
        validateSortOrder(source.getSortOrder(), rejectedInputs, acceptedFields);
        validateStatus(source.getStatus(), rejectedInputs, acceptedFields);
        validateRemark(source.getRemark(), rejectedInputs, acceptedFields);
        collectUnknownInputs(source.getUnknownInputs(), rejectedInputs);

        boolean duplicateRisk = false;
        if (postCode != null && rejectedInputs.isEmpty()) {
            duplicateRisk = systemPostMapper.countByPostCode(tenantId, postCode) > 0;
        }

        List<String> warnings = new ArrayList<>();
        warnings.add("dry-run preview only: noPersistence=true、noAssignment=true、noPermissionEffect=true、runtimeEffect=false");
        warnings.add("未写入 sys_post，未分配用户岗位，未改变权限或刷新缓存");
        warnings.add("不代表岗位权限 runtime、用户岗位分配、组织权限组或 Workbench V3 全量完成");
        if (duplicateRisk) {
            warnings.add("postCode 在当前租户内可能重复，仅作本地风险提示");
        }

        return SystemPostPreviewRespDTO.builder()
                .previewAccepted(rejectedInputs.isEmpty())
                .duplicateRisk(duplicateRisk)
                .referenceImpact(duplicateRisk
                        ? "masked-reference-risk:existing-post-code"
                        : "masked-reference-risk:none")
                .acceptedFields(new ArrayList<>(acceptedFields))
                .rejectedInputs(rejectedInputs.stream().distinct().toList())
                .warnings(warnings)
                .tenantScoped(true)
                .readOnly(true)
                .noPersistence(true)
                .noAssignment(true)
                .noPermissionEffect(true)
                .runtimeEffect(false)
                .cacheRefreshed(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    private SystemPostDTO toDTO(SystemPost post) {
        return SystemPostDTO.builder()
                .id(post.getId())
                .postCode(post.getPostCode())
                .postName(post.getPostName())
                .sortOrder(post.getSortOrder())
                .status(post.getStatus())
                .remark(post.getRemark())
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .tenantScoped(true)
                .readOnly(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .referenceCountMasked("masked")
                .impactSummary("metadata-only; no assignment/permission payload")
                .build();
    }

    private NormalizedQuery normalizeQuery(SystemPostQueryDTO query) {
        SystemPostQueryDTO source = query == null ? new SystemPostQueryDTO() : query;
        int page = source.getPage() == null || source.getPage() < DEFAULT_PAGE ? DEFAULT_PAGE : source.getPage();
        int requestedSize = firstNumber(source.getPageSize(), source.getSize(), DEFAULT_PAGE_SIZE);
        int pageSize = requestedSize < 1 ? DEFAULT_PAGE_SIZE : Math.min(requestedSize, MAX_PAGE_SIZE);
        return new NormalizedQuery(
                page,
                pageSize,
                Math.max((page - 1) * pageSize, 0),
                cleanText(source.getKeyword(), 80),
                normalizeStatus(source.getStatus())
        );
    }

    private SystemPostMetaDTO.PreviewPolicy previewPolicy() {
        return SystemPostMetaDTO.PreviewPolicy.builder()
                .tenantScoped(true)
                .noPersistence(true)
                .noAssignment(true)
                .noPermissionEffect(true)
                .runtimeEffect(false)
                .cacheRefreshed(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .rejectedInputFields(REJECTED_INPUT_FIELDS)
                .build();
    }

    private List<String> nonGoals() {
        return List.of(
                "不实现岗位 CRUD runtime",
                "不实现用户岗位分配或 /posts/users assignment",
                "不接入 routePermissions/RBAC/data-scope/tenant 启停",
                "不刷新缓存或改变运行时权限",
                "不代表组织权限组、岗位权限 runtime 或 Workbench V3 全量完成"
        );
    }

    private String validatePostCode(String value,
                                    List<SystemPostPreviewRespDTO.RejectedInput> rejectedInputs,
                                    Set<String> acceptedFields) {
        String text = cleanText(value, 64);
        if (text == null) {
            return null;
        }
        if (!CODE_PATTERN.matcher(text).matches()) {
            reject(rejectedInputs, "postCode", "岗位编码只能包含字母、数字、点、下划线和中划线，且长度不超过 64");
            return null;
        }
        acceptedFields.add("postCode");
        return text;
    }

    private boolean validatePostName(String value,
                                     List<SystemPostPreviewRespDTO.RejectedInput> rejectedInputs,
                                     Set<String> acceptedFields) {
        String text = cleanText(value, 80);
        if (text == null) {
            return false;
        }
        if (value.trim().length() > 80) {
            reject(rejectedInputs, "postName", "岗位名称长度不超过 80");
            return false;
        }
        acceptedFields.add("postName");
        return true;
    }

    private boolean validateSortOrder(Integer sortOrder,
                                      List<SystemPostPreviewRespDTO.RejectedInput> rejectedInputs,
                                      Set<String> acceptedFields) {
        if (sortOrder == null) {
            return false;
        }
        if (sortOrder < 0 || sortOrder > 9999) {
            reject(rejectedInputs, "sortOrder", "排序必须在 0-9999 之间");
            return false;
        }
        acceptedFields.add("sortOrder");
        return true;
    }

    private boolean validateStatus(String value,
                                   List<SystemPostPreviewRespDTO.RejectedInput> rejectedInputs,
                                   Set<String> acceptedFields) {
        String status = normalizeStatus(value);
        if (value != null && !value.isBlank() && status == null) {
            reject(rejectedInputs, "status", "状态仅支持 ENABLED、DISABLED");
            return false;
        }
        if (status == null) {
            return false;
        }
        acceptedFields.add("status");
        return true;
    }

    private boolean validateRemark(String value,
                                   List<SystemPostPreviewRespDTO.RejectedInput> rejectedInputs,
                                   Set<String> acceptedFields) {
        if (value == null || value.isBlank()) {
            return false;
        }
        if (value.trim().length() > 255) {
            reject(rejectedInputs, "remark", "备注长度不超过 255");
            return false;
        }
        acceptedFields.add("remark");
        return true;
    }

    private void collectUnknownInputs(Map<String, Object> unknownInputs,
                                      List<SystemPostPreviewRespDTO.RejectedInput> rejectedInputs) {
        if (unknownInputs == null || unknownInputs.isEmpty()) {
            return;
        }
        for (String field : unknownInputs.keySet()) {
            String displayField = field == null || field.isBlank() ? "unknown" : field;
            String normalized = normalizeInputKey(displayField);
            if (REJECTED_INPUT_KEYS.contains(normalized)
                    || "userids".equals(normalized)
                    || "userlist".equals(normalized)
                    || "permissioncodes".equals(normalized)
                    || "roleids".equals(normalized)
                    || "datascope".equals(normalized)
                    || "assignmentpayload".equals(normalized)
                    || "tenantidoverride".equals(normalized)
                    || "tenantid".equals(normalized)) {
                if ("tenantid".equals(normalized) || "tenantidoverride".equals(normalized)) {
                    reject(rejectedInputs, displayField, "tenant 由 TenantContext 提供，request/body 不允许覆盖");
                } else {
                    reject(rejectedInputs, displayField, "assignment/permission 输入被拒绝，值未读取、未回显、未持久化");
                }
            } else {
                reject(rejectedInputs, displayField, "非 metadata-only preview 允许字段");
            }
        }
    }

    private List<SystemPostMetaDTO.Option> mergeOptions(List<String> observed, Map<String, String> defaults) {
        LinkedHashMap<String, String> values = new LinkedHashMap<>(defaults);
        if (observed != null) {
            for (String item : observed) {
                String value = cleanText(item, 32);
                if (value != null) {
                    values.putIfAbsent(value, value);
                }
            }
        }
        return values.entrySet().stream()
                .map(entry -> SystemPostMetaDTO.Option.builder().value(entry.getKey()).label(entry.getValue()).build())
                .toList();
    }

    private Map<String, String> statusDefaults() {
        LinkedHashMap<String, String> values = new LinkedHashMap<>();
        values.put("ENABLED", "启用");
        values.put("DISABLED", "停用");
        return values;
    }

    private String normalizeStatus(String value) {
        String text = cleanText(value, 32);
        if (text == null) {
            return null;
        }
        String upper = text.toUpperCase(Locale.ROOT);
        return ALLOWED_STATUSES.contains(upper) ? upper : null;
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

    private List<SystemPost> safeList(List<SystemPost> source) {
        return source == null ? List.of() : source;
    }

    private void reject(List<SystemPostPreviewRespDTO.RejectedInput> rejectedInputs, String field, String reason) {
        rejectedInputs.add(SystemPostPreviewRespDTO.RejectedInput.builder().field(field).reason(reason).build());
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

    private record NormalizedQuery(int page, int pageSize, int offset, String keyword, String status) {}
}
