package com.ams.common.exception;

import lombok.Getter;

@Getter
public enum ErrorCode {
    // ===== 通用 (7) =====
    SUCCESS(200, "成功"),
    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未授权"),
    FORBIDDEN(403, "无权限"),
    NOT_FOUND(404, "资源不存在"),
    CONFLICT(409, "资源冲突"),
    INTERNAL_ERROR(500, "系统内部错误"),

    // ===== 业务域：盘点 (3) =====
    STOCKTAKING_CYCLE_NOT_FOUND(4001, "盘点周期不存在"),
    STOCKTAKING_CYCLE_INVALID_STATUS(4002, "盘点周期状态不允许此操作"),
    STOCKTAKING_TASK_ALREADY_ASSIGNED(4003, "任务已分配"),

    // ===== 业务域：检验 (2) =====
    INSPECTION_NOT_FOUND(4101, "检验记录不存在"),
    INSPECTION_REPORT_FAILED(4102, "生成检验报告失败"),

    // ===== 业务域：Email (2) =====
    EMAIL_SEND_FAILED(4201, "邮件发送失败"),
    EMAIL_TEMPLATE_NOT_FOUND(4202, "邮件模板不存在"),

    // ===== 数据 (3) =====
    DATA_ACCESS_ERROR(5001, "数据库操作异常"),
    DATA_DUPLICATE(5002, "数据重复"),
    OPERATION_FAILED(5003, "操作执行失败");

    private final int code;
    private final String defaultMessage;

    ErrorCode(int code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }
}
