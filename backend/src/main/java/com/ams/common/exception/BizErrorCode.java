package com.ams.common.exception;

import lombok.Getter;

/**
 * 业务错误码枚举（字符串码）。
 * <p>与 {@link ErrorCode}（HTTP/业务数字码）不同，本枚举专用于 {@link BusinessException#errorCode}
 * 字段，提供更语义化的错误标识，适合跨服务传递和日志分类。</p>
 */
@Getter
public enum BizErrorCode {

    SYSTEM_ERROR("SYSTEM_ERROR", "系统内部错误"),
    INVALID_PARAM("INVALID_PARAM", "请求参数无效"),
    RESOURCE_NOT_FOUND("RESOURCE_NOT_FOUND", "请求的资源不存在"),
    OPERATION_FAILED("OPERATION_FAILED", "操作执行失败"),
    REPORT_GENERATION_FAILED("REPORT_GENERATION_FAILED", "报告生成失败"),
    INVALID_REPORT_CONFIG("INVALID_REPORT_CONFIG", "无效的报表配置"),
    EMAIL_SEND_FAILED("EMAIL_SEND_FAILED", "邮件发送失败");

    private final String code;
    private final String message;

    BizErrorCode(String code, String message) {
        this.code = code;
        this.message = message;
    }

}
