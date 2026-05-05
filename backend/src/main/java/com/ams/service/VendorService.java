package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.Vendor;
import com.ams.mapper.VendorMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class VendorService {
    private final VendorMapper vendorMapper;

    public List<Vendor> list() {
        return vendorMapper.selectList(new LambdaQueryWrapper<Vendor>());
    }

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
        updatedVendor.setId(id);
        vendorMapper.updateById(updatedVendor);
        return updatedVendor;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteVendor(Long id) {
        getVendorById(id);
        vendorMapper.deleteById(id);
    }
}
