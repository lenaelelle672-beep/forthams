package com.ams.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * 当前审批引擎仅支持一条明确的 START -> APPROVAL+ -> END 顺序路径。
 * 图编辑器可以保存未完成草稿，但发布和运行时必须使用本校验结果 fail-closed。
 */
public final class LinearWorkflowDefinitionValidator {

    private static final Set<String> SUPPORTED_NODE_TYPES = Set.of("START", "APPROVAL", "END");
    private static final Set<String> ROOT_FIELDS = Set.of("id", "name", "description", "nodes", "edges");
    private static final Set<String> NODE_FIELDS = Set.of("id", "type", "label", "nodeCode", "config", "data", "position");
    private static final Set<String> EDGE_FIELDS = Set.of(
            "id", "source", "target", "label", "sourceHandle", "targetHandle",
            "conditionExpression", "condition", "data", "type", "mode");
    /* 已确认仅用于设计器展示的字段；其他字段一律不能被运行时静默忽略。 */
    private static final Set<String> CONFIG_FIELDS = Set.of(
            "label", "description", "nodeCode", "position", "triggerType",
            "approverType", "approverRole", "approverRoleName", "approverId", "approvalMode",
            "conditionExpression", "trueLabel", "falseLabel", "resultAction", "formSource",
            "formSectionName", "formSummaryFields", "ccRoleCodes", "ccUserIds");
    private static final Set<String> POSITION_FIELDS = Set.of("x", "y");

    private LinearWorkflowDefinitionValidator() {
    }

    public static ValidationResult validate(Map<String, Object> definition) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = List.of();
        if (definition != null) {
            validateAllowedFields(definition, ROOT_FIELDS, "流程图", errors);
            validateNullableText(definition.get("id"), "流程图 id", errors);
            validateNullableText(definition.get("name"), "流程图 name", errors);
            validateNullableText(definition.get("description"), "流程图 description", errors);
        }
        List<?> rawNodes = listValue(definition == null ? null : definition.get("nodes"));
        List<?> rawEdges = listValue(definition == null ? null : definition.get("edges"));
        int nodeCount = rawNodes == null ? 0 : rawNodes.size();
        int edgeCount = rawEdges == null ? 0 : rawEdges.size();

        if (rawNodes == null || rawNodes.isEmpty()) {
            errors.add("流程图不能为空，至少需要开始、审批和结束节点");
            return new ValidationResult(errors, warnings, nodeCount, edgeCount, List.of());
        }
        if (rawEdges == null) {
            errors.add("流程必须提供明确的顺序连线");
            return new ValidationResult(errors, warnings, nodeCount, edgeCount, List.of());
        }

        Map<String, NodeInfo> nodes = new LinkedHashMap<>();
        int startCount = 0;
        int endCount = 0;
        int approvalCount = 0;
        String startId = null;

        for (Object rawNode : rawNodes) {
            if (!(rawNode instanceof Map<?, ?> node)) {
                errors.add("节点必须是对象结构");
                continue;
            }
            String id = text(node.get("id"));
            String type = normalizeType(node.get("type"));
            validateNodeShape(node, id, errors);
            if (id.isBlank()) {
                errors.add("节点 ID 不能为空");
                continue;
            }
            if (nodes.containsKey(id)) {
                errors.add("节点 ID 重复: " + id);
                continue;
            }
            Map<?, ?> config = configurationFor(node);
            NodeInfo info = new NodeInfo(id, type, node, config);
            nodes.put(id, info);

            if (!SUPPORTED_NODE_TYPES.contains(type)) {
                errors.add("当前运行时仅支持 START、APPROVAL、END 节点，不支持节点类型: "
                        + (type.isBlank() ? id : type));
            }
            if ("START".equals(type)) {
                startCount++;
                startId = id;
            } else if ("END".equals(type)) {
                endCount++;
            } else if ("APPROVAL".equals(type)) {
                approvalCount++;
                validateApprovalNode(info, errors);
            }
        }

        if (startCount != 1) {
            errors.add("流程必须且只能包含一个开始节点");
        }
        if (endCount != 1) {
            errors.add("流程必须且只能包含一个结束节点");
        }
        if (approvalCount == 0) {
            errors.add("流程至少需要一个审批节点");
        }
        if (rawEdges.size() != rawNodes.size() - 1) {
            errors.add("当前运行时仅支持单一路径，连线数必须等于节点数减一");
        }

        Map<String, List<String>> successors = new HashMap<>();
        Map<String, Integer> incoming = new HashMap<>();
        Map<String, Integer> outgoing = new HashMap<>();
        Set<String> edgePairs = new HashSet<>();
        for (Object rawEdge : rawEdges) {
            if (!(rawEdge instanceof Map<?, ?> edge)) {
                errors.add("连线必须是对象结构");
                continue;
            }
            String source = text(edge.get("source"));
            String target = text(edge.get("target"));
            validateEdgeShape(edge, source, target, errors);
            if (source.isBlank() || target.isBlank()) {
                errors.add("连线 source/target 不能为空");
                continue;
            }
            if (!nodes.containsKey(source)) {
                errors.add("连线 source 不存在: " + source);
                continue;
            }
            if (!nodes.containsKey(target)) {
                errors.add("连线 target 不存在: " + target);
                continue;
            }
            if (!edgePairs.add(source + "\u0000" + target)) {
                errors.add("连线重复: " + source + " -> " + target);
                continue;
            }
            successors.computeIfAbsent(source, ignored -> new ArrayList<>()).add(target);
            outgoing.merge(source, 1, Integer::sum);
            incoming.merge(target, 1, Integer::sum);
        }

        for (NodeInfo node : nodes.values()) {
            int in = incoming.getOrDefault(node.id(), 0);
            int out = outgoing.getOrDefault(node.id(), 0);
            if ("START".equals(node.type())) {
                if (in != 0 || out != 1) {
                    errors.add("开始节点必须恰好零入边、一出边");
                }
            } else if ("END".equals(node.type())) {
                if (in != 1 || out != 0) {
                    errors.add("结束节点必须恰好一入边、零出边");
                }
            } else if ("APPROVAL".equals(node.type())) {
                if (in != 1 || out != 1) {
                    errors.add("审批节点 " + node.id() + " 必须恰好一入边、一出边；不支持分支或并行");
                }
            }
        }

        List<Map<?, ?>> orderedApprovalNodes = orderedApprovalNodes(startId, nodes, successors, errors);
        return new ValidationResult(errors, warnings, nodeCount, edgeCount, orderedApprovalNodes);
    }

    /**
     * 返回已通过显式 schema 校验的审批配置。运行时调用方必须先检查 validate 的结果。
     */
    public static Map<?, ?> configurationFor(Map<?, ?> node) {
        Object config = node.get("config");
        if (config instanceof Map<?, ?> map && !map.isEmpty()) {
            return map;
        }
        Object data = node.get("data");
        if (data instanceof Map<?, ?> map) {
            return map;
        }
        return config instanceof Map<?, ?> map ? map : Map.of();
    }

    private static void validateNodeShape(Map<?, ?> node, String id, List<String> errors) {
        String label = id.isBlank() ? "节点" : "节点 " + id;
        validateAllowedFields(node, NODE_FIELDS, label, errors);
        validateNullableText(node.get("id"), label + " id", errors);
        validateNullableText(node.get("type"), label + " type", errors);
        validateNullableText(node.get("label"), label + " label", errors);
        validateNullableText(node.get("nodeCode"), label + " nodeCode", errors);
        validatePosition(node.get("position"), label + " position", errors);

        Map<?, ?> config = mapValue(node.get("config"), label + " config", errors);
        Map<?, ?> data = mapValue(node.get("data"), label + " data", errors);
        validateConfiguration(config, label + " config", errors);
        validateConfiguration(data, label + " data", errors);
        if (config != null && !config.isEmpty() && data != null && !data.isEmpty()) {
            errors.add(label + " 不能同时提供 config 和 data，避免运行时配置歧义");
        }
    }

    private static void validateConfiguration(Map<?, ?> config, String label, List<String> errors) {
        if (config == null) {
            return;
        }
        validateAllowedFields(config, CONFIG_FIELDS, label, errors);
        for (Map.Entry<?, ?> entry : config.entrySet()) {
            if (!(entry.getKey() instanceof String key) || !CONFIG_FIELDS.contains(key)) {
                continue;
            }
            if ("position".equals(key)) {
                validatePosition(entry.getValue(), label + " position", errors);
            } else {
                validateNullableScalar(entry.getValue(), label + " " + key, errors);
            }
        }
        if (hasNonBlankValue(config.get("conditionExpression"))
                || hasNonBlankValue(config.get("trueLabel"))
                || hasNonBlankValue(config.get("falseLabel"))) {
            errors.add(label + " 包含条件语义或分支字段；当前运行时不支持");
        }
        if (hasNonBlankValue(config.get("ccRoleCodes")) || hasNonBlankValue(config.get("ccUserIds"))) {
            errors.add(label + " 包含抄送语义；当前运行时不支持");
        }
        String approvalMode = text(config.get("approvalMode"));
        if (!approvalMode.isBlank() && !"SEQUENCE".equalsIgnoreCase(approvalMode)) {
            errors.add(label + " 仅支持明确的 sequence 审批模式；any、all、parallel 和条件分支尚未支持");
        }
    }

    private static void validateEdgeShape(Map<?, ?> edge, String source, String target, List<String> errors) {
        String label = "连线 " + (source.isBlank() ? "<unknown>" : source)
                + " -> " + (target.isBlank() ? "<unknown>" : target);
        validateAllowedFields(edge, EDGE_FIELDS, label, errors);
        validateNullableText(edge.get("id"), label + " id", errors);
        validateNullableText(edge.get("source"), label + " source", errors);
        validateNullableText(edge.get("target"), label + " target", errors);
        validateNullableText(edge.get("label"), label + " label", errors);

        if (hasNonBlankValue(edge.get("sourceHandle")) || hasNonBlankValue(edge.get("targetHandle"))) {
            errors.add(label + " 包含条件或分支出口 handle；当前运行时不支持");
        }
        if (hasNonBlankValue(edge.get("conditionExpression")) || edge.get("condition") != null) {
            errors.add(label + " 包含条件语义；当前运行时不支持");
        }
        if (hasNonBlankValue(edge.get("type")) || hasNonBlankValue(edge.get("mode"))) {
            errors.add(label + " 包含未支持的连线 type 或 mode 语义");
        }
        Object data = edge.get("data");
        if (data != null && (!(data instanceof Map<?, ?> map) || !map.isEmpty())) {
            errors.add(label + " 包含嵌套 data；当前运行时不支持嵌套连线语义");
        }
    }

    private static void validateApprovalNode(NodeInfo node, List<String> errors) {
        String approverType = text(node.config().get("approverType")).toUpperCase(Locale.ROOT);
        if (!"USER".equals(approverType) && !"ROLE".equals(approverType)) {
            errors.add("审批节点 " + node.id() + " 必须明确配置 approverType 为 user 或 role");
        } else if ("USER".equals(approverType)) {
            String approverId = text(node.config().get("approverId"));
            if (approverId.isBlank()) {
                errors.add("审批节点 " + node.id() + " 未配置 approverId");
            } else if (!isPositiveLong(approverId)) {
                errors.add("审批节点 " + node.id() + " 的 approverId 必须为正整数");
            }
        } else if (text(node.config().get("approverRole")).isBlank()) {
            errors.add("审批节点 " + node.id() + " 未配置 approverRole");
        }

        String approvalMode = text(node.config().get("approvalMode"));
        if (!"SEQUENCE".equalsIgnoreCase(approvalMode)) {
            errors.add("审批节点 " + node.id()
                    + " 仅支持明确的 sequence 审批模式；any、all、parallel 和条件分支尚未支持");
        }
    }

    private static List<Map<?, ?>> orderedApprovalNodes(String startId,
                                                          Map<String, NodeInfo> nodes,
                                                          Map<String, List<String>> successors,
                                                          List<String> errors) {
        if (startId == null || !nodes.containsKey(startId)) {
            return List.of();
        }
        List<Map<?, ?>> approvals = new ArrayList<>();
        Set<String> visited = new HashSet<>();
        String current = startId;
        boolean reachedEnd = false;
        while (current != null) {
            if (!visited.add(current)) {
                errors.add("流程存在循环路径；当前运行时不支持回环");
                break;
            }
            NodeInfo node = nodes.get(current);
            if (node == null) {
                break;
            }
            if ("APPROVAL".equals(node.type())) {
                approvals.add(node.node());
            }
            if ("END".equals(node.type())) {
                reachedEnd = true;
                break;
            }
            List<String> next = successors.getOrDefault(current, List.of());
            if (next.size() != 1) {
                break;
            }
            current = next.get(0);
        }
        if (!reachedEnd) {
            errors.add("流程必须从开始节点沿唯一顺序路径到达结束节点");
        } else if (visited.size() != nodes.size()) {
            errors.add("存在不在开始到结束顺序路径上的节点；当前运行时不支持非线性图");
        }
        return List.copyOf(approvals);
    }

    private static void validateAllowedFields(Map<?, ?> values, Set<String> allowedFields,
                                              String label, List<String> errors) {
        for (Object rawKey : values.keySet()) {
            if (!(rawKey instanceof String key) || !allowedFields.contains(key)) {
                errors.add(label + " 包含未支持字段: " + rawKey);
            }
        }
    }

    private static void validatePosition(Object value, String label, List<String> errors) {
        if (value == null) {
            return;
        }
        if (!(value instanceof Map<?, ?> position)) {
            errors.add(label + " 必须是 x/y 坐标对象");
            return;
        }
        validateAllowedFields(position, POSITION_FIELDS, label, errors);
        for (Map.Entry<?, ?> entry : position.entrySet()) {
            if (entry.getKey() instanceof String key && POSITION_FIELDS.contains(key)
                    && entry.getValue() != null && !(entry.getValue() instanceof Number)) {
                errors.add(label + " 的 " + key + " 必须是数值");
            }
        }
    }

    private static Map<?, ?> mapValue(Object value, String label, List<String> errors) {
        if (value == null) {
            return null;
        }
        if (value instanceof Map<?, ?> map) {
            return map;
        }
        errors.add(label + " 必须是对象结构");
        return null;
    }

    private static void validateNullableText(Object value, String label, List<String> errors) {
        if (value != null && !(value instanceof String)) {
            errors.add(label + " 必须是字符串");
        }
    }

    private static void validateNullableScalar(Object value, String label, List<String> errors) {
        if (value != null && !(value instanceof String) && !(value instanceof Number) && !(value instanceof Boolean)) {
            errors.add(label + " 必须是标量值");
        }
    }

    private static List<?> listValue(Object value) {
        return value instanceof List<?> list ? list : null;
    }

    private static boolean hasNonBlankValue(Object value) {
        return !text(value).isBlank();
    }

    private static boolean isPositiveLong(String value) {
        try {
            return Long.parseLong(value) > 0;
        } catch (NumberFormatException exception) {
            return false;
        }
    }

    private static String normalizeType(Object value) {
        return text(value).toUpperCase(Locale.ROOT).replace('-', '_');
    }

    private static String text(Object value) {
        return Objects.toString(value, "").trim();
    }

    public record ValidationResult(List<String> errors,
                                   List<String> warnings,
                                   int nodeCount,
                                   int edgeCount,
                                   List<Map<?, ?>> orderedApprovalNodes) {
        public boolean valid() {
            return errors.isEmpty();
        }
    }

    private record NodeInfo(String id, String type, Map<?, ?> node, Map<?, ?> config) {
    }
}
