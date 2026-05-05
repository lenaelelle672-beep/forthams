package com.ams.mapper;

import com.ams.entity.AssetStatusChangedEvent;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.One;
import org.apache.ibatis.mapping.StatementType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * AssetStatusHistoryMapper - 资产状态变更历史 Mapper
 * 
 * 功能说明：
 * - 提供资产状态变更历史记录的数据库访问能力
 * - 支持历史记录的插入、查询、分页等操作
 * - 对应 AssetStatusHistory 表
 * 
 * @author AMS Team
 * @version 1.0
 */
@Mapper
public interface AssetStatusHistoryMapper {

    /**
     * 插入资产状态变更历史记录
     * 
     * @param event 状态变更事件实体
     * @return 影响的行数
     */
    @Insert("INSERT INTO asset_status_history (id, asset_id, type, from_status, to_status, operator_id, operated_at, extra_data) " +
            "VALUES (#{id}, #{assetId}, #{type}, #{fromStatus}, #{toStatus}, #{operatorId}, #{operatedAt}, #{extraData})")
    @Options(useGeneratedKeys = false)
    int insertStatusHistory(@Param("event") AssetStatusChangedEvent event);

    /**
     * 根据资产ID查询状态变更历史记录（支持分页）
     * 
     * @param assetId 资产ID
     * @param startTime 开始时间（可选）
     * @param endTime 结束时间（可选）
     * @param offset 偏移量
     * @param limit 每页数量
     * @return 历史记录列表
     */
    @Select("<script>" +
            "SELECT * FROM asset_status_history WHERE asset_id = #{assetId} " +
            "<if test='startTime != null'> AND operated_at &gt;= #{startTime} </if>" +
            "<if test='endTime != null'> AND operated_at &lt;= #{endTime} </if>" +
            "ORDER BY operated_at DESC LIMIT #{limit} OFFSET #{offset}" +
            "</script>")
    @Results({
        @Result(property = "id", column = "id"),
        @Result(property = "assetId", column = "asset_id"),
        @Result(property = "type", column = "type"),
        @Result(property = "fromStatus", column = "from_status"),
        @Result(property = "toStatus", column = "to_status"),
        @Result(property = "operatorId", column = "operator_id"),
        @Result(property = "operatedAt", column = "operated_at"),
        @Result(property = "extraData", column = "extra_data")
    })
    List<AssetStatusChangedEvent> findByAssetIdWithPagination(
            @Param("assetId") UUID assetId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("offset") int offset,
            @Param("limit") int limit);

    /**
     * 根据资产ID查询所有状态变更历史记录
     * 
     * @param assetId 资产ID
     * @return 历史记录列表
     */
    @Select("SELECT * FROM asset_status_history WHERE asset_id = #{assetId} ORDER BY operated_at DESC")
    @Results({
        @Result(property = "id", column = "id"),
        @Result(property = "assetId", column = "asset_id"),
        @Result(property = "type", column = "type"),
        @Result(property = "fromStatus", column = "from_status"),
        @Result(property = "toStatus", column = "to_status"),
        @Result(property = "operatorId", column = "operator_id"),
        @Result(property = "operatedAt", column = "operated_at"),
        @Result(property = "extraData", column = "extra_data")
    })
    List<AssetStatusChangedEvent> findByAssetId(@Param("assetId") UUID assetId);

    /**
     * 统计指定资产的状态变更历史记录总数
     * 
     * @param assetId 资产ID
     * @param startTime 开始时间（可选）
     * @param endTime 结束时间（可选）
     * @return 记录总数
     */
    @Select("<script>" +
            "SELECT COUNT(*) FROM asset_status_history WHERE asset_id = #{assetId} " +
            "<if test='startTime != null'> AND operated_at &gt;= #{startTime} </if>" +
            "<if test='endTime != null'> AND operated_at &lt;= #{endTime} </if>" +
            "</script>")
    int countByAssetId(
            @Param("assetId") UUID assetId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime);

    /**
     * 根据ID查询单条状态变更历史记录
     * 
     * @param id 记录ID
     * @return 历史记录
     */
    @Select("SELECT * FROM asset_status_history WHERE id = #{id}")
    @Results({
        @Result(property = "id", column = "id"),
        @Result(property = "assetId", column = "asset_id"),
        @Result(property = "type", column = "type"),
        @Result(property = "fromStatus", column = "from_status"),
        @Result(property = "toStatus", column = "to_status"),
        @Result(property = "operatorId", column = "operator_id"),
        @Result(property = "operatedAt", column = "operated_at"),
        @Result(property = "extraData", column = "extra_data")
    })
    AssetStatusChangedEvent findById(@Param("id") UUID id);

    /**
     * 根据变更类型查询历史记录
     * 
     * @param assetId 资产ID
     * @param type 变更类型
     * @return 历史记录列表
     */
    @Select("SELECT * FROM asset_status_history WHERE asset_id = #{assetId} AND type = #{type} ORDER BY operated_at DESC")
    @Results({
        @Result(property = "id", column = "id"),
        @Result(property = "assetId", column = "asset_id"),
        @Result(property = "type", column = "type"),
        @Result(property = "fromStatus", column = "from_status"),
        @Result(property = "toStatus", column = "to_status"),
        @Result(property = "operatorId", column = "operator_id"),
        @Result(property = "operatedAt", column = "operated_at"),
        @Result(property = "extraData", column = "extra_data")
    })
    List<AssetStatusChangedEvent> findByAssetIdAndType(
            @Param("assetId") UUID assetId,
            @Param("type") String type);

    /**
     * 查询最近的状态变更历史
     * 
     * @param assetId 资产ID
     * @param limit 返回记录数
     * @return 历史记录列表
     */
    @Select("SELECT * FROM asset_status_history WHERE asset_id = #{assetId} ORDER BY operated_at DESC LIMIT #{limit}")
    @Results({
        @Result(property = "id", column = "id"),
        @Result(property = "assetId", column = "asset_id"),
        @Result(property = "type", column = "type"),
        @Result(property = "fromStatus", column = "from_status"),
        @Result(property = "toStatus", column = "to_status"),
        @Result(property = "operatorId", column = "operator_id"),
        @Result(property = "operatedAt", column = "operated_at"),
        @Result(property = "extraData", column = "extra_data")
    })
    List<AssetStatusChangedEvent> findRecentByAssetId(
            @Param("assetId") UUID assetId,
            @Param("limit") int limit);

    /**
     * 批量插入状态变更历史记录
     * 
     * @param events 状态变更事件列表
     * @return 影响的行数
     */
    @Insert("<script>" +
            "INSERT INTO asset_status_history (id, asset_id, type, from_status, to_status, operator_id, operated_at, extra_data) " +
            "VALUES " +
            "<foreach collection='events' item='event' separator=','>" +
            "(#{event.id}, #{event.assetId}, #{event.type}, #{event.fromStatus}, #{event.toStatus}, #{event.operatorId}, #{event.operatedAt}, #{event.extraData})" +
            "</foreach>" +
            "</script>")
    @Options(useGeneratedKeys = false)
    int batchInsertStatusHistory(@Param("events") List<AssetStatusChangedEvent> events);

    /**
     * 删除指定资产的所有状态变更历史记录
     * 
     * @param assetId 资产ID
     * @return 影响的行数
     */
    @Delete("DELETE FROM asset_status_history WHERE asset_id = #{assetId}")
    int deleteByAssetId(@Param("assetId") UUID assetId);
}