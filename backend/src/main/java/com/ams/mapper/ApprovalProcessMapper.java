package com.ams.mapper;

import com.ams.entity.ApprovalProcess;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ApprovalProcessMapper extends BaseMapper<ApprovalProcess> {

    @Select("SELECT * FROM approval_process ap WHERE ap.tenant_id = #{tenantId} AND ap.status = 'PENDING' AND NOT EXISTS (SELECT 1 FROM approval_record ar WHERE ar.process_id = ap.id AND ar.approver_id = #{approverId}) ORDER BY ap.create_time DESC")
    List<ApprovalProcess> selectPendingNotProcessed(@Param("tenantId") String tenantId, @Param("approverId") Long approverId, Page<?> page);
}
