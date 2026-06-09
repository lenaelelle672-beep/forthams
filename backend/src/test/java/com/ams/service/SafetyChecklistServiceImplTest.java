package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.SafetyChecklistExecution;
import com.ams.entity.SafetyChecklistTemplate;
import com.ams.mapper.SafetyChecklistExecutionMapper;
import com.ams.mapper.SafetyChecklistItemMapper;
import com.ams.mapper.SafetyChecklistResultMapper;
import com.ams.mapper.SafetyChecklistTemplateMapper;
import com.ams.service.impl.SafetyChecklistServiceImpl;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SafetyChecklistServiceImplTest {

    @Mock
    private SafetyChecklistTemplateMapper templateMapper;

    @Mock
    private SafetyChecklistItemMapper itemMapper;

    @Mock
    private SafetyChecklistExecutionMapper executionMapper;

    @Mock
    private SafetyChecklistResultMapper resultMapper;

    @Mock
    private WorkOrderService workOrderService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private SafetyChecklistAttachmentService safetyChecklistAttachmentService;

    @Mock
    private PdfExportService pdfExportService;

    @Mock
    private TenantService tenantService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void checkOverdueExecutionsShouldBindAndClearTenantContext() {
        SafetyChecklistServiceImpl service = service();
        SafetyChecklistExecution execution = new SafetyChecklistExecution();
        execution.setId(12L);
        execution.setTemplateId(7L);
        execution.setExecutorId(42L);
        execution.setExecuteDate(LocalDate.now().minusDays(9));
        execution.setTenantId("dept:1");
        SafetyChecklistTemplate template = new SafetyChecklistTemplate();
        template.setId(7L);
        template.setTemplateName("机房安全检查");

        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1", "dept:2"));
        when(templateMapper.selectById(7L)).thenReturn(template);
        when(executionMapper.selectPage(any(Page.class), any(Wrapper.class))).thenAnswer(invocation -> {
            String tenantId = TenantContext.getTenantId();
            Page<SafetyChecklistExecution> page = invocation.getArgument(0);
            if ("dept:1".equals(tenantId) && page.getCurrent() == 1) {
                return page.setRecords(List.of(execution));
            }
            assertTrue("dept:1".equals(tenantId) || "dept:2".equals(tenantId));
            return page.setRecords(List.of());
        });

        service.checkOverdueExecutions();

        verify(notificationService).sendByTemplate(
                eq("safety_checklist_overdue"),
                any(Map.class),
                eq(42L),
                eq(12L),
                eq("SAFETY_CHECKLIST_EXECUTION"));
        assertNull(TenantContext.getTenantId());
    }

    private SafetyChecklistServiceImpl service() {
        return new SafetyChecklistServiceImpl(
                templateMapper,
                itemMapper,
                executionMapper,
                resultMapper,
                workOrderService,
                notificationService,
                safetyChecklistAttachmentService,
                pdfExportService,
                tenantService);
    }
}
