package com.ams.mapper;

import com.ams.entity.DepreciationRecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface DepreciationRecordMapper extends BaseMapper<DepreciationRecord> {

    /**
     * 按资产ID查询折旧记录
     */
    @Select("SELECT dr.*, a.asset_no AS assetNo, a.asset_name AS assetName " +
            "FROM depreciation_record dr " +
            "LEFT JOIN asset a ON dr.asset_id = a.id " +
            "WHERE dr.tenant_id = #{tenantId} AND dr.asset_id = #{assetId} AND dr.deleted = 0 " +
            "ORDER BY dr.period_start DESC " +
            "LIMIT #{limit}")
    List<DepreciationRecord> selectByAssetId(@Param("tenantId") String tenantId,
                                              @Param("assetId") Long assetId,
                                              @Param("limit") int limit);
}
