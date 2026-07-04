package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemFieldMappingPreviewRequest;
import com.ams.dto.SystemFieldMappingPreviewResponse;
import com.ams.dto.SystemFieldMappingRequest;
import com.ams.dto.SystemIntegrationInterfaceRequest;
import com.ams.dto.SystemIntegrationInterfaceResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SystemFieldMappingServiceTest {

    private SystemIntegrationInterfaceService interfaceService;
    private SystemFieldMappingService service;
    private Long interfaceId;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        interfaceService = new SystemIntegrationInterfaceService();
        service = new SystemFieldMappingService(interfaceService);
        interfaceId = interfaceService.create(interfaceRequest()).getId();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void createShouldRejectUnsafeTransformExpression() {
        for (String expression : new String[]{"eval(value)", "new Function(value)", "value.toUpperCase()", "trim(value);evil()"}) {
            SystemFieldMappingRequest request = mappingRequest("name", "assetName", expression);

            assertThrows(BusinessException.class, () -> service.create(request), expression);
        }
    }

    @Test
    void createShouldAllowOnlyExactBuiltInTransforms() {
        assertEquals("trim(value)", service.create(mappingRequest("name", "assetName", "trim(value)")).getTransformExpression());
        assertEquals("upper(value)", service.create(mappingRequest("code", "assetCode", "upper(value)")).getTransformExpression());
        assertEquals("lower(value)", service.create(mappingRequest("type", "assetType", "lower(value)")).getTransformExpression());
        assertNull(service.create(mappingRequest("serial", "assetSerial", "  ")).getTransformExpression());
    }

    @Test
    void previewShouldBePureAndUseWhitelist() {
        SystemFieldMappingPreviewResponse response = service.preview(previewRequest("trim(value)", "  Laptop  "));

        assertEquals("Laptop", response.getTransformedValue());
        assertEquals("LAPTOP", service.preview(previewRequest("upper(value)", "Laptop")).getTransformedValue());
        assertEquals("laptop", service.preview(previewRequest("lower(value)", "Laptop")).getTransformedValue());
        assertThrows(BusinessException.class, () -> service.preview(previewRequest("unknown(value)", "Laptop")));
    }

    @Test
    void createShouldRequireEnabledInterface() {
        SystemIntegrationInterfaceResponse disabled = interfaceService.create(interfaceRequest());
        interfaceService.updateStatus(disabled.getId(), false);
        SystemFieldMappingRequest request = mappingRequest("name", "assetName", "trim(value)");
        request.setInterfaceId(disabled.getId());

        assertThrows(BusinessException.class, () -> service.create(request));
    }

    @Test
    void createShouldRejectDuplicateSourceOrTargetWithinSameInterface() {
        service.create(mappingRequest("name", "assetName", "trim(value)"));

        assertThrows(BusinessException.class, () -> service.create(mappingRequest("name", "assetCode", "trim(value)")));
        assertThrows(BusinessException.class, () -> service.create(mappingRequest("code", "assetName", "trim(value)")));
    }

    @Test
    void hasEnabledMappingForInterfaceShouldObserveTenantBoundary() {
        service.create(mappingRequest("name", "assetName", "trim(value)"));
        assertTrue(service.hasEnabledMappingForInterface(interfaceId));

        TenantContext.setTenantId("tenant-b");
        assertTrue(service.list().isEmpty());
    }

    private SystemIntegrationInterfaceRequest interfaceRequest() {
        SystemIntegrationInterfaceRequest request = new SystemIntegrationInterfaceRequest();
        request.setExternalSystemId(1L);
        request.setInterfaceName("接口");
        request.setMethod("GET");
        request.setPath("/asset/sync");
        return request;
    }

    private SystemFieldMappingRequest mappingRequest(String source, String target, String expression) {
        SystemFieldMappingRequest request = new SystemFieldMappingRequest();
        request.setInterfaceId(interfaceId);
        request.setMappingName(source + " 映射");
        request.setSourceField(source);
        request.setTargetField(target);
        request.setTransformExpression(expression);
        return request;
    }

    private SystemFieldMappingPreviewRequest previewRequest(String expression, String sampleValue) {
        SystemFieldMappingPreviewRequest request = new SystemFieldMappingPreviewRequest();
        request.setSourceField("name");
        request.setTargetField("assetName");
        request.setTransformExpression(expression);
        request.setSampleValue(sampleValue);
        return request;
    }
}
