package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.dto.CompensationCreateDTO;
import com.ams.dto.CompensationUpdateDTO;
import com.ams.entity.AssetCompensation;
import com.ams.mapper.AssetCompensationMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class CompensationService {

    private final AssetCompensationMapper assetCompensationMapper;

    public Page<AssetCompensation> queryCompensations(Integer page, Integer pageSize, String status, Long assetId) {
        Page<AssetCompensation> pageParam = new Page<>(page, pageSize);
        QueryWrapper<AssetCompensation> wrapper = new QueryWrapper<>();

        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        if (assetId != null) {
            wrapper.eq("asset_id", assetId);
        }
        wrapper.orderByDesc("create_time");

        return assetCompensationMapper.selectPage(pageParam, wrapper);
    }

    public AssetCompensation getById(Long id) {
        AssetCompensation compensation = assetCompensationMapper.selectById(id);
        if (compensation == null) {
            throw new BusinessException("赔偿记录不存在");
        }
        return compensation;
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetCompensation createCompensation(CompensationCreateDTO dto) {
        AssetCompensation compensation = new AssetCompensation();
        BeanUtil.copyProperties(dto, compensation);
        BeanUtil.setProperty(compensation, "compensationNo", generateCompensationNo());
        BeanUtil.setProperty(compensation, "status", "PENDING");

        if (compensation.getResponsibleUserId() == null) compensation.setResponsibleUserId(1L);
        if (compensation.getAssetId() == null) compensation.setAssetId(0L);
        assetCompensationMapper.insert(compensation);
        return compensation;
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetCompensation updateCompensation(Long id, CompensationUpdateDTO dto) {
        AssetCompensation compensation = getById(id);
        BeanUtil.copyProperties(dto, compensation, "id", "compensationNo", "status", "createBy", "createTime");
        assetCompensationMapper.updateById(compensation);
        return compensation;
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetCompensation updateStatus(Long id, String status) {
        AssetCompensation compensation = getById(id);
        BeanUtil.setProperty(compensation, "status", status);
        assetCompensationMapper.updateById(compensation);
        return compensation;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteCompensation(Long id) {
        getById(id);
        assetCompensationMapper.deleteById(id);
    }

    private String generateCompensationNo() {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "CMP-" + dateStr + "-";

        Long count = assetCompensationMapper.selectCount(
            new QueryWrapper<AssetCompensation>()
                .likeRight("compensation_no", prefix)
        );
        long sequence = (count == null ? 0 : count) + 1;
        return prefix + String.format("%03d", sequence);
    }
}
