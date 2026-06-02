package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.WorkflowDesignerSaveDTO;
import com.ams.entity.WorkflowDefinition;
import com.ams.service.WorkflowDesignerService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/workflow-designer")
@RequiredArgsConstructor
public class WorkflowDesignerController {

    private final WorkflowDesignerService workflowDesignerService;

    /**
     * 获取流程设计（节点和连线）
     */
    @PreAuthorize("@ss.hasPermi('workflow:definition:query')")
    @GetMapping("/{definitionId}")
    public Result<Map<String, Object>> getDesign(@PathVariable Long definitionId) {
        return Result.success(workflowDesignerService.getDesign(definitionId));
    }

    /**
     * 保存流程设计
     */
    @PreAuthorize("@ss.hasPermi('workflow:definition:edit')")
    @PostMapping("/{definitionId}/save")
    public Result<Void> saveDesign(@PathVariable Long definitionId,
                                   @RequestBody WorkflowDesignerSaveDTO dto) {
        workflowDesignerService.saveDesign(definitionId, dto.getNodes(), dto.getEdges());
        return Result.success(null);
    }

    /**
     * 发布流程设计
     */
    @PreAuthorize("@ss.hasPermi('workflow:definition:edit')")
    @PostMapping("/{definitionId}/publish")
    public Result<WorkflowDefinition> publishDesign(@PathVariable Long definitionId) {
        return Result.success(workflowDesignerService.publishDesign(definitionId));
    }

    /**
     * 获取版本历史
     */
    @PreAuthorize("@ss.hasPermi('workflow:definition:query')")
    @GetMapping("/{definitionId}/versions")
    public Result<List<WorkflowDefinition>> getVersionHistory(@PathVariable Long definitionId) {
        return Result.success(workflowDesignerService.getVersionHistory(definitionId));
    }
}
