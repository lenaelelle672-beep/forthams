package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.DocArticleDTO;
import com.ams.entity.DocArticle;
import com.ams.mapper.DocArticleMapper;
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 文档中心只读 catalog 服务测试。
 * 覆盖 categoryLabel/statusLabel 映射、详情校验、分页边界、时间格式化与租户隔离。
 */
@ExtendWith(MockitoExtension.class)
class DocCenterServiceTest {

    @Mock
    private DocArticleMapper docArticleMapper;

    private DocCenterService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        service = new DocCenterService(docArticleMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void detailShouldMapCategoryLabelsForKnownCategories() {
        when(docArticleMapper.selectByIdAndTenant("T001", 1L)).thenReturn(article(1L, "POLICY", "PUBLISHED"));
        when(docArticleMapper.selectByIdAndTenant("T001", 2L)).thenReturn(article(2L, "MANUAL", "DRAFT"));
        when(docArticleMapper.selectByIdAndTenant("T001", 3L)).thenReturn(article(3L, "FAQ", "ARCHIVED"));
        when(docArticleMapper.selectByIdAndTenant("T001", 4L)).thenReturn(article(4L, "ANNOUNCEMENT", "PUBLISHED"));
        when(docArticleMapper.selectByIdAndTenant("T001", 5L)).thenReturn(article(5L, "GENERAL", "PUBLISHED"));
        when(docArticleMapper.selectByIdAndTenant("T001", 6L)).thenReturn(article(6L, null, "PUBLISHED"));
        when(docArticleMapper.selectByIdAndTenant("T001", 7L)).thenReturn(article(7L, "EXOTIC", "PUBLISHED"));

        assertEquals("制度规范", service.detail(1L).getCategoryLabel());
        assertEquals("操作手册", service.detail(2L).getCategoryLabel());
        assertEquals("常见问题", service.detail(3L).getCategoryLabel());
        assertEquals("公告通知", service.detail(4L).getCategoryLabel());
        assertEquals("通用", service.detail(5L).getCategoryLabel());
        // null / 未知 category → 默认"通用"
        assertEquals("通用", service.detail(6L).getCategoryLabel());
        assertEquals("通用", service.detail(7L).getCategoryLabel());
    }

    @Test
    void detailShouldMapStatusLabelsForKnownStatuses() {
        when(docArticleMapper.selectByIdAndTenant("T001", 1L)).thenReturn(article(1L, "GENERAL", "DRAFT"));
        when(docArticleMapper.selectByIdAndTenant("T001", 2L)).thenReturn(article(2L, "GENERAL", "PUBLISHED"));
        when(docArticleMapper.selectByIdAndTenant("T001", 3L)).thenReturn(article(3L, "GENERAL", "ARCHIVED"));
        when(docArticleMapper.selectByIdAndTenant("T001", 4L)).thenReturn(article(4L, "GENERAL", null));
        when(docArticleMapper.selectByIdAndTenant("T001", 5L)).thenReturn(article(5L, "GENERAL", "WEIRD"));

        assertEquals("草稿", service.detail(1L).getStatusLabel());
        assertEquals("已发布", service.detail(2L).getStatusLabel());
        assertEquals("已归档", service.detail(3L).getStatusLabel());
        assertEquals("未知", service.detail(4L).getStatusLabel());
        // 未知 status 原样透传
        assertEquals("WEIRD", service.detail(5L).getStatusLabel());
    }

    @Test
    void detailShouldRejectInvalidIdWithoutTouchingMapper() {
        assertThrows(BusinessException.class, () -> service.detail(null));
        assertThrows(BusinessException.class, () -> service.detail(0L));
        assertThrows(BusinessException.class, () -> service.detail(-1L));
        verifyNoInteractions(docArticleMapper);
    }

    @Test
    void detailShouldThrowBusinessExceptionWhenNotFound() {
        when(docArticleMapper.selectByIdAndTenant("T001", 7L)).thenReturn(null);
        BusinessException ex = assertThrows(BusinessException.class, () -> service.detail(7L));
        assertEquals("文档不存在", ex.getMessage());
    }

    @Test
    void detailShouldFormatIsoTimestampsAndPreserveVersionAndAttachments() {
        DocArticle record = article(1L, "POLICY", "PUBLISHED");
        record.setVersion(3);
        record.setAuthorName("李四");
        record.setAttachmentCount(2);
        record.setPublishedAt(LocalDateTime.of(2026, 7, 1, 12, 0));
        record.setCreatedAt(LocalDateTime.of(2026, 6, 1, 9, 0));
        record.setUpdatedAt(LocalDateTime.of(2026, 7, 1, 12, 0));
        when(docArticleMapper.selectByIdAndTenant("T001", 1L)).thenReturn(record);

        DocArticleDTO dto = service.detail(1L);
        assertEquals(3, dto.getVersion());
        assertEquals("李四", dto.getAuthorName());
        assertEquals(2, dto.getAttachmentCount());
        assertEquals("2026-07-01T12:00:00", dto.getPublishedAt());
        assertEquals("2026-06-01T09:00:00", dto.getCreatedAt());
        assertEquals("2026-07-01T12:00:00", dto.getUpdatedAt());
    }

    @Test
    void detailShouldNullSafeFormatWhenTimestampsAbsent() {
        DocArticle record = article(1L, "GENERAL", "DRAFT");
        when(docArticleMapper.selectByIdAndTenant("T001", 1L)).thenReturn(record);

        DocArticleDTO dto = service.detail(1L);
        assertNull(dto.getPublishedAt());
        assertNull(dto.getCreatedAt());
        assertNull(dto.getUpdatedAt());
    }

    @Test
    void listShouldClampPaginationBounds() {
        when(docArticleMapper.count(eq("T001"), eq(null), eq(null), eq(null))).thenReturn(0L);
        when(docArticleMapper.selectPage(eq("T001"), eq(null), eq(null), eq(null), eq(20), eq(0)))
                .thenReturn(List.of());

        DocArticleDTO.PageResult result = service.list(null, null, null, 0, 0);
        assertEquals(0, result.getTotal());
        assertEquals(0, result.getRecords().size());
    }

    @Test
    void listShouldClampPageSizeTo100() {
        when(docArticleMapper.count(eq("T001"), eq(null), eq(null), eq(null))).thenReturn(0L);
        when(docArticleMapper.selectPage(eq("T001"), eq(null), eq(null), eq(null), eq(100), eq(0)))
                .thenReturn(List.of());

        service.list(null, null, null, 1, 4096);
    }

    @Test
    void listShouldComputeOffsetFromSanitizedPage() {
        when(docArticleMapper.count(eq("T001"), eq("POLICY"), eq("PUBLISHED"), eq("安全"))).thenReturn(7L);
        when(docArticleMapper.selectPage(eq("T001"), eq("POLICY"), eq("PUBLISHED"), eq("安全"), eq(10), eq(10)))
                .thenReturn(List.of(article(1L, "POLICY", "PUBLISHED")));

        DocArticleDTO.PageResult result = service.list("POLICY", "PUBLISHED", "安全", 2, 10);
        assertEquals(7, result.getTotal());
        assertEquals(1, result.getRecords().size());
        assertEquals("制度规范", result.getRecords().get(0).getCategoryLabel());
    }

    @Test
    void listShouldPassTenantIdFromTenantContext() {
        when(docArticleMapper.count(eq("T001"), eq(null), eq(null), eq(null))).thenReturn(0L);
        when(docArticleMapper.selectPage(eq("T001"), eq(null), eq(null), eq(null), eq(20), eq(0)))
                .thenReturn(List.of());

        service.list(null, null, null, 1, 20);
        verify(docArticleMapper).count(eq("T001"), eq(null), eq(null), eq(null));
        verify(docArticleMapper).selectPage(eq("T001"), eq(null), eq(null), eq(null), eq(20), eq(0));
    }

    @Test
    void listAndDetailShouldFailClosedWithoutTenant() {
        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> service.list(null, null, null, 1, 20));
        assertThrows(AccessDeniedException.class, () -> service.detail(1L));
        verifyNoInteractions(docArticleMapper);
    }

    @Test
    void metaShouldAdvertiseCategoriesStatusesAndReadOnlyBoundary() {
        DocArticleDTO.Meta meta = service.meta();
        assertEquals(List.of("GENERAL", "POLICY", "MANUAL", "FAQ", "ANNOUNCEMENT"), meta.getCategories());
        assertEquals(List.of("DRAFT", "PUBLISHED", "ARCHIVED"), meta.getStatuses());
        assertTrue(meta.getReadOnlyNotice().contains("只读 catalog"));
    }

    private DocArticle article(Long id, String category, String status) {
        DocArticle record = new DocArticle();
        record.setId(id);
        record.setTenantId("T001");
        record.setTitle("文档#" + id);
        record.setCategory(category);
        record.setStatus(status);
        return record;
    }
}
