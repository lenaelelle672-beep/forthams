package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.InventoryScanDTO;
import com.ams.dto.InventoryTaskCreateDTO;
import com.ams.entity.InventoryDetail;
import com.ams.entity.InventoryTask;
import com.ams.mapper.InventoryDetailMapper;
import com.ams.mapper.InventoryTaskMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.ams.annotation.DataScope;
@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryTaskMapper inventoryTaskMapper;
    private final InventoryDetailMapper inventoryDetailMapper;

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
}
