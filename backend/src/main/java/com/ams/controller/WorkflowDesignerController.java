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

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 废弃的工作流设计器控制器。
 * <p>此路径（/workflow-designer/*）操作 workflow_node/edge 独立表，但前端 WorkflowDesignerPage
 * 已改用 /workflows/* 主路径，节点/边存于 definitionJson 字段。双轨存储且节点类型大小写不一致
 *（此处 START/APPROVAL/END 大写，主路径小写 start/approval/end）。
 * <p>请使用 {@link WorkflowDefinitionController} 替代。
 * 计划在下一次大版本迭代中移除。
 *
 * @deprecated 双轨路径废弃，前端已统一使用 /workflows/* JSON 方案 — 将于下一大版本移除
 */
@Deprecated(forRemoval = true)
@SuppressWarnings({"deprecation", "removal"})
@RestController
@RequestMapping("/workflow-designer")
@RequiredArgsConstructor
public class WorkflowDesignerController {

    private static final Logger log = LoggerFactory.getLogger(WorkflowDesignerController.class);
    private final WorkflowDesignerService workflowDesignerService;

    /**
     * 获取流程设计（节点和连线）
     */
    @PreAuthorize("@ss.hasPermi('workflow:definition:query')")
    @GetMapping("/{definitionId}")
    public Result<Map<String, Object>> getDesign(@PathVariable Long definitionId) {
        log.warn("废弃路径被调用: /workflow-designer/{}/getDesign — 请迁移至 /workflows/*", definitionId);
        return Result.success(workflowDesignerService.getDesign(definitionId));
    }

    /**
     * 保存流程设计
     */
    @PreAuthorize("@ss.hasPermi('workflow:definition:edit')")
    @PostMapping("/{definitionId}/save")
    public Result<Void> saveDesign(@PathVariable Long definitionId,
                                   @RequestBody WorkflowDesignerSaveDTO dto) {
        log.warn("废弃路径被调用: /workflow-designer/{}/save — 请迁移至 /workflows/*", definitionId);
        workflowDesignerService.saveDesign(definitionId, dto.getNodes(), dto.getEdges());
        return Result.success(null);
    }

    /**
     * 发布流程设计
     */
    @PreAuthorize("@ss.hasPermi('workflow:definition:edit')")
    @PostMapping("/{definitionId}/publish")
    public Result<WorkflowDefinition> publishDesign(@PathVariable Long definitionId) {
        log.warn("废弃路径被调用: /workflow-designer/{}/publish — 请迁移至 /workflows/*", definitionId);
        return Result.success(workflowDesignerService.publishDesign(definitionId));
    }

    /**
     * 获取版本历史
     */
    @PreAuthorize("@ss.hasPermi('workflow:definition:query')")
    @GetMapping("/{definitionId}/versions")
    public Result<List<WorkflowDefinition>> getVersionHistory(@PathVariable Long definitionId) {
        log.warn("废弃路径被调用: /workflow-designer/{}/versions — 请迁移至 /workflows/*", definitionId);
        return Result.success(workflowDesignerService.getVersionHistory(definitionId));
    }
}
