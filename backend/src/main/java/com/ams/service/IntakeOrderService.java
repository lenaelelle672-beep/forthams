package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.AssetCreateDTO;
import com.ams.dto.IntakeOrderCreateDTO;
import com.ams.dto.IntakeOrderQueryDTO;
import com.ams.dto.IntakeOrderUpdateDTO;
import com.ams.entity.Asset;
import com.ams.entity.IntakeAsset;
import com.ams.entity.IntakeCheckItem;
import com.ams.entity.IntakeOrder;
import com.ams.enums.AssetStatus;
import com.ams.mapper.IntakeAssetMapper;
import com.ams.mapper.IntakeCheckItemMapper;
import com.ams.mapper.IntakeOrderMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 入库验收核心服务。
 * <p>CRUD + 验收流程（submit→inspect→accept→reject），accept 事务内创建 Asset。</p>
 */
@Service
@RequiredArgsConstructor
public class IntakeOrderService {

    private static final Logger log = LoggerFactory.getLogger(IntakeOrderService.class);

    private final IntakeOrderMapper intakeOrderMapper;
    private final IntakeCheckItemMapper intakeCheckItemMapper;
    private final IntakeAssetMapper intakeAssetMapper;
    private final AssetService assetService;

    // ── CRUD ─────────────────────────────────────────────────────────────────

    public Page<IntakeOrder> queryPage(IntakeOrderQueryDTO queryDTO) {
        String tenantId = TenantContext.requireTenantId();
        Page<IntakeOrder> page = new Page<>(queryDTO.getPage(), queryDTO.getPageSize());
        LambdaQueryWrapper<IntakeOrder> wrapper = new LambdaQueryWrapper<IntakeOrder>()
                .eq(IntakeOrder::getTenantId, tenantId);

        if (queryDTO.getKeyword() != null && !queryDTO.getKeyword().isBlank()) {
            wrapper.and(w -> w.like(IntakeOrder::getOrderNo, queryDTO.getKeyword()));
        }
        if (queryDTO.getOrderNo() != null && !queryDTO.getOrderNo().isBlank()) {
            wrapper.like(IntakeOrder::getOrderNo, queryDTO.getOrderNo());
        }
        if (queryDTO.getStatus() != null && !queryDTO.getStatus().isBlank()) {
            wrapper.eq(IntakeOrder::getStatus, queryDTO.getStatus());
        }
        if (queryDTO.getVendorId() != null) {
            wrapper.eq(IntakeOrder::getVendorId, queryDTO.getVendorId());
        }
        if (queryDTO.getStartDate() != null && !queryDTO.getStartDate().isBlank()) {
            wrapper.ge(IntakeOrder::getOrderDate, queryDTO.getStartDate());
        }
        if (queryDTO.getEndDate() != null && !queryDTO.getEndDate().isBlank()) {
            wrapper.le(IntakeOrder::getOrderDate, queryDTO.getEndDate());
        }
        wrapper.orderByDesc(IntakeOrder::getCreateTime);

        return intakeOrderMapper.selectPage(page, wrapper);
    }

    public IntakeOrder getDetail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        IntakeOrder order = intakeOrderMapper.selectOne(
                new LambdaQueryWrapper<IntakeOrder>()
                        .eq(IntakeOrder::getId, id)
                        .eq(IntakeOrder::getTenantId, tenantId));
        if (order == null) {
            throw new BusinessException("验收单不存在");
        }
        // 加载子列表
        order.setCheckItems(intakeCheckItemMapper.selectList(
                new LambdaQueryWrapper<IntakeCheckItem>()
                        .eq(IntakeCheckItem::getIntakeOrderId, id)
                        .orderByAsc(IntakeCheckItem::getSortOrder)));
        order.setIntakeAssets(intakeAssetMapper.selectList(
                new LambdaQueryWrapper<IntakeAsset>()
                        .eq(IntakeAsset::getIntakeOrderId, id)));
        return order;
    }

    @Transactional(rollbackFor = Exception.class)
    public IntakeOrder create(IntakeOrderCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();

        // 生成验收单号
        Long count = intakeOrderMapper.selectCount(
                new LambdaQueryWrapper<IntakeOrder>()
                        .eq(IntakeOrder::getTenantId, tenantId));
        String orderNo = "IO-" + LocalDate.now().getYear() + "-"
                + String.format("%04d", count.intValue() + 1);

        IntakeOrder order = new IntakeOrder();
        order.setOrderNo(orderNo);
        order.setVendorId(dto.getVendorId());
        order.setOrderDate(dto.getOrderDate() != null ? dto.getOrderDate() : LocalDate.now());
        order.setStatus("DRAFT");
        order.setTotalAmount(dto.getTotalAmount());
        order.setRemark(dto.getRemark());
        order.setTenantId(tenantId);
        intakeOrderMapper.insert(order);

        // 批量插入检查项
        if (dto.getCheckItems() != null && !dto.getCheckItems().isEmpty()) {
            int sort = 1;
            for (var itemDTO : dto.getCheckItems()) {
                IntakeCheckItem item = new IntakeCheckItem();
                item.setIntakeOrderId(order.getId());
                item.setItemName(itemDTO.getItemName());
                item.setExpectedValue(itemDTO.getExpectedValue());
                item.setResult("PENDING");
                item.setSortOrder(sort++);
                item.setTenantId(tenantId);
                intakeCheckItemMapper.insert(item);
            }
        }

        // 批量插入入库资产
        if (dto.getIntakeAssets() != null && !dto.getIntakeAssets().isEmpty()) {
            for (var assetDTO : dto.getIntakeAssets()) {
                IntakeAsset asset = new IntakeAsset();
                asset.setIntakeOrderId(order.getId());
                asset.setAssetNo(assetDTO.getAssetNo());
                asset.setAssetName(assetDTO.getAssetName());
                asset.setModel(assetDTO.getModel());
                asset.setBrand(assetDTO.getBrand());
                asset.setSerialNo(assetDTO.getSerialNo());
                asset.setSupplier(assetDTO.getSupplier());
                asset.setPurchaseDate(assetDTO.getPurchaseDate());
                asset.setOriginalValue(assetDTO.getOriginalValue());
                asset.setWarrantyPeriod(assetDTO.getWarrantyPeriod());
                asset.setCategoryId(assetDTO.getCategoryId());
                asset.setLocationId(assetDTO.getLocationId());
                asset.setRemark(assetDTO.getRemark());
                asset.setTenantId(tenantId);
                intakeAssetMapper.insert(asset);
            }
        }

        log.info("入库验收单已创建: id={}, orderNo={}", order.getId(), orderNo);
        return getDetail(order.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public IntakeOrder update(Long id, IntakeOrderUpdateDTO dto) {
        IntakeOrder order = getDetail(id);
        if (!"DRAFT".equals(order.getStatus())) {
            throw new BusinessException("只有草稿状态的验收单可以编辑");
        }
        if (dto.getRemark() != null) order.setRemark(dto.getRemark());
        if (dto.getOrderDate() != null) order.setOrderDate(dto.getOrderDate());
        if (dto.getTotalAmount() != null) order.setTotalAmount(dto.getTotalAmount());
        intakeOrderMapper.updateById(order);
        return getDetail(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        IntakeOrder order = getDetail(id);
        if (!"DRAFT".equals(order.getStatus())) {
            throw new BusinessException("只有草稿状态的验收单可以删除");
        }
        String tenantId = TenantContext.requireTenantId();
        // 级联删除子表（附加 tenantId 过滤，防止跨租户删除）
        intakeCheckItemMapper.delete(
                new LambdaQueryWrapper<IntakeCheckItem>()
                        .eq(IntakeCheckItem::getTenantId, tenantId)
                        .eq(IntakeCheckItem::getIntakeOrderId, id));
        intakeAssetMapper.delete(
                new LambdaQueryWrapper<IntakeAsset>()
                        .eq(IntakeAsset::getTenantId, tenantId)
                        .eq(IntakeAsset::getIntakeOrderId, id));
        intakeOrderMapper.deleteById(id);
        log.info("入库验收单已删除: id={}", id);
    }

    // ── 验收流程 ─────────────────────────────────────────────────────────────

    /**
     * 提交验收单（DRAFT → PENDING_INSPECT）。
     */
    @Transactional(rollbackFor = Exception.class)
    public IntakeOrder submit(Long id) {
        IntakeOrder order = getDetail(id);
        if (!"DRAFT".equals(order.getStatus())) {
            throw new BusinessException("只有草稿状态的验收单可以提交");
        }
        order.setStatus("PENDING_INSPECT");
        intakeOrderMapper.updateById(order);
        log.info("验收单已提交: id={}, orderNo={}", id, order.getOrderNo());
        return getDetail(id);
    }

    /**
     * 填写检查结果（批量更新检查项）。
     * 状态变为 INSPECTING。
     */
    @Transactional(rollbackFor = Exception.class)
    public IntakeOrder inspect(Long id, List<IntakeCheckItem> checkItems) {
        IntakeOrder order = getDetail(id);
        if (!"PENDING_INSPECT".equals(order.getStatus())
                && !"INSPECTING".equals(order.getStatus())) {
            throw new BusinessException("当前状态不允许质检");
        }

        if (checkItems != null) {
            for (IntakeCheckItem item : checkItems) {
                if (item.getId() == null) continue;
                IntakeCheckItem existing = intakeCheckItemMapper.selectById(item.getId());
                if (existing == null || !existing.getIntakeOrderId().equals(id)) {
                    continue;
                }
                if (item.getActualValue() != null) {
                    existing.setActualValue(item.getActualValue());
                }
                if (item.getResult() != null) {
                    existing.setResult(item.getResult());
                }
                if (item.getRemark() != null) {
                    existing.setRemark(item.getRemark());
                }
                intakeCheckItemMapper.updateById(existing);
            }
        }

        order.setStatus("INSPECTING");
        intakeOrderMapper.updateById(order);
        return getDetail(id);
    }

    /**
     * 验收通过（ACCEPT）— 事务内遍历 IntakeAsset 创建 Asset 卡片。
     * 前置条件：所有检查项必须为 PASS 或 PENDING。
     * 状态变为 ACCEPTED。
     */
    @Transactional(rollbackFor = Exception.class)
    public IntakeOrder accept(Long id) {
        IntakeOrder order = getDetail(id);
        if (!"INSPECTING".equals(order.getStatus())
                && !"PENDING_INSPECT".equals(order.getStatus())) {
            throw new BusinessException("当前状态不允许验收通过");
        }

        // 校验检查项：不允许 FAIL
        if (order.getCheckItems() != null) {
            boolean hasFail = order.getCheckItems().stream()
                    .anyMatch(item -> "FAIL".equals(item.getResult()));
            if (hasFail) {
                throw new BusinessException("存在检查未通过项，无法验收通过");
            }
        }

        // 遍历入库资产创建正式的 Asset 卡片
        acceptAssets(order.getIntakeAssets(), id);

        order.setStatus("ACCEPTED");
        intakeOrderMapper.updateById(order);
        log.info("验收单已通过: id={}, orderNo={}", id, order.getOrderNo());
        return getDetail(id);
    }

    /**
     * 部分验收（PARTIAL_ACCEPTED）— 只对选中的资产创建 Asset 卡片。
     * 前置条件：状态为 INSPECTING 或 PENDING_INSPECT。
     * 状态变为 PARTIAL_ACCEPTED。
     *
     * @param assetIds 要验收的 IntakeAsset ID 列表
     */
    @Transactional(rollbackFor = Exception.class)
    public IntakeOrder partialAccept(Long id, List<Long> assetIds) {
        IntakeOrder order = getDetail(id);
        if (!"INSPECTING".equals(order.getStatus())
                && !"PENDING_INSPECT".equals(order.getStatus())) {
            throw new BusinessException("当前状态不允许部分验收");
        }

        // 校验检查项：不允许 FAIL
        if (order.getCheckItems() != null) {
            boolean hasFail = order.getCheckItems().stream()
                    .anyMatch(item -> "FAIL".equals(item.getResult()));
            if (hasFail) {
                throw new BusinessException("存在检查未通过项，无法验收");
            }
        }

        // 只对选中的资产创建 Asset 卡片
        if (assetIds != null && !assetIds.isEmpty()
                && order.getIntakeAssets() != null) {
            List<IntakeAsset> selected = order.getIntakeAssets().stream()
                    .filter(a -> assetIds.contains(a.getId()))
                    .collect(java.util.stream.Collectors.toList());
            acceptAssets(selected, id);
        }

        order.setStatus("PARTIAL_ACCEPTED");
        intakeOrderMapper.updateById(order);
        log.info("验收单已部分验收: id={}, orderNo={}", id, order.getOrderNo());
        return getDetail(id);
    }

    /**
     * 将 IntakeAsset 列表转换为 Asset 卡片写入 asset 表。
     */
    private void acceptAssets(List<IntakeAsset> assets, Long orderId) {
        if (assets == null || assets.isEmpty()) return;
        for (IntakeAsset intakeAsset : assets) {
            AssetCreateDTO createDTO = new AssetCreateDTO();
            createDTO.setAssetNo(intakeAsset.getAssetNo());
            createDTO.setAssetName(intakeAsset.getAssetName());
            createDTO.setModel(intakeAsset.getModel());
            createDTO.setBrand(intakeAsset.getBrand());
            createDTO.setSerialNo(intakeAsset.getSerialNo());
            createDTO.setSupplier(intakeAsset.getSupplier());
            createDTO.setPurchaseDate(intakeAsset.getPurchaseDate());
            createDTO.setOriginalValue(intakeAsset.getOriginalValue());
            createDTO.setWarrantyPeriod(intakeAsset.getWarrantyPeriod());
            createDTO.setCategoryId(intakeAsset.getCategoryId());
            createDTO.setLocationId(intakeAsset.getLocationId());
            createDTO.setRemark(intakeAsset.getRemark());
            createDTO.setStatus(AssetStatus.IDLE.name());

            Asset asset = assetService.createAsset(createDTO);
            log.info("验收通过创建资产: assetId={}, assetName={}, intakeOrderId={}",
                    asset.getId(), asset.getAssetName(), orderId);
        }
    }

    /**
     * 驳回验收单（REJECT）。
     */
    @Transactional(rollbackFor = Exception.class)
    public IntakeOrder reject(Long id, String reason) {
        IntakeOrder order = getDetail(id);
        if ("ACCEPTED".equals(order.getStatus())
                || "REJECTED".equals(order.getStatus())
                || "CANCELLED".equals(order.getStatus())) {
            throw new BusinessException("当前状态不允许驳回");
        }
        order.setStatus("REJECTED");
        order.setRejectReason(reason);
        intakeOrderMapper.updateById(order);
        log.info("验收单已驳回: id={}, orderNo={}, reason={}", id, order.getOrderNo(), reason);
        return getDetail(id);
    }

    /**
     * 取消验收单。
     */
    @Transactional(rollbackFor = Exception.class)
    public IntakeOrder cancel(Long id) {
        IntakeOrder order = getDetail(id);
        if ("ACCEPTED".equals(order.getStatus())
                || "REJECTED".equals(order.getStatus())) {
            throw new BusinessException("已终态的验收单无法取消");
        }
        order.setStatus("CANCELLED");
        intakeOrderMapper.updateById(order);
        return getDetail(id);
    }
}
