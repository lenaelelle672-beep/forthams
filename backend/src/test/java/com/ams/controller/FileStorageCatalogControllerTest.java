package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.FileStorageAttachmentCatalogDTO;
import com.ams.entity.User;
import com.ams.service.FileStorageCatalogService;
import com.ams.service.TenantAuthorityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class FileStorageCatalogControllerTest {

    @Mock
    private FileStorageCatalogService fileStorageCatalogService;

    @Mock
    private TenantAuthorityService tenantAuthorityService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new FileStorageCatalogController(fileStorageCatalogService, tenantAuthorityService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void getCatalogShouldRequireExplicitPlatformAdminAndReturnMetadataOnly() throws Exception {
        when(tenantAuthorityService.requirePlatformAdmin()).thenReturn(platformAdmin());
        when(fileStorageCatalogService.getAttachmentCatalog(eq("审批"), eq("workflow"), eq("application/pdf"), eq(1), eq(20)))
                .thenReturn(sampleCatalog());

        mockMvc.perform(get("/system/file-storage/attachments/catalog")
                        .header("Authorization", "Bearer token")
                        .param("keyword", "审批")
                        .param("businessType", "workflow")
                        .param("fileType", "application/pdf")
                        .param("page", "1")
                        .param("pageSize", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.summary.totalAttachmentCount").value(1))
                .andExpect(jsonPath("$.data.attachments[0].fileName").value("审批单.pdf"))
                .andExpect(jsonPath("$.data.attachments[0].displayName").value("审批单.pdf"))
                .andExpect(jsonPath("$.data.attachments[0].filePath").doesNotExist())
                .andExpect(jsonPath("$.data.attachments[0].storagePath").doesNotExist())
                .andExpect(jsonPath("$.data.attachments[0].downloadUrl").doesNotExist())
                .andExpect(jsonPath("$.data.readonlyNotice").value("当前仅为 /system/file-storage/attachments/catalog 只读元数据目录，不支持上传/下载/预览/删除，不访问文件系统，不代表文件生命周期闭环。"));

        verify(fileStorageCatalogService).getAttachmentCatalog("审批", "workflow", "application/pdf", 1, 20);
        verify(tenantAuthorityService).requirePlatformAdmin();
    }

    @Test
    void getCatalogShouldRejectNonPlatformCallerBeforeServiceInvocation() throws Exception {
        when(tenantAuthorityService.requirePlatformAdmin())
                .thenThrow(new AccessDeniedException("仅显式平台管理员可以管理租户"));

        mockMvc.perform(get("/system/file-storage/attachments/catalog")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(fileStorageCatalogService);
        verify(tenantAuthorityService).requirePlatformAdmin();
    }

    private FileStorageAttachmentCatalogDTO sampleCatalog() {
        FileStorageAttachmentCatalogDTO.FileStorageAttachmentMetadataDTO attachment = new FileStorageAttachmentCatalogDTO.FileStorageAttachmentMetadataDTO();
        attachment.setId(1L);
        attachment.setBusinessType("workflow");
        attachment.setBusinessId(1001L);
        attachment.setFileName("审批单.pdf");
        attachment.setDisplayName("审批单.pdf");
        attachment.setFileSize(4096L);
        attachment.setFileType("application/pdf");
        attachment.setUploadBy(42L);
        attachment.setCreateTime(LocalDateTime.of(2026, 7, 1, 10, 0));

        FileStorageAttachmentCatalogDTO.FileStorageAttachmentSummaryDTO summary = new FileStorageAttachmentCatalogDTO.FileStorageAttachmentSummaryDTO();
        summary.setTotalAttachmentCount(1);
        summary.setTotalFileSize(4096L);
        summary.setBusinessTypeCount(1);
        summary.setFileTypeCount(1);
        summary.setCurrentPageAttachmentCount(1);

        FileStorageAttachmentCatalogDTO.FileStorageAttachmentPageDTO page = new FileStorageAttachmentCatalogDTO.FileStorageAttachmentPageDTO();
        page.setPage(1);
        page.setPageSize(20);
        page.setTotalCount(1);
        page.setTotalPages(1);

        FileStorageAttachmentCatalogDTO catalog = new FileStorageAttachmentCatalogDTO();
        catalog.setAttachments(List.of(attachment));
        catalog.setSummary(summary);
        catalog.setPage(page);
        catalog.setBusinessTypes(List.of("workflow"));
        catalog.setFileTypes(List.of("application/pdf"));
        catalog.setReadonlyNotice("当前仅为 /system/file-storage/attachments/catalog 只读元数据目录，不支持上传/下载/预览/删除，不访问文件系统，不代表文件生命周期闭环。");
        catalog.setRiskTips(List.of(catalog.getReadonlyNotice()));
        return catalog;
    }

    private User platformAdmin() {
        User user = new User();
        user.setId(42L);
        user.setUsername("platform-admin");
        user.setTenantId("T001");
        user.setPlatformAdmin(true);
        return user;
    }
}
