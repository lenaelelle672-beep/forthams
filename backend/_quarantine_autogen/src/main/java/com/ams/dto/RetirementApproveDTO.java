package com.ams.dto;

import com.ams.common.ValidGroup;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;

/**
 * 报废审批DTO
 * 用于处理资产报废/退役申请的多级审批操作
 * 
 * @spec SWARM-2026-Q2-002: 资产报废退役流程与审批链集成
 * @since Iteration 5 - Phase 3
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RetirementApproveDTO {

    /**
     * 报废申请ID
     * 关联 RetirementApplication 实体的唯一标识
     */
    @NotNull(message = "申请ID不能为空", groups = ValidGroup.Update.class)
    private Long applicationId;

    /**
     * 审批动作类型
     * 可选值: APPROVE, REJECT, RETURN
     */
    @NotBlank(message = "审批动作不能为空")
    private String action;

    /**
     * 当前审批节点ID
     * 用于追踪审批链中的具体节点
     */
    @NotNull(message = "审批节点ID不能为空", groups = ValidGroup.Update.class)
    private Long approvalNodeId;

    /**
     * 审批人用户ID
     */
    @NotNull(message = "审批人ID不能为空")
    private Long approverId;

    /**
     * 审批意见
     * 驳回时必须填写（≥10字符）
     */
    @Size(min = 0, max = 500, message = "审批意见长度必须在0-500字符之间")
    private String comment;

    /**
     * 审批时间
     */
    private LocalDateTime approveTime;

    /**
     * 审批来源IP地址
     * 用于审计追踪
     */
    private String ipAddress;

    /**
     * 版本号（乐观锁）
     * 用于防止并发审批冲突
     */
    @NotNull(message = "版本号不能为空", groups = ValidGroup.Update.class)
    private Integer version;

    /**
     * 附件URL列表
     * 审批过程中可能需要上传补充材料
     */
    private java.util.List<String> attachments;

    /**
     * 审批节点层级
     * 标识当前审批在多级审批链中的位置
     * 范围: 1-5
     */
    private Integer nodeLevel;

    /**
     * 是否需要发送通知
     * 审批完成后通知申请人
     */
    @Builder.Default
    private Boolean notifyApplicant = true;

    /**
     * 审批结果详情
     * 可选字段，用于存储额外的审批结果信息
     */
    private String resultDetail;

    /**
     * 验证审批意见是否满足要求
     * 驳回操作时意见必须≥10字符
     * 
     * @return true if valid, false otherwise
     */
    public boolean isValidCommentForRejection() {
        if ("REJECT".equalsIgnoreCase(action)) {
            return comment != null && comment.trim().length() >= 10;
        }
        return true;
    }

    /**
     * 获取审批结果描述
     * 
     * @return 审批结果的中文描述
     */
    public String getActionDescription() {
        switch (action.toUpperCase()) {
            case "APPROVE":
                return "同意";
            case "REJECT":
                return "驳回";
            case "RETURN":
                return "退回";
            default:
                return "未知操作";
        }
    }
}