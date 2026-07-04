package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemFieldMappingRequest;
import com.ams.dto.SystemIntegrationInterfaceRequest;
import com.ams.dto.SystemSyncQueueSummaryResponse;
import com.ams.dto.SystemSyncRuleRequest;
import com.ams.dto.SystemSyncRuleResponse;
import com.ams.dto.SystemSyncRunLogResponse;
import com.ams.dto.SystemSyncRunRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SystemSyncExecutionServiceTest {

    private SystemSyncRuleService ruleService;
    private SystemSyncExecutionService executionService;
    private Long ruleId;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        SystemIntegrationInterfaceService interfaceService = new SystemIntegrationInterfaceService();
        SystemFieldMappingService fieldMappingService = new SystemFieldMappingService(interfaceService);
        ruleService = new SystemSyncRuleService(interfaceService, fieldMappingService);
        executionService = new SystemSyncExecutionService(ruleService);
        Long interfaceId = interfaceService.create(interfaceRequest()).getId();
        fieldMappingService.create(mappingRequest(interfaceId));
        SystemSyncRuleResponse rule = ruleService.create(ruleRequest(interfaceId));
        ruleId = rule.getId();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void runRuleShouldDefaultToDryRunAndAvoidExternalSideEffects() {
        SystemSyncRunLogResponse response = executionService.runRule(ruleId, new SystemSyncRunRequest());

        assertTrue(response.getDryRun());
        assertEquals("DRY_RUN", response.getExecutionMode());
        assertEquals("SUCCESS", response.getStatus());
        assertEquals("同步规则 dry-run 预览完成；未触发真实同步", response.getMessage());
    }

    @Test
    void realRunShouldFailClosedEvenWhenExplicitlyConfirmed() {
        SystemSyncRunRequest request = new SystemSyncRunRequest();
        request.setDryRun(false);
        request.setConfirmRealRun(true);

        assertThrows(BusinessException.class, () -> executionService.runRule(ruleId, request));
    }

    @Test
    void retryLogShouldRemainSingleLogFailClosed() {
        SystemSyncRunLogResponse failed = executionService.addFailedLogForTest(ruleId);

        assertThrows(BusinessException.class, () -> executionService.retryLog(failed.getId()));
    }

    @Test
    void queueSummaryShouldBeReadOnlyAndNotConsumeQueue() {
        executionService.runRule(ruleId, new SystemSyncRunRequest());

        SystemSyncQueueSummaryResponse summary = executionService.queueSummary();

        assertFalse(summary.getQueueConsumptionEnabled());
        assertEquals("READ_ONLY_SUMMARY", summary.getMode());
        assertEquals(0L, summary.getPending());
        assertEquals(0L, summary.getRunning());
    }

    private SystemIntegrationInterfaceRequest interfaceRequest() {
        SystemIntegrationInterfaceRequest request = new SystemIntegrationInterfaceRequest();
        request.setExternalSystemId(1L);
        request.setInterfaceName("接口");
        request.setMethod("POST");
        request.setPath("/asset/sync");
        return request;
    }

    private SystemFieldMappingRequest mappingRequest(Long interfaceId) {
        SystemFieldMappingRequest request = new SystemFieldMappingRequest();
        request.setInterfaceId(interfaceId);
        request.setMappingName("资产名称");
        request.setSourceField("name");
        request.setTargetField("assetName");
        request.setTransformExpression("trim(value)");
        return request;
    }

    private SystemSyncRuleRequest ruleRequest(Long interfaceId) {
        SystemSyncRuleRequest request = new SystemSyncRuleRequest();
        request.setInterfaceId(interfaceId);
        request.setRuleName("资产同步规则");
        request.setTriggerType("manual");
        request.setRetryCount(1);
        request.setEnabled(true);
        return request;
    }
}
