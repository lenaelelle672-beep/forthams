package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.SlaConfig;
import com.ams.mapper.SlaConfigMapper;
import com.ams.mapper.WorkOrderMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SlaServiceTest {

    @Mock
    private SlaConfigMapper slaConfigMapper;

    @Mock
    private WorkOrderMapper workOrderMapper;

    private SlaService slaService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
        slaService = new SlaService(slaConfigMapper, workOrderMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldCreateTenantConfigsFromGlobalDefaultsWhenMissing() {
        SlaConfig globalLow = config(10L, "0", "LOW", 72, 336, "0.80", 1);
        SlaConfig globalMedium = config(11L, "0", "MEDIUM", 48, 168, "0.80", 1);
        SlaConfig globalHigh = config(12L, "0", "HIGH", 24, 72, "0.80", 1);
        SlaConfig globalCritical = config(13L, "0", "CRITICAL", 8, 24, "0.80", 1);
        SlaConfig tenantLow = config(20L, "dept:1", "LOW", 72, 336, "0.80", 1);

        when(slaConfigMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(tenantLow))
                .thenReturn(List.of(globalLow, globalMedium, globalHigh, globalCritical))
                .thenReturn(List.of(tenantLow));

        slaService.listConfigs();

        ArgumentCaptor<SlaConfig> captor = ArgumentCaptor.forClass(SlaConfig.class);
        verify(slaConfigMapper, org.mockito.Mockito.times(3)).insert(captor.capture());
        List<SlaConfig> inserted = captor.getAllValues();
        assertEquals(List.of("MEDIUM", "HIGH", "CRITICAL"),
                inserted.stream().map(SlaConfig::getPriority).toList());
        inserted.forEach(item -> assertEquals("dept:1", item.getTenantId()));
    }

    @Test
    void shouldRejectUpdatingAnotherTenantConfig() {
        when(slaConfigMapper.selectById(8L))
                .thenReturn(config(8L, "T002", "HIGH", 24, 72, "0.80", 1));

        assertThrows(BusinessException.class,
                () -> slaService.updateConfig(8L, config(8L, "T002", "HIGH", 12, 48, "0.75", 1)));
    }

    @Test
    void shouldValidateUpdatedConfigValues() {
        when(slaConfigMapper.selectById(9L))
                .thenReturn(config(9L, "dept:1", "HIGH", 24, 72, "0.80", 1));

        SlaConfig invalid = config(9L, "dept:1", "HIGH", 0, 72, "0.80", 1);

        assertThrows(BusinessException.class, () -> slaService.updateConfig(9L, invalid));
    }

    @Test
    void shouldUpdateOnlyCurrentTenantConfig() {
        SlaConfig existing = config(9L, "dept:1", "HIGH", 24, 72, "0.80", 1);
        when(slaConfigMapper.selectById(9L)).thenReturn(existing);

        slaService.updateConfig(9L, config(9L, "dept:1", "HIGH", 12, 48, "0.75", 1));

        assertEquals(12, existing.getResponseHours());
        assertEquals(48, existing.getResolveHours());
        assertEquals(new BigDecimal("0.75"), existing.getWarningRatio());
        verify(slaConfigMapper).updateById(existing);
    }

    private SlaConfig config(Long id, String tenantId, String priority, int responseHours, int resolveHours,
                             String warningRatio, int status) {
        SlaConfig config = new SlaConfig();
        config.setId(id);
        config.setTenantId(tenantId);
        config.setPriority(priority);
        config.setResponseHours(responseHours);
        config.setResolveHours(resolveHours);
        config.setWarningRatio(new BigDecimal(warningRatio));
        config.setStatus(status);
        return config;
    }
}
