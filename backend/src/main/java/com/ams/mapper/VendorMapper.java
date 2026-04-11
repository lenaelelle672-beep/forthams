package com.ams.mapper;

import com.ams.entity.Vendor;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Select;

public interface VendorMapper extends BaseMapper<Vendor> {
    @Select("SELECT COUNT(*) FROM vendor WHERE name = #{name} AND contactInfo = #{contactInfo}")
    int countByNameAndContactInfo(String name, String contactInfo);

    default boolean isDuplicateVendor(Vendor vendor) {
        return countByNameAndContactInfo(vendor.getName(), vendor.getContactInfo()) > 0;
    }

    @Select("SELECT COUNT(*) FROM vendor WHERE vendor_id = #{vendorId}")
    int countByVendorId(Long vendorId);
}
