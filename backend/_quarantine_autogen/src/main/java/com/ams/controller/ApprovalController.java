package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.ApprovalDecisionDTO;
import com.ams.service.ApprovalService;
import com.ams.service.RetirementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

/**
 * 审批流程控制器
 * 处理资产报废/退休相关的审批工作流
 */
@RestController
@RequestMapping("/api/approval")
public class ApprovalController {
    
    @Autowired
    private ApprovalService approvalService;
    
    @Autowired
    private RetirementService retireService;
    
    /**
     * 获取审批详情
     * @param retireId 退休申请ID
     * @return 审批决策信息
     */
    @GetMapping("/detail/{retireId}")
    public Result<ApprovalDecisionDTO> getApprovalDetail(@PathVariable Long retireId) {
        ApprovalDecisionDTO detail = approvalService.getApprovalDetail(retireId);
        return Result.success(detail);
    }
    
    /**
     * 提交审批决策
     * 支持批准/拒绝/待定等操作
     * @param decision 审批决策DTO
     * @return 操作结果
     */
    @PostMapping("/submit")
    public Result<String> submitDecision(@RequestBody ApprovalDecisionDTO decision) {
        Long retireId = decision.getRetireId();
        Long currentStepId = decision.getCurrentStepId();
        String status = decision.getStatus();
        
        switch (status) {
            case "APPROVED":
                retireService.approve(retireId, currentStepId);
                return Result.success("审批通过");
            case "REJECTED":
                retireService.reject(retireId, currentStepId);
                return Result.success("审批拒绝");
            case "PENDING":
                retireService.pending(retireId, currentStepId);
                return Result.success("待定处理");
            default:
                return Result.error("不支持的审批状态: " + status);
        }
    }
}