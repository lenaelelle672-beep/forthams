package com.ams.service;

import com.ams.entity.RetirementApplication;
import com.ams.entity.RetirementAuditLog;
import com.ams.repository.RetirementApplicationRepository;
import com.ams.repository.RetirementApprovalRecordRepository;
import com.ams.repository.RetirementAuditLogRepository;
import com.ams.state.RetirementState;
import com.ams.state.RetirementEvent;
import com.ams.state.RetirementStateMachine;
import com.ams.common.exception.RetirementStateTransitionException;
import com.ams.dto.RetirementApplicationDTO;
import com.ams.dto.RetirementApproveDTO;
import com.ams.dto.RetirementRejectDTO;
import com.ams.dto.RetirementRequestResponseDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 退休/报废申请服务
 * 处理固定资产的退休（报废）申请全生命周期管理
 * 
 * @since Iteration-1
 * @status QUARANTINED - 需要审查后选择性恢复
 */
@Service
public class RetirementService {

    private final RetirementApplicationRepository applicationRepository;
    private final RetirementApprovalRecordRepository approvalRecordRepository;
    private final RetirementAuditLogRepository auditLogRepository;
    private final RetirementStateMachine stateMachine;
    private final ApprovalChainService approvalChainService;
    private final NotificationService notificationService;

    @Autowired
    public RetirementService(
            RetirementApplicationRepository applicationRepository,
            RetirementApprovalRecordRepository approvalRecordRepository,
            RetirementAuditLogRepository auditLogRepository,
            RetirementStateMachine stateMachine,
            ApprovalChainService approvalChainService,
            NotificationService notificationService) {
        this.applicationRepository = applicationRepository;
        this.approvalRecordRepository = approvalRecordRepository;
        this.auditLogRepository = auditLogRepository;
        this.stateMachine = stateMachine;
        this.approvalChainService = approvalChainService;
        this.notificationService = notificationService;
    }

    /**
     * 创建新的退休/报废申请
     * 
     * @param applicationDTO 申请信息
     * @return 创建的申请记录
     */
    @Transactional
    public RetirementApplication createApplication(RetirementApplicationDTO applicationDTO) {
        // TODO: 验证资产状态是否允许申请退休
        // TODO: 检查资产是否已有待处理的退休申请
        
        RetirementApplication application = new RetirementApplication();
        application.setAssetId(applicationDTO.getAssetId());
        application.setApplicantId(applicationDTO.getApplicantId());
        application.setReason(applicationDTO.getReason());
        application.setExpectedRetirementDate(applicationDTO.getExpectedRetirementDate());
        application.setCurrentValue(applicationDTO.getCurrentValue());
        application.setAccumulatedDepreciation(applicationDTO.getAccumulatedDepreciation());
        application.setState(RetirementState.PENDING);
        application.setCreateTime(LocalDateTime.now());
        application.setUpdateTime(LocalDateTime.now());

        RetirementApplication saved = applicationRepository.save(application);
        
        // 记录审计日志
        logAuditEvent(saved.getId(), "CREATE", null, RetirementState.PENDING, 
                applicationDTO.getApplicantId(), "创建退休申请");
        
        // 触发审批链初始化
        approvalChainService.initializeApprovalChain(saved);
        
        return saved;
    }

    /**
     * 提交申请进入审批流程
     * 
     * @param applicationId 申请ID
     */
    @Transactional
    public void submitForApproval(Long applicationId) {
        RetirementApplication application = findById(applicationId);
        
        if (application.getState() != RetirementState.PENDING) {
            throw new RetirementStateTransitionException(
                    "申请状态不是待提交，无法提交审批");
        }
        
        stateMachine.fireEvent(application, RetirementEvent.SUBMIT);
        applicationRepository.save(application);
        
        logAuditEvent(applicationId, "SUBMIT", RetirementState.PENDING, 
                RetirementState.IN_REVIEW, null, "提交审批");
        
        // 通知审批人
        notificationService.notifyApprovers(application);
    }

    /**
     * 审批通过
     * 
     * @param approveDTO 审批通过信息
     * @return 审批后的申请
     */
    @Transactional
    public RetirementApplication approve(RetirementApproveDTO approveDTO) {
        RetirementApplication application = findById(approveDTO.getApplicationId());
        
        if (application.getState() != RetirementState.IN_REVIEW) {
            throw new RetirementStateTransitionException(
                    "申请不在审批中状态");
        }
        
        // 记录审批记录
        approvalRecordRepository.save(createApprovalRecord(application, 
                approveDTO.getApproverId(), true, approveDTO.getComment()));
        
        // 检查是否所有审批节点都通过
        if (approvalChainService.isAllApproved(application)) {
            stateMachine.fireEvent(application, RetirementEvent.APPROVE);
            application.setApproveTime(LocalDateTime.now());
            
            logAuditEvent(application.getId(), "APPROVE_FINAL", 
                    RetirementState.IN_REVIEW, RetirementState.APPROVED,
                    approveDTO.getApproverId(), "审批通过");
        } else {
            logAuditEvent(application.getId(), "APPROVE_NODE", 
                    null, null, approveDTO.getApproverId(), 
                    "审批节点通过，等待后续审批");
        }
        
        applicationRepository.save(application);
        notificationService.notifyApplicant(application, "APPROVED");
        
        return application;
    }

    /**
     * 审批拒绝
     * 
     * @param rejectDTO 审批拒绝信息
     * @return 拒绝后的申请
     */
    @Transactional
    public RetirementApplication reject(RetirementRejectDTO rejectDTO) {
        RetirementApplication application = findById(rejectDTO.getApplicationId());
        
        if (application.getState() != RetirementState.IN_REVIEW) {
            throw new RetirementStateTransitionException(
                    "申请不在审批中状态");
        }
        
        // 记录审批记录
        approvalRecordRepository.save(createApprovalRecord(application,
                rejectDTO.getApproverId(), false, rejectDTO.getReason()));
        
        // 触发拒绝事件
        stateMachine.fireEvent(application, RetirementEvent.REJECT);
        applicationRepository.save(application);
        
        logAuditEvent(application.getId(), "REJECT", RetirementState.IN_REVIEW,
                RetirementState.REJECTED, rejectDTO.getApproverId(),
                rejectDTO.getReason());
        
        notificationService.notifyApplicant(application, "REJECTED");
        
        return application;
    }

    /**
     * 执行退休操作
     * 
     * @param applicationId 申请ID
     * @param operatorId 操作人ID
     */
    @Transactional
    public void executeRetirement(Long applicationId, Long operatorId) {
        RetirementApplication application = findById(applicationId);
        
        if (application.getState() != RetirementState.APPROVED) {
            throw new RetirementStateTransitionException(
                    "申请未通过审批，无法执行退休");
        }
        
        stateMachine.fireEvent(application, RetirementEvent.EXECUTE);
        application.setExecuteTime(LocalDateTime.now());
        application.setExecutedBy(operatorId);
        applicationRepository.save(application);
        
        logAuditEvent(applicationId, "EXECUTE", RetirementState.APPROVED,
                RetirementState.COMPLETED, operatorId, "执行退休完成");
        
        // 触发资产状态变更
        // TODO: 调用 AssetStateService 更新资产状态
    }

    /**
     * 取消申请
     * 
     * @param applicationId 申请ID
     * @param userId 用户ID
     * @param reason 取消原因
     */
    @Transactional
    public void cancel(Long applicationId, Long userId, String reason) {
        RetirementApplication application = findById(applicationId);
        
        // 只有待提交或审批中状态可以取消
        if (application.getState() != RetirementState.PENDING 
                && application.getState() != RetirementState.IN_REVIEW) {
            throw new RetirementStateTransitionException(
                    "当前状态不允许取消申请");
        }
        
        stateMachine.fireEvent(application, RetirementEvent.CANCEL);
        applicationRepository.save(application);
        
        logAuditEvent(applicationId, "CANCEL", null, RetirementState.CANCELLED,
                userId, reason);
        
        notificationService.notifyApplicant(application, "CANCELLED");
    }

    /**
     * 重新提交被拒绝的申请
     * 
     * @param applicationId 申请ID
     */
    @Transactional
    public void resubmit(Long applicationId) {
        RetirementApplication application = findById(applicationId);
        
        if (application.getState() != RetirementState.REJECTED) {
            throw new RetirementStateTransitionException(
                    "只有被拒绝的申请可以重新提交");
        }
        
        // 重置审批链
        approvalChainService.resetApprovalChain(application);
        
        stateMachine.fireEvent(application, RetirementEvent.RESUBMIT);
        applicationRepository.save(application);
        
        logAuditEvent(applicationId, "RESUBMIT", RetirementState.REJECTED,
                RetirementState.PENDING, null, "重新提交申请");
    }

    /**
     * 查询申请列表
     * 
     * @param state 状态筛选（可选）
     * @param applicantId 申请人ID（可选）
     * @return 申请列表
     */
    public List<RetirementApplication> findApplications(RetirementState state, Long applicantId) {
        // TODO: 实现动态查询逻辑
        return applicationRepository.findAll().stream()
                .filter(app -> state == null || app.getState() == state)
                .filter(app -> applicantId == null || app.getApplicantId().equals(applicantId))
                .collect(Collectors.toList());
    }

    /**
     * 根据ID查询申请
     * 
     * @param applicationId 申请ID
     * @return 申请记录
     */
    public RetirementApplication findById(Long applicationId) {
        return applicationRepository.findById(applicationId)
                .orElseThrow(() -> new BusinessException("申请记录不存在: " + applicationId));
    }

    /**
     * 查询申请的历史记录
     * 
     * @param applicationId 申请ID
     * @return 历史记录列表
     */
    public List<RetirementAuditLog> getAuditHistory(Long applicationId) {
        return auditLogRepository.findByApplicationId(applicationId);
    }

    /**
     * 获取审批链状态
     * 
     * @param applicationId 申请ID
     * @return 审批链详情
     */
    public ApprovalChainService.ApprovalChainStatus getApprovalChainStatus(Long applicationId) {
        RetirementApplication application = findById(applicationId);
        return approvalChainService.getChainStatus(application);
    }

    /**
     * 创建审批记录
     */
    private ApprovalRecord createApprovalRecord(RetirementApplication application,
            Long approverId, boolean approved, String comment) {
        ApprovalRecord record = new ApprovalRecord();
        record.setApplicationId(application.getId());
        record.setApproverId(approverId);
        record.setApproved(approved);
        record.setComment(comment);
        record.setApprovalTime(LocalDateTime.now());
        return record;
    }

    /**
     * 记录审计日志
     */
    private void logAuditEvent(Long applicationId, String action,
            RetirementState fromState, RetirementState toState,
            Long operatorId, String description) {
        RetirementAuditLog log = new RetirementAuditLog();
        log.setApplicationId(applicationId);
        log.setAction(action);
        log.setFromState(fromState);
        log.setToState(toState);
        log.setOperatorId(operatorId);
        log.setDescription(description);
        log.setCreateTime(LocalDateTime.now());
        auditLogRepository.save(log);
    }

    /**
     * 检查申请是否可以执行特定操作
     * 
     * @param applicationId 申请ID
     * @param action 操作类型
     * @return 是否可以执行
     */
    public boolean canExecuteAction(Long applicationId, String action) {
        RetirementApplication application = findById(applicationId);
        return stateMachine.canFireEvent(application, RetirementEvent.valueOf(action));
    }
}