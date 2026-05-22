package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.VendorCreateDTO;
import com.ams.dto.VendorUpdateDTO;
import com.ams.entity.Vendor;
import com.ams.mapper.VendorMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
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

    public Page<Vendor> listPage(int page, int size) {
        return vendorMapper.selectPage(new Page<>(page, size), new LambdaQueryWrapper<>());
    }

    public Vendor getVendorById(Long id) {
        Vendor vendor = vendorMapper.selectById(id);
        if (vendor == null) {
            throw new BusinessException("供应商不存在");
        }
        return vendor;
    }

    @Transactional(rollbackFor = Exception.class)
    public Vendor createVendor(VendorCreateDTO dto) {
        Vendor vendor = new Vendor();
        vendor.setName(dto.getName());
        vendor.setVendorCode(dto.getVendorCode());
        vendor.setContactPerson(dto.getContactPerson());
        vendor.setContactPhone(dto.getContactPhone());
        vendor.setContactEmail(dto.getContactEmail());
        vendor.setAddress(dto.getAddress());
        vendor.setStatus(1);
        vendorMapper.insert(vendor);
        return vendor;
    }

    @Transactional(rollbackFor = Exception.class)
    public Vendor updateVendor(Long id, VendorUpdateDTO dto) {
        Vendor existing = getVendorById(id);
        if (dto.getName() != null) existing.setName(dto.getName());
        if (dto.getVendorCode() != null) existing.setVendorCode(dto.getVendorCode());
        if (dto.getContactPerson() != null) existing.setContactPerson(dto.getContactPerson());
        if (dto.getContactPhone() != null) existing.setContactPhone(dto.getContactPhone());
        if (dto.getContactEmail() != null) existing.setContactEmail(dto.getContactEmail());
        if (dto.getAddress() != null) existing.setAddress(dto.getAddress());
        vendorMapper.updateById(existing);
        return existing;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteVendor(Long id) {
        getVendorById(id);
        vendorMapper.deleteById(id);
    }
}
