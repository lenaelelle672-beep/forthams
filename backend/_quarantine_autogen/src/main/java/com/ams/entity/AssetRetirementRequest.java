package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.math.BigDecimal;

/**
 * 资产退役请求实体
 * 
 * <p>描述: 用于管理资产退役/报废申请的业务实体，包含完整的审批流程状态管理</p>
 * 
 * <p>业务规则:</p>
 * <ul>
 *   <li>资产退役前必须经过审批流程</li>
 *   <li>退役状态包括: 待审批(PENDING)、已批准(APPROVED)、已拒绝(REJECTED)、已执行(COMPLETED)</li>
 *   <li>已退役资产不能再进行其他业务操作</li>
 * </ul>
 * 
 * @TODO 需要与 ApprovalChainService 集成实现完整审批流程
 * @FIXME 缺少与 AssetService 的状态同步机制
 * 
 * @see com.ams.state.RetirementState
 * @see com.ams.service.impl.RetirementServiceImpl
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("asset_retirement_request")
public class AssetRetirementRequest {

    /**
     * 主键ID
     */
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /**
     * 关联资产ID
     * 唯一标识一个具体的资产实例
     */
    @TableField("asset_id")
    private Long assetId;

    /**
     * 申请人用户ID
     */
    @TableField("applicant_id")
    private Long applicantId;

    /**
     * 申请部门ID
     */
    @TableField("dept_id")
    private Long deptId;

    /**
     * 申请理由
     * 记录资产退役的主要原因
     */
    @TableField("reason")
    private String reason;

    /**
     * 预期退役日期
     */
    @TableField("expected_retirement_date")
    private LocalDateTime expectedRetirementDate;

    /**
     * 实际退役日期
     * 审批通过后实际执行的时间
     */
    @TableField("actual_retirement_date")
    private LocalDateTime actualRetirementDate;

    /**
     * 资产原值
     * 记录退役资产的历史成本
     */
    @TableField("original_value")
    private BigDecimal originalValue;

    /**
     * 资产净值
     * 记录当前账面价值
     */
    @TableField("net_value")
    private BigDecimal netValue;

    /**
     * 累计折旧
     */
    @TableField("accumulated_depreciation")
    private BigDecimal accumulatedDepreciation;

    /**
     * 处理方式
     * 可能的值: SCRAP(报废), TRANSFER(转让), SELL(出售), OTHER(其他)
     */
    @TableField("disposal_method")
    private String disposalMethod;

    /**
     * 处理金额
     * 资产处置后的实际收入金额
     */
    @TableField("disposal_amount")
    private BigDecimal disposalAmount;

    /**
     * 当前状态
     * 关联 RetirementRequestStatus 枚举
     */
    @TableField("status")
    private String status;

    /**
     * 审批节点ID
     * 关联当前审批流程节点
     */
    @TableField("approval_node_id")
    private Long approvalNodeId;

    /**
     * 审批人ID
     */
    @TableField("approver_id")
    private Long approverId;

    /**
     * 审批时间
     */
    @TableField("approved_at")
    private LocalDateTime approvedAt;

    /**
     * 审批意见
     */
    @TableField("approval_comment")
    private String approvalComment;

    /**
     * 流程实例ID
     * 用于追踪完整的审批流程实例
     */
    @TableField("process_instance_id")
    private String processInstanceId;

    /**
     * 创建时间
     */
    @TableField(value = "create_time", fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    @TableField(value = "update_time", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /**
     * 创建人
     */
    @TableField("create_by")
    private String createBy;

    /**
     * 更新人
     */
    @TableField("update_by")
    private String updateBy;

    /**
     * 是否删除标记
     * 0-未删除, 1-已删除
     */
    @TableLogic
    @TableField("deleted")
    private Integer deleted;

    /**
     * 版本号
     * 用于乐观锁
     */
    @Version
    @TableField("version")
    private Integer version;

    /**
     * 备注信息
     */
    @TableField("remark")
    private String remark;

    /**
     * 辅助字段: 资产编号
     * 非持久化字段，用于显示
     */
    @TableField(exist = false)
    private String assetCode;

    /**
     * 辅助字段: 资产名称
     * 非持久化字段，用于显示
     */
    @TableField(exist = false)
    private String assetName;

    /**
     * 辅助字段: 申请人姓名
     * 非持久化字段，用于显示
     */
    @TableField(exist = false)
    private String applicantName;

    /**
     * 辅助字段: 部门名称
     * 非持久化字段，用于显示
     */
    @TableField(exist = false)
    private String deptName;

    /**
     * 判断是否为待审批状态
     * @return true if status is PENDING
     */
    public boolean isPending() {
        return "PENDING".equals(this.status);
    }

    /**
     * 判断是否可以撤销
     * @return true if can be cancelled (only PENDING status)
     */
    public boolean canBeCancelled() {
        return "PENDING".equals(this.status) && this.approvalNodeId == null;
    }

    /**
     * 判断是否可以执行退役操作
     * @return true if status is APPROVED
     */
    public boolean canExecuteRetirement() {
        return "APPROVED".equals(this.status);
    }

    /**
     * 枚举: 退役请求状态
     */
    public enum Status {
        /** 待审批 */
        PENDING,
        /** 审批中 */
        IN_APPROVAL,
        /** 已批准 */
        APPROVED,
        /** 已拒绝 */
        REJECTED,
        /** 已执行 */
        COMPLETED,
        /** 已撤销 */
        CANCELLED
    }

    /**
     * 枚举: 处理方式
     */
    public enum DisposalMethod {
        /** 报废 */
        SCRAP,
        /** 转让 */
        TRANSFER,
        /** 出售 */
        SELL,
        /** 其他 */
        OTHER
    }
}