package com.ams.mapper;

import com.ams.entity.WorkflowDefinition;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface WorkflowDefinitionMapper extends BaseMapper<WorkflowDefinition> {

    @Select("""
            SELECT id,
                   tenant_id AS tenantId,
                   business_type AS businessType,
                   name,
                   description,
                   definition_json AS definitionJson,
                   status,
                   version,
                   updated_by AS updatedBy,
                   published_by AS publishedBy,
                   published_at AS publishedAt,
                   create_time AS createTime,
                   update_time AS updateTime,
                   deleted
            FROM workflow_definition
            WHERE tenant_id = #{tenantId}
              AND business_type = #{businessType}
            LIMIT 1
            """)
    WorkflowDefinition selectIncludingDeleted(@Param("tenantId") String tenantId,
                                               @Param("businessType") String businessType);

    @Update("""
            UPDATE workflow_definition
            SET name = #{name},
                description = #{description},
                definition_json = #{definitionJson},
                status = 'DRAFT',
                updated_by = #{updatedBy},
                deleted = 0,
                version = COALESCE(version, 0),
                update_time = NOW()
            WHERE id = #{id}
              AND tenant_id = #{tenantId}
              AND business_type = #{businessType}
              AND deleted = 1
            """)
    int restoreDeletedDefinition(@Param("id") Long id,
                                 @Param("tenantId") String tenantId,
                                 @Param("businessType") String businessType,
                                 @Param("name") String name,
                                 @Param("description") String description,
                                 @Param("definitionJson") String definitionJson,
                                 @Param("updatedBy") Long updatedBy);
}
