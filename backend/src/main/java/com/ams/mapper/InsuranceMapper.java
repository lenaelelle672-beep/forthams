package com.ams.mapper;

import com.ams.entity.Insurance;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface InsuranceMapper extends BaseMapper<Insurance> {

    @Select("SELECT * FROM insurance WHERE status = 'ACTIVE' AND deleted = 0 " +
            "AND tenant_id = #{tenantId} AND end_date = #{warningDate}")
    List<Insurance> findExpiringSoon(String tenantId, LocalDate warningDate);

    @Select("SELECT * FROM insurance WHERE status = 'ACTIVE' AND deleted = 0 " +
            "AND tenant_id = #{tenantId} AND asset_ids LIKE CONCAT('%', #{assetId}, '%')")
    List<Insurance> selectByAssetId(@Param("tenantId") String tenantId, @Param("assetId") Long assetId);
}