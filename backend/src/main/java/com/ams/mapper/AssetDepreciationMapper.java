package com.ams.mapper;

import com.ams.entity.DepreciationRecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 资产折旧聚合查询 Mapper（兼容保留）
 */
@Mapper
public interface AssetDepreciationMapper extends BaseMapper<DepreciationRecord> {
}
