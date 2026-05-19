package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.AssetClearanceDTO;
import com.ams.dto.AssetScrapDTO;
import com.ams.dto.AssetTransferDTO;
import com.ams.entity.Asset;
import com.ams.entity.AssetChangeLog;
import com.ams.enums.AssetStatus;
import com.ams.mapper.AssetChangeLogMapper;
import com.ams.mapper.AssetMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

@Service
public class DisposalService {

    private static final List<String> DISPOSAL_TYPES = Arrays.asList("TRANSFER", "CLEARANCE", "SCRAP");
    private static final Set<AssetStatus> TRANSFERABLE_STATUSES = Set.of(
            AssetStatus.IDLE, AssetStatus.IN_USE, AssetStatus.MAINTENANCE
    );

    private final AssetLifecycleService assetLifecycleService;
    private final AssetChangeLogMapper assetChangeLogMapper;
    private final AssetMapper assetMapper;
    private final WorkflowDefinitionService workflowDefinitionService;

    public DisposalService(AssetLifecycleService assetLifecycleService,
                           AssetChangeLogMapper assetChangeLogMapper,
                           AssetMapper assetMapper,
                           WorkflowDefinitionService workflowDefinitionService) {
        this.assetLifecycleService = assetLifecycleService;
        this.assetChangeLogMapper = assetChangeLogMapper;
        this.assetMapper = assetMapper;
        this.workflowDefinitionService = workflowDefinitionService;
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset transferAsset(AssetTransferDTO dto) {
        workflowDefinitionService.requirePublishedDefinition("ASSET_TRANSFER");
        Asset asset = assetMapper.selectById(dto.getAssetId());
        if (asset != null) {
            AssetStatus current = AssetStatus.fromNameOrDefault(asset.getStatus(), AssetStatus.IDLE);
            if (!TRANSFERABLE_STATUSES.contains(current)) {
                throw new BusinessException("资产当前状态为" + current.name() + "，不允许转移。仅" + TRANSFERABLE_STATUSES + "状态的资产可转移");
            }
        }
        return assetLifecycleService.transitionAsset(dto.getAssetId(), AssetStatus.IN_USE, "TRANSFER", dto.getReason(), null,
                a -> {
                    a.setDeptId(dto.getTargetDeptId());
                    a.setUserId(dto.getTargetUserId());
                    a.setLocation(dto.getTargetLocation());
                });
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset clearAsset(AssetClearanceDTO dto) {
        workflowDefinitionService.requirePublishedDefinition("ASSET_CLEARANCE");
        return assetLifecycleService.transitionStatus(dto.getAssetId(), AssetStatus.CLEARED, "CLEARANCE", dto.getReason(), null);
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset scrapAsset(AssetScrapDTO dto) {
        workflowDefinitionService.requirePublishedDefinition("ASSET_SCRAP");
        return assetLifecycleService.transitionStatus(dto.getAssetId(), AssetStatus.SCRAPPED, "SCRAP", dto.getReason(), null);
    }

    public Page<AssetChangeLog> getDisposalHistory(Integer page, Integer pageSize, String changeType) {
        Page<AssetChangeLog> pager = new Page<>(page, pageSize);

        QueryWrapper<AssetChangeLog> wrapper = new QueryWrapper<>();
        if (changeType != null && !changeType.isBlank()) {
            if (!DISPOSAL_TYPES.contains(changeType)) {
                throw new BusinessException("仅支持查询TRANSFER/CLEARANCE/SCRAP类型");
            }
            wrapper.eq("change_type", changeType);
        } else {
            wrapper.in("change_type", DISPOSAL_TYPES);
        }

        wrapper.orderByDesc("create_time");
        return assetChangeLogMapper.selectPage(pager, wrapper);
    }
}
