package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.InventoryScanDTO;
import com.ams.dto.InventoryTaskCreateDTO;
import com.ams.entity.InventoryDetail;
import com.ams.entity.InventoryTask;
import com.ams.entity.InventoryAdjustmentLog;
import com.ams.mapper.InventoryDetailMapper;
import com.ams.mapper.InventoryTaskMapper;
import com.ams.mapper.InventoryAdjustmentLogMapper;
import com.ams.mapper.AssetMapper;
import com.ams.entity.Asset;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

import com.ams.annotation.DataScope;
@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryTaskMapper inventoryTaskMapper;
    private final InventoryDetailMapper inventoryDetailMapper;
    private final InventoryAdjustmentLogMapper inventoryAdjustmentLogMapper;
    private final AssetMapper assetMapper;

    public Page<InventoryTask> queryTasks(Integer page, Integer pageSize, String status) {
        return queryTasks(page, pageSize, status, null);
    }

    @DataScope(userColumn = "create_by")
    public Page<InventoryTask> queryTasks(Integer page, Integer pageSize, String status, String search) {
        String tenantId = TenantContext.requireTenantId();
        Page<InventoryTask> pageParam = new Page<>(page == null ? 1 : page, pageSize == null ? 10 : pageSize);

        LambdaQueryWrapper<InventoryTask> wrapper = new LambdaQueryWrapper<InventoryTask>()
                .eq(InventoryTask::getTenantId, tenantId);
        if (status != null && !status.isEmpty()) {
            wrapper.eq(InventoryTask::getStatus, status);
        }
        if (search != null && !search.isEmpty()) {
            wrapper.and(w -> w.like(InventoryTask::getTaskName, search)
                    .or().like(InventoryTask::getTaskNo, search));
        }
        wrapper.orderByDesc(InventoryTask::getCreateTime);

        return inventoryTaskMapper.selectPage(pageParam, wrapper);
    }

    public Map<String, Object> getTaskById(Long id) {
        InventoryTask task = getTaskEntityById(id);
        List<InventoryDetail> details = getTaskDetails(id);

        Map<String, Object> result = new HashMap<>();
        result.put("task", task);
        result.put("details", details);
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryTask createTask(InventoryTaskCreateDTO createDTO) {
        String tenantId = TenantContext.requireTenantId();
        InventoryTask task = new InventoryTask();
        BeanUtil.copyProperties(createDTO, task);
        task.setTenantId(tenantId);

        task.setTaskNo(generateTaskNo());
        if (task.getStatus() == null || task.getStatus().isEmpty()) {
            task.setStatus("PENDING");
        }
        if (task.getScannedCount() == null) {
            task.setScannedCount(0);
        }
        if (task.getMatchCount() == null) {
            task.setMatchCount(0);
        }
        if (task.getLossCount() == null) {
            task.setLossCount(0);
        }
        if (task.getTotalCount() == null) {
            task.setTotalCount(0);
        }

        inventoryTaskMapper.insert(task);
        return task;
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryTask updateTaskStatus(Long id, String status) {
        InventoryTask task = getTaskEntityById(id);
        task.setStatus(status);
        inventoryTaskMapper.updateById(task);
        return task;
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryDetail addScanResult(Long taskId, InventoryScanDTO scanDTO) {
        InventoryTask task = getTaskEntityById(taskId);

        InventoryDetail detail = new InventoryDetail();
        BeanUtil.copyProperties(scanDTO, detail);
        detail.setTaskId(taskId);
        detail.setTenantId(task.getTenantId());
        if (detail.getScanTime() == null) {
            detail.setScanTime(LocalDateTime.now());
        }
        inventoryDetailMapper.insert(detail);

        List<InventoryDetail> details = getTaskDetails(taskId);
        int scannedCount = details.size();
        int matchCount = (int) details.stream()
            .filter(item -> item.getStatus() != null && "MATCH".equalsIgnoreCase(item.getStatus()))
            .count();

        int totalCount = task.getTotalCount() == null ? 0 : task.getTotalCount();
        int lossCount = Math.max(totalCount - scannedCount, 0);

        task.setScannedCount(scannedCount);
        task.setMatchCount(matchCount);
        task.setLossCount(lossCount);
        inventoryTaskMapper.updateById(task);

        return detail;
    }

    public List<InventoryDetail> getTaskDetails(Long taskId) {
        String tenantId = TenantContext.requireTenantId();
        getTaskEntityById(taskId);
        return inventoryDetailMapper.selectList(
            new LambdaQueryWrapper<InventoryDetail>()
                .eq(InventoryDetail::getTenantId, tenantId)
                .eq(InventoryDetail::getTaskId, taskId)
                .orderByDesc(InventoryDetail::getScanTime)
                .orderByDesc(InventoryDetail::getCreateTime)
        );
    }

    /**
     * Batch update inventory detail records by their IDs.
     * Used for the frontend batch-confirm operation during stocktaking.
     *
     * @param detailIds list of detail record IDs to update
     * @param status    the new status to apply (e.g. "MATCH")
     */
    @Transactional(rollbackFor = Exception.class)
    public void batchUpdateDetails(List<String> detailIds, String status) {
        if (detailIds == null || detailIds.isEmpty()) {
            return;
        }
        String tenantId = TenantContext.requireTenantId();
        for (String idStr : detailIds) {
            Long detailId = Long.valueOf(idStr);
            InventoryDetail detail = inventoryDetailMapper.selectOne(
                new LambdaQueryWrapper<InventoryDetail>()
                    .eq(InventoryDetail::getId, detailId)
                    .eq(InventoryDetail::getTenantId, tenantId)
            );
            if (detail != null && status != null) {
                detail.setStatus(status);
                inventoryDetailMapper.updateById(detail);
            }
        }
    }

    /**
     * Confirm a single inventory detail row from the task detail UI.
     *
     * <p>The frontend route names this path segment {@code assetId}, but the
     * table row id is the inventory_detail id. Keeping the service contract
     * detail-oriented prevents duplicate asset rows from overwriting each other.
     */
    @Transactional(rollbackFor = Exception.class)
    public InventoryDetail confirmAsset(Long taskId, Long detailId, String actualStatus, String remark) {
        InventoryTask task = getTaskEntityById(taskId);
        InventoryDetail detail = getTaskDetailEntity(task.getId(), detailId);
        detail.setStatus(normalizeActualStatus(actualStatus));
        if (StringUtils.hasText(remark)) {
            detail.setRemark(remark);
        }
        inventoryDetailMapper.updateById(detail);
        return detail;
    }

    /**
     * Batch confirm inventory detail rows from the task detail UI.
     */
    @Transactional(rollbackFor = Exception.class)
    public void batchConfirmAssets(Long taskId, List<String> detailIds, String actualStatus, String remark) {
        if (detailIds == null || detailIds.isEmpty()) {
            return;
        }
        InventoryTask task = getTaskEntityById(taskId);
        String normalizedStatus = normalizeActualStatus(actualStatus);
        for (String idStr : detailIds) {
            Long detailId = Long.valueOf(idStr);
            InventoryDetail detail = getTaskDetailEntity(task.getId(), detailId);
            detail.setStatus(normalizedStatus);
            if (StringUtils.hasText(remark)) {
                detail.setRemark(remark);
            }
            inventoryDetailMapper.updateById(detail);
        }
    }

    /**
     * 获取盘点任务差异汇总。
     * 按 InventoryDetail.status 字段分组统计：surplus/deficit/damaged/normal。
     */
    public Map<String, Object> getTaskSummary(Long taskId) {
        List<InventoryDetail> details = getTaskDetails(taskId);

        // 按 actualStatus 分组统计
        long surplusCount = details.stream()
            .filter(d -> "surplus".equalsIgnoreCase(d.getStatus()))
            .count();
        long deficitCount = details.stream()
            .filter(d -> "deficit".equalsIgnoreCase(d.getStatus()))
            .count();
        long damagedCount = details.stream()
            .filter(d -> "damaged".equalsIgnoreCase(d.getStatus()))
            .count();
        long normalCount = details.stream()
            .filter(d -> "normal".equalsIgnoreCase(d.getStatus()) || d.getStatus() == null)
            .count();

        // 构建差异明细
        List<Map<String, Object>> surplusItems = buildDiffItems(details, "surplus");
        List<Map<String, Object>> deficitItems = buildDiffItems(details, "deficit");
        List<Map<String, Object>> damagedItems = buildDiffItems(details, "damaged");

        Map<String, Object> result = new HashMap<>();
        result.put("surplusCount", surplusCount);
        result.put("deficitCount", deficitCount);
        result.put("damagedCount", damagedCount);
        result.put("normalCount", normalCount);
        result.put("abnormalCount", surplusCount + deficitCount + damagedCount);
        result.put("surplusItems", surplusItems);
        result.put("deficitItems", deficitItems);
        result.put("damagedItems", damagedItems);
        return result;
    }

    /**
     * 提交盘点任务核准（COMPLETED → PENDING_APPROVAL）。
     */
    @Transactional(rollbackFor = Exception.class)
    public InventoryTask submitTask(Long id) {
        InventoryTask task = getTaskEntityById(id);
        if (!"COMPLETED".equals(task.getStatus())) {
            throw new BusinessException("只有已完成的盘点任务可以提交核准");
        }
        List<InventoryDetail> details = getTaskDetails(id);
        if (details.isEmpty()) {
            throw new BusinessException("盘点任务无明细，无法提交");
        }
        task.setStatus("PENDING_APPROVAL");
        inventoryTaskMapper.updateById(task);
        return task;
    }

    /**
     * 审批盘点任务并执行自动调账（PENDING_APPROVAL → APPROVED）。
     *
     * <p>调账逻辑在 @Transactional 内原子执行：
     * <ul>
     *   <li>盘盈（surplus）：创建新 Asset，assetNo 自动生成（AS-INV-{taskId}-{seq}）</li>
     *   <li>盘亏（deficit）：将对应 Asset 状态更新为 LOST</li>
     *   <li>损坏（damaged）：将对应 Asset 状态更新为 MAINTENANCE</li>
     * </ul>
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> approveTask(Long id) {
        InventoryTask task = getTaskEntityById(id);
        if (!"PENDING_APPROVAL".equals(task.getStatus())) {
            throw new BusinessException("只有待审批的盘点任务可以核准");
        }

        List<InventoryDetail> details = getTaskDetails(id);
        int surplusCreated = 0;
        int deficitMarked = 0;
        int damagedMarked = 0;
        List<String> errors = new java.util.ArrayList<>();

        // 自动调账
        for (InventoryDetail detail : details) {
            try {
                String status = detail.getStatus() != null ? detail.getStatus().toLowerCase() : "";
                switch (status) {
                    case "surplus" -> {
                        // 盘盈：创建新 Asset
                        Asset asset = new Asset();
                        asset.setAssetNo("AS-INV-" + id + "-" + (surplusCreated + 1));
                        asset.setAssetName(detail.getRemark() != null ? detail.getRemark() : "盘点盘盈资产");
                        asset.setCategoryId(0L); // 兜底分类 ID
                        asset.setStatus("IDLE");
                        asset.setTenantId(task.getTenantId());
                        asset.setLocation(detail.getActualLocation());
                        assetMapper.insert(asset);
                        recordAdjustment(task, detail, asset, "SURPLUS", null, "IDLE", "盘盈自动创建资产");
                        surplusCreated++;
                    }
                    case "deficit" -> {
                        // 盘亏：变更 Asset 为 LOST
                        if (detail.getAssetId() != null) {
                            Asset asset = assetMapper.selectOne(new LambdaQueryWrapper<Asset>()
                                    .eq(Asset::getId, detail.getAssetId())
                                    .eq(Asset::getTenantId, task.getTenantId()));
                            if (asset != null) {
                                String beforeStatus = asset.getStatus();
                                asset.setStatus("LOST");
                                assetMapper.updateById(asset);
                                recordAdjustment(task, detail, asset, "DEFICIT", beforeStatus, "LOST", "盘亏自动标记资产状态");
                                deficitMarked++;
                            } else {
                                errors.add("资产 " + detail.getAssetId() + " 不属于当前租户或不存在");
                            }
                        }
                    }
                    case "damaged" -> {
                        // 损坏：变更 Asset 为 MAINTENANCE
                        if (detail.getAssetId() != null) {
                            Asset asset = assetMapper.selectOne(new LambdaQueryWrapper<Asset>()
                                    .eq(Asset::getId, detail.getAssetId())
                                    .eq(Asset::getTenantId, task.getTenantId()));
                            if (asset != null) {
                                String beforeStatus = asset.getStatus();
                                asset.setStatus("MAINTENANCE");
                                assetMapper.updateById(asset);
                                recordAdjustment(task, detail, asset, "DAMAGE", beforeStatus, "MAINTENANCE", "损坏自动标记资产状态");
                                damagedMarked++;
                            } else {
                                errors.add("资产 " + detail.getAssetId() + " 不属于当前租户或不存在");
                            }
                        }
                    }
                }
            } catch (Exception e) {
                errors.add("资产 " + detail.getAssetId() + " 处理失败: " + e.getMessage());
            }
        }

        // 更新任务状态和统计数据
        task.setStatus("APPROVED");
        task.setSurplusCount(surplusCreated);
        task.setDeficitCount(deficitMarked);
        task.setDamageCount(damagedMarked);
        task.setApprovedBy(getCurrentUserId());
        task.setApprovedAt(LocalDateTime.now());
        inventoryTaskMapper.updateById(task);

        Map<String, Object> result = new HashMap<>();
        result.put("surplusCreated", surplusCreated);
        result.put("deficitMarked", deficitMarked);
        result.put("damagedMarked", damagedMarked);
        result.put("errors", errors);
        result.put("taskStatus", "APPROVED");
        return result;
    }

    /**
     * 构建差异明细列表。
     */
    private List<Map<String, Object>> buildDiffItems(List<InventoryDetail> details, String status) {
        return details.stream()
            .filter(d -> status.equalsIgnoreCase(d.getStatus()))
            .map(d -> {
                Map<String, Object> item = new HashMap<>();
                item.put("assetId", d.getAssetId() != null ? String.valueOf(d.getAssetId()) : "");
                item.put("assetCode", "");
                item.put("assetName", d.getRemark() != null ? d.getRemark() : "");
                item.put("reason", status.equals("surplus") ? "盘盈" : status.equals("deficit") ? "盘亏" : "损坏");
                return item;
            })
            .collect(Collectors.toList());
    }

    private InventoryDetail getTaskDetailEntity(Long taskId, Long detailId) {
        String tenantId = TenantContext.requireTenantId();
        InventoryDetail detail = inventoryDetailMapper.selectOne(
                new LambdaQueryWrapper<InventoryDetail>()
                        .eq(InventoryDetail::getTenantId, tenantId)
                        .eq(InventoryDetail::getTaskId, taskId)
                        .eq(InventoryDetail::getId, detailId));
        if (detail == null) {
            throw new BusinessException("盘点明细不存在");
        }
        return detail;
    }

    private String normalizeActualStatus(String status) {
        if (!StringUtils.hasText(status)) {
            throw new BusinessException("盘点状态不能为空");
        }
        String normalized = status.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "normal", "match" -> "normal";
            case "surplus" -> "surplus";
            case "deficit", "loss" -> "deficit";
            case "damaged", "damage" -> "damaged";
            case "other" -> "other";
            default -> throw new BusinessException("盘点状态无效: " + status);
        };
    }

    private void recordAdjustment(
            InventoryTask task,
            InventoryDetail detail,
            Asset asset,
            String adjustmentType,
            String statusBefore,
            String statusAfter,
            String remark) {
        InventoryAdjustmentLog log = new InventoryAdjustmentLog();
        log.setTaskId(task.getId());
        log.setDetailId(detail.getId());
        log.setAssetId(asset.getId());
        log.setAssetNo(asset.getAssetNo());
        log.setAssetName(asset.getAssetName());
        log.setAdjustmentType(adjustmentType);
        log.setStatusBefore(statusBefore);
        log.setStatusAfter(statusAfter);
        log.setRemark(remark);
        log.setCreatedBy(getCurrentUserId());
        inventoryAdjustmentLogMapper.insert(log);
    }

    /**
     * 获取当前认证用户 ID（简单的实现，从 SecurityContext 获取 username）。
     */
    private Long getCurrentUserId() {
        try {
            org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                return (long) auth.getName().hashCode(); // 简化实现，生产环境应通过 UserMapper 反查
            }
        } catch (Exception e) {
            // ignore
        }
        return 0L;
    }

    private InventoryTask getTaskEntityById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        InventoryTask task = inventoryTaskMapper.selectOne(new LambdaQueryWrapper<InventoryTask>()
                .eq(InventoryTask::getId, id)
                .eq(InventoryTask::getTenantId, tenantId));
        if (task == null) {
            throw new BusinessException("盘点任务不存在");
        }
        return task;
    }

    private String generateTaskNo() {
        String tenantId = TenantContext.requireTenantId();
        String dateStr = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String prefix = "INV-" + dateStr + "-";

        List<InventoryTask> todayTasks = inventoryTaskMapper.selectList(
            new LambdaQueryWrapper<InventoryTask>()
                .eq(InventoryTask::getTenantId, tenantId)
                .likeRight(InventoryTask::getTaskNo, prefix)
                .orderByDesc(InventoryTask::getTaskNo)
        );

        int nextSeq = 1;
        if (!todayTasks.isEmpty()) {
            String latestTaskNo = todayTasks.get(0).getTaskNo();
            String seqPart = latestTaskNo.substring(prefix.length());
            try {
                nextSeq = Integer.parseInt(seqPart) + 1;
            } catch (NumberFormatException ignored) {
                nextSeq = todayTasks.size() + 1;
            }
        }

        return prefix + String.format("%03d", nextSeq);
    }

    public Map<String, Object> getTaskAssets(Long taskId, Integer page, Integer pageSize, String status) {
        String tenantId = TenantContext.requireTenantId();
        List<InventoryDetail> allDetails = inventoryDetailMapper.selectList(
            new LambdaQueryWrapper<InventoryDetail>()
                .eq(InventoryDetail::getTaskId, taskId)
                .eq(InventoryDetail::getTenantId, tenantId)
                .orderByAsc(InventoryDetail::getId)
        );

        if (status != null && !status.isEmpty()) {
            allDetails = allDetails.stream()
                .filter(d -> {
                    String s = d.getStatus() != null ? d.getStatus().toLowerCase() : "normal";
                    if ("normal".equals(status)) return "normal".equals(s) || "match".equals(s);
                    return s.equals(status);
                })
                .collect(Collectors.toList());
        }

        int total = allDetails.size();
        int p = page == null ? 1 : page;
        int ps = pageSize == null ? 20 : pageSize;
        int from = Math.min((p - 1) * ps, total);
        int to = Math.min(from + ps, total);
        List<InventoryDetail> paged = allDetails.subList(from, to);

        List<Map<String, Object>> records = new ArrayList<>();
        for (InventoryDetail d : paged) {
            Map<String, Object> row = new HashMap<>();
            row.put("id", String.valueOf(d.getId()));
            row.put("assetId", d.getAssetId() != null ? String.valueOf(d.getAssetId()) : null);
            row.put("rfidTag", d.getRfidTag());
            row.put("remark", d.getRemark() != null ? d.getRemark() : "");
            row.put("scanTime", d.getScanTime());

            String s = d.getStatus() != null ? d.getStatus().toLowerCase() : "normal";
            if ("match".equals(s)) s = "normal";
            row.put("actualStatus", s);
            row.put("confirmed", d.getStatus() != null);

            if (d.getAssetId() != null) {
                Asset asset = assetMapper.selectById(d.getAssetId());
                if (asset != null) {
                    row.put("assetCode", asset.getAssetNo());
                    row.put("assetName", asset.getAssetName());
                    row.put("bookStatus", asset.getStatus());
                    row.put("categoryName", null);
                    row.put("locationPath", asset.getLocationName() != null ? asset.getLocationName() : "");
                } else {
                    row.put("assetCode", d.getRfidTag());
                    row.put("assetName", "未知资产");
                    row.put("bookStatus", null);
                }
            } else {
                row.put("assetCode", d.getRfidTag());
                row.put("assetName", "RFID扫描资产");
                row.put("bookStatus", null);
            }
            records.add(row);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("records", records);
        result.put("total", total);
        result.put("size", ps);
        result.put("current", p);
        return result;
    }
}
