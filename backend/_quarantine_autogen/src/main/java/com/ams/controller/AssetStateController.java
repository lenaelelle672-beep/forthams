package com.ams.controller;

import com.ams.common.Result;
import com.ams.state.AssetState;
import com.ams.state.AssetStateMachine;
import com.ams.state.StateTransitionException;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

/**
 * 资产状态流转控制器
 * 提供资产状态查询与状态变更接口
 */
@RestController
@RequestMapping("/api/assets")
@Api(tags = "资产状态管理")
public class AssetStateController {

    @Autowired
    private AssetStateMachine assetStateMachine;

    /**
     * 查询资产当前状态
     * @param assetId 资产ID
     * @return 当前状态
     */
    @GetMapping("/{assetId}/state")
    @ApiOperation("查询资产当前状态")
    public Result<AssetState> getCurrentState(@PathVariable String assetId) {
        AssetState current = assetStateMachine.getCurrentState(assetId);
        return Result.success(current);
    }

    /**
     * 发起状态变更申请
     * @param assetId 资产ID
     * @param targetState 目标状态
     * @return 变更结果
     */
    @PostMapping("/{assetId}/transition")
    @ApiOperation("状态变更")
    public Result<Boolean> transition(@PathVariable String assetId,
                                      @RequestParam AssetState targetState) {
        try {
            boolean success = assetStateMachine.transition(assetId, targetState);
            return Result.success(success);
        } catch (StateTransitionException e) {
            return Result.failure(e.getMessage());
        }
    }

    /**
     * 获取支持的状态枚举列表
     * @return 所有资产状态
     */
    @GetMapping("/states")
    @ApiOperation("获取所有支持的资产状态")
    public Result<AssetState[]> supportedStates() {
        return Result.success(AssetState.values());
    }
}