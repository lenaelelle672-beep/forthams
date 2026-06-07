package com.ams.event;

import com.ams.context.TenantContext;
import com.ams.dto.TodoCreateRequest;
import com.ams.entity.SysTodo;
import com.ams.entity.User;
import com.ams.mapper.TodoMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.ams.service.EmailService;
import com.ams.service.TodoService;
import com.ams.service.WorkflowDefinitionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 通知事件监听器
 *
 * <p>监听通用审批流程事件（{@link ApprovalProcessEvent}），在事务提交后异步
 * 创建下一审批人待办、分发通知和发送 CC 邮件。</p>
 *
 * <p><strong>职责边界：</strong>只负责待办创建和通知分发，不参与审批事务。
 * 已清理废弃的 ApprovalNotificationEvent 处理路径（handleApprovalNotification 等死代码 —— 确认无残留引用）。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationEventListener {

    private final WorkflowDefinitionService workflowDefinitionService;
    private final TodoService todoService;
    private final TodoMapper todoMapper;
    private final UserRoleMapper userRoleMapper;
    private final UserMapper userMapper;
    private final EmailService emailService;
    @Qualifier("mailTemplateEngine")
    private final SpringTemplateEngine mailTemplateEngine;

    // ========== 通用审批流程事件处理（ApprovalProcessEvent） ==========

    /**
     * 处理通用审批流程事件。
     * <p>事务提交后异步执行，不影响审批主事务。</p>
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async("notificationExecutor")
    public void handleApprovalProcessEvent(ApprovalProcessEvent event) {
        log.info("处理审批流程事件: processId={}, result={}, step={}/{}",
                event.getProcessId(), event.getResult(), event.getCurrentStep(), event.getFinalStep());

        try {
            if (event.isSubmitted()) {
                // 审批已提交 → 发送 CC 提交通知（不创建待办）
                sendCcNotification(event, "approval_cc_submitted");
            } else if (event.isApproved()) {
                if (!event.isFinalStep()) {
                    // 审批通过且非最终步骤 → 为下一步审批人创建待办
                    int nextStep = event.getCurrentStep() + 1;
                    createTodoForNextStep(event, nextStep);
                }
                // 审批通过 → 发送 CC 通过通知
                sendCcNotification(event, "approval_cc_approved");
            } else if (event.isRejected()) {
                // 驳回 → 清理关联待办 + 发送 CC 驳回通知
                completeTodosByRef(event.getProcessId());
                sendCcNotification(event, "approval_cc_rejected");
            } else if ("CANCELLED".equals(event.getResult())) {
                // 取消 → 清理关联待办
                completeTodosByRef(event.getProcessId());
            }
        } catch (Exception e) {
            log.error("处理审批流程事件异常: processId={}", event.getProcessId(), e);
        }
    }

    /**
     * 为下一步审批人创建待办。
     */
    private void createTodoForNextStep(ApprovalProcessEvent event, int nextStep) {
        try {
            String tenantId = event.getTenantId();
            if (tenantId == null) {
                log.warn("tenantId 为空，跳过待办创建: processId={}", event.getProcessId());
                return;
            }

            // 在 @Async 线程中恢复 TenantContext（fix N-01: 异步线程丢失租户上下文）
            TenantContext.setTenantId(event.getTenantId());
            try {
                // 通过 WorkflowDefinitionService 获取运行时计划（fix N-02: 传入真实 businessData 而非空串）
                WorkflowDefinitionService.WorkflowRuntimePlan plan =
                        workflowDefinitionService.getPublishedRuntimePlan(
                                event.getProcessType(), event.getBusinessData(), 5);
                if (plan == null || plan.approvalNodes().isEmpty()) {
                    log.debug("无运行时计划，跳过待办创建: processType={}", event.getProcessType());
                    return;
                }

                WorkflowDefinitionService.WorkflowApprovalNode nextNode = plan.nodeAtStep(nextStep);
                if (nextNode == null) {
                    log.debug("下一步节点不存在，跳过待办创建: step={}", nextStep);
                    return;
                }

                List<Long> nextApproverIds = resolveNextApproverIds(nextNode);
                if (nextApproverIds.isEmpty()) {
                    log.debug("无下一步审批人，跳过待办创建: step={}", nextStep);
                    return;
                }

                String processLabel = resolveProcessTypeLabel(event.getProcessType());

                for (Long userId : nextApproverIds) {
                    // 幂等防护：检查是否已存在同 refType+refId+userId 的待办
                    SysTodo existing = todoMapper.selectOne(new LambdaQueryWrapper<SysTodo>()
                            .eq(SysTodo::getRefType, "APPROVAL_PROCESS")
                            .eq(SysTodo::getRefId, event.getProcessId())
                            .eq(SysTodo::getUserId, userId)
                            .in(SysTodo::getStatus, "PENDING", "READ")
                            .last("LIMIT 1"));
                    if (existing != null) {
                        log.debug("待办已存在，跳过创建: processId={}, userId={}, existingId={}",
                                event.getProcessId(), userId, existing.getId());
                        continue;
                    }
                    TodoCreateRequest todoReq = new TodoCreateRequest();
                    todoReq.setUserId(userId);
                    todoReq.setTitle(processLabel + "（编号：" + event.getProcessNo() + "）需要您审批");
                    todoReq.setRefType("APPROVAL_PROCESS");
                    todoReq.setRefId(String.valueOf(event.getProcessId()));
                    todoReq.setPriority("HIGH");
                    todoReq.setDueAt(LocalDateTime.now().plusDays(7));
                    todoService.createTodo(todoReq);
                    log.debug("已为审批人创建待办: userId={}, processId={}, step={}",
                            userId, event.getProcessId(), nextStep);
                }
            } finally {
                TenantContext.clear();
            }
        } catch (Exception e) {
            log.error("为下一步审批人创建待办异常: processId={}", event.getProcessId(), e);
        }
    }

    /**
     * 解析审批节点的下一审批人 ID 列表。
     */
    private List<Long> resolveNextApproverIds(WorkflowDefinitionService.WorkflowApprovalNode node) {
        try {
            if ("user".equals(node.approverType())) {
                Long id = parseLong(node.approverId(), null);
                return id != null ? List.of(id) : List.of();
            }
            if (node.approverRole() == null || node.approverRole().isBlank()) {
                return List.of();
            }
            List<Long> userIds = userRoleMapper.selectActiveUserIdsByRole(node.approverRole());
            if (userIds == null || userIds.isEmpty()) {
                return List.of();
            }
            // sequence 模式：按 orderIndex 从有序列表中取单个审批人（仅影响通知目标）
            // 依赖 UserRoleMapper.selectActiveUserIdsByRole 的 ORDER BY u.id ASC 保证列表顺序稳定
            // 顺序控制由 ApprovalService 中的审批权限校验负责
            // all/any/count 模式：返回全部审批人（下方兜底逻辑一致）
            if ("sequence".equals(node.approvalMode())) {
                int idx = node.orderIndex();
                if (idx >= 0 && idx < userIds.size()) {
                    return List.of(userIds.get(idx));
                }
                return List.of();
            }
            return userIds;
        } catch (Exception e) {
            log.warn("解析下一步审批人失败: role={}", node.approverRole(), e);
            return List.of();
        }
    }

    /**
     * 将流程类型代码转为中文标签。
     */
    private String resolveProcessTypeLabel(String processType) {
        if (processType == null) return "审批流程";
        return switch (processType) {
            case "RETIREMENT" -> "退役申请";
            case "WORK_ORDER" -> "工单审批";
            case "ASSET_TRANSFER" -> "资产转移";
            case "ASSET_CLEARANCE" -> "资产清退";
            case "ASSET_SCRAP" -> "资产报废";
            case "ASSET_COMPENSATION" -> "资产赔偿";
            default -> "审批流程";
        };
    }

    private Long parseLong(Object value, Long defaultValue) {
        if (value == null) return defaultValue;
        if (value instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    // ========== CC 通知发送 ==========

    /**
     * 发送 CC 通知邮件。
     * <p>从事件中解析 CC 角色编码和用户 ID，获取抄送人邮箱，调用 EmailService 发送。</p>
     * <p>异常被 catch 不传播，不阻塞审批主流程。</p>
     */
    private void sendCcNotification(ApprovalProcessEvent event, String templateName) {
        String ccRoleCodes = event.getCcRoleCodes();
        String ccUserIds = event.getCcUserIds();
        if ((ccRoleCodes == null || ccRoleCodes.isBlank()) && (ccUserIds == null || ccUserIds.isBlank())) {
            log.debug("无 CC 配置，跳过 CC 通知: processId={}", event.getProcessId());
            return;
        }

        try {
            String tenantId = event.getTenantId();
            if (tenantId == null) {
                log.warn("tenantId 为空，跳过 CC 通知: processId={}", event.getProcessId());
                return;
            }
            TenantContext.setTenantId(tenantId);
            try {
                // 1. 收集所有 CC 收件人邮箱
                Set<String> emailSet = new HashSet<>();
                if (ccRoleCodes != null && !ccRoleCodes.isBlank()) {
                    for (String code : ccRoleCodes.split(",")) {
                        code = code.trim();
                        if (code.isEmpty()) continue;
                        List<Long> userIds = userRoleMapper.selectActiveUserIdsByRole(code);
                        if (userIds != null) {
                            for (Long uid : userIds) {
                                String email = resolveUserEmail(uid);
                                if (email != null) emailSet.add(email);
                            }
                        }
                    }
                }
                if (ccUserIds != null && !ccUserIds.isBlank()) {
                    for (String idStr : ccUserIds.split(",")) {
                        idStr = idStr.trim();
                        if (idStr.isEmpty()) continue;
                        try {
                            Long uid = Long.parseLong(idStr);
                            String email = resolveUserEmail(uid);
                            if (email != null) emailSet.add(email);
                        } catch (NumberFormatException ignored) {
                        }
                    }
                }

                if (emailSet.isEmpty()) {
                    log.warn("CC 邮箱列表为空，跳过 CC 通知: processId={}, ccRoleCodes={}, ccUserIds={}",
                            event.getProcessId(), ccRoleCodes, ccUserIds);
                    return;
                }

                // 2. 渲染模板
                Context ctx = new Context();
                ctx.setVariable("workOrderTitle", event.getProcessNo());
                ctx.setVariable("submitterName", resolveUserName(event.getApplicantId()));
                ctx.setVariable("approverName", event.getApproverName() != null ? event.getApproverName() : "");
                ctx.setVariable("action", resolveCcActionLabel(event));
                ctx.setVariable("submittedAt", event.getTimestamp() != null
                        ? event.getTimestamp().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                        : LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
                ctx.setVariable("ccRole", ccRoleCodes != null ? ccRoleCodes : "");

                String htmlBody;
                try {
                    htmlBody = mailTemplateEngine.process(templateName, ctx);
                } catch (Exception e) {
                    log.warn("CC 邮件模板渲染失败: template={}, processId={}", templateName, event.getProcessId(), e);
                    return;
                }

                // 3. 发送邮件（第一个邮箱为 to，其余为 cc）
                List<String> emailList = new ArrayList<>(emailSet);
                String to = emailList.get(0);
                List<String> cc = emailList.size() > 1 ? emailList.subList(1, emailList.size()) : List.of();
                String subject = resolveCcSubject(event, templateName);
                emailService.sendHtmlEmailWithCc(to, cc, null, subject, htmlBody);
                log.info("CC 通知已发送: processId={}, template={}, to={}, ccCount={}",
                        event.getProcessId(), templateName, to, cc.size());
            } finally {
                TenantContext.clear();
            }
        } catch (Exception e) {
            // CC 异常不能阻塞审批主流程，仅记录警告日志
            log.warn("发送 CC 通知异常: processId={}, template={}", event.getProcessId(), templateName, e);
        }
    }

    private String resolveCcSubject(ApprovalProcessEvent event, String templateName) {
        String processLabel = resolveProcessTypeLabel(event.getProcessType());
        if (templateName.endsWith("submitted")) {
            return processLabel + "【已提交】抄送通知";
        } else if (templateName.endsWith("approved")) {
            return processLabel + "【已通过】抄送通知";
        } else if (templateName.endsWith("rejected")) {
            return processLabel + "【已驳回】抄送通知";
        }
        return processLabel + "审批抄送通知";
    }

    private String resolveCcActionLabel(ApprovalProcessEvent event) {
        if (event.isSubmitted()) return "提交";
        if (event.isApproved()) return "通过";
        if (event.isRejected()) return "驳回";
        return "操作";
    }

    private String resolveUserEmail(Long userId) {
        if (userId == null) return null;
        try {
            User user = userMapper.selectById(userId);
            return user != null ? user.getEmail() : null;
        } catch (Exception e) {
            log.warn("解析用户邮箱失败: userId={}", userId, e);
            return null;
        }
    }

    private String resolveUserName(Long userId) {
        if (userId == null) return "";
        try {
            User user = userMapper.selectById(userId);
            return user != null && user.getRealName() != null ? user.getRealName() : "未知用户(#" + userId + ")";
        } catch (Exception e) {
            log.warn("解析用户名失败: userId={}", userId, e);
            return "未知用户(#" + userId + ")";
        }
    }

    // ========== 待办清理 ==========

    /**
     * 根据流程 ID 完成所有关联待办（标记为 COMPLETED）。
     * <p>用于审批被驳回或取消时清理待办列表。</p>
     */
    private void completeTodosByRef(Long processId) {
        if (processId == null) return;
        try {
            todoService.completeByRef("APPROVAL_PROCESS", String.valueOf(processId));
            log.info("待办清理完成: refType=APPROVAL_PROCESS, refId={}", processId);
        } catch (Exception e) {
            log.warn("待办清理异常: processId={}", processId, e);
        }
    }
}
