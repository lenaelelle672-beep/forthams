package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.entity.WorkflowDefinition;
import com.ams.entity.User;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.mapper.WorkflowDefinitionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class WorkflowDefinitionService {

    private static final Set<String> NODE_TYPES = Set.of("start", "approval", "condition", "end");
    private static final Set<String> APPROVAL_MODES = Set.of("sequence", "all", "any");
    private static final Pattern CONDITION_PATTERN = Pattern.compile("^(.+?)\\s*(>=|<=|==|!=|>|<)\\s*(.+)$");
    private static final Map<String, List<String>> CONDITION_FIELD_ALIASES = Map.ofEntries(
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

    private static final List<WorkflowTemplate> TEMPLATES = List.of(
            new WorkflowTemplate("ASSET_TRANSFER", "资产转移流程", "用于资产转出、转入确认及双方部门资产管理员审批。", 4),
            new WorkflowTemplate("ASSET_CLEARANCE", "资产清退流程", "用于闲置资产清退、部门审批、库房确认及 IT 审核。", 4),
            new WorkflowTemplate("ASSET_SCRAP", "资产报废转让流程", "用于资产报废转让多级审批、收款确认与核算归档。", 9),
            new WorkflowTemplate("ASSET_COMPENSATION", "资产赔偿流程", "用于资产损失赔偿、信息安全审批、财务审批与库房接收。", 7)
    );

    private final WorkflowDefinitionMapper workflowDefinitionMapper;
    private final UserRoleMapper userRoleMapper;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;

    /** 审批节点运行时信息，包含审批人类型（role/user）和标识 */
    public record WorkflowApprovalNode(
            int stepNo,
            String nodeId,
            String nodeCode,
            String label,
            String approverRole,
            String approvalMode,
            String approverType,
            String approverId
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
            WorkflowRuntimePlan plan = buildRuntimePlan(parsed, businessData);
            return plan.approvalNodes().isEmpty() ? fallbackRuntimePlan(fallbackApprovalStepCount) : plan;
        } catch (BusinessException ex) {
            return fallbackRuntimePlan(fallbackApprovalStepCount);
        }
    }

    public WorkflowRuntimePlan requirePublishedRuntimePlan(String businessType, String businessData) {
        WorkflowDefinition definition = requirePublishedDefinition(businessType);
        return requireRuntimePlan(definition.getDefinitionJson(), businessData);
    }

    public WorkflowRuntimePlan requireRuntimePlan(String definitionJson, String businessData) {
        Map<String, Object> parsed = fromJsonStrict(definitionJson, "流程定义解析失败");
        WorkflowRuntimePlan plan = buildRuntimePlan(parsed, businessData);
        if (plan.approvalNodes().isEmpty()) {
            throw new BusinessException("流程运行路径未解析到审批节点");
        }
        return plan;
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO saveDraft(String businessType, WorkflowDefinitionSaveDTO dto) {
        if (dto == null) {
            dto = new WorkflowDefinitionSaveDTO();
        }
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        WorkflowDefinition definition = findDefinition(tenantId, businessType);

        if (definition == null) {
            definition = new WorkflowDefinition();
            definition.setTenantId(tenantId);
            definition.setBusinessType(businessType);
            definition.setStatus("DRAFT");
            definition.setVersion(0);
        } else if ("PUBLISHED".equals(definition.getStatus())) {
            definition.setStatus("DRAFT");
        }

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
    public WorkflowDefinitionDTO publish(String businessType, Long operatorId) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        WorkflowDefinition definition = findDefinition(tenantId, businessType);

        if (definition == null) {
            WorkflowDefinitionSaveDTO dto = new WorkflowDefinitionSaveDTO();
            dto.setName(template.name());
            dto.setDescription(template.description());
            dto.setDefinition(defaultDefinition(template));
            dto.setOperatorId(operatorId);
            saveDraft(businessType, dto);
            definition = findDefinition(tenantId, businessType);
        }

        validateDefinition(definition);
        definition.setStatus("PUBLISHED");
        definition.setVersion((definition.getVersion() == null ? 0 : definition.getVersion()) + 1);
        definition.setPublishedBy(operatorId);
        definition.setPublishedAt(LocalDateTime.now());
        definition.setUpdatedBy(operatorId);
        workflowDefinitionMapper.updateById(definition);
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
        validateDefinitionMap(parsed, definition.getBusinessType());
    }

    @SuppressWarnings("unchecked")
    private void validateDefinitionMap(Map<String, Object> definition, String businessType) {
        requireText(definition.get("id"), "流程定义ID不能为空");
        requireText(definition.get("name"), "流程名称不能为空");
        requireText(definition.get("description"), "流程说明不能为空");

        Object definitionBusinessType = definition.get("businessType");
        if (definitionBusinessType != null && !businessType.equals(String.valueOf(definitionBusinessType))) {
            throw new BusinessException("流程定义业务类型与当前发布类型不一致");
        }

        Object nodes = definition.get("nodes");
        if (!(nodes instanceof List<?> nodeList) || nodeList.isEmpty()) {
            throw new BusinessException("流程定义至少需要一个节点");
        }

        Object edges = definition.get("edges");
        if (!(edges instanceof List<?> edgeList)) {
            throw new BusinessException("流程定义连线列表不能为空");
        }

        Map<String, Map<String, Object>> nodeById = new HashMap<>();
        int startCount = 0;
        int approvalCount = 0;
        int endCount = 0;
        for (Object item : nodeList) {
            if (!(item instanceof Map<?, ?> rawNode)) {
                throw new BusinessException("流程节点格式无效");
            }
            Map<String, Object> node = (Map<String, Object>) rawNode;
            String id = requireText(node.get("id"), "流程节点ID不能为空");
            if (nodeById.containsKey(id)) {
                throw new BusinessException("流程节点ID重复: " + id);
            }
            String type = requireText(node.get("type"), "流程节点类型不能为空");
            if (!NODE_TYPES.contains(type)) {
                throw new BusinessException("不支持的流程节点类型: " + type);
            }

            validateNodeFields(node, type, id);
            nodeById.put(id, node);
            if ("start".equals(type)) {
                startCount++;
            } else if ("approval".equals(type)) {
                approvalCount++;
            } else if ("end".equals(type)) {
                endCount++;
            }
        }

        if (startCount != 1) {
            throw new BusinessException("流程必须且只能包含一个开始节点");
        }
        if (approvalCount == 0) {
            throw new BusinessException("流程至少需要一个审批节点");
        }
        if (endCount != 1) {
            throw new BusinessException("流程必须且只能包含一个结束节点");
        }

        validateEdges(edgeList, nodeById);
    }

    @SuppressWarnings("unchecked")
    private void validateNodeFields(Map<String, Object> node, String type, String id) {
        Object position = node.get("position");
        if (!(position instanceof Map<?, ?> rawPosition)) {
            throw new BusinessException("节点" + id + "缺少坐标信息");
        }
        requireNumber(rawPosition.get("x"), "节点" + id + "坐标x不能为空");
        requireNumber(rawPosition.get("y"), "节点" + id + "坐标y不能为空");

        Object data = node.get("data");
        if (!(data instanceof Map<?, ?> rawData)) {
            throw new BusinessException("节点" + id + "缺少配置数据");
        }
        Map<String, Object> nodeData = (Map<String, Object>) rawData;
        String dataType = requireText(nodeData.get("type"), "节点" + id + "数据类型不能为空");
        if (!type.equals(dataType)) {
            throw new BusinessException("节点" + id + "的类型与数据类型不一致");
        }
        requireText(nodeData.get("label"), "节点" + id + "名称不能为空");
        requireText(nodeData.get("description"), "节点" + id + "说明不能为空");
        requireText(nodeData.get("nodeCode"), "节点" + id + "编码不能为空");

        if ("start".equals(type)) {
            requireText(nodeData.get("triggerType"), "开始节点触发方式不能为空");
        }
        if ("approval".equals(type)) {
            String approverType = textValue(nodeData.get("approverType"));
            if ("user".equals(approverType)) {
                String approverIdStr = textValue(nodeData.get("approverId"));
                validateApproverUser(approverIdStr, id);
            } else {
                String approverRole = requireText(nodeData.get("approverRole"), "审批节点审批角色不能为空");
                validateApproverRole(approverRole, id);
                String approvalMode = requireText(nodeData.get("approvalMode"), "审批节点审批模式不能为空");
                if (!APPROVAL_MODES.contains(approvalMode)) {
                    throw new BusinessException("审批节点审批模式仅支持 sequence/all/any");
                }
            }
        }
        if ("condition".equals(type)) {
            requireText(nodeData.get("conditionExpression"), "条件节点表达式不能为空");
            requireText(nodeData.get("trueLabel"), "条件节点满足标签不能为空");
            requireText(nodeData.get("falseLabel"), "条件节点不满足标签不能为空");
        }
        if ("end".equals(type)) {
            requireText(nodeData.get("resultAction"), "结束节点动作不能为空");
        }
    }

    @SuppressWarnings("unchecked")
    private void validateEdges(List<?> edgeList, Map<String, Map<String, Object>> nodeById) {
        Map<String, Integer> incomingCounts = new HashMap<>();
        Map<String, Integer> outgoingCounts = new HashMap<>();
        Set<String> edgeIds = new HashSet<>();
        Set<String> conditionTrueSources = new HashSet<>();
        Set<String> conditionFalseSources = new HashSet<>();
        Map<String, List<String>> adjacency = new HashMap<>();

        for (Object item : edgeList) {
            if (!(item instanceof Map<?, ?> rawEdge)) {
                throw new BusinessException("流程连线格式无效");
            }
            Map<String, Object> edge = (Map<String, Object>) rawEdge;
            String id = requireText(edge.get("id"), "流程连线ID不能为空");
            if (!edgeIds.add(id)) {
                throw new BusinessException("流程连线ID重复: " + id);
            }
            String source = requireText(edge.get("source"), "流程连线来源不能为空");
            String target = requireText(edge.get("target"), "流程连线目标不能为空");
            requireText(edge.get("type"), "流程连线类型不能为空");
            Object animated = edge.get("animated");
            if (animated != null && !(animated instanceof Boolean)) {
                throw new BusinessException("流程连线动画字段必须为布尔值");
            }
            validateOptionalEdgeStyle(edge, id);

            Map<String, Object> sourceNode = nodeById.get(source);
            Map<String, Object> targetNode = nodeById.get(target);
            if (sourceNode == null) {
                throw new BusinessException("流程连线来源节点不存在: " + source);
            }
            if (targetNode == null) {
                throw new BusinessException("流程连线目标节点不存在: " + target);
            }
            if ("end".equals(sourceNode.get("type"))) {
                throw new BusinessException("结束节点不能作为连线来源");
            }
            if ("start".equals(targetNode.get("type"))) {
                throw new BusinessException("开始节点不能作为连线目标");
            }

            Object sourceHandle = edge.get("sourceHandle");
            if ("condition".equals(sourceNode.get("type"))) {
                String handle = String.valueOf(sourceHandle);
                if (!"condition-true".equals(handle) && !"condition-false".equals(handle)) {
                    throw new BusinessException("条件节点连线必须使用满足或不满足出口");
                }
                if ("condition-true".equals(handle)) {
                    conditionTrueSources.add(source);
                } else {
                    conditionFalseSources.add(source);
                }
            }

            incomingCounts.merge(target, 1, Integer::sum);
            outgoingCounts.merge(source, 1, Integer::sum);
            adjacency.computeIfAbsent(source, ignored -> new ArrayList<>()).add(target);
        }

        String startNodeId = null;
        for (Map.Entry<String, Map<String, Object>> entry : nodeById.entrySet()) {
            String nodeId = entry.getKey();
            String type = String.valueOf(entry.getValue().get("type"));
            if ("start".equals(type)) {
                startNodeId = nodeId;
                if (incomingCounts.getOrDefault(nodeId, 0) > 0) {
                    throw new BusinessException("开始节点不能有入线");
                }
            } else if (incomingCounts.getOrDefault(nodeId, 0) == 0) {
                throw new BusinessException("节点" + nodeId + "缺少入线");
            }

            if ("end".equals(type)) {
                if (outgoingCounts.getOrDefault(nodeId, 0) > 0) {
                    throw new BusinessException("结束节点不能有出线");
                }
            } else if (outgoingCounts.getOrDefault(nodeId, 0) == 0) {
                throw new BusinessException("节点" + nodeId + "缺少出线");
            }

            if ("condition".equals(type)) {
                if (!conditionTrueSources.contains(nodeId) || !conditionFalseSources.contains(nodeId)) {
                    throw new BusinessException("条件节点必须同时配置满足和不满足两条分支");
                }
            }
        }

        validateReachability(startNodeId, nodeById.keySet(), adjacency);
    }

    @SuppressWarnings("unchecked")
    private void validateOptionalEdgeStyle(Map<String, Object> edge, String id) {
        Object markerEnd = edge.get("markerEnd");
        if (markerEnd != null) {
            if (!(markerEnd instanceof Map<?, ?> rawMarkerEnd)) {
                throw new BusinessException("流程连线" + id + "箭头配置无效");
            }
            requireText(rawMarkerEnd.get("type"), "流程连线" + id + "箭头类型不能为空");
            requireText(rawMarkerEnd.get("color"), "流程连线" + id + "箭头颜色不能为空");
        }

        Object style = edge.get("style");
        if (style != null) {
            if (!(style instanceof Map<?, ?> rawStyle)) {
                throw new BusinessException("流程连线" + id + "样式配置无效");
            }
            requireText(rawStyle.get("stroke"), "流程连线" + id + "颜色不能为空");
            requireNumber(rawStyle.get("strokeWidth"), "流程连线" + id + "线宽不能为空");
        }

        Object labelStyle = edge.get("labelStyle");
        if (labelStyle != null) {
            if (!(labelStyle instanceof Map<?, ?> rawLabelStyle)) {
                throw new BusinessException("流程连线" + id + "标签样式配置无效");
            }
            requireText(rawLabelStyle.get("fill"), "流程连线" + id + "标签颜色不能为空");
            requireNumber(rawLabelStyle.get("fontSize"), "流程连线" + id + "标签字号不能为空");
            requireNumber(rawLabelStyle.get("fontWeight"), "流程连线" + id + "标签字重不能为空");
        }

        Object labelBgStyle = edge.get("labelBgStyle");
        if (labelBgStyle != null) {
            if (!(labelBgStyle instanceof Map<?, ?> rawLabelBgStyle)) {
                throw new BusinessException("流程连线" + id + "标签背景配置无效");
            }
            requireText(rawLabelBgStyle.get("fill"), "流程连线" + id + "标签背景颜色不能为空");
            requireNumber(rawLabelBgStyle.get("fillOpacity"), "流程连线" + id + "标签背景透明度不能为空");
        }
    }

    private void validateApproverRole(String approverRole, String nodeId) {
        if (userRoleMapper == null) {
            return;
        }
        // 首先校验角色本身是否存在于启用角色表中
        int roleCount = userRoleMapper.countActiveByRoleCode(approverRole);
        if (roleCount == 0) {
            throw new BusinessException("节点" + nodeId + "审批角色不存在或已禁用: " + approverRole);
        }
        // 再校验该角色是否至少关联一个启用用户
        List<Long> approverIds = userRoleMapper.selectActiveUserIdsByRole(approverRole);
        if (approverIds == null || approverIds.isEmpty()) {
            throw new BusinessException("节点" + nodeId + "审批角色未配置有效审批人: " + approverRole);
        }
    }

    /** 校验 approverType=user 时 approverId 指向有效用户 */
    private void validateApproverUser(String approverId, String nodeId) {
        if (approverId == null || approverId.isBlank()) {
            throw new BusinessException("节点" + nodeId + "指定用户审批时审批人ID不能为空");
        }
        long userId;
        try {
            userId = Long.parseLong(approverId.trim());
        } catch (NumberFormatException ex) {
            throw new BusinessException("节点" + nodeId + "审批人ID格式无效: " + approverId);
        }
        if (userMapper != null) {
            User user = userMapper.selectById(userId);
            if (user == null || (user.getStatus() != null && user.getStatus() != 1)) {
                throw new BusinessException("节点" + nodeId + "审批人不存在或已禁用: userId=" + userId);
            }
        }
    }

    private void validateReachability(String startNodeId, Set<String> nodeIds, Map<String, List<String>> adjacency) {
        if (startNodeId == null) {
            throw new BusinessException("流程必须包含开始节点");
        }
        Set<String> visited = new HashSet<>();
        ArrayDeque<String> queue = new ArrayDeque<>();
        queue.add(startNodeId);
        while (!queue.isEmpty()) {
            String current = queue.removeFirst();
            if (!visited.add(current)) {
                continue;
            }
            for (String next : adjacency.getOrDefault(current, List.of())) {
                if (!visited.contains(next)) {
                    queue.add(next);
                }
            }
        }
        if (!visited.containsAll(nodeIds)) {
            throw new BusinessException("流程存在未从开始节点连通的节点");
        }
    }

    private String requireText(Object value, String message) {
        if (value == null || String.valueOf(value).isBlank()) {
            throw new BusinessException(message);
        }
        return String.valueOf(value);
    }

    private String textValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private void requireNumber(Object value, String message) {
        if (!(value instanceof Number)) {
            throw new BusinessException(message);
        }
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

    @SuppressWarnings("unchecked")
    private WorkflowRuntimePlan buildRuntimePlan(Map<String, Object> definition, String businessData) {
        if (!(definition.get("nodes") instanceof List<?> nodeList)) {
            return new WorkflowRuntimePlan(List.of(), "");
        }

        Map<String, Map<String, Object>> nodeById = new LinkedHashMap<>();
        String startNodeId = null;
        for (Object item : nodeList) {
            if (!(item instanceof Map<?, ?> rawNode)) {
                continue;
            }
            Map<String, Object> node = (Map<String, Object>) rawNode;
            String id = textValue(node.get("id"));
            if (id.isEmpty()) {
                continue;
            }
            nodeById.put(id, node);
            if ("start".equals(nodeType(node))) {
                startNodeId = id;
            }
        }

        Map<String, List<Map<String, Object>>> edgesBySource = new LinkedHashMap<>();
        if (definition.get("edges") instanceof List<?> edgeList) {
            for (Object item : edgeList) {
                if (!(item instanceof Map<?, ?> rawEdge)) {
                    continue;
                }
                Map<String, Object> edge = (Map<String, Object>) rawEdge;
                String source = textValue(edge.get("source"));
                if (!source.isEmpty()) {
                    edgesBySource.computeIfAbsent(source, ignored -> new ArrayList<>()).add(edge);
                }
            }
        }

        Map<String, Object> context = fromJson(businessData, Map.of());
        List<WorkflowApprovalNode> approvalNodes = new ArrayList<>();
        String resultAction = "";
        String currentNodeId = startNodeId;
        Set<String> visited = new HashSet<>();
        int guard = 0;
        int maxSteps = Math.max(1, nodeById.size() + edgesBySource.values().stream().mapToInt(List::size).sum() + 1);

        while (currentNodeId != null && nodeById.containsKey(currentNodeId)) {
            if (++guard > maxSteps || !visited.add(currentNodeId)) {
                throw new BusinessException("流程定义存在循环，无法执行");
            }

            Map<String, Object> node = nodeById.get(currentNodeId);
            Map<String, Object> data = nodeData(node);
            String type = nodeType(node);
            if ("approval".equals(type)) {
                String nodeApproverType = textValue(data.get("approverType"));
                String nodeApproverId = textValue(data.get("approverId"));
                approvalNodes.add(new WorkflowApprovalNode(
                        approvalNodes.size() + 1,
                        currentNodeId,
                        textValue(data.get("nodeCode")),
                        textValue(data.get("label")),
                        textValue(data.get("approverRole")),
                        firstPresent(textValue(data.get("approvalMode")), "sequence"),
                        "user".equals(nodeApproverType) ? "user" : "role",
                        "user".equals(nodeApproverType) ? nodeApproverId : ""
                ));
            } else if ("end".equals(type)) {
                resultAction = textValue(data.get("resultAction"));
                break;
            }

            List<Map<String, Object>> outgoingEdges = edgesBySource.getOrDefault(currentNodeId, List.of());
            if ("condition".equals(type)) {
                boolean matched = evaluateCondition(textValue(data.get("conditionExpression")), context);
                currentNodeId = conditionTarget(outgoingEdges, matched);
            } else {
                currentNodeId = firstTarget(outgoingEdges);
            }
        }

        return new WorkflowRuntimePlan(approvalNodes, resultAction);
    }

    private WorkflowRuntimePlan fallbackRuntimePlan(int fallbackApprovalStepCount) {
        List<WorkflowApprovalNode> approvalNodes = new ArrayList<>();
        for (int index = 1; index <= Math.max(0, fallbackApprovalStepCount); index++) {
            approvalNodes.add(new WorkflowApprovalNode(index, "fallback-" + index, "FALLBACK_" + index,
                    "第" + index + "级审批", "", "sequence", "role", ""));
        }
        return new WorkflowRuntimePlan(approvalNodes, "");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> nodeData(Map<String, Object> node) {
        Object data = node.get("data");
        return data instanceof Map<?, ?> rawData ? (Map<String, Object>) rawData : Map.of();
    }

    private String nodeType(Map<String, Object> node) {
        String type = textValue(node.get("type"));
        if (type.isEmpty()) {
            type = textValue(nodeData(node).get("type"));
        }
        return type;
    }

    private String firstTarget(List<Map<String, Object>> edges) {
        if (edges == null || edges.isEmpty()) {
            return null;
        }
        String target = textValue(edges.get(0).get("target"));
        return target.isEmpty() ? null : target;
    }

    private String conditionTarget(List<Map<String, Object>> edges, boolean matched) {
        String expectedHandle = matched ? "condition-true" : "condition-false";
        for (Map<String, Object> edge : edges) {
            if (expectedHandle.equals(textValue(edge.get("sourceHandle")))) {
                String target = textValue(edge.get("target"));
                return target.isEmpty() ? null : target;
            }
        }
        return firstTarget(edges);
    }

    private boolean evaluateCondition(String expression, Map<String, Object> context) {
        String text = textValue(expression);
        if (text.isEmpty()) {
            return false;
        }
        if ("true".equalsIgnoreCase(text) || "是".equals(text) || "满足".equals(text)) {
            return true;
        }
        if ("false".equalsIgnoreCase(text) || "否".equals(text) || "不满足".equals(text)) {
            return false;
        }

        Matcher matcher = CONDITION_PATTERN.matcher(text);
        if (!matcher.matches()) {
            return truthy(resolveConditionValue(text, context));
        }

        Object left = resolveConditionValue(matcher.group(1), context);
        Object right = parseConditionLiteral(matcher.group(3));
        if (right == null) {
            right = resolveConditionValue(matcher.group(3), context);
        }
        return compareConditionValues(left, matcher.group(2), right);
    }

    private Object resolveConditionValue(String token, Map<String, Object> context) {
        String key = textValue(token);
        if (key.isEmpty()) {
            return null;
        }
        List<String> candidates = CONDITION_FIELD_ALIASES.getOrDefault(key, List.of(key));
        for (String candidate : candidates) {
            Object value = readContextPath(context, candidate);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private Object readContextPath(Map<String, Object> context, String path) {
        Object current = context;
        for (String segment : path.split("\\.")) {
            if (!(current instanceof Map<?, ?> rawMap)) {
                return null;
            }
            current = ((Map<String, Object>) rawMap).get(segment);
            if (current == null) {
                return null;
            }
        }
        return current;
    }

    private Object parseConditionLiteral(String token) {
        String text = textValue(token);
        if (text.isEmpty()) {
            return null;
        }
        if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
            return text.substring(1, text.length() - 1);
        }
        if ("true".equalsIgnoreCase(text)) {
            return true;
        }
        if ("false".equalsIgnoreCase(text)) {
            return false;
        }
        if ("null".equalsIgnoreCase(text)) {
            return null;
        }
        try {
            return new BigDecimal(text);
        } catch (NumberFormatException ex) {
            return text;
        }
    }

    private boolean compareConditionValues(Object left, String operator, Object right) {
        if (left == null || right == null) {
            return "==".equals(operator) ? left == right : "!=".equals(operator) && left != right;
        }

        BigDecimal leftNumber = toBigDecimal(left);
        BigDecimal rightNumber = toBigDecimal(right);
        if (leftNumber != null && rightNumber != null) {
            int compared = leftNumber.compareTo(rightNumber);
            return switch (operator) {
                case ">" -> compared > 0;
                case ">=" -> compared >= 0;
                case "<" -> compared < 0;
                case "<=" -> compared <= 0;
                case "==" -> compared == 0;
                case "!=" -> compared != 0;
                default -> false;
            };
        }

        int compared = String.valueOf(left).compareTo(String.valueOf(right));
        return switch (operator) {
            case "==" -> compared == 0;
            case "!=" -> compared != 0;
            default -> false;
        };
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof Number number) {
            return new BigDecimal(number.toString());
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return new BigDecimal(text.trim());
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        return null;
    }

    private boolean truthy(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value instanceof Number number) {
            return new BigDecimal(number.toString()).compareTo(BigDecimal.ZERO) != 0;
        }
        if (value instanceof String text) {
            return !text.isBlank() && !"false".equalsIgnoreCase(text) && !"0".equals(text.trim());
        }
        return value != null;
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

    private Map<String, Object> defaultDefinition(WorkflowTemplate template) {
        Map<String, Object> definition = new LinkedHashMap<>();
        definition.put("id", "WF-" + template.businessType());
        definition.put("name", template.name());
        definition.put("description", template.description());
        definition.put("businessType", template.businessType());

        List<Map<String, Object>> nodes = new java.util.ArrayList<>();
        List<Map<String, Object>> edges = new java.util.ArrayList<>();
        nodes.add(defaultNode("start-1", "start", 320, 40, "提交申请", "业务表单提交后进入审批流程"));

        String previousNodeId = "start-1";
        for (int index = 1; index <= template.approvalStepCount(); index++) {
            String nodeId = "approval-" + index;
            nodes.add(defaultNode(nodeId, "approval", 320, 40 + index * 150,
                    "第" + index + "级审批", "由流程设计器配置的第" + index + "级审批人处理"));
            edges.add(defaultEdge("edge-" + previousNodeId + "-" + nodeId, previousNodeId, nodeId));
            previousNodeId = nodeId;
        }

        nodes.add(defaultNode("end-1", "end", 320, 40 + (template.approvalStepCount() + 1) * 150,
                "流程结束", "审批通过后执行业务落库并归档"));
        edges.add(defaultEdge("edge-" + previousNodeId + "-end-1", previousNodeId, "end-1"));

        definition.put("nodes", nodes);
        definition.put("edges", edges);
        return definition;
    }

    private Map<String, Object> defaultNode(String id, String type, int x, int y, String label, String description) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("type", type);
        data.put("label", label);
        data.put("description", description);
        data.put("nodeCode", id.toUpperCase().replace('-', '_'));
        data.put("triggerType", "start".equals(type) ? "表单提交" : "");
        data.put("approverRole", "approval".equals(type) ? "SUPER_ADMIN" : "");
        data.put("approvalMode", "sequence");
        data.put("conditionExpression", "");
        data.put("trueLabel", "");
        data.put("falseLabel", "");
        data.put("resultAction", "end".equals(type) ? "审批完成并同步业务状态" : "");

        Map<String, Object> position = new LinkedHashMap<>();
        position.put("x", x);
        position.put("y", y);

        Map<String, Object> node = new LinkedHashMap<>();
        node.put("id", id);
        node.put("type", type);
        node.put("position", position);
        node.put("data", data);
        return node;
    }

    private Map<String, Object> defaultEdge(String id, String source, String target) {
        Map<String, Object> edge = new LinkedHashMap<>();
        edge.put("id", id);
        edge.put("source", source);
        edge.put("target", target);
        edge.put("sourceHandle", null);
        edge.put("targetHandle", null);
        edge.put("type", "smoothstep");
        edge.put("animated", true);
        edge.put("label", null);
        edge.put("markerEnd", Map.of("type", "arrowclosed", "color", "var(--color-primary)"));
        edge.put("style", Map.of("stroke", "var(--color-primary)", "strokeWidth", 2));
        edge.put("labelStyle", Map.of("fill", "var(--color-foreground)", "fontSize", 12, "fontWeight", 600));
        edge.put("labelBgStyle", Map.of("fill", "var(--workflow-surface)", "fillOpacity", 1));
        return edge;
    }

    private String firstPresent(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private record WorkflowTemplate(String businessType, String name, String description, int approvalStepCount) {
    }
}
