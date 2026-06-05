package com.ams.common.exception;

import lombok.Getter;

/**
 * 通用业务异常。
 * <p>支持 errorCode 字符串枚举码和 cause 链保留，兼容旧版 Integer code 字段。</p>
 */
@Getter
public class BusinessException extends RuntimeException {

    /** 业务级错误码（字符串枚举，如 SYSTEM_ERROR / INVALID_PARAM） */
    private final String errorCode;

    /** 兼容旧版：HTTP 风格数字码（建议新代码使用 errorCode） */
    private final Integer code;

    // ==================== 构造方法（向后兼容） ====================

    /** 仅消息，默认 errorCode=SYSTEM_ERROR, code=500 */
    public BusinessException(String message) {
        super(message);
        this.errorCode = BizErrorCode.SYSTEM_ERROR.getCode();
        this.code = 500;
    }

    /** 消息 + cause，默认 errorCode=SYSTEM_ERROR, code=500 */
    public BusinessException(String message, Throwable cause) {
        super(message, cause);
        this.errorCode = BizErrorCode.SYSTEM_ERROR.getCode();
        this.code = 500;
    }

    /** 兼容旧版：数字 code + 消息，默认 errorCode=SYSTEM_ERROR */
    public BusinessException(Integer code, String message) {
        super(message);
        this.errorCode = BizErrorCode.SYSTEM_ERROR.getCode();
        this.code = code;
    }

    /** BizErrorCode 枚举 + 消息 */
    public BusinessException(BizErrorCode bizErrorCode, String message) {
        super(message);
        this.errorCode = bizErrorCode.getCode();
        this.code = 500;
    }

    /** BizErrorCode 枚举 + 消息 + cause */
    public BusinessException(BizErrorCode bizErrorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = bizErrorCode.getCode();
        this.code = 500;
    }

    /** 完整构造：数字 code + 字符串 errorCode + 消息 + cause */
    public BusinessException(Integer code, String errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
        this.code = code;
    }

}
