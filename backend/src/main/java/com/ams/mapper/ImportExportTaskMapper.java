package com.ams.mapper;

import com.ams.entity.ImportExportTask;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 导入导出任务记录只读 mapper。
 *
 * 全部查询带 tenant_id 过滤（租户隔离）。只读 catalog，不提供 insert/update/delete。
 */
public interface ImportExportTaskMapper {

    String BASE_COLUMNS = "id, tenant_id, task_type, business_object, file_format, status, "
            + "total_rows, success_rows, failed_rows, operator_id, operator_name, error_summary, "
            + "started_at, finished_at, created_at, updated_at";

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM import_export_task WHERE tenant_id = #{tenantId} "
            + "<if test='taskType != null and taskType != &quot;&quot;'> AND task_type = #{taskType} </if>"
            + "<if test='businessObject != null and businessObject != &quot;&quot;'> AND business_object = #{businessObject} </if>"
            + "<if test='status != null and status != &quot;&quot;'> AND status = #{status} </if>"
            + " ORDER BY created_at DESC, id DESC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<ImportExportTask> selectPage(@Param("tenantId") String tenantId,
                                      @Param("taskType") String taskType,
                                      @Param("businessObject") String businessObject,
                                      @Param("status") String status,
                                      @Param("limit") int limit,
                                      @Param("offset") int offset);

    @Select("<script>"
            + "SELECT COUNT(1) FROM import_export_task WHERE tenant_id = #{tenantId} "
            + "<if test='taskType != null and taskType != &quot;&quot;'> AND task_type = #{taskType} </if>"
            + "<if test='businessObject != null and businessObject != &quot;&quot;'> AND business_object = #{businessObject} </if>"
            + "<if test='status != null and status != &quot;&quot;'> AND status = #{status} </if>"
            + "</script>")
    long count(@Param("tenantId") String tenantId,
               @Param("taskType") String taskType,
               @Param("businessObject") String businessObject,
               @Param("status") String status);

    @Select("SELECT " + BASE_COLUMNS + " FROM import_export_task WHERE tenant_id = #{tenantId} AND id = #{id} LIMIT 1")
    ImportExportTask selectByIdAndTenant(@Param("tenantId") String tenantId, @Param("id") Long id);
}
