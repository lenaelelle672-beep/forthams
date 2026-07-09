package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemExternalSystemDTO;
import com.ams.dto.SystemExternalSystemOperationDTO;
import com.ams.dto.SystemExternalSystemSaveDTO;
import com.ams.dto.SystemExternalSystemValidationResultDTO;
import com.ams.entity.SystemExternalSystem;
import com.ams.mapper.SystemExternalSystemMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SystemExternalSystemServiceTest {

    @Mock
    private SystemExternalSystemMapper externalSystemMapper;

    private SystemExternalSystemService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new SystemExternalSystemService(externalSystemMapper);
        lenient().when(externalSystemMapper.insert(any(SystemExternalSystem.class))).thenAnswer(invocation -> {
            SystemExternalSystem entity = invocation.getArgument(0);
            entity.setId(7L);
            return 1;
        });
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void createShouldUseTenantContextAndPersistOnlyMaskedCredentialSummary() {
        when(externalSystemMapper.selectOne(any(QueryWrapper.class))).thenReturn(null);
        SystemExternalSystemSaveDTO request = validRequest();
        request.setBaseUrl("https://erp.example.com/api?ticket=" + rawCredential() + "#private");
        request.setAuthConfig(Map.of(
                "apiKey", rawCredential(),
                "clientSecret", "client-" + rawCredential()
        ));

        SystemExternalSystemDTO created = service.create(request, 42L);

        assertEquals("tenant-a", created.getTenantId());
        assertEquals("ERP_CORE", created.getSystemCode());
        assertEquals("https://erp.example.com/api", created.getMaskedBaseUrl());
        assertTrue(created.getAuthConfigured());
        assertTrue(created.getConfigMasked());
        assertEquals("2 项认证材料已脱敏", created.getMaskedSecretSummary());
        assertFalse(created.getMaskedBaseUrl().contains(rawCredential()));

        ArgumentCaptor<SystemExternalSystem> captor = ArgumentCaptor.forClass(SystemExternalSystem.class);
        verify(externalSystemMapper).insert(captor.capture());
        SystemExternalSystem persisted = captor.getValue();
        assertEquals("tenant-a", persisted.getTenantId());
        assertEquals("https://erp.example.com/api", persisted.getBaseUrlMasked());
        assertFalse(persisted.getAuthConfigSummary().contains(rawCredential()));
        assertFalse(persisted.getMaskedSecretSummary().contains(rawCredential()));
        assertFalse(persisted.getSecretFingerprint().contains(rawCredential()));
        assertEquals(42L, persisted.getLastOperatorId());
        assertEquals("CREATE", persisted.getLastOperation());
    }

    @Test
    void createShouldRejectDuplicateCodeInvalidUrlUnknownTypeAndMissingAudit() {
        when(externalSystemMapper.selectOne(any(QueryWrapper.class))).thenReturn(storedSystem(true));
        assertThrows(BusinessException.class, () -> service.create(validRequest(), 42L));

        SystemExternalSystemSaveDTO localhost = validRequest();
        localhost.setBaseUrl("http://localhost/internal");
        when(externalSystemMapper.selectOne(any(QueryWrapper.class))).thenReturn(null);
        assertThrows(BusinessException.class, () -> service.create(localhost, 42L));

        SystemExternalSystemSaveDTO unknownType = validRequest();
        unknownType.setSystemType("LEGACY");
        assertThrows(BusinessException.class, () -> service.create(unknownType, 42L));

        SystemExternalSystemSaveDTO missingAudit = validRequest();
        missingAudit.setReason(null);
        missingAudit.setAuditEvidence(null);
        assertThrows(BusinessException.class, () -> service.create(missingAudit, 42L));
    }

    @Test
    void listGetAndMissingTenantShouldStayTenantScoped() {
        when(externalSystemMapper.selectList(any(QueryWrapper.class))).thenReturn(java.util.List.of(storedSystem(true)));
        when(externalSystemMapper.selectOne(any(QueryWrapper.class))).thenReturn(null);

        assertEquals(1, service.list("ERP", "ERP", "ENABLED").size());
        assertThrows(BusinessException.class, () -> service.get(404L));

        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> service.list(null, null, null));
    }

    @Test
    void updateShouldKeepExistingAuthWhenCredentialNotResubmitted() {
        SystemExternalSystem stored = storedSystem(false);
        when(externalSystemMapper.selectOne(any(QueryWrapper.class))).thenReturn(stored).thenReturn(null);
        SystemExternalSystemSaveDTO request = validRequest();
        request.setAuthConfig(Map.of());
        request.setEnabled(true);

        SystemExternalSystemDTO updated = service.update(7L, request, 42L);

        assertTrue(updated.getAuthConfigured());
        assertEquals("ENABLED", updated.getStatus());
        ArgumentCaptor<SystemExternalSystem> captor = ArgumentCaptor.forClass(SystemExternalSystem.class);
        verify(externalSystemMapper).updateById(captor.capture());
        assertEquals("UPDATE", captor.getValue().getLastOperation());
        assertFalse(captor.getValue().getMaskedSecretSummary().contains(rawCredential()));
    }

    @Test
    void enableDisableShouldRequireConfirmedAuditAndCurrentOperator() {
        SystemExternalSystem stored = storedSystem(false);
        when(externalSystemMapper.selectOne(any(QueryWrapper.class))).thenReturn(stored, stored);

        SystemExternalSystemOperationDTO missingConfirm = operation();
        missingConfirm.setConfirmed(false);
        assertThrows(BusinessException.class, () -> service.enable(7L, missingConfirm, 42L));

        SystemExternalSystemOperationDTO mismatch = operation();
        mismatch.setOperatorId(99L);
        assertThrows(BusinessException.class, () -> service.enable(7L, mismatch, 42L));

        SystemExternalSystemDTO enabled = service.enable(7L, operation(), 42L);
        assertTrue(enabled.getEnabled());
        assertEquals("ENABLE", enabled.getLastOperation());

        SystemExternalSystemDTO disabled = service.disable(7L, operation(), 42L);
        assertFalse(disabled.getEnabled());
        assertEquals("DISABLE", disabled.getLastOperation());
    }

    @Test
    void validateShouldBeConfigOnlyAndNeverExposeRawCredential() {
        SystemExternalSystem stored = storedSystem(true);
        when(externalSystemMapper.selectOne(any(QueryWrapper.class))).thenReturn(stored);

        SystemExternalSystemValidationResultDTO result = service.validateConfig(7L, operation(), 42L);

        assertTrue(result.getValid());
        assertTrue(result.getConfigOnly());
        assertTrue(result.getNoRealExternalCall());
        assertEquals("外部系统配置校验通过，未触发真实外部调用", result.getMessage());
        assertFalse(result.getMessage().contains(rawCredential()));
        assertFalse(result.getTargetSummary().contains(rawCredential()));
        verify(externalSystemMapper).updateById(stored);
    }

    @Test
    void authRequiredTypeShouldRejectMissingCredentialOnCreate() {
        when(externalSystemMapper.selectOne(any(QueryWrapper.class))).thenReturn(null);
        SystemExternalSystemSaveDTO request = validRequest();
        request.setAuthConfig(Map.of());

        assertThrows(BusinessException.class, () -> service.create(request, 42L));
        verifyNoInteractionsAfterDuplicateCheck();
    }

    private void verifyNoInteractionsAfterDuplicateCheck() {
        verify(externalSystemMapper).selectOne(any(QueryWrapper.class));
    }

    private SystemExternalSystemSaveDTO validRequest() {
        SystemExternalSystemSaveDTO request = new SystemExternalSystemSaveDTO();
        request.setTenantId("ignored-tenant");
        request.setSystemCode("erp_core");
        request.setSystemName("ERP Core");
        request.setSystemType("ERP");
        request.setBaseUrl("https://erp.example.com/api");
        request.setAuthType("API_KEY");
        request.setAuthConfig(Map.of("apiKey", rawCredential()));
        request.setEnabled(true);
        request.setOperatorId(42L);
        request.setReason("V3 保存复核");
        return request;
    }

    private SystemExternalSystemOperationDTO operation() {
        SystemExternalSystemOperationDTO operation = new SystemExternalSystemOperationDTO();
        operation.setConfirmed(true);
        operation.setOperatorId(42L);
        operation.setReason("V3 操作复核");
        operation.setAuditEvidence("ES-GATE");
        return operation;
    }

    private SystemExternalSystem storedSystem(boolean enabled) {
        SystemExternalSystem entity = new SystemExternalSystem();
        entity.setId(7L);
        entity.setTenantId("tenant-a");
        entity.setSystemCode("ERP_CORE");
        entity.setSystemName("ERP Core");
        entity.setSystemType("ERP");
        entity.setBaseUrlMasked("https://erp.example.com/api");
        entity.setAuthType("API_KEY");
        entity.setAuthConfigured(true);
        entity.setConfigMasked(true);
        entity.setAuthConfigSummary("认证配置已脱敏，配置项 1 项，敏感项 1 项");
        entity.setMaskedSecretSummary("1 项认证材料已脱敏");
        entity.setSecretFingerprint("abcdef1234567890");
        entity.setEnabled(enabled);
        entity.setStatus(enabled ? "ENABLED" : "DISABLED");
        entity.setHealthStatus("UNKNOWN");
        entity.setCreateTime(LocalDateTime.now().minusDays(1));
        entity.setUpdateTime(LocalDateTime.now());
        entity.setRemoved(0);
        return entity;
    }

    private String rawCredential() {
        return "raw" + "-external-credential";
    }
}
