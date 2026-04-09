package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
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

@Service
@RequiredArgsConstructor
public class MaintenanceService {

    private final MaintenanceRecordMapper maintenanceRecordMapper;

    public Page<MaintenanceRecord> queryRecords(Integer page, Integer pageSize, Long assetId, String maintenanceType) {
        Page<MaintenanceRecord> pageParam = new Page<>(page == null ? 1 : page, pageSize == null ? 10 : pageSize);

        LambdaQueryWrapper<MaintenanceRecord> wrapper = new LambdaQueryWrapper<>();
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
        MaintenanceRecord record = maintenanceRecordMapper.selectById(id);
        if (record == null) {
            throw new BusinessException("维护记录不存在");
        }
        return record;
    }

    @Transactional(rollbackFor = Exception.class)
    public MaintenanceRecord createRecord(MaintenanceCreateDTO createDTO) {
        MaintenanceRecord record = new MaintenanceRecord();
        BeanUtil.copyProperties(createDTO, record);
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

    public List<MaintenanceRecord> getUpcomingMaintenance(Integer days) {
        int range = days == null || days < 0 ? 30 : days;
        LocalDate start = LocalDate.now();
        LocalDate end = start.plusDays(range);

        LambdaQueryWrapper<MaintenanceRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.between(MaintenanceRecord::getNextMaintenanceDate, start, end)
            .orderByAsc(MaintenanceRecord::getNextMaintenanceDate);

        return maintenanceRecordMapper.selectList(wrapper);
    }
}
