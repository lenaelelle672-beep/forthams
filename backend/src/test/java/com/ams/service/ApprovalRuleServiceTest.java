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
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApprovalRuleServiceTest {

    @Mock
    private ApprovalRuleMapper approvalRuleMapper;

    @Mock
    private ApprovalRuleVersionMapper approvalRuleVersionMapper;

    private ApprovalRuleService approvalRuleService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        approvalRuleService = new ApprovalRuleService(approvalRuleMapper, approvalRuleVersionMapper, new ObjectMapper());
        lenient().when(approvalRuleVersionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldCreateRuleWithSafeExpressionAndAppendOnlySnapshot() {
        doAnswer(invocation -> {
            ApprovalRule rule = invocation.getArgument(0);
            rule.setId(7L);
            return 1;
        }).when(approvalRuleMapper).insert(any(ApprovalRule.class));

        ApprovalRuleDTO created = approvalRuleService.createRule(saveDto("amount >= 1000 AND applicantRole == 'MANAGER'"));

        assertEquals(7L, created.getId());
        assertEquals("T001", captureRule().getTenantId());
        assertEquals("amount >= 1000 AND applicantRole == 'MANAGER'", created.getConditionSummary());

        ArgumentCaptor<ApprovalRuleVersion> versionCaptor = ArgumentCaptor.forClass(ApprovalRuleVersion.class);
        verify(approvalRuleVersionMapper).insert(versionCaptor.capture());
        assertEquals("CREATE", versionCaptor.getValue().getActionType());
        assertEquals(1, versionCaptor.getValue().getVersionNo());
        assertFalse(versionCaptor.getValue().getAfterSnapshot().contains("raw-secret"));
    }

    @Test
    void shouldRejectUnsafeExpressionAndPrototypePollutionContext() {
        for (String expression : List.of("T(java.lang.System).exit(0)", "amount > 1;", "eval('x')", "class.name == 'x'", "runtime == 'x'")) {
            ApprovalRuleSaveDTO dto = saveDto(expression);
            BusinessException error = assertThrows(BusinessException.class, () -> approvalRuleService.createRule(dto));
            assertTrue(error.getMessage().contains("表达式"));
        }

        ApprovalRuleSimulationDTO simulation = simulationDto();
        simulation.setContext(Map.of("__proto__", "polluted"));
        assertThrows(BusinessException.class, () -> approvalRuleService.simulate(simulation));
    }

    @Test
    void shouldSimulateMatchedRulesWithWhitelistEvaluatorOnly() {
        ApprovalRule rule = activeRule(7L, "amount >= 1000 AND applicantRole == 'MANAGER'", 10);
        when(approvalRuleMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(rule));

        ApprovalRuleSimulationResultDTO result = approvalRuleService.simulate(simulationDto());

        assertEquals(List.of(7L), result.getMatchedRuleIds());
        assertTrue(result.getSafeExplanation().contains("白名单表达式"));
        assertTrue(result.getTenantScoped());
    }

    @Test
    void shouldDetectConflictsForSameProcessNodePriorityAndOverlappedCondition() {
        when(approvalRuleMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(
                activeRule(7L, "amount >= 1000", 10),
                activeRule(8L, "amount >= 1000", 10),
                activeRule(9L, "amount < 1000", 20)
        ));

        List<ApprovalRuleConflictDTO> conflicts = approvalRuleService.detectConflicts(simulationDto());

        assertEquals(1, conflicts.size());
        assertEquals(7L, conflicts.get(0).getRuleId());
        assertEquals(8L, conflicts.get(0).getConflictRuleId());
        assertTrue(conflicts.get(0).getConflictSummary().contains("同一流程/节点/优先级"));
    }

    @Test
    void shouldEnableAndDisableWithConfirmedAuditSnapshotAndTenantIsolation() {
        ApprovalRule rule = activeRule(7L, "amount >= 1000", 10);
        rule.setStatus("DISABLED");
        when(approvalRuleMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(rule);

        ApprovalRuleDTO enabled = approvalRuleService.enableRule(7L, operation());
        assertEquals("ACTIVE", enabled.getStatus());
        verify(approvalRuleMapper).updateById(rule);

        ArgumentCaptor<ApprovalRuleVersion> versionCaptor = ArgumentCaptor.forClass(ApprovalRuleVersion.class);
        verify(approvalRuleVersionMapper).insert(versionCaptor.capture());
        assertEquals("ENABLE", versionCaptor.getValue().getActionType());
        assertTrue(versionCaptor.getValue().getAfterSnapshot().contains("ACTIVE"));

        ApprovalRuleOperationDTO missingReason = operation();
        missingReason.setReason(null);
        missingReason.setAuditEvidence(null);
        assertThrows(BusinessException.class, () -> approvalRuleService.disableRule(7L, missingReason));

        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> approvalRuleService.listRules(null, null, null, null));
    }

    private ApprovalRule captureRule() {
        ArgumentCaptor<ApprovalRule> captor = ArgumentCaptor.forClass(ApprovalRule.class);
        verify(approvalRuleMapper).insert(captor.capture());
        return captor.getValue();
    }

    private ApprovalRuleSaveDTO saveDto(String expression) {
        ApprovalRuleSaveDTO dto = new ApprovalRuleSaveDTO();
        dto.setProcessKey("PROC");
        dto.setBusinessType("ASSET");
        dto.setNodeKey("NODE");
        dto.setRuleName("大额审批规则");
        dto.setPriority(10);
        dto.setConditionExpression(expression);
        dto.setApproverStrategy("ROLE_MANAGER");
        dto.setOperatorId(42L);
        dto.setReason("规则保存复核");
        return dto;
    }

    private ApprovalRuleSimulationDTO simulationDto() {
        ApprovalRuleSimulationDTO dto = new ApprovalRuleSimulationDTO();
        dto.setProcessKey("PROC");
        dto.setBusinessType("ASSET");
        dto.setNodeKey("NODE");
        dto.setContext(Map.of("amount", 1200, "applicantRole", "MANAGER"));
        dto.setOperatorId(42L);
        dto.setReason("模拟复核");
        return dto;
    }

    private ApprovalRuleOperationDTO operation() {
        ApprovalRuleOperationDTO dto = new ApprovalRuleOperationDTO();
        dto.setConfirmed(true);
        dto.setOperatorId(42L);
        dto.setReason("启停复核通过");
        dto.setAuditEvidence("APPROVAL_RULE_GATE");
        return dto;
    }

    private ApprovalRule activeRule(Long id, String expression, int priority) {
        ApprovalRule rule = new ApprovalRule();
        rule.setId(id);
        rule.setTenantId("T001");
        rule.setProcessKey("PROC");
        rule.setBusinessType("ASSET");
        rule.setNodeKey("NODE");
        rule.setRuleName("规则" + id);
        rule.setPriority(priority);
        rule.setConditionExpression(expression);
        rule.setConditionSummary(expression);
        rule.setApproverStrategy("ROLE_MANAGER");
        rule.setApproverSummary("候选处理人策略：ROLE_MANAGER");
        rule.setStatus("ACTIVE");
        rule.setDeleted(0);
        return rule;
    }
}
