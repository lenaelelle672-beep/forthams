package com.ams.mapper;

import com.ams.entity.Vendor;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;

public interface VendorMapper extends BaseMapper<Vendor> {
    default boolean isDuplicateVendor(Vendor vendor) {
        // Implement logic to check for duplicate entries based on name and contactInfo
        return false; // Placeholder, replace with actual implementation
    }
}
