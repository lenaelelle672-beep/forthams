package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.ApprovalRuleConflictDTO;
import com.ams.dto.ApprovalRuleDTO;
import com.ams.dto.ApprovalRuleOperationDTO;
import com.ams.dto.ApprovalRuleSaveDTO;
import com.ams.dto.ApprovalRuleSimulationDTO;
import com.ams.dto.ApprovalRuleSimulationResultDTO;
import com.ams.entity.ApprovalRule;
import com.ams.entity.ApprovalRuleVersion;
import com.ams.mapper.ApprovalRuleMapper;
import com.ams.mapper.ApprovalRuleVersionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ApprovalRuleService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_DISABLED = "DISABLED";
    private static final Pattern SAFE_KEY_PATTERN = Pattern.compile("^[A-Za-z][A-Za-z0-9_:-]{0,63}$");
    private static final Set<String> FORBIDDEN_TEXT = Set.of(
            "<script", "javascript:", "scriptengine", "ognl", "spel", "classforname", "processbuilder",
            "select ", " insert ", " update ", " drop ", " union ", "${", "#{", "--", "/*", "*/", "`");

    private final ApprovalRuleMapper approvalRuleMapper;
    private final ApprovalRuleVersionMapper approvalRuleVersionMapper;
    private final ObjectMapper objectMapper;

    public List<ApprovalRuleDTO> listRules(String processKey, String nodeKey, String status, String keyword) {
        String tenantId = TenantContext.requireTenantId();
        LambdaQueryWrapper<ApprovalRule> wrapper = new LambdaQueryWrapper<ApprovalRule>()
                .eq(ApprovalRule::getTenantId, tenantId)
                .eq(ApprovalRule::getDeleted, 0);
        if (hasText(processKey)) {
            wrapper.eq(ApprovalRule::getProcessKey, requireSafeKey(processKey, "流程标识不合法"));
        }
        if (hasText(nodeKey)) {
            wrapper.eq(ApprovalRule::getNodeKey, requireSafeKey(nodeKey, "节点标识不合法"));
        }
        if (hasText(status)) {
            wrapper.eq(ApprovalRule::getStatus, normalizeStatus(status));
        }
        if (hasText(keyword)) {
            String safeKeyword = safeLike(keyword);
            wrapper.and(item -> item.like(ApprovalRule::getRuleName, safeKeyword)
                    .or()
                    .like(ApprovalRule::getConditionSummary, safeKeyword));
        }
        wrapper.orderByAsc(ApprovalRule::getPriority).orderByDesc(ApprovalRule::getUpdateTime).orderByDesc(ApprovalRule::getId);
        List<ApprovalRule> rules = approvalRuleMapper.selectList(wrapper);
        return (rules == null ? List.<ApprovalRule>of() : rules).stream().map(this::toDto).toList();
    }

    public ApprovalRuleDTO getRule(Long ruleId) {
        return toDto(requireRule(TenantContext.requireTenantId(), ruleId));
    }

    @Transactional(rollbackFor = Exception.class)
    public ApprovalRuleDTO createRule(ApprovalRuleSaveDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        ApprovalRuleSaveDTO payload = dto == null ? new ApprovalRuleSaveDTO() : dto;
        Long operatorId = requireAuditedOperator(payload.getOperatorId(), payload.getReason(), payload.getAuditEvidence(), "审批规则创建");
        ExpressionProgram expression = SafeExpressionEvaluator.parse(payload.getConditionExpression());

        ApprovalRule rule = new ApprovalRule();
        rule.setTenantId(tenantId);
        rule.setProcessKey(requireSafeKey(payload.getProcessKey(), "流程标识不合法"));
        rule.setBusinessType(hasText(payload.getBusinessType()) ? requireSafeKey(payload.getBusinessType(), "业务类型不合法") : rule.getProcessKey());
        rule.setNodeKey(requireSafeKey(payload.getNodeKey(), "节点标识不合法"));
        rule.setRuleName(safePlainText(payload.getRuleName(), "规则名称"));
        rule.setPriority(requirePriority(payload.getPriority()));
        rule.setConditionExpression(expression.expression());
        rule.setConditionSummary(expression.summary());
        rule.setApproverStrategy(safeStrategy(payload.getApproverStrategy()));
        rule.setApproverSummary(approverSummary(rule.getApproverStrategy()));
        rule.setStatus(hasText(payload.getStatus()) ? normalizeStatus(payload.getStatus()) : STATUS_DISABLED);
        rule.setAuditSummary("创建审批规则，条件已通过白名单解析；" + auditText(payload.getReason(), payload.getAuditEvidence()));
        rule.setCreatedBy(operatorId);
        rule.setUpdatedBy(operatorId);
        rule.setDeleted(0);
        approvalRuleMapper.insert(rule);
        recordVersion(tenantId, rule, null, "CREATE", operatorId, payload.getReason(), payload.getAuditEvidence());
        return toDto(rule);
    }

    @Transactional(rollbackFor = Exception.class)
    public ApprovalRuleDTO updateRule(Long ruleId, ApprovalRuleSaveDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        ApprovalRule existing = requireRule(tenantId, ruleId);
        ApprovalRule before = copyRule(existing);
        ApprovalRuleSaveDTO payload = dto == null ? new ApprovalRuleSaveDTO() : dto;
        Long operatorId = requireAuditedOperator(payload.getOperatorId(), payload.getReason(), payload.getAuditEvidence(), "审批规则更新");
        ExpressionProgram expression = SafeExpressionEvaluator.parse(payload.getConditionExpression());

        existing.setProcessKey(requireSafeKey(payload.getProcessKey(), "流程标识不合法"));
        existing.setBusinessType(hasText(payload.getBusinessType()) ? requireSafeKey(payload.getBusinessType(), "业务类型不合法") : existing.getProcessKey());
        existing.setNodeKey(requireSafeKey(payload.getNodeKey(), "节点标识不合法"));
        existing.setRuleName(safePlainText(payload.getRuleName(), "规则名称"));
        existing.setPriority(requirePriority(payload.getPriority()));
        existing.setConditionExpression(expression.expression());
        existing.setConditionSummary(expression.summary());
        existing.setApproverStrategy(safeStrategy(payload.getApproverStrategy()));
        existing.setApproverSummary(approverSummary(existing.getApproverStrategy()));
        if (hasText(payload.getStatus())) {
            existing.setStatus(normalizeStatus(payload.getStatus()));
        }
        existing.setUpdatedBy(operatorId);
        existing.setAuditSummary("更新审批规则，条件已通过白名单解析；" + auditText(payload.getReason(), payload.getAuditEvidence()));
        approvalRuleMapper.updateById(existing);
        recordVersion(tenantId, existing, before, "UPDATE", operatorId, payload.getReason(), payload.getAuditEvidence());
        return toDto(existing);
    }

    @Transactional(rollbackFor = Exception.class)
    public ApprovalRuleDTO enableRule(Long ruleId, ApprovalRuleOperationDTO operation) {
        return changeStatus(ruleId, operation, STATUS_ACTIVE, "ENABLE", "启用审批规则");
    }

    @Transactional(rollbackFor = Exception.class)
    public ApprovalRuleDTO disableRule(Long ruleId, ApprovalRuleOperationDTO operation) {
        return changeStatus(ruleId, operation, STATUS_DISABLED, "DISABLE", "停用审批规则");
    }

    public ApprovalRuleSimulationResultDTO simulate(ApprovalRuleSimulationDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        ApprovalRuleSimulationDTO payload = dto == null ? new ApprovalRuleSimulationDTO() : dto;
        requireAuditedOperator(payload.getOperatorId(), payload.getReason(), payload.getAuditEvidence(), "审批规则模拟");
        rejectUnsafeContext(payload.getContext());
        String processKey = requireSafeKey(payload.getProcessKey(), "流程标识不合法");
        String nodeKey = requireSafeKey(payload.getNodeKey(), "节点标识不合法");
        Map<String, Object> context = new LinkedHashMap<>(payload.getContext() == null ? Map.of() : payload.getContext());
        context.putIfAbsent("processKey", processKey);
        context.putIfAbsent("businessType", hasText(payload.getBusinessType()) ? payload.getBusinessType() : processKey);
        context.putIfAbsent("nodeKey", nodeKey);

        List<ApprovalRule> rules = approvalRuleMapper.selectList(new LambdaQueryWrapper<ApprovalRule>()
                .eq(ApprovalRule::getTenantId, tenantId)
                .eq(ApprovalRule::getDeleted, 0)
                .eq(ApprovalRule::getStatus, STATUS_ACTIVE)
                .eq(ApprovalRule::getProcessKey, processKey)
                .eq(ApprovalRule::getNodeKey, nodeKey)
                .orderByAsc(ApprovalRule::getPriority)
                .orderByDesc(ApprovalRule::getId));
        List<ApprovalRule> matched = new ArrayList<>();
        for (ApprovalRule rule : rules == null ? List.<ApprovalRule>of() : rules) {
            ExpressionProgram expression = SafeExpressionEvaluator.parse(rule.getConditionExpression());
            if (expression.evaluate(context)) {
                matched.add(rule);
            }
        }

        ApprovalRuleSimulationResultDTO result = new ApprovalRuleSimulationResultDTO();
        result.setProcessKey(processKey);
        result.setBusinessType(Objects.toString(context.get("businessType"), processKey));
        result.setNodeKey(nodeKey);
        result.setMatchedRules(matched.stream().map(this::toDto).toList());
        result.setMatchedRuleIds(matched.stream().map(ApprovalRule::getId).filter(Objects::nonNull).toList());
        result.setSafeExplanation("白名单表达式本地解析完成，命中 " + matched.size() + " 条规则，未调用脚本、SQL 或动态执行能力。");
        result.setApproverSummary(matched.stream().map(ApprovalRule::getApproverSummary).filter(this::hasText).collect(Collectors.joining("；")));
        result.setTenantScoped(true);
        result.setSimulatedAt(LocalDateTime.now());
        result.setAuditSummary("模拟审批规则；" + auditText(payload.getReason(), payload.getAuditEvidence()));
        if (matched.isEmpty()) {
            result.getWarnings().add("未命中启用规则，请检查流程、节点、上下文和优先级。 ");
        }
        return result;
    }

    public List<ApprovalRuleConflictDTO> detectConflicts(ApprovalRuleSimulationDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        ApprovalRuleSimulationDTO payload = dto == null ? new ApprovalRuleSimulationDTO() : dto;
        requireAuditedOperator(payload.getOperatorId(), payload.getReason(), payload.getAuditEvidence(), "审批规则冲突检测");
        String processKey = requireSafeKey(payload.getProcessKey(), "流程标识不合法");
        String nodeKey = requireSafeKey(payload.getNodeKey(), "节点标识不合法");
        rejectUnsafeContext(payload.getContext());

        List<ApprovalRule> rules = approvalRuleMapper.selectList(new LambdaQueryWrapper<ApprovalRule>()
                .eq(ApprovalRule::getTenantId, tenantId)
                .eq(ApprovalRule::getDeleted, 0)
                .eq(ApprovalRule::getProcessKey, processKey)
                .eq(ApprovalRule::getNodeKey, nodeKey)
                .orderByAsc(ApprovalRule::getPriority)
                .orderByAsc(ApprovalRule::getId));
        List<ApprovalRule> safeRules = rules == null ? List.of() : rules;
        List<ApprovalRuleConflictDTO> conflicts = new ArrayList<>();
        for (int i = 0; i < safeRules.size(); i++) {
            for (int j = i + 1; j < safeRules.size(); j++) {
                ApprovalRule left = safeRules.get(i);
                ApprovalRule right = safeRules.get(j);
                if (Objects.equals(left.getPriority(), right.getPriority()) && conditionOverlaps(left, right)) {
                    conflicts.add(conflictDto(left, right, payload));
                }
            }
        }
        return conflicts;
    }

    private ApprovalRuleDTO changeStatus(Long ruleId, ApprovalRuleOperationDTO operation, String nextStatus, String actionType, String actionName) {
        String tenantId = TenantContext.requireTenantId();
        requireHighRiskOperation(operation, actionName);
        ApprovalRule rule = requireRule(tenantId, ruleId);
        ApprovalRule before = copyRule(rule);
        rule.setStatus(nextStatus);
        rule.setUpdatedBy(operation.getOperatorId());
        if (STATUS_ACTIVE.equals(nextStatus)) {
            rule.setEnabledBy(operation.getOperatorId());
            rule.setEnabledAt(LocalDateTime.now());
        } else {
            rule.setDisabledBy(operation.getOperatorId());
            rule.setDisabledAt(LocalDateTime.now());
            rule.setDisabledReason(firstPresent(operation.getReason(), operation.getAuditEvidence()));
        }
        rule.setAuditSummary(actionName + "，仅影响后续流程实例；" + auditText(operation.getReason(), operation.getAuditEvidence()));
        approvalRuleMapper.updateById(rule);
        recordVersion(tenantId, rule, before, actionType, operation.getOperatorId(), operation.getReason(), operation.getAuditEvidence());
        return toDto(rule);
    }

    private ApprovalRule requireRule(String tenantId, Long ruleId) {
        if (ruleId == null || ruleId <= 0) {
            throw new BusinessException("审批规则不存在");
        }
        ApprovalRule rule = approvalRuleMapper.selectOne(new LambdaQueryWrapper<ApprovalRule>()
                .eq(ApprovalRule::getTenantId, tenantId)
                .eq(ApprovalRule::getId, ruleId)
                .eq(ApprovalRule::getDeleted, 0)
                .last("limit 1"));
        if (rule == null) {
            throw new BusinessException("审批规则不存在或无权访问");
        }
        return rule;
    }

    private void recordVersion(String tenantId, ApprovalRule after, ApprovalRule before, String actionType, Long operatorId, String reason, String auditEvidence) {
        ApprovalRuleVersion version = new ApprovalRuleVersion();
        version.setTenantId(tenantId);
        version.setRuleId(after.getId());
        version.setVersionNo(nextVersionNo(tenantId, after.getId()));
        version.setActionType(actionType);
        version.setBeforeSnapshot(snapshot(before));
        version.setAfterSnapshot(snapshot(after));
        version.setAuditSummary(actionType + " 快照；" + auditText(reason, auditEvidence));
        version.setOperatorId(operatorId);
        version.setReason(firstPresent(reason, auditEvidence));
        approvalRuleVersionMapper.insert(version);
    }

    private int nextVersionNo(String tenantId, Long ruleId) {
        if (ruleId == null) {
            return 1;
        }
        List<ApprovalRuleVersion> versions = approvalRuleVersionMapper.selectList(new LambdaQueryWrapper<ApprovalRuleVersion>()
                .eq(ApprovalRuleVersion::getTenantId, tenantId)
                .eq(ApprovalRuleVersion::getRuleId, ruleId)
                .orderByDesc(ApprovalRuleVersion::getVersionNo));
        return (versions == null ? List.<ApprovalRuleVersion>of() : versions).stream()
                .map(ApprovalRuleVersion::getVersionNo)
                .filter(Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private String snapshot(ApprovalRule rule) {
        if (rule == null) {
            return "{}";
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", rule.getId());
        data.put("processKey", rule.getProcessKey());
        data.put("nodeKey", rule.getNodeKey());
        data.put("priority", rule.getPriority());
        data.put("conditionSummary", rule.getConditionSummary());
        data.put("approverSummary", rule.getApproverSummary());
        data.put("status", rule.getStatus());
        data.put("auditSummary", rule.getAuditSummary());
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException ex) {
            throw new BusinessException("审批规则审计快照生成失败");
        }
    }

    private ApprovalRuleDTO toDto(ApprovalRule rule) {
        ApprovalRuleDTO dto = new ApprovalRuleDTO();
        dto.setId(rule.getId());
        dto.setProcessKey(rule.getProcessKey());
        dto.setBusinessType(rule.getBusinessType());
        dto.setNodeKey(rule.getNodeKey());
        dto.setRuleName(rule.getRuleName());
        dto.setPriority(rule.getPriority());
        dto.setConditionExpression(rule.getConditionExpression());
        dto.setConditionSummary(rule.getConditionSummary());
        dto.setApproverStrategy(rule.getApproverStrategy());
        dto.setApproverSummary(rule.getApproverSummary());
        dto.setStatus(rule.getStatus());
        dto.setAuditSummary(rule.getAuditSummary());
        dto.setCreatedBy(rule.getCreatedBy());
        dto.setUpdatedBy(rule.getUpdatedBy());
        dto.setEnabledBy(rule.getEnabledBy());
        dto.setEnabledAt(rule.getEnabledAt());
        dto.setDisabledBy(rule.getDisabledBy());
        dto.setDisabledAt(rule.getDisabledAt());
        dto.setDisabledReason(rule.getDisabledReason());
        dto.setCreateTime(rule.getCreateTime());
        dto.setUpdateTime(rule.getUpdateTime());
        return dto;
    }

    private ApprovalRule copyRule(ApprovalRule source) {
        ApprovalRule copy = new ApprovalRule();
        copy.setId(source.getId());
        copy.setTenantId(source.getTenantId());
        copy.setProcessKey(source.getProcessKey());
        copy.setBusinessType(source.getBusinessType());
        copy.setNodeKey(source.getNodeKey());
        copy.setRuleName(source.getRuleName());
        copy.setPriority(source.getPriority());
        copy.setConditionExpression(source.getConditionExpression());
        copy.setConditionSummary(source.getConditionSummary());
        copy.setApproverStrategy(source.getApproverStrategy());
        copy.setApproverSummary(source.getApproverSummary());
        copy.setStatus(source.getStatus());
        copy.setAuditSummary(source.getAuditSummary());
        return copy;
    }

    private ApprovalRuleConflictDTO conflictDto(ApprovalRule left, ApprovalRule right, ApprovalRuleSimulationDTO payload) {
        ApprovalRuleConflictDTO dto = new ApprovalRuleConflictDTO();
        dto.setRuleId(left.getId());
        dto.setConflictRuleId(right.getId());
        dto.setProcessKey(left.getProcessKey());
        dto.setNodeKey(left.getNodeKey());
        dto.setPriority(left.getPriority());
        dto.setConditionSummary(left.getConditionSummary());
        dto.setSeverity("HIGH");
        dto.setConflictSummary("同一流程/节点/优先级存在重叠条件：" + left.getRuleName() + " 与 " + right.getRuleName());
        dto.setAuditSummary("冲突检测完成；" + auditText(payload.getReason(), payload.getAuditEvidence()));
        return dto;
    }

    private boolean conditionOverlaps(ApprovalRule left, ApprovalRule right) {
        String leftCondition = normalizeCondition(left.getConditionSummary());
        String rightCondition = normalizeCondition(right.getConditionSummary());
        return leftCondition.equals(rightCondition) || leftCondition.contains("true") || rightCondition.contains("true");
    }

    private String normalizeCondition(String condition) {
        return Objects.toString(condition, "").replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
    }

    private void requireHighRiskOperation(ApprovalRuleOperationDTO operation, String actionName) {
        if (operation == null || !Boolean.TRUE.equals(operation.getConfirmed())) {
            throw new BusinessException(actionName + "需要二次确认");
        }
        requireAuditedOperator(operation.getOperatorId(), operation.getReason(), operation.getAuditEvidence(), actionName);
    }

    private Long requireAuditedOperator(Long operatorId, String reason, String auditEvidence, String actionName) {
        if (operatorId == null || operatorId <= 0) {
            throw new BusinessException(actionName + "需要操作人");
        }
        if (!hasText(reason) && !hasText(auditEvidence)) {
            throw new BusinessException(actionName + "需要审计原因或审计证据");
        }
        return operatorId;
    }

    private Integer requirePriority(Integer priority) {
        if (priority == null || priority < 1 || priority > 9999) {
            throw new BusinessException("审批规则优先级不合法");
        }
        return priority;
    }

    private String requireSafeKey(String key, String message) {
        String value = textValue(key);
        if (!SAFE_KEY_PATTERN.matcher(value).matches()) {
            throw new BusinessException(message);
        }
        return value;
    }

    private String normalizeStatus(String status) {
        String value = textValue(status).toUpperCase(Locale.ROOT);
        if (!Set.of(STATUS_ACTIVE, STATUS_DISABLED).contains(value)) {
            throw new BusinessException("审批规则状态不合法");
        }
        return value;
    }

    private String safePlainText(String value, String fieldName) {
        String text = textValue(value);
        if (text.isBlank()) {
            throw new BusinessException(fieldName + "不能为空");
        }
        rejectUnsafeText(text, fieldName + "包含不安全内容");
        return text.length() > 128 ? text.substring(0, 128) : text;
    }

    private String safeStrategy(String value) {
        String text = textValue(value);
        if (text.isBlank()) {
            throw new BusinessException("处理人策略不能为空");
        }
        rejectUnsafeText(text, "处理人策略包含不安全内容");
        return text.length() > 512 ? text.substring(0, 512) : text;
    }

    private void rejectUnsafeText(String value, String message) {
        String lower = value.toLowerCase(Locale.ROOT).replace(" ", "");
        if (FORBIDDEN_TEXT.stream().anyMatch(lower::contains)) {
            throw new BusinessException(message);
        }
    }

    private String approverSummary(String strategy) {
        String text = textValue(strategy);
        if (text.length() <= 96) {
            return "候选处理人策略：" + text;
        }
        return "候选处理人策略：" + text.substring(0, 96) + "...";
    }

    private void rejectUnsafeContext(Map<String, Object> context) {
        if (context == null) {
            return;
        }
        for (String key : context.keySet()) {
            String lower = Objects.toString(key, "").toLowerCase(Locale.ROOT);
            if (Set.of("__proto__", "constructor", "prototype").contains(lower)) {
                throw new BusinessException("模拟上下文包含不安全字段");
            }
        }
    }

    private String safeLike(String value) {
        return textValue(value).replace("%", "").replace("_", "");
    }

    private String auditText(String reason, String auditEvidence) {
        return firstPresent(reason, auditEvidence);
    }

    private String firstPresent(String... values) {
        for (String value : values) {
            if (hasText(value)) {
                return value;
            }
        }
        return "审计证据已登记";
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String textValue(Object value) {
        return Objects.toString(value, "").trim();
    }

    private record ExpressionProgram(String expression, String summary, ExpressionNode root) {
        boolean evaluate(Map<String, Object> context) {
            return root.evaluate(context == null ? Map.of() : context);
        }
    }

    private interface ExpressionNode {
        boolean evaluate(Map<String, Object> context);
    }

    private record LiteralValue(Object value) {
    }

    private static final class SafeExpressionEvaluator {
        private static final Set<String> ALLOWED_FIELDS = Set.of(
                "processKey", "businessType", "nodeKey", "applicantUserId", "applicantDeptId", "applicantRole", "amount", "priority");
        private static final Pattern SAFE_FORM_FIELD = Pattern.compile("^form\\.[A-Za-z][A-Za-z0-9_-]{0,63}$");
        private static final Set<String> WORD_OPERATORS = Set.of("in", "contains", "startswith", "endswith", "exists");
        private static final Set<String> FORBIDDEN_WORDS = Set.of("script", "eval", "class", "runtime", "reflect", "import", "new", "process", "constructor", "prototype", "__proto__");

        static ExpressionProgram parse(String expression) {
            String value = Objects.toString(expression, "").trim();
            if (value.isBlank() || value.length() > 512) {
                throw new BusinessException("审批规则表达式不能为空或过长");
            }
            String lower = value.toLowerCase(Locale.ROOT);
            for (String token : List.of("${", "#{", "t(", ";", "--", "/*", "*/", "`", "select ", " union ", " drop ")) {
                if (lower.contains(token)) {
                    throw new BusinessException("审批规则表达式包含不安全 token");
                }
            }
            Parser parser = new Parser(new Tokenizer(value).tokens());
            ExpressionNode node = parser.parseExpression();
            parser.expect(TokenType.EOF);
            return new ExpressionProgram(value, value.replaceAll("\\s+", " "), node);
        }

        private static final class Parser {
            private final List<Token> tokens;
            private int cursor;

            private Parser(List<Token> tokens) {
                if (tokens.size() > 80) {
                    throw new BusinessException("审批规则表达式 token 数过多");
                }
                this.tokens = tokens;
            }

            private ExpressionNode parseExpression() {
                return parseOr(0);
            }

            private ExpressionNode parseOr(int depth) {
                ExpressionNode node = parseAnd(depth);
                while (match(TokenType.OR)) {
                    ExpressionNode right = parseAnd(depth);
                    ExpressionNode left = node;
                    node = context -> left.evaluate(context) || right.evaluate(context);
                }
                return node;
            }

            private ExpressionNode parseAnd(int depth) {
                ExpressionNode node = parseUnary(depth);
                while (match(TokenType.AND)) {
                    ExpressionNode right = parseUnary(depth);
                    ExpressionNode left = node;
                    node = context -> left.evaluate(context) && right.evaluate(context);
                }
                return node;
            }

            private ExpressionNode parseUnary(int depth) {
                if (match(TokenType.NOT)) {
                    ExpressionNode node = parseUnary(depth + 1);
                    return context -> !node.evaluate(context);
                }
                return parsePrimary(depth);
            }

            private ExpressionNode parsePrimary(int depth) {
                if (depth > 8) {
                    throw new BusinessException("审批规则表达式括号深度过大");
                }
                if (match(TokenType.LPAREN)) {
                    ExpressionNode node = parseOr(depth + 1);
                    expect(TokenType.RPAREN);
                    return node;
                }
                return parseComparison();
            }

            private ExpressionNode parseComparison() {
                if (peek().type() == TokenType.OPERATOR && "exists".equalsIgnoreCase(peek().text())) {
                    next();
                    String field = requireField(expect(TokenType.IDENTIFIER).text());
                    return context -> valueOf(field, context) != null;
                }
                String field = requireField(expect(TokenType.IDENTIFIER).text());
                Token operator = expect(TokenType.OPERATOR);
                String op = operator.text().toLowerCase(Locale.ROOT);
                if ("exists".equals(op)) {
                    return context -> valueOf(field, context) != null;
                }
                if ("in".equals(op)) {
                    List<LiteralValue> literals = parseArray();
                    return context -> literals.stream().anyMatch(literal -> valuesEqual(valueOf(field, context), literal.value()));
                }
                LiteralValue literal = parseLiteral();
                return context -> compare(valueOf(field, context), op, literal.value());
            }

            private List<LiteralValue> parseArray() {
                expect(TokenType.LBRACKET);
                List<LiteralValue> values = new ArrayList<>();
                if (!match(TokenType.RBRACKET)) {
                    do {
                        values.add(parseLiteral());
                        if (values.size() > 20) {
                            throw new BusinessException("审批规则表达式数组过长");
                        }
                    } while (match(TokenType.COMMA));
                    expect(TokenType.RBRACKET);
                }
                return values;
            }

            private LiteralValue parseLiteral() {
                Token token = next();
                return switch (token.type()) {
                    case STRING -> new LiteralValue(token.text());
                    case NUMBER -> new LiteralValue(Double.parseDouble(token.text()));
                    case BOOLEAN -> new LiteralValue(Boolean.parseBoolean(token.text().toLowerCase(Locale.ROOT)));
                    case NULL -> new LiteralValue(null);
                    default -> throw new BusinessException("审批规则表达式字面量不合法");
                };
            }

            private Token expect(TokenType type) {
                Token token = next();
                if (token.type() != type) {
                    throw new BusinessException("审批规则表达式语法不合法");
                }
                return token;
            }

            private boolean match(TokenType type) {
                if (peek().type() == type) {
                    cursor++;
                    return true;
                }
                return false;
            }

            private Token next() {
                Token token = tokens.get(cursor++);
                if (token.type() == TokenType.IDENTIFIER && FORBIDDEN_WORDS.contains(token.text().toLowerCase(Locale.ROOT))) {
                    throw new BusinessException("审批规则表达式包含不安全标识符");
                }
                return token;
            }

            private Token peek() {
                return tokens.get(cursor);
            }
        }

        private static final class Tokenizer {
            private final String source;
            private final List<Token> tokens = new ArrayList<>();
            private int index;

            private Tokenizer(String source) {
                this.source = source;
            }

            private List<Token> tokens() {
                while (index < source.length()) {
                    char ch = source.charAt(index);
                    if (Character.isWhitespace(ch)) {
                        index++;
                    } else if (ch == '(') {
                        tokens.add(new Token("(", TokenType.LPAREN)); index++;
                    } else if (ch == ')') {
                        tokens.add(new Token(")", TokenType.RPAREN)); index++;
                    } else if (ch == '[') {
                        tokens.add(new Token("[", TokenType.LBRACKET)); index++;
                    } else if (ch == ']') {
                        tokens.add(new Token("]", TokenType.RBRACKET)); index++;
                    } else if (ch == ',') {
                        tokens.add(new Token(",", TokenType.COMMA)); index++;
                    } else if (ch == '\'' || ch == '"') {
                        readString(ch);
                    } else if (Character.isDigit(ch)) {
                        readNumber();
                    } else if (Character.isLetter(ch)) {
                        readWord();
                    } else {
                        readOperator();
                    }
                }
                tokens.add(new Token("", TokenType.EOF));
                return tokens;
            }

            private void readString(char quote) {
                index++;
                StringBuilder builder = new StringBuilder();
                while (index < source.length() && source.charAt(index) != quote) {
                    char ch = source.charAt(index++);
                    if (ch == '\\' && index < source.length()) {
                        ch = source.charAt(index++);
                    }
                    builder.append(ch);
                    if (builder.length() > 128) {
                        throw new BusinessException("审批规则表达式字符串过长");
                    }
                }
                if (index >= source.length()) {
                    throw new BusinessException("审批规则表达式字符串未闭合");
                }
                index++;
                tokens.add(new Token(builder.toString(), TokenType.STRING));
            }

            private void readNumber() {
                int start = index;
                while (index < source.length() && (Character.isDigit(source.charAt(index)) || source.charAt(index) == '.')) {
                    index++;
                }
                tokens.add(new Token(source.substring(start, index), TokenType.NUMBER));
            }

            private void readWord() {
                int start = index;
                while (index < source.length()) {
                    char ch = source.charAt(index);
                    if (!Character.isLetterOrDigit(ch) && ch != '_' && ch != '-' && ch != '.') {
                        break;
                    }
                    index++;
                }
                String word = source.substring(start, index);
                String lower = word.toLowerCase(Locale.ROOT);
                if ("and".equals(lower)) tokens.add(new Token(word, TokenType.AND));
                else if ("or".equals(lower)) tokens.add(new Token(word, TokenType.OR));
                else if ("not".equals(lower)) tokens.add(new Token(word, TokenType.NOT));
                else if ("true".equals(lower) || "false".equals(lower)) tokens.add(new Token(lower, TokenType.BOOLEAN));
                else if ("null".equals(lower)) tokens.add(new Token(lower, TokenType.NULL));
                else if (WORD_OPERATORS.contains(lower)) tokens.add(new Token(lower, TokenType.OPERATOR));
                else tokens.add(new Token(word, TokenType.IDENTIFIER));
            }

            private void readOperator() {
                for (String op : List.of("==", "!=", ">=", "<=", ">", "<")) {
                    if (source.startsWith(op, index)) {
                        tokens.add(new Token(op, TokenType.OPERATOR));
                        index += op.length();
                        return;
                    }
                }
                throw new BusinessException("审批规则表达式包含不支持字符");
            }
        }

        private static String requireField(String field) {
            if (ALLOWED_FIELDS.contains(field) || SAFE_FORM_FIELD.matcher(field).matches()) {
                return field;
            }
            throw new BusinessException("审批规则表达式字段不在白名单内");
        }

        private static Object valueOf(String field, Map<String, Object> context) {
            if (context.containsKey(field)) {
                return context.get(field);
            }
            if (field.startsWith("form.")) {
                Object form = context.get("form");
                String key = field.substring("form.".length());
                if (form instanceof Map<?, ?> map) {
                    return map.get(key);
                }
            }
            return null;
        }

        private static boolean compare(Object actual, String operator, Object expected) {
            return switch (operator) {
                case "==" -> valuesEqual(actual, expected);
                case "!=" -> !valuesEqual(actual, expected);
                case ">" -> numeric(actual) > numeric(expected);
                case ">=" -> numeric(actual) >= numeric(expected);
                case "<" -> numeric(actual) < numeric(expected);
                case "<=" -> numeric(actual) <= numeric(expected);
                case "contains" -> Objects.toString(actual, "").contains(Objects.toString(expected, ""));
                case "startswith" -> Objects.toString(actual, "").startsWith(Objects.toString(expected, ""));
                case "endswith" -> Objects.toString(actual, "").endsWith(Objects.toString(expected, ""));
                default -> throw new BusinessException("审批规则表达式操作符不在白名单内");
            };
        }

        private static boolean valuesEqual(Object actual, Object expected) {
            if (actual instanceof Number || expected instanceof Number) {
                return Double.compare(numeric(actual), numeric(expected)) == 0;
            }
            return Objects.equals(Objects.toString(actual, null), Objects.toString(expected, null));
        }

        private static double numeric(Object value) {
            if (value instanceof Number number) {
                return number.doubleValue();
            }
            try {
                return Double.parseDouble(Objects.toString(value, ""));
            } catch (NumberFormatException ex) {
                throw new BusinessException("审批规则表达式数字比较不合法");
            }
        }

        private record Token(String text, TokenType type) {
        }

        private enum TokenType {
            IDENTIFIER, STRING, NUMBER, BOOLEAN, NULL, OPERATOR, AND, OR, NOT, LPAREN, RPAREN, LBRACKET, RBRACKET, COMMA, EOF
        }
    }
}
