package com.ams.mapper;

import com.ams.entity.SystemPost;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface SystemPostMapper {

    String BASE_COLUMNS = "id, tenant_id, post_code, post_name, sort_order, status, remark, removed, created_at, updated_at";

    String FILTER_SQL = "<if test='keyword != null'> AND (post_code LIKE CONCAT('%', #{keyword}, '%')"
            + " OR post_name LIKE CONCAT('%', #{keyword}, '%')) </if>"
            + "<if test='status != null'> AND status = #{status} </if>";

    @Select("<script>"
            + "SELECT COUNT(1) FROM sys_post WHERE tenant_id = #{tenantId} AND removed = 0 "
            + FILTER_SQL
            + "</script>")
    long countRecords(@Param("tenantId") String tenantId,
                      @Param("keyword") String keyword,
                      @Param("status") String status);

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM sys_post WHERE tenant_id = #{tenantId} AND removed = 0 "
            + FILTER_SQL
            + " ORDER BY sort_order ASC, updated_at DESC, id DESC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<SystemPost> selectPageRecords(@Param("tenantId") String tenantId,
                                       @Param("keyword") String keyword,
                                       @Param("status") String status,
                                       @Param("limit") int limit,
                                       @Param("offset") int offset);

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM sys_post WHERE tenant_id = #{tenantId} AND removed = 0 "
            + FILTER_SQL
            + " ORDER BY sort_order ASC, updated_at DESC, id DESC"
            + "</script>")
    List<SystemPost> selectAllRecords(@Param("tenantId") String tenantId,
                                      @Param("keyword") String keyword,
                                      @Param("status") String status);

    @Select("SELECT " + BASE_COLUMNS + " FROM sys_post WHERE tenant_id = #{tenantId} AND removed = 0 AND id = #{id} LIMIT 1")
    SystemPost selectByIdAndTenant(@Param("tenantId") String tenantId, @Param("id") Long id);

    @Select("SELECT COUNT(1) FROM sys_post WHERE tenant_id = #{tenantId} AND removed = 0 AND post_code = #{postCode}")
    long countByPostCode(@Param("tenantId") String tenantId, @Param("postCode") String postCode);

    @Select("SELECT DISTINCT status FROM sys_post "
            + "WHERE tenant_id = #{tenantId} AND removed = 0 AND status IS NOT NULL AND status <> '' "
            + "ORDER BY status LIMIT #{limit}")
    List<String> listStatuses(@Param("tenantId") String tenantId, @Param("limit") int limit);
}
