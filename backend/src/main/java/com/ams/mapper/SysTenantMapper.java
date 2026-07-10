package com.ams.mapper;

import com.ams.entity.SysTenant;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 租户主数据 mapper。
 *
 * sys_tenant 是租户主数据表本身（不是业务表），因此查询不做 tenant_id 过滤——
 * 租户管理页由 system:tenant:query 权限码控制可见性（超级管理员可见全部租户）。
 */
public interface SysTenantMapper {

    String BASE_COLUMNS = "id, name, plan, max_users, max_assets, status, contact_name, contact_phone, contact_email, created_at, updated_at";

    @Select("<script>"
            + "SELECT " + BASE_COLUMNS + " FROM sys_tenant WHERE 1=1 "
            + "<if test='keyword != null and keyword != &quot;&quot;'>"
            + " AND (id LIKE CONCAT('%', #{keyword}, '%') OR name LIKE CONCAT('%', #{keyword}, '%')) "
            + "</if>"
            + "<if test='status != null and status != &quot;&quot;'> AND status = #{status} </if>"
            + " ORDER BY created_at ASC, id ASC LIMIT #{limit} OFFSET #{offset}"
            + "</script>")
    List<SysTenant> selectPage(@Param("keyword") String keyword,
                               @Param("status") String status,
                               @Param("limit") int limit,
                               @Param("offset") int offset);

    @Select("<script>"
            + "SELECT COUNT(1) FROM sys_tenant WHERE 1=1 "
            + "<if test='keyword != null and keyword != &quot;&quot;'>"
            + " AND (id LIKE CONCAT('%', #{keyword}, '%') OR name LIKE CONCAT('%', #{keyword}, '%')) "
            + "</if>"
            + "<if test='status != null and status != &quot;&quot;'> AND status = #{status} </if>"
            + "</script>")
    long count(@Param("keyword") String keyword, @Param("status") String status);

    @Select("SELECT " + BASE_COLUMNS + " FROM sys_tenant WHERE id = #{id} LIMIT 1")
    SysTenant selectById(@Param("id") String id);

    @Select("SELECT " + BASE_COLUMNS + " FROM sys_tenant ORDER BY created_at ASC, id ASC")
    List<SysTenant> selectAll();
}
