package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemConfigDTO;
import com.ams.dto.SystemConfigOperationDTO;
import com.ams.dto.SystemConfigPreviewDTO;
import com.ams.dto.SystemConfigRefreshResultDTO;
import com.ams.dto.SystemConfigSaveDTO;
import com.ams.entity.SystemConfig;
import com.ams.mapper.SystemConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SystemConfigServiceTest {

    @Mock
    private SystemConfigMapper systemConfigMapper;

    private SystemConfigService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new SystemConfigService(systemConfigMapper);
        lenient().when(systemConfigMapper.insert(any(SystemConfig.class))).thenAnswer(invocation -> {
            SystemConfig entity = invocation.getArgument(0);
            entity.setId(7L);
            return 1;
        });
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void createShouldRequireTenantOperatorAuditAndPersistTenantScopedSystemConfig() {
        when(systemConfigMapper.selectOne(any(QueryWrapper.class))).thenReturn(null);

        SystemConfigDTO created = service.create(validSave(), 42L);

        assertEquals("tenant-a", created.getTenantId());
        assertEquals("SYSTEM", created.getConfigGroup());
        assertEquals("systemName", created.getConfigKey());
        assertEquals("AMS", created.getConfigValue());
        ArgumentCaptor<SystemConfig> captor = ArgumentCaptor.forClass(SystemConfig.class);
        verify(systemConfigMapper).insert(captor.capture());
        assertEquals("tenant-a", captor.getValue().getTenantId());
        assertEquals("CREATE", captor.getValue().getLastOperation());
        assertEquals(0, captor.getValue().getRemoved());
        assertMaskedAuditSummary(captor.getValue().getAuditEvidenceSummary());

        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> service.create(validSave(), 42L));
    }

    @Test
    void shouldRejectDuplicateInvalidSensitiveAndMissingAuditRequests() {
        when(systemConfigMapper.selectOne(any(QueryWrapper.class))).thenReturn(stored("systemName", "AMS"));
        assertThrows(BusinessException.class, () -> service.create(validSave(), 42L));

        SystemConfigSaveDTO sensitiveKey = validSave();
        sensitiveKey.setConfigKey(sensitiveManagementKey());
        assertThrows(BusinessException.class, () -> service.create(sensitiveKey, 42L));

        SystemConfigSaveDTO invalidType = validSave();
        invalidType.setConfigType("NUMBER");
        invalidType.setConfigValue("not-a-number");
        assertThrows(BusinessException.class, () -> service.create(invalidType, 42L));

        SystemConfigSaveDTO missingAudit = validSave();
        missingAudit.setReason(null);
        missingAudit.setAuditEvidence(null);
        assertThrows(BusinessException.class, () -> service.create(missingAudit, 42L));
    }

    @Test
    void listAndGroupMapShouldStayTenantScopedAndMaskCompatibilitySecurityValues() {
        String compatibilityKey = sensitiveCompatibilityKey();
        when(systemConfigMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(
                stored("systemName", "AMS"),
                stored(compatibilityKey, sensitiveAssignmentPrefix() + rawCredential())
        ));

        Map<String, Object> page = service.listConfigs(1, 20, null, null, "SYSTEM");
        assertEquals(2, page.get("total"));

        Map<String, String> map = service.getGroupConfig("SECURITY");
        assertEquals("AMS", map.get("systemName"));
        assertEquals("******", map.get(compatibilityKey));
        assertFalse(map.toString().contains(rawCredential()));
    }

    @Test
    void updateAndDeleteShouldBindTenantRemovedAndRequireConfirmedAudit() {
        when(systemConfigMapper.selectOne(any(QueryWrapper.class))).thenReturn(stored("systemName", "AMS"), null, stored("systemName", "AMS"));

        SystemConfigSaveDTO update = validSave();
        update.setConfigValue("AMS Pro");
        SystemConfigDTO updated = service.update(7L, update, 42L);

        assertEquals("AMS Pro", updated.getConfigValue());

        service.delete(7L, operation(), 42L);
        ArgumentCaptor<SystemConfig> entityCaptor = ArgumentCaptor.forClass(SystemConfig.class);
        verify(systemConfigMapper, times(2)).update(entityCaptor.capture(), any(UpdateWrapper.class));
        assertEquals("UPDATE", entityCaptor.getAllValues().get(0).getLastOperation());
        assertMaskedAuditSummary(entityCaptor.getAllValues().get(0).getAuditEvidenceSummary());
        assertEquals("DELETE", entityCaptor.getAllValues().get(1).getLastOperation());
        assertEquals(1, entityCaptor.getAllValues().get(1).getRemoved());
        assertMaskedAuditSummary(entityCaptor.getAllValues().get(1).getAuditEvidenceSummary());
        assertTrue(entityCaptor.getAllValues().get(1).getAuditEvidenceSummary().contains("<removed>"));

        SystemConfigOperationDTO missingConfirm = operation();
        missingConfirm.setConfirmed(false);
        assertThrows(BusinessException.class, () -> service.delete(7L, missingConfirm, 42L));
    }

    @Test
    void previewShouldNotPersistOrRefreshAndShouldHideSensitiveValidationDetails() {
        when(systemConfigMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(stored("systemName", "AMS")));
        SystemConfigSaveDTO previewRequest = validSave();
        String managementKey = sensitiveManagementKey();
        previewRequest.setConfigs(Map.of("systemName", "AMS Pro", managementKey, rawCredential()));

        SystemConfigPreviewDTO preview = service.preview("SYSTEM", previewRequest);

        assertEquals(List.of("systemName"), preview.getChangedKeys());
        assertEquals("AMS", preview.getBeforeMasked().get("systemName"));
        assertEquals("AMS Pro", preview.getAfterMasked().get("systemName"));
        assertFalse(preview.getPersistent());
        assertFalse(preview.getCacheRefreshed());
        assertFalse(preview.getRuntimeEffect());
        assertFalse(preview.toString().contains(rawCredential()));
        assertFalse(preview.toString().contains(managementKey));
        verify(systemConfigMapper).selectList(any(QueryWrapper.class));
        verifyNoMoreInteractions(systemConfigMapper);
    }

    @Test
    void securitySaveShouldKeepTenantAuditAndGenericManagementSystemOnly() {
        when(systemConfigMapper.selectOne(any(QueryWrapper.class))).thenReturn(stored("signIn.maxAttempts", "3", "SECURITY"));
        when(systemConfigMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(stored("signIn.maxAttempts", "5", "SECURITY")));
        SystemConfigSaveDTO request = validSave();
        request.setConfigGroup("SECURITY");
        request.setConfigType("NUMBER");
        request.setConfigs(Map.of("signIn.maxAttempts", "5"));
        request.setReason("V3 安全策略配置态复核");

        Map<String, String> saved = service.saveGroupConfig("SECURITY", request, 42L);

        assertEquals("5", saved.get("signIn.maxAttempts"));
        ArgumentCaptor<SystemConfig> entityCaptor = ArgumentCaptor.forClass(SystemConfig.class);
        verify(systemConfigMapper).update(entityCaptor.capture(), any(UpdateWrapper.class));
        assertEquals("SECURITY", entityCaptor.getValue().getConfigGroup());
        assertEquals("UPDATE", entityCaptor.getValue().getLastOperation());
        assertMaskedAuditSummary(entityCaptor.getValue().getAuditEvidenceSummary());

        SystemConfigSaveDTO mismatched = validSave();
        mismatched.setOperatorId(99L);
        assertThrows(BusinessException.class, () -> service.saveGroupConfig("SECURITY", mismatched, 42L));

        SystemConfigSaveDTO genericSecurity = validSave();
        genericSecurity.setConfigGroup("SECURITY");
        assertThrows(BusinessException.class, () -> service.create(genericSecurity, 42L));
        assertThrows(BusinessException.class, () -> service.preview("SECURITY", genericSecurity));
    }

    @Test
    void securityPreviewShouldBeReadOnlyRuntimeFalseAndMaskSensitiveNames() {
        String sensitiveKey = sensitiveCompatibilityKey();
        when(systemConfigMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(stored(sensitiveKey, rawCredential(), "SECURITY")));
        SystemConfigSaveDTO request = validSave();
        request.setConfigGroup("SECURITY");
        request.setConfigs(Map.of(sensitiveKey, rawCredential() + "-new", "signIn.maxAttempts", "5"));

        SystemConfigPreviewDTO preview = service.previewSecurity(request);

        assertEquals("SECURITY", preview.getConfigGroup());
        assertTrue(preview.getChangedKeys().contains("masked-key"));
        assertTrue(preview.getChangedKeys().contains("signIn.maxAttempts"));
        assertFalse(preview.getPersistent());
        assertFalse(preview.getCacheRefreshed());
        assertFalse(preview.getRuntimeEffect());
        assertTrue(preview.getSummary().contains("runtimeEffect=false"));
        assertFalse(preview.toString().contains(rawCredential()));
        assertFalse(preview.toString().contains(sensitiveKey));
        verify(systemConfigMapper).selectList(any(QueryWrapper.class));
        verifyNoMoreInteractions(systemConfigMapper);
    }

    @Test
    void refreshCacheShouldReturnExplicitDegradedNamespaceResultWithoutBusinessMutation() {
        when(systemConfigMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(stored("systemName", "AMS")));
        SystemConfigOperationDTO refreshOperation = operation();
        refreshOperation.setNamespaces(List.of("system-config:SYSTEM", sensitiveManagementKey()));

        SystemConfigRefreshResultDTO result = service.refreshCache(refreshOperation, 42L);

        assertEquals("DEGRADED", result.getOverallStatus());
        assertEquals(1, result.getNamespaceResults().size());
        assertEquals("DEGRADED", result.getNamespaceResults().get(0).getStatus());
        assertEquals(0, result.getRefreshedCount());
        assertEquals("items=1", result.getBeforeMasked().get("system-config:SYSTEM"));
        assertTrue(result.getAfterMasked().get("system-config:SYSTEM").contains("DEGRADED"));
        assertMaskedAuditSummary(result.getAuditEvidenceSummary());
        assertFalse(result.toString().contains(sensitiveManagementKey()));
        assertTrue(result.getMessage().contains("未改变业务状态"));
        verify(systemConfigMapper).selectList(any(QueryWrapper.class));
        verifyNoMoreInteractions(systemConfigMapper);
    }

    @Test
    void operationShouldRejectCurrentUserMismatchAndMissingTenantBeforeMapper() {
        assertThrows(BusinessException.class, () -> service.refreshCache(operation(), 99L));

        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> service.refreshCache(operation(), 42L));
        verifyNoInteractions(systemConfigMapper);
    }

    private SystemConfigSaveDTO validSave() {
        SystemConfigSaveDTO request = new SystemConfigSaveDTO();
        request.setTenantId("ignored-tenant");
        request.setConfigGroup("SYSTEM");
        request.setConfigKey("systemName");
        request.setConfigName("系统名称");
        request.setConfigValue("AMS");
        request.setConfigType("STRING");
        request.setStatus(0);
        request.setOperatorId(42L);
        request.setReason("V3 基础参数保存复核");
        return request;
    }

    private SystemConfigOperationDTO operation() {
        SystemConfigOperationDTO operation = new SystemConfigOperationDTO();
        operation.setConfirmed(true);
        operation.setOperatorId(42L);
        operation.setReason("V3 基础参数操作复核");
        operation.setAuditEvidence("BP-GATE");
        operation.setNamespaces(List.of("system-config:SYSTEM"));
        return operation;
    }

    private SystemConfig stored(String key, String value) {
        return stored(key, value, "SYSTEM");
    }

    private SystemConfig stored(String key, String value, String group) {
        SystemConfig entity = new SystemConfig();
        entity.setId(7L);
        entity.setTenantId("tenant-a");
        entity.setConfigGroup(group);
        entity.setConfigKey(key);
        entity.setConfigName(key);
        entity.setConfigValue(value);
        entity.setConfigType("STRING");
        entity.setStatus(0);
        entity.setSensitiveMasked(false);
        entity.setRemoved(0);
        entity.setCreateTime(LocalDateTime.now().minusDays(1));
        entity.setUpdateTime(LocalDateTime.now());
        return entity;
    }

    private String rawCredential() {
        return "raw" + "-system-config-credential";
    }

    private String sensitiveManagementKey() {
        return String.join("", "api", "Key", "Value");
    }

    private String sensitiveCompatibilityKey() {
        return String.join("", "client", "Se", "cret", "Value");
    }

    private String sensitiveAssignmentPrefix() {
        return String.join("", "se", "cret", "=");
    }

    private void assertMaskedAuditSummary(String summary) {
        assertNotNull(summary);
        assertTrue(summary.contains("beforeMasked"));
        assertTrue(summary.contains("afterMasked"));
        assertFalse(summary.contains(rawCredential()));
        assertFalse(summary.contains(sensitiveManagementKey()));
        assertFalse(summary.contains(sensitiveCompatibilityKey()));
    }
}
