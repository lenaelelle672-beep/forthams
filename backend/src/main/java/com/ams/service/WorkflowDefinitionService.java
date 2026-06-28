package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.WorkflowAssigneePreviewRequest;
import com.ams.dto.WorkflowAssigneePreviewResponse;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowDefinitionVersionDTO;
import com.ams.dto.WorkflowPublishRequest;
import com.ams.dto.WorkflowRollbackRequest;
import com.ams.dto.WorkflowRuntimeAssigneePreviewRequest;
import com.ams.dto.WorkflowStartAvailabilityDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.entity.WorkflowDefinition;
import com.ams.entity.WorkflowDefinitionVersion;
import com.ams.enums.WorkflowStatus;
import com.ams.mapper.UserRoleMapper;
import com.ams.mapper.WorkflowDefinitionMapper;
import com.ams.mapper.WorkflowDefinitionVersionMapper;
import com.ams.service.WorkflowTemplateRegistry.WorkflowTemplate;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 工作流定义服务。
 *
 * <p>管理工作流定义的 CRUD 生命周期（创建、发布、更新、删除），
 * 委托 {@link WorkflowGraphValidator} 执行图验证，
 * 委托 {@link WorkflowRuntimePlanner} 构建运行时审批计划，
 * 委托 {@link WorkflowTemplateRegistry} 管理预定义模板。
 */
@Service
@RequiredArgsConstructor
public class WorkflowDefinitionService {

    private static final Logger log = LoggerFactory.getLogger(WorkflowDefinitionService.class);
    private static final Pattern PREVIEW_CONDITION_PATTERN = Pattern.compile("^(.+?)\\s*(>=|<=|==|!=|>|<)\\s*(.+)$");
    private static final Map<String, List<String>> PREVIEW_CONDITION_FIELD_ALIASES = Map.ofEntries(
            Map.entry("申请金额", List.of("amount", "compensationAmount", "estimatedAmount", "currentValue", "originalValue")),
            Map.entry("金额", List.of("amount", "compensationAmount", "estimatedAmount", "currentValue", "originalValue")),
            Map.entry("赔偿金额", List.of("compensationAmount", "amount", "estimatedAmount")),
            Map.entry("资产ID", List.of("assetId")),
            Map.entry("目标部门", List.of("targetDeptId", "responsibleDeptId")),
            Map.entry("转入部门ID", List.of("targetDeptId")),
            Map.entry("责任人", List.of("responsibleUserId", "targetUserId")),
            Map.entry("赔偿责任人ID", List.of("responsibleUserId")),
            Map.entry("原因", List.of("reason", "description")),
            Map.entry("处置原因", List.of("reason", "description"))
    );

    private final WorkflowDefinitionMapper workflowDefinitionMapper;
    private final ObjectMapper objectMapper;
    private final WorkflowGraphValidator graphValidator;
    private final WorkflowRuntimePlanner runtimePlanner;
    private final WorkflowTemplateRegistry templateRegistry;
    private final UserRoleMapper userRoleMapper;
    private final WorkflowDefinitionVersionMapper workflowDefinitionVersionMapper;

    /** 审批节点运行时信息，包含审批人类型（role/user）和标识 */
    public record WorkflowApprovalNode(
            int stepNo,
            String nodeId,
            String nodeCode,
            String label,
            String approverRole,
            String approvalMode,
            String approverType,
            String approverId,
            String ccRoleCodes,
            String ccUserIds,
            int orderIndex,
            int countThreshold
    ) {
    }

    public record WorkflowRuntimePlan(List<WorkflowApprovalNode> approvalNodes, String resultAction) {
        public WorkflowRuntimePlan {
            approvalNodes = approvalNodes == null ? List.of() : List.copyOf(approvalNodes);
        }

        public WorkflowApprovalNode nodeAtStep(int stepNo) {
            if (stepNo <= 0 || stepNo > approvalNodes.size()) {
                return null;
            }
            return approvalNodes.get(stepNo - 1);
        }

        public int finalStep(int fallback) {
            return approvalNodes.isEmpty() ? fallback : approvalNodes.size();
        }
    }

    // ──────────── 查询 ────────────

    public List<WorkflowDefinitionDTO> listDefinitions() {
        String tenantId = TenantContext.requireTenantId();
        List<WorkflowDefinition> allDefinitions = workflowDefinitionMapper.selectList(
                new LambdaQueryWrapper<WorkflowDefinition>()
                        .eq(WorkflowDefinition::getTenantId, tenantId));
        Map<String, WorkflowDefinition> defMap = allDefinitions.stream()
                .collect(Collectors.toMap(WorkflowDefinition::getBusinessType, d -> d, (a, b) -> a));
        List<WorkflowDefinitionDTO> result = new ArrayList<>();
        for (WorkflowTemplate template : templateRegistry.getTemplates()) {
            result.add(toDto(defMap.get(template.businessType()), template));
        }
        Set<String> templateTypes = templateRegistry.getTemplates().stream()
                .map(WorkflowTemplate::businessType).collect(Collectors.toSet());
        for (WorkflowDefinition def : allDefinitions) {
            if (!templateTypes.contains(def.getBusinessType())) {
                result.add(toDto(def, null));
            }
        }
        return result;
    }

    public WorkflowDefinitionDTO getDefinition(String businessType) {
        String tenantId = TenantContext.requireTenantId();
        Optional<WorkflowTemplate> templateOpt = templateRegistry.findTemplate(businessType);
        WorkflowDefinition definition = findDefinition(tenantId, businessType);
        if (templateOpt.isPresent()) {
            return toDto(definition, templateOpt.get());
        }
        return toDto(definition, null);
    }

    public WorkflowStartAvailabilityDTO getStartAvailability(String businessType) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowDefinition definition = findDefinition(tenantId, businessType);
        String entryUrl = startEntryUrl(businessType);
        if (definition == null) {
            return startAvailability(businessType, false, WorkflowStatus.UNCONFIGURED.name(), 0, null,
                    entryUrl, "请先发布对应业务流程后再提交审批");
        }

        String status = firstPresent(definition.getStatus(), WorkflowStatus.UNCONFIGURED.name());
        Integer version = definition.getVersion() == null ? 0 : definition.getVersion();
        if (WorkflowStatus.DISABLED.name().equals(status)) {
            return startAvailability(businessType, false, status, version, definition.getId(),
                    entryUrl, startBlockReason(status));
        }

        WorkflowDefinitionVersion publishedVersion = findLatestPublishedVersion(tenantId, businessType);
        if (publishedVersion != null) {
            return startAvailability(businessType, true, WorkflowStatus.PUBLISHED.name(), publishedVersion.getVersion(),
                    publishedVersion.getDefinitionId(), entryUrl, "");
        }

        if (!WorkflowStatus.PUBLISHED.name().equals(status)) {
            return startAvailability(businessType, false, status, version, definition.getId(),
                    entryUrl, startBlockReason(status));
        }
        if (version <= 0) {
            return startAvailability(businessType, false, status, version, definition.getId(),
                    entryUrl, "流程尚未发布有效版本，暂不能提交审批");
        }

        return startAvailability(businessType, true, status, version, definition.getId(), entryUrl, "");
    }

    public WorkflowDefinition requirePublishedDefinition(String businessType) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowDefinition definition = findDefinition(tenantId, businessType);
        if (definition == null || WorkflowStatus.DISABLED.name().equals(definition.getStatus())) {
            throw new BusinessException("请先发布对应业务流程后再提交审批");
        }
        WorkflowDefinitionVersion publishedVersion = findLatestPublishedVersion(tenantId, businessType);
        if (publishedVersion != null) {
            return toPublishedDefinition(publishedVersion);
        }
        if (WorkflowStatus.PUBLISHED.name().equals(definition.getStatus())
                && definition.getVersion() != null && definition.getVersion() > 0) {
            return definition;
        }
        throw new BusinessException("请先发布对应业务流程后再提交审批");
    }

    public List<WorkflowDefinitionVersionDTO> listVersionHistory(String businessType) {
        String tenantId = TenantContext.requireTenantId();
        List<WorkflowDefinitionVersion> versions = workflowDefinitionVersionMapper.selectList(
                new LambdaQueryWrapper<WorkflowDefinitionVersion>()
                        .eq(WorkflowDefinitionVersion::getTenantId, tenantId)
                        .eq(WorkflowDefinitionVersion::getBusinessType, businessType)
                        .orderByDesc(WorkflowDefinitionVersion::getVersion));
        return versions.stream()
                .map(version -> toVersionDto(version, false))
                .toList();
    }

    public WorkflowDefinitionVersionDTO getVersion(String businessType, Integer version) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowDefinitionVersion snapshot = findVersion(tenantId, businessType, version);
        if (snapshot == null) {
            throw new BusinessException("流程发布版本不存在");
        }
        return toVersionDto(snapshot, true);
    }

    public int getPublishedApprovalStepCount(String businessType, int fallback) {
        try {
            WorkflowDefinition definition = requirePublishedDefinition(businessType);
            Map<String, Object> parsed = fromJson(definition.getDefinitionJson(), Map.of());
            int approvalNodeCount = countApprovalNodes(parsed.get("nodes"));
            return approvalNodeCount > 0 ? approvalNodeCount : fallback;
        } catch (BusinessException ex) {
            return fallback;
        }
    }

    public int getPublishedApprovalStepCount(String businessType, String businessData, int fallback) {
        return getPublishedRuntimePlan(businessType, businessData, fallback).finalStep(fallback);
    }

    public WorkflowRuntimePlan getPublishedRuntimePlan(String businessType, String businessData, int fallbackApprovalStepCount) {
        try {
            WorkflowDefinition definition = requirePublishedDefinition(businessType);
            Map<String, Object> parsed = fromJson(definition.getDefinitionJson(), Map.of());
            WorkflowRuntimePlan plan = runtimePlanner.buildRuntimePlan(parsed, businessData);
            return plan.approvalNodes().isEmpty()
                    ? runtimePlanner.fallbackRuntimePlan(fallbackApprovalStepCount) : plan;
        } catch (BusinessException ex) {
            return runtimePlanner.fallbackRuntimePlan(fallbackApprovalStepCount);
        }
    }

    public WorkflowRuntimePlan requirePublishedRuntimePlan(String businessType, String businessData) {
        WorkflowDefinition definition = requirePublishedDefinition(businessType);
        return requireRuntimePlan(definition.getDefinitionJson(), businessData);
    }

    public WorkflowRuntimePlan requireRuntimePlan(String definitionJson, String businessData) {
        Map<String, Object> parsed = fromJsonStrict(definitionJson, "流程定义解析失败");
        WorkflowRuntimePlan plan = runtimePlanner.buildRuntimePlan(parsed, businessData);
        if (plan.approvalNodes().isEmpty()) {
            throw new BusinessException("流程运行路径未解析到审批或办理节点");
        }
        return plan;
    }

    public WorkflowAssigneePreviewResponse previewAssignees(String businessType, WorkflowAssigneePreviewRequest request) {
        Map<String, Object> definition = request == null || request.getDefinition() == null
                ? Map.of() : request.getDefinition();
        return previewAssigneesFromDefinition(businessType, definition, request == null ? null : request.getBusinessData());
    }

    public WorkflowAssigneePreviewResponse previewPublishedAssignees(
            String businessType, WorkflowRuntimeAssigneePreviewRequest request) {
        WorkflowDefinition definition = requirePublishedDefinition(businessType);
        Map<String, Object> parsed = fromJsonStrict(definition.getDefinitionJson(), "流程定义解析失败");
        WorkflowAssigneePreviewResponse fullPreview = previewAssigneesFromDefinition(
                businessType,
                parsed,
                request == null ? null : request.getBusinessData());
        return toRuntimeSafeAssigneePreview(fullPreview);
    }

    private WorkflowAssigneePreviewResponse previewAssigneesFromDefinition(
            String businessType, Map<String, Object> definition, Object rawBusinessData) {
        Map<String, Object> businessData = parsePreviewBusinessData(rawBusinessData);

        List<String> missingFields = findMissingConditionFields(definition, businessData);
        if (!missingFields.isEmpty()) {
            return WorkflowAssigneePreviewResponse.unresolved(
                    businessType,
                    "条件字段缺失，无法可靠计算处理人",
                    missingFields
            );
        }

        WorkflowRuntimePlan plan;
        try {
            plan = runtimePlanner.buildRuntimePlan(definition, toJson(businessData));
        } catch (BusinessException ex) {
            return WorkflowAssigneePreviewResponse.unresolved(businessType, ex.getMessage(), List.of());
        }
        if (plan.approvalNodes().isEmpty()) {
            return WorkflowAssigneePreviewResponse.unresolved(businessType, "流程运行路径未解析到审批或办理节点", List.of());
        }

        List<WorkflowAssigneePreviewResponse.NodeAssigneePreview> nodes = new ArrayList<>();
        boolean allResolved = true;
        String firstReason = "";
        for (WorkflowApprovalNode node : plan.approvalNodes()) {
            WorkflowAssigneePreviewResponse.NodeAssigneePreview preview = resolvePreviewNode(node);
            if (!preview.isResolved()) {
                allResolved = false;
                if (firstReason.isBlank()) {
                    firstReason = preview.getReason();
                }
            }
            nodes.add(preview);
        }

        WorkflowAssigneePreviewResponse response = new WorkflowAssigneePreviewResponse();
        response.setBusinessType(businessType);
        response.setCalculable(allResolved);
        response.setReason(allResolved ? "" : firstPresent(firstReason, "存在未解析审批或办理节点"));
        response.setMissingFields(List.of());
        response.setNodes(nodes);
        return response;
    }

    private WorkflowAssigneePreviewResponse toRuntimeSafeAssigneePreview(WorkflowAssigneePreviewResponse source) {
        WorkflowAssigneePreviewResponse response = new WorkflowAssigneePreviewResponse();
        response.setBusinessType(source.getBusinessType());
        response.setCalculable(source.isCalculable());
        response.setReason(source.getReason());
        response.setMissingFields(source.getMissingFields() == null ? List.of() : List.copyOf(source.getMissingFields()));
        response.setNodes(source.getNodes() == null ? List.of() : source.getNodes().stream()
                .map(node -> {
                    WorkflowAssigneePreviewResponse.NodeAssigneePreview safeNode =
                            new WorkflowAssigneePreviewResponse.NodeAssigneePreview();
                    safeNode.setStepNo(node.getStepNo());
                    safeNode.setNodeId(node.getNodeId());
                    safeNode.setNodeCode(node.getNodeCode());
                    safeNode.setLabel(node.getLabel());
                    safeNode.setApproverType(node.getApproverType());
                    safeNode.setApproverRole(node.getApproverRole());
                    safeNode.setApproverId("");
                    safeNode.setResolved(node.isResolved());
                    safeNode.setAssigneeCount(node.getAssigneeCount());
                    safeNode.setReason(node.getReason());
                    safeNode.setAssignees(List.of());
                    return safeNode;
                })
                .toList());
        return response;
    }

    // ──────────── 变更 ────────────

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO saveDraft(String businessType, WorkflowDefinitionSaveDTO dto, Long operatorId) {
        if (dto == null) {
            dto = new WorkflowDefinitionSaveDTO();
        }
        String tenantId = TenantContext.requireTenantId();
        Optional<WorkflowTemplate> templateOpt = templateRegistry.findTemplate(businessType);
        WorkflowDefinition definition = findDefinition(tenantId, businessType);

        if (definition == null) {
            definition = new WorkflowDefinition();
            definition.setTenantId(tenantId);
            definition.setBusinessType(businessType);
            definition.setStatus(WorkflowStatus.DRAFT.name());
            definition.setVersion(0);
        } else if (WorkflowStatus.PUBLISHED.name().equals(definition.getStatus())) {
            definition.setStatus(WorkflowStatus.DRAFT.name());
        }

        if (templateOpt.isPresent()) {
            WorkflowTemplate template = templateOpt.get();
            definition.setName(firstPresent(dto.getName(), template.name()));
            definition.setDescription(firstPresent(dto.getDescription(), template.description()));
            definition.setDefinitionJson(toJson(dto.getDefinition() == null
                    ? templateRegistry.defaultDefinition(template) : dto.getDefinition()));
        } else {
            definition.setName(firstPresent(dto.getName(),
                    definition.getName() != null ? definition.getName() : businessType));
            definition.setDescription(firstPresent(dto.getDescription(),
                    definition.getDescription() != null ? definition.getDescription() : ""));
            definition.setDefinitionJson(toJson(dto.getDefinition() == null
                    ? templateRegistry.defaultCustomDefinition() : dto.getDefinition()));
        }
        definition.setUpdatedBy(operatorId);

        if (definition.getId() == null) {
            WorkflowDefinition deletedDefinition = workflowDefinitionMapper.selectIncludingDeleted(tenantId, businessType);
            if (deletedDefinition != null) {
                if (Integer.valueOf(1).equals(deletedDefinition.getDeleted())) {
                    int rows = workflowDefinitionMapper.restoreDeletedDefinition(
                            deletedDefinition.getId(),
                            tenantId,
                            businessType,
                            definition.getName(),
                            definition.getDescription(),
                            definition.getDefinitionJson(),
                            operatorId);
                    if (rows == 0) {
                        throw new BusinessException("流程定义已被其他操作修改，请刷新后重试");
                    }
                    WorkflowDefinition restored = findDefinition(tenantId, businessType);
                    if (restored == null) {
                        throw new BusinessException("流程定义已被其他操作修改，请刷新后重试");
                    }
                    return toDto(restored, templateOpt.orElse(null));
                }
                throw new BusinessException("流程定义已被其他操作修改，请刷新后重试");
            }
            workflowDefinitionMapper.insert(definition);
        } else {
            workflowDefinitionMapper.updateById(definition);
        }

        return toDto(definition, templateOpt.orElse(null));
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO publish(String businessType, Long operatorId) {
        return publish(businessType, null, operatorId);
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO publish(String businessType, WorkflowPublishRequest request, Long operatorId) {
        String tenantId = TenantContext.requireTenantId();
        Optional<WorkflowTemplate> templateOpt = templateRegistry.findTemplate(businessType);
        WorkflowDefinition definition = findDefinition(tenantId, businessType);

        if (definition == null) {
            WorkflowDefinitionSaveDTO dto = new WorkflowDefinitionSaveDTO();
            if (templateOpt.isPresent()) {
                WorkflowTemplate template = templateOpt.get();
                dto.setName(template.name());
                dto.setDescription(template.description());
                dto.setDefinition(templateRegistry.defaultDefinition(template));
            } else {
                dto.setName(businessType);
                dto.setDescription("");
                dto.setDefinition(templateRegistry.defaultCustomDefinition());
            }
            saveDraft(businessType, dto, operatorId);
            definition = findDefinition(tenantId, businessType);
        }

        // 发布前修正 definition JSON 里的 businessType
        fixDefinitionBusinessType(definition, businessType);
        graphValidator.validateDefinition(definition);

        // 乐观锁：仅当版本号未变时才执行发布，防止并发覆盖
        Integer currentVersion = definition.getVersion() == null ? 0 : definition.getVersion();
        WorkflowDefinitionVersion latest = findLatestPublishedVersion(tenantId, businessType);
        Integer latestVersion = latest == null || latest.getVersion() == null ? 0 : latest.getVersion();
        Integer nextVersion = Math.max(currentVersion, latestVersion) + 1;
        LocalDateTime now = LocalDateTime.now();

        LambdaUpdateWrapper<WorkflowDefinition> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(WorkflowDefinition::getId, definition.getId())
                .eq(WorkflowDefinition::getVersion, currentVersion)
                .set(WorkflowDefinition::getStatus, WorkflowStatus.PUBLISHED.name())
                .set(WorkflowDefinition::getVersion, nextVersion)
                .set(WorkflowDefinition::getDefinitionJson, definition.getDefinitionJson())
                .set(WorkflowDefinition::getPublishedBy, operatorId)
                .set(WorkflowDefinition::getPublishedAt, now)
                .set(WorkflowDefinition::getUpdatedBy, operatorId);

        int rows = workflowDefinitionMapper.update(null, updateWrapper);
        if (rows == 0) {
            throw new BusinessException("流程定义已被其他操作修改，请刷新后重试");
        }

        definition.setStatus(WorkflowStatus.PUBLISHED.name());
        definition.setVersion(nextVersion);
        definition.setPublishedBy(operatorId);
        definition.setPublishedAt(now);
        definition.setUpdatedBy(operatorId);

        insertVersionSnapshot(definition, "PUBLISH", operatorId, now, null,
                request == null ? null : request.getPublishNote(),
                request == null ? null : request.getImpactScope(),
                request == null ? null : request.getRollbackPlan());

        return toDto(definition, templateOpt.orElse(null));
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO rollbackToVersion(String businessType, Integer targetVersion,
                                                    WorkflowRollbackRequest request, Long operatorId) {
        String tenantId = TenantContext.requireTenantId();
        Optional<WorkflowTemplate> templateOpt = templateRegistry.findTemplate(businessType);
        WorkflowDefinition definition = findDefinition(tenantId, businessType);
        if (definition == null) {
            throw new BusinessException("流程定义不存在");
        }
        if (targetVersion == null || targetVersion <= 0) {
            throw new BusinessException("回滚目标版本无效");
        }
        WorkflowDefinitionVersion target = findVersion(tenantId, businessType, targetVersion);
        if (target == null) {
            throw new BusinessException("流程发布版本不存在");
        }

        Integer headVersion = definition.getVersion() == null ? 0 : definition.getVersion();
        WorkflowDefinitionVersion latest = findLatestPublishedVersion(tenantId, businessType);
        Integer latestVersion = latest == null || latest.getVersion() == null ? 0 : latest.getVersion();
        Integer nextVersion = Math.max(headVersion, latestVersion) + 1;
        LocalDateTime now = LocalDateTime.now();

        definition.setName(target.getName());
        definition.setDescription(target.getDescription());
        definition.setDefinitionJson(target.getDefinitionJson());
        definition.setStatus(WorkflowStatus.PUBLISHED.name());
        definition.setVersion(nextVersion);
        definition.setPublishedBy(operatorId);
        definition.setPublishedAt(now);
        definition.setUpdatedBy(operatorId);

        LambdaUpdateWrapper<WorkflowDefinition> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(WorkflowDefinition::getId, definition.getId())
                .eq(WorkflowDefinition::getVersion, headVersion)
                .set(WorkflowDefinition::getName, definition.getName())
                .set(WorkflowDefinition::getDescription, definition.getDescription())
                .set(WorkflowDefinition::getDefinitionJson, definition.getDefinitionJson())
                .set(WorkflowDefinition::getStatus, WorkflowStatus.PUBLISHED.name())
                .set(WorkflowDefinition::getVersion, nextVersion)
                .set(WorkflowDefinition::getPublishedBy, operatorId)
                .set(WorkflowDefinition::getPublishedAt, now)
                .set(WorkflowDefinition::getUpdatedBy, operatorId);

        int rows = workflowDefinitionMapper.update(null, updateWrapper);
        if (rows == 0) {
            throw new BusinessException("流程定义已被其他操作修改，请刷新后重试");
        }

        insertVersionSnapshot(definition, "ROLLBACK", operatorId, now, Long.valueOf(targetVersion),
                request == null ? null : request.getReason(),
                request == null ? null : request.getImpactScope(),
                request == null ? null : request.getRollbackPlan());

        return toDto(definition, templateOpt.orElse(null));
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO updateStatus(String businessType, WorkflowStatusUpdateDTO dto, Long operatorId) {
        String tenantId = TenantContext.requireTenantId();
        Optional<WorkflowTemplate> templateOpt = templateRegistry.findTemplate(businessType);
        WorkflowDefinition definition = findDefinition(tenantId, businessType);
        if (definition == null) {
            throw new BusinessException("流程定义不存在");
        }

        String status = dto.getStatus();
        if (!WorkflowStatus.ACTION_ENABLED.equals(status) && !WorkflowStatus.ACTION_DISABLED.equals(status)) {
            throw new BusinessException("流程状态仅支持 ENABLED 或 DISABLED");
        }
        if (WorkflowStatus.ACTION_ENABLED.equals(status) && definition.getVersion() != null && definition.getVersion() > 0) {
            definition.setStatus(WorkflowStatus.PUBLISHED.name());
        } else if (WorkflowStatus.ACTION_ENABLED.equals(status)) {
            throw new BusinessException("流程尚未发布，不能启用");
        } else {
            definition.setStatus(WorkflowStatus.DISABLED.name());
        }
        definition.setUpdatedBy(operatorId);
        workflowDefinitionMapper.updateById(definition);
        return toDto(definition, templateOpt.orElse(null));
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteDefinition(String businessType) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowDefinition definition = findDefinition(tenantId, businessType);
        if (definition == null) {
            throw new BusinessException("流程定义不存在");
        }
        if (!WorkflowStatus.DISABLED.name().equals(definition.getStatus())
                && !WorkflowStatus.DRAFT.name().equals(definition.getStatus())) {
            throw new BusinessException("只能删除已停用或草稿状态的流程，已发布的流程请先停用后再删除");
        }
        workflowDefinitionMapper.deleteById(definition.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO createCustomDefinition(String businessType, String name,
                                                         String description, Long operatorId) {
        String tenantId = TenantContext.requireTenantId();
        validateCustomBusinessType(businessType);
        WorkflowDefinition existing = findDefinition(tenantId, businessType);
        if (existing != null) {
            throw new BusinessException("该自定义流程类型已存在: " + businessType);
        }
        String definitionJson = toJson(templateRegistry.defaultCustomDefinition());
        WorkflowDefinition deletedDefinition = workflowDefinitionMapper.selectIncludingDeleted(tenantId, businessType);
        if (deletedDefinition != null) {
            if (Integer.valueOf(1).equals(deletedDefinition.getDeleted())) {
                Long updatedBy = operatorId != null ? operatorId : 0L;
                int rows = workflowDefinitionMapper.restoreDeletedDefinition(
                        deletedDefinition.getId(),
                        tenantId,
                        businessType,
                        name,
                        description,
                        definitionJson,
                        updatedBy);
                if (rows == 0) {
                    throw new BusinessException("流程定义已被其他操作修改，请刷新后重试");
                }
                WorkflowDefinition restored = findDefinition(tenantId, businessType);
                if (restored == null) {
                    throw new BusinessException("流程定义已被其他操作修改，请刷新后重试");
                }
                return toDto(restored, null);
            }
            throw new BusinessException("流程定义已被其他操作修改，请刷新后重试");
        }
        WorkflowDefinition definition = new WorkflowDefinition();
        definition.setTenantId(tenantId);
        definition.setBusinessType(businessType);
        definition.setName(name);
        definition.setDescription(description);
        definition.setStatus(WorkflowStatus.DRAFT.name());
        definition.setVersion(0);
        definition.setDefinitionJson(definitionJson);
        definition.setUpdatedBy(operatorId != null ? operatorId : 0L);
        workflowDefinitionMapper.insert(definition);
        return toDto(definition, null);
    }

    // ──────────── 私有方法 ────────────

    private WorkflowDefinition findDefinition(String tenantId, String businessType) {
        return workflowDefinitionMapper.selectOne(new LambdaQueryWrapper<WorkflowDefinition>()
                .eq(WorkflowDefinition::getTenantId, tenantId)
                .eq(WorkflowDefinition::getBusinessType, businessType)
                .last("limit 1"));
    }

    private WorkflowDefinitionVersion findVersion(String tenantId, String businessType, Integer version) {
        if (version == null) {
            return null;
        }
        return workflowDefinitionVersionMapper.selectOne(new LambdaQueryWrapper<WorkflowDefinitionVersion>()
                .eq(WorkflowDefinitionVersion::getTenantId, tenantId)
                .eq(WorkflowDefinitionVersion::getBusinessType, businessType)
                .eq(WorkflowDefinitionVersion::getVersion, version)
                .last("limit 1"));
    }

    private WorkflowDefinitionVersion findLatestPublishedVersion(String tenantId, String businessType) {
        return workflowDefinitionVersionMapper.selectOne(new LambdaQueryWrapper<WorkflowDefinitionVersion>()
                .eq(WorkflowDefinitionVersion::getTenantId, tenantId)
                .eq(WorkflowDefinitionVersion::getBusinessType, businessType)
                .eq(WorkflowDefinitionVersion::getStatus, WorkflowStatus.PUBLISHED.name())
                .orderByDesc(WorkflowDefinitionVersion::getVersion)
                .last("limit 1"));
    }

    private void insertVersionSnapshot(WorkflowDefinition definition, String actionType, Long operatorId,
                                       LocalDateTime publishedAt, Long rollbackSourceVersion,
                                       String publishNote, String impactScope, String rollbackPlan) {
        WorkflowDefinitionVersion snapshot = new WorkflowDefinitionVersion();
        snapshot.setTenantId(definition.getTenantId());
        snapshot.setDefinitionId(definition.getId());
        snapshot.setBusinessType(definition.getBusinessType());
        snapshot.setVersion(definition.getVersion());
        snapshot.setActionType(actionType);
        snapshot.setStatus(WorkflowStatus.PUBLISHED.name());
        snapshot.setName(definition.getName());
        snapshot.setDescription(definition.getDescription());
        snapshot.setDefinitionJson(definition.getDefinitionJson());
        snapshot.setPublishNote(firstPresent(publishNote, "PUBLISH".equals(actionType) ? "流程发布" : "流程回滚"));
        snapshot.setImpactScope(firstPresent(impactScope, "影响后续新发起审批，已发起实例保持原版本快照"));
        snapshot.setRollbackPlan(firstPresent(rollbackPlan, "可在版本历史中回滚至任一已发布快照"));
        snapshot.setRollbackSourceVersion(rollbackSourceVersion);
        snapshot.setOperatorId(operatorId);
        snapshot.setPublishedAt(publishedAt);
        workflowDefinitionVersionMapper.insert(snapshot);
    }

    private WorkflowDefinition toPublishedDefinition(WorkflowDefinitionVersion version) {
        WorkflowDefinition definition = new WorkflowDefinition();
        definition.setId(version.getDefinitionId());
        definition.setTenantId(version.getTenantId());
        definition.setBusinessType(version.getBusinessType());
        definition.setName(version.getName());
        definition.setDescription(version.getDescription());
        definition.setDefinitionJson(version.getDefinitionJson());
        definition.setStatus(version.getStatus());
        definition.setVersion(version.getVersion());
        definition.setPublishedBy(version.getOperatorId());
        definition.setPublishedAt(version.getPublishedAt());
        definition.setUpdateTime(version.getCreateTime());
        return definition;
    }

    private WorkflowStartAvailabilityDTO startAvailability(String businessType, boolean canStart, String status,
                                                           Integer version, Long definitionId, String entryUrl,
                                                           String blockReason) {
        return new WorkflowStartAvailabilityDTO(
                businessType,
                canStart,
                status,
                version == null ? 0 : version,
                definitionId,
                entryUrl,
                blockReason == null ? "" : blockReason
        );
    }

    private String startBlockReason(String status) {
        if (WorkflowStatus.DISABLED.name().equals(status)) {
            return "业务流程已停用，暂不能提交审批";
        }
        if (WorkflowStatus.DRAFT.name().equals(status)) {
            return "业务流程仍是草稿，发布后才能提交审批";
        }
        return "请先发布对应业务流程后再提交审批";
    }

    private String startEntryUrl(String businessType) {
        return switch (businessType) {
            case "ASSET_TRANSFER" -> "/disposals/transfer/new";
            case "ASSET_CLEARANCE" -> "/disposals/clearance/new";
            case "ASSET_SCRAP" -> "/disposals/scrap/new";
            case "ASSET_COMPENSATION" -> "/compensation/new";
            default -> "/workflow-form/" + businessType;
        };
    }

    private void validateCustomBusinessType(String businessType) {
        if (businessType == null || businessType.isBlank()) {
            throw new BusinessException("自定义流程类型不能为空");
        }
        if (!businessType.matches("^CUSTOM_[a-zA-Z][a-zA-Z0-9_]{1,62}$")) {
            throw new BusinessException("自定义流程类型格式不正确，必须为 CUSTOM_ 后跟英文名（字母开头，字母数字下划线，最长64字符）");
        }
        if (templateRegistry.findTemplate(businessType).isPresent()) {
            throw new BusinessException("该流程类型与预定义类型冲突: " + businessType);
        }
    }

    @SuppressWarnings("unchecked")
    private void fixDefinitionBusinessType(WorkflowDefinition definition, String businessType) {
        Map<String, Object> parsed = fromJson(definition.getDefinitionJson(), Map.of());
        if (parsed.isEmpty()) return;
        Map<String, Object> updated = new LinkedHashMap<>(parsed);
        updated.put("businessType", businessType);
        Object id = updated.get("id");
        if (id == null || "WF-CUSTOM".equals(String.valueOf(id))) {
            updated.put("id", "WF-" + businessType);
        }
        definition.setDefinitionJson(toJson(updated));
    }

    private WorkflowDefinitionDTO toDto(WorkflowDefinition definition, WorkflowTemplate template) {
        WorkflowDefinitionDTO dto = new WorkflowDefinitionDTO();

        if (definition == null) {
            if (template != null) {
                dto.setBusinessType(template.businessType());
                dto.setName(template.name());
                dto.setDescription(template.description());
                dto.setDefinition(templateRegistry.defaultDefinition(template));
            } else {
                dto.setDefinition(templateRegistry.defaultCustomDefinition());
            }
            dto.setStatus(WorkflowStatus.UNCONFIGURED.name());
            dto.setVersion(0);
            return dto;
        }

        dto.setId(definition.getId());
        dto.setBusinessType(definition.getBusinessType());
        dto.setName(definition.getName());
        dto.setDescription(definition.getDescription());
        dto.setDefinition(fromJson(definition.getDefinitionJson(),
                templateRegistry.defaultDefinition(template)));
        dto.setStatus(definition.getStatus());
        dto.setVersion(definition.getVersion());
        dto.setUpdatedBy(definition.getUpdatedBy());
        dto.setPublishedBy(definition.getPublishedBy());
        dto.setPublishedAt(definition.getPublishedAt());
        dto.setCreateTime(definition.getCreateTime());
        dto.setUpdateTime(definition.getUpdateTime());
        return dto;
    }

    private WorkflowDefinitionVersionDTO toVersionDto(WorkflowDefinitionVersion version, boolean includeDefinition) {
        WorkflowDefinitionVersionDTO dto = new WorkflowDefinitionVersionDTO();
        dto.setId(version.getId());
        dto.setDefinitionId(version.getDefinitionId());
        dto.setBusinessType(version.getBusinessType());
        dto.setVersion(version.getVersion());
        dto.setActionType(version.getActionType());
        dto.setStatus(version.getStatus());
        dto.setName(version.getName());
        dto.setDescription(version.getDescription());
        if (includeDefinition) {
            dto.setDefinition(fromJson(version.getDefinitionJson(), Map.of()));
        }
        dto.setPublishNote(version.getPublishNote());
        dto.setImpactScope(version.getImpactScope());
        dto.setRollbackPlan(version.getRollbackPlan());
        dto.setRollbackSourceVersion(version.getRollbackSourceVersion());
        dto.setOperatorId(version.getOperatorId());
        dto.setPublishedAt(version.getPublishedAt());
        dto.setCreateTime(version.getCreateTime());
        return dto;
    }

    private int countApprovalNodes(Object nodes) {
        if (!(nodes instanceof List<?> nodeList)) {
            return 0;
        }
        int count = 0;
        for (Object node : nodeList) {
            if (!(node instanceof Map<?, ?> nodeMap)) {
                continue;
            }
            Object type = nodeMap.get("type");
            if (!"approval".equals(type) && nodeMap.get("data") instanceof Map<?, ?> dataMap) {
                type = dataMap.get("type");
            }
            if ("approval".equals(type) || "task".equals(type)) {
                count++;
            }
        }
        return count;
    }

    private WorkflowAssigneePreviewResponse.NodeAssigneePreview resolvePreviewNode(WorkflowApprovalNode node) {
        WorkflowAssigneePreviewResponse.NodeAssigneePreview preview = new WorkflowAssigneePreviewResponse.NodeAssigneePreview();
        preview.setStepNo(node.stepNo());
        preview.setNodeId(node.nodeId());
        preview.setNodeCode(node.nodeCode());
        preview.setLabel(node.label());
        preview.setApproverType(node.approverType());
        preview.setApproverRole(node.approverRole());
        preview.setApproverId(node.approverId());
        preview.setAssigneeCount(0);
        preview.setAssignees(List.of());

        if ("user".equals(node.approverType())) {
            if (node.approverId() == null || node.approverId().isBlank()) {
                preview.setResolved(false);
                preview.setReason("节点缺少指定处理人");
                return preview;
            }
            preview.setResolved(true);
            preview.setReason("");
            preview.setAssigneeCount(1);
            preview.setAssignees(List.of(new WorkflowAssigneePreviewResponse.Assignee(node.approverId())));
            return preview;
        }

        if (node.approverRole() == null || node.approverRole().isBlank()) {
            preview.setResolved(false);
            preview.setReason("节点缺少处理角色配置");
            return preview;
        }

        List<Long> userIds = userRoleMapper.selectActiveUserIdsByRole(node.approverRole());
        if (userIds == null || userIds.isEmpty()) {
            preview.setResolved(false);
            preview.setReason("角色不存在或无启用用户");
            return preview;
        }
        preview.setResolved(true);
        preview.setReason("");
        preview.setAssigneeCount(userIds.size());
        preview.setAssignees(userIds.stream()
                .map(id -> new WorkflowAssigneePreviewResponse.Assignee(String.valueOf(id)))
                .toList());
        return preview;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parsePreviewBusinessData(Object raw) {
        if (raw == null) {
            return Map.of();
        }
        if (raw instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        if (raw instanceof String text) {
            if (text.isBlank()) {
                return Map.of();
            }
            return fromJsonStrict(text, "业务数据解析失败");
        }
        return objectMapper.convertValue(raw, new TypeReference<>() {});
    }

    @SuppressWarnings("unchecked")
    private List<String> findMissingConditionFields(Map<String, Object> definition, Map<String, Object> businessData) {
        if (!(definition.get("nodes") instanceof List<?> nodes)) {
            return List.of();
        }
        List<String> missing = new ArrayList<>();
        for (Object item : nodes) {
            if (!(item instanceof Map<?, ?> rawNode)) {
                continue;
            }
            Map<String, Object> node = (Map<String, Object>) rawNode;
            String type = textValue(node.get("type"));
            Map<String, Object> data = node.get("data") instanceof Map<?, ?> rawData
                    ? (Map<String, Object>) rawData : Map.of();
            if (type.isBlank()) {
                type = textValue(data.get("type"));
            }
            if (!"condition".equals(type)) {
                continue;
            }
            for (String field : referencedConditionFields(textValue(data.get("conditionExpression")))) {
                if (!conditionFieldExists(businessData, field) && !missing.contains(field)) {
                    missing.add(field);
                }
            }
        }
        return missing;
    }

    private List<String> referencedConditionFields(String expression) {
        String text = textValue(expression);
        if (text.isBlank() || isConditionLiteral(text)) {
            return List.of();
        }
        Matcher matcher = PREVIEW_CONDITION_PATTERN.matcher(text);
        if (matcher.matches()) {
            return isConditionLiteral(matcher.group(1)) ? List.of() : List.of(matcher.group(1).trim());
        }
        return List.of(text);
    }

    private boolean conditionFieldExists(Map<String, Object> context, String field) {
        List<String> candidates = PREVIEW_CONDITION_FIELD_ALIASES.getOrDefault(field, List.of(field));
        for (String candidate : candidates) {
            if (contextPathExists(context, candidate)) {
                return true;
            }
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    private boolean contextPathExists(Map<String, Object> context, String path) {
        Object current = context;
        for (String segment : path.split("\\.")) {
            if (!(current instanceof Map<?, ?> rawMap) || !rawMap.containsKey(segment)) {
                return false;
            }
            current = ((Map<String, Object>) rawMap).get(segment);
        }
        return true;
    }

    private boolean isConditionLiteral(String value) {
        String text = textValue(value);
        if (text.isBlank()) {
            return true;
        }
        if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
            return true;
        }
        if ("true".equalsIgnoreCase(text) || "false".equalsIgnoreCase(text)
                || "null".equalsIgnoreCase(text) || "是".equals(text) || "否".equals(text)
                || "满足".equals(text) || "不满足".equals(text)) {
            return true;
        }
        return text.matches("^-?\\d+(\\.\\d+)?$");
    }

    private String toJson(Map<String, Object> definition) {
        try {
            return objectMapper.writeValueAsString(definition);
        } catch (JsonProcessingException ex) {
            throw new BusinessException("流程定义序列化失败");
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

    private Map<String, Object> fromJsonStrict(String json, String message) {
        if (json == null || json.isBlank()) {
            throw new BusinessException(message);
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException ex) {
            throw new BusinessException(message + ": " + ex.getMessage());
        }
    }

    private String firstPresent(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String textValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
