package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.AssetBorrowCreateDTO;
import com.ams.dto.AssetBorrowQueryDTO;
import com.ams.dto.AssetBorrowUpdateDTO;
import com.ams.entity.Asset;
import com.ams.entity.AssetBorrow;
import com.ams.entity.NotificationRecord;
import com.ams.enums.AssetStatus;
import com.ams.mapper.AssetBorrowMapper;
import com.ams.mapper.AssetMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * 借用管理核心服务。
 * <p>CRUD + 审批流转 + @Scheduled 到期提醒。
 * 状态流转: DRAFT→PENDING_APPROVAL→APPROVED→BORROWED→OVERDUE(自动)→RETURNED。</p>
 */
@Service
@RequiredArgsConstructor
public class AssetBorrowService {

    private static final Logger log = LoggerFactory.getLogger(AssetBorrowService.class);

    private final AssetBorrowMapper borrowMapper;
    private final AssetMapper assetMapper;
    private final TenantService tenantService;
    private final NotificationService notificationService;

    // ── CRUD ─────────────────────────────────────────────────────────────────

    public Page<AssetBorrow> queryPage(AssetBorrowQueryDTO queryDTO) {
        String tenantId = TenantContext.requireTenantId();
        Page<AssetBorrow> page = new Page<>(queryDTO.getPage(), queryDTO.getPageSize());
        LambdaQueryWrapper<AssetBorrow> wrapper = new LambdaQueryWrapper<AssetBorrow>()
                .eq(AssetBorrow::getTenantId, tenantId);

        if (queryDTO.getKeyword() != null && !queryDTO.getKeyword().isBlank()) {
            wrapper.and(w -> w.like(AssetBorrow::getPurpose, queryDTO.getKeyword())
                    .or().like(AssetBorrow::getRemark, queryDTO.getKeyword()));
        }
        if (queryDTO.getAssetId() != null) {
            wrapper.eq(AssetBorrow::getAssetId, queryDTO.getAssetId());
        }
        if (queryDTO.getStatus() != null && !queryDTO.getStatus().isBlank()) {
            wrapper.eq(AssetBorrow::getStatus, queryDTO.getStatus());
        }
        wrapper.orderByDesc(AssetBorrow::getCreateTime);

        Page<AssetBorrow> result = borrowMapper.selectPage(page, wrapper);
        result.getRecords().forEach(this::attachAssetInfo);
        return result;
    }

    public AssetBorrow getDetail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        AssetBorrow borrow = borrowMapper.selectOne(
                new LambdaQueryWrapper<AssetBorrow>()
                        .eq(AssetBorrow::getId, id)
                        .eq(AssetBorrow::getTenantId, tenantId));
        if (borrow == null) {
            throw new BusinessException("借用单不存在");
        }
        attachAssetInfo(borrow);
        return borrow;
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetBorrow create(AssetBorrowCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();

        Asset asset = assetMapper.selectById(dto.getAssetId());
        if (asset == null) {
            throw new BusinessException("资产不存在");
        }

        AssetBorrow borrow = new AssetBorrow();
        borrow.setAssetId(dto.getAssetId());
        borrow.setBorrowDate(LocalDate.now());
        borrow.setExpectedReturnDate(dto.getExpectedReturnDate());
        borrow.setPurpose(dto.getPurpose());
        borrow.setRemark(dto.getRemark());
        borrow.setStatus("DRAFT");
        borrow.setNotified(0);
        borrow.setTenantId(tenantId);
        borrowMapper.insert(borrow);

        log.info("借用单已创建: id={}, assetId={}", borrow.getId(), dto.getAssetId());
        return getDetail(borrow.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetBorrow update(Long id, AssetBorrowUpdateDTO dto) {
        AssetBorrow borrow = getDetail(id);
        if (!"DRAFT".equals(borrow.getStatus())) {
            throw new BusinessException("只有草稿状态的借用单可以编辑");
        }
        if (dto.getExpectedReturnDate() != null) borrow.setExpectedReturnDate(dto.getExpectedReturnDate());
        if (dto.getPurpose() != null) borrow.setPurpose(dto.getPurpose());
        if (dto.getRemark() != null) borrow.setRemark(dto.getRemark());
        borrowMapper.updateById(borrow);
        return getDetail(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        AssetBorrow borrow = getDetail(id);
        if (!"DRAFT".equals(borrow.getStatus())) {
            throw new BusinessException("只有草稿状态的借用单可以删除");
        }
        borrowMapper.deleteById(id);
    }

    // ── 状态流转 ─────────────────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public AssetBorrow submit(Long id) {
        AssetBorrow borrow = getDetail(id);
        if (!"DRAFT".equals(borrow.getStatus())) {
            throw new BusinessException("只有草稿状态的借用单可以提交");
        }
        borrow.setStatus("PENDING_APPROVAL");
        borrowMapper.updateById(borrow);
        return getDetail(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetBorrow approve(Long id) {
        AssetBorrow borrow = getDetail(id);
        if (!"PENDING_APPROVAL".equals(borrow.getStatus())) {
            throw new BusinessException("只有待审批状态的借用单可以审批通过");
        }
        borrow.setStatus("APPROVED");
        borrowMapper.updateById(borrow);
        return getDetail(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetBorrow reject(Long id, String reason) {
        AssetBorrow borrow = getDetail(id);
        if (!"PENDING_APPROVAL".equals(borrow.getStatus())) {
            throw new BusinessException("只有待审批状态的借用单可以驳回");
        }
        borrow.setStatus("REJECTED");
        if (reason != null) borrow.setRemark(reason);
        borrowMapper.updateById(borrow);
        return getDetail(id);
    }

    /**
     * 借出（APPROVED → BORROWED），更新 Asset.status=IN_USE。
     */
    @Transactional(rollbackFor = Exception.class)
    public AssetBorrow borrow(Long id) {
        AssetBorrow borrow = getDetail(id);
        if (!"APPROVED".equals(borrow.getStatus())) {
            throw new BusinessException("只有已审批的借用单可以借出");
        }

        Asset asset = assetMapper.selectById(borrow.getAssetId());
        if (asset != null) {
            asset.setStatus(AssetStatus.IN_USE.name());
            assetMapper.updateById(asset);
        }

        borrow.setStatus("BORROWED");
        borrow.setBorrowDate(LocalDate.now());
        borrowMapper.updateById(borrow);
        log.info("资产已借出: borrowId={}, assetId={}", id, borrow.getAssetId());
        return getDetail(id);
    }

    /**
     * 归还（BORROWED/OVERDUE → RETURNED），更新 Asset.status=IDLE。
     */
    @Transactional(rollbackFor = Exception.class)
    public AssetBorrow returnAsset(Long id, String remark) {
        AssetBorrow borrow = getDetail(id);
        if (!"BORROWED".equals(borrow.getStatus()) && !"OVERDUE".equals(borrow.getStatus())) {
            throw new BusinessException("当前状态不允许归还");
        }

        Asset asset = assetMapper.selectById(borrow.getAssetId());
        if (asset != null) {
            asset.setStatus(AssetStatus.IDLE.name());
            assetMapper.updateById(asset);
        }

        borrow.setStatus("RETURNED");
        borrow.setActualReturnDate(LocalDate.now());
        if (remark != null) borrow.setRemark(remark);
        borrowMapper.updateById(borrow);
        log.info("资产已归还: borrowId={}, assetId={}", id, borrow.getAssetId());
        return getDetail(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetBorrow cancel(Long id) {
        AssetBorrow borrow = getDetail(id);
        if ("BORROWED".equals(borrow.getStatus())
                || "OVERDUE".equals(borrow.getStatus())
                || "RETURNED".equals(borrow.getStatus())) {
            throw new BusinessException("已借出或已归还的借用单无法取消");
        }
        borrow.setStatus("CANCELLED");
        borrowMapper.updateById(borrow);
        return getDetail(id);
    }

    // ── @Scheduled 到期提醒 ────────────────────────────────────────────────

    /**
     * 每天 8:00 检查到期借用记录。
     * 查询所有 BORROWED 且 expected_return_date < today 的记录，
     * 标记为 OVERDUE 并设置 notified=1。
     */
    @Scheduled(cron = "0 0 8 * * ?")
    @Transactional(rollbackFor = Exception.class)
    public void checkOverdue() {
        LocalDate today = LocalDate.now();
        int totalCount = 0;

        for (String tenantId : tenantService.getActiveTenantIds()) {
            try {
                TenantContext.setTenantId(tenantId);
                List<AssetBorrow> overdueList = borrowMapper.selectList(
                        new LambdaQueryWrapper<AssetBorrow>()
                                .eq(AssetBorrow::getTenantId, tenantId)
                                .eq(AssetBorrow::getStatus, "BORROWED")
                                .lt(AssetBorrow::getExpectedReturnDate, today));

                int count = 0;
                for (AssetBorrow borrow : overdueList) {
                    borrow.setStatus("OVERDUE");
                    borrow.setNotified(1);
                    borrowMapper.updateById(borrow);
                    count++;
                    log.warn("借用到期标记 OVERDUE: tenantId={}, borrowId={}, assetId={}, expectedReturnDate={}",
                            tenantId, borrow.getId(), borrow.getAssetId(), borrow.getExpectedReturnDate());
                    sendOverdueNotification(borrow);
                }

                if (count > 0) {
                    log.info("租户 {} 借用到期提醒完成: 本次标记 {} 条记录为 OVERDUE", tenantId, count);
                    totalCount += count;
                }
            } catch (RuntimeException e) {
                log.error("租户 {} 借用到期提醒失败: {}", tenantId, e.getMessage(), e);
            } finally {
                TenantContext.clear();
            }
        }

        if (totalCount > 0) {
            log.info("借用到期提醒完成: 本次共标记 {} 条记录为 OVERDUE", totalCount);
        }
    }

    // ── 辅助方法 ─────────────────────────────────────────────────────────────

    private void attachAssetInfo(AssetBorrow borrow) {
        if (borrow.getAssetId() != null) {
            Asset asset = assetMapper.selectById(borrow.getAssetId());
            if (asset != null) {
                borrow.setAssetNo(asset.getAssetNo());
                borrow.setAssetName(asset.getAssetName());
            }
        }
    }

    private void sendOverdueNotification(AssetBorrow borrow) {
        if (borrow.getBorrowerId() == null || borrow.getBorrowerId() <= 0) {
            log.debug("借用逾期通知跳过: borrowId={}, borrowerId为空", borrow.getId());
            return;
        }

        try {
            Asset asset = borrow.getAssetId() == null ? null : assetMapper.selectById(borrow.getAssetId());
            String assetLabel = asset == null
                    ? "资产ID " + borrow.getAssetId()
                    : asset.getAssetName() + "（" + asset.getAssetNo() + "）";

            NotificationRecord notification = new NotificationRecord();
            notification.setUserId(borrow.getBorrowerId());
            notification.setTitle("资产借用已逾期");
            notification.setContent("您借用的" + assetLabel + "已超过预计归还日期 "
                    + borrow.getExpectedReturnDate() + "，请尽快归还或联系资产管理员。");
            notification.setType("ASSET_BORROW");
            notification.setCategory("OPERATION");
            notification.setRefId(borrow.getId());
            notification.setRefType("ASSET_BORROW");
            notificationService.create(notification);
        } catch (RuntimeException e) {
            log.warn("借用逾期通知发送失败: borrowId={}, borrowerId={}, error={}",
                    borrow.getId(), borrow.getBorrowerId(), e.getMessage());
        }
    }
}
