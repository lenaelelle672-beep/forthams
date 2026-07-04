package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemIntegrationInterfaceRequest;
import com.ams.dto.SystemIntegrationInterfaceResponse;
import com.ams.dto.SystemInterfaceTestResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SystemIntegrationInterfaceServiceTest {

    private SystemIntegrationInterfaceService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new SystemIntegrationInterfaceService();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void createShouldValidateRequiredContractFields() {
        SystemIntegrationInterfaceRequest invalidPathRequest = validRequest();
        invalidPathRequest.setPath("asset/sync");

        assertThrows(BusinessException.class, () -> service.create(invalidPathRequest));

        SystemIntegrationInterfaceRequest invalidMethodRequest = validRequest();
        invalidMethodRequest.setMethod("TRACE");
        assertThrows(BusinessException.class, () -> service.create(invalidMethodRequest));
    }

    @Test
    void createShouldPersistTenantScopedInterface() {
        SystemIntegrationInterfaceResponse created = service.create(validRequest());

        assertEquals("tenant-a", created.getTenantId());
        assertEquals("GET", created.getMethod());
        assertEquals("/asset/sync", created.getPath());
        assertTrue(created.getEnabled());
        assertEquals("ENABLED", created.getStatus());
        assertTrue(created.getConfigMasked());
    }

    @Test
    void listShouldNotLeakOtherTenantRecords() {
        service.create(validRequest());
        TenantContext.setTenantId("tenant-b");

        assertTrue(service.list().isEmpty());
    }

    @Test
    void testInterfaceShouldOnlyValidateConfigurationWithoutExternalCall() {
        SystemIntegrationInterfaceResponse created = service.create(validRequest());

        SystemInterfaceTestResponse response = service.testInterface(created.getId());

        assertTrue(response.getValid());
        assertTrue(response.getConfigOnly());
        assertEquals("GET /asset/sync", response.getTarget());
        assertEquals("接口配置校验通过，未触发真实外部调用", response.getMessage());
    }

    @Test
    void deleteShouldRequireInterfaceDisabledFirst() {
        SystemIntegrationInterfaceResponse created = service.create(validRequest());

        assertThrows(BusinessException.class, () -> service.delete(created.getId()));

        service.updateStatus(created.getId(), false);
        service.delete(created.getId());

        assertTrue(service.list().isEmpty());
    }

    @Test
    void updateStatusShouldDisableInterface() {
        SystemIntegrationInterfaceResponse created = service.create(validRequest());

        SystemIntegrationInterfaceResponse disabled = service.updateStatus(created.getId(), false);

        assertFalse(disabled.getEnabled());
        assertEquals("DISABLED", disabled.getStatus());
    }

    private SystemIntegrationInterfaceRequest validRequest() {
        SystemIntegrationInterfaceRequest request = new SystemIntegrationInterfaceRequest();
        request.setExternalSystemId(10L);
        request.setInterfaceName("资产同步接口");
        request.setMethod("get");
        request.setPath("/asset/sync");
        request.setRequestSchema("{\"assetCode\":\"string\"}");
        request.setResponseSchema("{\"success\":\"boolean\"}");
        return request;
    }
}
