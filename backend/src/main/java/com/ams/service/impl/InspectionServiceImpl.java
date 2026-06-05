package com.ams.service.impl;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.WorkOrderDTO;
import com.ams.entity.Asset;
import com.ams.entity.Inspection;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.InspectionMapper;
import com.ams.service.AssetService;
import com.ams.service.InspectionService;
import com.ams.service.NotificationService;
import com.ams.service.WorkOrderService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class InspectionServiceImpl implements InspectionService {
    private final InspectionMapper inspectionMapper;
    private final AssetService assetService;
    private final AssetMapper assetMapper;
    private final NotificationService notificationService;
    private final WorkOrderService workOrderService;

    @Override
    public Page<Inspection> listInspection(String keyword, String inspectionType, String result,
                                            LocalDate startDate, LocalDate endDate,
                                            Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<Inspection> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Inspection> wrapper = new LambdaQueryWrapper<Inspection>()
                .eq(Inspection::getTenantId, tenantId);
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(Inspection::getInspectionNo, keyword)
                    .or().like(Inspection::getInspectorName, keyword)
                    .or().like(Inspection::getInspectionAgency, keyword));
        }
        if (inspectionType != null && !inspectionType.isEmpty()) {
            wrapper.eq(Inspection::getInspectionType, inspectionType);
        }
        if (result != null && !result.isEmpty()) {
            wrapper.eq(Inspection::getResult, result);
        }
        if (startDate != null) {
            wrapper.ge(Inspection::getInspectionDate, startDate);
        }
        if (endDate != null) {
            wrapper.le(Inspection::getInspectionDate, endDate);
        }
        wrapper.orderByDesc(Inspection::getCreateTime);
        return inspectionMapper.selectPage(page, wrapper);
    }

    @Override
    public Inspection getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return inspectionMapper.selectOne(new LambdaQueryWrapper<Inspection>()
                .eq(Inspection::getId, id)
                .eq(Inspection::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Inspection create(Inspection inspection) {
        String tenantId = TenantContext.requireTenantId();
        inspection.setTenantId(tenantId);

        // 校验资产存在性
        if (inspection.getAssetId() != null) {
            Asset asset = assetService.getAssetById(inspection.getAssetId());
            if (asset == null) {
                throw new BusinessException("资产不存在: assetId=" + inspection.getAssetId());
            }
        }

        inspectionMapper.insert(inspection);
        return inspection;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Inspection update(Long id, Inspection inspection) {
        String tenantId = TenantContext.requireTenantId();
        Inspection existing = getById(id);
        if (existing == null) {
            throw new IllegalArgumentException("Inspection not found");
        }

        // 校验资产存在性
        if (inspection.getAssetId() != null && !inspection.getAssetId().equals(existing.getAssetId())) {
            Asset asset = assetService.getAssetById(inspection.getAssetId());
            if (asset == null) {
                throw new BusinessException("资产不存在: assetId=" + inspection.getAssetId());
            }
        }

        inspection.setId(id);
        inspection.setTenantId(tenantId);
        inspectionMapper.updateById(inspection);
        return getById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        String tenantId = TenantContext.requireTenantId();
        Inspection existing = getById(id);
        if (existing == null) {
            throw new IllegalArgumentException("Inspection not found");
        }
        inspectionMapper.deleteById(id);
    }

    @Override
    public List<Inspection> getExpiringInspections(int days) {
        String tenantId = TenantContext.requireTenantId();
        LocalDate warningDate = LocalDate.now().plusDays(days);
        return inspectionMapper.findExpiringSoon(tenantId, warningDate);
    }

    @Override
    public Page<Inspection> getHistoryByAssetId(Long assetId, Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<Inspection> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Inspection> wrapper = new LambdaQueryWrapper<Inspection>()
                .eq(Inspection::getAssetId, assetId)
                .eq(Inspection::getTenantId, tenantId);
        wrapper.orderByDesc(Inspection::getInspectionDate);
        return inspectionMapper.selectPage(page, wrapper);
    }

    /**
     * 自动生成检验任务（按资产ID列表或资产类别ID）
     * 使用分批次处理避免单次事务过大
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<Inspection> autoGenerateInspections(List<Long> assetIds, Long assetCategoryId) {
        String tenantId = TenantContext.requireTenantId();
        List<Inspection> generatedInspections = new java.util.ArrayList<>();

        if (assetIds == null || assetIds.isEmpty()) {
            // 按资产类别生成
            if (assetCategoryId != null) {
                log.warn("按资产类别生成检验任务功能待实现: categoryId={}", assetCategoryId);
            }
            return generatedInspections;
        }

        // 按资产ID列表生成，使用分批次处理（每批次100条）
        int batchSize = 100;
        for (int i = 0; i < assetIds.size(); i += batchSize) {
            int end = Math.min(i + batchSize, assetIds.size());
            List<Long> batchAssetIds = assetIds.subList(i, end);
            List<Inspection> batchResults = generateBatch(tenantId, batchAssetIds);
            generatedInspections.addAll(batchResults);
        }

        log.info("自动生成检验任务完成: 共生成 {} 条记录", generatedInspections.size());
        return generatedInspections;
    }

    /**
     * 分批次生成检验任务（新事务）
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    private List<Inspection> generateBatch(String tenantId, List<Long> assetIds) {
        List<Inspection> batch = new java.util.ArrayList<>();
        for (Long assetId : assetIds) {
            try {
                // 校验资产存在
                Asset asset = assetService.getAssetById(assetId);
                if (asset == null) {
                    log.warn("资产不存在，跳过: assetId={}", assetId);
                    continue;
                }

                // 创建检验记录
                Inspection inspection = new Inspection();
                inspection.setAssetId(assetId);
                inspection.setTenantId(tenantId);
                inspection.setInspectionNo(generateInspectionNo());
                inspection.setInspectionType("PERIODIC"); // 默认定期检验
                inspection.setInspectionDate(LocalDate.now());
                inspection.setNextInspectionDate(LocalDate.now().plusMonths(12)); // 默认12个月后
                inspection.setResult("PENDING"); // 待检验
                inspectionMapper.insert(inspection);
                batch.add(inspection);
            } catch (Exception e) {
                log.error("生成检验记录失败: assetId={}", assetId, e);
            }
        }
        return batch;
    }

    /**
     * 生成检验编号
     */
    private String generateInspectionNo() {
        return "INS-" + System.currentTimeMillis();
    }

    /**
     * 查询资产的检验历史
     */
    @Override
    public List<Inspection> getInspectionHistory(Long assetId) {
        String tenantId = TenantContext.requireTenantId();
        return inspectionMapper.selectList(
                new LambdaQueryWrapper<Inspection>()
                        .eq(Inspection::getTenantId, tenantId)
                        .eq(Inspection::getAssetId, assetId)
                        .orderByDesc(Inspection::getInspectionDate)
        );
    }

    // ==================== 定时任务方法（支持多租户）====================

    /**
     * 定时任务：每天早上8点检查即将到期检验（提前30天提醒）
     * 使用遍历租户方式确保租户隔离
     */
    @Scheduled(cron = "0 0 8 * * ?")
    @Transactional(rollbackFor = Exception.class)
    @Override
    public void checkExpiringInspections() {
        log.info("开始执行即将到期检验检查任务");
        List<String> tenantIds = getActiveTenantIds();
        for (String tenantId : tenantIds) {
            try {
                checkExpiringForTenant(tenantId);
            } catch (Exception e) {
                log.error("租户 {} 到期检查失败: {}", tenantId, e.getMessage(), e);
            }
        }
        log.info("即将到期检验检查任务完成");
    }

    /**
     * 定时任务：每天早上9点提醒逾期检验（超过nextInspectionDate）
     * 使用遍历租户方式确保租户隔离
     */
    @Scheduled(cron = "0 0 9 * * ?")
    @Transactional(rollbackFor = Exception.class)
    @Override
    public void markOverdueInspections() {
        log.info("开始执行逾期检验标记任务");
        List<String> tenantIds = getActiveTenantIds();
        for (String tenantId : tenantIds) {
            try {
                markOverdueForTenant(tenantId);
            } catch (Exception e) {
                log.error("租户 {} 逾期标记失败: {}", tenantId, e.getMessage(), e);
            }
        }
        log.info("逾期检验标记任务完成");
    }

    /**
     * 定时任务：每月1号0点生成检验统计报告
     * 使用遍历租户方式确保租户隔离
     */
    @Scheduled(cron = "0 0 0 1 * ?")
    @Transactional(rollbackFor = Exception.class)
    @Override
    public void generateInspectionStatistics() {
        log.info("开始生成检验统计报告");
        List<String> tenantIds = getActiveTenantIds();
        for (String tenantId : tenantIds) {
            try {
                generateStatisticsForTenant(tenantId);
            } catch (Exception e) {
                log.error("租户 {} 统计报告失败: {}", tenantId, e.getMessage(), e);
            }
        }
        log.info("检验统计报告生成完成");
    }

    // ==================== 批量操作方法 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<Inspection> batchGenerateInspections(List<Long> assetIds) {
        String tenantId = TenantContext.requireTenantId();
        if (assetIds == null || assetIds.isEmpty()) {
            throw new BusinessException("资产ID列表不能为空");
        }

        log.info("开始批量生成检验任务: 资产数量={}", assetIds.size());

        // 使用分批次处理（每批次100条）
        List<Inspection> generatedInspections = new java.util.ArrayList<>();
        int batchSize = 100;
        for (int i = 0; i < assetIds.size(); i += batchSize) {
            int end = Math.min(i + batchSize, assetIds.size());
            List<Long> batchAssetIds = assetIds.subList(i, end);
            List<Inspection> batchResults = generateBatch(tenantId, batchAssetIds);
            generatedInspections.addAll(batchResults);
        }

        log.info("批量生成检验任务完成: 共生成 {} 条记录", generatedInspections.size());
        return generatedInspections;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<Inspection> batchGenerateByCategory(Long assetCategoryId) {
        String tenantId = TenantContext.requireTenantId();
        if (assetCategoryId == null) {
            throw new BusinessException("资产类别ID不能为空");
        }

        log.info("开始按类别批量生成检验任务: categoryId={}", assetCategoryId);

        // 查询该类别下的所有资产
        List<Asset> assets = assetMapper.selectList(
                new LambdaQueryWrapper<Asset>()
                        .eq(Asset::getTenantId, tenantId)
                        .eq(Asset::getCategoryId, assetCategoryId)
        );

        if (assets.isEmpty()) {
            log.warn("该类别下没有资产: categoryId={}", assetCategoryId);
            return List.of();
        }

        List<Long> assetIds = assets.stream().map(Asset::getId).toList();
        List<Inspection> generatedInspections = batchGenerateInspections(assetIds);

        log.info("按类别批量生成检验任务完成: categoryId={}, 共生成 {} 条记录",
                assetCategoryId, generatedInspections.size());
        return generatedInspections;
    }

    // ==================== 照片上传方法 ====================

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void uploadPhotos(Long inspectionId, List<String> photoUrls) {
        String tenantId = TenantContext.requireTenantId();
        if (inspectionId == null) {
            throw new BusinessException("检验记录ID不能为空");
        }
        if (photoUrls == null || photoUrls.isEmpty()) {
            throw new BusinessException("照片URL列表不能为空");
        }

        // 验证检验记录存在
        Inspection inspection = inspectionMapper.selectOne(
                new LambdaQueryWrapper<Inspection>()
                        .eq(Inspection::getId, inspectionId)
                        .eq(Inspection::getTenantId, tenantId)
        );
        if (inspection == null) {
            throw new BusinessException("检验记录不存在: id=" + inspectionId);
        }

        // 获取现有照片
        String existingPhotos = inspection.getPhotos();
        List<String> photoList = new java.util.ArrayList<>();
        if (existingPhotos != null && !existingPhotos.isEmpty()) {
            // 假设照片URL以逗号分隔
            String[] urls = existingPhotos.split(",");
            for (String url : urls) {
                if (!url.trim().isEmpty()) {
                    photoList.add(url.trim());
                }
            }
        }

        // 添加新照片
        photoList.addAll(photoUrls);

        // 更新检验记录
        inspection.setPhotos(String.join(",", photoList));
        inspectionMapper.updateById(inspection);

        log.info("上传检验照片成功: inspectionId={}, 照片数量={}", inspectionId, photoUrls.size());
    }

    // ==================== 报告生成方法 ====================

    @Override
    public byte[] generateReport(Long inspectionId, String format) {
        String tenantId = TenantContext.requireTenantId();
        if (inspectionId == null) {
            throw new BusinessException("检验记录ID不能为空");
        }

        // 验证检验记录存在
        Inspection inspection = inspectionMapper.selectOne(
                new LambdaQueryWrapper<Inspection>()
                        .eq(Inspection::getId, inspectionId)
                        .eq(Inspection::getTenantId, tenantId)
        );
        if (inspection == null) {
            throw new BusinessException("检验记录不存在: id=" + inspectionId);
        }

        if (!"pdf".equalsIgnoreCase(format)) {
            throw new BusinessException("不支持的报告格式: " + format);
        }

        try {
            // 查询关联资产信息
            Asset asset = assetService.getAssetById(inspection.getAssetId());

            // 生成 PDF 报告
            byte[] pdfBytes = generatePdfReport(inspection, asset);
            log.info("生成检验报告成功: inspectionId={}", inspectionId);
            return pdfBytes;
        } catch (Exception e) {
            log.error("生成检验报告失败: inspectionId={}", inspectionId, e);
            throw new BusinessException("生成报告失败: " + e.getMessage());
        }
    }

    /**
     * 生成 PDF 报告（使用 iText）
     */
    private byte[] generatePdfReport(Inspection inspection, Asset asset) throws Exception {
        com.itextpdf.text.Document document = new com.itextpdf.text.Document();
        java.io.ByteArrayOutputStream outputStream = new java.io.ByteArrayOutputStream();
        com.itextpdf.text.pdf.PdfWriter writer = com.itextpdf.text.pdf.PdfWriter.getInstance(document, outputStream);

        document.open();

        // 添加标题
        com.itextpdf.text.Font titleFont = new com.itextpdf.text.Font(
                com.itextpdf.text.pdf.BaseFont.createFont(
                        "STSong-Light",
                        "UniGB-UCS2-H",
                        com.itextpdf.text.pdf.BaseFont.EMBEDDED
                ),
                18,
                com.itextpdf.text.Font.BOLD
        );
        com.itextpdf.text.Paragraph title = new com.itextpdf.text.Paragraph("检验报告", titleFont);
        title.setAlignment(com.itextpdf.text.Element.ALIGN_CENTER);
        title.setSpacingAfter(20f);
        document.add(title);

        // 添加基本信息
        com.itextpdf.text.Font normalFont = new com.itextpdf.text.Font(
                com.itextpdf.text.pdf.BaseFont.createFont(
                        "STSong-Light",
                        "UniGB-UCS2-H",
                        com.itextpdf.text.pdf.BaseFont.EMBEDDED
                ),
                12
        );

        com.itextpdf.text.Paragraph info = new com.itextpdf.text.Paragraph();
        info.add(new com.itextpdf.text.Chunk("检验编号: ", normalFont));
        info.add(new com.itextpdf.text.Chunk(inspection.getInspectionNo(), normalFont));
        info.add(new com.itextpdf.text.Chunk("\n", normalFont));

        if (asset != null) {
            info.add(new com.itextpdf.text.Chunk("资产名称: ", normalFont));
            info.add(new com.itextpdf.text.Chunk(asset.getAssetName(), normalFont));
            info.add(new com.itextpdf.text.Chunk("\n", normalFont));
        }

        info.add(new com.itextpdf.text.Chunk("检验类型: ", normalFont));
        info.add(new com.itextpdf.text.Chunk(inspection.getInspectionType(), normalFont));
        info.add(new com.itextpdf.text.Chunk("\n", normalFont));

        info.add(new com.itextpdf.text.Chunk("检验日期: ", normalFont));
        info.add(new com.itextpdf.text.Chunk(inspection.getInspectionDate().toString(), normalFont));
        info.add(new com.itextpdf.text.Chunk("\n", normalFont));

        if (inspection.getInspectionAgency() != null) {
            info.add(new com.itextpdf.text.Chunk("检验机构: ", normalFont));
            info.add(new com.itextpdf.text.Chunk(inspection.getInspectionAgency(), normalFont));
            info.add(new com.itextpdf.text.Chunk("\n", normalFont));
        }

        if (inspection.getInspectorName() != null) {
            info.add(new com.itextpdf.text.Chunk("检验人员: ", normalFont));
            info.add(new com.itextpdf.text.Chunk(inspection.getInspectorName(), normalFont));
            info.add(new com.itextpdf.text.Chunk("\n", normalFont));
        }

        info.add(new com.itextpdf.text.Chunk("检验结果: ", normalFont));
        com.itextpdf.text.Font resultFont = new com.itextpdf.text.Font(
                com.itextpdf.text.pdf.BaseFont.createFont(
                        "STSong-Light",
                        "UniGB-UCS2-H",
                        com.itextpdf.text.pdf.BaseFont.EMBEDDED
                ),
                12,
                com.itextpdf.text.Font.BOLD
        );
        String resultText = switch (inspection.getResult()) {
            case "PASS" -> "通过";
            case "FAIL" -> "不通过";
            case "CONDITIONAL" -> "有条件通过";
            case "PENDING" -> "待检验";
            case "OVERDUE" -> "逾期";
            default -> inspection.getResult();
        };
        info.add(new com.itextpdf.text.Chunk(resultText, resultFont));
        info.add(new com.itextpdf.text.Chunk("\n\n", normalFont));
        document.add(info);

        // 添加检查发现
        if (inspection.getFindings() != null && !inspection.getFindings().isEmpty()) {
            com.itextpdf.text.Paragraph findingsTitle = new com.itextpdf.text.Paragraph("检查发现", titleFont);
            findingsTitle.setSpacingBefore(10f);
            findingsTitle.setSpacingAfter(10f);
            document.add(findingsTitle);

            com.itextpdf.text.Paragraph findingsContent = new com.itextpdf.text.Paragraph(
                    inspection.getFindings(), normalFont);
            document.add(findingsContent);
        }

        // 添加生成时间
        com.itextpdf.text.Paragraph footer = new com.itextpdf.text.Paragraph(
                "生成时间: " + LocalDateTime.now().toString(), normalFont);
        footer.setAlignment(com.itextpdf.text.Element.ALIGN_CENTER);
        footer.setSpacingBefore(30f);
        document.add(footer);

        document.close();

        return outputStream.toByteArray();
    }

    // ==================== 私有辅助方法====================

    /**
     * 为指定租户检查即将到期的检验
     */
    private void checkExpiringForTenant(String tenantId) {
        LocalDate warningDate = LocalDate.now().plusDays(30);
        List<Inspection> expiring = inspectionMapper.findExpiringSoon(tenantId, warningDate);

        for (Inspection inspection : expiring) {
            try {
                Asset asset = assetService.getAssetById(inspection.getAssetId());
                if (asset == null) continue;

                int daysRemaining = inspection.getNextInspectionDate() != null
                    ? (int) ChronoUnit.DAYS.between(LocalDate.now(), inspection.getNextInspectionDate())
                    : 0;

                if (daysRemaining <= 0 || daysRemaining > 30) continue;

                Map<String, Object> variables = new HashMap<>();
                variables.put("inspectionNo", inspection.getInspectionNo());
                variables.put("assetName", asset.getAssetName());
                variables.put("inspectionType", inspection.getInspectionType());
                variables.put("daysRemaining", daysRemaining);
                variables.put("expiryDate", inspection.getNextInspectionDate());

                notificationService.sendByTemplate("INS_INSPECTION_EXPIRING", variables,
                        getCurrentUserId(), inspection.getId(), "INSPECTION");

                log.info("发送检验到期提醒: inspectionId={}, assetName={}, daysRemaining={}",
                        inspection.getId(), asset.getAssetName(), daysRemaining);
            } catch (Exception e) {
                log.error("发送提醒失败: inspectionId={}, error={}", inspection.getId(), e.getMessage());
            }
        }
    }

    /**
     * 为指定租户标记逾期检验并发送通知
     */
    private void markOverdueForTenant(String tenantId) {
        LocalDate today = LocalDate.now();
        List<Inspection> overdue = inspectionMapper.selectList(
                new LambdaQueryWrapper<Inspection>()
                        .eq(Inspection::getTenantId, tenantId)
                        .lt(Inspection::getNextInspectionDate, today)
                        .in(Inspection::getResult, "PASS", "CONDITIONAL", "PENDING")
        );

        int overdueCount = 0;
        for (Inspection inspection : overdue) {
            try {
                inspection.setResult("OVERDUE");
                inspectionMapper.updateById(inspection);
                overdueCount++;

                Asset asset = assetService.getAssetById(inspection.getAssetId());
                if (asset != null) {
                    // 计算逾期天数
                    int overdueDays = 0;
                    if (inspection.getNextInspectionDate() != null) {
                        overdueDays = (int) ChronoUnit.DAYS.between(inspection.getNextInspectionDate(), today);
                    }

                    // 发送逾期通知
                    Map<String, Object> variables = new HashMap<>();
                    variables.put("inspectionNo", inspection.getInspectionNo());
                    variables.put("assetName", asset.getAssetName());
                    variables.put("overdueDays", overdueDays);
                    notificationService.sendByTemplate("INS_INSPECTION_OVERDUE", variables,
                            getCurrentUserId(), inspection.getId(), "INSPECTION");
                    log.info("发送逾期通知: inspectionId={}, assetName={}, overdueDays={}",
                            inspection.getId(), asset.getAssetName(), overdueDays);

                    // 生成整改工单
                    WorkOrderDTO dto = new WorkOrderDTO();
                    dto.setTitle("检验逾期整改");
                    dto.setDescription("检验单 " + inspection.getInspectionNo() + "（资产：" + asset.getAssetName()
                            + "）已于 " + inspection.getNextInspectionDate() + " 到期，已逾期 " + overdueDays + " 天，请尽快安排复检。");
                    dto.setPriority("HIGH");
                    dto.setAssetId(inspection.getAssetId());
                    dto.setReporterId(getCurrentUserId());
                    dto.setDeptId(null);
                    workOrderService.createWorkOrder(dto);
                    log.info("生成逾期整改工单: inspectionId={}, assetName={}", inspection.getId(), asset.getAssetName());
                }
            } catch (Exception e) {
                log.error("标记逾期失败: inspectionId={}, error={}", inspection.getId(), e.getMessage());
            }
        }

        if (overdueCount > 0) {
            log.info("租户 {} 标记 {} 个逾期检验", tenantId, overdueCount);
        }
    }

    /**
     * 为指定租户生成检验统计报告并发送通知
     */
    private void generateStatisticsForTenant(String tenantId) {
        // 查询上个月的数据
        LocalDate now = LocalDate.now();
        LocalDate startOfMonth = now.minusMonths(1).withDayOfMonth(1);
        LocalDate endOfMonth = now.withDayOfMonth(1).minusDays(1);
        String yearMonth = startOfMonth.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM"));

        long totalCount = inspectionMapper.selectCount(
                new LambdaQueryWrapper<Inspection>()
                        .eq(Inspection::getTenantId, tenantId)
                        .ge(Inspection::getInspectionDate, startOfMonth)
                        .le(Inspection::getInspectionDate, endOfMonth)
        );

        long completedCount = inspectionMapper.selectCount(
                new LambdaQueryWrapper<Inspection>()
                        .eq(Inspection::getTenantId, tenantId)
                        .ge(Inspection::getInspectionDate, startOfMonth)
                        .le(Inspection::getInspectionDate, endOfMonth)
                        .eq(Inspection::getResult, "PASS")
        );

        long overdueCount = inspectionMapper.selectCount(
                new LambdaQueryWrapper<Inspection>()
                        .eq(Inspection::getTenantId, tenantId)
                        .lt(Inspection::getNextInspectionDate, startOfMonth)
                        .eq(Inspection::getResult, "OVERDUE")
        );

        double completionRate = totalCount > 0 ? (double) completedCount / totalCount * 100 : 0;
        double overdueRate = totalCount > 0 ? (double) overdueCount / totalCount * 100 : 0;

        // 发送统计报告通知
        Map<String, Object> variables = new HashMap<>();
        variables.put("yearMonth", yearMonth);
        variables.put("totalCount", totalCount);
        variables.put("completedCount", completedCount);
        variables.put("overdueCount", overdueCount);
        variables.put("completionRate", String.format("%.2f", completionRate));
        variables.put("overdueRate", String.format("%.2f", overdueRate));

        notificationService.sendByTemplateToRole("INS_INSPECTION_SUMMARY", "ASSET_MANAGER",
                variables, null, "INSPECTION");

        log.info("租户 {} 检验统计报告已发送: {} 总计={}, 完成={}, 逾期={}, 完成率={}%, 逾期率={}%",
                tenantId, yearMonth, totalCount, completedCount, overdueCount,
                String.format("%.2f", completionRate), String.format("%.2f", overdueRate));
    }

    /**
     * 获取活跃租户列表
     */
    private List<String> getActiveTenantIds() {
        // TODO: 从租户管理服务获取活跃租户列表
        // 临时实现：返回默认租户
        return List.of("1");
    }

    /**
     * 获取当前用户ID
     */
    private Long getCurrentUserId() {
        try {
            org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                return (long) auth.getName().hashCode();
            }
        } catch (Exception e) {
            // ignore
        }
        return 0L;
    }
}