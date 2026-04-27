package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.dto.IdleAssetCreateDTO;
import com.ams.entity.IdleAssetNotice;
import com.ams.mapper.IdleAssetNoticeMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class IdleAssetService {

    private final IdleAssetNoticeMapper idleAssetNoticeMapper;

    public Page<IdleAssetNotice> queryIdleAssets(Integer page, Integer pageSize, String status) {
        Page<IdleAssetNotice> pageParam = new Page<>(page, pageSize);
        QueryWrapper<IdleAssetNotice> wrapper = new QueryWrapper<>();

        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        wrapper.orderByDesc("create_time");

        return idleAssetNoticeMapper.selectPage(pageParam, wrapper);
    }

    public IdleAssetNotice getById(Long id) {
        IdleAssetNotice notice = idleAssetNoticeMapper.selectById(id);
        if (notice == null) {
            throw new BusinessException("闲置资产公告不存在");
        }
        return notice;
    }

    @Transactional(rollbackFor = Exception.class)
    public IdleAssetNotice publishNotice(IdleAssetCreateDTO dto) {
        IdleAssetNotice notice = new IdleAssetNotice();
        BeanUtil.copyProperties(dto, notice);
        BeanUtil.setProperty(notice, "status", "PUBLISHED");
        BeanUtil.setProperty(notice, "noticeDate", LocalDate.now());
        if (notice.getAssetId() == null && dto.getAssetId() != null) notice.setAssetId(dto.getAssetId());
        if (notice.getAssetId() == null) notice.setAssetId(0L);
        idleAssetNoticeMapper.insert(notice);
        return notice;
    }

    @Transactional(rollbackFor = Exception.class)
    public IdleAssetNotice claimAsset(Long id, Long claimantId) {
        IdleAssetNotice notice = getById(id);
        if (!"PUBLISHED".equals(BeanUtil.getProperty(notice, "status"))) {
            throw new BusinessException("仅已发布状态可认领");
        }
        BeanUtil.setProperty(notice, "claimantId", claimantId);
        BeanUtil.setProperty(notice, "status", "CLAIMED");
        BeanUtil.setProperty(notice, "claimDate", LocalDate.now());
        idleAssetNoticeMapper.updateById(notice);
        return notice;
    }

    @Transactional(rollbackFor = Exception.class)
    public IdleAssetNotice cancelNotice(Long id) {
        IdleAssetNotice notice = getById(id);
        BeanUtil.setProperty(notice, "status", "CANCELLED");
        idleAssetNoticeMapper.updateById(notice);
        return notice;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteNotice(Long id) {
        getById(id);
        idleAssetNoticeMapper.deleteById(id);
    }
}
