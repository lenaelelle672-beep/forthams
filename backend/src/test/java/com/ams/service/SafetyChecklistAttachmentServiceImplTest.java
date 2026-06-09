package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.SysAttachment;
import com.ams.mapper.SysAttachmentMapper;
import com.ams.service.impl.SafetyChecklistAttachmentServiceImpl;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SafetyChecklistAttachmentServiceImplTest {

    @Mock
    private SysAttachmentMapper sysAttachmentMapper;

    @TempDir
    private Path uploadDir;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void addAttachmentShouldWriteCurrentTenant() {
        TenantContext.setTenantId("dept:1");
        SafetyChecklistAttachmentServiceImpl service = new SafetyChecklistAttachmentServiceImpl(sysAttachmentMapper);

        service.addAttachment(31L, "photo.jpg", "/api/file/photo.jpg", 512L, "image/jpeg", 9L);

        ArgumentCaptor<SysAttachment> captor = ArgumentCaptor.forClass(SysAttachment.class);
        verify(sysAttachmentMapper).insert(captor.capture());
        SysAttachment attachment = captor.getValue();
        assertEquals("dept:1", attachment.getTenantId());
        assertEquals("SAFETY_CHECKLIST_RESULT", attachment.getBusinessType());
        assertEquals(31L, attachment.getBusinessId());
    }

    @Test
    void shouldDeletePhysicalFileWhenDeletingAttachment() throws Exception {
        SafetyChecklistAttachmentServiceImpl service = new SafetyChecklistAttachmentServiceImpl(sysAttachmentMapper);
        ReflectionTestUtils.setField(service, "uploadDir", uploadDir.toString());

        Path storedFile = uploadDir.resolve("safety-checklist-1-photo.jpg");
        Files.writeString(storedFile, "image-bytes");

        SysAttachment attachment = new SysAttachment();
        attachment.setId(7L);
        attachment.setBusinessType("SAFETY_CHECKLIST_RESULT");
        attachment.setFileName("photo.jpg");
        attachment.setFilePath("/api/file/safety-checklist-1-photo.jpg");
        when(sysAttachmentMapper.selectById(7L)).thenReturn(attachment);

        service.deleteAttachment(7L);

        verify(sysAttachmentMapper).deleteById(7L);
        assertFalse(Files.exists(storedFile));
    }
}
