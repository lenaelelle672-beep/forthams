package com.ams.mapper;

import com.ams.entity.TCORecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TCORecordMapper extends BaseMapper<TCORecord> {

    /**
     * 按资产ID查询TCO历史记录
     */
    @Select("SELECT * FROM tco_record WHERE tenant_id = #{tenantId} AND asset_id = #{assetId} ORDER BY calculation_date ASC")
    List<TCORecord> selectByAssetId(@Param("tenantId") String tenantId,
                                    @Param("assetId") Long assetId);

    /**
     * 按资产ID查询最近N条记录
     */
    @Select("SELECT * FROM tco_record WHERE tenant_id = #{tenantId} AND asset_id = #{assetId} ORDER BY calculation_date DESC LIMIT #{limit}")
    List<TCORecord> selectRecentByAssetId(@Param("tenantId") String tenantId,
                                          @Param("assetId") Long assetId,
                                          @Param("limit") int limit);

    /**
     * 获取部门下所有资产的最新TCO
     */
    @Select("SELECT tr.* FROM tco_record tr " +
            "INNER JOIN (SELECT asset_id, MAX(calculation_date) AS max_date FROM tco_record " +
            "            WHERE tenant_id = #{tenantId} GROUP BY asset_id) latest " +
            "ON tr.asset_id = latest.asset_id AND tr.calculation_date = latest.max_date " +
            "INNER JOIN asset a ON tr.asset_id = a.id AND a.deleted = 0 " +
            "WHERE a.dept_id = #{deptId} AND tr.tenant_id = #{tenantId}")
    List<TCORecord> selectLatestByDeptId(@Param("tenantId") String tenantId,
                                         @Param("deptId") Long deptId);

    /**
     * 获取分类下所有资产的最新TCO
     */
    @Select("SELECT tr.* FROM tco_record tr " +
            "INNER JOIN (SELECT asset_id, MAX(calculation_date) AS max_date FROM tco_record " +
            "            WHERE tenant_id = #{tenantId} GROUP BY asset_id) latest " +
            "ON tr.asset_id = latest.asset_id AND tr.calculation_date = latest.max_date " +
            "INNER JOIN asset a ON tr.asset_id = a.id AND a.deleted = 0 " +
            "WHERE a.category_id = #{categoryId} AND tr.tenant_id = #{tenantId}")
    List<TCORecord> selectLatestByCategoryId(@Param("tenantId") String tenantId,
                                             @Param("categoryId") Long categoryId);
}
