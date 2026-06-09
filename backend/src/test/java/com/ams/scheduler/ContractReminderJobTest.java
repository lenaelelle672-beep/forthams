package com.ams.scheduler;

import com.ams.context.TenantContext;
import com.ams.entity.Contract;
import com.ams.service.ContractService;
import com.ams.service.NotificationService;
import com.ams.service.TenantService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContractReminderJobTest {

    @Mock
    private ContractService contractService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private TenantService tenantService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void scanExpiringContractsShouldBindAndClearTenantContext() {
        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1", "dept:2"));
        when(contractService.getExpiring(30)).thenAnswer(invocation -> {
            String tenantId = TenantContext.getTenantId();
            assertTrue(List.of("dept:1", "dept:2").contains(tenantId));
            return "dept:1".equals(tenantId) ? List.of(contract()) : List.of();
        });
        when(notificationService.sendByTemplateToRole(eq("CONTRACT_EXPIRING"), eq("ASSET_MANAGER"),
                any(Map.class), eq(100L), eq("contract"))).thenAnswer(invocation -> {
            assertEquals("dept:1", TenantContext.getTenantId());
            return 1;
        });

        job().scanExpiringContracts();

        verify(contractService, times(2)).getExpiring(30);
        verify(notificationService).sendByTemplateToRole(eq("CONTRACT_EXPIRING"), eq("ASSET_MANAGER"),
                any(Map.class), eq(100L), eq("contract"));
        assertNull(TenantContext.getTenantId());
    }

    private ContractReminderJob job() {
        return new ContractReminderJob(contractService, notificationService, tenantService);
    }

    private Contract contract() {
        Contract contract = new Contract();
        contract.setId(100L);
        contract.setContractName("年度维保合同");
        contract.setContractNo("HT-2026-001");
        contract.setEndDate(LocalDate.now().plusDays(10));
        return contract;
    }
}
