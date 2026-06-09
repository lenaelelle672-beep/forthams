package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.SysAttachment;
import com.ams.mapper.SysAttachmentMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class InspectionAttachmentServiceTest {

    @Mock
    private SysAttachmentMapper sysAttachmentMapper;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void addAttachmentShouldWriteCurrentTenant() {
        TenantContext.setTenantId("dept:1");
        InspectionAttachmentService service = new InspectionAttachmentService(sysAttachmentMapper);

        service.addAttachment(21L, "inspection.jpg", "/api/file/inspection.jpg", 256L, "image/jpeg", 8L);

        ArgumentCaptor<SysAttachment> captor = ArgumentCaptor.forClass(SysAttachment.class);
        verify(sysAttachmentMapper).insert(captor.capture());
        SysAttachment attachment = captor.getValue();
        assertEquals("dept:1", attachment.getTenantId());
        assertEquals("INSPECTION", attachment.getBusinessType());
        assertEquals(21L, attachment.getBusinessId());
    }
}
