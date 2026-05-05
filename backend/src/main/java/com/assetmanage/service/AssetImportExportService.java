package com.assetmanage.service;

import com.assetmanage.dto.ExportQueryDTO;
import com.assetmanage.dto.ImportResultDTO;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.multipart.MultipartFile;

/**
 * 资产批量导入导出服务接口。
 *
 * <p>提供资产数据的批量导入（Excel/CSV 文件解析、校验、入库）
 * 以及按筛选条件批量导出为 Excel/CSV 文件的能力。</p>
 *
 * <ul>
 *   <li>支持 .xlsx（Excel 2007+）和 .csv 格式</li>
 *   <li>单次导入行数上限 5000 行（不含表头）</li>
 *   <li>单次导出行数上限 50000 行</li>
 *   <li>必填字段：name、category_id、status</li>
 * </ul>
 *
 * @see ImportResultDTO
 * @see ExportQueryDTO
 */
public interface AssetImportExportService {

    /**
     * 批量导入资产数据。
     *
     * <p>接收上传的 Excel（.xlsx）或 CSV（.csv）文件，执行以下流程：</p>
     * <ol>
     *   <li>校验文件大小（≤ 10 MB）与格式</li>
     *   <li>使用对应解析器解析文件内容为行数据列表</li>
     *   <li>校验行数不超过 {@link com.assetmanage.constant.AssetImportConstants#MAX_IMPORT_ROWS}</li>
     *   <li>逐行校验必填字段和业务规则（如分类是否存在）</li>
     *   <li>若存在校验错误，整体回滚并返回包含错误明细的结果</li>
     *   <li>全部通过后批量保存至数据库</li>
     * </ol>
     *
     * <p>导入操作使用单事务（{@code @Transactional}），任一行校验失败则整体回滚。</p>
     *
     * @param file     上传的文件，不能为 {@code null}
     * @param fileType 文件类型标识（"xlsx" 或 "csv"），若为 {@code null} 则从文件扩展名自动推断
     * @return 导入结果报告，包含成功/失败/跳过行数及错误明细
     * @throws com.assetmanage.exception.AssetImportExportException 文件格式不支持、文件过大、行数超限等异常
     */
    ImportResultDTO importAssets(MultipartFile file, String fileType);

    /**
     * 批量导出资产数据。
     *
     * <p>根据查询参数筛选资产数据，导出为指定格式（Excel 或 CSV）并直接写入 HTTP 响应流。</p>
     * <ol>
     *   <li>根据 {@link ExportQueryDTO} 构建查询条件</li>
     *   <li>统计匹配记录数，校验不超过 {@link com.assetmanage.constant.AssetImportConstants#MAX_EXPORT_ROWS}</li>
     *   <li>查询结果列表并根据 format 写入 SXSSFWorkbook（xlsx）或 CSV Writer（csv）</li>
     *   <li>设置响应头（Content-Type、Content-Disposition）并刷新到 {@code response.getOutputStream()}</li>
     * </ol>
     *
     * @param query    导出查询参数，包含格式、筛选条件等
     * @param response HTTP 响应对象，用于写入导出文件流
     * @throws com.assetmanage.exception.AssetImportExportException 导出行数超限等异常
     */
    void exportAssets(ExportQueryDTO query, HttpServletResponse response);
}