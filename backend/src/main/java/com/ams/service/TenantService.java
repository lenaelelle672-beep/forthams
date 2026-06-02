package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.SysTenant;
import com.ams.mapper.SysTenantMapper;
import com.ams.mapper.UserMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TenantService {

    private final SysTenantMapper sysTenantMapper;
    private final UserMapper userMapper;

    public Page<SysTenant> listTenants(Integer page, Integer pageSize, String keyword) {
        LambdaQueryWrapper<SysTenant> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            wrapper.like(SysTenant::getName, keyword).or().like(SysTenant::getId, keyword);
        }
        wrapper.orderByDesc(SysTenant::getCreatedAt);
        return sysTenantMapper.selectPage(new Page<>(page, pageSize), wrapper);
    }

    public SysTenant getTenant(String id) {
        SysTenant tenant = sysTenantMapper.selectById(id);
        if (tenant == null) throw new BusinessException("租户不存在");
        return tenant;
    }

    @Transactional(rollbackFor = Exception.class)
    public SysTenant createTenant(SysTenant tenant) {
        if (tenant.getStatus() == null) tenant.setStatus("ACTIVE");
        if (tenant.getPlan() == null) tenant.setPlan("FREE");
        sysTenantMapper.insert(tenant);
        return tenant;
    }

    @Transactional(rollbackFor = Exception.class)
    public SysTenant updateTenant(String id, SysTenant tenant) {
        getTenant(id);
        tenant.setId(id);
        sysTenantMapper.updateById(tenant);
        return sysTenantMapper.selectById(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void suspendTenant(String id) {
        SysTenant tenant = getTenant(id);
        tenant.setStatus("SUSPENDED");
        sysTenantMapper.updateById(tenant);
    }

    @Transactional(rollbackFor = Exception.class)
    public void activateTenant(String id) {
        SysTenant tenant = getTenant(id);
        tenant.setStatus("ACTIVE");
        sysTenantMapper.updateById(tenant);
    }

    public Map<String, Object> getQuotaUsage(String tenantId) {
        SysTenant tenant = getTenant(tenantId);
        Long userCount = userMapper.selectCount(null);
        Map<String, Object> result = new HashMap<>();
        result.put("tenant", tenant);
        result.put("currentUsers", userCount);
        result.put("maxUsers", tenant.getMaxUsers());
        result.put("userUsagePercent", tenant.getMaxUsers() > 0 ?
                Math.round(userCount * 100.0 / tenant.getMaxUsers()) : 0);
        return result;
    }
}
