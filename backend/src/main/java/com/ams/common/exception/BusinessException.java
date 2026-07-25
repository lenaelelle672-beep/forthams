package com.ams.common.exception;

import lombok.Getter;

@Getter
public class BusinessException extends RuntimeException {

    private final Integer code;

    /**
     * 业务异常（客户端错误）。
     * 默认 code=400，与 GlobalExceptionHandler 的 @ResponseStatus(BAD_REQUEST) 一致。
     * 此前默认 500 导致同一个响应 HTTP 400 但 envelope code 500 的矛盾。
     * 真正的服务器内部错误应走 GlobalExceptionHandler 的 catch-all（HTTP 500）。
     */
    public BusinessException(String message) {
        super(message);
        this.code = 400;
    }

    public BusinessException(Integer code, String message) {
        super(message);
        this.code = code;
    }

}
