package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemPostDTO;
import com.ams.dto.SystemPostMetaDTO;
import com.ams.dto.SystemPostPreviewRequestDTO;
import com.ams.dto.SystemPostPreviewRespDTO;
import com.ams.dto.SystemPostQueryDTO;
import com.ams.entity.SystemPost;
import com.ams.mapper.SystemPostMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PostManagementServiceTest {

    @Mock
    private SystemPostMapper systemPostMapper;

    private PostManagementService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new PostManagementService(systemPostMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listShouldFilterByTenantAndReturnOnlyMetadata() {
        when(systemPostMapper.countRecords(eq("tenant-a"), eq("engineer"), eq("ENABLED"))).thenReturn(1L);
        when(systemPostMapper.selectPageRecords(eq("tenant-a"), eq("engineer"), eq("ENABLED"), eq(100), eq(0)))
                .thenReturn(List.of(post()));

        SystemPostDTO.PageResult result = service.list(SystemPostQueryDTO.builder()
                .keyword("engineer")
                .status("enabled")
                .pageSize(200)
                .build());

        assertEquals(1, result.getTotal());
        assertEquals(100, result.getPageSize());
        assertEquals("POST-ENGINEER", result.getRecords().get(0).getPostCode());
        assertEquals("工程师", result.getRecords().get(0).getPostName());
        assertEquals(true, result.getRecords().get(0).getTenantScoped());
        assertEquals(true, result.getRecords().get(0).getReadOnly());
        verify(systemPostMapper).countRecords(eq("tenant-a"), eq("engineer"), eq("ENABLED"));
        verify(systemPostMapper).selectPageRecords(eq("tenant-a"), eq("engineer"), eq("ENABLED"), eq(100), eq(0));
    }

    @Test
    void allShouldReturnTenantScopedSummaryList() {
        when(systemPostMapper.selectAllRecords(eq("tenant-a"), eq(null), eq(null))).thenReturn(List.of(post()));

        List<SystemPostDTO> result = service.all(new SystemPostQueryDTO());

        assertEquals(1, result.size());
        assertEquals("POST-ENGINEER", result.get(0).getPostCode());
        assertEquals(true, result.get(0).getReadOnly());
        verify(systemPostMapper).selectAllRecords(eq("tenant-a"), eq(null), eq(null));
    }

    @Test
    void detailShouldFailClosedForInvalidOrCrossTenantRows() {
        assertThrows(BusinessException.class, () -> service.detail(0L));

        when(systemPostMapper.selectByIdAndTenant("tenant-a", 7L)).thenReturn(null);
        assertThrows(BusinessException.class, () -> service.detail(7L));

        when(systemPostMapper.selectByIdAndTenant("tenant-a", 8L)).thenReturn(post());
        SystemPostDTO detail = service.detail(8L);
        assertEquals("POST-ENGINEER", detail.getPostCode());
        assertEquals(true, detail.getReadOnly());
    }

    @Test
    void metaShouldAdvertiseNoPersistenceNoAssignmentNoPermissionBoundary() {
        when(systemPostMapper.listStatuses("tenant-a", 100)).thenReturn(List.of("ENABLED"));

        SystemPostMetaDTO meta = service.meta();

        assertEquals(true, meta.getTenantScoped());
        assertEquals(true, meta.getReadOnly());
        assertEquals(true, meta.getNoPersistencePreview());
        assertEquals(true, meta.getNoAssignment());
        assertEquals(true, meta.getNoPermissionEffect());
        assertEquals(false, meta.getRuntimeEffect());
        assertEquals(false, meta.getCacheRefreshed());
        assertTrue(meta.getPreviewPolicy().getRejectedInputFields().contains("userIds"));
        assertTrue(meta.getNonGoals().toString().contains("不代表组织权限组"));
    }

    @Test
    void previewShouldRejectAssignmentAndPermissionInputsWithoutPersistence() {
        SystemPostPreviewRequestDTO request = SystemPostPreviewRequestDTO.builder()
                .postCode("POST-ENGINEER")
                .postName("工程师")
                .sortOrder(10)
                .status("enabled")
                .remark("metadata-only")
                .build();
        request.putUnknownInput("userIds", List.of(1, 2));
        request.putUnknownInput("permissionCodes", List.of("system:post:edit"));
        request.putUnknownInput("dataScope", "ALL");
        request.putUnknownInput("tenantId", "tenant-b");

        SystemPostPreviewRespDTO response = service.preview(request);

        // rejected inputs make previewAccepted=false; countByPostCode not called when rejected
        assertEquals(false, response.getPreviewAccepted());
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "userIds".equals(item.getField())));
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "permissionCodes".equals(item.getField())));
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "dataScope".equals(item.getField())));
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "tenantId".equals(item.getField())));
        assertEquals(true, response.getNoPersistence());
        assertEquals(true, response.getNoAssignment());
        assertEquals(true, response.getNoPermissionEffect());
        assertEquals(false, response.getRuntimeEffect());
        assertEquals(false, response.getCacheRefreshed());
        assertFalse(response.getRejectedInputs().toString().contains("tenant-b"));
        assertFalse(response.getRejectedInputs().toString().contains("system:post:edit"));
    }

    @Test
    void previewShouldAcceptSafeMetadataAndReportDuplicateRiskWithoutMutation() {
        SystemPostPreviewRequestDTO request = SystemPostPreviewRequestDTO.builder()
                .postCode("POST-ENGINEER")
                .postName("工程师")
                .sortOrder(10)
                .status("ENABLED")
                .remark("metadata-only")
                .build();
        when(systemPostMapper.countByPostCode("tenant-a", "POST-ENGINEER")).thenReturn(1L);

        SystemPostPreviewRespDTO response = service.preview(request);

        assertEquals(true, response.getPreviewAccepted());
        assertEquals(true, response.getDuplicateRisk());
        assertEquals("masked-reference-risk:existing-post-code", response.getReferenceImpact());
        assertTrue(response.getAcceptedFields().contains("postCode"));
        assertEquals(true, response.getNoPersistence());
        assertEquals(true, response.getNoAssignment());
        assertEquals(true, response.getNoPermissionEffect());
        verify(systemPostMapper).countByPostCode("tenant-a", "POST-ENGINEER");
    }

    @Test
    void missingTenantShouldFailClosedBeforeMapper() {
        TenantContext.clear();

        assertThrows(AccessDeniedException.class, () -> service.list(new SystemPostQueryDTO()));
        assertThrows(AccessDeniedException.class, () -> service.all(new SystemPostQueryDTO()));
        assertThrows(AccessDeniedException.class, () -> service.detail(1L));
        assertThrows(AccessDeniedException.class, () -> service.meta());
        assertThrows(AccessDeniedException.class, () -> service.preview(new SystemPostPreviewRequestDTO()));
        verifyNoInteractions(systemPostMapper);
    }

    private SystemPost post() {
        SystemPost post = new SystemPost();
        post.setId(8L);
        post.setTenantId("tenant-a");
        post.setPostCode("POST-ENGINEER");
        post.setPostName("工程师");
        post.setSortOrder(10);
        post.setStatus("ENABLED");
        post.setRemark("metadata-only");
        post.setRemoved(0);
        post.setCreatedAt(LocalDateTime.of(2026, 7, 8, 9, 10));
        post.setUpdatedAt(LocalDateTime.of(2026, 7, 8, 9, 10));
        return post;
    }
}
