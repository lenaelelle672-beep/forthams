package com.ams.mapper;

import com.ams.entity.WorkOrder;
import com.ams.dto.DeptPendingDTO;
import com.ams.dto.StatusDistributionDTO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface WorkOrderMapper extends BaseMapper<WorkOrder> {

    @Select("SELECT status AS `name`, COUNT(*) AS `value` FROM work_order WHERE tenant_id = #{tenantId} GROUP BY status")
    List<StatusDistributionDTO> selectStatusDistribution(@Param("tenantId") String tenantId);

    @Select("SELECT dept_name AS `name`, COUNT(*) AS `value` FROM work_order WHERE tenant_id = #{tenantId} AND status = 'PENDING' GROUP BY dept_name")
    List<DeptPendingDTO> selectDeptPending(@Param("tenantId") String tenantId);
}
