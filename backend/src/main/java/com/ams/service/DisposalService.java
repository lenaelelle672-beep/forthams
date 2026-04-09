package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.convert.Convert;
import com.ams.common.exception.BusinessException;
import com.ams.dto.AssetClearanceDTO;
import com.ams.dto.AssetScrapDTO;
import com.ams.dto.AssetTransferDTO;
import com.ams.entity.Asset;
import com.ams.entity.AssetChangeLog;
import com.ams.mapper.AssetChangeLogMapper;
import com.ams.mapper.AssetMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

@Service
public class DisposalService {

    private static final List<String> DISPOSAL_TYPES = Arrays.asList("TRANSFER", "CLEARANCE", "SCRAP");

    private final AssetMapper assetMapper;
    private final AssetChangeLogMapper assetChangeLogMapper;

    public DisposalService(AssetMapper assetMapper, AssetChangeLogMapper assetChangeLogMapper) {
        this.assetMapper = assetMapper;
        this.assetChangeLogMapper = assetChangeLogMapper;
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset transferAsset(AssetTransferDTO dto) {
        Asset asset = getAssetOrThrow(getLongProp(dto, "assetId"));

        String oldValue = buildAssetSnapshot(asset);
        BeanUtil.setProperty(asset, "deptId", getLongProp(dto, "targetDeptId"));
        BeanUtil.setProperty(asset, "userId", getLongProp(dto, "targetUserId"));
        BeanUtil.setProperty(asset, "location", getStrProp(dto, "targetLocation"));
        BeanUtil.setProperty(asset, "status", "IN_USE");
        assetMapper.updateById(asset);

        createChangeLog(getLongProp(asset, "id"), "TRANSFER", oldValue, buildAssetSnapshot(asset), getStrProp(dto, "reason"));
        return asset;
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset clearAsset(AssetClearanceDTO dto) {
        Asset asset = getAssetOrThrow(getLongProp(dto, "assetId"));

        String oldValue = buildAssetSnapshot(asset);
        BeanUtil.setProperty(asset, "status", "CLEARED");
        assetMapper.updateById(asset);

        createChangeLog(getLongProp(asset, "id"), "CLEARANCE", oldValue, buildAssetSnapshot(asset), getStrProp(dto, "reason"));
        return asset;
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset scrapAsset(AssetScrapDTO dto) {
        Asset asset = getAssetOrThrow(getLongProp(dto, "assetId"));

        String oldValue = buildAssetSnapshot(asset);
        BeanUtil.setProperty(asset, "status", "SCRAPPED");
        assetMapper.updateById(asset);

        createChangeLog(getLongProp(asset, "id"), "SCRAP", oldValue, buildAssetSnapshot(asset), getStrProp(dto, "reason"));
        return asset;
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

    private Asset getAssetOrThrow(Long assetId) {
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null) {
            throw new BusinessException("资产不存在");
        }
        return asset;
    }

    private void createChangeLog(Long assetId, String changeType, String oldValue, String newValue, String reason) {
        AssetChangeLog changeLog = new AssetChangeLog();
        BeanUtil.setProperty(changeLog, "assetId", assetId);
        BeanUtil.setProperty(changeLog, "changeType", changeType);
        BeanUtil.setProperty(changeLog, "oldValue", oldValue);
        BeanUtil.setProperty(changeLog, "newValue", newValue);
        BeanUtil.setProperty(changeLog, "reason", reason);
        assetChangeLogMapper.insert(changeLog);
    }

    private String buildAssetSnapshot(Asset asset) {
        return String.format("deptId=%s,userId=%s,location=%s,status=%s",
            getLongProp(asset, "deptId"), getLongProp(asset, "userId"), getStrProp(asset, "location"), getStrProp(asset, "status"));
    }

    private Long getLongProp(Object bean, String fieldName) {
        return Convert.toLong(BeanUtil.getProperty(bean, fieldName));
    }

    private String getStrProp(Object bean, String fieldName) {
        return Convert.toStr(BeanUtil.getProperty(bean, fieldName));
    }
}
