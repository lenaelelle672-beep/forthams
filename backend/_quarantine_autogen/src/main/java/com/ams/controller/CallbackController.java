package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.ApprovalRecord;
import com.ams.entity.RetirementRequest;
import com.ams.entity.UserRole;
import com.ams.service.ApprovalService;
import com.ams.service.RetirementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 资产报废退役审批回调控制器
 *
 * <p>该控制器负责处理来自工作流的审批回调请求，是资产报废退役模块与外部审批系统集成的关键入口。
 * 根据 SWARM-002 规格要求，实现以下核心功能：
 *
 * <ul>
 *   <li>审批通过/驳回回调处理</li>
 *   <li>回调签名安全校验</li>
 *   <li>重复回调幂等性保障</li>
 *   <li>申请人/审批人分离校验</li>
 * </ul>
 *
 * <p>该控制器遵循 Phase 1 实施序列中的 Layer 3 接口层设计规范。
 *
 * @author AMS Development Team
 * @version 1.0
 * @since SWARM-002 Phase 1
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/asset-retirement/callback")
@RequiredArgsConstructor
public class CallbackController {

    /** 审批服务依赖 */
    private final ApprovalService approvalService;

    /** 报废退役服务依赖 */
    private final RetirementService retirementService;

    /**
     * 缓存已处理的回调ID，用于实现幂等性保障
     *
     * <p>Key: callbackId (格式: applicationId + "_" + callbackType + "_" + timestamp)
     * <p>Value: 处理结果时间戳
     */
    private final ConcurrentHashMap<String, LocalDateTime> processedCallbacks = new ConcurrentHashMap<>();

    /** 回调签名密钥（生产环境应从配置中心获取） */
    private static final String WORKFLOW_SIGNATURE_SECRET = "workflow-secret-key";

    /** 回调去重缓存过期时间（分钟） */
    private static final int IDEMPOTENCY_CACHE_EXPIRE_MINUTES = 60;

    /**
     * 处理审批回调
     *
     * <p>这是审批回调的主入口接口，接收工作流系统的审批结果并执行相应的状态变更操作。
     *
     * <p><b>功能流程：</b>
     * <ol>
     *   <li>验证回调签名的合法性，防止伪造请求</li>
     *   <li>检查回调的幂等性，忽略重复回调</li>
     *   <li>校验申请人/审批人不得为同一用户</li>
     *   <li>根据审批结果执行资产状态变更</li>
     *   <li>记录生命周期历史</li>
     *   <li>响应工作流ACK</li>
     * </ol>
     *
     * <p><b>ATB覆盖：</b>
     * <ul>
     *   <li>ATB-4.1: 审批通过回调 - 资产状态更新成功</li>
     *   <li>ATB-4.2: 审批驳回回调 - 状态回退并记录驳回原因</li>
     *   <li>ATB-4.3: 申请人/审批人同一校验</li>
     *   <li>ATB-4.4: 重复回调幂等性保障</li>
     *   <li>ATB-4.5: 未知申请单处理</li>
     *   <li>ATB-4.6: 回调签名校验</li>
     * </ul>
     *
     * @param requestBody 回调请求体，包含审批结果信息
     * @param signature   工作流签名头（X-Workflow-Signature）
     * @return 处理结果响应
     */
    @PostMapping("/approval")
    public ResponseEntity<Result<Object>> handleApprovalCallback(
            @RequestBody ApprovalCallbackRequest requestBody,
            @RequestHeader(value = "X-Workflow-Signature", required = false) String signature) {

        log.info("Received approval callback for application: {}", requestBody.getApplicationId());

        // ATB-4.6: 回调签名校验
        if (!validateSignature(requestBody, signature)) {
            log.warn("Invalid callback signature for application: {}", requestBody.getApplicationId());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Result.error("UNAUTHORIZED", "Invalid callback signature"));
        }

        // 生成幂等键
        String idempotencyKey = generateIdempotencyKey(requestBody);

        // ATB-4.4: 重复回调幂等性检查
        if (isDuplicateCallback(idempotencyKey)) {
            log.info("Duplicate callback ignored for application: {}, idempotencyKey: {}",
                    requestBody.getApplicationId(), idempotencyKey);
            return ResponseEntity.ok(Result.success(Map.of(
                    "status", "duplicated callback ignored",
                    "applicationId", requestBody.getApplicationId()
            )));
        }

        // ATB-4.5: 查询申请单
        RetirementRequest retirementRequest = retirementService.findByApplicationId(requestBody.getApplicationId());
        if (retirementRequest == null) {
            log.warn("Application not found: {}", requestBody.getApplicationId());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Result.error("APPLICATION_NOT_FOUND",
                            "Retirement application not found: " + requestBody.getApplicationId()));
        }

        // ATB-4.3: 申请人/审批人同一校验
        if (isSelfApproval(retirementRequest.getApplicantId(), requestBody.getApproverId())) {
            log.warn("Self-approval forbidden for application: {}", requestBody.getApplicationId());
            return ResponseEntity.badRequest()
                    .body(Result.error("APPROVAL_SELF_FORBIDDEN",
                            "Applicant and approver cannot be the same user"));
        }

        try {
            // ATB-4.1 & ATB-4.2: 根据审批结果执行处理
            Callback处理Result result = processCallback(requestBody, retirementRequest);

            // 记录已处理的回调
            markCallbackProcessed(idempotencyKey);

            log.info("Approval callback processed successfully for application: {}, result: {}",
                    requestBody.getApplicationId(), result.getStatus());

            return ResponseEntity.ok(Result.success(Map.of(
                    "status", result.getStatus(),
                    "message", result.getMessage(),
                    "assetId", result.getAssetId(),
                    "newState", result.getNewState()
            )));

        } catch (Exception e) {
            log.error("Error processing approval callback for application: {}",
                    requestBody.getApplicationId(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Result.error("INTERNAL_ERROR", "Failed to process approval callback"));
        }
    }

    /**
     * 验证回调签名
     *
     * <p>通过 HMAC-SHA256 算法验证回调请求的签名，确保请求来自合法的工作流系统。
     * 生产环境中应使用更完善的签名验证机制。
     *
     * @param request   回调请求体
     * @param signature 工作流签名头
     * @return 签名是否有效
     */
    private boolean validateSignature(ApprovalCallbackRequest request, String signature) {
        if (signature == null || signature.isEmpty()) {
            return false;
        }

        // 简化的签名验证逻辑，生产环境应使用完整的 HMAC 验证
        // 实际实现应包含: HMAC-SHA256(requestBody, secretKey) == signature
        String expectedSignature = generateSignature(request);
        return expectedSignature.equals(signature);
    }

    /**
     * 生成签名
     *
     * @param request 回调请求体
     * @return 计算后的签名
     */
    private String generateSignature(ApprovalCallbackRequest request) {
        // 简化实现，生产环境应使用完整的签名算法
        String data = request.getApplicationId() + "_" +
                request.getCallbackType() + "_" +
                WORKFLOW_SIGNATURE_SECRET;
        return String.valueOf(data.hashCode());
    }

    /**
     * 生成幂等键
     *
     * <p>幂等键格式: applicationId_callbackType_timestamp
     * 用于标识唯一的回调请求，实现重复回调的检测和忽略。
     *
     * @param request 回调请求体
     * @return 幂等键字符串
     */
    private String generateIdempotencyKey(ApprovalCallbackRequest request) {
        return String.format("%s_%s_%s",
                request.getApplicationId(),
                request.getCallbackType(),
                request.getTimestamp() != null ? request.getTimestamp() : System.currentTimeMillis());
    }

    /**
     * 检查是否为重复回调
     *
     * @param idempotencyKey 幂等键
     * @return 是否已处理过该回调
     */
    private boolean isDuplicateCallback(String idempotencyKey) {
        return processedCallbacks.containsKey(idempotencyKey);
    }

    /**
     * 标记回调已处理
     *
     * <p>将回调ID加入已处理缓存，设置过期时间自动清理。
     *
     * @param idempotencyKey 幂等键
     */
    private void markCallbackProcessed(String idempotencyKey) {
        processedCallbacks.put(idempotencyKey, LocalDateTime.now());
        // 简单实现，生产环境应使用带过期时间的缓存（如 Caffeine 或 Redis）
        if (processedCallbacks.size() > 10000) {
            // 防止缓存无限增长，清理超过阈值的旧记录
            processedCallbacks.clear();
        }
    }

    /**
     * 检查是否为自我审批
     *
     * <p>根据业务规则，申请人不得审批自己创建的报废申请。
     *
     * @param applicantId 申请人ID
     * @param approverId   审批人ID
     * @return 是否为自我审批
     */
    private boolean isSelfApproval(String applicantId, String approverId) {
        return applicantId != null && applicantId.equals(approverId);
    }

    /**
     * 处理回调请求
     *
     * <p>根据审批结果类型执行相应的业务逻辑：
     * <ul>
     *   <li>APPROVE: 更新资产状态为退役/报废，生成生命周期记录</li>
     *   <li>REJECT: 回退资产状态，记录驳回原因</li>
     * </ul>
     *
     * @param request           回调请求体
     * @param retirementRequest 报废申请单
     * @return 处理结果
     */
    private Callback处理Result processCallback(ApprovalCallbackRequest request,
                                               RetirementRequest retirementRequest) {
        String callbackType = request.getCallbackType().toUpperCase();

        switch (callbackType) {
            case "APPROVE":
                return handleApprovalApproved(request, retirementRequest);
            case "REJECT":
                return handleApprovalRejected(request, retirementRequest);
            default:
                throw new IllegalArgumentException("Unknown callback type: " + callbackType);
        }
    }

    /**
     * 处理审批通过
     *
     * <p>ATB-4.1: 审批通过后，资产状态变更为已退役/已报废，生成完整的生命周期历史记录。
     *
     * @param request           回调请求体
     * @param retirementRequest 报废申请单
     * @return 处理结果
     */
    private Callback处理Result handleApprovalApproved(ApprovalCallbackRequest request,
                                                     RetirementRequest retirementRequest) {
        // 确定最终状态（根据处置方式）
        String newState = determineFinalState(retirementRequest.getDisposalMethod());

        // 执行状态变更
        retirementService.updateAssetStatus(retirementRequest.getAssetId(), newState);

        // 记录生命周期历史
        retirementService.recordLifecycleHistory(
                retirementRequest.getAssetId(),
                "PENDING_APPROVAL",
                newState,
                request.getApproverId(),
                "审批通过",
                request.getApproverComment()
        );

        return Callback处理Result.builder()
                .status("state_updated")
                .message("Approval processed successfully")
                .assetId(retirementRequest.getAssetId())
                .newState(newState)
                .build();
    }

    /**
     * 处理审批驳回
     *
     * <p>ATB-4.2: 审批驳回后，资产状态回退至在役，记录驳回原因到生命周期历史。
     *
     * @param request           回调请求体
     * @param retirementRequest 报废申请单
     * @return 处理结果
     */
    private Callback处理Result handleApprovalRejected(ApprovalCallbackRequest request,
                                                     RetirementRequest retirementRequest) {
        // 状态回退至在役
        String previousState = "IN_SERVICE";

        // 执行状态回退
        retirementService.updateAssetStatus(retirementRequest.getAssetId(), previousState);

        // 记录生命周期历史（含驳回原因）
        retirementService.recordLifecycleHistory(
                retirementRequest.getAssetId(),
                "PENDING_APPROVAL",
                previousState,
                request.getApproverId(),
                "审批驳回",
                request.getApproverComment()
        );

        return Callback处理Result.builder()
                .status("state_rolled_back")
                .message("Approval rejected, asset status rolled back")
                .assetId(retirementRequest.getAssetId())
                .newState(previousState)
                .build();
    }

    /**
     * 根据处置方式确定最终状态
     *
     * <p>处置方式映射：
     * <ul>
     *   <li>销毁(DESTROY): 已报废</li>
     *   <li>其他处置方式: 已退役</li>
     * </ul>
     *
     * @param disposalMethod 处置方式
     * @return 最终状态枚举值
     */
    private String determineFinalState(String disposalMethod) {
        if ("DESTROY".equalsIgnoreCase(disposalMethod)) {
            return "RETIRED_DESTROYED";
        }
        return "RETIRED";
    }

    /**
     * 审批回调请求体
     *
     * <p>定义工作流系统回调时传递的数据结构。
     */
    @lombok.Data
    public static class ApprovalCallbackRequest {
        /** 申请单ID */
        private String applicationId;

        /** 回调类型: APPROVE 或 REJECT */
        private String callbackType;

        /** 审批人ID */
        private String approverId;

        /** 审批意见/驳回原因 */
        private String approverComment;

        /** 回调时间戳（用于幂等键生成） */
        private Long timestamp;
    }

    /**
     * 回调处理结果
     *
     * <p>封装回调处理完成后的返回数据。
     */
    @lombok.Builder
    @lombok.Data
    public static class Callback处理Result {
        /** 处理状态标识 */
        private String status;

        /** 处理消息 */
        private String message;

        /** 资产ID */
        private String assetId;

        /** 资产新状态 */
        private String newState;
    }
}