package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.MaintenanceCreateDTO;
import com.ams.dto.MaintenanceUpdateDTO;
import com.ams.entity.MaintenanceRecord;
import com.ams.mapper.MaintenanceRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import com.ams.annotation.DataScope;
@Service
@RequiredArgsConstructor
public class MaintenanceService {

    private final MaintenanceRecordMapper maintenanceRecordMapper;

    @DataScope(userColumn = "create_by")
    public Page<MaintenanceRecord> queryRecords(Integer page, Integer pageSize, Long assetId, String maintenanceType) {
        String tenantId = TenantContext.requireTenantId();
        Page<MaintenanceRecord> pageParam = new Page<>(page == null ? 1 : page, pageSize == null ? 10 : pageSize);

        LambdaQueryWrapper<MaintenanceRecord> wrapper = new LambdaQueryWrapper<MaintenanceRecord>()
                .eq(MaintenanceRecord::getTenantId, tenantId);
        if (assetId != null) {
            wrapper.eq(MaintenanceRecord::getAssetId, assetId);
        }
        if (maintenanceType != null && !maintenanceType.isEmpty()) {
            wrapper.eq(MaintenanceRecord::getMaintenanceType, maintenanceType);
        }
        wrapper.orderByDesc(MaintenanceRecord::getMaintenanceDate).orderByDesc(MaintenanceRecord::getCreateTime);

        return maintenanceRecordMapper.selectPage(pageParam, wrapper);
    }

    public MaintenanceRecord getRecordById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        MaintenanceRecord record = maintenanceRecordMapper.selectOne(new LambdaQueryWrapper<MaintenanceRecord>()
                .eq(MaintenanceRecord::getId, id)
                .eq(MaintenanceRecord::getTenantId, tenantId));
        if (record == null) {
            throw new BusinessException("维护记录不存在");
        }
        return record;
    }

    @Transactional(rollbackFor = Exception.class)
    public MaintenanceRecord createRecord(MaintenanceCreateDTO createDTO) {
        String tenantId = TenantContext.requireTenantId();
        MaintenanceRecord record = new MaintenanceRecord();
        BeanUtil.copyProperties(createDTO, record);
        record.setTenantId(tenantId);
        if (record.getAssetId() == null) record.setAssetId(0L);
        if (record.getContent() == null) record.setContent("");
        if (record.getMaintenanceDate() == null) record.setMaintenanceDate(java.time.LocalDate.now());
        if (record.getSourceType() == null) record.setSourceType("MANUAL");
        maintenanceRecordMapper.insert(record);
        return record;
    }

    @Transactional(rollbackFor = Exception.class)
    public MaintenanceRecord updateRecord(Long id, MaintenanceUpdateDTO updateDTO) {
        MaintenanceRecord record = getRecordById(id);
        BeanUtil.copyProperties(updateDTO, record, "id", "createBy", "createTime");
        maintenanceRecordMapper.updateById(record);
        return record;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteRecord(Long id) {
        getRecordById(id);
        maintenanceRecordMapper.deleteById(id);
    }

    /**
     * 为维保记录关联工单。
     *
     * @param id 维保记录ID
     * @param workOrderId 工单ID
     */
    @Transactional(rollbackFor = Exception.class)
    public void linkWorkOrder(Long id, Long workOrderId) {
        MaintenanceRecord record = getRecordById(id);
        record.setWorkOrderId(workOrderId);
        maintenanceRecordMapper.updateById(record);
    }

    public List<MaintenanceRecord> getUpcomingMaintenance(Integer days) {
        int range = days == null || days < 0 ? 30 : days;
        LocalDate start = LocalDate.now();
        LocalDate end = start.plusDays(range);

        String tenantId = TenantContext.requireTenantId();
        LambdaQueryWrapper<MaintenanceRecord> wrapper = new LambdaQueryWrapper<MaintenanceRecord>()
            .eq(MaintenanceRecord::getTenantId, tenantId);
        wrapper.between(MaintenanceRecord::getNextMaintenanceDate, start, end)
            .orderByAsc(MaintenanceRecord::getNextMaintenanceDate);

        return maintenanceRecordMapper.selectList(wrapper);
    }
}
