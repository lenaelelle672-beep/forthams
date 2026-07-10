package com.ams.mapper;

import com.ams.entity.DocArticle;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/** 文档中心只读 mapper，带 tenant_id 租户隔离，只读。 */
public interface DocArticleMapper {

    String BASE_COLUMNS = "id, tenant_id, title, category, version, status, author_name, "
            + "attachment_count, summary, published_at, created_at, updated_at";

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM doc_article WHERE tenant_id = #{tenantId} "
            + "<if test='category != null and category != &quot;&quot;'> AND category = #{category} </if>"
            + "<if test='status != null and status != &quot;&quot;'> AND status = #{status} </if>"
            + "<if test='keyword != null and keyword != &quot;&quot;'> AND (title LIKE CONCAT('%', #{keyword}, '%') OR summary LIKE CONCAT('%', #{keyword}, '%')) </if>"
            + " ORDER BY updated_at DESC, id DESC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<DocArticle> selectPage(@Param("tenantId") String tenantId,
                                @Param("category") String category,
                                @Param("status") String status,
                                @Param("keyword") String keyword,
                                @Param("limit") int limit,
                                @Param("offset") int offset);

    @Select("<script>"
            + "SELECT COUNT(1) FROM doc_article WHERE tenant_id = #{tenantId} "
            + "<if test='category != null and category != &quot;&quot;'> AND category = #{category} </if>"
            + "<if test='status != null and status != &quot;&quot;'> AND status = #{status} </if>"
            + "<if test='keyword != null and keyword != &quot;&quot;'> AND (title LIKE CONCAT('%', #{keyword}, '%') OR summary LIKE CONCAT('%', #{keyword}, '%')) </if>"
            + "</script>")
    long count(@Param("tenantId") String tenantId, @Param("category") String category, @Param("status") String status, @Param("keyword") String keyword);

    @Select("SELECT " + BASE_COLUMNS + " FROM doc_article WHERE tenant_id = #{tenantId} AND id = #{id} LIMIT 1")
    DocArticle selectByIdAndTenant(@Param("tenantId") String tenantId, @Param("id") Long id);
}
