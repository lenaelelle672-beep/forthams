package com.ams.mapper;

import com.ams.entity.InspectionTask;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;
import java.util.List;

/**
 * 检验任务 Mapper
 */
@Mapper
public interface InspectionTaskMapper extends BaseMapper<InspectionTask> {

    /**
     * 查询待处理任务（状态为 PENDING 或 IN_PROGRESS）
     *
     * @param tenantId 租户ID
     * @return 待处理任务列表
     */
    @Select("SELECT * FROM inspection_task WHERE tenant_id = #{tenantId} AND deleted = 0 " +
            "AND status IN ('PENDING', 'IN_PROGRESS') ORDER BY planned_date ASC")
    List<InspectionTask> findPendingTasks(@Param("tenantId") String tenantId);

    /**
     * 根据模板ID查询任务
     *
     * @param templateId 模板ID
     * @param tenantId   租户ID
     * @return 任务列表
     */
    @Select("SELECT * FROM inspection_task WHERE template_id = #{templateId} AND tenant_id = #{tenantId} AND deleted = 0")
    List<InspectionTask> findTasksByTemplate(@Param("templateId") Long templateId,
                                              @Param("tenantId") String tenantId);

    /**
     * 查询即将到期任务（提前 days 天提醒）
     *
     * @param tenantId 租户ID
     * @param days     提前天数
     * @return 即将到期任务列表
     */
    @Select("SELECT * FROM inspection_task WHERE tenant_id = #{tenantId} AND deleted = 0 " +
            "AND status IN ('PENDING', 'IN_PROGRESS') " +
            "AND planned_date <= DATE_ADD(CURDATE(), INTERVAL #{days} DAY) " +
            "ORDER BY planned_date ASC")
    List<InspectionTask> findExpiringTasks(@Param("tenantId") String tenantId,
                                           @Param("days") int days);

    /**
     * 查询逾期任务（计划日期已过且未完成）
     *
     * @param tenantId 租户ID
     * @return 逾期任务列表
     */
    @Select("SELECT * FROM inspection_task WHERE tenant_id = #{tenantId} AND deleted = 0 " +
            "AND planned_date < CURDATE() AND status IN ('PENDING', 'IN_PROGRESS') " +
            "ORDER BY planned_date ASC")
    List<InspectionTask> findOverdueTasks(@Param("tenantId") String tenantId);

    /**
     * 批量更新任务状态
     *
     * @param taskIds 任务ID列表
     * @param status  新状态
     */
    @Update("UPDATE inspection_task SET status = #{status}, update_time = NOW() " +
            "WHERE id IN (${taskIds}) AND deleted = 0")
    void batchUpdateStatus(@Param("taskIds") String taskIds, @Param("status") String status);
}