package com.ams.mapper;

import com.ams.entity.Handover;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 交接任务记录只读 mapper。带 tenant_id 租户隔离，只读。
 */
public interface HandoverMapper {

    String BASE_COLUMNS = "id, tenant_id, title, outgoing_user_id, outgoing_user_name, incoming_user_id, "
            + "incoming_user_name, status, asset_count, workorder_count, approval_count, summary, risk_note, "
            + "created_at, updated_at";

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM handover WHERE tenant_id = #{tenantId} "
            + "<if test='status != null and status != &quot;&quot;'> AND status = #{status} </if>"
            + "<if test='keyword != null and keyword != &quot;&quot;'>"
            + " AND (title LIKE CONCAT('%', #{keyword}, '%') OR outgoing_user_name LIKE CONCAT('%', #{keyword}, '%') OR incoming_user_name LIKE CONCAT('%', #{keyword}, '%')) "
            + "</if>"
            + " ORDER BY created_at DESC, id DESC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<Handover> selectPage(@Param("tenantId") String tenantId,
                              @Param("status") String status,
                              @Param("keyword") String keyword,
                              @Param("limit") int limit,
                              @Param("offset") int offset);

    @Select("<script>"
            + "SELECT COUNT(1) FROM handover WHERE tenant_id = #{tenantId} "
            + "<if test='status != null and status != &quot;&quot;'> AND status = #{status} </if>"
            + "<if test='keyword != null and keyword != &quot;&quot;'>"
            + " AND (title LIKE CONCAT('%', #{keyword}, '%') OR outgoing_user_name LIKE CONCAT('%', #{keyword}, '%') OR incoming_user_name LIKE CONCAT('%', #{keyword}, '%')) "
            + "</if>"
            + "</script>")
    long count(@Param("tenantId") String tenantId, @Param("status") String status, @Param("keyword") String keyword);

    @Select("SELECT " + BASE_COLUMNS + " FROM handover WHERE tenant_id = #{tenantId} AND id = #{id} LIMIT 1")
    Handover selectByIdAndTenant(@Param("tenantId") String tenantId, @Param("id") Long id);
}
