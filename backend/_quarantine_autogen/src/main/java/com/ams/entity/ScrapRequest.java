package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 资产报废请求实体类
 * 
 * <p>此类表示资产报废/退役流程的申请单据，包含报废原因、审批状态、流程节点等信息。
 * 遵循状态机驱动的审批流设计，支持完整的生命周期追踪。</p>
 * 
 * <p>状态流转规则：</p>
 * <ul>
 *   <li>PENDING → 审批中（发起申请后自动进入）</li>
 *   <li>PENDING → WITHDRAWN（申请人撤回）</li>
 *   <li>PENDING → REJECTED（审批驳回）</li>
 *   <li>APPROVED → SCRAPPED（最终审批通过，资产正式报废）</li>
 *   <li>APPROVED → REJECTED（中间审批驳回）</li>
 * </ul>
 * 
 * @author AMS Team
 * @version 1.0
 * @since Iteration 1 - SWARM-002
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("scrap_request")
public class ScrapRequest {

    /**
     * 主键ID
     */
    @TableId(type = IdType.ASSIGN_UUID)
    private UUID id;

    /**
     * 报废申请单号，格式: SCR-YYYYMMDD-XXXX
     */
    @TableField("application_no")
    private String applicationNo;

    /**
     * 关联资产ID
     */
    @TableField("asset_id")
    private UUID assetId;

    /**
     * 报废原因枚举值
     * @see ScrapReason
     */
    @TableField("reason")
    private String reason;

    /**
     * 报废详细描述
     */
    @TableField("description")
    private String description;

    /**
     * 当前申请状态
     * @see ScrapStatus
     */
    @TableField("status")
    private String status;

    /**
     * 当前审批节点序号（从1开始）
     */
    @TableField("current_node")
    private Integer currentNode;

    /**
     * 总审批节点数量
     */
    @TableField("total_nodes")
    private Integer totalNodes;

    /**
     * 申请人用户ID
     */
    @TableField("applicant_id")
    private UUID applicantId;

    /**
     * 当前处理人用户ID（当前审批节点负责人）
     */
    @TableField("current_handler_id")
    private UUID currentHandlerId;

    /**
     * 附件ID列表（JSON格式存储）
     */
    @TableField("attachments")
    private String attachments;

    /**
     * 审批意见
     */
    @TableField("approval_comment")
    private String approvalComment;

    /**
     * 预估残值（单位：分）
     */
    @TableField("estimated_residual_value")
    private Long estimatedResidualValue;

    /**
     * 实际残值（单位：分，审批完成后填写）
     */
    @TableField("actual_residual_value")
    private Long actualResidualValue;

    /**
     * 处置方式
     * @see DisposalMethod
     */
    @TableField("disposal_method")
    private String disposalMethod;

    /**
     * 创建时间
     */
    @TableField(value = "created_at", fill = FieldFill.INSERT)
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;

    /**
     * 逻辑删除标记
     */
    @TableLogic
    @TableField("deleted")
    private Integer deleted;

    /**
     * 报废原因枚举类
     */
    public static class ScrapReason {
        /** 物理损坏无法修复 */
        public static final String DAMAGE = "DAMAGE";
        /** 技术淘汰 */
        public static final String OBSOLETE = "OBSOLETE";
        /** 使用年限到期 */
        public static final String EXPIRED = "EXPIRED";
        /** 丢失或被盗 */
        public static final String LOSS = "LOSS";
        /** 政策性强制淘汰 */
        public static final String REGULATORY = "REGULATORY";
        /** 其他原因 */
        public static final String OTHER = "OTHER";

        private ScrapReason() {
            // 私有构造函数防止实例化
        }
    }

    /**
     * 报废申请状态枚举类
     */
    public static class ScrapStatus {
        /** 待审批 */
        public static final String PENDING = "PENDING";
        /** 审批中（已通过部分审批） */
        public static final String APPROVED = "APPROVED";
        /** 已驳回 */
        public static final String REJECTED = "REJECTED";
        /** 已报废（流程完成） */
        public static final String SCRAPPED = "SCRAPPED";
        /** 已撤回 */
        public static final String WITHDRAWN = "WITHDRAWN";

        private ScrapStatus() {
            // 私有构造函数防止实例化
        }
    }

    /**
     * 处置方式枚举类
     */
    public static class DisposalMethod {
        /** 变卖 */
        public static final String SELL = "SELL";
        /** 捐赠 */
        public static final String DONATE = "DONATE";
        /** 报废回收 */
        public static final String RECYCLE = "RECYCLE";
        /** 销毁 */
        public static final String DESTROY = "DESTROY";
        /** 库存封存 */
        public static final String STORAGE = "STORAGE";

        private DisposalMethod() {
            // 私有构造函数防止实例化
        }
    }

    /**
     * 检查是否可以进行状态转换
     * 
     * @param targetStatus 目标状态
     * @return 是否允许转换
     */
    public boolean canTransitionTo(String targetStatus) {
        if (this.status == null || targetStatus == null) {
            return false;
        }

        switch (this.status) {
            case ScrapStatus.PENDING:
                return ScrapStatus.REJECTED.equals(targetStatus) 
                    || ScrapStatus.WITHDRAWN.equals(targetStatus);
            case ScrapStatus.APPROVED:
                return ScrapStatus.SCRAPPED.equals(targetStatus) 
                    || ScrapStatus.REJECTED.equals(targetStatus);
            default:
                return false;
        }
    }

    /**
     * 检查是否为终态
     * 
     * @return 是否为终态
     */
    public boolean isTerminalState() {
        return ScrapStatus.REJECTED.equals(this.status) 
            || ScrapStatus.SCRAPPED.equals(this.status) 
            || ScrapStatus.WITHDRAWN.equals(this.status);
    }

    /**
     * 检查申请人是否有权限撤回
     * 
     * @param userId 用户ID
     * @return 是否有权限
     */
    public boolean canWithdrawBy(UUID userId) {
        return ScrapStatus.PENDING.equals(this.status) 
            && this.applicantId != null 
            && this.applicantId.equals(userId);
    }

    /**
     * 检查是否可以进行审批
     * 
     * @param node 审批节点
     * @param userId 用户ID
     * @return 是否可以审批
     */
    public boolean canApproveAt(int node, UUID userId) {
        return ScrapStatus.PENDING.equals(this.status) 
            && this.currentNode != null 
            && this.currentNode == node
            && this.currentHandlerId != null 
            && this.currentHandlerId.equals(userId);
    }
}