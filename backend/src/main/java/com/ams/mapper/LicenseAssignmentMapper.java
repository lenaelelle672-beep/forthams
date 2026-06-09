package com.ams.mapper;
import com.ams.entity.LicenseAssignment;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.util.List;
@Mapper
public interface LicenseAssignmentMapper extends BaseMapper<LicenseAssignment> {
    @Select("SELECT COUNT(*) FROM license_assignment WHERE tenant_id=#{tenantId} AND license_id=#{licenseId} AND returned_date IS NULL")
    int countActiveByLicense(String tenantId, Long licenseId);

    @Select("SELECT * FROM license_assignment WHERE tenant_id=#{tenantId} AND license_id=#{licenseId} AND returned_date IS NULL")
    List<LicenseAssignment> findActiveByLicense(String tenantId, Long licenseId);
}
