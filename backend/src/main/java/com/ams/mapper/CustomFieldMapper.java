package com.ams.mapper;

import com.ams.entity.CustomField;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface CustomFieldMapper {

    String FILTER_SQL = "<if test='fieldType != null'> AND field_type = #{fieldType} </if>"
            + "<if test='status != null'> AND status = #{status} </if>"
            + "<if test='keyword != null'> AND (field_name LIKE CONCAT('%', #{keyword}, '%')"
            + " OR field_label LIKE CONCAT('%', #{keyword}, '%')) </if>";

    String BASE_COLUMNS = "id, tenant_id, field_name, field_label, field_type, field_options, "
            + "validation_pattern, field_order, required, encrypted, status, create_by, create_time, update_by, update_time";

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM custom_field "
            + "WHERE tenant_id = #{tenantId} "
            + FILTER_SQL
            + " ORDER BY field_order ASC, id ASC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<CustomField> selectPageRecords(@Param("tenantId") String tenantId,
                                        @Param("fieldType") String fieldType,
                                        @Param("status") Integer status,
                                        @Param("keyword") String keyword,
                                        @Param("limit") int limit,
                                        @Param("offset") int offset);

    @Select("<script>"
            + "SELECT COUNT(*) FROM custom_field WHERE tenant_id = #{tenantId} "
            + FILTER_SQL
            + "</script>")
    long countRecords(@Param("tenantId") String tenantId,
                      @Param("fieldType") String fieldType,
                      @Param("status") Integer status,
                      @Param("keyword") String keyword);

    @Select("SELECT " + BASE_COLUMNS + " FROM custom_field WHERE tenant_id = #{tenantId} AND status = 1 ORDER BY field_order ASC, id ASC")
    List<CustomField> selectAllEnabled(@Param("tenantId") String tenantId);

    @Select("SELECT " + BASE_COLUMNS + " FROM custom_field WHERE tenant_id = #{tenantId} AND id = #{id} LIMIT 1")
    CustomField selectByIdAndTenant(@Param("tenantId") String tenantId, @Param("id") Long id);

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM custom_field WHERE tenant_id = #{tenantId} AND status = 1 "
            + "<if test='(fieldIds != null and fieldIds.size() > 0) or (fieldNames != null and fieldNames.size() > 0)'>"
            + " AND (<trim prefixOverrides='OR'>"
            + "<if test='fieldIds != null and fieldIds.size() > 0'>"
            + " OR id IN <foreach collection='fieldIds' item='fieldId' open='(' separator=',' close=')'>#{fieldId}</foreach>"
            + "</if>"
            + "<if test='fieldNames != null and fieldNames.size() > 0'>"
            + " OR field_name IN <foreach collection='fieldNames' item='fieldName' open='(' separator=',' close=')'>#{fieldName}</foreach>"
            + "</if>"
            + "</trim>)"
            + "</if>"
            + " ORDER BY field_order ASC, id ASC LIMIT 200"
            + "</script>")
    List<CustomField> selectPreviewDefinitions(@Param("tenantId") String tenantId,
                                               @Param("fieldIds") List<Long> fieldIds,
                                               @Param("fieldNames") List<String> fieldNames);

    @Select("SELECT DISTINCT field_type FROM custom_field "
            + "WHERE tenant_id = #{tenantId} AND field_type IS NOT NULL AND field_type <> '' "
            + "ORDER BY field_type LIMIT #{limit}")
    List<String> listFieldTypes(@Param("tenantId") String tenantId, @Param("limit") int limit);
}
