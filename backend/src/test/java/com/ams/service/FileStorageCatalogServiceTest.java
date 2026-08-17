package com.ams.service;

import com.ams.dto.FileStorageAttachmentCatalogDTO;
import com.ams.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class FileStorageCatalogServiceTest {

    private JdbcTemplate jdbcTemplate;
    private FileStorageCatalogService service;
    private TenantAuthorityService tenantAuthorityService;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:file_storage_" + UUID.randomUUID().toString().replace("-", "") + ";MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1");
        dataSource.setUsername("sa");
        dataSource.setPassword("");
        jdbcTemplate = new JdbcTemplate(dataSource);
        createSchema();
        tenantAuthorityService = mock(TenantAuthorityService.class);
        when(tenantAuthorityService.requirePlatformAdmin()).thenReturn(platformAdmin());
        service = new FileStorageCatalogService(jdbcTemplate, tenantAuthorityService);
    }

    @Test
    void getAttachmentCatalogShouldReturnOnlyActiveMetadataAndHideStorageDetails() throws Exception {
        insertAttachment(1, "asset", 1001, "资产照片.jpg", "/private/raw/asset-photo.jpg", 2048, "image/jpeg", 9, "2026-07-01 10:00:00", 0);
        insertAttachment(2, "workflow", 2001, "审批单.pdf", "/private/raw/approval.pdf", 4096, "application/pdf", 10, "2026-07-02 10:00:00", 0);
        insertAttachment(3, "asset", 1002, "已删除.doc", "/private/raw/deleted.doc", 1024, "application/msword", 11, "2026-07-03 10:00:00", 1);

        FileStorageAttachmentCatalogDTO catalog = service.getAttachmentCatalog(null, null, null, 1, 20);

        assertEquals(2, catalog.getAttachments().size());
        assertEquals(2, catalog.getSummary().getTotalAttachmentCount());
        assertEquals(6144, catalog.getSummary().getTotalFileSize());
        assertEquals(2, catalog.getSummary().getBusinessTypeCount());
        assertEquals(2, catalog.getSummary().getFileTypeCount());
        assertEquals("审批单.pdf", catalog.getAttachments().get(0).getFileName());
        assertEquals("资产照片.jpg", catalog.getAttachments().get(1).getDisplayName());
        assertTrue(catalog.getReadonlyNotice().contains("只读元数据目录"));

        String serialized = catalog.toString();
        assertFalse(serialized.contains("/private/raw"));
        assertFalse(serialized.contains("file_path"));
        assertFalse(serialized.contains("filePath"));
        assertFalse(serialized.contains("storagePath"));
    }

    @Test
    void getAttachmentCatalogShouldFilterPaginateAndSanitizeDisplayName() {
        insertAttachment(1, "asset", 1001, "asset-one.jpg", "/private/raw/asset-one.jpg", 100, "image/jpeg", 9, "2026-07-01 10:00:00", 0);
        insertAttachment(2, "asset", 1002, "nested/asset-two.jpg", "/private/raw/asset-two.jpg", 200, "image/jpeg", 9, "2026-07-02 10:00:00", 0);
        insertAttachment(3, "workflow", 2001, "workflow.pdf", "/private/raw/workflow.pdf", 300, "application/pdf", 10, "2026-07-03 10:00:00", 0);

        FileStorageAttachmentCatalogDTO firstPage = service.getAttachmentCatalog("asset", "asset", "image/jpeg", 1, 1);
        FileStorageAttachmentCatalogDTO secondPage = service.getAttachmentCatalog("asset", "asset", "image/jpeg", 2, 1);

        assertEquals(2, firstPage.getSummary().getTotalAttachmentCount());
        assertEquals(1, firstPage.getAttachments().size());
        assertEquals(2, firstPage.getPage().getTotalPages());
        assertEquals("asset-two.jpg", firstPage.getAttachments().get(0).getDisplayName());
        assertEquals("asset-one.jpg", secondPage.getAttachments().get(0).getFileName());
        assertEquals("asset", firstPage.getBusinessTypes().get(0));
        assertTrue(firstPage.getFileTypes().contains("image/jpeg"));
    }

    @Test
    void getAttachmentCatalogShouldExposeEmptyStateAndReadonlyRisks() {
        FileStorageAttachmentCatalogDTO catalog = service.getAttachmentCatalog("missing", null, null, -1, 500);

        assertEquals(0, catalog.getAttachments().size());
        assertEquals(0, catalog.getSummary().getTotalAttachmentCount());
        assertEquals(1, catalog.getPage().getPage());
        assertEquals(100, catalog.getPage().getPageSize());
        assertTrue(catalog.getRiskTips().stream().anyMatch(tip -> tip.contains("不写库")));
    }

    @Test
    void getAttachmentCatalogShouldRequirePlatformAdminBeforeExecutingAnyQuery() {
        JdbcTemplate queryTemplate = mock(JdbcTemplate.class);
        TenantAuthorityService deniedAuthorityService = mock(TenantAuthorityService.class);
        when(deniedAuthorityService.requirePlatformAdmin())
                .thenThrow(new AccessDeniedException("仅显式平台管理员可以管理租户"));
        FileStorageCatalogService deniedService = new FileStorageCatalogService(queryTemplate, deniedAuthorityService);

        assertThatThrownBy(() -> deniedService.getAttachmentCatalog(null, null, null, 1, 20))
                .isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(queryTemplate);
    }

    private void createSchema() {
        jdbcTemplate.execute("""
                CREATE TABLE sys_attachment(
                    id BIGINT PRIMARY KEY,
                    business_type VARCHAR(64) NOT NULL,
                    business_id BIGINT NOT NULL,
                    file_name VARCHAR(256) NOT NULL,
                    file_path VARCHAR(512) NOT NULL,
                    file_size BIGINT,
                    file_type VARCHAR(64),
                    upload_by BIGINT,
                    create_time DATETIME,
                    deleted TINYINT DEFAULT 0
                )
                """);
    }

    private void insertAttachment(int id, String businessType, long businessId, String fileName, String storageValue, long fileSize, String fileType, long uploadBy, String createTime, int deleted) {
        jdbcTemplate.update("""
                        INSERT INTO sys_attachment(id, business_type, business_id, file_name, file_path, file_size, file_type, upload_by, create_time, deleted)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                id,
                businessType,
                businessId,
                fileName,
                storageValue,
                fileSize,
                fileType,
                uploadBy,
                createTime,
                deleted
        );
    }

    private User platformAdmin() {
        User user = new User();
        user.setId(1L);
        user.setUsername("platform-admin");
        user.setTenantId("T001");
        user.setPlatformAdmin(true);
        return user;
    }
}
