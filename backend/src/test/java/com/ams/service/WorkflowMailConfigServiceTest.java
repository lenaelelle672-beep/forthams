package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.WorkflowMailConfigDTO;
import com.ams.entity.WorkflowMailConfig;
import com.ams.mapper.WorkflowMailConfigMapper;
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 流程节点邮件配置只读 catalog 服务测试。
 * 覆盖 triggerEventLabel/recipientScopeLabel 映射、enabled 过滤与布尔映射、
 * 详情校验、分页边界与租户隔离。
 */
@ExtendWith(MockitoExtension.class)
class WorkflowMailConfigServiceTest {

    @Mock
    private WorkflowMailConfigMapper workflowMailConfigMapper;

    private WorkflowMailConfigService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        service = new WorkflowMailConfigService(workflowMailConfigMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void detailShouldMapTriggerEventLabelsForKnownEvents() {
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 1L)).thenReturn(config(1L, "ON_APPROVAL"));
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 2L)).thenReturn(config(2L, "ON_COMPLETE"));
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 3L)).thenReturn(config(3L, "ON_REJECT"));
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 4L)).thenReturn(config(4L, "ON_TIMEOUT"));
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 5L)).thenReturn(config(5L, null));
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 6L)).thenReturn(config(6L, "ON_BIRTHDAY"));

        assertEquals("审批时", service.detail(1L).getTriggerEventLabel());
        assertEquals("完成时", service.detail(2L).getTriggerEventLabel());
        assertEquals("驳回时", service.detail(3L).getTriggerEventLabel());
        assertEquals("超时时", service.detail(4L).getTriggerEventLabel());
        assertEquals("未知", service.detail(5L).getTriggerEventLabel());
        // 未知 triggerEvent 原样透传
        assertEquals("ON_BIRTHDAY", service.detail(6L).getTriggerEventLabel());
    }

    @Test
    void detailShouldMapRecipientScopeLabelsForKnownScopes() {
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 1L)).thenReturn(config(1L, "ON_APPROVAL", "APPLICANT"));
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 2L)).thenReturn(config(2L, "ON_APPROVAL", "APPROVER"));
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 3L)).thenReturn(config(3L, "ON_APPROVAL", "CC_ROLE"));
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 4L)).thenReturn(config(4L, "ON_APPROVAL", null));
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 5L)).thenReturn(config(5L, "ON_APPROVAL", "WATCHER"));

        assertEquals("申请人", service.detail(1L).getRecipientScopeLabel());
        assertEquals("审批人", service.detail(2L).getRecipientScopeLabel());
        assertEquals("抄送角色", service.detail(3L).getRecipientScopeLabel());
        assertEquals("未知", service.detail(4L).getRecipientScopeLabel());
        assertEquals("WATCHER", service.detail(5L).getRecipientScopeLabel());
    }

    @Test
    void detailShouldConvertEnabledFlagToBooleanWithNullSafe() {
        // toDTO: enabled == null → false；== 1 → true；其余 → false
        WorkflowMailConfig on = config(1L, "ON_APPROVAL");
        on.setEnabled(1);
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 1L)).thenReturn(on);

        WorkflowMailConfig off = config(2L, "ON_APPROVAL");
        off.setEnabled(0);
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 2L)).thenReturn(off);

        WorkflowMailConfig nullEnabled = config(3L, "ON_APPROVAL");
        nullEnabled.setEnabled(null);
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 3L)).thenReturn(nullEnabled);

        assertTrue(service.detail(1L).getEnabled());
        assertFalse(service.detail(2L).getEnabled());
        assertFalse(service.detail(3L).getEnabled());
    }

    @Test
    void detailShouldRejectInvalidIdWithoutTouchingMapper() {
        assertThrows(BusinessException.class, () -> service.detail(null));
        assertThrows(BusinessException.class, () -> service.detail(0L));
        assertThrows(BusinessException.class, () -> service.detail(-1L));
        verifyNoInteractions(workflowMailConfigMapper);
    }

    @Test
    void detailShouldThrowBusinessExceptionWhenNotFound() {
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 7L)).thenReturn(null);
        BusinessException ex = assertThrows(BusinessException.class, () -> service.detail(7L));
        assertEquals("流程邮件配置不存在", ex.getMessage());
    }

    @Test
    void detailShouldFormatIsoTimestampAndPreserveRiskNote() {
        WorkflowMailConfig record = config(1L, "ON_TIMEOUT");
        record.setBusinessType("ASSET_APPROVAL");
        record.setNodeKey("MANAGER_REVIEW");
        record.setNodeName("经理审批");
        record.setTemplateCode("TPL_TIMEOUT");
        record.setRecipientScope("APPROVER");
        record.setRiskNote("零业务调用风险");
        record.setCreatedAt(LocalDateTime.of(2026, 7, 23, 9, 0));
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 1L)).thenReturn(record);

        WorkflowMailConfigDTO dto = service.detail(1L);
        assertEquals("ASSET_APPROVAL", dto.getBusinessType());
        assertEquals("MANAGER_REVIEW", dto.getNodeKey());
        assertEquals("经理审批", dto.getNodeName());
        assertEquals("TPL_TIMEOUT", dto.getTemplateCode());
        assertEquals("超时时", dto.getTriggerEventLabel());
        assertEquals("审批人", dto.getRecipientScopeLabel());
        assertEquals("零业务调用风险", dto.getRiskNote());
        assertEquals("2026-07-23T09:00:00", dto.getCreatedAt());
    }

    @Test
    void detailShouldNullSafeFormatWhenTimestampAbsent() {
        WorkflowMailConfig record = config(1L, "ON_APPROVAL");
        when(workflowMailConfigMapper.selectByIdAndTenant("T001", 1L)).thenReturn(record);

        assertNull(service.detail(1L).getCreatedAt());
    }

    @Test
    void listShouldClampPaginationBounds() {
        when(workflowMailConfigMapper.count(eq("T001"), eq(null), eq(null))).thenReturn(0L);
        when(workflowMailConfigMapper.selectPage(eq("T001"), eq(null), eq(null), eq(20), eq(0)))
                .thenReturn(List.of());

        WorkflowMailConfigDTO.PageResult result = service.list(null, null, 0, 0);
        assertEquals(0, result.getTotal());
        assertEquals(0, result.getRecords().size());
    }

    @Test
    void listShouldClampPageSizeTo100() {
        when(workflowMailConfigMapper.count(eq("T001"), eq(null), eq(null))).thenReturn(0L);
        when(workflowMailConfigMapper.selectPage(eq("T001"), eq(null), eq(null), eq(100), eq(0)))
                .thenReturn(List.of());

        service.list(null, null, 1, 8192);
    }

    @Test
    void listShouldComputeOffsetFromSanitizedPage() {
        when(workflowMailConfigMapper.count(eq("T001"), eq("ASSET_APPROVAL"), eq(null))).thenReturn(2L);
        when(workflowMailConfigMapper.selectPage(eq("T001"), eq("ASSET_APPROVAL"), eq(null), eq(10), eq(0)))
                .thenReturn(List.of(config(1L, "ON_APPROVAL")));

        WorkflowMailConfigDTO.PageResult result = service.list("ASSET_APPROVAL", null, 1, 10);
        assertEquals(2, result.getTotal());
        assertEquals(1, result.getRecords().size());
        assertEquals("审批时", result.getRecords().get(0).getTriggerEventLabel());
    }

    @Test
    void listShouldPassEnabledFilterThroughUnchanged() {
        // enabled 是 Integer：传 1 → mapper 收到 1；传 null → mapper 收到 null（不加 enabled 过滤）
        when(workflowMailConfigMapper.count(eq("T001"), eq(null), eq(1))).thenReturn(0L);
        when(workflowMailConfigMapper.selectPage(eq("T001"), eq(null), eq(1), eq(20), eq(0)))
                .thenReturn(List.of());

        service.list(null, 1, 1, 20);
        verify(workflowMailConfigMapper).count(eq("T001"), eq(null), eq(1));
        verify(workflowMailConfigMapper).selectPage(eq("T001"), eq(null), eq(1), eq(20), eq(0));
    }

    @Test
    void listShouldPassTenantIdFromTenantContext() {
        when(workflowMailConfigMapper.count(eq("T001"), eq(null), eq(null))).thenReturn(0L);
        when(workflowMailConfigMapper.selectPage(eq("T001"), eq(null), eq(null), eq(20), eq(0)))
                .thenReturn(List.of());

        service.list(null, null, 1, 20);
        verify(workflowMailConfigMapper).count(eq("T001"), eq(null), eq(null));
        verify(workflowMailConfigMapper).selectPage(eq("T001"), eq(null), eq(null), eq(20), eq(0));
    }

    @Test
    void listAndDetailShouldFailClosedWithoutTenant() {
        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> service.list(null, null, 1, 20));
        assertThrows(AccessDeniedException.class, () -> service.detail(1L));
        verifyNoInteractions(workflowMailConfigMapper);
    }

    @Test
    void metaShouldAdvertiseTriggerEventsRecipientScopesAndReadOnlyBoundary() {
        WorkflowMailConfigDTO.Meta meta = service.meta();
        assertEquals(List.of("ON_APPROVAL", "ON_COMPLETE", "ON_REJECT", "ON_TIMEOUT"), meta.getTriggerEvents());
        assertEquals(List.of("APPLICANT", "APPROVER", "CC_ROLE"), meta.getRecipientScopes());
        assertTrue(meta.getReadOnlyNotice().contains("零业务调用风险"));
    }

    private WorkflowMailConfig config(Long id, String triggerEvent) {
        return config(id, triggerEvent, null);
    }

    private WorkflowMailConfig config(Long id, String triggerEvent, String recipientScope) {
        WorkflowMailConfig record = new WorkflowMailConfig();
        record.setId(id);
        record.setTenantId("T001");
        record.setTriggerEvent(triggerEvent);
        record.setRecipientScope(recipientScope);
        return record;
    }
}
