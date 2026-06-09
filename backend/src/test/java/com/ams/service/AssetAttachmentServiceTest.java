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
class AssetAttachmentServiceTest {

    @Mock
    private SysAttachmentMapper sysAttachmentMapper;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void addAttachmentShouldWriteCurrentTenant() {
        TenantContext.setTenantId("dept:1");
        AssetAttachmentService service = new AssetAttachmentService(sysAttachmentMapper);

        service.addAttachment(12L, "asset.jpg", "/api/file/asset.jpg", 128L, "image/jpeg", 7L);

        ArgumentCaptor<SysAttachment> captor = ArgumentCaptor.forClass(SysAttachment.class);
        verify(sysAttachmentMapper).insert(captor.capture());
        SysAttachment attachment = captor.getValue();
        assertEquals("dept:1", attachment.getTenantId());
        assertEquals("ASSET", attachment.getBusinessType());
        assertEquals(12L, attachment.getBusinessId());
    }
}
