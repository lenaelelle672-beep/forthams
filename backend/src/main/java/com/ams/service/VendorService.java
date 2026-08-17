package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.Vendor;
import com.ams.mapper.VendorMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class VendorService {
    private static final String VENDOR_QUERY_PERMISSION = "vendor:vendor:query";

    private final VendorMapper vendorMapper;
    private final TenantAuthorityService tenantAuthorityService;

    public List<Vendor> list() {
        requireQueryPermission();
        return vendorMapper.selectList(new LambdaQueryWrapper<Vendor>());
    }

    public Vendor getVendorById(Long id) {
        requireQueryPermission();
        return getVendorEntityById(id);
    }

    private Vendor getVendorEntityById(Long id) {
        Vendor vendor = vendorMapper.selectById(id);
        if (vendor == null) {
            throw new BusinessException("供应商不存在");
        }
        return vendor;
    }

    @Transactional(rollbackFor = Exception.class)
    public Vendor createVendor(Vendor vendor) {
        tenantAuthorityService.requirePlatformAdmin();
        vendorMapper.insert(vendor);
        return vendor;
    }

    @Transactional(rollbackFor = Exception.class)
    public Vendor updateVendor(Long id, Vendor updatedVendor) {
        tenantAuthorityService.requirePlatformAdmin();
        updatedVendor.setId(id);
        vendorMapper.updateById(updatedVendor);
        return updatedVendor;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteVendor(Long id) {
        tenantAuthorityService.requirePlatformAdmin();
        getVendorEntityById(id);
        vendorMapper.deleteById(id);
    }

    private void requireQueryPermission() {
        TenantContext.requireTenantId();
        if (!hasPermission(VENDOR_QUERY_PERMISSION)) {
            throw new AccessDeniedException("缺少供应商查询权限");
        }
    }

    private boolean hasPermission(String permission) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.isAuthenticated()
                && authentication.getAuthorities().stream()
                .anyMatch(authority -> permission.equals(authority.getAuthority()));
    }
}
