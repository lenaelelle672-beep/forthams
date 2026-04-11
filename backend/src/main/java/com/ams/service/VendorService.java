package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.entity.Vendor;
import com.ams.mapper.VendorMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VendorService {

    private final VendorMapper vendorMapper;

    public Vendor getVendorById(Long id) {
        Vendor vendor = vendorMapper.selectById(id);
        if (vendor == null) {
            throw new BusinessException("供应商不存在");
        }
        return vendor;
    }

    @Transactional(rollbackFor = Exception.class)
    public Vendor createVendor(Vendor vendor) {
        vendorMapper.insert(vendor);
        return vendor;
    }

    @Transactional(rollbackFor = Exception.class)
    public Vendor updateVendor(Long id, Vendor updatedVendor) {
        Vendor existingVendor = getVendorById(id);
        BeanUtil.copyProperties(updatedVendor, existingVendor, "id");
        vendorMapper.updateById(existingVendor);
        return existingVendor;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteVendor(Long id) {
        getVendorById(id);
        vendorMapper.deleteById(id);
    }
}
