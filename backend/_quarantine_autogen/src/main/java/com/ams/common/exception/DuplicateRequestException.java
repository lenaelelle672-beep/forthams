package com.ams.common.exception;

import com.ams.common.Result;
import org.springframework.http.HttpStatus;

/**
 * 重复申请异常
 * 
 * <p>当资产存在待审批的退役申请时，再次提交申请将抛出此异常。</p>
 * 
 * <p>错误码: DUPLICATE_PENDING_REQUEST (409)</p>
 * 
 * @since SWARM-223
 */
public class DuplicateRequestException extends BusinessException {

    private static final String ERROR_CODE = "DUPLICATE_PENDING_REQUEST";

    private static final String DEFAULT_MESSAGE = "该资产已存在待审批的退役申请，请勿重复提交";

    /**
     * 构造函数 - 使用默认错误消息
     */
    public DuplicateRequestException() {
        super(ERROR_CODE, DEFAULT_MESSAGE, HttpStatus.CONFLICT);
    }

    /**
     * 构造函数 - 使用自定义错误消息
     *
     * @param message 自定义错误消息
     */
    public DuplicateRequestException(String message) {
        super(ERROR_CODE, message, HttpStatus.CONFLICT);
    }

    /**
     * 构造函数 - 使用资产ID
     *
     * @param assetId 资产ID
     */
    public DuplicateRequestException(Long assetId) {
        super(ERROR_CODE, 
              String.format("资产[%d]已存在待审批的退役申请，请勿重复提交", assetId), 
              HttpStatus.CONFLICT);
    }

    /**
     * 构造函数 - 使用资产ID和请求ID
     *
     * @param assetId   资产ID
     * @param requestId 现有申请ID
     */
    public DuplicateRequestException(Long assetId, Long requestId) {
        super(ERROR_CODE,
              String.format("资产[%d]已存在待审批的退役申请(ID: %d)，请等待当前申请审批完成", assetId, requestId),
              HttpStatus.CONFLICT);
    }

    /**
     * 构造函数 - 使用完整错误消息和原因
     *
     * @param message 自定义错误消息
     * @param cause   异常原因
     */
    public DuplicateRequestException(String message, Throwable cause) {
        super(ERROR_CODE, message, HttpStatus.CONFLICT, cause);
    }

    @Override
    public Result<Void> toResult() {
        return Result.error(getCode(), getMessage());
    }
}