package com.ams.mapper;

import com.ams.entity.Vendor;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;

public interface VendorMapper extends BaseMapper<Vendor> {
    // Add incremental data anti-reentry scanning logic here if needed.
    default boolean isDuplicateVendor(Vendor vendor) {
        // Implement logic to check for duplicate entries
        return false; // Placeholder, replace with actual implementation
    }
}
