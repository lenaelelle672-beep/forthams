package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.dto.AssetCreateDTO;
import com.ams.dto.AssetQueryDTO;
import com.ams.dto.AssetUpdateDTO;
import com.ams.entity.Asset;
import com.ams.mapper.AssetMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AssetService {

    private final AssetMapper assetMapper;

    public Page<Asset> queryAssets(AssetQueryDTO queryDTO) {
        Page<Asset> page = new Page<>(queryDTO.getPage(), queryDTO.getPageSize());

        LambdaQueryWrapper<Asset> wrapper = new LambdaQueryWrapper<>();
        
        if (queryDTO.getAssetNo() != null && !queryDTO.getAssetNo().isEmpty()) {
            wrapper.like(Asset::getAssetNo, queryDTO.getAssetNo());
        }
        if (queryDTO.getAssetName() != null && !queryDTO.getAssetName().isEmpty()) {
            wrapper.like(Asset::getAssetName, queryDTO.getAssetName());
        }
        if (queryDTO.getCategoryId() != null) {
            wrapper.eq(Asset::getCategoryId, queryDTO.getCategoryId());
        }
        if (queryDTO.getStatus() != null && !queryDTO.getStatus().isEmpty()) {
            wrapper.eq(Asset::getStatus, queryDTO.getStatus());
        }
        if (queryDTO.getDeptId() != null) {
            wrapper.eq(Asset::getDeptId, queryDTO.getDeptId());
        }
        if (queryDTO.getIsImportant() != null) {
            wrapper.eq(Asset::getIsImportant, queryDTO.getIsImportant());
        }

        wrapper.orderByDesc(Asset::getCreateTime);

        return assetMapper.selectPage(page, wrapper);
    }

    public Asset getAssetById(Long id) {
        Asset asset = assetMapper.selectById(id);
        if (asset == null) {
            throw new BusinessException("资产不存在");
        }
        return asset;
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset createAsset(AssetCreateDTO createDTO) {
        Asset existingAsset = assetMapper.selectOne(
            new LambdaQueryWrapper<Asset>().eq(Asset::getAssetNo, createDTO.getAssetNo())
        );

        if (existingAsset != null) {
            throw new BusinessException("资产编号已存在");
        }

        Asset asset = new Asset();
        BeanUtil.copyProperties(createDTO, asset);

        assetMapper.insert(asset);
        return asset;
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset updateAsset(Long id, AssetUpdateDTO updateDTO) {
        Asset asset = getAssetById(id);

        BeanUtil.copyProperties(updateDTO, asset, "id", "assetNo", "createBy", "createTime");

        assetMapper.updateById(asset);
        return asset;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteAsset(Long id) {
        Asset asset = getAssetById(id);
        assetMapper.deleteById(id);
    }

}
