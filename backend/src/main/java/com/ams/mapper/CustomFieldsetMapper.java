package com.ams.mapper;

import com.ams.entity.CustomField;
import com.ams.entity.CustomFieldset;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface CustomFieldsetMapper {

    String FIELDSET_COLUMNS = "fs.id, fs.tenant_id, fs.name, fs.description, fs.category_id, fs.sort_order, "
            + "fs.status, fs.create_by, fs.create_time, fs.update_by, fs.update_time, "
            + "(SELECT COUNT(*) FROM custom_fieldset_field cff "
            + "WHERE cff.tenant_id = fs.tenant_id AND cff.fieldset_id = fs.id AND cff.status = 1) AS field_count";

    String FIELDSET_FILTER_SQL = "<if test='status != null'> AND fs.status = #{status} </if>"
            + "<if test='categoryId != null'> AND fs.category_id = #{categoryId} </if>"
            + "<if test='keyword != null'> AND (fs.name LIKE CONCAT('%', #{keyword}, '%')"
            + " OR fs.description LIKE CONCAT('%', #{keyword}, '%')) </if>";

    String CUSTOM_FIELD_COLUMNS = "cf.id, cf.tenant_id, cf.field_name, cf.field_label, cf.field_type, cf.field_options, "
            + "cf.validation_pattern, cf.field_order, cf.required, cf.encrypted, cf.status, "
            + "cf.create_by, cf.create_time, cf.update_by, cf.update_time";

    @Select("<script>"
            + "SELECT " + FIELDSET_COLUMNS + " FROM custom_fieldset fs "
            + "WHERE fs.tenant_id = #{tenantId} "
            + FIELDSET_FILTER_SQL
            + " ORDER BY fs.sort_order ASC, fs.id ASC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<CustomFieldset> selectPageRecords(@Param("tenantId") String tenantId,
                                           @Param("status") Integer status,
                                           @Param("categoryId") Long categoryId,
                                           @Param("keyword") String keyword,
                                           @Param("limit") int limit,
                                           @Param("offset") int offset);

    @Select("<script>"
            + "SELECT COUNT(*) FROM custom_fieldset fs WHERE fs.tenant_id = #{tenantId} "
            + FIELDSET_FILTER_SQL
            + "</script>")
    long countRecords(@Param("tenantId") String tenantId,
                      @Param("status") Integer status,
                      @Param("categoryId") Long categoryId,
                      @Param("keyword") String keyword);

    @Select("SELECT " + FIELDSET_COLUMNS + " FROM custom_fieldset fs "
            + "WHERE fs.tenant_id = #{tenantId} AND fs.status = 1 ORDER BY fs.sort_order ASC, fs.id ASC")
    List<CustomFieldset> selectAllEnabled(@Param("tenantId") String tenantId);

    @Select("SELECT " + FIELDSET_COLUMNS + " FROM custom_fieldset fs "
            + "WHERE fs.tenant_id = #{tenantId} AND fs.id = #{id} LIMIT 1")
    CustomFieldset selectByIdAndTenant(@Param("tenantId") String tenantId, @Param("id") Long id);

    @Select("SELECT " + FIELDSET_COLUMNS + " FROM custom_fieldset fs "
            + "WHERE fs.tenant_id = #{tenantId} AND fs.category_id = #{categoryId} AND fs.status = 1 "
            + "ORDER BY fs.sort_order ASC, fs.id ASC LIMIT 1")
    CustomFieldset selectByCategory(@Param("tenantId") String tenantId, @Param("categoryId") Long categoryId);

    @Select("SELECT COUNT(*) FROM custom_fieldset fs "
            + "WHERE fs.tenant_id = #{tenantId} AND fs.category_id = #{categoryId} AND fs.status = 1")
    long countCategoryBindings(@Param("tenantId") String tenantId, @Param("categoryId") Long categoryId);

    @Select("SELECT " + CUSTOM_FIELD_COLUMNS + " FROM custom_fieldset fs "
            + "JOIN custom_fieldset_field cff ON cff.tenant_id = fs.tenant_id AND cff.fieldset_id = fs.id "
            + "JOIN custom_field cf ON cf.tenant_id = fs.tenant_id AND cf.id = cff.field_id "
            + "WHERE fs.tenant_id = #{tenantId} AND fs.id = #{fieldsetId} AND cff.status = 1 AND cf.status = 1 "
            + "ORDER BY cff.field_order ASC, cf.field_order ASC, cf.id ASC LIMIT 200")
    List<CustomField> selectFieldsByFieldsetId(@Param("tenantId") String tenantId, @Param("fieldsetId") Long fieldsetId);

    @Select("<script>"
            + "SELECT " + CUSTOM_FIELD_COLUMNS + " FROM custom_field cf "
            + "WHERE cf.tenant_id = #{tenantId} AND cf.status = 1 "
            + "AND cf.id IN <foreach collection='fieldIds' item='fieldId' open='(' separator=',' close=')'>#{fieldId}</foreach> "
            + "ORDER BY cf.field_order ASC, cf.id ASC LIMIT 200"
            + "</script>")
    List<CustomField> selectPreviewFields(@Param("tenantId") String tenantId, @Param("fieldIds") List<Long> fieldIds);
}
