package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.entity.WorkflowDefinition;
import com.ams.enums.WorkflowStatus;
import com.ams.mapper.WorkflowDefinitionMapper;
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

    private final WorkflowDefinitionMapper workflowDefinitionMapper;
    private final ObjectMapper objectMapper;
    private final WorkflowGraphValidator graphValidator;
    private final WorkflowRuntimePlanner runtimePlanner;
    private final WorkflowTemplateRegistry templateRegistry;

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

    public WorkflowDefinition requirePublishedDefinition(String businessType) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowDefinition definition = findDefinition(tenantId, businessType);
        if (definition == null || !WorkflowStatus.PUBLISHED.name().equals(definition.getStatus())
                || definition.getVersion() == null || definition.getVersion() <= 0) {
            throw new BusinessException("请先发布对应业务流程后再提交审批");
        }
        return definition;
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
            throw new BusinessException("流程运行路径未解析到审批节点");
        }
        return plan;
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
            workflowDefinitionMapper.insert(definition);
        } else {
            workflowDefinitionMapper.updateById(definition);
        }

        return toDto(definition, templateOpt.orElse(null));
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO publish(String businessType, Long operatorId) {
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
        Integer nextVersion = currentVersion + 1;
        LocalDateTime now = LocalDateTime.now();

        LambdaUpdateWrapper<WorkflowDefinition> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(WorkflowDefinition::getId, definition.getId())
                .eq(WorkflowDefinition::getVersion, currentVersion)
                .set(WorkflowDefinition::getStatus, WorkflowStatus.PUBLISHED.name())
                .set(WorkflowDefinition::getVersion, nextVersion)
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
        WorkflowDefinition definition = new WorkflowDefinition();
        definition.setTenantId(tenantId);
        definition.setBusinessType(businessType);
        definition.setName(name);
        definition.setDescription(description);
        definition.setStatus(WorkflowStatus.DRAFT.name());
        definition.setVersion(0);
        definition.setDefinitionJson(toJson(templateRegistry.defaultCustomDefinition()));
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
            if ("approval".equals(type)) {
                count++;
            }
        }
        return count;
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
}
