package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.FlowDesignerDraftDTO;
import com.ams.dto.FlowDesignerGraphDTO;
import com.ams.dto.FlowDesignerOperationDTO;
import com.ams.dto.FlowDesignerValidationResultDTO;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowDefinitionVersionDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.entity.WorkflowDefinition;
import com.ams.entity.WorkflowDefinitionVersion;
import com.ams.mapper.WorkflowDefinitionMapper;
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
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class WorkflowDefinitionService {

    private static final List<WorkflowTemplate> TEMPLATES = List.of(
            new WorkflowTemplate("ASSET_TRANSFER", "资产转移流程", "用于资产转出、转入确认及双方部门资产管理员审批。"),
            new WorkflowTemplate("ASSET_CLEARANCE", "资产清退流程", "用于闲置资产清退、部门审批、库房确认及 IT 审核。"),
            new WorkflowTemplate("ASSET_SCRAP", "资产报废转让流程", "用于资产报废转让多级审批、收款确认与核算归档。"),
            new WorkflowTemplate("ASSET_COMPENSATION", "资产赔偿流程", "用于资产损失赔偿、信息安全审批、财务审批与库房接收。")
    );

    private final WorkflowDefinitionMapper workflowDefinitionMapper;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;

    private static final Set<String> ALLOWED_NODE_TYPES = Set.of(
            "START", "START_EVENT", "END", "END_EVENT", "APPROVAL", "TASK", "USER_TASK", "SERVICE_TASK",
            "FORM", "NOTIFY", "EXCLUSIVE_GATEWAY", "PARALLEL_GATEWAY"
    );

    public List<WorkflowDefinitionDTO> listDefinitions() {
        String tenantId = TenantContext.requireTenantId();
        return TEMPLATES.stream()
                .map(template -> toDto(findDefinition(tenantId, template.businessType()), template))
                .toList();
    }

    public WorkflowDefinitionDTO getDefinition(String businessType) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        return toDto(findDefinition(tenantId, template.businessType()), template);
    }

    public WorkflowDefinition requirePublishedDefinition(String businessType) {
        String tenantId = TenantContext.requireTenantId();
        requireTemplate(businessType);
        WorkflowDefinition definition = findDefinition(tenantId, businessType);
        if (definition == null || !"PUBLISHED".equals(definition.getStatus()) || definition.getVersion() == null || definition.getVersion() <= 0) {
            throw new BusinessException("请先发布对应业务流程后再提交审批");
        }
        return definition;
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO saveDraft(String businessType, WorkflowDefinitionSaveDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        WorkflowDefinition definition = findDefinition(tenantId, businessType);

        if (definition == null) {
            definition = new WorkflowDefinition();
            definition.setTenantId(tenantId);
            definition.setBusinessType(businessType);
            definition.setStatus("DRAFT");
            definition.setVersion(0);
        }
        // 注意：不再将 PUBLISHED 降级为 DRAFT（BUG 1.3 修复）
        // 编辑草稿不应影响已发布版本的线上可用性
        // 已发布流程保存草稿后仍保持 PUBLISHED，直到显式重新发布才更新版本

        definition.setName(firstPresent(dto.getName(), template.name()));
        definition.setDescription(firstPresent(dto.getDescription(), template.description()));
        definition.setDefinitionJson(toJson(dto.getDefinition() == null ? defaultDefinition(template) : dto.getDefinition()));
        definition.setUpdatedBy(dto.getOperatorId());

        if (definition.getId() == null) {
            workflowDefinitionMapper.insert(definition);
        } else {
            workflowDefinitionMapper.updateById(definition);
        }

        return toDto(definition, template);
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO saveDesignerDraft(String businessType, FlowDesignerDraftDTO dto, Long operatorId) {
        WorkflowDefinitionSaveDTO saveDTO = new WorkflowDefinitionSaveDTO();
        saveDTO.setName(dto.getName());
        saveDTO.setDescription(dto.getDescription());
        saveDTO.setDefinition(toDefinitionMap(dto.getGraph()));
        saveDTO.setOperatorId(requireOperatorId(operatorId));
        return saveDraft(businessType, saveDTO);
    }

    public FlowDesignerValidationResultDTO validateDesignerGraph(FlowDesignerGraphDTO graph) {
        return validateDefinitionMap(toDefinitionMap(graph));
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO publish(String businessType, FlowDesignerOperationDTO operation) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        WorkflowDefinition definition = findDefinition(tenantId, businessType);
        Long operatorId = requireOperatorId(operation == null ? null : operation.getOperatorId());
        requireConfirmed(operation, "发布");
        String reason = requireAuditReason(operation, "发布");
        requireAuditEvidence(operation, "发布");

        if (definition == null) {
            throw new BusinessException("请先保存流程设计器草稿后再发布");
        }

        validateDefinition(definition);
        // BUG 1.1 修复：用 Math.incrementExact 防止 Integer 溢出（+1 超过 Integer.MAX_VALUE 时抛异常而非静默包装为负数）
        int currentVersion = definition.getVersion() == null ? 0 : definition.getVersion();
        Integer nextVersion = Math.incrementExact(currentVersion);
        definition.setStatus("PUBLISHED");
        definition.setVersion(nextVersion);
        definition.setPublishedBy(operatorId);
        definition.setPublishedAt(LocalDateTime.now());
        definition.setUpdatedBy(operatorId);
        workflowDefinitionMapper.updateById(definition);
        insertVersionSnapshot(tenantId, definition, "PUBLISH", reason, operation, null);
        return toDto(definition, template);
    }

    public List<WorkflowDefinitionVersionDTO> listVersions(String businessType) {
        String tenantId = TenantContext.requireTenantId();
        requireTemplate(businessType);
        return queryVersions(tenantId, businessType, null).stream()
                .map(this::toVersionDto)
                .toList();
    }

    public WorkflowDefinitionVersionDTO getVersion(String businessType, Integer version) {
        String tenantId = TenantContext.requireTenantId();
        requireTemplate(businessType);
        return toVersionDto(requireVersion(tenantId, businessType, version));
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO rollback(String businessType, Integer version, FlowDesignerOperationDTO operation) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        Long operatorId = requireOperatorId(operation == null ? null : operation.getOperatorId());
        requireConfirmed(operation, "回滚");
        String reason = requireAuditReason(operation, "回滚");
        requireAuditEvidence(operation, "回滚");

        WorkflowDefinition definition = findDefinition(tenantId, businessType);
        if (definition == null) {
            throw new BusinessException("流程定义不存在");
        }
        WorkflowDefinitionVersion sourceVersion = requireVersion(tenantId, businessType, version);

        // BUG 1.4 修复：rollback 到当前版本无意义（创建 spurious 版本记录）
        if (version.equals(definition.getVersion())) {
            throw new BusinessException("回滚版本与当前版本相同，无需回滚");
        }

        definition.setName(sourceVersion.getName());
        definition.setDescription(sourceVersion.getDescription());
        definition.setDefinitionJson(sourceVersion.getDefinitionJson());
        definition.setStatus("PUBLISHED");
        definition.setVersion(Math.incrementExact(definition.getVersion() == null ? 0 : definition.getVersion()));
        definition.setPublishedBy(operatorId);
        definition.setPublishedAt(LocalDateTime.now());
        definition.setUpdatedBy(operatorId);
        validateDefinition(definition);
        workflowDefinitionMapper.updateById(definition);
        insertVersionSnapshot(tenantId, definition, "ROLLBACK", reason, operation, version);
        return toDto(definition, template);
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO updateStatus(String businessType, WorkflowStatusUpdateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        WorkflowDefinition definition = findDefinition(tenantId, businessType);
        if (definition == null) {
            throw new BusinessException("流程定义不存在");
        }

        String status = dto.getStatus();
        if (!"ENABLED".equals(status) && !"DISABLED".equals(status)) {
            throw new BusinessException("流程状态仅支持 ENABLED 或 DISABLED");
        }
        if ("ENABLED".equals(status) && definition.getVersion() != null && definition.getVersion() > 0) {
            definition.setStatus("PUBLISHED");
        } else if ("ENABLED".equals(status)) {
            throw new BusinessException("流程尚未发布，不能启用");
        } else {
            definition.setStatus("DISABLED");
        }
        definition.setUpdatedBy(dto.getOperatorId());
        workflowDefinitionMapper.updateById(definition);
        return toDto(definition, template);
    }

    private WorkflowDefinition findDefinition(String tenantId, String businessType) {
        return workflowDefinitionMapper.selectOne(new LambdaQueryWrapper<WorkflowDefinition>()
                .eq(WorkflowDefinition::getTenantId, tenantId)
                .eq(WorkflowDefinition::getBusinessType, businessType)
                .last("limit 1"));
    }

    private WorkflowTemplate requireTemplate(String businessType) {
        return TEMPLATES.stream()
                .filter(template -> template.businessType().equals(businessType))
                .findFirst()
                .orElseThrow(() -> new BusinessException("不支持的业务流程类型"));
    }

    private Long requireOperatorId(Long operatorId) {
        if (operatorId == null || operatorId <= 0) {
            throw new BusinessException("流程设计器操作人不能为空");
        }
        return operatorId;
    }

    private void requireConfirmed(FlowDesignerOperationDTO operation, String actionName) {
        if (operation == null || !Boolean.TRUE.equals(operation.getConfirmed())) {
            throw new BusinessException(actionName + "操作需要二次确认");
        }
    }

    private String requireAuditReason(FlowDesignerOperationDTO operation, String actionName) {
        String reason = firstPresent(operation == null ? null : operation.getReason(), operation == null ? null : operation.getPublishNote());
        if (reason == null || reason.isBlank()) {
            throw new BusinessException(actionName + "操作需要审计原因");
        }
        return reason;
    }

    private void requireAuditEvidence(FlowDesignerOperationDTO operation, String actionName) {
        if (operation == null || operation.getImpactScope() == null || operation.getImpactScope().isBlank()) {
            throw new BusinessException(actionName + "操作需要影响范围");
        }
        if (operation.getRollbackPlan() == null || operation.getRollbackPlan().isBlank()) {
            throw new BusinessException(actionName + "操作需要回滚预案");
        }
    }

    private WorkflowDefinitionDTO toDto(WorkflowDefinition definition, WorkflowTemplate template) {
        WorkflowDefinitionDTO dto = new WorkflowDefinitionDTO();
        dto.setBusinessType(template.businessType());
        dto.setName(template.name());
        dto.setDescription(template.description());
        dto.setDefinition(defaultDefinition(template));
        dto.setStatus("UNCONFIGURED");
        dto.setVersion(0);

        if (definition == null) {
            return dto;
        }

        dto.setId(definition.getId());
        dto.setName(definition.getName());
        dto.setDescription(definition.getDescription());
        dto.setDefinition(fromJson(definition.getDefinitionJson(), defaultDefinition(template)));
        dto.setStatus(definition.getStatus());
        dto.setVersion(definition.getVersion());
        dto.setUpdatedBy(definition.getUpdatedBy());
        dto.setPublishedBy(definition.getPublishedBy());
        dto.setPublishedAt(definition.getPublishedAt());
        dto.setCreateTime(definition.getCreateTime());
        dto.setUpdateTime(definition.getUpdateTime());
        return dto;
    }

    private void validateDefinition(WorkflowDefinition definition) {
        Map<String, Object> parsed = fromJson(definition.getDefinitionJson(), Map.of());
        FlowDesignerValidationResultDTO result = validateDefinitionMap(parsed);
        if (!result.isValid()) {
            throw new BusinessException("流程图校验失败：" + String.join("；", result.getErrors()));
        }
    }

    private FlowDesignerValidationResultDTO validateDefinitionMap(Map<String, Object> definition) {
        FlowDesignerValidationResultDTO result = new FlowDesignerValidationResultDTO();
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Object nodesObject = definition.get("nodes");
        Object edgesObject = definition.get("edges");

        if (!(nodesObject instanceof List<?> nodes) || nodes.isEmpty()) {
            errors.add("流程图不能为空，至少需要开始节点和结束节点");
            result.setErrors(errors);
            result.setWarnings(warnings);
            result.setValid(false);
            return result;
        }
        List<?> edges = edgesObject instanceof List<?> edgeList ? edgeList : List.of();
        result.setNodeCount(nodes.size());
        result.setEdgeCount(edges.size());

        Set<String> nodeIds = new HashSet<>();
        Set<String> duplicateIds = new HashSet<>();
        Set<String> incidentNodeIds = new HashSet<>();
        int startCount = 0;
        int endCount = 0;

        for (Object nodeObject : nodes) {
            if (!(nodeObject instanceof Map<?, ?> node)) {
                errors.add("节点必须是对象结构");
                continue;
            }
            String id = textValue(node.get("id"));
            String type = normalizeNodeType(node.get("type"));
            if (id.isBlank()) {
                errors.add("节点 ID 不能为空");
                continue;
            }
            if (!nodeIds.add(id)) {
                duplicateIds.add(id);
            }
            if (type.isBlank() || !ALLOWED_NODE_TYPES.contains(type)) {
                errors.add("非法节点类型: " + (type.isBlank() ? id : type));
            }
            if ("START".equals(type) || "START_EVENT".equals(type)) {
                startCount++;
            }
            if ("END".equals(type) || "END_EVENT".equals(type)) {
                endCount++;
            }
        }

        duplicateIds.forEach(id -> errors.add("节点 ID 重复: " + id));
        if (startCount == 0) {
            errors.add("流程图必须包含开始节点");
        }
        if (endCount == 0) {
            errors.add("流程图必须包含结束节点");
        }

        for (Object edgeObject : edges) {
            if (!(edgeObject instanceof Map<?, ?> edge)) {
                errors.add("连线必须是对象结构");
                continue;
            }
            String source = textValue(edge.get("source"));
            String target = textValue(edge.get("target"));
            if (source.isBlank() || target.isBlank()) {
                errors.add("连线 source/target 不能为空");
                continue;
            }
            if (!nodeIds.contains(source)) {
                errors.add("连线 source 不存在: " + source);
            }
            if (!nodeIds.contains(target)) {
                errors.add("连线 target 不存在: " + target);
            }
            incidentNodeIds.add(source);
            incidentNodeIds.add(target);
        }

        for (String nodeId : nodeIds) {
            if (!incidentNodeIds.contains(nodeId)) {
                errors.add("存在孤立节点: " + nodeId);
            }
        }

        result.setErrors(errors);
        result.setWarnings(warnings);
        result.setValid(errors.isEmpty());
        return result;
    }

    private Map<String, Object> toDefinitionMap(FlowDesignerGraphDTO graph) {
        Map<String, Object> definition = new LinkedHashMap<>();
        if (graph == null) {
            definition.put("nodes", List.of());
            definition.put("edges", List.of());
            return definition;
        }
        definition.put("id", graph.getId());
        definition.put("name", graph.getName());
        definition.put("description", graph.getDescription());
        definition.put("nodes", graph.getNodes() == null ? List.of() : graph.getNodes().stream().map(this::toNodeMap).toList());
        definition.put("edges", graph.getEdges() == null ? List.of() : graph.getEdges().stream().map(this::toEdgeMap).toList());
        return definition;
    }

    private Map<String, Object> toNodeMap(FlowDesignerGraphDTO.NodeDTO node) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", node.getId());
        map.put("type", normalizeNodeType(node.getType()));
        map.put("label", node.getLabel());
        if (node.getConfig() != null) {
            map.put("config", node.getConfig());
        }
        return map;
    }

    private Map<String, Object> toEdgeMap(FlowDesignerGraphDTO.EdgeDTO edge) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", edge.getId());
        map.put("source", edge.getSource());
        map.put("target", edge.getTarget());
        map.put("label", edge.getLabel());
        return map;
    }

    private String normalizeNodeType(Object value) {
        return textValue(value).trim().toUpperCase().replace('-', '_');
    }

    private String textValue(Object value) {
        return Objects.toString(value, "").trim();
    }

    private void insertVersionSnapshot(String tenantId,
                                       WorkflowDefinition definition,
                                       String actionType,
                                       String reason,
                                       FlowDesignerOperationDTO operation,
                                       Integer rollbackSourceVersion) {
        String publishNote = firstPresent(operation == null ? null : operation.getPublishNote(), reason);
        jdbcTemplate.update("""
                        INSERT INTO workflow_definition_version (
                            tenant_id, definition_id, business_type, version, action_type, status,
                            name, description, definition_json, publish_note, impact_scope, rollback_plan,
                            rollback_source_version, operator_id, published_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                tenantId,
                definition.getId(),
                definition.getBusinessType(),
                definition.getVersion(),
                actionType,
                definition.getStatus(),
                definition.getName(),
                definition.getDescription(),
                definition.getDefinitionJson(),
                publishNote,
                operation == null ? null : operation.getImpactScope(),
                operation == null ? null : operation.getRollbackPlan(),
                rollbackSourceVersion,
                definition.getPublishedBy(),
                definition.getPublishedAt());
    }

    private WorkflowDefinitionVersion requireVersion(String tenantId, String businessType, Integer version) {
        if (version == null || version <= 0) {
            throw new BusinessException("版本号不合法");
        }
        return queryVersions(tenantId, businessType, version).stream()
                .findFirst()
                .orElseThrow(() -> new BusinessException("流程版本不存在"));
    }

    private List<WorkflowDefinitionVersion> queryVersions(String tenantId, String businessType, Integer version) {
        String sql = """
                SELECT id, tenant_id, definition_id, business_type, version, action_type, status,
                       name, description, definition_json, publish_note, impact_scope, rollback_plan,
                       rollback_source_version, operator_id, published_at, create_time
                FROM workflow_definition_version
                WHERE tenant_id = ? AND business_type = ?
                """ + (version == null ? "ORDER BY version DESC, id DESC" : "AND version = ? ORDER BY id DESC LIMIT 1");
        if (version == null) {
            return jdbcTemplate.query(sql, versionRowMapper(), tenantId, businessType);
        }
        return jdbcTemplate.query(sql, versionRowMapper(), tenantId, businessType, version);
    }

    private RowMapper<WorkflowDefinitionVersion> versionRowMapper() {
        return this::mapVersion;
    }

    private WorkflowDefinitionVersion mapVersion(ResultSet rs, int rowNum) throws SQLException {
        WorkflowDefinitionVersion version = new WorkflowDefinitionVersion();
        version.setId(rs.getLong("id"));
        version.setTenantId(rs.getString("tenant_id"));
        version.setDefinitionId(rs.getLong("definition_id"));
        version.setBusinessType(rs.getString("business_type"));
        version.setVersion(rs.getInt("version"));
        version.setActionType(rs.getString("action_type"));
        version.setStatus(rs.getString("status"));
        version.setName(rs.getString("name"));
        version.setDescription(rs.getString("description"));
        version.setDefinitionJson(rs.getString("definition_json"));
        version.setPublishNote(rs.getString("publish_note"));
        version.setImpactScope(rs.getString("impact_scope"));
        version.setRollbackPlan(rs.getString("rollback_plan"));
        Object rollbackSourceVersion = rs.getObject("rollback_source_version");
        version.setRollbackSourceVersion(rollbackSourceVersion instanceof Number number ? number.intValue() : null);
        version.setOperatorId(rs.getLong("operator_id"));
        version.setPublishedAt(rs.getTimestamp("published_at").toLocalDateTime());
        version.setCreateTime(rs.getTimestamp("create_time").toLocalDateTime());
        return version;
    }

    private WorkflowDefinitionVersionDTO toVersionDto(WorkflowDefinitionVersion version) {
        WorkflowDefinitionVersionDTO dto = new WorkflowDefinitionVersionDTO();
        dto.setId(version.getId());
        dto.setDefinitionId(version.getDefinitionId());
        dto.setBusinessType(version.getBusinessType());
        dto.setVersion(version.getVersion());
        dto.setActionType(version.getActionType());
        dto.setStatus(version.getStatus());
        dto.setName(version.getName());
        dto.setDescription(version.getDescription());
        dto.setDefinition(fromJson(version.getDefinitionJson(), Map.of()));
        dto.setPublishNote(version.getPublishNote());
        dto.setImpactScope(version.getImpactScope());
        dto.setRollbackPlan(version.getRollbackPlan());
        dto.setRollbackSourceVersion(version.getRollbackSourceVersion());
        dto.setOperatorId(version.getOperatorId());
        dto.setPublishedAt(version.getPublishedAt());
        dto.setCreateTime(version.getCreateTime());
        return dto;
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

    private Map<String, Object> defaultDefinition(WorkflowTemplate template) {
        Map<String, Object> definition = new LinkedHashMap<>();
        definition.put("id", "WF-" + template.businessType());
        definition.put("name", template.name());
        definition.put("description", template.description());
        definition.put("nodes", List.of());
        definition.put("edges", List.of());
        return definition;
    }

    private String firstPresent(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private record WorkflowTemplate(String businessType, String name, String description) {
    }
}
