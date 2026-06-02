package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.OAuthConfig;
import com.ams.mapper.OAuthConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OAuthConfigService {

    private final OAuthConfigMapper oauthConfigMapper;

    public List<OAuthConfig> listAll() {
        return oauthConfigMapper.selectList(new LambdaQueryWrapper<OAuthConfig>()
                .orderByAsc(OAuthConfig::getProvider));
    }

    public List<OAuthConfig> getEnabled() {
        return oauthConfigMapper.selectList(new LambdaQueryWrapper<OAuthConfig>()
                .eq(OAuthConfig::getEnabled, 1));
    }

    public OAuthConfig getByProvider(String provider) {
        return oauthConfigMapper.selectOne(new LambdaQueryWrapper<OAuthConfig>()
                .eq(OAuthConfig::getProvider, provider)
                .eq(OAuthConfig::getEnabled, 1));
    }

    public OAuthConfig getById(Long id) {
        OAuthConfig config = oauthConfigMapper.selectById(id);
        if (config == null) throw new BusinessException("OAuth配置不存在");
        return config;
    }

    @Transactional(rollbackFor = Exception.class)
    public OAuthConfig create(OAuthConfig config) {
        if (config.getEnabled() == null) config.setEnabled(1);
        oauthConfigMapper.insert(config);
        return config;
    }

    @Transactional(rollbackFor = Exception.class)
    public OAuthConfig update(Long id, OAuthConfig config) {
        getById(id);
        config.setId(id);
        oauthConfigMapper.updateById(config);
        return oauthConfigMapper.selectById(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        getById(id);
        oauthConfigMapper.deleteById(id);
    }
}
