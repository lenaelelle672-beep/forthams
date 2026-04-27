package com.ams.mapper;

import com.ams.entity.GeneralAuditEntry;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

/**
 * GeneralAuditEntry Mapper 接口
 * 
 * 对应 GeneralAuditEntry 实体，提供审计日志的持久化与查询能力。
 * 由 AuditAspect 切面拦截业务方法后，通过 AuditService 调用本 Mapper 完成审计记录写入。
 * 
 * @see GeneralAuditEntry
 * @see com.ams.service.AuditService
 */
@Mapper
public interface GeneralAuditEntryMapper extends BaseMapper<GeneralAuditEntry> {

    /**
     * 插入审计日志记录
     * 
     * @param entry 审计日志实体
     * @return 影响行数
     */
    int insert(GeneralAuditEntry entry);

    /**
     * 根据用户ID查询审计记录
     * 
     * @param userId 用户标识
     * @return 该用户的所有审计记录列表
     */
    @Select("SELECT * FROM general_audit_entry WHERE user_id = #{userId} ORDER BY timestamp DESC")
    List<GeneralAuditEntry> selectByUserId(@Param("userId") String userId);

    /**
     * 根据时间范围查询审计记录
     * 
     * @param start 开始时间（包含）
     * @param end   结束时间（包含）
     * @return 该时间范围内的审计记录列表
     */
    @Select("SELECT * FROM general_audit_entry WHERE timestamp >= #{start} AND timestamp <= #{end} ORDER BY timestamp DESC")
    List<GeneralAuditEntry> selectByTimeRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}