package com.ams.mapper;

import com.ams.entity.FaultCode;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface FaultCodeMapper extends BaseMapper<FaultCode> {

    @Select("SELECT * FROM fault_code WHERE parent_id = #{parentId} AND deleted = 0 AND tenant_id = #{tenantId} ORDER BY sort_order")
    List<FaultCode> selectChildren(@Param("parentId") Long parentId, @Param("tenantId") String tenantId);

    @Select("SELECT * FROM fault_code WHERE level = #{level} AND deleted = 0 AND tenant_id = #{tenantId} ORDER BY sort_order")
    List<FaultCode> selectByLevel(@Param("level") Integer level, @Param("tenantId") String tenantId);

    @Select("SELECT COUNT(1) FROM fault_code WHERE parent_id = #{parentId} AND deleted = 0 AND tenant_id = #{tenantId}")
    int countChildren(@Param("parentId") Long parentId, @Param("tenantId") String tenantId);

    @Select("SELECT * FROM fault_code WHERE deleted = 0 AND tenant_id = #{tenantId} ORDER BY level, sort_order")
    List<FaultCode> selectAll(@Param("tenantId") String tenantId);

    // ── XML 映射方法 ──────────────────────────────────────────────────────────

    /** 通过 parentId 查询直接子节点（XML 版本） */
    List<FaultCode> selectChildrenByParentId(@Param("parentId") Long parentId, @Param("tenantId") String tenantId);

    /** 按最大层级过滤查询全部节点（含父节点信息） */
    List<FaultCode> selectTreeByMaxLevel(@Param("tenantId") String tenantId, @Param("maxLevel") Integer maxLevel);

    /** 查询单节点及其父节点信息 */
    FaultCode selectNodeWithPath(@Param("id") Long id, @Param("tenantId") String tenantId);

    /** 查询指定层级的节点列表（排序） */
    List<FaultCode> selectByLevelOrdered(@Param("level") Integer level, @Param("tenantId") String tenantId);
}
