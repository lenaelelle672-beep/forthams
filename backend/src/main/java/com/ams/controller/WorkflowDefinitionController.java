package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.service.WorkflowDefinitionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/workflows")
@RequiredArgsConstructor
public class WorkflowDefinitionController {

    private final WorkflowDefinitionService workflowDefinitionService;

    @GetMapping
    public Result<List<WorkflowDefinitionDTO>> list() {
        return Result.success(workflowDefinitionService.listDefinitions());
    }

    @GetMapping("/{businessType}")
    public Result<WorkflowDefinitionDTO> get(@PathVariable String businessType) {
        return Result.success(workflowDefinitionService.getDefinition(businessType));
    }

    @PutMapping("/{businessType}/draft")
    public Result<WorkflowDefinitionDTO> saveDraft(
            @PathVariable String businessType,
            @Valid @RequestBody WorkflowDefinitionSaveDTO dto) {
        return Result.success(workflowDefinitionService.saveDraft(businessType, dto));
    }

    @PostMapping("/{businessType}/publish")
    public Result<WorkflowDefinitionDTO> publish(
            @PathVariable String businessType,
            @RequestBody(required = false) WorkflowStatusUpdateDTO dto) {
        Long operatorId = dto == null ? null : dto.getOperatorId();
        return Result.success(workflowDefinitionService.publish(businessType, operatorId));
    }

    @PostMapping("/{businessType}/status")
    public Result<WorkflowDefinitionDTO> updateStatus(
            @PathVariable String businessType,
            @Valid @RequestBody WorkflowStatusUpdateDTO dto) {
        return Result.success(workflowDefinitionService.updateStatus(businessType, dto));
    }
}
