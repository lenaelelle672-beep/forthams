package com.ams.mapper;

import com.ams.entity.WorkflowDefinitionDraft;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface WorkflowDefinitionDraftMapper extends BaseMapper<WorkflowDefinitionDraft> {

    /**
     * 以草稿身份、租户、业务类型和 revision 共同限定更新，revision 在同一条 SQL 中原子递增。
     */
    @Update("""
            UPDATE workflow_definition_draft
            SET name = #{name},
                description = #{description},
                definition_json = #{definitionJson},
                updated_by = #{updatedBy},
                revision = revision + 1,
                update_time = CURRENT_TIMESTAMP
            WHERE id = #{id}
              AND tenant_id = #{tenantId}
              AND business_type = #{businessType}
              AND revision = #{expectedRevision}
              AND deleted = 0
            """)
    int updateWithExpectedRevision(@Param("id") Long id,
                                   @Param("tenantId") String tenantId,
                                   @Param("businessType") String businessType,
                                   @Param("expectedRevision") Integer expectedRevision,
                                   @Param("name") String name,
                                   @Param("description") String description,
                                    @Param("definitionJson") String definitionJson,
                                    @Param("updatedBy") Long updatedBy);

    /**
     * 发布消费已审阅 revision。相同 expected revision 只能成功一次，事务回滚时该消费也会回滚。
     */
    @Update("""
            UPDATE workflow_definition_draft
            SET revision = revision + 1,
                update_time = CURRENT_TIMESTAMP
            WHERE id = #{id}
              AND tenant_id = #{tenantId}
              AND business_type = #{businessType}
              AND revision = #{expectedRevision}
              AND deleted = 0
            """)
    int consumeRevision(@Param("id") Long id,
                        @Param("tenantId") String tenantId,
                        @Param("businessType") String businessType,
                        @Param("expectedRevision") Integer expectedRevision);
}
