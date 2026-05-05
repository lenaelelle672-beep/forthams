package com.assetmanage.exception;

/**
 * 资产批量导入导出异常。
 * <p>
 * 用于封装导入导出流程中的业务校验错误、文件格式错误、行数超限等异常场景，
 * 携带 HTTP 状态码与错误消息，由全局异常处理器统一捕获并返回标准错误响应。
 * </p>
 */
public class AssetImportExportException extends RuntimeException {

    /** HTTP 状态码 */
    private final int code;

    /**
     * 构造异常实例。
     *
     * @param code    HTTP 状态码（如 400、413）
     * @param message 错误描述信息
     */
    public AssetImportExportException(int code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * 构造异常实例（带原因异常）。
     *
     * @param code    HTTP 状态码
     * @param message 错误描述信息
     * @param cause   导致此异常的底层原因
     */
    public AssetImportExportException(int code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    /**
     * 获取 HTTP 状态码。
     *
     * @return 状态码
     */
    public int getCode() {
        return code;
    }
}