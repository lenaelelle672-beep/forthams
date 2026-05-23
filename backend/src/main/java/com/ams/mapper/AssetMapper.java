package com.ams.mapper;

import com.ams.entity.Asset;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AssetMapper extends BaseMapper<Asset> {

    /**
     * 按分类统计资产数量和价值（GROUP BY category_id）。
     *
     * @return 分类统计结果列表（categoryName, assetCount, totalValue）
     */
    @Select("SELECT ac.category_name AS categoryName, "
          + "COUNT(a.id) AS assetCount, "
          + "COALESCE(SUM(a.original_value), 0) AS totalValue "
          + "FROM asset a "
          + "LEFT JOIN asset_category ac ON a.category_id = ac.id "
          + "WHERE a.deleted = 0 "
          + "GROUP BY a.category_id, ac.category_name "
          + "ORDER BY assetCount DESC")
    java.util.List<java.util.Map<String, Object>> selectCategoryReport();



    /**
     * 按月份统计新增资产数量和总价值。
     *
     * @param months 回溯月数
     * @return 月度趋势数据列表（month, assetCount, totalValue）
     */
    @Select("SELECT DATE_FORMAT(create_time, '%Y-%m') AS month, "
          + "COUNT(id) AS assetCount, "
          + "COALESCE(SUM(original_value), 0) AS totalValue "
          + "FROM asset "
          + "WHERE deleted = 0 "
          + "AND create_time >= DATE_SUB(CURDATE(), INTERVAL #{months} MONTH) "
          + "GROUP BY DATE_FORMAT(create_time, '%Y-%m') "
          + "ORDER BY month ASC")
    java.util.List<java.util.Map<String, Object>> selectTrendByMonth(int months);


}
