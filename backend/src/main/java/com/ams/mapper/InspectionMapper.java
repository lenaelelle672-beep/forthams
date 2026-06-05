package com.ams.mapper;

import com.ams.entity.Inspection;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface InspectionMapper extends BaseMapper<Inspection> {

    /**
     * 查询即将到期的检验记录
     * @param tenantId 租户 ID
     * @param warningDate 预警日期阈值
     * @return 检验记录列表
     */
    List<Inspection> findExpiringSoon(@Param("tenantId") String tenantId,
                                      @Param("warningDate") LocalDate warningDate);
}
