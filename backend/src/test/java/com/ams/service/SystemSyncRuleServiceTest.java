package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemFieldMappingRequest;
import com.ams.dto.SystemIntegrationInterfaceRequest;
import com.ams.dto.SystemSyncRuleRequest;
import com.ams.dto.SystemSyncRuleResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SystemSyncRuleServiceTest {

    private SystemIntegrationInterfaceService interfaceService;
    private SystemFieldMappingService fieldMappingService;
    private SystemSyncRuleService service;
    private Long interfaceId;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        interfaceService = new SystemIntegrationInterfaceService();
        fieldMappingService = new SystemFieldMappingService(interfaceService);
        service = new SystemSyncRuleService(interfaceService, fieldMappingService);
        interfaceId = interfaceService.create(interfaceRequest()).getId();
        fieldMappingService.create(mappingRequest());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void createShouldRequireEnabledInterfaceAndMapping() {
        SystemSyncRuleResponse response = service.create(ruleRequest(true));

        assertEquals("tenant-a", response.getTenantId());
        assertTrue(response.getEnabled());
        assertEquals("ENABLED", response.getStatus());
        assertEquals("MANUAL", response.getTriggerType());
    }

    @Test
    void createShouldRejectInvalidRetryCount() {
        SystemSyncRuleRequest request = ruleRequest(true);
        request.setRetryCount(11);

        assertThrows(BusinessException.class, () -> service.create(request));
    }

    @Test
    void createShouldRejectEnabledRuleWhenFieldMappingMissing() {
        SystemIntegrationInterfaceService anotherInterfaceService = new SystemIntegrationInterfaceService();
        SystemFieldMappingService emptyMappingService = new SystemFieldMappingService(anotherInterfaceService);
        SystemSyncRuleService isolated = new SystemSyncRuleService(anotherInterfaceService, emptyMappingService);
        Long freshInterfaceId = anotherInterfaceService.create(interfaceRequest()).getId();
        SystemSyncRuleRequest request = ruleRequest(true);
        request.setInterfaceId(freshInterfaceId);

        assertThrows(BusinessException.class, () -> isolated.create(request));
    }

    @Test
    void deleteShouldRequireDisabledRuleFirst() {
        SystemSyncRuleResponse response = service.create(ruleRequest(true));

        assertThrows(BusinessException.class, () -> service.delete(response.getId()));

        service.updateStatus(response.getId(), false);
        service.delete(response.getId());
        assertTrue(service.list().isEmpty());
    }

    @Test
    void updateStatusShouldDisableRule() {
        SystemSyncRuleResponse response = service.create(ruleRequest(true));

        SystemSyncRuleResponse disabled = service.updateStatus(response.getId(), false);

        assertFalse(disabled.getEnabled());
        assertEquals("DISABLED", disabled.getStatus());
    }

    private SystemIntegrationInterfaceRequest interfaceRequest() {
        SystemIntegrationInterfaceRequest request = new SystemIntegrationInterfaceRequest();
        request.setExternalSystemId(1L);
        request.setInterfaceName("接口");
        request.setMethod("POST");
        request.setPath("/asset/sync");
        return request;
    }

    private SystemFieldMappingRequest mappingRequest() {
        SystemFieldMappingRequest request = new SystemFieldMappingRequest();
        request.setInterfaceId(interfaceId);
        request.setMappingName("资产名称");
        request.setSourceField("name");
        request.setTargetField("assetName");
        request.setTransformExpression("trim(value)");
        return request;
    }

    private SystemSyncRuleRequest ruleRequest(boolean enabled) {
        SystemSyncRuleRequest request = new SystemSyncRuleRequest();
        request.setInterfaceId(interfaceId);
        request.setRuleName("资产同步规则");
        request.setTriggerType("manual");
        request.setRetryCount(2);
        request.setEnabled(enabled);
        return request;
    }
}
