package com.ams.mapper;

import com.ams.entity.WorkflowMailConfig;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/** 流程节点邮件配置只读 mapper，带 tenant_id 租户隔离，只读。 */
public interface WorkflowMailConfigMapper {

    String BASE_COLUMNS = "id, tenant_id, business_type, node_key, node_name, trigger_event, "
            + "template_code, enabled, recipient_scope, risk_note, created_at, updated_at";

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM workflow_mail_config WHERE tenant_id = #{tenantId} "
            + "<if test='businessType != null and businessType != &quot;&quot;'> AND business_type = #{businessType} </if>"
            + "<if test='enabled != null'> AND enabled = #{enabled} </if>"
            + " ORDER BY business_type ASC, node_key ASC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<WorkflowMailConfig> selectPage(@Param("tenantId") String tenantId,
                                        @Param("businessType") String businessType,
                                        @Param("enabled") Integer enabled,
                                        @Param("limit") int limit,
                                        @Param("offset") int offset);

    @Select("<script>"
            + "SELECT COUNT(1) FROM workflow_mail_config WHERE tenant_id = #{tenantId} "
            + "<if test='businessType != null and businessType != &quot;&quot;'> AND business_type = #{businessType} </if>"
            + "<if test='enabled != null'> AND enabled = #{enabled} </if>"
            + "</script>")
    long count(@Param("tenantId") String tenantId, @Param("businessType") String businessType, @Param("enabled") Integer enabled);

    @Select("SELECT " + BASE_COLUMNS + " FROM workflow_mail_config WHERE tenant_id = #{tenantId} AND id = #{id} LIMIT 1")
    WorkflowMailConfig selectByIdAndTenant(@Param("tenantId") String tenantId, @Param("id") Long id);
}
