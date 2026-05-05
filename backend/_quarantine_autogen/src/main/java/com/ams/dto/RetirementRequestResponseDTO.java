package com.ams.dto;

import com.ams.entity.RetirementRequest;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 退役申请响应DTO
 * 用于返回退役申请的完整信息，包括申请详情、审批记录和关联资产信息
 * 
 * @spec SWARM-223 资产报废退役流程后端
 * @since Iteration 1
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RetirementRequestResponseDTO {

    /**
     * 退役申请唯一标识
     */
    private UUID id;

    /**
     * 关联资产ID
     */
    private UUID assetId;

    /**
     * 资产编号（便于前端展示）
     */
    private String assetCode;

    /**
     * 资产名称
     */
    private String assetName;

    /**
     * 退役原因枚举值
     * @see com.ams.entity.RetirementRequest.RetirementReason
     */
    private String reason;

    /**
     * 退役原因详细描述（自由文本）
     */
    private String reasonDetail;

    /**
     * 当前申请状态
     * PENDING - 待审批
     * APPROVED - 已批准
     * REJECTED - 已驳回
     * CANCELLED - 已取消
     */
    private String status;

    /**
     * 申请人ID
     */
    private UUID requesterId;

    /**
     * 申请人姓名
     */
    private String requesterName;

    /**
     * 申请提交时间
     */
    private LocalDateTime requestTime;

    /**
     * 资产当前退役状态
     * ACTIVE - 使用中
     * RETIRED - 已退役
     */
    private String assetRetirementStatus;

    /**
     * 资产退役时间（当状态为RETIRED时有效）
     */
    private LocalDateTime retiredTime;

    /**
     * 审批记录列表
     */
    private List<ApprovalRecordDTO> approvalRecords;

    /**
     * 版本号（乐观锁）
     */
    private Integer version;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;

    /**
     * 最后更新时间
     */
    private LocalDateTime updatedAt;

    /**
     * 将Entity转换为ResponseDTO
     * 
     * @param request 退役申请实体
     * @param assetCode 资产编号
     * @param assetName 资产名称
     * @param requesterName 申请人姓名
     * @param approvalRecords 审批记录DTO列表
     * @return RetirementRequestResponseDTO
     */
    public static RetirementRequestResponseDTO fromEntity(
            RetirementRequest request,
            String assetCode,
            String assetName,
            String requesterName,
            List<ApprovalRecordDTO> approvalRecords) {
        
        return RetirementRequestResponseDTO.builder()
                .id(request.getId())
                .assetId(request.getAssetId())
                .assetCode(assetCode)
                .assetName(assetName)
                .reason(request.getReason())
                .reasonDetail(request.getReasonDetail())
                .status(request.getStatus().name())
                .requesterId(request.getRequesterId())
                .requesterName(requesterName)
                .requestTime(request.getRequestTime())
                .assetRetirementStatus(request.getAssetRetirementStatus())
                .retiredTime(request.getRetiredTime())
                .approvalRecords(approvalRecords)
                .version(request.getVersion())
                .createdAt(request.getCreatedAt())
                .updatedAt(request.getUpdatedAt())
                .build();
    }

    /**
     * 简化版本转换（无审批记录）
     * 
     * @param request 退役申请实体
     * @return RetirementRequestResponseDTO
     */
    public static RetirementRequestResponseDTO fromEntitySimple(RetirementRequest request) {
        return RetirementRequestResponseDTO.builder()
                .id(request.getId())
                .assetId(request.getAssetId())
                .reason(request.getReason())
                .reasonDetail(request.getReasonDetail())
                .status(request.getStatus().name())
                .requesterId(request.getRequesterId())
                .requestTime(request.getRequestTime())
                .assetRetirementStatus(request.getAssetRetirementStatus())
                .retiredTime(request.getRetiredTime())
                .version(request.getVersion())
                .createdAt(request.getCreatedAt())
                .updatedAt(request.getUpdatedAt())
                .build();
    }

    /**
     * 检查申请是否在待审批状态
     * 
     * @return true if status is PENDING
     */
    public boolean isPending() {
        return "PENDING".equals(this.status);
    }

    /**
     * 检查申请是否已完成（批准或驳回）
     * 
     * @return true if status is APPROVED or REJECTED
     */
    public boolean isCompleted() {
        return "APPROVED".equals(this.status) || "REJECTED".equals(this.status);
    }

    /**
     * 获取最后一条审批记录
     * 
     * @return 最后一条审批记录DTO，若无则返回null
     */
    public ApprovalRecordDTO getLastApprovalRecord() {
        if (approvalRecords == null || approvalRecords.isEmpty()) {
            return null;
        }
        return approvalRecords.get(approvalRecords.size() - 1);
    }
}