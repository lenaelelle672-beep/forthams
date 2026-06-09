package com.ams.event;

import com.ams.context.TenantContext;
import com.ams.dto.TodoCreateRequest;
import com.ams.entity.User;
import com.ams.mapper.TodoMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.service.EmailService;
import com.ams.service.TodoService;
import com.ams.service.WorkflowDefinitionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("通知事件监听器测试")
class NotificationEventListenerTest {

    @Mock
    private WorkflowDefinitionService workflowDefinitionService;
    @Mock
    private TodoService todoService;
    @Mock
    private TodoMapper todoMapper;
    @Mock
    private UserRoleMapper userRoleMapper;
    @Mock
    private UserMapper userMapper;
    @Mock
    private EmailService emailService;
    @Mock
    private SpringTemplateEngine mailTemplateEngine;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("审批通过且非最终步骤时为下一步审批人创建待办")
    void approvedNonFinalStepCreatesTodoForNextApprover() {
        NotificationEventListener listener = listener();
        String businessData = "{\"amount\":1200}";
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(
                List.of(
                        workflowNode(1, "dept_manager", "any"),
                        workflowNode(2, "finance_manager", "any")
                ),
                null);
        when(workflowDefinitionService.getPublishedRuntimePlan("RETIREMENT", businessData, 5)).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("finance_manager")).thenReturn(List.of(42L));
        when(todoMapper.selectOne(any())).thenReturn(null);

        listener.handleApprovalProcessEvent(event("APPROVED", 1, 2, businessData, null, null));

        verify(workflowDefinitionService).getPublishedRuntimePlan("RETIREMENT", businessData, 5);
        ArgumentCaptor<TodoCreateRequest> captor = ArgumentCaptor.forClass(TodoCreateRequest.class);
        verify(todoService).createTodo(captor.capture());
        TodoCreateRequest todo = captor.getValue();
        assertThat(todo.getUserId()).isEqualTo(42L);
        assertThat(todo.getTitle()).isEqualTo("退役申请（编号：PROC-001）需要您审批");
        assertThat(todo.getRefType()).isEqualTo("APPROVAL_PROCESS");
        assertThat(todo.getRefId()).isEqualTo("1001");
        assertThat(todo.getPriority()).isEqualTo("HIGH");
        assertThat(todo.getDueAt()).isAfter(LocalDateTime.now().plusDays(6));
        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    @DisplayName("审批通过但下一步待办已存在时保持幂等")
    void approvedNonFinalStepSkipsExistingTodo() {
        NotificationEventListener listener = listener();
        WorkflowDefinitionService.WorkflowRuntimePlan plan = new WorkflowDefinitionService.WorkflowRuntimePlan(
                List.of(
                        workflowNode(1, "dept_manager", "any"),
                        workflowNode(2, "finance_manager", "any")
                ),
                null);
        when(workflowDefinitionService.getPublishedRuntimePlan("RETIREMENT", "{}", 5)).thenReturn(plan);
        when(userRoleMapper.selectActiveUserIdsByRole("finance_manager")).thenReturn(List.of(42L));
        com.ams.entity.SysTodo existing = new com.ams.entity.SysTodo();
        existing.setId(9L);
        when(todoMapper.selectOne(any())).thenReturn(existing);

        listener.handleApprovalProcessEvent(event("APPROVED", 1, 2, "{}", null, null));

        verify(todoService, never()).createTodo(any(TodoCreateRequest.class));
        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    @DisplayName("审批驳回时清理关联待办且不要求 CC 配置")
    void rejectedEventCompletesTodosByReference() {
        NotificationEventListener listener = listener();

        listener.handleApprovalProcessEvent(event("REJECTED", 1, 2, "{}", null, null));

        verify(todoService).completeByRef("APPROVAL_PROCESS", "1001");
        verify(emailService, never()).sendHtmlEmailWithCc(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("提交事件按 CC 配置发送邮件并清理租户上下文")
    void submittedEventSendsCcEmailWithTenantContext() {
        NotificationEventListener listener = listener();
        User ccUser = user(42L, "抄送人", "cc@example.com");
        User applicant = user(7L, "申请人", "applicant@example.com");
        when(userRoleMapper.selectActiveUserIdsByRole("ASSET_MANAGER")).thenReturn(List.of(42L));
        when(userMapper.selectById(42L)).thenReturn(ccUser);
        when(userMapper.selectById(7L)).thenReturn(applicant);
        when(mailTemplateEngine.process(eq("approval_cc_submitted"), any(Context.class))).thenReturn("<p>ok</p>");

        listener.handleApprovalProcessEvent(event("SUBMITTED", 1, 2, "{}", "ASSET_MANAGER", "42"));

        verify(emailService).sendHtmlEmailWithCc(
                eq("cc@example.com"),
                eq(List.of()),
                eq(null),
                eq("退役申请【已提交】抄送通知"),
                eq("<p>ok</p>"));
        assertThat(TenantContext.getTenantId()).isNull();
    }

    private NotificationEventListener listener() {
        return new NotificationEventListener(
                workflowDefinitionService,
                todoService,
                todoMapper,
                userRoleMapper,
                userMapper,
                emailService,
                mailTemplateEngine);
    }

    private ApprovalProcessEvent event(String result, int currentStep, int finalStep, String businessData,
                                       String ccRoleCodes, String ccUserIds) {
        return new ApprovalProcessEvent(
                1001L,
                "PROC-001",
                "RETIREMENT",
                currentStep,
                finalStep,
                result,
                8L,
                "审批人",
                7L,
                businessData,
                "dept:1",
                LocalDateTime.of(2026, 6, 9, 9, 0),
                ccRoleCodes,
                ccUserIds);
    }

    private WorkflowDefinitionService.WorkflowApprovalNode workflowNode(int stepNo, String approverRole,
                                                                        String approvalMode) {
        return new WorkflowDefinitionService.WorkflowApprovalNode(
                stepNo,
                "node-" + stepNo,
                "NODE_" + stepNo,
                "审批节点",
                approverRole,
                approvalMode,
                "role",
                null,
                null,
                null,
                0,
                0);
    }

    private User user(Long id, String realName, String email) {
        User user = new User();
        user.setId(id);
        user.setRealName(realName);
        user.setEmail(email);
        return user;
    }
}
