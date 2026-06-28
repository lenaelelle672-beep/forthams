package com.ams.dto;

import lombok.Data;

@Data
public class WorkflowRuntimeAssigneePreviewRequest {

    /**
     * 可传 Map 或 JSON 字符串。运行态接口只读解析，不要求前端传流程定义。
     */
    private Object businessData;

    /**
     * 当前流程步骤。当前版本仅透传接收，运行态预览仍返回全路径安全摘要。
     */
    private Integer currentStep;
}
