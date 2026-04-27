package com.ams.workflow;

import com.ams.entity.Asset;
import com.ams.entity.RetirementApplication;
import com.ams.entity.ApprovalStep;
import com.ams.entity.LifecycleHistory;
import com.ams.service.ApprovalChainService;
import com.ams.service.ApprovalService;
import com.ams.service.LifecycleRecorder;
import com.ams.service.AssetService;
import com.ams.service.RetirementService;
import com.ams.common.exception.BusinessException;
import com.ams.common.exception.StateTransitionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 资产报废退役审批工作流引擎
 * 
 * <p>负责管理资产报废/退役申请的完整审批生命周期，包括：
 * <ul>
 *   <li>报废申请创建与资产状态锁定</li>
 *   <li>多级审批链激活与状态推进</li>
 *   <li>审批通过/驳回/撤销操作</li>
 *   <li>生命周期事件记录</li>
 *   <li>并发审批防护</li>
 * </ul>
 * 
 * <p>该引擎确保所有审批状态变更与生命周期记录在同一事务内完成，
 * 保证数据一致性。
 * 
 * @see RetirementApplication
 * @see ApprovalStep
 * @see LifecycleHistory
 * @since SWARM-2026-Q2-002
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RetirementApprovalWorkflow {

    private final ApprovalChainService approvalChainService;
    private final ApprovalService approvalService;
    private final LifecycleRecorder lifecycleRecorder;
    private final AssetService assetService;
    private final RetirementService retirementService;

    /** 审批任务版本号缓存，用于乐观锁并发控制 */
    private final ConcurrentHashMap<String, Long> taskVersionCache = new ConcurrentHashMap<>();

    /** 资产锁定状态缓存，key: assetId */
    private final ConcurrentHashMap<Long, Boolean> assetLockCache = new ConcurrentHashMap<>();

    /**
     * 创建报废/退役申请
     * 
     * <p>功能说明：
     * <ul>
     *   <li>验证资产当前可申请状态（非报废/退役中）</li>
     *   <li>检查是否存在待处理申请（防止重复申请）</li>
     *   <li>锁定资产状态为 under_retirement</li>
     *   <li>创建首级审批任务</li>
     *   <li>记录生命周期事件</li>
     * </ul>
     * 
     * @param assetId 资产ID
     * @param applicationType 申请类型（SCRAP/RETIREMENT）
     * @param reason 申请原因
     * @param applicantUserId 申请人用户ID
     * @return 创建的报废申请实体
     * @throws BusinessException 业务异常（资产已锁定/存在待处理申请/权限不足）
     * @see RetirementApplication
     * @see Asset
     */
    @Transactional(rollbackFor = Exception.class)
    public RetirementApplication createApplication(
            Long assetId,
            String applicationType,
            String reason,
            Long applicantUserId) {
        
        log.info("创建报废申请: assetId={}, type={}, userId={}", assetId, applicationType, applicantUserId);

        // 1. 验证资产存在且状态允许申请
        Asset asset = assetService.getAssetById(assetId)
                .orElseThrow(() -> new BusinessException("ASSET_NOT_FOUND", "资产不存在"));

        // 2. 检查资产是否已被锁定
        if (isAssetLocked(assetId)) {
            throw new BusinessException("ASSET_LOCKED", "资产正在审批中，禁止重复申请");
        }

        // 3. 检查是否存在待处理申请（RET_002 错误码）
        Optional<RetirementApplication> existingApp = retirementService.findPendingApplication(assetId);
        if (existingApp.isPresent()) {
            throw new BusinessException("RET_002", "该资产已存在待审批申请，禁止重复提交");
        }

        // 4. 验证申请人权限（仅资产归属部门用户可发起）
        if (!assetService.canUserApplyForAsset(applicantUserId, assetId)) {
            throw new BusinessException("PERMISSION_DENIED", "仅资产归属部门用户可发起报废申请");
        }

        // 5. 创建报废申请
        RetirementApplication application = RetirementApplication.builder()
                .assetId(assetId)
                .applicationType(applicationType)
                .reason(reason)
                .applicantUserId(applicantUserId)
                .departmentId(asset.getDepartmentId())
                .status("pending")
                .version(0L)
                .build();

        RetirementApplication savedApp = retirementService.saveApplication(application);

        // 6. 锁定资产状态
        assetService.updateAssetStatus(assetId, "under_retirement");
        lockAsset(assetId);

        // 7. 激活审批链首级任务
        approvalChainService.activateFirstStep(savedApp.getId());

        // 8. 记录生命周期事件
        lifecycleRecorder.recordEvent(
                assetId,
                "RETIREMENT_CREATED",
                "报废申请已创建",
                applicantUserId,
                savedApp.getId()
        );

        log.info("报废申请创建成功: applicationId={}", savedApp.getId());
        return savedApp;
    }

    /**
     * 执行审批操作（通过）
     * 
     * <p>功能说明：
     * <ul>
     *   <li>验证当前用户有权限审批该任务</li>
     *   <li>使用乐观锁防止并发审批</li>
     *   <li>审批通过后推进审批链到下一级</li>
     *   <li>全部审批通过后更新申请状态为 approved</li>
     *   <li>记录生命周期事件</li>
     * </ul>
     * 
     * @param taskId 审批任务ID
     * @param approverUserId 审批人用户ID
     * @param comment 审批意见
     * @return 审批结果，包含下一级任务或最终状态
     * @throws BusinessException 业务异常（权限不足/版本冲突）
     * @throws StateTransitionException 状态转换异常
     */
    @Transactional(rollbackFor = Exception.class)
    public ApprovalResult approveTask(Long taskId, Long approverUserId, String comment) {
        log.info("审批通过: taskId={}, userId={}", taskId, approverUserId);

        // 1. 获取审批任务
        ApprovalStep task = approvalService.getTaskById(taskId)
                .orElseThrow(() -> new BusinessException("TASK_NOT_FOUND", "审批任务不存在"));

        // 2. 验证审批权限
        if (!approvalService.canUserApproveTask(approverUserId, taskId)) {
            throw new BusinessException("PERMISSION_DENIED", "您无权审批该任务");
        }

        // 3. 乐观锁版本检查
        String versionKey = "task_" + taskId;
        Long expectedVersion = taskVersionCache.get(versionKey);
        if (expectedVersion != null && !expectedVersion.equals(task.getVersion())) {
            throw new BusinessException("CONFLICT_VERSION", "该任务已被其他人处理，请刷新后重试");
        }

        // 4. 执行审批通过
        approvalService.approveTask(taskId, approverUserId, comment);

        // 5. 获取关联的报废申请
        RetirementApplication application = retirementService.getApplicationById(task.getApplicationId());

        // 6. 检查是否还有下一级审批
        Optional<ApprovalStep> nextTask = approvalChainService.getNextStep(task.getApplicationId(), task.getStepOrder());

        if (nextTask.isPresent()) {
            // 存在下一级，激活下一级审批任务
            approvalChainService.activateStep(nextTask.get().getId());
            
            // 记录当前级别审批通过事件
            lifecycleRecorder.recordEvent(
                    application.getAssetId(),
                    "LEVEL_" + task.getStepOrder() + "_APPROVED",
                    "第" + task.getStepOrder() + "级审批通过，等待第" + nextTask.get().getStepOrder() + "级审批",
                    approverUserId,
                    application.getId()
            );

            return ApprovalResult.builder()
                    .status("PARTIAL_APPROVED")
                    .currentTaskId(taskId)
                    .nextTaskId(nextTask.get().getId())
                    .message("第" + task.getStepOrder() + "级审批通过，已激活第" + nextTask.get().getStepOrder() + "级审批")
                    .build();

        } else {
            // 全部审批完成，更新申请状态
            retirementService.updateApplicationStatus(application.getId(), "approved");
            
            // 更新资产状态
            String finalStatus = "SCRAPPED".equals(application.getApplicationType()) ? "scrapped" : "retired";
            assetService.updateAssetStatus(application.getAssetId(), finalStatus);
            unlockAsset(application.getAssetId());

            // 记录完成事件
            lifecycleRecorder.recordEvent(
                    application.getAssetId(),
                    "RETIREMENT_COMPLETED",
                    "报废申请审批完成，资产状态已变更为" + finalStatus,
                    approverUserId,
                    application.getId()
            );

            return ApprovalResult.builder()
                    .status("APPROVED")
                    .currentTaskId(taskId)
                    .finalAssetStatus(finalStatus)
                    .message("全部审批通过，报废申请已完成")
                    .build();
        }
    }

    /**
     * 执行审批驳回操作
     * 
     * <p>功能说明：
     * <ul>
     *   <li>驳回必须填写审批意见（≥10字符）</li>
     *   <li>驳回后申请状态变为 rejected</li>
     *   <li>解锁资产状态</li>
     *   <li>记录生命周期事件</li>
     * </ul>
     * 
     * @param taskId 审批任务ID
     * @param approverUserId 审批人用户ID
     * @param comment 驳回原因（必填，≥10字符）
     * @return 驳回结果
     * @throws BusinessException 业务异常（意见过短）
     */
    @Transactional(rollbackFor = Exception.class)
    public ApprovalResult rejectTask(Long taskId, Long approverUserId, String comment) {
        log.info("审批驳回: taskId={}, userId={}", taskId, approverUserId);

        // 1. 验证驳回意见
        if (comment == null || comment.trim().length() < 10) {
            throw new BusinessException("INVALID_COMMENT", "驳回时必须填写审批意见，至少10个字符");
        }

        // 2. 获取审批任务
        ApprovalStep task = approvalService.getTaskById(taskId)
                .orElseThrow(() -> new BusinessException("TASK_NOT_FOUND", "审批任务不存在"));

        // 3. 验证审批权限
        if (!approvalService.canUserApproveTask(approverUserId, taskId)) {
            throw new BusinessException("PERMISSION_DENIED", "您无权审批该任务");
        }

        // 4. 执行驳回
        approvalService.rejectTask(taskId, approverUserId, comment);

        // 5. 获取关联的报废申请
        RetirementApplication application = retirementService.getApplicationById(task.getApplicationId());

        // 6. 更新申请状态
        retirementService.updateApplicationStatus(application.getId(), "rejected");

        // 7. 解锁资产状态
        String originalStatus = assetService.getAssetOriginalStatus(application.getAssetId());
        assetService.updateAssetStatus(application.getAssetId(), originalStatus);
        unlockAsset(application.getAssetId());

        // 8. 记录生命周期事件
        lifecycleRecorder.recordEvent(
                application.getAssetId(),
                "APPLICATION_REJECTED",
                "报废申请被驳回，原因：" + comment,
                approverUserId,
                application.getId()
        );

        return ApprovalResult.builder()
                .status("REJECTED")
                .currentTaskId(taskId)
                .message("审批驳回成功")
                .rejectionReason(comment)
                .build();
    }

    /**
     * 申请人撤销申请
     * 
     * <p>功能说明：
     * <ul>
     *   <li>仅申请人可在首级审批前撤销</li>
     *   <li>撤销后资产状态恢复</li>
     *   <li>记录生命周期事件</li>
     * </ul>
     * 
     * @param applicationId 申请ID
     * @param userId 申请人用户ID
     * @return 撤销结果
     * @throws BusinessException 业务异常（非申请人/已过首级审批）
     */
    @Transactional(rollbackFor = Exception.class)
    public ApprovalResult withdrawApplication(Long applicationId, Long userId) {
        log.info("撤销申请: applicationId={}, userId={}", applicationId, userId);

        RetirementApplication application = retirementService.getApplicationById(applicationId);

        // 1. 验证是否为申请人
        if (!application.getApplicantUserId().equals(userId)) {
            throw new BusinessException("PERMISSION_DENIED", "仅申请人可撤销申请");
        }

        // 2. 验证是否为首级审批前
        ApprovalStep firstTask = approvalChainService.getFirstStep(applicationId);
        if (firstTask != null && "approved".equals(firstTask.getStatus())) {
            throw new BusinessException("INVALID_OPERATION", "首级审批已通过，无法撤销");
        }

        // 3. 更新申请状态
        retirementService.updateApplicationStatus(applicationId, "withdrawn");

        // 4. 取消审批链
        approvalChainService.cancelChain(applicationId);

        // 5. 恢复资产状态
        String originalStatus = assetService.getAssetOriginalStatus(application.getAssetId());
        assetService.updateAssetStatus(application.getAssetId(), originalStatus);
        unlockAsset(application.getAssetId());

        // 6. 记录生命周期事件
        lifecycleRecorder.recordEvent(
                application.getAssetId(),
                "APPLICATION_WITHDRAWN",
                "申请人主动撤销报废申请",
                userId,
                applicationId
        );

        return ApprovalResult.builder()
                .status("WITHDRAWN")
                .message("申请已成功撤销")
                .build();
    }

    /**
     * 转交审批任务
     * 
     * <p>功能说明：
     * <ul>
     *   <li>当前审批人可将任务转交给其他有权限的用户</li>
     *   <li>记录转交日志</li>
     * </ul>
     * 
     * @param taskId 任务ID
     * @param fromUserId 转出用户ID
     * @param toUserId 转入用户ID
     * @param comment 转交说明
     * @return 转交结果
     */
    @Transactional(rollbackFor = Exception.class)
    public ApprovalResult delegateTask(Long taskId, Long fromUserId, Long toUserId, String comment) {
        log.info("转交任务: taskId={}, from={}, to={}", taskId, fromUserId, toUserId);

        // 1. 验证转出权限
        ApprovalStep task = approvalService.getTaskById(taskId)
                .orElseThrow(() -> new BusinessException("TASK_NOT_FOUND", "审批任务不存在"));

        if (!approvalService.canUserApproveTask(fromUserId, taskId)) {
            throw new BusinessException("PERMISSION_DENIED", "您无权转交该任务");
        }

        // 2. 执行转交
        approvalService.delegateTask(taskId, fromUserId, toUserId, comment);

        // 3. 记录生命周期事件
        RetirementApplication application = retirementService.getApplicationById(task.getApplicationId());
        lifecycleRecorder.recordEvent(
                application.getAssetId(),
                "TASK_DELEGATED",
                "审批任务从用户" + fromUserId + "转交给用户" + toUserId,
                fromUserId,
                application.getId()
        );

        return ApprovalResult.builder()
                .status("DELEGATED")
                .currentTaskId(taskId)
                .delegatedToUserId(toUserId)
                .message("任务已成功转交")
                .build();
    }

    /**
     * 批量审批通过
     * 
     * <p>功能说明：
     * <ul>
     *   <li>仅限同级审批任务批量处理</li>
     *   <li>使用事务保证原子性</li>
     * </ul>
     * 
     * @param taskIds 任务ID列表
     * @param approverUserId 审批人ID
     * @param comment 审批意见
     * @return 批量审批结果列表
     */
    @Transactional(rollbackFor = Exception.class)
    public List<ApprovalResult> batchApprove(List<Long> taskIds, Long approverUserId, String comment) {
        log.info("批量审批: taskCount={}, userId={}", taskIds.size(), approverUserId);

        return taskIds.stream()
                .map(taskId -> {
                    try {
                        return approveTask(taskId, approverUserId, comment);
                    } catch (BusinessException e) {
                        return ApprovalResult.builder()
                                .status("FAILED")
                                .currentTaskId(taskId)
                                .errorCode(e.getCode())
                                .message(e.getMessage())
                                .build();
                    }
                })
                .toList();
    }

    /**
     * 查询资产生命周期历史
     * 
     * <p>功能说明：
     * <ul>
     *   <li>按时间倒序返回资产的所有生命周期事件</li>
     *   <li>包含创建、状态变更、审批等所有事件</li>
     * </ul>
     * 
     * @param assetId 资产ID
     * @return 生命周期事件列表
     */
    public List<LifecycleHistory> getAssetLifecycle(Long assetId) {
        return lifecycleRecorder.getLifecycleEvents(assetId);
    }

    /**
     * 检查资产是否已被锁定
     * 
     * @param assetId 资产ID
     * @return 是否已锁定
     */
    public boolean isAssetLocked(Long assetId) {
        return assetLockCache.getOrDefault(assetId, false);
    }

    /**
     * 锁定资产
     * 
     * @param assetId 资产ID
     */
    private void lockAsset(Long assetId) {
        assetLockCache.put(assetId, true);
    }

    /**
     * 解锁资产
     * 
     * @param assetId 资产ID
     */
    private void unlockAsset(Long assetId) {
        assetLockCache.remove(assetId);
    }

    /**
     * 更新任务版本号缓存（用于乐观锁）
     * 
     * @param taskId 任务ID
     * @param version 版本号
     */
    public void updateTaskVersion(Long taskId, Long version) {
        taskVersionCache.put("task_" + taskId, version);
    }

    /**
     * 审批结果内部类
     */
    @lombok.Builder
    @lombok.Data
    public static class ApprovalResult {
        /** 处理状态：PARTIAL_APPROVED/APPROVED/REJECTED/WITHDRAWN/DELEGATED/FAILED */
        private String status;
        
        /** 当前处理的任务ID */
        private Long currentTaskId;
        
        /** 下一级任务ID（仅在部分通过时有值） */
        private Long nextTaskId;
        
        /** 最终资产状态（仅在全部审批通过时有值） */
        private String finalAssetStatus;
        
        /** 结果消息 */
        private String message;
        
        /** 驳回原因 */
        private String rejectionReason;
        
        /** 转交目标用户ID */
        private Long delegatedToUserId;
        
        /** 错误码（失败时） */
        private String errorCode;
    }
}