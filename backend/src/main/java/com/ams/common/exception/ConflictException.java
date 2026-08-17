package com.ams.common.exception;

/** 用于要求客户端刷新受并发保护资源的可操作冲突。 */
public class ConflictException extends BusinessException {

    public ConflictException(String message) {
        super(409, message);
    }
}
