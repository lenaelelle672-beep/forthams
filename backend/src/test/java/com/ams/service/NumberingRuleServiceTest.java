package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.NumberingRuleDTO;
import com.ams.dto.NumberingRuleMetaDTO;
import com.ams.dto.NumberingRulePreviewRequestDTO;
import com.ams.dto.NumberingRulePreviewRespDTO;
import com.ams.entity.SystemConfig;
import com.ams.mapper.SystemConfigMapper;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
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
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NumberingRuleServiceTest {

    @Mock
    private SystemConfigMapper systemConfigMapper;

    private NumberingRuleService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new NumberingRuleService(systemConfigMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listShouldMergeTenantScopedSystemConfigRowsWithDefaults() {
        when(systemConfigMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(config("numbering.rule.asset", "FIX-{YYYY}-{SEQ}")));

        List<NumberingRuleDTO> rules = service.list();

        assertTrue(rules.size() >= 6);
        NumberingRuleDTO assetRule = rules.stream().filter(item -> "numbering.rule.asset".equals(item.getRuleKey())).findFirst().orElseThrow();
        assertEquals("FIX-{YYYY}-{SEQ}", assetRule.getTemplate());
        assertEquals("system_config", assetRule.getSource());
        assertEquals(true, assetRule.getTenantScoped());
        assertEquals(true, assetRule.getReadOnly());

        ArgumentCaptor<QueryWrapper<SystemConfig>> captor = ArgumentCaptor.forClass(QueryWrapper.class);
        verify(systemConfigMapper).selectList(captor.capture());
        String sqlSegment = captor.getValue().getSqlSegment();
        assertTrue(sqlSegment.contains("tenant_id"));
        assertTrue(sqlSegment.contains("config_group"));
        assertTrue(sqlSegment.contains("removed"));
        assertTrue(sqlSegment.contains("config_key"));
    }

    @Test
    void detailShouldUseSystemConfigAuthorityOrDefaultFallback() {
        when(systemConfigMapper.selectOne(any(Wrapper.class))).thenReturn(config("numbering.rule.workorder", "WO-{YY}{MM}-{SEQ}"));

        NumberingRuleDTO detail = service.get("numbering.rule.workorder");

        assertEquals("numbering.rule.workorder", detail.getRuleKey());
        assertEquals("WO-{YY}{MM}-{SEQ}", detail.getTemplate());
        assertEquals("system_config", detail.getSource());

        when(systemConfigMapper.selectOne(any(Wrapper.class))).thenReturn(null);
        NumberingRuleDTO fallback = service.get("approval");
        assertEquals("numbering.rule.approval", fallback.getRuleKey());
        assertEquals("default", fallback.getSource());
    }

    @Test
    void metaShouldAdvertiseNoPersistencePreviewAndNonGoals() {
        NumberingRuleMetaDTO meta = service.meta();

        assertEquals(true, meta.getTenantScoped());
        assertEquals(true, meta.getReadOnly());
        assertEquals(true, meta.getNoPersistencePreview());
        assertEquals(true, meta.getNoSequenceReserved());
        assertEquals(false, meta.getRuntimeEffect());
        assertEquals(false, meta.getCacheRefreshed());
        assertEquals(false, meta.getSequenceAllocated());
        assertEquals(false, meta.getPersistent());
        assertTrue(meta.getNonGoals().toString().contains("不保证并发唯一"));
        assertTrue(meta.getNonGoals().toString().contains("不完成基础资料组"));
    }

    @Test
    void previewShouldBeDeterministicAndNeverAllocateOrPersistSequence() {
        NumberingRulePreviewRequestDTO request = NumberingRulePreviewRequestDTO.builder()
                .ruleKey("numbering.rule.asset")
                .template("AS-{YYYYMMDD}-{HH}{MI}{SS}-{SEQ}-{BAD}")
                .sampleAt("2026-07-08T09:10:11")
                .sampleSequence("009")
                .build();
        request.putUnknownInput("tenantId", "tenant-b");

        NumberingRulePreviewRespDTO response = service.preview(request);

        assertEquals("AS-20260708-091011-009-{BAD}", response.getPreviewValue());
        assertTrue(response.getUsedVariables().contains("{YYYYMMDD}"));
        assertTrue(response.getUsedVariables().contains("{SEQ}"));
        assertTrue(response.getRejectedVariables().contains("{BAD}"));
        assertTrue(response.getRejectedVariables().contains("tenantId"));
        assertEquals(true, response.getNoPersistence());
        assertEquals(true, response.getNoSequenceReserved());
        assertEquals(false, response.getRuntimeEffect());
        assertEquals(false, response.getCacheRefreshed());
        assertEquals(false, response.getSequenceAllocated());
        assertEquals(false, response.getPersistent());
        assertTrue(response.getWarnings().toString().contains("不保证并发唯一"));
        verify(systemConfigMapper, never()).insert(any(SystemConfig.class));
        verify(systemConfigMapper, never()).update(any(SystemConfig.class), any(Wrapper.class));
    }

    @Test
    void invalidRuleKeyShouldRejectBeforeMapperWhenNotNumberingRule() {
        assertThrows(BusinessException.class, () -> service.get("numbering.rule.bad key"));
    }

    @Test
    void missingTenantShouldFailClosedBeforeMapper() {
        TenantContext.clear();

        assertThrows(AccessDeniedException.class, () -> service.list());
        assertThrows(AccessDeniedException.class, () -> service.get("numbering.rule.asset"));
        assertThrows(AccessDeniedException.class, () -> service.meta());
        assertThrows(AccessDeniedException.class, () -> service.preview(new NumberingRulePreviewRequestDTO()));
        verifyNoInteractions(systemConfigMapper);
    }

    private SystemConfig config(String key, String value) {
        SystemConfig config = new SystemConfig();
        config.setId(7L);
        config.setTenantId("tenant-a");
        config.setConfigGroup("SYSTEM");
        config.setConfigKey(key);
        config.setConfigName(key + " 名称");
        config.setConfigValue(value);
        config.setConfigType("STRING");
        config.setRemoved(0);
        config.setUpdateTime(LocalDateTime.of(2026, 7, 8, 9, 10));
        return config;
    }
}
