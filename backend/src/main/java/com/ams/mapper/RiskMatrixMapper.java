package com.ams.mapper;

import com.ams.entity.RiskMatrix;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 风险矩阵配置 Mapper
 */
@Mapper
public interface RiskMatrixMapper extends BaseMapper<RiskMatrix> {

    /**
     * 查询租户启用的风险矩阵配置
     * @param tenantId 租户ID
     * @return 启用的风险矩阵配置列表
     */
    @Select("SELECT * FROM risk_matrix WHERE tenant_id = #{tenantId} AND deleted = 0 AND is_active = 1 ORDER BY id DESC")
    List<RiskMatrix> selectActiveByTenant(@Param("tenantId") String tenantId);
}