package com.ams.mapper;

import com.ams.entity.LifecycleHistory;
import com.ams.entity.AssetStatusChangedEvent;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.One;
import org.apache.ibatis.annotations.SelectProvider;
import org.apache.ibatis.type.JdbcType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * LifecycleHistoryMapper - 资产生命周期历史记录 Mapper
 * 
 * <p>负责资产生命周期状态变更历史的持久化操作，支持以下功能：
 * <ul>
 *   <li>资产状态流转记录（运行中 → 待报废 → 已报废）</li>
 *   <li>报废申请生命周期追踪</li>
 *   <li>审批链状态变更历史</li>
 *   <li>历史数据查询与统计分析</li>
 * </ul>
 * 
 * <p><b>状态机流转规则：</b>
 * <ul>
 *   <li>RUNNING → PENDING_RETIREMENT（提交报废申请）</li>
 *   <li>PENDING_RETIREMENT → RUNNING（审批驳回）</li>
 *   <li>PENDING_RETIREMENT → RETIRED（审批通过）</li>
 * </ul>
 * 
 * @version 1.0.0
 * @since SWARM-002
 */
@Mapper
public interface LifecycleHistoryMapper extends BaseMapper<LifecycleHistory> {

    /**
     * 根据资产ID查询完整的生命周期历史记录
     * 
     * <p>按时间升序返回资产的所有状态变更记录，支持报废流程追溯</p>
     * 
     * @param assetId 资产ID
     * @return 按时间排序的生命周期历史列表
     */
    @Select("SELECT * FROM lifecycle_history WHERE asset_id = #{assetId} ORDER BY created_at ASC")
    List<LifecycleHistory> findByAssetIdOrderByCreatedAtAsc(@Param("assetId") Long assetId);

    /**
     * 根据资产ID查询最近的生命周期历史记录
     * 
     * <p>用于获取资产的当前状态</p>
     * 
     * @param assetId 资产ID
     * @return 最近的生命周期历史记录
     */
    @Select("SELECT * FROM lifecycle_history WHERE asset_id = #{assetId} ORDER BY created_at DESC LIMIT 1")
    Optional<LifecycleHistory> findLatestByAssetId(@Param("assetId") Long assetId);

    /**
     * 根据状态类型查询生命周期历史
     * 
     * <p>支持按状态类型筛选，用于统计特定状态下的资产变更历史</p>
     * 
     * @param toStatus 目标状态
     * @return 符合条件的历史记录列表
     */
    @Select("SELECT * FROM lifecycle_history WHERE to_status = #{toStatus} ORDER BY created_at DESC")
    List<LifecycleHistory> findByToStatus(@Param("toStatus") String toStatus);

    /**
     * 查询指定时间范围内的生命周期历史记录
     * 
     * <p>支持审计和报表统计</p>
     * 
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 时间范围内的历史记录
     */
    @Select("SELECT * FROM lifecycle_history WHERE created_at BETWEEN #{startTime} AND #{endTime} ORDER BY created_at DESC")
    List<LifecycleHistory> findByTimeRange(
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime
    );

    /**
     * 查询资产的报废流程历史
     * 
     * <p>专门用于查询与报废相关的生命周期变更，包括：
     * <ul>
     *   <li>提交报废申请时的状态变更</li>
     *   <li>审批过程中的状态变更</li>
     *   <li>最终报废或驳回的状态变更</li>
     * </ul>
     * 
     * @param assetId 资产ID
     * @param retirementStatuses 报废相关状态列表
     * @return 报废流程相关的历史记录
     */
    @Select("<script>" +
            "SELECT * FROM lifecycle_history " +
            "WHERE asset_id = #{assetId} " +
            "AND (to_status IN " +
            "<foreach item='status' collection='retirementStatuses' open='(' separator=',' close=')'>" +
            "#{status}" +
            "</foreach>" +
            " OR trigger_event LIKE '%RETIREMENT%' OR trigger_event LIKE '%retirement%') " +
            "ORDER BY created_at ASC" +
            "</script>")
    List<LifecycleHistory> findRetirementHistoryByAssetId(
        @Param("assetId") Long assetId,
        @Param("retirementStatuses") List<String> retirementStatuses
    );

    /**
     * 记录资产状态变更事件
     * 
     * <p>创建新的生命周期历史记录，用于追踪资产的所有状态变更</p>
     * 
     * @param history 生命周期历史实体
     * @return 影响的行数
     */
    @Insert("INSERT INTO lifecycle_history (id, asset_id, from_status, to_status, trigger_event, operator_id, request_id, comment, created_at) " +
            "VALUES (#{id}, #{assetId}, #{fromStatus}, #{toStatus}, #{triggerEvent}, #{operatorId}, #{requestId}, #{comment}, #{createdAt})")
    int insertLifecycleHistory(@Param("history") LifecycleHistory history);

    /**
     * 批量插入生命周期历史记录
     * 
     * <p>用于批量操作的审计追踪</p>
     * 
     * @param histories 生命周期历史列表
     * @return 影响的行数
     */
    @Insert("<script>" +
            "INSERT INTO lifecycle_history (id, asset_id, from_status, to_status, trigger_event, operator_id, request_id, comment, created_at) " +
            "VALUES " +
            "<foreach item='item' collection='histories' separator=','>" +
            "(#{item.id}, #{item.assetId}, #{item.fromStatus}, #{item.toStatus}, #{item.triggerEvent}, #{item.operatorId}, #{item.requestId}, #{item.comment}, #{item.createdAt})" +
            "</foreach>" +
            "</script>")
    int batchInsertLifecycleHistory(@Param("histories") List<LifecycleHistory> histories);

    /**
     * 更新生命周期历史的备注信息
     * 
     * <p>用于补充审批意见或修改备注</p>
     * 
     * @param id 历史记录ID
     * @param comment 新的备注信息
     * @return 影响的行数
     */
    @Update("UPDATE lifecycle_history SET comment = #{comment} WHERE id = #{id}")
    int updateComment(@Param("id") Long id, @Param("comment") String comment);

    /**
     * 根据请求ID查询生命周期历史
     * 
     * <p>用于关联报废申请与状态变更历史</p>
     * 
     * @param requestId 报废申请ID
     * @return 关联的周期历史记录列表
     */
    @Select("SELECT * FROM lifecycle_history WHERE request_id = #{requestId} ORDER BY created_at ASC")
    List<LifecycleHistory> findByRequestId(@Param("requestId") Long requestId);

    /**
     * 统计指定状态下的资产数量
     * 
     * <p>用于仪表盘统计</p>
     * 
     * @param status 资产状态
     * @return 处于该状态的资产变更记录数
     */
    @Select("SELECT COUNT(DISTINCT asset_id) FROM lifecycle_history WHERE to_status = #{status}")
    long countByToStatus(@Param("status") String status);

    /**
     * 删除指定资产的所有生命周期历史
     * 
     * <p>谨慎使用，仅在资产彻底删除时调用</p>
     * 
     * @param assetId 资产ID
     * @return 影响的行数
     */
    @Delete("DELETE FROM lifecycle_history WHERE asset_id = #{assetId}")
    int deleteByAssetId(@Param("assetId") Long assetId);

    /**
     * 查询操作员负责的资产状态变更历史
     * 
     * <p>用于统计操作员的工作量</p>
     * 
     * @param operatorId 操作员ID
     * @return 该操作员的历史记录
     */
    @Select("SELECT * FROM lifecycle_history WHERE operator_id = #{operatorId} ORDER BY created_at DESC")
    List<LifecycleHistory> findByOperatorId(@Param("operatorId") Long operatorId);

    /**
     * 根据触发事件类型查询历史
     * 
     * <p>支持按触发事件类型筛选，如 RETIREMENT_SUBMIT, RETIREMENT_APPROVE, RETIREMENT_REJECT</p>
     * 
     * @param triggerEvent 触发事件类型
     * @return 符合条件的历史记录
     */
    @Select("SELECT * FROM lifecycle_history WHERE trigger_event = #{triggerEvent} ORDER BY created_at DESC")
    List<LifecycleHistory> findByTriggerEvent(@Param("triggerEvent") String triggerEvent);

    /**
     * 检查资产是否存在有效的待审批报废申请
     * 
     * <p>用于防止重复提交报废申请</p>
     * 
     * @param assetId 资产ID
     * @param status 待审批状态
     * @return 是否存在待审批记录
     */
    @Select("SELECT COUNT(*) > 0 FROM lifecycle_history WHERE asset_id = #{assetId} AND to_status = #{status} AND created_at > NOW() - INTERVAL 24 HOUR")
    boolean existsPendingRetirementIn24Hours(@Param("assetId") Long assetId, @Param("status") String status);
}