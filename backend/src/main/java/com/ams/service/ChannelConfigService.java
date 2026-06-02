package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.ChannelConfig;
import com.ams.mapper.ChannelConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ChannelConfigService {

    private final ChannelConfigMapper channelConfigMapper;

    public Page<ChannelConfig> queryPage(Integer page, Integer pageSize, String channelType, String keyword) {
        Page<ChannelConfig> pageParam = new Page<>(page, pageSize);
        LambdaQueryWrapper<ChannelConfig> wrapper = new LambdaQueryWrapper<>();
        if (channelType != null && !channelType.isBlank()) {
            wrapper.eq(ChannelConfig::getChannelType, channelType);
        }
        if (keyword != null && !keyword.isBlank()) {
            wrapper.like(ChannelConfig::getConfigName, keyword);
        }
        wrapper.orderByDesc(ChannelConfig::getCreatedAt);
        return channelConfigMapper.selectPage(pageParam, wrapper);
    }

    public ChannelConfig getById(Long id) {
        ChannelConfig config = channelConfigMapper.selectById(id);
        if (config == null) {
            throw new BusinessException("渠道配置不存在");
        }
        return config;
    }

    public List<ChannelConfig> getByType(String channelType) {
        return channelConfigMapper.selectList(new LambdaQueryWrapper<ChannelConfig>()
                .eq(ChannelConfig::getChannelType, channelType)
                .eq(ChannelConfig::getEnabled, 1));
    }

    @Transactional(rollbackFor = Exception.class)
    public ChannelConfig create(ChannelConfig config) {
        channelConfigMapper.insert(config);
        return config;
    }

    @Transactional(rollbackFor = Exception.class)
    public ChannelConfig update(Long id, ChannelConfig config) {
        ChannelConfig existing = getById(id);
        config.setId(id);
        config.setCreatedAt(existing.getCreatedAt());
        channelConfigMapper.updateById(config);
        return channelConfigMapper.selectById(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        ChannelConfig config = getById(id);
        channelConfigMapper.deleteById(config.getId());
    }
}
