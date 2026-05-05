package com.ams.common.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * 异常：请求的时间范围无效。
 * 当开始日期晚于结束日期，或查询跨度超过允许的最大限制（365天）时抛出此异常。
 *
 * <p>对应 SPEC ATB-004 中定义的两种校验失败场景：
 * <ul>
 *   <li>INVALID_DATE_RANGE — startDate 必须早于 endDate</li>
 *   <li>DATE_RANGE_TOO_LARGE — 日期跨度不得超过 365 天</li>
 * </ul>
 */
@ResponseStatus(HttpStatus.BAD_REQUEST)
public class InvalidTimeRangeException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final String errorCode;
    private final String startDate;
    private final String endDate;

    /**
     * 构造函数：包含错误码和日期详情，供异常处理器映射到 {@code DashboardError}。
     *
     * @param errorCode SPEC 定义的错误码，如 "INVALID_DATE_RANGE" 或 "DATE_RANGE_TOO_LARGE"
     * @param message   异常描述信息
     * @param startDate 请求的开始日期字符串
     * @param endDate   请求的结束日期字符串
     */
    public InvalidTimeRangeException(String errorCode, String message, String startDate, String endDate) {
        super(message);
        this.errorCode = errorCode;
        this.startDate = startDate;
        this.endDate = endDate;
    }

    /**
     * 简化构造函数：仅需错误码和消息，日期详情置空。
     *
     * @param errorCode SPEC 定义的错误码
     * @param message   错误消息
     */
    public InvalidTimeRangeException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
        this.startDate = null;
        this.endDate = null;
    }

    /**
     * 获取 SPEC 定义的错误码。
     *
     * @return 错误码字符串
     */
    public String getErrorCode() {
        return errorCode;
    }

    /**
     * 获取请求的开始日期（原始字符串）。
     *
     * @return 开始日期，可能为 {@code null}
     */
    public String getStartDate() {
        return startDate;
    }

    /**
     * 获取请求的结束日期（原始字符串）。
     *
     * @return 结束日期，可能为 {@code null}
     */
    public String getEndDate() {
        return endDate;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder("InvalidTimeRangeException{");
        sb.append("errorCode='").append(errorCode).append('\'');
        sb.append(", message='").append(getMessage()).append('\'');
        if (startDate != null) {
            sb.append(", startDate='").append(startDate).append('\'');
        }
        if (endDate != null) {
            sb.append(", endDate='").append(endDate).append('\'');
        }
        sb.append('}');
        return sb.toString();
    }
}