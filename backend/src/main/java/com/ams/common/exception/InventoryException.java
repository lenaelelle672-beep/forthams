package com.ams.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * 资产盘点业务异常类。
 * <p>
 * 用于封装盘点全生命周期中各环节的业务校验失败场景，包括但不限于：
 * <ul>
 *   <li>盘点任务/明细不存在</li>
 *   <li>非法状态流转（如跨越状态、逆向回退）</li>
 *   <li>并发范围冲突或资产锁定</li>
 *   <li>超出单次盘点资产数量上限</li>
 *   <li>比对核准前数据不完整</li>
 * </ul>
 * <p>
 * 该异常由 {@link com.ams.common.GlobalExceptionHandler} 统一拦截并转化为标准响应体。
 *
 * @see com.ams.service.InventoryService
 * @see com.ams.controller.InventoryController
 */
@Getter
public class InventoryException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** 业务级错误码，供前端/调用方程序化判断 */
    private final String errorCode;

    /** 对应的 HTTP 响应状态码 */
    private final HttpStatus httpStatus;

    /** 附加详情（如冲突资产列表、校验失败字段等），可为 null */
    private final Object details;

    /**
     * 盘点业务错误码枚举。
     * <p>
     * 每个 ErrorCode 绑定唯一的业务码、默认消息及 HTTP 状态，确保错误可精确溯源。
     */
    public enum ErrorCode {

        // -------- 404 Not Found --------
        TASK_NOT_FOUND("INVENTORY_TASK_NOT_FOUND", "未找到指定的盘点任务", HttpStatus.NOT_FOUND),
        DETAIL_NOT_FOUND("INVENTORY_DETAIL_NOT_FOUND", "未找到对应的盘点明细记录", HttpStatus.NOT_FOUND),
        ASSET_NOT_FOUND("INVENTORY_ASSET_NOT_FOUND", "资产不存在或已被删除", HttpStatus.NOT_FOUND),

        // -------- 400 Bad Request / 业务规则违反 --------
        INVALID_STATE_TRANSITION("INVENTORY_STATUS_CONFLICT", "非法的状态流转路径，盘点单状态必须按 DRAFT → IN_PROGRESS → COMPLETED → APPROVED 单向流转", HttpStatus.BAD_REQUEST),
        INVALID_TASK_STATUS("INVENTORY_TASK_STATUS_INVALID", "当前任务状态不支持该操作", HttpStatus.BAD_REQUEST),
        OVERLAPPING_SCOPE("INVENTORY_SCOPE_OVERLAP", "同一盘点范围内已存在进行中的盘点任务，禁止并发创建重叠范围的盘点", HttpStatus.BAD_REQUEST),
        EXCEED_MAX_ASSETS("INVENTORY_EXCEED_LIMIT", "单次盘点关联资产数量超过上限（10,000 条）", HttpStatus.BAD_REQUEST),
        INCOMPLETE_RECORDING("INVENTORY_INCOMPLETE", "存在未录入实盘数据的明细行，无法执行比对或完成操作", HttpStatus.BAD_REQUEST),

        // -------- 409 Conflict / 并发与锁定 --------
        ASSET_LOCKED("ASSET_LOCKED", "该资产已被其他进行中的盘点任务锁定，禁止执行报废、调拨等状态变更操作", HttpStatus.CONFLICT),
        CONCURRENT_MODIFICATION("INVENTORY_CONCURRENT_CONFLICT", "数据版本冲突，请刷新后重试", HttpStatus.CONFLICT),

        // -------- 422 Unprocessable Entity --------
        COMPARISON_FAILED("INVENTORY_COMPARISON_FAILED", "比对计算失败：盘盈/盘亏差异项未处理或数据不一致", HttpStatus.UNPROCESSABLE_ENTITY),
        APPROVAL_REJECTED("INVENTORY_APPROVAL_REJECTED", "核准操作被拒绝，请检查资产状态一致性", HttpStatus.UNPROCESSABLE_ENTITY),

        // -------- 500 Internal Server Error --------
        INTERNAL_ERROR("INVENTORY_INTERNAL_ERROR", "盘点系统内部处理异常", HttpStatus.INTERNAL_SERVER_ERROR);

        private final String code;
        private final String defaultMessage;
        private final HttpStatus httpStatus;

        ErrorCode(String code, String defaultMessage, HttpStatus httpStatus) {
            this.code = code;
            this.defaultMessage = defaultMessage;
            this.httpStatus = httpStatus;
        }

        public String getCode() {
            return code;
        }

        public String getDefaultMessage() {
            return defaultMessage;
        }

        public HttpStatus getHttpStatus() {
            return httpStatus;
        }
    }

    // ==================== 构造方法 ====================

    /**
     * 使用错误码构造异常（采用默认消息）。
     *
     * @param errorCode 盘点业务错误码
     */
    public InventoryException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.errorCode = errorCode.getCode();
        this.httpStatus = errorCode.getHttpStatus();
        this.details = null;
    }

    /**
     * 使用错误码和自定义消息构造异常。
     *
     * @param message   自定义错误描述
     * @param errorCode 盘点业务错误码
     */
    public InventoryException(String message, ErrorCode errorCode) {
        super(message);
        this.errorCode = errorCode.getCode();
        this.httpStatus = errorCode.getHttpStatus();
        this.details = null;
    }

    /**
     * 使用错误码、自定义消息和原因异常构造异常（异常链）。
     *
     * @param message   自定义错误描述
     * @param cause     底层异常
     * @param errorCode 盘点业务错误码
     */
    public InventoryException(String message, Throwable cause, ErrorCode errorCode) {
        super(message, cause);
        this.errorCode = errorCode.getCode();
        this.httpStatus = errorCode.getHttpStatus();
        this.details = null;
    }

    /**
     * 使用错误码和附加详情构造异常。
     *
     * @param errorCode 盘点业务错误码
     * @param details   附加详情对象（如失败资产 ID 列表）
     */
    public InventoryException(ErrorCode errorCode, Object details) {
        super(errorCode.getDefaultMessage());
        this.errorCode = errorCode.getCode();
        this.httpStatus = errorCode.getHttpStatus();
        this.details = details;
    }

    /**
     * 使用错误码、自定义消息和附加详情构造异常。
     *
     * @param message   自定义错误描述
     * @param errorCode 盘点业务错误码
     * @param details   附加详情对象
     */
    public InventoryException(String message, ErrorCode errorCode, Object details) {
        super(message);
        this.errorCode = errorCode.getCode();
        this.httpStatus = errorCode.getHttpStatus();
        this.details = details;
    }

    // ==================== 静态工厂方法（常见场景快捷构造） ====================

    /**
     * 构造"盘点任务不存在"异常。
     *
     * @param taskId 不存在的任务 ID
     * @return InventoryException 实例
     */
    public static InventoryException taskNotFound(Long taskId) {
        return new InventoryException(
                "找不到 ID 为 " + taskId + " 的盘点任务",
                ErrorCode.TASK_NOT_FOUND
        );
    }

    /**
     * 构造"盘点明细不存在"异常。
     *
     * @param detailId 不存在的明细 ID
     * @return InventoryException 实例
     */
    public static InventoryException detailNotFound(Long detailId) {
        return new InventoryException(
                "找不到 ID 为 " + detailId + " 的盘点明细记录",
                ErrorCode.DETAIL_NOT_FOUND
        );
    }

    /**
     * 构造"资产被锁定"异常。
     *
     * @param assetCode      被锁定的资产编号
     * @param lockingTaskId  正在锁定该资产的盘点任务 ID
     * @return InventoryException 实例
     */
    public static InventoryException assetLocked(String assetCode, Long lockingTaskId) {
        return new InventoryException(
                String.format("资产 [%s] 已被盘点任务 [%d] 锁定，禁止执行报废、调拨等状态变更操作", assetCode, lockingTaskId),
                ErrorCode.ASSET_LOCKED
        );
    }

    /**
     * 构造"非法状态流转"异常。
     *
     * @param taskId 盘点任务 ID
     * @param from   当前状态
     * @param to     目标状态
     * @return InventoryException 实例
     */
    public static InventoryException invalidStatusTransition(Object taskId, String from, String to) {
        return new InventoryException(
                String.format("盘点任务 [%s] 状态流转非法: %s -> %s（必须按 DRAFT → IN_PROGRESS → COMPLETED → APPROVED 单向流转）",
                        taskId, from, to),
                ErrorCode.INVALID_STATE_TRANSITION
        );
    }

    /**
     * 构造"超出资产数量上限"异常。
     *
     * @param count 实际关联资产数量
     * @return InventoryException 实例
     */
    public static InventoryException exceedMaxAssets(int count) {
        return new InventoryException(
                "盘点关联资产数量(" + count + ")超过单次上限 10,000 条",
                ErrorCode.EXCEED_MAX_ASSETS
        );
    }

    /**
     * 构造"盘点范围重叠"异常。
     *
     * @return InventoryException 实例
     */
    public static InventoryException overlappingScope() {
        return new InventoryException(ErrorCode.OVERLAPPING_SCOPE);
    }

    /**
     * 构造"实盘数据未完整录入"异常。
     *
     * @param uncountedDetailIds 未录入的明细 ID 列表
     * @return InventoryException 实例
     */
    public static InventoryException incompleteRecording(Object uncountedDetailIds) {
        return new InventoryException(
                "存在未录入实盘数据的明细行，无法执行比对或完成操作",
                ErrorCode.INCOMPLETE_RECORDING,
                uncountedDetailIds
        );
    }
}