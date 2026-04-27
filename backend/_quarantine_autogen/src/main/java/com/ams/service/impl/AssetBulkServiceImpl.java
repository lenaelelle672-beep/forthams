package com.ams.service.impl;

import com.ams.service.AssetBulkService;
import com.ams.service.AssetService;
import com.ams.service.dto.AssetCreateDTO;
import com.ams.service.dto.AssetUpdateDTO;
import com.ams.service.mapper.AssetMapper;
import com.ams.service.validators.AssetValidator;
import com.ams.service.parsers.ExcelParser;
import com.ams.service.parsers.CsvParser;
import com.ams.service.infra.FileStorageService;
import com.ams.common.exception.BusinessException;
import com.ams.common.result.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 资产批量导入/导出服务实现
 * 对应 SWARM-502：资产批量导入/导出
 */
@Service
public class AssetBulkServiceImpl implements AssetBulkService {

    private final AssetValidator assetValidator;
    private final ExcelParser excelParser;
    private final CsvParser csvParser;
    private final AssetMapper assetMapper;
    private final AssetService assetService;
    private final FileStorageService fileStorageService;

    @Autowired
    public AssetBulkServiceImpl(
            AssetValidator assetValidator,
            ExcelParser excelParser,
            CsvParser csvParser,
            AssetMapper assetMapper,
            AssetService assetService,
            FileStorageService fileStorageService) {
        this.assetValidator = assetValidator;
        this.excelParser = excelParser;
        this.csvParser = csvParser;
        this.assetMapper = assetMapper;
        this.assetService = assetService;
        this.fileStorageService = fileStorageService;
    }

    /**
     * 下载资产导入模板
     *
     * @return 模板文件的字节数组
     * @throws IOException 如果生成模板失败
     */
    @Override
    public byte[] downloadImportTemplate() throws IOException {
        // 模板列定义：id, name, category, value, purchaseDate, status, location, vendor, description
        return excelParser.generateTemplate("asset_import_template", List.of(
                "id", "name", "category", "value", "purchaseDate", "status", "location", "vendor", "description"
        ));
    }

    /**
     * 上传并批量创建资产（Excel .xlsx，≤10MB，≤5000行）
     *
     * @param file 上传的 Excel 文件
     * @return 导入结果，包含成功/失败明细
     * @throws IOException            如果文件读取失败
     * @throws BusinessException      如果校验或大小/行数超限
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public Result<Integer> importAssets(MultipartFile file) throws IOException {
        // 文件类型与大小校验
        if (file.isEmpty()) {
            throw new BusinessException("文件不能为空");
        }
        if (!file.getOriginalFilename().toLowerCase().endsWith(".xlsx")) {
            throw new BusinessException("仅接受 .xlsx 格式文件");
        }
        if (file.getSize() > 10 * 1024 * 1024) { // 10 MB
            throw new BusinessException("文件大小不能超过 10 MB");
        }

        // 解析 Excel
        List<List<String>> rows = excelParser.parse(file.getBytes());
        if (rows.size() > 5000) {
            throw new BusinessException("导入行数不能超过 5000");
        }

        // 转换为 DTO 并校验（含行号定位）
        List<AssetCreateDTO> dtos = assetValidator.validateAndMap(rows);

        // 批量创建（服务层处理去重/事务）
        int created = assetService.batchCreate(dtos);
        return Result.success(created);
    }

    /**
     * 导出资产列表为 CSV（UTF-8，≤10k 行，响应≤5秒）
     *
     * @return CSV 字节数组
     * @throws IOException 如果导出失败
     */
    @Override
    public byte[] exportAssetsToCsv() throws IOException {
        List<AssetUpdateDTO> assets = assetService.listAll();
        if (assets.size() > 10000) {
            // 超过 10k 应由调用方做分页；此处按规范返回空或截断（按业务约定）
            assets = assets.subList(0, 10000);
        }
        // CSV 列与数据库一致；UTF-8 编码
        return csvParser.generateCsv(
                assets.stream().map(assetMapper::toDto).collect(Collectors.toList()),
                StandardCharsets.UTF_8
        );
    }
}