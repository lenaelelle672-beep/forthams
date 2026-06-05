package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.NotificationRecord;
import com.ams.entity.SparePart;
import com.ams.entity.SparePartUsage;
import com.ams.mapper.SparePartMapper;
import com.ams.mapper.SparePartUsageMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SparePartService {

    private static final Logger log = LoggerFactory.getLogger(SparePartService.class);

    private final SparePartMapper sparePartMapper;
    private final SparePartUsageMapper sparePartUsageMapper;
    private final NotificationService notificationService;

    // ── CRUD ──────────────────────────────────────────────────────────────

    public Page<SparePart> list(Integer page, Integer pageSize, String keyword) {
        String tenantId = TenantContext.requireTenantId();
        Page<SparePart> pageObj = new Page<>(page, pageSize);
        LambdaQueryWrapper<SparePart> wrapper = new LambdaQueryWrapper<SparePart>()
                .eq(SparePart::getTenantId, tenantId);
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(SparePart::getPartNo, keyword)
                    .or().like(SparePart::getPartName, keyword));
        }
        wrapper.orderByDesc(SparePart::getCreateTime);
        return sparePartMapper.selectPage(pageObj, wrapper);
    }

    public SparePart getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        SparePart sparePart = sparePartMapper.selectOne(
                new LambdaQueryWrapper<SparePart>()
                        .eq(SparePart::getId, id)
                        .eq(SparePart::getTenantId, tenantId));
        if (sparePart == null) {
            throw new BusinessException("备件不存在");
        }
        return sparePart;
    }

    @Transactional(rollbackFor = Exception.class)
    public SparePart create(SparePart sparePart) {
        String tenantId = TenantContext.requireTenantId();
        sparePart.setTenantId(tenantId);
        if (sparePart.getCurrentStock() == null) sparePart.setCurrentStock(BigDecimal.ZERO);
        if (sparePart.getSafetyStock() == null) sparePart.setSafetyStock(BigDecimal.ZERO);
        if (sparePart.getStatus() == null) sparePart.setStatus("ENABLED");
        sparePart.setVersion(0);
        sparePartMapper.insert(sparePart);
        return sparePart;
    }

    @Transactional(rollbackFor = Exception.class)
    public SparePart update(Long id, SparePart sparePart) {
        String tenantId = TenantContext.requireTenantId();
        SparePart existing = sparePartMapper.selectOne(
                new LambdaQueryWrapper<SparePart>()
                        .eq(SparePart::getId, id)
                        .eq(SparePart::getTenantId, tenantId));
        if (existing == null) {
            throw new BusinessException("备件不存在");
        }
        sparePart.setId(id);
        sparePart.setTenantId(tenantId);
        sparePart.setVersion(existing.getVersion()); // 保持版本号不变（避免乐观锁冲突）
        sparePartMapper.updateById(sparePart);
        return sparePart;
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        String tenantId = TenantContext.requireTenantId();
        sparePartMapper.delete(new LambdaQueryWrapper<SparePart>()
                .eq(SparePart::getId, id)
                .eq(SparePart::getTenantId, tenantId));
    }

    // ── 库存扣减（乐观锁） ────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public SparePartUsage consumePart(SparePartUsage usage) {
        String tenantId = TenantContext.requireTenantId();
        usage.setTenantId(tenantId);

        // 1. 查备件
        SparePart sparePart = sparePartMapper.selectById(usage.getSparePartId());
        if (sparePart == null) {
            throw new BusinessException("备件不存在");
        }
        if (!tenantId.equals(sparePart.getTenantId())) {
            throw new BusinessException("备件租户不匹配");
        }

        // 2. 检查库存
        if (sparePart.getCurrentStock().compareTo(usage.getQuantity()) < 0) {
            throw new BusinessException("库存不足：" + sparePart.getPartName()
                    + " 当前库存 " + sparePart.getCurrentStock()
                    + "，需要 " + usage.getQuantity());
        }

        // 3. 乐观锁扣减
        int affected = sparePartMapper.reduceStock(
                usage.getSparePartId(),
                usage.getQuantity(),
                sparePart.getVersion());
        if (affected == 0) {
            throw new BusinessException("库存扣减失败，可能库存不足或数据已变更，请重试");
        }

        // 4. 记录领用
        if (usage.getUsageDate() == null) {
            usage.setUsageDate(LocalDateTime.now());
        }
        sparePartUsageMapper.insert(usage);

        // 5. 检查是否需要安全库存告警
        SparePart updated = sparePartMapper.selectById(usage.getSparePartId());
        if (updated != null && updated.getCurrentStock().compareTo(updated.getSafetyStock()) < 0) {
            sendLowStockNotification(updated);
        }

        return usage;
    }

    // ── 安全库存告警 ──────────────────────────────────────────────────────

    public List<SparePart> getLowStockAlerts() {
        String tenantId = TenantContext.requireTenantId();
        return sparePartMapper.selectLowStock(tenantId);
    }

    private void sendLowStockNotification(SparePart sparePart) {
        try {
            NotificationRecord notification = new NotificationRecord();
            notification.setUserId(0L); // 系统通知
            notification.setTitle("备件库存告警");
            notification.setContent("备件「" + sparePart.getPartName()
                    + "」（编码: " + sparePart.getPartNo()
                    + "）当前库存 " + sparePart.getCurrentStock()
                    + "，已低于安全库存 " + sparePart.getSafetyStock());
            notification.setType("INVENTORY");
            notification.setCategory("WARNING");
            notification.setRefId(sparePart.getId());
            notification.setRefType("SPARE_PART");
            notificationService.create(notification);
        } catch (Exception e) {
            log.warn("发送库存告警通知失败: {}", e.getMessage());
        }
    }

    // ── 采购建议 ──────────────────────────────────────────────────────────

    public List<Map<String, Object>> getPurchaseSuggestions() {
        String tenantId = TenantContext.requireTenantId();
        List<SparePart> all = sparePartMapper.selectList(
                new LambdaQueryWrapper<SparePart>()
                        .eq(SparePart::getTenantId, tenantId)
                        .eq(SparePart::getDeleted, 0));

        // 基于最近30天消耗速率的采购建议
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        List<SparePartUsage> recentUsages = sparePartUsageMapper.selectList(
                new LambdaQueryWrapper<SparePartUsage>()
                        .eq(SparePartUsage::getTenantId, tenantId)
                        .ge(SparePartUsage::getUsageDate, thirtyDaysAgo));

        Map<Long, BigDecimal> usageMap = recentUsages.stream()
                .collect(Collectors.groupingBy(
                        SparePartUsage::getSparePartId,
                        Collectors.reducing(BigDecimal.ZERO, SparePartUsage::getQuantity, BigDecimal::add)));

        List<Map<String, Object>> suggestions = new ArrayList<>();
        for (SparePart sp : all) {
            BigDecimal consumed = usageMap.getOrDefault(sp.getId(), BigDecimal.ZERO);
            BigDecimal dailyAvg = consumed.divide(BigDecimal.valueOf(30), 2, BigDecimal.ROUND_HALF_UP);

            // 建议采购量 = (日均消耗量 × 30) - (当前库存 - 安全库存)
            BigDecimal suggestedOrder = dailyAvg.multiply(BigDecimal.valueOf(30))
                    .subtract(sp.getCurrentStock().subtract(sp.getSafetyStock()))
                    .max(BigDecimal.ZERO);

            if (suggestedOrder.compareTo(BigDecimal.ZERO) > 0 || sp.getCurrentStock().compareTo(sp.getSafetyStock()) < 0) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("sparePartId", sp.getId());
                item.put("partNo", sp.getPartNo());
                item.put("partName", sp.getPartName());
                item.put("currentStock", sp.getCurrentStock());
                item.put("safetyStock", sp.getSafetyStock());
                item.put("dailyAvgConsumption", dailyAvg);
                item.put("suggestedOrderQuantity", suggestedOrder);
                item.put("unit", sp.getUnit());
                suggestions.add(item);
            }
        }
        return suggestions;
    }

    // ── 领用记录 ──────────────────────────────────────────────────────────

    public List<SparePartUsage> getUsageByWorkOrder(Long workOrderId) {
        String tenantId = TenantContext.requireTenantId();
        return sparePartUsageMapper.selectList(
                new LambdaQueryWrapper<SparePartUsage>()
                        .eq(SparePartUsage::getWorkOrderId, workOrderId)
                        .eq(SparePartUsage::getTenantId, tenantId)
                        .orderByDesc(SparePartUsage::getUsageDate));
    }

    public List<SparePartUsage> getUsageBySparePart(Long sparePartId) {
        String tenantId = TenantContext.requireTenantId();
        return sparePartUsageMapper.selectList(
                new LambdaQueryWrapper<SparePartUsage>()
                        .eq(SparePartUsage::getSparePartId, sparePartId)
                        .eq(SparePartUsage::getTenantId, tenantId)
                        .orderByDesc(SparePartUsage::getUsageDate));
    }
}
