package com.ams.service;

import com.ams.entity.ApprovalProcess;
import com.ams.entity.ApprovalRecord;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.ApprovalRecordMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 审批链服务类
 * 
 * <p>职责：管理和维护资产管理系统中的审批工作流链式结构。
 * 该服务提供了审批链的构建、状态管理、节点遍历等核心功能。
 * 
 * <p>使用场景：
 * <ul>
 *   <li>资产退役审批流程</li>
 *   <li>工单审批流转</li>
 *   <li>批量审批操作</li>
 * </ul>
 * 
 * <p><strong>注意</strong>：此文件位于隔离区（_quarantine_autogen），
 * 包含未完成的业务实现。如需使用，请先检查业务逻辑完整性并按需选择性恢复。
 * 
 * @author forthAMS Codex
 * @version 1.0.0
 * @since 2026-04-22
 */
@Service
public class ApprovalChainService {

    private final ApprovalProcessMapper approvalProcessMapper;
    private final ApprovalRecordMapper approvalRecordMapper;

    /**
     * 审批节点状态枚举
     */
    public enum ApprovalNodeStatus {
        PENDING,     // 待审批
        APPROVED,    // 已通过
        REJECTED,    // 已拒绝
        SKIPPED,     // 已跳过
        DELEGATED    // 已委托
    }

    /**
     * 审批链类型枚举
     */
    public enum ApprovalChainType {
        ASSET_RETIREMENT,  // 资产退役审批
        WORKORDER,         // 工单审批
        BULK_APPROVAL      // 批量审批
    }

    /**
     * 内部审批节点数据传输对象
     */
    public static class ApprovalNodeVO {
        private Long id;
        private Long processId;
        private Long approverId;
        private String approverName;
        private Integer order;
        private ApprovalNodeStatus status;
        private String comment;
        private LocalDateTime approvedTime;
        private Long delegatedTo;

        // Getters and Setters
        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public Long getProcessId() { return processId; }
        public void setProcessId(Long processId) { this.processId = processId; }
        public Long getApproverId() { return approverId; }
        public void setApproverId(Long approverId) { this.approverId = approverId; }
        public String getApproverName() { return approverName; }
        public void setApproverName(String approverName) { this.approverName = approverName; }
        public Integer getOrder() { return order; }
        public void setOrder(Integer order) { this.order = order; }
        public ApprovalNodeStatus getStatus() { return status; }
        public void setStatus(ApprovalNodeStatus status) { this.status = status; }
        public String getComment() { return comment; }
        public void setComment(String comment) { this.comment = comment; }
        public LocalDateTime getApprovedTime() { return approvedTime; }
        public void setApprovedTime(LocalDateTime approvedTime) { this.approvedTime = approvedTime; }
        public Long getDelegatedTo() { return delegatedTo; }
        public void setDelegatedTo(Long delegatedTo) { this.delegatedTo = delegatedTo; }
    }

    /**
     * 审批链构建请求
     */
    public static class ApprovalChainBuildRequest {
        private Long businessId;        // 业务ID（如资产ID、工单ID）
        private ApprovalChainType chainType;
        private List<Long> approverIds; // 审批人ID列表（按审批顺序）
        private String description;
        private Long creatorId;

        // Getters and Setters
        public Long getBusinessId() { return businessId; }
        public void setBusinessId(Long businessId) { this.businessId = businessId; }
        public ApprovalChainType getChainType() { return chainType; }
        public void setChainType(ApprovalChainType chainType) { this.chainType = chainType; }
        public List<Long> getApproverIds() { return approverIds; }
        public void setApproverIds(List<Long> approverIds) { this.approverIds = approverIds; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public Long getCreatorId() { return creatorId; }
        public void setCreatorId(Long creatorId) { this.creatorId = creatorId; }
    }

    /**
     * 审批链状态响应
     */
    public static class ApprovalChainStatusVO {
        private Long processId;
        private Long businessId;
        private ApprovalChainType chainType;
        private String currentStatus;
        private Integer currentNodeIndex;
        private Integer totalNodes;
        private List<ApprovalNodeVO> nodes;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
        private boolean isCompleted;

        // Getters and Setters
        public Long getProcessId() { return processId; }
        public void setProcessId(Long processId) { this.processId = processId; }
        public Long getBusinessId() { return businessId; }
        public void setBusinessId(Long businessId) { this.businessId = businessId; }
        public ApprovalChainType getChainType() { return chainType; }
        public void setChainType(ApprovalChainType chainType) { this.chainType = chainType; }
        public String getCurrentStatus() { return currentStatus; }
        public void setCurrentStatus(String currentStatus) { this.currentStatus = currentStatus; }
        public Integer getCurrentNodeIndex() { return currentNodeIndex; }
        public void setCurrentNodeIndex(Integer currentNodeIndex) { this.currentNodeIndex = currentNodeIndex; }
        public Integer getTotalNodes() { return totalNodes; }
        public void setTotalNodes(Integer totalNodes) { this.totalNodes = totalNodes; }
        public List<ApprovalNodeVO> getNodes() { return nodes; }
        public void setNodes(List<ApprovalNodeVO> nodes) { this.nodes = nodes; }
        public LocalDateTime getStartTime() { return startTime; }
        public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
        public LocalDateTime getEndTime() { return endTime; }
        public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }
        public boolean isCompleted() { return isCompleted; }
        public void setCompleted(boolean completed) { isCompleted = completed; }
    }

    /**
     * 审批决策请求
     */
    public static class ApprovalDecisionRequest {
        private Long processId;
        private Long approverId;
        private boolean approved;        // true=通过，false=拒绝
        private String comment;
        private Long delegatedTo;       // 委托审批人ID（可选）

        // Getters and Setters
        public Long getProcessId() { return processId; }
        public void setProcessId(Long processId) { this.processId = processId; }
        public Long getApproverId() { return approverId; }
        public void setApproverId(Long approverId) { this.approverId = approverId; }
        public boolean isApproved() { return approved; }
        public void setApproved(boolean approved) { this.approved = approved; }
        public String getComment() { return comment; }
        public void setComment(String comment) { this.comment = comment; }
        public Long getDelegatedTo() { return delegatedTo; }
        public void setDelegatedTo(Long delegatedTo) { this.delegatedTo = delegatedTo; }
    }

    /**
     * 构造函数注入依赖
     * 
     * @param approvalProcessMapper 审批流程Mapper
     * @param approvalRecordMapper 审批记录Mapper
     */
    public ApprovalChainService(ApprovalProcessMapper approvalProcessMapper,
                               ApprovalRecordMapper approvalRecordMapper) {
        this.approvalProcessMapper = approvalProcessMapper;
        this.approvalRecordMapper = approvalRecordMapper;
    }

    /**
     * 构建审批链
     * 
     * <p>根据传入的审批人列表顺序创建审批节点链。
     * 首个节点自动标记为待审批状态，其余节点为等待状态。
     * 
     * @param request 审批链构建请求
     * @return 创建的审批流程ID
     * @throws IllegalArgumentException 当审批人列表为空时抛出
     */
    @Transactional
    public Long buildApprovalChain(ApprovalChainBuildRequest request) {
        // 参数校验
        if (request.getApproverIds() == null || request.getApproverIds().isEmpty()) {
            throw new IllegalArgumentException("审批人列表不能为空");
        }
        
        if (request.getBusinessId() == null) {
            throw new IllegalArgumentException("业务ID不能为空");
        }

        // 创建审批流程记录
        ApprovalProcess process = new ApprovalProcess();
        process.setBusinessId(request.getBusinessId());
        process.setChainType(request.getChainType().name());
        process.setDescription(request.getDescription());
        process.setCreatorId(request.getCreatorId());
        process.setStatus("PENDING");
        process.setCurrentNode(1);
        process.setTotalNodes(request.getApproverIds().size());
        process.setCreateTime(LocalDateTime.now());
        
        approvalProcessMapper.insert(process);
        Long processId = process.getId();

        // 创建审批节点记录
        List<ApprovalRecord> records = new ArrayList<>();
        for (int i = 0; i < request.getApproverIds().size(); i++) {
            ApprovalRecord record = new ApprovalRecord();
            record.setProcessId(processId);
            record.setApproverId(request.getApproverIds().get(i));
            record.setNodeOrder(i + 1);
            record.setStatus(i == 0 ? ApprovalNodeStatus.PENDING.name() : ApprovalNodeStatus.PENDING.name());
            record.setCreateTime(LocalDateTime.now());
            records.add(record);
        }
        
        // 批量插入审批记录
        for (ApprovalRecord record : records) {
            approvalRecordMapper.insert(record);
        }

        return processId;
    }

    /**
     * 执行审批决策
     * 
     * <p>处理当前节点审批人的决策，根据决策结果更新审批链状态。
     * 支持通过、拒绝、委托三种操作。
     * 
     * @param request 审批决策请求
     * @return 审批是否成功
     * @throws IllegalStateException 当审批流程已完成或审批人无权时抛出
     */
    @Transactional
    public boolean processApprovalDecision(ApprovalDecisionRequest request) {
        // 查询审批流程
        ApprovalProcess process = approvalProcessMapper.selectById(request.getProcessId());
        if (process == null) {
            throw new IllegalStateException("审批流程不存在");
        }
        
        if ("COMPLETED".equals(process.getStatus()) || "REJECTED".equals(process.getStatus())) {
            throw new IllegalStateException("审批流程已结束，无法继续审批");
        }

        // 查询当前待审批节点
        ApprovalRecord currentNode = findCurrentNode(process.getId(), process.getCurrentNode());
        if (currentNode == null) {
            throw new IllegalStateException("当前审批节点不存在");
        }

        // 验证审批人权限
        if (!currentNode.getApproverId().equals(request.getApproverId())) {
            throw new IllegalStateException("当前审批人无权进行此操作");
        }

        // 处理委托
        if (request.getDelegatedTo() != null) {
            currentNode.setStatus(ApprovalNodeStatus.DELEGATED.name());
            currentNode.setComment("委托给用户ID: " + request.getDelegatedTo());
            currentNode.setApprovedTime(LocalDateTime.now());
            
            // 创建新的委托节点
            ApprovalRecord delegatedNode = new ApprovalRecord();
            delegatedNode.setProcessId(process.getId());
            delegatedNode.setApproverId(request.getDelegatedTo());
            delegatedNode.setNodeOrder(currentNode.getNodeOrder());
            delegatedNode.setStatus(ApprovalNodeStatus.PENDING.name());
            delegatedNode.setCreateTime(LocalDateTime.now());
            approvalRecordMapper.insert(delegatedNode);
            
            approvalRecordMapper.updateById(currentNode);
            return true;
        }

        // 处理通过/拒绝
        if (request.isApproved()) {
            currentNode.setStatus(ApprovalNodeStatus.APPROVED.name());
            currentNode.setComment(request.getComment());
            currentNode.setApprovedTime(LocalDateTime.now());
            
            // 检查是否为最后一个节点
            if (process.getCurrentNode() >= process.getTotalNodes()) {
                process.setStatus("COMPLETED");
                process.setEndTime(LocalDateTime.now());
            } else {
                // 移动到下一节点
                process.setCurrentNode(process.getCurrentNode() + 1);
            }
        } else {
            currentNode.setStatus(ApprovalNodeStatus.REJECTED.name());
            currentNode.setComment(request.getComment());
            currentNode.setApprovedTime(LocalDateTime.now());
            process.setStatus("REJECTED");
            process.setEndTime(LocalDateTime.now());
        }

        approvalRecordMapper.updateById(currentNode);
        approvalProcessMapper.updateById(process);
        
        return true;
    }

    /**
     * 查询审批链状态
     * 
     * <p>获取指定审批流程的完整状态，包括所有节点信息和当前进度。
     * 
     * @param processId 审批流程ID
     * @return 审批链状态对象
     */
    public ApprovalChainStatusVO getApprovalChainStatus(Long processId) {
        ApprovalProcess process = approvalProcessMapper.selectById(processId);
        if (process == null) {
            return null;
        }

        List<ApprovalRecord> records = approvalRecordMapper.selectByProcessId(processId);
        
        ApprovalChainStatusVO status = new ApprovalChainStatusVO();
        status.setProcessId(process.getId());
        status.setBusinessId(process.getBusinessId());
        status.setChainType(ApprovalChainType.valueOf(process.getChainType()));
        status.setCurrentStatus(process.getStatus());
        status.setCurrentNodeIndex(process.getCurrentNode());
        status.setTotalNodes(process.getTotalNodes());
        status.setStartTime(process.getCreateTime());
        status.setEndTime(process.getEndTime());
        status.setCompleted("COMPLETED".equals(process.getStatus()) || "REJECTED".equals(process.getStatus()));

        List<ApprovalNodeVO> nodes = records.stream()
            .map(this::convertToNodeVO)
            .collect(Collectors.toList());
        status.setNodes(nodes);

        return status;
    }

    /**
     * 根据业务ID查询审批链
     * 
     * <p>根据业务ID（如资产ID）和业务类型查询关联的审批链信息。
     * 
     * @param businessId 业务ID
     * @param chainType 审批链类型
     * @return 审批链状态列表
     */
    public List<ApprovalChainStatusVO> getApprovalChainsByBusinessId(Long businessId, ApprovalChainType chainType) {
        List<ApprovalProcess> processes = approvalProcessMapper.selectByBusinessId(businessId, chainType.name());
        
        return processes.stream()
            .map(p -> getApprovalChainStatus(p.getId()))
            .collect(Collectors.toList());
    }

    /**
     * 批量审批操作
     * 
     * <p>对多个审批流程进行批量审批，需要审批人对所有流程都有权限。
     * 
     * @param processIds 审批流程ID列表
     * @param approverId 审批人ID
     * @param approved 是否通过
     * @param comment 审批意见
     * @return 成功审批的数量
     */
    @Transactional
    public int batchApprove(List<Long> processIds, Long approverId, boolean approved, String comment) {
        int successCount = 0;
        
        for (Long processId : processIds) {
            try {
                ApprovalDecisionRequest request = new ApprovalDecisionRequest();
                request.setProcessId(processId);
                request.setApproverId(approverId);
                request.setApproved(approved);
                request.setComment(comment);
                
                processApprovalDecision(request);
                successCount++;
            } catch (Exception e) {
                // 记录失败日志，继续处理下一个
                System.err.println("批量审批流程 " + processId + " 失败: " + e.getMessage());
            }
        }
        
        return successCount;
    }

    /**
     * 取消审批流程
     * 
     * <p>取消指定的审批流程，仅当流程尚未完成时可以取消。
     * 
     * @param processId 审批流程ID
     * @param operatorId 操作人ID
     * @return 是否取消成功
     */
    @Transactional
    public boolean cancelApprovalChain(Long processId, Long operatorId) {
        ApprovalProcess process = approvalProcessMapper.selectById(processId);
        if (process == null) {
            return false;
        }

        if ("COMPLETED".equals(process.getStatus()) || "REJECTED".equals(process.getStatus())) {
            return false;
        }

        process.setStatus("CANCELLED");
        process.setEndTime(LocalDateTime.now());
        approvalProcessMapper.updateById(process);

        // 更新所有待审批节点为已跳过
        List<ApprovalRecord> pendingRecords = approvalRecordMapper.selectPendingByProcessId(processId);
        for (ApprovalRecord record : pendingRecords) {
            record.setStatus(ApprovalNodeStatus.SKIPPED.name());
            approvalRecordMapper.updateById(record);
        }

        return true;
    }

    /**
     * 获取待我审批的流程列表
     * 
     * <p>查询指定用户需要审批的流程列表。
     * 
     * @param approverId 审批人ID
     * @return 待审批流程列表
     */
    public List<ApprovalChainStatusVO> getPendingApprovals(Long approverId) {
        List<ApprovalRecord> pendingRecords = approvalRecordMapper.selectPendingByApproverId(approverId);
        
        if (pendingRecords.isEmpty()) {
            return new ArrayList<>();
        }

        // 按流程ID分组去重
        Map<Long, List<ApprovalRecord>> groupedByProcess = pendingRecords.stream()
            .collect(Collectors.groupingBy(ApprovalRecord::getProcessId));

        List<ApprovalChainStatusVO> result = new ArrayList<>();
        for (Long processId : groupedByProcess.keySet()) {
            result.add(getApprovalChainStatus(processId));
        }

        return result;
    }

    // ========== 私有辅助方法 ==========

    /**
     * 查询当前节点
     */
    private ApprovalRecord findCurrentNode(Long processId, Integer nodeOrder) {
        List<ApprovalRecord> records = approvalRecordMapper.selectByProcessId(processId);
        return records.stream()
            .filter(r -> r.getNodeOrder().equals(nodeOrder))
            .findFirst()
            .orElse(null);
    }

    /**
     * 转换为节点视图对象
     */
    private ApprovalNodeVO convertToNodeVO(ApprovalRecord record) {
        ApprovalNodeVO vo = new ApprovalNodeVO();
        vo.setId(record.getId());
        vo.setProcessId(record.getProcessId());
        vo.setApproverId(record.getApproverId());
        vo.setOrder(record.getNodeOrder());
        vo.setStatus(ApprovalNodeStatus.valueOf(record.getStatus()));
        vo.setComment(record.getComment());
        vo.setApprovedTime(record.getApprovedTime());
        return vo;
    }
}