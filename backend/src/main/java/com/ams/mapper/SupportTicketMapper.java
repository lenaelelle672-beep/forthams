package com.ams.mapper;

import com.ams.entity.SupportTicket;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/** 技术支持工单只读 mapper，带 tenant_id 租户隔离，只读。 */
public interface SupportTicketMapper {

    String BASE_COLUMNS = "id, tenant_id, title, category, priority, status, requester_name, assignee_name, "
            + "diagnostic_package_attached, diagnostic_package_masked, summary, created_at, updated_at";

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM support_ticket WHERE tenant_id = #{tenantId} "
            + "<if test='status != null and status != &quot;&quot;'> AND status = #{status} </if>"
            + "<if test='priority != null and priority != &quot;&quot;'> AND priority = #{priority} </if>"
            + "<if test='keyword != null and keyword != &quot;&quot;'> AND (title LIKE CONCAT('%', #{keyword}, '%') OR summary LIKE CONCAT('%', #{keyword}, '%')) </if>"
            + " ORDER BY created_at DESC, id DESC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<SupportTicket> selectPage(@Param("tenantId") String tenantId,
                                   @Param("status") String status,
                                   @Param("priority") String priority,
                                   @Param("keyword") String keyword,
                                   @Param("limit") int limit,
                                   @Param("offset") int offset);

    @Select("<script>"
            + "SELECT COUNT(1) FROM support_ticket WHERE tenant_id = #{tenantId} "
            + "<if test='status != null and status != &quot;&quot;'> AND status = #{status} </if>"
            + "<if test='priority != null and priority != &quot;&quot;'> AND priority = #{priority} </if>"
            + "<if test='keyword != null and keyword != &quot;&quot;'> AND (title LIKE CONCAT('%', #{keyword}, '%') OR summary LIKE CONCAT('%', #{keyword}, '%')) </if>"
            + "</script>")
    long count(@Param("tenantId") String tenantId, @Param("status") String status, @Param("priority") String priority, @Param("keyword") String keyword);

    @Select("SELECT " + BASE_COLUMNS + " FROM support_ticket WHERE tenant_id = #{tenantId} AND id = #{id} LIMIT 1")
    SupportTicket selectByIdAndTenant(@Param("tenantId") String tenantId, @Param("id") Long id);
}
