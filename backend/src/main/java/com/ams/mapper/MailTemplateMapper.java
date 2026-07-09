package com.ams.mapper;

import com.ams.entity.MailTemplate;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface MailTemplateMapper extends BaseMapper<MailTemplate> {

    String FILTER_SQL = "<if test='category != null'> AND category = #{category} </if>"
            + "<if test='contentType != null'> AND content_type = #{contentType} </if>"
            + "<if test='status != null'> AND status = #{status} </if>"
            + "<if test='keyword != null'> AND (template_code LIKE CONCAT('%', #{keyword}, '%')"
            + " OR template_name LIKE CONCAT('%', #{keyword}, '%')"
            + " OR subject_template LIKE CONCAT('%', #{keyword}, '%')"
            + " OR content_template LIKE CONCAT('%', #{keyword}, '%')) </if>";

    String BASE_COLUMNS = "id, tenant_id, template_code, template_name, category, subject_template, "
            + "content_template, content_type, variables, is_builtin, status, create_by, create_time, update_by, update_time";

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM mail_template "
            + "WHERE tenant_id = #{tenantId} "
            + FILTER_SQL
            + " ORDER BY update_time DESC, id DESC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<MailTemplate> selectPageRecords(@Param("tenantId") String tenantId,
                                         @Param("category") String category,
                                         @Param("contentType") String contentType,
                                         @Param("status") Integer status,
                                         @Param("keyword") String keyword,
                                         @Param("limit") int limit,
                                         @Param("offset") int offset);

    @Select("<script>"
            + "SELECT COUNT(*) FROM mail_template WHERE tenant_id = #{tenantId} "
            + FILTER_SQL
            + "</script>")
    long countRecords(@Param("tenantId") String tenantId,
                      @Param("category") String category,
                      @Param("contentType") String contentType,
                      @Param("status") Integer status,
                      @Param("keyword") String keyword);

    @Select("SELECT " + BASE_COLUMNS + " FROM mail_template WHERE tenant_id = #{tenantId} AND id = #{id} LIMIT 1")
    MailTemplate selectByIdAndTenant(@Param("tenantId") String tenantId, @Param("id") Long id);

    @Select("SELECT " + BASE_COLUMNS + " FROM mail_template WHERE tenant_id = #{tenantId} AND template_code = #{templateCode} LIMIT 1")
    MailTemplate selectByCodeAndTenant(@Param("tenantId") String tenantId, @Param("templateCode") String templateCode);

    @Select("SELECT DISTINCT category FROM mail_template "
            + "WHERE tenant_id = #{tenantId} AND category IS NOT NULL AND category <> '' "
            + "ORDER BY category LIMIT #{limit}")
    List<String> listCategories(@Param("tenantId") String tenantId, @Param("limit") int limit);

    @Select("SELECT DISTINCT content_type FROM mail_template "
            + "WHERE tenant_id = #{tenantId} AND content_type IS NOT NULL AND content_type <> '' "
            + "ORDER BY content_type LIMIT #{limit}")
    List<String> listContentTypes(@Param("tenantId") String tenantId, @Param("limit") int limit);
}
