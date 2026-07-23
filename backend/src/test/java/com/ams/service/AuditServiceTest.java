package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.GeneralAuditEntry;
import com.ams.mapper.AuditLogMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the audit write path ({@link AuditService#save}).
 *
 * <p>Verifies that a {@link GeneralAuditEntry} is normalised (tenant scoped to
 * {@link TenantContext}, timestamps defaulted) and forwarded to
 * {@link AuditLogMapper#insertAuditEntry(GeneralAuditEntry)} for persistence. Also
 * covers the best-effort contract: persistence failures must be swallowed rather than
 * propagated to the business caller.</p>
 */
@ExtendWith(MockitoExtension.class)
class AuditServiceTest {

    @Mock
    private AuditLogMapper auditLogMapper;

    private AuditService auditService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        auditService = new AuditService(auditLogMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void saveShouldNormalizeAndPersistEntry() {
        when(auditLogMapper.insertAuditEntry(any(GeneralAuditEntry.class))).thenReturn(1);

        GeneralAuditEntry entry = new GeneralAuditEntry();
        entry.setOperationType("USER_CREATE");
        entry.setAction("create_user");
        entry.setResourceType("USER");
        entry.setResourceId("42");
        entry.setStatus("SUCCESS");

        auditService.save(entry);

        ArgumentCaptor<GeneralAuditEntry> captor = ArgumentCaptor.forClass(GeneralAuditEntry.class);
        verify(auditLogMapper).insertAuditEntry(captor.capture());
        GeneralAuditEntry persisted = captor.getValue();
        assertEquals("tenant-a", persisted.getTenantId());
        assertEquals("USER_CREATE", persisted.getOperationType());
        assertEquals("create_user", persisted.getAction());
        assertEquals("USER", persisted.getResourceType());
        assertEquals("42", persisted.getResourceId());
        assertEquals("SUCCESS", persisted.getStatus());
        assertNotNull(persisted.getTimestamp());
        assertNotNull(persisted.getCreatedAt());
    }

    @Test
    void saveShouldPreserveExplicitTenantAndTimestamps() {
        when(auditLogMapper.insertAuditEntry(any(GeneralAuditEntry.class))).thenReturn(1);

        GeneralAuditEntry entry = new GeneralAuditEntry();
        entry.setTenantId("tenant-explicit");
        entry.setOperationType("WORKFLOW_PUBLISH");
        entry.setTimestamp(java.time.LocalDateTime.of(2026, 7, 23, 10, 0));
        entry.setCreatedAt(java.time.LocalDateTime.of(2026, 7, 23, 10, 0));

        auditService.save(entry);

        ArgumentCaptor<GeneralAuditEntry> captor = ArgumentCaptor.forClass(GeneralAuditEntry.class);
        verify(auditLogMapper).insertAuditEntry(captor.capture());
        GeneralAuditEntry persisted = captor.getValue();
        assertEquals("tenant-explicit", persisted.getTenantId());
        assertEquals(java.time.LocalDateTime.of(2026, 7, 23, 10, 0), persisted.getTimestamp());
    }

    @Test
    void saveShouldSwallowPersistenceFailureAndNotPropagate() {
        when(auditLogMapper.insertAuditEntry(any(GeneralAuditEntry.class)))
                .thenThrow(new RuntimeException("db down"));

        GeneralAuditEntry entry = new GeneralAuditEntry();
        entry.setOperationType("USER_DELETE");
        entry.setStatus("SUCCESS");

        // Must not throw — audit is best-effort and must not break the business operation.
        auditService.save(entry);
        verify(auditLogMapper).insertAuditEntry(any(GeneralAuditEntry.class));
    }

    @Test
    void saveShouldNoopForNullEntry() {
        auditService.save(null);
        verify(auditLogMapper, never()).insertAuditEntry(any(GeneralAuditEntry.class));
    }

    @Test
    void saveShouldDefaultTenantWhenContextMissing() {
        TenantContext.clear();
        when(auditLogMapper.insertAuditEntry(any(GeneralAuditEntry.class))).thenReturn(1);

        GeneralAuditEntry entry = new GeneralAuditEntry();
        entry.setOperationType("USER_UPDATE");

        auditService.save(entry);

        ArgumentCaptor<GeneralAuditEntry> captor = ArgumentCaptor.forClass(GeneralAuditEntry.class);
        verify(auditLogMapper).insertAuditEntry(captor.capture());
        // No tenant context -> remains null (the DB column is NOT NULL but the service does not
        // fabricate a tenant; the dashboard read path already filters on tenant_id).
        assertNull(captor.getValue().getTenantId());
        assertNotNull(captor.getValue().getTimestamp());
    }
}
