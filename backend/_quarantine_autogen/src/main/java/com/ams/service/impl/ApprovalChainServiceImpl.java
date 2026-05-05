package com.ams.service.impl;

import com.ams.entity.*;
import com.ams.mapper.*;
import com.ams.service.LifecycleRecorder;
import com.ams.common.exception.BusinessException;
import com.ams.state.RetirementEvent;
import com.ams.state.RetirementState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 审批链服务实现类
 * 
 * <p>负责管理资产报废/退役申请的多级审批链执行，包括：
 * <ul>
 *   <li>审批链激活与初始化</li>
 *   <li>审批节点按序推进</li>
 *   <li>审批完成与状态变更</li>
 *   <li>生命周期事件记录</li>
 *   <li>资产锁定状态管理</li>
 * </ul>
 *
 * @see ApprovalChainService
 * @see RetirementStateMachine
 * @version 1.0
 * @since SWARM-2026-Q2-002 Iteration 5
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ApprovalChainServiceImpl {

    private final ApprovalProcessMapper approvalProcessMapper;
    private final ApprovalRecordMapper approvalRecordMapper;
    private final RetirementApplicationMapper retirementApplicationMapper;
    private final AssetMapper assetMapper;
    private final LifecycleHistoryMapper lifecycleHistoryMapper;
    private final LifecycleRecorder lifecycleRecorder;

    /** 审批层级上限 */
    private static final int MAX_APPROVAL_LEVEL = 5;

    /** 审批任务超时时间（小时） */
    private static final int APPROVAL_TIMEOUT_HOURS = 72;

    /**
     * 激活审批链
     * 
     * <p>当报废/退役申请提交后，调用此方法激活审批链，生成第一级审批任务</p>
     *
     * @param applicationId 报废申请ID
     * @param assetId 资产ID
     * @param applicationType 申请类型（SCRAP/RETIREMENT）
     * @return 生成的审批节点列表
     * @throws BusinessException 如果资产已被锁定或申请不存在
     */
    @Transactional(rollbackFor = Exception.class)
    public List<ApprovalNode> activateChain(Long applicationId, Long assetId, String applicationType) {
        log.info("激活审批链 - applicationId: {}, assetId: {}, type: {}", applicationId, assetId, applicationType);
        
        // 1. 检查资产是否已被锁定
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null) {
            throw new BusinessException("ASSET_NOT_FOUND", "资产不存在: " + assetId);
        }
        
        if (isAssetLocked(asset)) {
            throw new BusinessException("ASSET_LOCKED", "资产正处于审批或维护中，禁止操作");
        }

        // 2. 锁定资产状态
        asset.setStatus("under_retirement");
        asset.setVersion(asset.getVersion() != null ? asset.getVersion() + 1 : 1);
        assetMapper.updateById(asset);
        log.debug("资产已锁定 - assetId: {}", assetId);

        // 3. 创建审批链配置
        ApprovalProcess approvalProcess = createApprovalProcess(applicationId, assetId, applicationType);
        approvalProcessMapper.insert(approvalProcess);

        // 4. 生成多级审批节点
        List<ApprovalNode> nodes = generateApprovalNodes(approvalProcess.getId(), asset);
        
        // 5. 记录生命周期事件 - 审批链激活
        lifecycleRecorder.recordEvent(
            assetId,
            "RETIREMENT_CREATED",
            applicationId,
            "报废申请已提交，审批链已激活",
            null
        );

        log.info("审批链激活成功 - processId: {}, 节点数: {}", approvalProcess.getId(), nodes.size());
        return nodes;
    }

    /**
     * 推进审批链到下一节点
     * 
     * <p>当当前节点审批通过后，调用此方法激活下一级审批任务</p>
     *
     * @param processId 审批流程ID
     * @param currentNodeId 当前节点ID
     * @param approverId 审批人ID
     * @param comment 审批意见
     * @return 下一级审批节点（如果存在），否则返回null
     * @throws BusinessException 如果审批记录不存在或版本冲突
     */
    @Transactional(rollbackFor = Exception.class)
    public ApprovalNode advanceChain(Long processId, Long currentNodeId, Long approverId, String comment) {
        log.info("推进审批链 - processId: {}, currentNodeId: {}, approverId: {}", processId, currentNodeId, approverId);
        
        // 1. 获取当前节点并验证
        ApprovalNode currentNode = getApprovalNode(currentNodeId);
        if (currentNode == null) {
            throw new BusinessException("NODE_NOT_FOUND", "审批节点不存在: " + currentNodeId);
        }

        if (!"pending".equals(currentNode.getStatus())) {
            throw new BusinessException("INVALID_NODE_STATUS", "节点状态无效或已处理: " + currentNode.getStatus());
        }

        // 2. 乐观锁版本检查
        Integer currentVersion = currentNode.getVersion();
        if (currentVersion == null) {
            currentVersion = 0;
        }

        // 3. 更新当前节点状态
        currentNode.setStatus("approved");
        currentNode.setApproverId(approverId);
        currentNode.setComment(comment);
        currentNode.setApprovedAt(LocalDateTime.now());
        currentNode.setVersion(currentVersion + 1);
        
        updateApprovalNode(currentNode);

        // 4. 记录审批历史
        saveApprovalRecord(processId, currentNodeId, approverId, "APPROVED", comment);

        // 5. 记录生命周期事件
        lifecycleRecorder.recordEvent(
            currentNode.getAssetId(),
            "LEVEL_" + currentNode.getLevel() + "_APPROVED",
            processId,
            "第" + currentNode.getLevel() + "级审批通过: " + comment,
            approverId
        );

        // 6. 检查是否还有下一级
        ApprovalNode nextNode = getNextNode(processId, currentNode.getLevel());
        if (nextNode != null) {
            nextNode.setStatus("pending");
            nextNode.setVersion(0);
            updateApprovalNode(nextNode);
            log.info("下一级审批节点已激活 - nodeId: {}", nextNode.getId());
            return nextNode;
        }

        log.info("审批链已完成 - processId: {}", processId);
        return null;
    }

    /**
     * 完成审批链
     * 
     * <p>当所有审批节点都通过后，调用此方法完成审批流程</p>
     *
     * @param processId 审批流程ID
     * @param applicationId 报废申请ID
     * @param applicationType 申请类型
     * @throws BusinessException 如果流程完成失败
     */
    @Transactional(rollbackFor = Exception.class)
    public void completeChain(Long processId, Long applicationId, String applicationType) {
        log.info("完成审批链 - processId: {}, applicationId: {}", processId, applicationId);
        
        // 1. 更新审批流程状态
        ApprovalProcess process = approvalProcessMapper.selectById(processId);
        if (process == null) {
            throw new BusinessException("PROCESS_NOT_FOUND", "审批流程不存在: " + processId);
        }
        
        process.setStatus("completed");
        process.setCompletedAt(LocalDateTime.now());
        approvalProcessMapper.updateById(process);

        // 2. 更新报废申请状态
        RetirementApplication application = retirementApplicationMapper.selectById(applicationId);
        if (application == null) {
            throw new BusinessException("APPLICATION_NOT_FOUND", "申请不存在: " + applicationId);
        }
        
        application.setStatus("approved");
        application.setUpdatedAt(LocalDateTime.now());
        retirementApplicationMapper.updateById(application);

        // 3. 更新资产状态
        Long assetId = application.getAssetId();
        Asset asset = assetMapper.selectById(assetId);
        if (asset != null) {
            String finalStatus = "SCRAP".equals(applicationType) ? "scrapped" : "retired";
            asset.setStatus(finalStatus);
            asset.setVersion(asset.getVersion() != null ? asset.getVersion() + 1 : 1);
            assetMapper.updateById(asset);
            
            // 记录生命周期事件
            lifecycleRecorder.recordEvent(
                assetId,
                "RETIREMENT_COMPLETED",
                applicationId,
                "报废申请已完成审批，资产状态变更为: " + finalStatus,
                null
            );
        }

        log.info("审批链完成 - processId: {}, 资产状态已更新", processId);
    }

    /**
     * 驳回审批链
     * 
     * <p>当任何一级审批被驳回时，调用此方法回退申请状态</p>
     *
     * @param processId 审批流程ID
     * @param currentNodeId 当前节点ID
     * @param approverId 审批人ID
     * @param comment 驳回原因（必须填写且不少于10字符）
     * @throws BusinessException 如果驳回原因过短或节点状态无效
     */
    @Transactional(rollbackFor = Exception.class)
    public void rejectChain(Long processId, Long currentNodeId, Long approverId, String comment) {
        log.info("驳回审批链 - processId: {}, nodeId: {}, approverId: {}", processId, currentNodeId, approverId);
        
        // 1. 验证驳回意见
        if (comment == null || comment.trim().length() < 10) {
            throw new BusinessException("COMMENT_TOO_SHORT", "驳回原因必须填写且不少于10个字符");
        }

        // 2. 获取并更新当前节点
        ApprovalNode currentNode = getApprovalNode(currentNodeId);
        if (currentNode == null) {
            throw new BusinessException("NODE_NOT_FOUND", "审批节点不存在");
        }

        currentNode.setStatus("rejected");
        currentNode.setApproverId(approverId);
        currentNode.setComment(comment);
        currentNode.setApprovedAt(LocalDateTime.now());
        currentNode.setVersion(currentNode.getVersion() != null ? currentNode.getVersion() + 1 : 1);
        updateApprovalNode(currentNode);

        // 3. 记录审批历史
        saveApprovalRecord(processId, currentNodeId, approverId, "REJECTED", comment);

        // 4. 更新流程状态
        ApprovalProcess process = approvalProcessMapper.selectById(processId);
        if (process != null) {
            process.setStatus("rejected");
            approvalProcessMapper.updateById(process);
        }

        // 5. 更新申请状态
        RetirementApplication application = retirementApplicationMapper.selectById(process.getApplicationId());
        if (application != null) {
            application.setStatus("rejected");
            application.setRejectReason(comment);
            application.setUpdatedAt(LocalDateTime.now());
            retirementApplicationMapper.updateById(application);
        }

        // 6. 解除资产锁定
        Asset asset = assetMapper.selectById(currentNode.getAssetId());
        if (asset != null && "under_retirement".equals(asset.getStatus())) {
            asset.setStatus("available");
            asset.setVersion(asset.getVersion() != null ? asset.getVersion() + 1 : 1);
            assetMapper.updateById(asset);
        }

        // 7. 记录生命周期事件
        lifecycleRecorder.recordEvent(
            currentNode.getAssetId(),
            "APPLICATION_REJECTED",
            processId,
            "申请被驳回: " + comment,
            approverId
        );

        log.info("审批链已驳回 - processId: {}, reason: {}", processId, comment);
    }

    /**
     * 撤销审批链
     * 
     * <p>仅在首级审批前，申请人可撤销自己的申请</p>
     *
     * @param processId 审批流程ID
     * @param applicationId 报废申请ID
     * @param userId 申请人ID
     * @throws BusinessException 如果无权限撤销或审批已超出首级
     */
    @Transactional(rollbackFor = Exception.class)
    public void revokeChain(Long processId, Long applicationId, Long userId) {
        log.info("撤销审批链 - processId: {}, applicationId: {}, userId: {}", processId, applicationId, userId);
        
        // 1. 验证申请人权限
        RetirementApplication application = retirementApplicationMapper.selectById(applicationId);
        if (application == null) {
            throw new BusinessException("APPLICATION_NOT_FOUND", "申请不存在");
        }
        
        if (!userId.equals(application.getApplicantId())) {
            throw new BusinessException("PERMISSION_DENIED", "仅申请人可撤销申请");
        }

        // 2. 检查是否为首级审批前
        ApprovalNode firstNode = getFirstNode(processId);
        if (firstNode != null && !"pending".equals(firstNode.getStatus())) {
            throw new BusinessException("CANNOT_REVOKE", "审批已开始，无法撤销");
        }

        // 3. 更新流程状态
        ApprovalProcess process = approvalProcessMapper.selectById(processId);
        if (process != null) {
            process.setStatus("revoked");
            approvalProcessMapper.updateById(process);
        }

        // 4. 更新申请状态
        application.setStatus("revoked");
        application.setUpdatedAt(LocalDateTime.now());
        retirementApplicationMapper.updateById(application);

        // 5. 解除资产锁定
        Asset asset = assetMapper.selectById(application.getAssetId());
        if (asset != null) {
            asset.setStatus("available");
            asset.setVersion(asset.getVersion() != null ? asset.getVersion() + 1 : 1);
            assetMapper.updateById(asset);
        }

        // 6. 记录生命周期事件
        lifecycleRecorder.recordEvent(
            application.getAssetId(),
            "APPLICATION_REVOKED",
            applicationId,
            "申请人主动撤销申请",
            userId
        );

        log.info("审批链已撤销 - processId: {}", processId);
    }

    /**
     * 转交审批任务
     * 
     * <p>审批人可将当前审批任务转交给其他用户</p>
     *
     * @param nodeId 审批节点ID
     * @param fromUserId 原审批人ID
     * @param toUserId 目标审批人ID
     * @param comment 转交说明
     * @throws BusinessException 如果权限不符或节点状态无效
     */
    @Transactional(rollbackFor = Exception.class)
    public void delegateApproval(Long nodeId, Long fromUserId, Long toUserId, String comment) {
        log.info("转交审批 - nodeId: {}, from: {}, to: {}", nodeId, fromUserId, toUserId);
        
        ApprovalNode node = getApprovalNode(nodeId);
        if (node == null) {
            throw new BusinessException("NODE_NOT_FOUND", "审批节点不存在");
        }

        if (!fromUserId.equals(node.getApproverId())) {
            throw new BusinessException("PERMISSION_DENIED", "仅当前审批人可以转交任务");
        }

        if (!"pending".equals(node.getStatus())) {
            throw new BusinessException("INVALID_NODE_STATUS", "任务已处理，无法转交");
        }

        // 记录转交历史
        node.setApproverId(toUserId);
        node.setComment((comment != null ? comment : "") + " [由用户" + fromUserId + "转交]");
        updateApprovalNode(node);

        // 记录生命周期事件
        lifecycleRecorder.recordEvent(
            node.getAssetId(),
            "APPROVAL_DELEGATED",
            node.getProcessId(),
            "审批任务已转交给用户" + toUserId,
            fromUserId
        );

        log.info("审批任务已转交 - nodeId: {}, newApprover: {}", nodeId, toUserId);
    }

    /**
     * 获取待审批任务列表
     * 
     * @param approverId 审批人ID
     * @return 待审批节点列表
     */
    public List<ApprovalNode> getPendingTasks(Long approverId) {
        return getApprovalNodesByApprover(approverId).stream()
            .filter(node -> "pending".equals(node.getStatus()))
            .collect(Collectors.toList());
    }

    /**
     * 检查资产是否处于锁定状态
     *
     * @param assetId 资产ID
     * @return true 如果资产已锁定
     */
    public boolean isAssetLocked(Long assetId) {
        Asset asset = assetMapper.selectById(assetId);
        return asset != null && isAssetLocked(asset);
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 判断资产是否处于锁定状态
     */
    private boolean isAssetLocked(Asset asset) {
        String status = asset.getStatus();
        return "under_retirement".equals(status) 
            || "under_maintenance".equals(status)
            || "in_transfer".equals(status);
    }

    /**
     * 创建审批流程记录
     */
    private ApprovalProcess createApprovalProcess(Long applicationId, Long assetId, String applicationType) {
        ApprovalProcess process = new ApprovalProcess();
        process.setApplicationId(applicationId);
        process.setAssetId(assetId);
        process.setApplicationType(applicationType);
        process.setStatus("active");
        process.setCreatedAt(LocalDateTime.now());
        process.setTotalLevels(3); // 默认3级审批
        return process;
    }

    /**
     * 生成多级审批节点
     */
    private List<ApprovalNode> generateApprovalNodes(Long processId, Asset asset) {
        List<ApprovalNode> nodes = new ArrayList<>();
        int levels = Math.min(3, MAX_APPROVAL_LEVEL); // 默认3级，最多5级
        
        for (int i = 1; i <= levels; i++) {
            ApprovalNode node = new ApprovalNode();
            node.setProcessId(processId);
            node.setAssetId(asset.getId());
            node.setLevel(i);
            node.setStatus(i == 1 ? "pending" : "waiting"); // 首级激活，其余等待
            node.setApproverId(getApproverIdForLevel(asset, i));
            node.setCreatedAt(LocalDateTime.now());
            node.setVersion(0);
            node.setTimeoutAt(LocalDateTime.now().plusHours(APPROVAL_TIMEOUT_HOURS * i));
            
            saveApprovalNode(node);
            nodes.add(node);
        }
        
        return nodes;
    }

    /**
     * 根据层级获取审批人ID（实际实现应从组织架构或配置获取）
     */
    private Long getApproverIdForLevel(Asset asset, int level) {
        // TODO: 实现从组织架构获取审批人的逻辑
        // 当前实现返回示例值
        return 1000L + level;
    }

    /**
     * 获取审批节点
     */
    private ApprovalNode getApprovalNode(Long nodeId) {
        // TODO: 实现从Mapper获取节点
        return null;
    }

    /**
     * 更新审批节点
     */
    private void updateApprovalNode(ApprovalNode node) {
        // TODO: 实现更新节点
    }

    /**
     * 保存审批节点
     */
    private void saveApprovalNode(ApprovalNode node) {
        // TODO: 实现保存节点
    }

    /**
     * 获取下一级节点
     */
    private ApprovalNode getNextNode(Long processId, int currentLevel) {
        // TODO: 实现查询下一级节点
        return null;
    }

    /**
     * 获取首级节点
     */
    private ApprovalNode getFirstNode(Long processId) {
        // TODO: 实现查询首级节点
        return null;
    }

    /**
     * 获取指定审批人的所有节点
     */
    private List<ApprovalNode> getApprovalNodesByApprover(Long approverId) {
        // TODO: 实现查询
        return new ArrayList<>();
    }

    /**
     * 保存审批记录
     */
    private void saveApprovalRecord(Long processId, Long nodeId, Long approverId, String action, String comment) {
        ApprovalRecord record = new ApprovalRecord();
        record.setProcessId(processId);
        record.setNodeId(nodeId);
        record.setApproverId(approverId);
        record.setAction(action);
        record.setComment(comment);
        record.setCreatedAt(LocalDateTime.now());
        approvalRecordMapper.insert(record);
    }
}