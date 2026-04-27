package com.ams.exception;

/**
 * 当操作趋势统计接口接收到不支持的 granularity 值时抛出此异常。
 *
 * <p>支持的 granularity 值为：daily、weekly、monthly。</p>
 *
 * <p>对应 ATB-004 中的参数校验场景：
 * 当 granularity 不在允许范围内时，全局异常处理器将返回
 * HTTP 400 和错误码 INVALID_GRANULARITY。</p>
 */
public class InvalidGranularityException extends RuntimeException {

    private static final String DEFAULT_MESSAGE = "granularity must be one of: daily, weekly, monthly";

    private final String invalidValue;

    /**
     * 使用默认错误消息构造异常。
     */
    public InvalidGranularityException() {
        super(DEFAULT_MESSAGE);
        this.invalidValue = null;
    }

    /**
     * 指定无效的 granularity 值构造异常。
     *
     * @param invalidValue 用户传入的无效粒度值
     */
    public InvalidGranularityException(String invalidValue) {
        super("Invalid granularity: '" + invalidValue + "'. " + DEFAULT_MESSAGE);
        this.invalidValue = invalidValue;
    }

    /**
     * 获取用户传入的无效粒度值，可能为 null。
     *
     * @return 无效的 granularity 值
     */
    public String getInvalidValue() {
        return invalidValue;
    }
}