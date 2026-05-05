package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.math.BigDecimal;

/**
 * 资产报废申请实体类
 * 
 * <p>管理资产从"在用"状态到"已报废"状态的全流程申请记录。
 * 支持多级审批链路，包括申请创建、审批流转、历史追溯等核心功能。</p>
 * 
 * <p>状态流转规则:</p>
 * <ul>
 *   <li>IN_USE → PENDING_RETIREMENT: 报废申请提交</li>
 *   <li>PENDING_RETIREMENT → RETIRED: 审批链全部通过</li>
 *   <li>PENDING_RETIREMENT → IN_USE: 审批驳回或申请人撤销</li>
 * </ul>
 * 
 * @author AMS Team
 * @version 1.0
 * @since 2024
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@TableName("retirement_request")
public class RetirementRequest {
    
    /**
     * 报废申请记录唯一标识符
     */
    @TableId(type = IdType.AUTO)
    private Long id;
    
    /**
     * 关联的资产ID
     */
    private Long assetId;
    
    /**
     * 申请人用户ID
     */
    private Long applicantId;
    
    /**
     * 报废原因描述
     */
    private String reason;
    
    /**
     * 报废申请当前状态
     * 
     * @see com.ams.state.RetirementRequestStatus
     */
    private String status;
    
    /**
     * 当前审批级别
     */
    private Integer currentApprovalLevel;
    
    /**
     * 审批链总级别数
     */
    private Integer totalApprovalLevels;
    
    /**
     * 预估报废价值（元）
     */
    private BigDecimal estimatedValue;
    
    /**
     * 实际处置价值（元）
     */
    private BigDecimal disposalValue;
    
    /**
     * 处置方式（如：拍卖、回收、销毁）
     */
    private String disposalMethod;
    
    /**
     * 备注信息
     */
    private String remarks;
    
    /**
     * 审批意见汇总
     */
    private String approvalComments;
    
    /**
     * 驳回原因（当状态为REJECTED时填写）
     */
    private String rejectionReason;
    
    /**
     * 审批完成时间
     */
    private LocalDateTime approvalCompletedAt;
    
    /**
     * 创建时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    
    /**
     * 更新时间
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
    
    /**
     * 逻辑删除标记
     * 0-未删除，1-已删除
     */
    @TableLogic
    private Integer deleted;
    
    /**
     * 创建人ID
     */
    private Long createBy;
    
    /**
     * 更新人ID
     */
    private Long updateBy;
    
    /**
     * 乐观锁版本号
     */
    @Version
    private Integer version;
    
    /**
     * 检查是否可以提交审批
     * 
     * @return true 如果状态为DRAFT或REJECTED
     */
    public boolean canSubmit() {
        return "DRAFT".equals(status) || "REJECTED".equals(status);
    }
    
    /**
     * 检查是否可以进行审批操作
     * 
     * @param level 审批级别
     * @return true 如果当前状态为PENDING且级别匹配
     */
    public boolean canApprove(int level) {
        return "PENDING".equals(status) && currentApprovalLevel != null 
            && currentApprovalLevel.equals(level);
    }
    
    /**
     * 检查是否可以撤销申请
     * 
     * @return true 如果当前状态为PENDING或DRAFT
     */
    public boolean canCancel() {
        return "PENDING".equals(status) || "DRAFT".equals(status);
    }
    
    /**
     * 检查是否已完成全部审批
     * 
     * @return true 如果当前级别达到总级别数
     */
    public boolean isApprovalCompleted() {
        return currentApprovalLevel != null && totalApprovalLevels != null 
            && currentApprovalLevel >= totalApprovalLevels;
    }
}