package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SlaConfigDTO;
import com.ams.dto.SlaConfigOperationDTO;
import com.ams.dto.SlaConfigSaveDTO;
import com.ams.dto.SlaConfigSimulationDTO;
import com.ams.dto.SlaConfigSimulationResultDTO;
import com.ams.dto.SlaRuntimeSummaryDTO;
import com.ams.dto.SlaTimeoutExportDTO;
import com.ams.dto.SlaTimeoutRecordDTO;
import com.ams.entity.SlaConfig;
import com.ams.entity.SlaTimeoutRecord;
import com.ams.mapper.SlaConfigMapper;
import com.ams.mapper.SlaTimeoutRecordMapper;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SlaConfigServiceTest {

    @Mock
    private SlaConfigMapper slaConfigMapper;

    @Mock
    private SlaTimeoutRecordMapper slaTimeoutRecordMapper;

    private SlaConfigService slaConfigService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        slaConfigService = new SlaConfigService(slaConfigMapper, slaTimeoutRecordMapper, new ObjectMapper());
        lenient().when(slaTimeoutRecordMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        lenient().when(slaConfigMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldUpdateLegacyPayloadWithTenantScopeThresholdValidationAndMaskedTargets() {
        SlaConfig existing = config(7L, "ASSET_APPROVAL", "MANAGER_REVIEW", "HIGH");
        when(slaConfigMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(existing);

        SlaConfigSaveDTO payload = new SlaConfigSaveDTO();
        payload.setResponseHours(2);
        payload.setResolveHours(8);
        payload.setWarningRatio(0.75D);
        payload.setStatus(1);
        payload.setNotificationTargets(List.of(Map.of("targetType", "EMAIL", "targetName", "运维组", "contact", "ops@example.com")));
        payload.setOperatorId(42L);
        payload.setReason("SLA策略更新复核");

        SlaConfigDTO updated = slaConfigService.updateConfig(7L, payload);

        assertEquals(1, updated.getStatus());
        assertEquals("HIGH", updated.getPriority());
        assertTrue(updated.getContactMasked().contains("***"));
        assertFalse(updated.getContactMasked().contains("ops@example.com"));
        ArgumentCaptor<SlaConfig> captor = ArgumentCaptor.forClass(SlaConfig.class);
        verify(slaConfigMapper).updateById(captor.capture());
        assertEquals("T001", captor.getValue().getTenantId());
        assertTrue(captor.getValue().getAuditSummary().contains("敏感字段已脱敏"));
    }

    @Test
    void shouldSimulateMostSpecificPolicyReadOnlyAndMaskVariables() {
        SlaConfig global = config(1L, "GLOBAL", "ALL", "NORMAL");
        global.setResolveHours(24);
        SlaConfig specific = config(7L, "ASSET_APPROVAL", "MANAGER_REVIEW", "HIGH");
        specific.setNotificationTargets("[{\"targetType\":\"EMAIL\",\"targetNameMasked\":\"运***\",\"contactMasked\":\"o***（email）\"}]");
        when(slaConfigMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(global, specific));

        SlaConfigSimulationDTO dto = new SlaConfigSimulationDTO();
        dto.setProcessKey("ASSET_APPROVAL");
        dto.setBusinessType("ASSET");
        dto.setNodeKey("MANAGER_REVIEW");
        dto.setPriority("HIGH");
        dto.setNodeStartedAt(LocalDateTime.now().minusHours(1));
        dto.setVariables(Map.of("amount", 1200, "phone", "13800000000"));
        dto.setConfirmed(true);
        dto.setOperatorId(42L);
        dto.setReason("SLA模拟复核");

        SlaConfigSimulationResultDTO result = slaConfigService.simulate(dto);

        assertEquals(7L, result.getMatchedConfigId());
        assertEquals(2, result.getResponseHours());
        assertEquals(8, result.getResolveHours());
        assertTrue(result.getSafeExplanation().contains("未发送真实通知"));
        assertTrue(result.getVariablePreviewMasked().contains("amount=***"));
        assertFalse(result.getVariablePreviewMasked().contains("13800000000"));
        assertTrue(result.getNotificationTargets().get(0).get("contactMasked").contains("***"));
    }

    @Test
    void shouldReadRuntimeSummaryTimeoutRecordsAndExportOnlyMaskedContent() {
        SlaConfig config = config(7L, "ASSET_APPROVAL", "MANAGER_REVIEW", "HIGH");
        SlaTimeoutRecord record = timeoutRecord();
        when(slaConfigMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(config));
        when(slaTimeoutRecordMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(record));

        SlaRuntimeSummaryDTO summary = slaConfigService.runtimeSummary();
        List<SlaTimeoutRecordDTO> records = slaConfigService.listTimeoutRecords("ASSET_APPROVAL", "MANAGER_REVIEW", "OPEN", "HIGH");
        SlaTimeoutExportDTO export = slaConfigService.exportTimeoutRecords(exportRequest());

        assertTrue(summary.getReadOnly());
        assertEquals(1, summary.getRiskCounts().get("HIGH"));
        assertTrue(summary.getExportMaskingNotice().contains("storage key"));
        assertEquals("资***", records.get(0).getMaskedBusinessSummary());
        assertFalse(records.get(0).getApplicantMasked().contains("13800000000"));
        assertTrue(export.getMasked());
        assertEquals(1, export.getRecordCount());
        assertTrue(export.getFieldMaskingPolicy().contains("masked/summary"));
    }

    @Test
    void shouldRejectInvalidThresholdsUnsafeVariablesAndMissingTenant() {
        when(slaConfigMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(config(7L, "ASSET_APPROVAL", "MANAGER_REVIEW", "HIGH"));
        SlaConfigSaveDTO invalid = new SlaConfigSaveDTO();
        invalid.setResponseHours(10);
        invalid.setResolveHours(2);
        invalid.setOperatorId(42L);
        invalid.setReason("阈值复核");
        assertThrows(BusinessException.class, () -> slaConfigService.updateConfig(7L, invalid));

        SlaConfigSimulationDTO unsafe = simulationDto();
        unsafe.setVariables(Map.of("__proto__", "polluted"));
        assertThrows(BusinessException.class, () -> slaConfigService.simulate(unsafe));

        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> slaConfigService.listConfigs(null, null, null, null));
    }

    @Test
    void shouldRequireConfirmedAuditForEnableDisableExportAndOnlyAffectSlaTables() {
        when(slaConfigMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(config(7L, "ASSET_APPROVAL", "MANAGER_REVIEW", "HIGH"));

        SlaConfigDTO enabled = slaConfigService.enableConfig(7L, operation());
        assertEquals("ACTIVE", enabled.getStatusText());
        verify(slaConfigMapper).updateById(any(SlaConfig.class));

        SlaConfigOperationDTO missingConfirmed = operation();
        missingConfirmed.setConfirmed(false);
        assertThrows(BusinessException.class, () -> slaConfigService.disableConfig(7L, missingConfirmed));

        SlaTimeoutExportDTO exportRequest = exportRequest();
        exportRequest.setConfirmed(false);
        assertThrows(BusinessException.class, () -> slaConfigService.exportTimeoutRecords(exportRequest));
    }

    private SlaConfig config(Long id, String processKey, String nodeKey, String priority) {
        SlaConfig config = new SlaConfig();
        config.setId(id);
        config.setTenantId("T001");
        config.setProcessKey(processKey);
        config.setBusinessType("ASSET");
        config.setNodeKey(nodeKey);
        config.setPriority(priority);
        config.setResponseHours(2);
        config.setResolveHours(8);
        config.setWarningRatio(0.75D);
        config.setEscalationRatio(0.9D);
        config.setStatus("ACTIVE");
        config.setNotificationTargets("[]");
        return config;
    }

    private SlaTimeoutRecord timeoutRecord() {
        SlaTimeoutRecord record = new SlaTimeoutRecord();
        record.setId(10L);
        record.setTenantId("T001");
        record.setConfigId(7L);
        record.setProcessInstanceId("PROC-RAW-001");
        record.setProcessKey("ASSET_APPROVAL");
        record.setBusinessType("ASSET");
        record.setNodeKey("MANAGER_REVIEW");
        record.setNodeName("经理审批");
        record.setPriority("HIGH");
        record.setResolveDueAt(LocalDateTime.now().minusHours(2));
        record.setTimeoutAt(LocalDateTime.now().minusHours(1));
        record.setTimeoutMinutes(120L);
        record.setRiskLevel("HIGH");
        record.setStatus("OPEN");
        record.setMaskedBusinessSummary("资产申请#A-001");
        record.setApplicantMasked("张三 13800000000");
        record.setAssigneeMasked("李四 13900000000");
        return record;
    }

    private SlaConfigSimulationDTO simulationDto() {
        SlaConfigSimulationDTO dto = new SlaConfigSimulationDTO();
        dto.setProcessKey("ASSET_APPROVAL");
        dto.setBusinessType("ASSET");
        dto.setNodeKey("MANAGER_REVIEW");
        dto.setPriority("HIGH");
        dto.setConfirmed(true);
        dto.setOperatorId(42L);
        dto.setReason("模拟复核");
        return dto;
    }

    private SlaConfigOperationDTO operation() {
        SlaConfigOperationDTO dto = new SlaConfigOperationDTO();
        dto.setConfirmed(true);
        dto.setOperatorId(42L);
        dto.setReason("启停复核");
        dto.setAuditEvidence("SLA_GATE");
        return dto;
    }

    private SlaTimeoutExportDTO exportRequest() {
        SlaTimeoutExportDTO dto = new SlaTimeoutExportDTO();
        dto.setProcessKey("ASSET_APPROVAL");
        dto.setNodeKey("MANAGER_REVIEW");
        dto.setStatus("OPEN");
        dto.setRiskLevel("HIGH");
        dto.setConfirmed(true);
        dto.setOperatorId(42L);
        dto.setReason("脱敏导出复核");
        dto.setAuditEvidence("SLA_EXPORT_GATE");
        return dto;
    }
}
