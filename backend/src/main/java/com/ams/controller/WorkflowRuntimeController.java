package com.ams.controller;

import com.ams.annotation.OperBusinessType;
import com.ams.annotation.OperLog;
import com.ams.common.Result;
import com.ams.dto.WorkflowAssigneePreviewResponse;
import com.ams.dto.WorkflowRuntimeAssigneePreviewRequest;
import com.ams.dto.WorkflowStartAvailabilityDTO;
import com.ams.service.WorkflowDefinitionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/workflow-runtime")
@RequiredArgsConstructor
public class WorkflowRuntimeController {

    private final WorkflowDefinitionService workflowDefinitionService;

    @GetMapping("/{businessType}/start-availability")
    @PreAuthorize("@ss.hasPermi('approval:process:create')")
    @OperLog(title = "审批发起可用性检查", businessType = OperBusinessType.OTHER, saveRequestData = false)
    public Result<WorkflowStartAvailabilityDTO> startAvailability(@PathVariable String businessType) {
        return Result.success(workflowDefinitionService.getStartAvailability(businessType));
    }

    @PostMapping("/{businessType}/assignees/preview")
    @PreAuthorize("@ss.hasPermi('approval:process:create')")
    @OperLog(title = "处理人预览", businessType = OperBusinessType.OTHER, saveRequestData = false)
    public Result<WorkflowAssigneePreviewResponse> previewAssignees(
            @PathVariable String businessType,
            @RequestBody(required = false) WorkflowRuntimeAssigneePreviewRequest request) {
        return Result.success(workflowDefinitionService.previewPublishedAssignees(businessType, request));
    }
}
