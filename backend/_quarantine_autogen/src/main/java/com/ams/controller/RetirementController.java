package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.RetirementApplicationDTO;
import com.ams.dto.RetirementApproveDTO;
import com.ams.dto.RetirementRejectDTO;
import com.ams.dto.RetirementRequestResponseDTO;
import com.ams.entity.LifecycleHistory;
import com.ams.entity.RetirementApplication;
import com.ams.service.ApprovalChainService;
import com.ams.service.LifecycleRecorder;
import com.ams.service.RetirementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 资产报废退役控制器
 * 
 * <p>负责处理资产报废/退役申请的全生命周期管理，包括：
 * <ul>
 *   <li>报废/退役申请提交与查询</li>
 *   <li>多级审批链执行</li>
 *   <li>资产状态锁定与解锁</li>
 *   <li>资产生命周期历史记录查询</li>
 * </ul>
 * 
 * <p>参考文档: SWARM-2026-Q2-002 Iteration 5
 * 
 * @see RetirementService
 * @see ApprovalChainService
 * @see LifecycleRecorder
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/retirement")
@RequiredArgsConstructor
@Tag(name = "资产报废退役", description = "资产报废退役申请与审批链管理")
public class RetirementController {

    private final RetirementService retirementService;
    private final ApprovalChainService approvalChainService;
    private final LifecycleRecorder lifecycleRecorder;

    /**
     * 提交资产报废/退役申请
     * 
     * <p>用户可对目标资产提交报废或退役申请，附必要说明与证据。
     * 申请提交后将锁定资产状态，禁止其他状态变更操作。
     * 
     * <p>业务规则：
     * <ul>
     *   <li>同一资产同一时间仅允许存在1条有效申请</li>
     *   <li>申请人必须是资产归属部门用户</li>
     *   <li>最多上传5个附件，单文件≤10MB</li>
     * </ul>
     * 
     * <p>验收测试: ATB-001 报废申请发起
     * 
     * @param requestDTO 报废申请信息，包含资产ID、申请类型、原因等
     * @return 申请详情，包含申请ID、状态、当前审批节点等
     * @see RetirementApplicationDTO
     */
    @PostMapping("/apply")
    @Operation(
        summary = "提交报废/退役申请",
        description = "用户发起资产报废/退役申请，锁定资产状态，生成首级审批任务"
    )
    public ResponseEntity<Result<RetirementApplication>> submitApplication(
            @RequestBody RetirementApplicationDTO requestDTO) {
        
        log.info("提交报废申请: assetId={}, type={}", 
                requestDTO.getAssetId(), requestDTO.getApplicationType());
        
        RetirementApplication application = retirementService.submitApplication(requestDTO);
        
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(Result.success(application, "申请提交成功"));
    }

    /**
     * 查询报废申请列表
     * 
     * <p>支持按状态、申请人、资产ID等条件筛选查询
     * 
     * @param status 申请状态筛选（可选）
     * @param assetId 资产ID筛选（可选）
     * @param applicant 申请人筛选（可选）
     * @return 符合条件的申请列表
     */
    @GetMapping("/applications")
    @Operation(summary = "查询报废申请列表", description = "支持多条件筛选查询")
    public ResponseEntity<Result<List<RetirementApplication>>> getApplications(
            @Parameter(description = "申请状态") 
            @RequestParam(required = false) String status,
            @Parameter(description = "资产ID") 
            @RequestParam(required = false) Long assetId,
            @Parameter(description = "申请人") 
            @RequestParam(required = false) String applicant) {
        
        List<RetirementApplication> applications = retirementService.queryApplications(
                status, assetId, applicant);
        
        return ResponseEntity.ok(Result.success(applications));
    }

    /**
     * 获取报废申请详情
     * 
     * @param applicationId 申请ID
     * @return 申请详情信息
     */
    @GetMapping("/applications/{applicationId}")
    @Operation(summary = "获取申请详情", description = "查询单个报废申请的详细信息")
    public ResponseEntity<Result<RetirementApplication>> getApplicationDetail(
            @PathVariable Long applicationId) {
        
        RetirementApplication application = retirementService.getApplicationById(applicationId);
        
        return ResponseEntity.ok(Result.success(application));
    }

    /**
     * 撤销报废申请
     * 
     * <p>申请人可在首级审批前撤销申请，审批中申请不可撤销。
     * 撤销后将解锁资产状态。
     * 
     * @param applicationId 申请ID
     * @return 撤销结果
     */
    @DeleteMapping("/applications/{applicationId}")
    @Operation(summary = "撤销申请", description = "申请人在首级审批前可撤销申请")
    public ResponseEntity<Result<Void>> withdrawApplication(
            @PathVariable Long applicationId) {
        
        log.info("撤销报废申请: applicationId={}", applicationId);
        
        retirementService.withdrawApplication(applicationId);
        
        return ResponseEntity.ok(Result.success(null, "申请已撤销"));
    }

    /**
     * 审批通过报废申请
     * 
     * <p>审批人通过当前审批任务，系统自动推进到下一级或完成审批链。
     * 全部审批通过后，资产状态将变为已报废/已退役。
     * 
     * <p>业务规则：
     * <ul>
     *   <li>仅当前审批节点处理人可审批</li>
     *   <li>使用乐观锁防止并发重复审批</li>
     * </ul>
     * 
     * <p>验收测试: ATB-003 多级审批链执行
     * 
     * @param applicationId 申请ID
     * @param approveDTO 审批意见与版本号
     * @return 审批结果，包含下一级任务信息
     */
    @PostMapping("/applications/{applicationId}/approve")
    @Operation(
        summary = "审批通过",
        description = "批准当前审批任务，触发下一级审批或完成流程"
    )
    public ResponseEntity<Result<RetirementRequestResponseDTO>> approveApplication(
            @PathVariable Long applicationId,
            @RequestBody RetirementApproveDTO approveDTO) {
        
        log.info("审批通过申请: applicationId={}, level={}", 
                applicationId, approveDTO.getLevel());
        
        RetirementRequestResponseDTO result = retirementService.approveApplication(
                applicationId, approveDTO);
        
        return ResponseEntity.ok(Result.success(result));
    }

    /**
     * 驳回报废申请
     * 
     * <p>审批人驳回当前审批任务，申请人可修改后重新提交。
     * 驳回必须填写审批意见（≥10字符）。
     * 
     * <p>验收测试: ATB-004 驳回与重提
     * 
     * @param applicationId 申请ID
     * @param rejectDTO 驳回原因
     * @return 驳回结果
     */
    @PostMapping("/applications/{applicationId}/reject")
    @Operation(
        summary = "驳回申请",
        description = "驳回当前审批任务，申请人可修改后重新提交"
    )
    public ResponseEntity<Result<Void>> rejectApplication(
            @PathVariable Long applicationId,
            @RequestBody RetirementRejectDTO rejectDTO) {
        
        log.info("驳回报废申请: applicationId={}, reason={}", 
                applicationId, rejectDTO.getReason());
        
        retirementService.rejectApplication(applicationId, rejectDTO);
        
        return ResponseEntity.ok(Result.success(null, "申请已驳回"));
    }

    /**
     * 查询资产生命周期历史
     * 
     * <p>获取指定资产从入库到当前的所有状态变更与审批历史记录，
     * 用于追溯资产生命周期完整轨迹。
     * 
     * <p>验收测试: ATB-005 生命周期完整性
     * 
     * @param assetId 资产ID
     * @return 生命周期事件列表，按时间正序排列
     */
    @GetMapping("/assets/{assetId}/lifecycle")
    @Operation(
        summary = "查询资产生命周期",
        description = "获取指定资产的全链路状态变更与审批历史"
    )
    public ResponseEntity<Result<List<LifecycleHistory>>> getAssetLifecycle(
            @PathVariable Long assetId) {
        
        log.debug("查询资产生命周期: assetId={}", assetId);
        
        List<LifecycleHistory> lifecycle = lifecycleRecorder.getAssetLifecycle(assetId);
        
        return ResponseEntity.ok(Result.success(lifecycle));
    }

    /**
     * 批量审批报废申请
     * 
     * <p>管理员可批量审批多个同级申请任务。
     * 仅限状态为同一审批节点的任务。
     * 
     * @param applicationIds 申请ID列表
     * @param approveDTO 审批意见与版本号
     * @return 批量审批结果
     */
    @PostMapping("/applications/batch-approve")
    @Operation(
        summary = "批量审批",
        description = "批量审批多个申请，仅限同级审批任务"
    )
    public ResponseEntity<Result<Integer>> batchApprove(
            @RequestBody List<Long> applicationIds,
            @RequestBody RetirementApproveDTO approveDTO) {
        
        log.info("批量审批报废申请: count={}", applicationIds.size());
        
        int successCount = retirementService.batchApprove(applicationIds, approveDTO);
        
        return ResponseEntity.ok(Result.success(successCount, 
                String.format("成功审批 %d 个申请", successCount)));
    }

    /**
     * 检查资产是否可发起报废申请
     * 
     * <p>用于前端表单校验，判断资产是否满足申请条件。
     * 
     * @param assetId 资产ID
     * @return 检查结果，包含不可申请原因
     */
    @GetMapping("/assets/{assetId}/check-eligibility")
    @Operation(
        summary = "检查申请资格",
        description = "判断资产是否可发起报废申请"
    )
    public ResponseEntity<Result<Boolean>> checkApplicationEligibility(
            @PathVariable Long assetId) {
        
        boolean eligible = retirementService.isEligibleForApplication(assetId);
        
        return ResponseEntity.ok(Result.success(eligible));
    }

    /**
     * 重新提交被驳回的申请
     * 
     * <p>申请人修改后重新提交被驳回的申请，系统将重新激活审批链。
     * 
     * @param applicationId 申请ID
     * @param requestDTO 更新后的申请信息
     * @return 重新提交的申请详情
     */
    @PutMapping("/applications/{applicationId}/resubmit")
    @Operation(
        summary = "重新提交",
        description = "修改后重新提交被驳回的申请"
    )
    public ResponseEntity<Result<RetirementApplication>> resubmitApplication(
            @PathVariable Long applicationId,
            @RequestBody RetirementApplicationDTO requestDTO) {
        
        log.info("重新提交报废申请: applicationId={}", applicationId);
        
        RetirementApplication application = retirementService.resubmitApplication(
                applicationId, requestDTO);
        
        return ResponseEntity.ok(Result.success(application, "申请已重新提交"));
    }

    /**
     * 获取待我审批的申请列表
     * 
     * <p>返回当前用户需要处理的报废申请审批任务。
     * 
     * @return 待审批申请列表
     */
    @GetMapping("/pending-approvals")
    @Operation(
        summary = "待我审批",
        description = "获取当前用户需要处理的审批任务"
    )
    public ResponseEntity<Result<List<RetirementApplication>>> getPendingApprovals() {
        
        List<RetirementApplication> pendingList = retirementService.getPendingApprovals();
        
        return ResponseEntity.ok(Result.success(pendingList));
    }
}