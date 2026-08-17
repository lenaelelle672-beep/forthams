package com.ams.mapper;

import com.ams.entity.Asset;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AssetMapper extends BaseMapper<Asset> {

    @Select("SELECT COUNT(*) FROM asset WHERE tenant_id = #{tenantId} AND dept_id = #{deptId}")
    Long countByTenantIdAndDeptIdIncludingDeleted(@Param("tenantId") String tenantId, @Param("deptId") Long deptId);
}
