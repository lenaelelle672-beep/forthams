package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.WorkflowMailConfigDTO;
import com.ams.service.WorkflowMailConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 流程节点邮件配置只读 controller。全部只读。 */
@RestController
@RequestMapping("/system/workflow-mail")
@RequiredArgsConstructor
public class WorkflowMailConfigController {

    private final WorkflowMailConfigService workflowMailConfigService;

    @GetMapping
    public Result<WorkflowMailConfigDTO.PageResult> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String businessType,
            @RequestParam(required = false) Integer enabled) {
        return Result.success(workflowMailConfigService.list(businessType, enabled, page, pageSize));
    }

    @GetMapping("/{id}")
    public Result<WorkflowMailConfigDTO> detail(@PathVariable Long id) {
        return Result.success(workflowMailConfigService.detail(id));
    }

    @GetMapping("/meta")
    public Result<WorkflowMailConfigDTO.Meta> meta() {
        return Result.success(workflowMailConfigService.meta());
    }
}
