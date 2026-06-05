package com.ams.service;

import com.ams.entity.InspectionTask;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import java.time.LocalDate;
import java.util.List;

/**
 * 检验任务服务接口
 */
public interface InspectionTaskService {
    /**
     * 分页查询任务列表
     *
     * @param keyword   关键词（任务编号、任务名称）
     * @param status    任务状态
     * @param taskType  任务类型
     * @param startDate 开始日期
     * @param endDate   结束日期
     * @param pageNum   页码
     * @param pageSize  每页条数
     * @return 分页结果
     */
    Page<InspectionTask> listTasks(String keyword, String status, String taskType,
                                   LocalDate startDate, LocalDate endDate,
                                   Integer pageNum, Integer pageSize);

    /**
     * 根据ID查询任务
     *
     * @param id 任务ID
     * @return 任务详情
     */
    InspectionTask getTaskById(Long id);

    /**
     * 创建任务
     *
     * @param task 任务信息
     * @return 创建的任务
     */
    InspectionTask createTask(InspectionTask task);

    /**
     * 更新任务
     *
     * @param id   任务ID
     * @param task 任务信息
     * @return 更新后的任务
     */
    InspectionTask updateTask(Long id, InspectionTask task);

    /**
     * 删除任务（软删除）
     *
     * @param id 任务ID
     */
    void deleteTask(Long id);

    /**
     * 批量创建任务
     *
     * @param tasks 任务列表
     * @return 创建的任务列表
     */
    List<InspectionTask> batchCreateTasks(List<InspectionTask> tasks);

    /**
     * 更新任务状态
     *
     * @param id     任务ID
     * @param status 新状态
     */
    void updateTaskStatus(Long id, String status);

    /**
     * 根据状态查询任务
     *
     * @param status 任务状态
     * @return 任务列表
     */
    List<InspectionTask> getTasksByStatus(String status);

    /**
     * 查询即将到期任务（提前 days 天提醒）
     *
     * @param days 提前天数
     * @return 即将到期任务列表
     */
    List<InspectionTask> getExpiringTasks(int days);

    /**
     * 查询逾期任务（计划日期已过且未完成）
     *
     * @return 逾期任务列表
     */
    List<InspectionTask> getOverdueTasks();

    /**
     * 根据模板ID查询任务
     *
     * @param templateId 模板ID
     * @return 任务列表
     */
    List<InspectionTask> getTasksByTemplate(Long templateId);
}