package com.ams.common.exception;

import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * EnterpriseException - 企业自定义业务异常
 * 
 * <p>用于封装企业级特定业务场景的错误，包含自定义错误码和错误信息。
 * 此类异常由 GlobalExceptionHandler 统一拦截并转换为标准响应格式。</p>
 * 
 * <p>错误码规范：</p>
 * <ul>
 *   <li>1xxx - 系统级错误</li>
 *   <li>2xxx - 参数校验错误</li>
 *   <li>3xxx - 权限认证错误</li>
 *   <li>4xxx - 企业业务错误</li>
 *   <li>5xxx - 第三方服务错误</li>
 * </ul>
 * 
 * <p>使用示例：</p>
 * <pre>{@code
 * // 带错误码的异常
 * throw new EnterpriseException("E001", "企业额度超限");
 * 
 * // 仅带消息的异常（使用默认错误码）
 * throw new EnterpriseException("企业配置缺失");
 * }</pre>
 * 
 * @author AMS Development Team
 * @version 1.0.0
 * @since 2024-01-01
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class EnterpriseException extends RuntimeException {
    
    /** 错误码 */
    private String code;
    
    /** 错误信息 */
    private String message;
    
    /**
     * 默认构造函数
     * 使用默认错误码 "ENTERPRISE_ERROR"
     */
    public EnterpriseException() {
        super();
        this.code = "ENTERPRISE_ERROR";
        this.message = "企业业务处理异常";
    }
    
    /**
     * 带错误码和错误信息的构造函数
     * 
     * @param code    错误码，用于前端区分错误类型
     * @param message 错误信息，描述具体错误内容
     */
    public EnterpriseException(String code, String message) {
        super(message);
        this.code = code;
        this.message = message;
    }
    
    /**
     * 仅带错误信息的构造函数
     * 错误码使用默认值 "ENTERPRISE_ERROR"
     * 
     * @param message 错误信息，描述具体错误内容
     */
    public EnterpriseException(String message) {
        super(message);
        this.code = "ENTERPRISE_ERROR";
        this.message = message;
    }
    
    /**
     * 带错误码、错误信息和原始异常的构造函数
     * 
     * @param code        错误码
     * @param message     错误信息
     * @param cause       原始异常
     */
    public EnterpriseException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.message = message;
    }
    
    /**
     * 带错误信息和原始异常的构造函数
     * 
     * @param message 错误信息
     * @param cause   原始异常
     */
    public EnterpriseException(String message, Throwable cause) {
        super(message, cause);
        this.code = "ENTERPRISE_ERROR";
        this.message = message;
    }
    
    /**
     * 获取带错误码前缀的完整错误描述
     * 
     * @return 格式如 "[E001] 企业额度超限" 的错误描述
     */
    public String getFullMessage() {
        return String.format("[%s] %s", this.code, this.message);
    }
    
    /**
     * 判断是否为关键业务错误
     * 关键业务错误码通常以 "E" 开头
     * 
     * @return 是否为关键错误
     */
    public boolean isCritical() {
        return this.code != null && this.code.startsWith("E");
    }
    
    /**
     * 判断是否需要人工介入处理
     * 通常 4xxx 错误码表示需要人工处理
     * 
     * @return 是否需要人工介入
     */
    public boolean requiresManualIntervention() {
        return this.code != null && this.code.startsWith("4");
    }
}