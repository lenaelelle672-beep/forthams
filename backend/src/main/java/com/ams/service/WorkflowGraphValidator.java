package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.User;
import com.ams.entity.WorkflowDefinition;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 工作流图结构验证器。
 *
 * <p>从 {@link WorkflowDefinitionService} 中提取的图验证逻辑，
 * 负责校验流程定义的节点类型、可达性、审批模式、条件节点表达式、连线合法性等。
 *
 * <p>条件节点表达式限制：
 * 仅支持简单表达式（字段名 操作符 值），不支持 AND/OR 复合条件。
 * 支持的操作符：>=、<=、==、!=、>、<
 * 示例：amount >= 1000、status == "PENDING"
 */
@Component
@RequiredArgsConstructor
public class WorkflowGraphValidator {

    private static final Logger log = LoggerFactory.getLogger(WorkflowGraphValidator.class);

    private static final Set<String> NODE_TYPES = Set.of("start", "approval", "task", "cc", "condition", "end");
    private static final Set<String> EXECUTABLE_NODE_TYPES = Set.of("approval", "task");
    private static final Set<String> APPROVAL_MODES = Set.of("sequence", "all", "any");
    private static final Pattern RECIPIENT_ROLE_PATTERN = Pattern.compile("^[A-Za-z0-9_.:-]+$");
    private static final Pattern RECIPIENT_USER_PATTERN = Pattern.compile("^\\d+$");
    private static final Pattern CONDITION_EXPRESSION_PATTERN =
            Pattern.compile("^[\\p{IsHan}A-Za-z0-9_.-]+\\s*(>=|<=|==|!=|>(?!=)|<(?!=))\\s*\\S.*$");
    private static final Pattern COMPOUND_CONDITION_PATTERN =
            Pattern.compile("(?i).*\\s+(AND|OR)(\\s+|$).*");
    private static final int MAX_FORM_SOURCE_LENGTH = 50_000;
    private static final int MAX_FORM_META_LENGTH = 1_000;

    @Nullable
    private final UserRoleMapper userRoleMapper;
    @Nullable
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;

    // ──────────────────────────────────────────────────────────────
    //  Public entry point
    // ──────────────────────────────────────────────────────────────

    /**
     * 验证工作流定义的合法性。
     *
     * <p>验证内容包括：节点类型、可达性、审批模式、条件节点表达式等。
     *
     * @param definition 工作流定义实体
     * @throws BusinessException 验证失败时抛出
     */
    public void validateDefinition(WorkflowDefinition definition) {
        Map<String, Object> parsed = fromJson(definition.getDefinitionJson(), Map.of());
        validateDefinitionMap(parsed, definition.getBusinessType());
    }

    // ──────────────────────────────────────────────────────────────
    //  Definition-level validation
    // ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public void validateDefinitionMap(Map<String, Object> definition, String businessType) {
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
        int executableCount = 0;
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
            } else if (EXECUTABLE_NODE_TYPES.contains(type)) {
                executableCount++;
            } else if ("end".equals(type)) {
                endCount++;
            }
        }

        if (startCount != 1) {
            throw new BusinessException("流程必须且只能包含一个开始节点");
        }
        if (executableCount == 0) {
            throw new BusinessException("流程至少需要一个审批或办理节点");
        }
        if (endCount != 1) {
            throw new BusinessException("流程必须且只能包含一个结束节点");
        }

        validateEdges(edgeList, nodeById);
    }

    // ──────────────────────────────────────────────────────────────
    //  Node field validation
    // ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public void validateNodeFields(Map<String, Object> node, String type, String id) {
        Object position = node.get("position");
        if (!(position instanceof Map<?, ?> rawPosition)) {
            log.info("节点{}缺少坐标信息，已注入默认坐标(320, 0)", id);
            Map<String, Object> defaultPosition = new HashMap<>();
            defaultPosition.put("x", 320);
            defaultPosition.put("y", 0);
            node.put("position", defaultPosition);
        } else {
            Map<String, Object> posMap = (Map<String, Object>) rawPosition;
            if (!(posMap.get("x") instanceof Number)) {
                posMap.put("x", 320);
            }
            if (!(posMap.get("y") instanceof Number)) {
                posMap.put("y", 0);
            }
        }

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
            validateNodeFormConfig(nodeData, id);
        }
        if ("approval".equals(type)) {
            validateNodeFormConfig(nodeData, id);
        }
        if (EXECUTABLE_NODE_TYPES.contains(type)) {
            String approverType = textValue(nodeData.get("approverType"));
            if ("user".equals(approverType)) {
                String approverIdStr = textValue(nodeData.get("approverId"));
                validateApproverUser(approverIdStr, id, "task".equals(type));
            } else {
                String approverRole = requireText(nodeData.get("approverRole"),
                        "task".equals(type) ? "办理节点办理角色不能为空" : "审批节点审批角色不能为空");
                validateApproverRole(approverRole, id);
            }
            String approvalMode = requireText(nodeData.get("approvalMode"),
                    "task".equals(type) ? "办理节点办理模式不能为空" : "审批节点审批模式不能为空");
            if (!APPROVAL_MODES.contains(approvalMode)) {
                throw new BusinessException(("task".equals(type) ? "办理节点办理模式" : "审批节点审批模式") + "仅支持 sequence/all/any");
            }
            validateOptionalCcRecipients(nodeData, id);
        }
        if ("cc".equals(type)) {
            validateCcRecipients(nodeData, id);
        }
        if ("condition".equals(type)) {
            String conditionExpression = requireText(nodeData.get("conditionExpression"), "条件节点表达式不能为空");
            validateConditionExpression(conditionExpression, id);
            requireText(nodeData.get("trueLabel"), "条件节点满足标签不能为空");
            requireText(nodeData.get("falseLabel"), "条件节点不满足标签不能为空");
        }
        if ("end".equals(type)) {
            requireText(nodeData.get("resultAction"), "结束节点动作不能为空");
        }
    }

    private void validateNodeFormConfig(Map<String, Object> nodeData, String id) {
        Object formSource = nodeData.get("formSource");
        if (!(formSource instanceof String source)) {
            throw new BusinessException("节点" + id + "环节子表单必须为字符串");
        }
        if (source.isBlank()) {
            throw new BusinessException("节点" + id + "必须配置环节子表单");
        }
        if (source.length() > MAX_FORM_SOURCE_LENGTH) {
            throw new BusinessException("节点" + id + "环节子表单不能超过" + MAX_FORM_SOURCE_LENGTH + "字符");
        }
        validateOptionalText(nodeData.get("formSectionName"), "节点" + id + "区段名称");
        validateOptionalText(nodeData.get("formSummaryFields"), "节点" + id + "历史摘要字段");
    }

    private void validateOptionalText(Object value, String fieldName) {
        if (value == null) {
            return;
        }
        if (!(value instanceof String text)) {
            throw new BusinessException(fieldName + "必须为字符串");
        }
        if (text.length() > MAX_FORM_META_LENGTH) {
            throw new BusinessException(fieldName + "不能超过" + MAX_FORM_META_LENGTH + "字符");
        }
    }

    private void validateCcRecipients(Map<String, Object> nodeData, String id) {
        validateCcRecipients(nodeData, id, true);
    }

    private void validateOptionalCcRecipients(Map<String, Object> nodeData, String id) {
        validateCcRecipients(nodeData, id, false);
    }

    private void validateCcRecipients(Map<String, Object> nodeData, String id, boolean required) {
        String ccRoleCodes = textValue(nodeData.get("ccRoleCodes"));
        String ccUserIds = textValue(nodeData.get("ccUserIds"));
        if (ccRoleCodes.isBlank() && ccUserIds.isBlank()) {
            if (required) {
                throw new BusinessException("抄送节点" + id + "必须配置抄送角色或抄送用户");
            }
            return;
        }
        for (String roleCode : splitCsv(ccRoleCodes)) {
            if (!RECIPIENT_ROLE_PATTERN.matcher(roleCode).matches()) {
                throw new BusinessException("抄送节点" + id + "抄送角色格式无效: " + roleCode);
            }
            validateCcRole(roleCode, id);
        }
        for (String userId : splitCsv(ccUserIds)) {
            if (!RECIPIENT_USER_PATTERN.matcher(userId).matches()) {
                throw new BusinessException("抄送节点" + id + "抄送用户ID格式无效: " + userId);
            }
            validateCcUser(userId, id);
        }
    }

    private void validateCcRole(String roleCode, String nodeId) {
        if (userRoleMapper == null) {
            return;
        }
        int roleCount = userRoleMapper.countActiveByRoleCode(roleCode);
        if (roleCount == 0) {
            throw new BusinessException("抄送节点" + nodeId + "抄送角色不存在或已禁用: " + roleCode);
        }
        List<Long> userIds = userRoleMapper.selectActiveUserIdsByRole(roleCode);
        if (userIds == null || userIds.isEmpty()) {
            throw new BusinessException("抄送节点" + nodeId + "抄送角色未配置有效用户: " + roleCode);
        }
    }

    private void validateCcUser(String userId, String nodeId) {
        if (userMapper == null) {
            return;
        }
        User user = userMapper.selectById(Long.parseLong(userId));
        if (user == null || (user.getStatus() != null && user.getStatus() != 1)) {
            throw new BusinessException("抄送节点" + nodeId + "抄送用户不存在或已禁用: userId=" + userId);
        }
    }

    private List<String> splitCsv(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (String part : value.split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                result.add(trimmed);
            }
        }
        return result;
    }

    // ──────────────────────────────────────────────────────────────
    //  Edge validation
    // ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public void validateEdges(List<?> edgeList, Map<String, Map<String, Object>> nodeById) {
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
                    throw new BusinessException("条件节点" + source + "连线必须使用满足或不满足出口");
                }
                if ("condition-true".equals(handle)) {
                    if (!conditionTrueSources.add(source)) {
                        throw new BusinessException("条件节点" + source + "只能配置一条满足分支");
                    }
                } else {
                    if (!conditionFalseSources.add(source)) {
                        throw new BusinessException("条件节点" + source + "只能配置一条不满足分支");
                    }
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
                    throw new BusinessException("条件节点" + nodeId + "必须同时配置满足和不满足两条分支");
                }
            }
        }

        validateReachability(startNodeId, nodeById.keySet(), adjacency);
    }

    @SuppressWarnings("unchecked")
    public void validateOptionalEdgeStyle(Map<String, Object> edge, String id) {
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

    // ──────────────────────────────────────────────────────────────
    //  Approver validation
    // ──────────────────────────────────────────────────────────────

    public void validateApproverRole(String approverRole, String nodeId) {
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
    public void validateApproverUser(String approverId, String nodeId) {
        validateApproverUser(approverId, nodeId, false);
    }

    private void validateApproverUser(String approverId, String nodeId, boolean taskNode) {
        if (approverId == null || approverId.isBlank()) {
            throw new BusinessException(taskNode
                    ? "节点" + nodeId + "指定用户办理时办理人ID不能为空"
                    : "节点" + nodeId + "指定用户审批时审批人ID不能为空");
        }
        long userId;
        try {
            userId = Long.parseLong(approverId.trim());
        } catch (NumberFormatException ex) {
            throw new BusinessException("节点" + nodeId + (taskNode ? "办理人ID格式无效: " : "审批人ID格式无效: ") + approverId);
        }
        if (userMapper != null) {
            User user = userMapper.selectById(userId);
            if (user == null || (user.getStatus() != null && user.getStatus() != 1)) {
                throw new BusinessException("节点" + nodeId + (taskNode ? "办理人不存在或已禁用: userId=" : "审批人不存在或已禁用: userId=") + userId);
            }
        }
    }

    // ──────────────────────────────────────────────────────────────
    //  Reachability validation
    // ──────────────────────────────────────────────────────────────

    public void validateReachability(String startNodeId, Set<String> nodeIds, Map<String, List<String>> adjacency) {
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

    // ──────────────────────────────────────────────────────────────
    //  Helper methods
    // ──────────────────────────────────────────────────────────────

    public String requireText(Object value, String message) {
        if (value == null || String.valueOf(value).isBlank()) {
            throw new BusinessException(message);
        }
        return String.valueOf(value);
    }

    public String textValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private void validateConditionExpression(String expression, String nodeId) {
        String normalized = expression.trim();
        if (!CONDITION_EXPRESSION_PATTERN.matcher(normalized).matches()
                || COMPOUND_CONDITION_PATTERN.matcher(normalized).matches()) {
            throw new BusinessException("条件节点" + nodeId + "表达式仅支持简单表达式：字段名 操作符 值");
        }
    }

    public void requireNumber(Object value, String message) {
        if (!(value instanceof Number)) {
            throw new BusinessException(message);
        }
    }

    public int parseIntValue(Object value, int defaultValue) {
        if (value instanceof Number num) {
            return num.intValue();
        }
        if (value instanceof String str && !str.isBlank()) {
            try {
                return Integer.parseInt(str.trim());
            } catch (NumberFormatException ignored) {
            }
        }
        return defaultValue;
    }

    // ──────────────────────────────────────────────────────────────
    //  JSON helper
    // ──────────────────────────────────────────────────────────────

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
}
