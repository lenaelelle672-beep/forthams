package com.ams.mapper;

import com.ams.entity.SparePart;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.math.BigDecimal;
import java.util.List;

@Mapper
public interface SparePartMapper extends BaseMapper<SparePart> {

    /**
     * 乐观锁库存扣减
     * @return 影响行数（0 表示扣减失败）
     */
    @Update("UPDATE spare_part SET current_stock = current_stock - #{quantity}, " +
            "version = version + 1 " +
            "WHERE id = #{id} AND current_stock >= #{quantity} AND version = #{version} AND deleted = 0")
    int reduceStock(@Param("id") Long id, @Param("quantity") BigDecimal quantity, @Param("version") Integer version);

    /**
     * 查询低库存备件
     */
    @Select("SELECT * FROM spare_part WHERE current_stock < safety_stock " +
            "AND deleted = 0 AND tenant_id = #{tenantId} ORDER BY (safety_stock - current_stock) DESC")
    List<SparePart> selectLowStock(@Param("tenantId") String tenantId);
}
