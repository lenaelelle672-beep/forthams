package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.common.exception.StateTransitionException;
import com.ams.entity.Asset;
import com.ams.entity.AssetStatusChangedEvent;
import com.ams.entity.AssetStatusHistory;
import com.ams.event.EventPublisher;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.AssetStatusHistoryMapper;
import com.ams.state.AssetState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * 资产状态流转引擎服务
 *
 * <p>Phase 1 核心职责：
 * <ul>
 *   <li>定义并维护资产状态枚举及合法流转规则</li>
 *   <li>执行状态变更业务逻辑，包含前置校验</li>
 *   <li>提供资产当前状态查询接口</li>
 *   <li>状态变更成功后发布领域事件</li>
 * </ul>
 *
 * <p>支持的状态流转路径：
 * <pre>
 *   正常使用 (IN_USE) → 待报废 (PENDING_RETIREMENT)
 *   待报废 (PENDING_RETIREMENT) → 已报废 (RETIRED)
 *   已报废 (RETIRED) → 已处置 (DISPOSED)
 * </pre>
 *
 * @author AMS
 * @since Phase 1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AssetStateService {

    /** 合法的状态流转规则表：key 为当前状态，value 为允许变更的目标状态集合 */
    private static final Map<AssetState, List<AssetState>> TRANSITION_RULES;

    static {
        Map<AssetState, List<AssetState>> rules = new EnumMap<>(AssetState.class);
        rules.put(AssetState.IN_USE,              Collections.singletonList(AssetState.PENDING_RETIREMENT));
        rules.put(AssetState.PENDING_RETIREMENT,  Collections.singletonList(AssetState.RETIRED));
        rules.put(AssetState.RETIRED,             Collections.singletonList(AssetState.DISPOSED));
        rules.put(AssetState.DISPOSED,            Collections.emptyList());
        TRANSITION_RULES = Collections.unmodifiableMap(rules);
    }

    private final AssetMapper assetMapper;
    private final AssetStatusHistoryMapper assetStatusHistoryMapper;
    private final EventPublisher eventPublisher;

    // -------------------------------------------------------------------------
    // 状态枚举查询
    // -------------------------------------------------------------------------

    /**
     * 返回系统支持的全部资产状态枚举列表。
     *
     * @return 包含所有 {@link AssetState} 枚举值的不可变列表，顺序固定为：
     *         IN_USE → PENDING_RETIREMENT → RETIRED → DISPOSED
     */
    public List<AssetState> getAllStates() {
        return Collections.unmodifiableList(
                Arrays.asList(
                        AssetState.IN_USE,
                        AssetState.PENDING_RETIREMENT,
                        AssetState.RETIRED,
                        AssetState.DISPOSED
                )
        );
    }

    /**
     * 查询指定资产的当前状态。
     *
     * @param assetId 资产主键 ID，不可为 null
     * @return 资产当前 {@link AssetState}
     * @throws BusinessException 当资产不存在时抛出，错误码 ASSET_NOT_FOUND
     */
    public AssetState getAssetState(Long assetId) {
        Asset asset = requireAsset(assetId);
        return parseState(asset.getStatus());
    }

    /**
     * 查询指定状态下所有合法的目标状态列表。
     *
     * @param fromState 当前状态，不可为 null
     * @return 允许流转的目标状态集合；若当前状态为终态则返回空列表
     */
    public List<AssetState> getAllowedTransitions(AssetState fromState) {
        if (fromState == null) {
            throw new BusinessException("INVALID_STATE", "fromState 不能为空");
        }
        return TRANSITION_RULES.getOrDefault(fromState, Collections.emptyList());
    }

    // -------------------------------------------------------------------------
    // 状态流转校验
    // -------------------------------------------------------------------------

    /**
     * 校验从 {@code fromState} 到 {@code toState} 的流转是否合法。
     *
     * @param fromState 当前状态
     * @param toState   目标状态
     * @return {@code true} 表示流转合法；{@code false} 表示非法
     */
    public boolean isTransitionAllowed(AssetState fromState, AssetState toState) {
        if (fromState == null || toState == null) {
            return false;
        }
        List<AssetState> allowed = TRANSITION_RULES.getOrDefault(fromState, Collections.emptyList());
        return allowed.contains(toState);
    }

    /**
     * 强校验状态流转合法性，不合法时直接抛出异常。
     *
     * @param fromState 当前状态
     * @param toState   目标状态
     * @throws StateTransitionException 当流转路径不在合法规则表中时抛出
     */
    public void assertTransitionAllowed(AssetState fromState, AssetState toState) {
        if (!isTransitionAllowed(fromState, toState)) {
            String message = String.format(
                    "非法状态流转：不允许从 [%s] 变更为 [%s]，合法目标状态为 %s",
                    fromState, toState,
                    TRANSITION_RULES.getOrDefault(fromState, Collections.emptyList())
            );
            log.warn("[AssetStateService] {}", message);
            throw new StateTransitionException(message);
        }
    }

    // -------------------------------------------------------------------------
    // 状态变更核心方法
    // -------------------------------------------------------------------------

    /**
     * 执行资产状态变更。
     *
     * <p>执行顺序：
     * <ol>
     *   <li>查询资产并获取当前状态</li>
     *   <li>校验目标状态是否在合法流转规则内</li>
     *   <li>更新资产状态字段并持久化</li>
     *   <li>写入状态变更历史记录</li>
     *   <li>发布 {@link AssetStatusChangedEvent} 领域事件</li>
     * </ol>
     *
     * @param assetId  资产主键 ID
     * @param toState  目标状态
     * @param operator 操作人标识（用户名或 ID 字符串）
     * @param remark   变更备注，可为空
     * @throws BusinessException        当资产不存在时抛出
     * @throws StateTransitionException 当目标状态流转非法时抛出
     */
    @Transactional(rollbackFor = Exception.class)
    public void changeState(Long assetId, AssetState toState, String operator, String remark) {
        // 1. 查询资产
        Asset asset = requireAsset(assetId);
        AssetState fromState = parseState(asset.getStatus());

        log.info("[AssetStateService] 资产 [{}] 状态变更请求：{} → {}，操作人：{}",
                assetId, fromState, toState, operator);

        // 2. 校验流转合法性
        assertTransitionAllowed(fromState, toState);

        // 3. 更新资产状态
        asset.setStatus(toState.name());
        asset.setUpdateTime(LocalDateTime.now());
        assetMapper.updateById(asset);

        // 4. 记录变更历史（Phase 3 将全量持久化；此处保留基础写入）
        recordStatusHistory(assetId, fromState, toState, operator, remark);

        // 5. 发布领域事件
        publishStateChangedEvent(assetId, fromState, toState, operator);

        log.info("[AssetStateService] 资产 [{}] 状态已从 {} 变更为 {}",
                assetId, fromState, toState);
    }

    /**
     * 发起资产报废申请（快捷入口）：将资产从"正常使用"变更为"待报废"。
     *
     * @param assetId  资产主键 ID
     * @param operator 申请人
     * @param remark   报废原因说明
     */
    @Transactional(rollbackFor = Exception.class)
    public void applyForRetirement(Long assetId, String operator, String remark) {
        changeState(assetId, AssetState.PENDING_RETIREMENT, operator, remark);
    }

    /**
     * 确认报废（快捷入口）：将资产从"待报废"变更为"已报废"。
     *
     * @param assetId  资产主键 ID
     * @param operator 审批人或系统标识
     * @param remark   审批备注
     */
    @Transactional(rollbackFor = Exception.class)
    public void confirmRetirement(Long assetId, String operator, String remark) {
        changeState(assetId, AssetState.RETIRED, operator, remark);
    }

    /**
     * 标记资产已处置（快捷入口）：将资产从"已报废"变更为"已处置"。
     *
     * @param assetId  资产主键 ID
     * @param operator 操作人
     * @param remark   处置备注
     */
    @Transactional(rollbackFor = Exception.class)
    public void markDisposed(Long assetId, String operator, String remark) {
        changeState(assetId, AssetState.DISPOSED, operator, remark);
    }

    // -------------------------------------------------------------------------
    // 私有辅助方法
    // -------------------------------------------------------------------------

    /**
     * 根据资产 ID 查询资产实体，不存在则抛出业务异常。
     *
     * @param assetId 资产主键 ID
     * @return 查询到的 {@link Asset} 实体
     * @throws BusinessException 当资产不存在时抛出，错误码 ASSET_NOT_FOUND
     */
    private Asset requireAsset(Long assetId) {
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null) {
            throw new BusinessException("ASSET_NOT_FOUND",
                    "资产不存在，ID：" + assetId);
        }
        return asset;
    }

    /**
     * 将字符串状态值解析为 {@link AssetState} 枚举。
     *
     * @param statusStr 资产状态字符串
     * @return 对应的 {@link AssetState}
     * @throws BusinessException 当状态值无法识别时抛出，错误码 INVALID_ASSET_STATE
     */
    private AssetState parseState(String statusStr) {
        try {
            return AssetState.valueOf(statusStr);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new BusinessException("INVALID_ASSET_STATE",
                    "无法识别的资产状态值：" + statusStr);
        }
    }

    /**
     * 将状态变更记录写入历史表。
     *
     * @param assetId   资产主键 ID
     * @param fromState 变更前状态
     * @param toState   变更后状态
     * @param operator  操作人
     * @param remark    备注
     */
    private void recordStatusHistory(Long assetId,
                                     AssetState fromState,
                                     AssetState toState,
                                     String operator,
                                     String remark) {
        try {
            AssetStatusHistory history = new AssetStatusHistory();
            history.setAssetId(assetId);
            history.setFromStatus(fromState.name());
            history.setToStatus(toState.name());
            history.setOperator(operator);
            history.setRemark(remark);
            history.setChangedAt(LocalDateTime.now());
            assetStatusHistoryMapper.insert(history);
        } catch (Exception e) {
            // 历史记录写入失败不应阻断主流程，记录日志后继续
            log.error("[AssetStateService] 状态历史记录写入失败，资产 ID：{}，原因：{}",
                    assetId, e.getMessage(), e);
        }
    }

    /**
     * 构造并发布资产状态变更领域事件。
     *
     * @param assetId   资产主键 ID
     * @param fromState 变更前状态
     * @param toState   变更后状态
     * @param operator  操作人
     */
    private void publishStateChangedEvent(Long assetId,
                                          AssetState fromState,
                                          AssetState toState,
                                          String operator) {
        try {
            AssetStatusChangedEvent event = new AssetStatusChangedEvent();
            event.setAssetId(assetId);
            event.setFromStatus(fromState.name());
            event.setToStatus(toState.name());
            event.setOperator(operator);
            event.setOccurredAt(LocalDateTime.now());
            eventPublisher.publish(event);
            log.debug("[AssetStateService] 已发布状态变更事件，资产 ID：{}，事件：{}→{}",
                    assetId, fromState, toState);
        } catch (Exception e) {
            // 事件发布失败不回滚事务，仅记录告警日志
            log.error("[AssetStateService] 状态变更事件发布失败，资产 ID：{}，原因：{}",
                    assetId, e.getMessage(), e);
        }
    }
}