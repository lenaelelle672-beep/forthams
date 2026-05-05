package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 资产报废申请数据传输对象
 * 
 * <p>用于资产报废流程的数据传输，包含报废申请的完整信息。
 * 支持报废申请提交、审批通过、审批驳回等操作场景。</p>
 * 
 * <p>使用示例：</p>
 * <pre>{@code
 * // 创建报废申请
 * ScrapRequestDTO request = ScrapRequestDTO.builder()
 *     .assetId(assetId)
 *     .applicantId(applicantId)
 *     .reason("设备老化无法修复")
 *     .build();
 * 
 * // 审批通过
 * ScrapRequestDTO approved = ScrapRequestDTO.builder()
 *     .id(requestId)
 *     .status(ScrapRequestStatus.APPROVED)
 *     .approverId(approverId)
 *     .approvedAt(LocalDateTime.now())
 *     .build();
 * }</pre>
 *
 * @author Asset Management System
 * @version 1.0
 * @since SWARM-002
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScrapRequestDTO {

    /**
     * 报废申请唯一标识
     */
    private UUID id;

    /**
     * 关联资产唯一标识
     */
    @NotNull(message = "资产ID不能为空")
    private UUID assetId;

    /**
     * 资产编号（冗余字段，便于前端展示）
     */
    private String assetCode;

    /**
     * 资产名称（冗余字段，便于前端展示）
     */
    private String assetName;

    /**
     * 申请人用户ID
     */
    @NotNull(message = "申请人ID不能为空")
    private UUID applicantId;

    /**
     * 申请人用户名（冗余字段，便于前端展示）
     */
    private String applicantName;

    /**
     * 报废原因
     */
    @NotBlank(message = "报废原因不能为空")
    @Size(max = 500, message = "报废原因长度不能超过500个字符")
    private String reason;

    /**
     * 报废申请状态
     * @see ScrapRequestStatus
     */
    @NotNull(message = "状态不能为空")
    private ScrapRequestStatus status;

    /**
     * 驳回原因（审批驳回时填写）
     */
    @Size(max = 500, message = "驳回原因长度不能超过500个字符")
    private String rejectReason;

    /**
     * 审批人ID（审批通过或驳回时填写）
     */
    private UUID approverId;

    /**
     * 审批人用户名（冗余字段，便于前端展示）
     */
    private String approverName;

    /**
     * 审批时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime approvedAt;

    /**
     * 创建时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    /**
     * 最后更新时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime updatedAt;

    /**
     * 报废申请状态枚举
     */
    public enum ScrapRequestStatus {
        /**
         * 待审批状态 - 初始状态，提交申请后进入此状态
         */
        PENDING("待审批"),

        /**
         * 已批准状态 - 审批通过后进入此状态，资产将被标记为报废
         */
        APPROVED("已批准"),

        /**
         * 已驳回状态 - 审批驳回后进入此状态，资产状态保持不变
         */
        REJECTED("已驳回");

        private final String description;

        ScrapRequestStatus(String description) {
            this.description = description;
        }

        public String getDescription() {
            return description;
        }
    }

    /**
     * 创建报废申请请求DTO（用于提交申请）
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateScrapRequestDTO {
        
        /**
         * 关联资产唯一标识
         */
        @NotNull(message = "资产ID不能为空")
        private UUID assetId;

        /**
         * 报废原因
         */
        @NotBlank(message = "报废原因不能为空")
        @Size(max = 500, message = "报废原因长度不能超过500个字符")
        private String reason;
    }

    /**
     * 审批报废申请请求DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ApproveScrapRequestDTO {
        
        /**
         * 报废申请ID
         */
        @NotNull(message = "申请ID不能为空")
        private UUID requestId;

        /**
         * 审批备注（可选）
         */
        @Size(max = 200, message = "审批备注长度不能超过200个字符")
        private String comment;
    }

    /**
     * 驳回报废申请请求DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RejectScrapRequestDTO {
        
        /**
         * 报废申请ID
         */
        @NotNull(message = "申请ID不能为空")
        private UUID requestId;

        /**
         * 驳回原因
         */
        @NotBlank(message = "驳回原因不能为空")
        @Size(max = 500, message = "驳回原因长度不能超过500个字符")
        private String reason;
    }

    /**
     * 报废申请查询DTO（用于列表查询）
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScrapRequestQueryDTO {
        
        /**
         * 资产ID（精确查询）
         */
        private UUID assetId;

        /**
         * 申请人ID（精确查询）
         */
        private UUID applicantId;

        /**
         * 审批人ID（精确查询）
         */
        private UUID approverId;

        /**
         * 申请状态（精确查询）
         */
        private ScrapRequestStatus status;

        /**
         * 查询起始时间
         */
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime startTime;

        /**
         * 查询结束时间
         */
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        private LocalDateTime endTime;

        /**
         * 页码（从1开始）
         */
        @Builder.Default
        private Integer page = 1;

        /**
         * 每页条数
         */
        @Builder.Default
        private Integer pageSize = 10;
    }
}