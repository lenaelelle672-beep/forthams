package com.ams.mapper;

import com.ams.entity.FloorPlanAsset;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface FloorPlanAssetMapper extends BaseMapper<FloorPlanAsset> {

    @Select("SELECT fpa.*, a.asset_no, a.asset_name, a.status as asset_status " +
            "FROM floor_plan_asset fpa " +
            "LEFT JOIN asset a ON fpa.asset_id = a.id " +
            "WHERE fpa.plan_id = #{planId} AND a.deleted = 0")
    List<FloorPlanAsset> selectWithAssetInfo(Long planId);
}
