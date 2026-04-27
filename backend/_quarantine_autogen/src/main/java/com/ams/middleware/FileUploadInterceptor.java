package com.ams.middleware;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * 文件上传拦截器
 *
 * <p>用于验证资产批量导入导出功能中的文件上传请求。
 * 实现以下约束：
 * <ul>
 *   <li>仅允许上传 .xlsx 和 .csv 格式文件</li>
 *   <li>限制单次上传文件大小不超过 10MB</li>
 *   <li>单次导入行数不超过 5000 行</li>
 * </ul>
 *
 * <p>该拦截器会在文件上传Controller处理之前进行预处理，
 * 确保非法文件在进入业务逻辑前被拦截。
 *
 * <p>使用场景：
 * <ul>
 *   <li>资产批量导入：{@code POST /api/v1/assets/import}</li>
 *   <li>报废申请导入：{@code POST /api/v1/retirements/import}</li>
 * </ul>
 *
 * @author AMS Development Team
 * @version 1.0.0
 * @since Iteration 1
 * @see com.ams.controller.AssetController
 * @see com.ams.controller.RetirementController
 */
@Component
public class FileUploadInterceptor implements HandlerInterceptor {

    /**
     * 日志记录器
     */
    private static final Logger logger = LoggerFactory.getLogger(FileUploadInterceptor.class);

    /**
     * 允许的文件扩展名集合
     */
    private static final Set<String> ALLOWED_EXTENSIONS = new HashSet<>(
            Arrays.asList("xlsx", "csv")
    );

    /**
     * 文件大小限制：10MB
     */
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;

    /**
     * 单次导入行数限制
     */
    private static final int MAX_ROW_COUNT = 5000;

    /**
     * ObjectMapper 实例，用于JSON序列化
     */
    private final ObjectMapper objectMapper;

    /**
     * 构造函数
     *
     * <p>注入 ObjectMapper 用于构造错误响应JSON。
     *
     * @param objectMapper JSON序列化工具
     */
    public FileUploadInterceptor(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * 预处理拦截方法
     *
     * <p>在 Controller 处理请求之前验证上传文件。
     * 主要检查项：
     * <ul>
     *   <li>文件格式是否合法（.xlsx 或 .csv）</li>
     *   <li>文件大小是否超过 10MB 限制</li>
     *   <li>文件内容是否为空</li>
     * </ul>
     *
     * <p>验证失败时，直接向响应写入错误JSON并返回 false，
     * 阻止请求进入后续处理流程。
     *
     * @param request HTTP请求对象
     * @param response HTTP响应对象
     * @param handler 处理器
     * @return 验证通过返回 true，否则返回 false
     * @throws IOException 如果响应写入失败
     */
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {

        String contentType = request.getContentType();
        logger.debug("FileUploadInterceptor - ContentType: {}", contentType);

        // 检查是否为 multipart 请求（文件上传请求）
        if (contentType == null || !contentType.toLowerCase().contains("multipart/form-data")) {
            logger.debug("Not a multipart request, skipping file validation");
            return true;
        }

        // 获取上传的文件参数名
        String fileParamName = determineFileParameter(request);
        if (fileParamName == null) {
            logger.debug("No file parameter found in request");
            return true;
        }

        try {
            MultipartFile file = request.getFile(fileParamName) != null
                    ? request.getFile(fileParamName)
                    : extractMultipartFile(request, fileParamName);

            if (file == null || file.isEmpty()) {
                writeErrorResponse(response, HttpServletResponse.SC_BAD_REQUEST, "EMPTY_FILE",
                        "上传文件不能为空");
                return false;
            }

            // 验证文件扩展名
            String originalFilename = file.getOriginalFilename();
            if (!isValidFileExtension(originalFilename)) {
                writeErrorResponse(response, HttpServletResponse.SC_BAD_REQUEST, "UNSUPPORTED_FORMAT",
                        "不支持的文件格式，仅支持 .xlsx 和 .csv 格式");
                return false;
            }

            // 验证文件大小
            if (file.getSize() > MAX_FILE_SIZE) {
                writeErrorResponse(response, 413, "FILE_TOO_LARGE",
                        "文件超出限制，单次上传文件大小不能超过 10MB");
                return false;
            }

            logger.info("File validation passed: {}, size: {} bytes",
                    originalFilename, file.getSize());
            return true;

        } catch (Exception e) {
            logger.error("File validation error", e);
            writeErrorResponse(response, HttpServletResponse.SC_BAD_REQUEST, "FILE_PARSE_ERROR",
                    "文件解析失败，请确认文件格式正确");
            return false;
        }
    }

    /**
     * 确定文件参数名称
     *
     * <p>根据请求路径推断期望的文件参数名。
     * 不同业务模块可能使用不同的参数名。
     *
     * @param request HTTP请求对象
     * @return 文件参数名，如果无法确定则返回 null
     */
    private String determineFileParameter(HttpServletRequest request) {
        String uri = request.getRequestURI();

        if (uri.contains("/assets/import")) {
            return "file";
        } else if (uri.contains("/retirements/import")) {
            return "file";
        } else if (uri.contains("/template/download")) {
            return null; // 模板下载不需要文件参数
        }

        // 默认返回 file
        return "file";
    }

    /**
     * 提取 MultipartFile
     *
     * <p>兼容不同的请求方式，提取上传的文件对象。
     *
     * @param request HTTP请求对象
     * @param paramName 参数名
     * @return MultipartFile 对象
     */
    private MultipartFile extractMultipartFile(HttpServletRequest request, String paramName) {
        // Spring MVC 会自动将 multipart 参数绑定到方法参数
        // 此方法用于处理某些特殊场景
        return null;
    }

    /**
     * 验证文件扩展名是否合法
     *
     * <p>检查文件扩展名是否为允许的格式。
     * 扩展名比较不区分大小写。
     *
     * @param filename 原始文件名
     * @return 合法返回 true，否则返回 false
     */
    private boolean isValidFileExtension(String filename) {
        if (filename == null || filename.isEmpty()) {
            return false;
        }

        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex == -1 || dotIndex == filename.length() - 1) {
            return false;
        }

        String extension = filename.substring(dotIndex + 1).toLowerCase();
        return ALLOWED_EXTENSIONS.contains(extension);
    }

    /**
     * 写入错误响应
     *
     * <p>将错误信息序列化为JSON并写入HTTP响应。
     * 错误响应格式遵循系统统一的 Result 包装结构。
     *
     * @param response HTTP响应对象
     * @param status HTTP状态码
     * @param code 错误码
     * @param message 错误消息
     * @throws IOException 如果写入失败
     */
    private void writeErrorResponse(HttpServletResponse response, int status, String code, String message)
            throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");

        Result<Void> result = Result.error(code, message);
        response.getWriter().write(objectMapper.writeValueAsString(result));
        response.getWriter().flush();
    }

    /**
     * 获取支持的文件扩展名集合
     *
     * <p>供其他组件查询允许的文件格式。
     *
     * @return 允许的扩展名不可变集合
     */
    public static Set<String> getAllowedExtensions() {
        return java.util.Collections.unmodifiableSet(ALLOWED_EXTENSIONS);
    }

    /**
     * 获取文件大小限制
     *
     * @return 最大文件大小（字节）
     */
    public static long getMaxFileSize() {
        return MAX_FILE_SIZE;
    }

    /**
     * 获取单次导入行数限制
     *
     * @return 最大导入行数
     */
    public static int getMaxRowCount() {
        return MAX_ROW_COUNT;
    }

    /**
     * 验证导入行数是否超限
     *
     * <p>用于业务层在解析文件后再次校验行数限制。
     *
     * @param rowCount 实际行数
     * @throws BusinessException 如果行数超限
     */
    public static void validateRowCount(int rowCount) {
        if (rowCount > MAX_ROW_COUNT) {
            throw new BusinessException("ROW_LIMIT_EXCEEDED",
                    String.format("导入数据行数超出限制，最多支持 %d 行，请分段处理", MAX_ROW_COUNT));
        }
    }
}