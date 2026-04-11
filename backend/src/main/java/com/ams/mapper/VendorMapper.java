package com.ams.mapper;

import com.ams.entity.Vendor;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;

public interface VendorMapper extends BaseMapper<Vendor> {
    default boolean isDuplicateVendor(Vendor vendor) {
        // Implement logic to check for duplicate entries based on name and contactInfo
        return selectList(wr -> wr.eq("name", vendor.getName()).eq("contactInfo", vendor.getContactInfo())).size() > 0;
    }
}
