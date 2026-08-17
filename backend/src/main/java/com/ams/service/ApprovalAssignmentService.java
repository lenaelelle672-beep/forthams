package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.ApprovalNodeAssignment;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.User;
import com.ams.entity.WorkflowDefinition;
import com.ams.entity.WorkflowDefinitionVersion;
import com.ams.mapper.ApprovalNodeAssignmentMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.ams.mapper.WorkflowDefinitionMapper;
import com.ams.mapper.WorkflowDefinitionVersionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 将发布流程的审批节点解析为不可由客户端伪造的处理人快照，并在审批时以该快照作为
 * 原子条件。历史流程没有快照时 fail-closed，不能由任意持有动作权限的用户补审。
 */
@Service
@RequiredArgsConstructor
public class ApprovalAssignmentService {

    private static final String PENDING = "PENDING";
    private static final String DECIDED = "DECIDED";
    private static final String CANCELLED = "CANCELLED";
    private final ApprovalNodeAssignmentMapper approvalNodeAssignmentMapper;
    private final WorkflowDefinitionMapper workflowDefinitionMapper;
    private final WorkflowDefinitionVersionMapper workflowDefinitionVersionMapper;
    private final UserRoleMapper userRoleMapper;
    private final UserMapper userMapper;
    private final UserTenantMembershipMapper userTenantMembershipMapper;
    private final ObjectMapper objectMapper;

    @Transactional(rollbackFor = Exception.class)
    public void initializeForProcess(ApprovalProcess process, String workflowBusinessType) {
        String tenantId = TenantContext.requireTenantId();
        if (process == null || process.getId() == null || process.getApplicantId() == null
                || !tenantId.equals(process.getTenantId())) {
            throw new AccessDeniedException("审批流程缺少可验证的租户、申请人或主键");
        }
        WorkflowDefinition definition = workflowDefinitionMapper.selectOne(new LambdaQueryWrapper<WorkflowDefinition>()
                .eq(WorkflowDefinition::getTenantId, tenantId)
                .eq(WorkflowDefinition::getBusinessType, workflowBusinessType)
                .eq(WorkflowDefinition::getStatus, "PUBLISHED")
                .gt(WorkflowDefinition::getVersion, 0)
                .last("limit 1"));
        if (definition == null || definition.getId() == null) {
            throw new AccessDeniedException("审批流程未配置已发布的节点处理人");
        }

        WorkflowDefinitionVersion snapshot = requireDefinitionSnapshot(definition, tenantId, workflowBusinessType);
        List<NodeAssignees> nodes = resolveNodes(snapshot, tenantId);
        if (nodes.isEmpty()) {
            throw new AccessDeniedException("审批流程未配置可执行的审批节点");
        }
        for (int index = 0; index < nodes.size(); index++) {
            Set<Long> assigneeIds = new LinkedHashSet<>(nodes.get(index).assigneeIds());
            assigneeIds.remove(process.getApplicantId());
            if (assigneeIds.isEmpty()) {
                throw new AccessDeniedException("审批节点不能只分配给申请人本人");
            }
            for (Long assigneeId : assigneeIds) {
                ApprovalNodeAssignment assignment = new ApprovalNodeAssignment();
                assignment.setTenantId(tenantId);
                assignment.setProcessId(process.getId());
                assignment.setStepNo(index + 1);
                assignment.setAssigneeId(assigneeId);
                assignment.setStatus(PENDING);
                assignment.setWorkflowDefinitionId(definition.getId());
                assignment.setWorkflowVersion(definition.getVersion());
                if (approvalNodeAssignmentMapper.insert(assignment) != 1) {
                    throw new BusinessException("审批节点分配写入失败");
                }
            }
        }
    }

    /** 在审批流程状态变更前保留当前处理人节点；受影响行数不是 1 即拒绝。 */
    public void reserveCurrentAssignment(ApprovalProcess process, Long approverId) {
        String tenantId = TenantContext.requireTenantId();
        if (process == null || process.getId() == null || approverId == null || process.getCurrentStep() == null) {
            throw new AccessDeniedException("审批节点分配不完整");
        }
        ApprovalNodeAssignment currentAssignment = approvalNodeAssignmentMapper.selectOne(
                new LambdaQueryWrapper<ApprovalNodeAssignment>()
                        .eq(ApprovalNodeAssignment::getTenantId, tenantId)
                        .eq(ApprovalNodeAssignment::getProcessId, process.getId())
                        .eq(ApprovalNodeAssignment::getStepNo, process.getCurrentStep())
                        .eq(ApprovalNodeAssignment::getAssigneeId, approverId)
                        .eq(ApprovalNodeAssignment::getStatus, PENDING)
                        .last("limit 1"));
        if (currentAssignment == null) {
            throw new AccessDeniedException("当前用户不是该审批节点的已分配处理人");
        }
        requireTrustedAssignmentSnapshot(currentAssignment, tenantId);

        ApprovalNodeAssignment update = new ApprovalNodeAssignment();
        update.setStatus(DECIDED);
        update.setDecidedAt(LocalDateTime.now());
        int updated = approvalNodeAssignmentMapper.update(update, new LambdaUpdateWrapper<ApprovalNodeAssignment>()
                .eq(ApprovalNodeAssignment::getTenantId, tenantId)
                .eq(ApprovalNodeAssignment::getProcessId, process.getId())
                .eq(ApprovalNodeAssignment::getStepNo, process.getCurrentStep())
                .eq(ApprovalNodeAssignment::getAssigneeId, approverId)
                .eq(ApprovalNodeAssignment::getStatus, PENDING));
        if (updated != 1) {
            throw new AccessDeniedException("当前用户不是该审批节点的已分配处理人");
        }
    }

    /**
     * 流程进入撤销或驳回终态后，冻结全部尚未处理的节点，避免已失效流程继续出现在待办中。
     */
    public void freezePendingAssignments(Long processId) {
        String tenantId = TenantContext.requireTenantId();
        if (processId == null || processId <= 0) {
            throw new AccessDeniedException("审批流程主键不能为空");
        }
        ApprovalNodeAssignment update = new ApprovalNodeAssignment();
        update.setStatus(CANCELLED);
        approvalNodeAssignmentMapper.update(update, new LambdaUpdateWrapper<ApprovalNodeAssignment>()
                .eq(ApprovalNodeAssignment::getTenantId, tenantId)
                .eq(ApprovalNodeAssignment::getProcessId, processId)
                .eq(ApprovalNodeAssignment::getStatus, PENDING));
    }

    /** 将当前用户的节点分配写入 todo/count 查询，避免仅凭动作权限枚举待办。 */
    public void applyCurrentPendingAssignmentScope(QueryWrapper<ApprovalProcess> wrapper, Long approverId) {
        if (approverId == null || approverId <= 0) {
            throw new AccessDeniedException("审批人不能为空");
        }
        String tenantId = TenantContext.requireTenantId();
        wrapper.apply("EXISTS (SELECT 1 FROM approval_node_assignment current_assignment "
                        + "WHERE current_assignment.tenant_id = {0} "
                        + "AND current_assignment.process_id = approval_process.id "
                        + "AND current_assignment.step_no = approval_process.current_step "
                        + "AND current_assignment.assignee_id = {1} "
                        + "AND current_assignment.status = 'PENDING' "
                        + "AND EXISTS (SELECT 1 FROM workflow_definition_version definition_version "
                        + "WHERE definition_version.tenant_id = current_assignment.tenant_id "
                        + "AND definition_version.definition_id = current_assignment.workflow_definition_id "
                        + "AND definition_version.version = current_assignment.workflow_version "
                        + "AND definition_version.status = 'PUBLISHED'))",
                tenantId, approverId);
    }

    /** 节点快照是运行时唯一可信的步骤数；缺失快照的历史流程不得推断。 */
    public int getFinalStep(ApprovalProcess process) {
        String tenantId = TenantContext.requireTenantId();
        if (process == null || process.getId() == null) {
            throw new AccessDeniedException("审批流程缺少节点分配");
        }
        ApprovalNodeAssignment assignment = approvalNodeAssignmentMapper.selectOne(
                new LambdaQueryWrapper<ApprovalNodeAssignment>()
                        .eq(ApprovalNodeAssignment::getTenantId, tenantId)
                        .eq(ApprovalNodeAssignment::getProcessId, process.getId())
                        .orderByDesc(ApprovalNodeAssignment::getStepNo)
                        .last("limit 1"));
        if (assignment == null || assignment.getStepNo() == null || assignment.getStepNo() < 1) {
            throw new AccessDeniedException("审批流程没有可验证的节点分配");
        }
        requireTrustedAssignmentSnapshot(assignment, tenantId);
        return assignment.getStepNo();
    }

    /**
     * 发布闸门：每个审批节点必须能解析出至少一名当前租户有效处理人。
     * 禁止 SUPER_ADMIN、空角色和无法解析处理人的图；不改变运行时“恰好一名”的线性语义。
     */
    public void requirePublishableAssignees(String definitionJson, String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException("发布流程缺少当前租户");
        }
        WorkflowDefinitionVersion snapshot = new WorkflowDefinitionVersion();
        snapshot.setDefinitionJson(definitionJson);
        LinearWorkflowDefinitionValidator.ValidationResult validation = validateSnapshotDefinitionForPublish(snapshot);
        if (validation.orderedApprovalNodes().isEmpty()) {
            throw new BusinessException("无法发布：流程没有可解析处理人的审批节点");
        }
        for (Map<?, ?> node : validation.orderedApprovalNodes()) {
            requireAtLeastOnePublishableAssignee(node, tenantId);
        }
    }

    private List<NodeAssignees> resolveNodes(WorkflowDefinitionVersion snapshot, String tenantId) {
        LinearWorkflowDefinitionValidator.ValidationResult validation = validateSnapshotDefinition(snapshot);
        return validation.orderedApprovalNodes().stream()
                .map(node -> new NodeAssignees(resolveAssignees(node, tenantId)))
                .toList();
    }

    private void requireAtLeastOnePublishableAssignee(Map<?, ?> node, String tenantId) {
        Map<?, ?> config = LinearWorkflowDefinitionValidator.configurationFor(node);
        String approverType = textOf(config.get("approverType"));
        if ("user".equalsIgnoreCase(approverType)) {
            try {
                requireActiveTenantUser(parseUserId(textOf(config.get("approverId"))), tenantId);
                return;
            } catch (AccessDeniedException exception) {
                throw new BusinessException("无法发布：审批节点处理人不存在、已停用或不属于当前租户");
            }
        }
        if (!"role".equalsIgnoreCase(approverType)) {
            throw new BusinessException("无法发布：审批节点 approverType 不受支持");
        }
        String roleCode = textOf(config.get("approverRole"));
        if (roleCode.isBlank()) {
            throw new BusinessException("无法发布：审批节点未配置处理人角色");
        }
        if ("SUPER_ADMIN".equalsIgnoreCase(roleCode) || "ROLE_SUPER_ADMIN".equalsIgnoreCase(roleCode)) {
            throw new BusinessException("无法发布：禁止使用 SUPER_ADMIN 作为审批角色");
        }
        List<String> userIds = userRoleMapper.selectUserIdsByRoleCode(roleCode, tenantId);
        if (userIds == null || userIds.isEmpty()) {
            throw new BusinessException("无法发布：审批节点角色没有当前租户的有效处理人");
        }
        boolean resolved = false;
        for (String userId : userIds) {
            try {
                requireActiveTenantUser(parseUserId(userId), tenantId);
                resolved = true;
            } catch (AccessDeniedException ignored) {
                // 继续检查其余成员，发布只需至少一名有效处理人。
            }
        }
        if (!resolved) {
            throw new BusinessException("无法发布：审批节点角色没有当前租户的有效处理人");
        }
    }

    private LinearWorkflowDefinitionValidator.ValidationResult validateSnapshotDefinitionForPublish(
            WorkflowDefinitionVersion snapshot) {
        Map<String, Object> root;
        try {
            root = objectMapper.readValue(snapshot.getDefinitionJson(), new TypeReference<>() { });
        } catch (JsonProcessingException | IllegalArgumentException | NullPointerException exception) {
            throw new BusinessException("无法发布：流程定义无法解析");
        }
        LinearWorkflowDefinitionValidator.ValidationResult validation = LinearWorkflowDefinitionValidator.validate(root);
        if (!validation.valid()) {
            throw new BusinessException("流程图校验失败：" + String.join("；", validation.errors()));
        }
        return validation;
    }

    private Set<Long> resolveAssignees(Map<?, ?> node, String tenantId) {
        Map<?, ?> config = LinearWorkflowDefinitionValidator.configurationFor(node);
        String approverType = textOf(config.get("approverType"));
        if ("user".equalsIgnoreCase(approverType)) {
            return Set.of(requireActiveTenantUser(parseUserId(textOf(config.get("approverId"))), tenantId));
        }
        if (!"role".equalsIgnoreCase(approverType)) {
            throw new AccessDeniedException("审批节点 approverType 不受支持");
        }
        String roleCode = textOf(config.get("approverRole"));
        if (roleCode.isBlank()) {
            throw new AccessDeniedException("审批节点未配置 approverId 或 approverRole");
        }
        List<String> userIds = userRoleMapper.selectUserIdsByRoleCode(roleCode, tenantId);
        if (userIds == null || userIds.isEmpty()) {
            throw new AccessDeniedException("审批节点角色没有有效处理人");
        }
        Set<Long> resolved = new LinkedHashSet<>();
        for (String userId : userIds) {
            resolved.add(requireActiveTenantUser(parseUserId(userId), tenantId));
        }
        if (resolved.size() != 1) {
            throw new AccessDeniedException("当前线性审批运行时每个节点只能解析一名处理人，请配置唯一用户或唯一成员角色");
        }
        return resolved;
    }

    private WorkflowDefinitionVersion requireDefinitionSnapshot(WorkflowDefinition definition,
                                                                 String tenantId,
                                                                 String workflowBusinessType) {
        WorkflowDefinitionVersion snapshot = requireSnapshot(
                tenantId, definition == null ? null : definition.getId(),
                definition == null ? null : definition.getVersion());
        if (!workflowBusinessType.equals(snapshot.getBusinessType())) {
            throw new AccessDeniedException("审批流程版本快照与业务类型不匹配");
        }
        return snapshot;
    }

    private void requireTrustedAssignmentSnapshot(ApprovalNodeAssignment assignment, String tenantId) {
        WorkflowDefinitionVersion snapshot = requireSnapshot(tenantId,
                assignment.getWorkflowDefinitionId(), assignment.getWorkflowVersion());
        validateSnapshotDefinition(snapshot);
    }

    private LinearWorkflowDefinitionValidator.ValidationResult validateSnapshotDefinition(
            WorkflowDefinitionVersion snapshot) {
        Map<String, Object> root;
        try {
            root = objectMapper.readValue(snapshot.getDefinitionJson(), new TypeReference<>() { });
        } catch (JsonProcessingException | IllegalArgumentException exception) {
            throw new AccessDeniedException("已发布审批流程定义无法解析");
        }
        LinearWorkflowDefinitionValidator.ValidationResult validation = LinearWorkflowDefinitionValidator.validate(root);
        if (!validation.valid()) {
            throw new AccessDeniedException("已发布审批流程定义不受当前运行时支持: "
                    + String.join("；", validation.errors()));
        }
        return validation;
    }

    private WorkflowDefinitionVersion requireSnapshot(String tenantId, Long definitionId, Integer version) {
        if (definitionId == null || version == null || version <= 0) {
            throw new AccessDeniedException("审批流程缺少可信的版本快照");
        }
        WorkflowDefinitionVersion snapshot = workflowDefinitionVersionMapper.selectOne(
                new LambdaQueryWrapper<WorkflowDefinitionVersion>()
                        .eq(WorkflowDefinitionVersion::getTenantId, tenantId)
                        .eq(WorkflowDefinitionVersion::getDefinitionId, definitionId)
                        .eq(WorkflowDefinitionVersion::getVersion, version)
                        .eq(WorkflowDefinitionVersion::getStatus, "PUBLISHED")
                        .last("limit 1"));
        if (snapshot == null || snapshot.getDefinitionJson() == null || snapshot.getDefinitionJson().isBlank()) {
            throw new AccessDeniedException("审批流程版本快照缺失，拒绝处理历史流程");
        }
        return snapshot;
    }

    private Long requireActiveTenantUser(Long userId, String tenantId) {
        User user = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getId, userId)
                .eq(User::getTenantId, tenantId)
                .eq(User::getStatus, 1)
                .eq(User::getDeleted, 0)
                .last("limit 1"));
        if (user == null || user.getId() == null
                || userTenantMembershipMapper.countActiveMembership(user.getId(), tenantId) != 1) {
            throw new AccessDeniedException("审批节点处理人不存在、已停用或不属于当前租户");
        }
        return user.getId();
    }

    private Long parseUserId(String value) {
        try {
            long userId = Long.parseLong(value);
            if (userId <= 0) {
                throw new NumberFormatException();
            }
            return userId;
        } catch (NumberFormatException exception) {
            throw new AccessDeniedException("审批节点处理人 ID 不合法");
        }
    }

    private String textOf(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private record NodeAssignees(Set<Long> assigneeIds) {
    }
}
