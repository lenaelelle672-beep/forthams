package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.FileStorageAttachmentCatalogDTO;
import com.ams.service.FileStorageCatalogService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.Arrays;
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
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new FileStorageCatalogController(fileStorageCatalogService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void getCatalogShouldRequireFileStorageQueryPermissionAndReturnMetadataOnly() throws Exception {
        grant("system:file-storage:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
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
    }

    @Test
    void getCatalogShouldAllowSuperAdminAuthority() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(fileStorageCatalogService.getAttachmentCatalog(null, null, null, null, null)).thenReturn(sampleCatalog());

        mockMvc.perform(get("/system/file-storage/attachments/catalog")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.riskTips[0]").value("当前仅为 /system/file-storage/attachments/catalog 只读元数据目录，不支持上传/下载/预览/删除，不访问文件系统，不代表文件生命周期闭环。"));

        verify(fileStorageCatalogService).getAttachmentCatalog(null, null, null, null, null);
    }

    @Test
    void getCatalogShouldRejectMissingBearerToken() throws Exception {
        grant("system:file-storage:query");

        mockMvc.perform(get("/system/file-storage/attachments/catalog"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(fileStorageCatalogService);
    }

    @Test
    void getCatalogShouldRejectUserWithoutFileStorageQueryPermission() throws Exception {
        grant("system:user:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(get("/system/file-storage/attachments/catalog")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(fileStorageCatalogService);
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

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
