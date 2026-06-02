package com.ams.mapper;

import com.ams.entity.MaintenancePlan;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MaintenancePlanMapper extends BaseMapper<MaintenancePlan> {

    /** 定时任务专用：查询所有到期未完成的维保计划（跳过租户过滤） */
    @Select("SELECT * FROM maintenance_plan WHERE status = #{status} AND next_due_date <= #{today} AND next_due_date IS NOT NULL")
    List<MaintenancePlan> selectDuePlansForScheduler(String status, String today);

    /** 定时任务专用：查询所有近期到期的维保计划（跳过租户过滤） */
    @Select("SELECT * FROM maintenance_plan WHERE status = #{status} AND next_due_date >= #{today} AND next_due_date <= #{deadline} AND next_due_date IS NOT NULL")
    List<MaintenancePlan> selectUpcomingPlansForScheduler(String status, String today, String deadline);
}
