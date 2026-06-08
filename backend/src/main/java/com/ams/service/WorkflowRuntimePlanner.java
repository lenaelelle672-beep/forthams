package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.mapper.UserRoleMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 工作流运行时计划构建器。
 *
 * <p>从 {@link WorkflowDefinitionService} 提取的运行时计划构建和条件求值逻辑，
 * 负责将流程定义 JSON 解析为可执行的审批节点列表，并对条件节点进行运行时求值。
 *
 * <p>条件节点表达式限制：
 * 当前版本仅支持简单表达式（字段名 操作符 值），不支持 AND/OR 复合条件。
 * 支持的操作符：>=、<=、==、!=、>、<
 * 示例：amount >= 1000、status == "PENDING"
 */
@Component
@RequiredArgsConstructor
public class WorkflowRuntimePlanner {

    private static final Logger log = LoggerFactory.getLogger(WorkflowRuntimePlanner.class);

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

    @Nullable
    private final UserRoleMapper userRoleMapper;
    private final ObjectMapper objectMapper;

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * 根据流程定义和业务数据构建运行时审批计划。
     *
     * @param definition 流程定义（从 JSON 反序列化后的 Map）
     * @param businessData 业务数据 JSON 字符串，用于条件求值
     * @return 运行时审批计划
     * @throws BusinessException 如果流程定义存在循环或 count 模式参数不合法
     */
    @SuppressWarnings("unchecked")
    public WorkflowDefinitionService.WorkflowRuntimePlan buildRuntimePlan(Map<String, Object> definition, String businessData) {
        if (!(definition.get("nodes") instanceof List<?> nodeList)) {
            return new WorkflowDefinitionService.WorkflowRuntimePlan(List.of(), "");
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
        List<WorkflowDefinitionService.WorkflowApprovalNode> approvalNodes = new ArrayList<>();
        String resultAction = "";
        String currentNodeId = startNodeId;
        Set<String> visited = new HashSet<>();
        int guard = 0;
        int maxSteps = Math.max(1, nodeById.size() + edgesBySource.values().stream().mapToInt(List::size).sum() + 1);

        // 预缓存审批角色-成员映射，避免循环内重复查询
        Map<String, List<Long>> roleMemberCache = new HashMap<>();
        if (userRoleMapper != null) {
            for (Map.Entry<String, Map<String, Object>> entry : nodeById.entrySet()) {
                if ("approval".equals(nodeType(entry.getValue()))) {
                    Map<String, Object> nd = nodeData(entry.getValue());
                    String approverRole = textValue(nd.get("approverRole"));
                    if (approverRole != null && !approverRole.isBlank() && !roleMemberCache.containsKey(approverRole)) {
                        List<Long> ids = userRoleMapper.selectActiveUserIdsByRole(approverRole);
                        roleMemberCache.put(approverRole, ids != null ? ids : List.of());
                    }
                }
            }
        }

        while (currentNodeId != null && nodeById.containsKey(currentNodeId)) {
            if (++guard > maxSteps || !visited.add(currentNodeId)) {
                throw new BusinessException("流程定义存在循环，无法执行");
            }

            Map<String, Object> node = nodeById.get(currentNodeId);
            Map<String, Object> data = nodeData(node);
            String type = nodeType(node);
            if ("approval".equals(type)) {
                String approvalMode = firstPresent(textValue(data.get("approvalMode")), "sequence");
                // 运行时校验 count 模式的 countThreshold 合法性
                if ("count".equals(approvalMode)) {
                    int countThreshold = parseIntValue(data.get("countThreshold"), 0);
                    if (countThreshold <= 0) {
                        throw new BusinessException("运行时校验: count 模式节点 " + currentNodeId + " 的 countThreshold(" + countThreshold + ") 必须大于 0");
                    }
                    String approverRole = textValue(data.get("approverRole"));
                    if (approverRole != null && !approverRole.isBlank()) {
                        List<Long> approverIds = roleMemberCache.getOrDefault(approverRole, List.of());
                        if (!approverIds.isEmpty() && countThreshold > approverIds.size()) {
                            throw new BusinessException("运行时校验: count 模式节点 " + currentNodeId + " 的 countThreshold(" + countThreshold + ") 不能超过审批人数(" + approverIds.size() + ")");
                        }
                    }
                }
                String nodeApproverType = textValue(data.get("approverType"));
                String nodeApproverId = textValue(data.get("approverId"));
                approvalNodes.add(new WorkflowDefinitionService.WorkflowApprovalNode(
                        approvalNodes.size() + 1,
                        currentNodeId,
                        textValue(data.get("nodeCode")),
                        textValue(data.get("label")),
                        textValue(data.get("approverRole")),
                        approvalMode,
                        "user".equals(nodeApproverType) ? "user" : "role",
                        "user".equals(nodeApproverType) ? nodeApproverId : "",
                        textValue(data.get("ccRoleCodes")),
                        textValue(data.get("ccUserIds")),
                        parseIntValue(data.get("orderIndex"), 0),
                        parseIntValue(data.get("countThreshold"), 0)
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

        return new WorkflowDefinitionService.WorkflowRuntimePlan(approvalNodes, resultAction);
    }

    /**
     * 当已发布流程定义不可用时，根据给定的审批步骤数构建降级运行时计划。
     *
     * @param fallbackApprovalStepCount 降级审批步骤数
     * @return 降级运行时计划
     */
    public WorkflowDefinitionService.WorkflowRuntimePlan fallbackRuntimePlan(int fallbackApprovalStepCount) {
        List<WorkflowDefinitionService.WorkflowApprovalNode> approvalNodes = new ArrayList<>();
        for (int index = 1; index <= Math.max(0, fallbackApprovalStepCount); index++) {
            approvalNodes.add(new WorkflowDefinitionService.WorkflowApprovalNode(index, "fallback-" + index, "FALLBACK_" + index,
                    "第" + index + "级审批", "", "sequence", "role", "", "", "", 0, 0));
        }
        return new WorkflowDefinitionService.WorkflowRuntimePlan(approvalNodes, "");
    }

    // -------------------------------------------------------------------------
    // Condition evaluation
    // -------------------------------------------------------------------------

    /**
     * 对条件表达式进行运行时求值。
     *
     * <p>支持：
     * <ul>
     *   <li>字面量：true / false / 是 / 否 / 满足 / 不满足</li>
     *   <li>简单比较：field operator value（operator 为 >=、<=、==、!=、>、<）</li>
     *   <li>单字段真值判断</li>
     * </ul>
     *
     * @param expression 条件表达式字符串
     * @param context 业务数据上下文
     * @return 条件求值结果
     */
    public boolean evaluateCondition(String expression, Map<String, Object> context) {
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

    /**
     * 解析条件表达式中的字段引用，从上下文中读取对应的值。
     * 支持 {@link #CONDITION_FIELD_ALIASES} 中定义的中文别名映射。
     *
     * @param token 字段引用 token
     * @param context 业务数据上下文
     * @return 字段值，如果不存在则返回 null
     */
    Object resolveConditionValue(String token, Map<String, Object> context) {
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

    /**
     * 按点分隔路径从嵌套 Map 中读取值。
     *
     * @param context 上下文 Map
     * @param path 点分隔路径，例如 "data.amount"
     * @return 路径对应的值，如果路径不存在则返回 null
     */
    @SuppressWarnings("unchecked")
    Object readContextPath(Map<String, Object> context, String path) {
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

    /**
     * 将条件表达式中的字面量 token 解析为 Java 对象。
     * 支持字符串（带引号）、布尔值、null 和数值。
     *
     * @param token 字面量 token
     * @return 解析后的对象
     */
    Object parseConditionLiteral(String token) {
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

    /**
     * 对两个值按指定操作符进行比较。
     * 数值类型使用 {@link BigDecimal} 比较，否则使用字符串比较。
     *
     * @param left 左操作数
     * @param operator 比较操作符（>=、<=、==、!=、>、<）
     * @param right 右操作数
     * @return 比较结果
     */
    boolean compareConditionValues(Object left, String operator, Object right) {
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

    // -------------------------------------------------------------------------
    // Value conversion helpers
    // -------------------------------------------------------------------------

    /**
     * 尝试将值转换为 {@link BigDecimal}。
     *
     * @param value 待转换的值
     * @return BigDecimal 值，如果无法转换则返回 null
     */
    BigDecimal toBigDecimal(Object value) {
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

    /**
     * 判断值是否为"真值"。
     * <ul>
     *   <li>Boolean：直接返回</li>
     *   <li>Number：非零为真</li>
     *   <li>String：非空且不为 "false"/"0" 为真</li>
     *   <li>其他：非 null 为真</li>
     * </ul>
     *
     * @param value 待判断的值
     * @return 真值判断结果
     */
    boolean truthy(Object value) {
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

    // -------------------------------------------------------------------------
    // Node helpers
    // -------------------------------------------------------------------------

    /**
     * 将对象转为去空格的字符串，null 返回空字符串。
     */
    private String textValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    /**
     * 将对象解析为 int，支持 Number 和 String 类型，解析失败时返回默认值。
     */
    private int parseIntValue(Object value, int defaultValue) {
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

    /**
     * 返回第一个非空非空的字符串，否则返回 fallback。
     */
    private String firstPresent(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    /**
     * 从节点 Map 中提取 data 子对象，如果不存在或类型不对则返回空 Map。
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> nodeData(Map<String, Object> node) {
        Object data = node.get("data");
        return data instanceof Map<?, ?> rawData ? (Map<String, Object>) rawData : Map.of();
    }

    /**
     * 从节点 Map 中提取类型标识，优先取顶层 type，否则取 data.type。
     */
    private String nodeType(Map<String, Object> node) {
        String type = textValue(node.get("type"));
        if (type.isEmpty()) {
            type = textValue(nodeData(node).get("type"));
        }
        return type;
    }

    /**
     * 返回边列表中第一条边的目标节点 ID。
     */
    private String firstTarget(List<Map<String, Object>> edges) {
        if (edges == null || edges.isEmpty()) {
            return null;
        }
        String target = textValue(edges.get(0).get("target"));
        return target.isEmpty() ? null : target;
    }

    /**
     * 根据条件求值结果从边列表中选择目标节点。
     * 优先匹配 sourceHandle 为 "condition-true" 或 "condition-false" 的边，
     * 否则回退到第一条边。
     */
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

    // -------------------------------------------------------------------------
    // JSON helpers
    // -------------------------------------------------------------------------

    /**
     * 将 JSON 字符串反序列化为 Map，失败时返回 fallback。
     *
     * @param json JSON 字符串
     * @param fallback 反序列化失败时的默认值
     * @return 反序列化结果
     */
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

    /**
     * 将 JSON 字符串严格反序列化为 Map，失败时抛出 {@link BusinessException}。
     *
     * @param json JSON 字符串
     * @param message 异常消息
     * @return 反序列化结果
     * @throws BusinessException 如果 JSON 为空或解析失败
     */
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
}
