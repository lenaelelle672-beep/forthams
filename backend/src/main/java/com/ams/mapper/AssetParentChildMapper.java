package com.ams.mapper;

import com.ams.entity.AssetParentChild;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 资产主附属关系 Mapper。
 * <p>继承 BaseMapper，提供标准 CRUD 操作。</p>
 */
@Mapper
public interface AssetParentChildMapper extends BaseMapper<AssetParentChild> {

}
