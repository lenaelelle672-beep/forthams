package com.ams.service.impl;

import com.ams.entity.RetirementRequest;
import com.ams.entity.ApprovalRecord;
import com.ams.entity.Asset;
import com.ams.repository.RetirementRequestRepository;
import com.ams.repository.ApprovalRecordRepository;
import com.ams.repository.AssetRepository;
import com.ams.service.RetirementService;
import com.ams.workflow.ApprovalChainResolver;
import com.ams.state.RetirementState;
import com.ams.state.RetirementEvent;
import com.ams.state.StateTransitionException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 资产退役服务实现类
 * 处理资产退役申请、审批流程和状态转换
 * 
 * 业务规则:
 * 1. 退役申请必须关联有效资产
 * 2. 资产必须处于"在用"状态才能申请退役
 * 3. 退役审批通过后，资产状态变更为"已退役"
 * 4. 退役记录需要完整审计日志
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RetirementServiceImpl implements RetirementService {

    private final RetirementRequestRepository retirementRepository;
    private final ApprovalRecordRepository approvalRecordRepository;
    private final AssetRepository assetRepository;
    private final ApprovalChainResolver approvalChainResolver;

    /**
     * 创建退役申请
     */
    @Override
    @Transactional
    public RetirementRequest createRetirementRequest(Long assetId, String reason, Long applicantId) {
        log.info("Creating retirement request for asset: {}, applicant: {}", assetId, applicantId);

        // 验证资产存在且状态有效
        Asset asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new IllegalArgumentException("Asset not found: " + assetId));

        if (!canRetire(asset)) {
            throw new StateTransitionException("Asset cannot be retired in current state: " + asset.getStatus());
        }

        // 创建退役申请
        RetirementRequest request = RetirementRequest.builder()
                .assetId(assetId)
                .reason(reason)
                .applicantId(applicantId)
                .status(RetirementState.PENDING_APPROVAL)
                .createdAt(LocalDateTime.now())
                .build();

        RetirementRequest saved = retirementRepository.save(request);
        log.info("Retirement request created: {}", saved.getId());

        // 初始化审批链
        approvalChainResolver.initializeApprovalChain(saved.getId(), "RETIREMENT");

        return saved;
    }

    /**
     * 提交退役审批
     */
    @Override
    @Transactional
    public RetirementRequest submitForApproval(Long requestId) {
        log.info("Submitting retirement request for approval: {}", requestId);

        RetirementRequest request = retirementRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Retirement request not found: " + requestId));

        if (request.getStatus() != RetirementState.PENDING_APPROVAL) {
            throw new StateTransitionException("Request is not in pending approval state");
        }

        // 触发提交审批事件
        return transitionState(request, RetirementEvent.SUBMIT);
    }

    /**
     * 审批退役申请
     */
    @Override
    @Transactional
    public RetirementRequest approve(Long requestId, Long approverId, String comment) {
        log.info("Approving retirement request: {} by approver: {}", requestId, approverId);

        RetirementRequest request = retirementRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Retirement request not found: " + requestId));

        // 记录审批记录
        ApprovalRecord record = ApprovalRecord.builder()
                .requestId(requestId)
                .requestType("RETIREMENT")
                .approverId(approverId)
                .action("APPROVE")
                .comment(comment)
                .timestamp(LocalDateTime.now())
                .build();
        approvalRecordRepository.save(record);

        return transitionState(request, RetirementEvent.APPROVE);
    }

    /**
     * 拒绝退役申请
     */
    @Override
    @Transactional
    public RetirementRequest reject(Long requestId, Long approverId, String reason) {
        log.info("Rejecting retirement request: {} by approver: {}", requestId, approverId);

        RetirementRequest request = retirementRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Retirement request not found: " + requestId));

        ApprovalRecord record = ApprovalRecord.builder()
                .requestId(requestId)
                .requestType("RETIREMENT")
                .approverId(approverId)
                .action("REJECT")
                .comment(reason)
                .timestamp(LocalDateTime.now())
                .build();
        approvalRecordRepository.save(record);

        return transitionState(request, RetirementEvent.REJECT);
    }

    /**
     * 撤销退役申请
     */
    @Override
    @Transactional
    public RetirementRequest cancel(Long requestId, Long userId) {
        log.info("Cancelling retirement request: {} by user: {}", requestId, userId);

        RetirementRequest request = retirementRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Retirement request not found: " + requestId));

        return transitionState(request, RetirementEvent.CANCEL);
    }

    /**
     * 获取退役申请详情
     */
    @Override
    public Optional<RetirementRequest> getById(Long requestId) {
        return retirementRepository.findById(requestId);
    }

    /**
     * 查询用户的退役申请列表
     */
    @Override
    public List<RetirementRequest> getByApplicantId(Long applicantId) {
        return retirementRepository.findByApplicantId(applicantId);
    }

    /**
     * 查询资产的退役历史
     */
    @Override
    public List<RetirementRequest> getHistoryByAssetId(Long assetId) {
        return retirementRepository.findByAssetIdOrderByCreatedAtDesc(assetId);
    }

    /**
     * 获取所有待审批的退役申请
     */
    @Override
    public List<RetirementRequest> getPendingApprovals() {
        return retirementRepository.findByStatus(RetirementState.PENDING_APPROVAL);
    }

    /**
     * 检查资产是否可以申请退役
     */
    @Override
    public boolean canRetire(Asset asset) {
        // 资产只有在"在用"状态才能申请退役
        return "ACTIVE".equals(asset.getStatus()) || "IN_USE".equals(asset.getStatus());
    }

    /**
     * 执行状态转换
     */
    private RetirementRequest transitionState(RetirementRequest request, RetirementEvent event) {
        RetirementState currentState = request.getStatus();
        RetirementState nextState = getNextState(currentState, event);
        
        request.setStatus(nextState);
        request.setUpdatedAt(LocalDateTime.now());
        
        if (event == RetirementEvent.APPROVE) {
            request.setApprovedAt(LocalDateTime.now());
            // 审批通过后更新资产状态
            updateAssetStatus(request.getAssetId(), "RETIRED");
        }
        
        if (event == RetirementEvent.REJECT || event == RetirementEvent.CANCEL) {
            request.setRejectedAt(LocalDateTime.now());
        }
        
        return retirementRepository.save(request);
    }

    /**
     * 根据当前状态和事件获取下一状态
     */
    private RetirementState getNextState(RetirementState current, RetirementEvent event) {
        return switch (event) {
            case SUBMIT -> RetirementState.SUBMITTED;
            case APPROVE -> RetirementState.APPROVED;
            case REJECT -> RetirementState.REJECTED;
            case CANCEL -> RetirementState.CANCELLED;
        };
    }

    /**
     * 更新资产状态
     */
    private void updateAssetStatus(Long assetId, String newStatus) {
        assetRepository.findById(assetId).ifPresent(asset -> {
            asset.setStatus(newStatus);
            asset.setUpdatedAt(LocalDateTime.now());
            assetRepository.save(asset);
            log.info("Asset {} status updated to {}", assetId, newStatus);
        });
    }

    /**
     * 获取退役审批进度
     */
    @Override
    public List<ApprovalRecord> getApprovalProgress(Long requestId) {
        return approvalRecordRepository.findByRequestId(requestId);
    }

    /**
     * 检查是否有待处理的审批任务
     */
    @Override
    public boolean hasPendingApproval(Long requestId) {
        RetirementRequest request = retirementRepository.findById(requestId).orElse(null);
        return request != null && request.getStatus() == RetirementState.PENDING_APPROVAL;
    }
}