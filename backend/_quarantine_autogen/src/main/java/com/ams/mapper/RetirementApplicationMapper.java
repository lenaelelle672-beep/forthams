package com.ams.mapper;

import com.ams.entity.RetirementApplication;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.One;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 资产报废退役申请 Mapper 接口
 * 
 * <p>职责：
 * <ul>
 *   <li>报废/退役申请单的数据库访问层</li>
 *   <li>审批链状态查询</li>
 *   <li>生命周期事件关联查询</li>
 *   <li>多级审批任务管理</li>
 * </ul>
 * 
 * <p>相关表：
 * <ul>
 *   <li>retirement_application - 报废申请主表</li>
 *   <li>approval_task - 审批任务表</li>
 *   <li>asset_lifecycle_event - 资产生命周期事件表</li>
 * </ul>
 * 
 * @see com.ams.entity.RetirementApplication
 * @see com.ams.service.RetirementService
 * @since SWARM-2026-Q2-002 Phase 3
 */
@Mapper
public interface RetirementApplicationMapper {

    /**
     * 插入报废申请记录
     * 
     * @param application 报废申请实体
     * @return 影响行数
     */
    @Insert("INSERT INTO retirement_application (" +
            "id, asset_id, application_type, reason, status, " +
            "applicant_id, current_approval_level, total_approval_levels, " +
            "version, created_at, updated_at" +
            ") VALUES (" +
            "#{id}, #{assetId}, #{applicationType}, #{reason}, #{status}, " +
            "#{applicantId}, #{currentApprovalLevel}, #{totalApprovalLevels}, " +
            "#{version}, #{createdAt}, #{updatedAt}" +
            ")")
    int insert(RetirementApplication application);

    /**
     * 更新报废申请记录
     * 
     * <p>使用乐观锁version字段防止并发更新</p>
     * 
     * @param application 报废申请实体
     * @return 影响行数，0表示版本冲突
     */
    @Update("<script>" +
            "UPDATE retirement_application SET " +
            "<if test='status != null'>status = #{status},</if>" +
            "<if test='currentApprovalLevel != null'>current_approval_level = #{currentApprovalLevel},</if>" +
            "version = version + 1, " +
            "updated_at = #{updatedAt} " +
            "WHERE id = #{id} AND version = #{version}" +
            "</script>")
    int updateWithOptimisticLock(RetirementApplication application);

    /**
     * 根据ID查询报废申请
     * 
     * @param id 申请ID
     * @return 报废申请实体
     */
    @Select("SELECT * FROM retirement_application WHERE id = #{id}")
    @Results({
        @Result(property = "id", column = "id"),
        @Result(property = "assetId", column = "asset_id"),
        @Result(property = "applicationType", column = "application_type"),
        @Result(property = "reason", column = "reason"),
        @Result(property = "status", column = "status"),
        @Result(property = "applicantId", column = "applicant_id"),
        @Result(property = "currentApprovalLevel", column = "current_approval_level"),
        @Result(property = "totalApprovalLevels", column = "total_approval_levels"),
        @Result(property = "version", column = "version"),
        @Result(property = "createdAt", column = "created_at"),
        @Result(property = "updatedAt", column = "updated_at")
    })
    Optional<RetirementApplication> selectById(@Param("id") Long id);

    /**
     * 根据资产ID查询有效申请
     * 
     * <p>用于检测重复申请（同一资产同一时间仅允许一条有效申请）</p>
     * 
     * @param assetId 资产ID
     * @param statuses 排除的状态列表（如已完成的申请）
     * @return 进行中的申请列表
     */
    @Select("<script>" +
            "SELECT * FROM retirement_application " +
            "WHERE asset_id = #{assetId} " +
            "<if test='statuses != null and statuses.size > 0'>" +
            "  AND status NOT IN " +
            "  <foreach collection='statuses' item='status' open='(' separator=',' close=')'>" +
            "    #{status}" +
            "  </foreach>" +
            "</if>" +
            "</script>")
    List<RetirementApplication> selectActiveByAssetId(@Param("assetId") Long assetId, 
                                                       @Param("statuses") List<String> statuses);

    /**
     * 查询用户提交的报废申请列表
     * 
     * @param applicantId 申请人ID
     * @param offset 偏移量
     * @param limit 每页数量
     * @return 申请列表
     */
    @Select("SELECT * FROM retirement_application " +
            "WHERE applicant_id = #{applicantId} " +
            "ORDER BY created_at DESC " +
            "LIMIT #{limit} OFFSET #{offset}")
    @Results({
        @Result(property = "id", column = "id"),
        @Result(property = "assetId", column = "asset_id"),
        @Result(property = "applicationType", column = "application_type"),
        @Result(property = "reason", column = "reason"),
        @Result(property = "status", column = "status"),
        @Result(property = "currentApprovalLevel", column = "current_approval_level"),
        @Result(property = "totalApprovalLevels", column = "total_approval_levels"),
        @Result(property = "createdAt", column = "created_at")
    })
    List<RetirementApplication> selectByApplicantId(@Param("applicantId") Long applicantId,
                                                    @Param("offset") int offset,
                                                    @Param("limit") int limit);

    /**
     * 根据状态查询报废申请
     * 
     * @param status 申请状态
     * @return 申请列表
     */
    @Select("SELECT * FROM retirement_application WHERE status = #{status}")
    List<RetirementApplication> selectByStatus(@Param("status") String status);

    /**
     * 查询待审批的申请（用于审批工作台）
     * 
     * @param approvalLevel 审批层级
     * @param statuses 待审批状态列表
     * @return 申请列表
     */
    @Select("<script>" +
            "SELECT * FROM retirement_application " +
            "WHERE current_approval_level = #{approvalLevel} " +
            "AND status IN " +
            "<foreach collection='statuses' item='status' open='(' separator=',' close=')'>" +
            "  #{status}" +
            "</foreach>" +
            "ORDER BY created_at ASC" +
            "</script>")
    List<RetirementApplication> selectPendingApprovalByLevel(@Param("approvalLevel") int approvalLevel,
                                                            @Param("statuses") List<String> statuses);

    /**
     * 查询资产的生命周期事件
     * 
     * <p>用于查看完整的资产生命周期历史记录与状态流转</p>
     * 
     * @param assetId 资产ID
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 生命周期事件列表
     */
    @Select("<script>" +
            "SELECT le.* FROM asset_lifecycle_event le " +
            "INNER JOIN retirement_application ra ON le.reference_id = ra.id " +
            "WHERE ra.asset_id = #{assetId} " +
            "<if test='startTime != null'>" +
            "  AND le.event_time >= #{startTime}" +
            "</if>" +
            "<if test='endTime != null'>" +
            "  AND le.event_time &lt;= #{endTime}" +
            "</if>" +
            "ORDER BY le.event_time ASC" +
            "</script>")
    List<Object> selectLifecycleEventsByAssetId(@Param("assetId") Long assetId,
                                                @Param("startTime") LocalDateTime startTime,
                                                @Param("endTime") LocalDateTime endTime);

    /**
     * 批量更新审批层级（推进审批链）
     * 
     * <p>当某级审批通过后，将current_approval_level + 1，激活下一级审批</p>
     * 
     * @param ids 申请ID列表
     * @param nextLevel 下一审批层级
     * @param newStatus 新状态
     * @param version 当前版本（乐观锁）
     * @param updatedAt 更新时间
     * @return 影响行数
     */
    @Update("<script>" +
            "UPDATE retirement_application SET " +
            "current_approval_level = #{nextLevel}, " +
            "status = #{newStatus}, " +
            "version = version + 1, " +
            "updated_at = #{updatedAt} " +
            "WHERE id IN " +
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>" +
            "  #{id}" +
            "</foreach>" +
            "AND version = #{version}" +
            "</script>")
    int batchAdvanceApprovalLevel(@Param("ids") List<Long> ids,
                                   @Param("nextLevel") int nextLevel,
                                   @Param("newStatus") String newStatus,
                                   @Param("version") int version,
                                   @Param("updatedAt") LocalDateTime updatedAt);

    /**
     * 统计各状态的申请数量
     * 
     * @return 状态-数量映射列表
     */
    @Select("SELECT status, COUNT(*) as count FROM retirement_application GROUP BY status")
    List<Object> countByStatusGroup();

    /**
     * 根据申请类型查询
     * 
     * @param applicationType 申请类型（SCRAP/RETIREMENT）
     * @param status 状态（可选）
     * @return 申请列表
     */
    @Select("<script>" +
            "SELECT * FROM retirement_application " +
            "WHERE application_type = #{applicationType} " +
            "<if test='status != null'>" +
            "  AND status = #{status}" +
            "</if>" +
            "ORDER BY created_at DESC" +
            "</script>")
    List<RetirementApplication> selectByApplicationType(@Param("applicationType") String applicationType,
                                                        @Param("status") String status);

    /**
     * 删除报废申请（仅允许特定状态删除）
     * 
     * <p>审批中的申请不允许删除</p>
     * 
     * @param id 申请ID
     * @param allowedStatuses 允许删除的状态列表
     * @return 影响行数
     */
    @Delete("<script>" +
            "DELETE FROM retirement_application " +
            "WHERE id = #{id} " +
            "<if test='allowedStatuses != null and allowedStatuses.size > 0'>" +
            "  AND status IN " +
            "  <foreach collection='allowedStatuses' item='status' open='(' separator=',' close=')'>" +
            "    #{status}" +
            "  </foreach>" +
            "</if>" +
            "</script>")
    int deleteWithStatusCheck(@Param("id") Long id, @Param("allowedStatuses") List<String> allowedStatuses);

    /**
     * 检查资产是否有进行中的报废申请
     * 
     * <p>用于判断资产是否被锁定</p>
     * 
     * @param assetId 资产ID
     * @param lockStatuses 锁定状态列表
     * @return 是否有进行中的申请
     */
    @Select("<script>" +
            "SELECT COUNT(*) > 0 FROM retirement_application " +
            "WHERE asset_id = #{assetId} " +
            "<if test='lockStatuses != null and lockStatuses.size > 0'>" +
            "  AND status IN " +
            "  <foreach collection='lockStatuses' item='status' open='(' separator=',' close=')'>" +
            "    #{status}" +
            "  </foreach>" +
            "</if>" +
            "</script>")
    boolean existsActiveApplication(@Param("assetId") Long assetId, @Param("lockStatuses") List<String> lockStatuses);

    /**
     * 查询超时未审批的申请
     * 
     * <p>审批任务72小时未处理触发催办</p>
     * 
     * @param thresholdHours 超时阈值（小时）
     * @param statuses 待审批状态
     * @return 超时申请列表
     */
    @Select("<script>" +
            "SELECT * FROM retirement_application " +
            "WHERE status IN " +
            "<foreach collection='statuses' item='status' open='(' separator=',' close=')'>" +
            "  #{status}" +
            "</foreach>" +
            "AND TIMESTAMPDIFF(HOUR, updated_at, NOW()) >= #{thresholdHours} " +
            "ORDER BY updated_at ASC" +
            "</script>")
    List<RetirementApplication> selectTimeoutApplications(@Param("thresholdHours") int thresholdHours,
                                                         @Param("statuses") List<String> statuses);

    /**
     * 查询审批历史（用于生命周期追溯）
     * 
     * @param applicationId 申请ID
     * @return 审批记录列表
     */
    @Select("SELECT ar.* FROM approval_record ar " +
            "WHERE ar.reference_id = #{applicationId} " +
            "AND ar.reference_type = 'RETIREMENT_APPLICATION' " +
            "ORDER BY ar.action_time ASC")
    List<Object> selectApprovalHistory(@Param("applicationId") Long applicationId);
}