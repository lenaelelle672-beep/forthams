package com.ams.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class WorkflowAssigneePreviewRequest {

    @NotNull(message = "流程定义不能为空")
    private Map<String, Object> definition;

    /**
     * 可传 Map 或 JSON 字符串。预览接口只读解析，不持久化业务数据。
     */
    private Object businessData;
}
