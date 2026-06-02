package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.AssetModel;
import com.ams.mapper.AssetModelMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AssetModelService {

    private final AssetModelMapper assetModelMapper;

    public Page<AssetModel> getPage(Integer page, Integer pageSize, String keyword, Long categoryId, Long manufacturerId) {
        LambdaQueryWrapper<AssetModel> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like(AssetModel::getName, keyword)
                    .or().like(AssetModel::getModelNo, keyword));
        }
        if (categoryId != null) {
            wrapper.eq(AssetModel::getCategoryId, categoryId);
        }
        if (manufacturerId != null) {
            wrapper.eq(AssetModel::getManufacturerId, manufacturerId);
        }
        wrapper.orderByAsc(AssetModel::getName);
        return assetModelMapper.selectPage(new Page<>(page, pageSize), wrapper);
    }

    public List<AssetModel> getOptions() {
        return assetModelMapper.selectList(new LambdaQueryWrapper<AssetModel>()
                .eq(AssetModel::getStatus, 0)
                .select(AssetModel::getId, AssetModel::getName));
    }

    public AssetModel getById(Long id) {
        AssetModel model = assetModelMapper.selectById(id);
        if (model == null) throw new BusinessException("资产模型不存在");
        return model;
    }

    public AssetModel create(AssetModel model) {
        Long cnt = assetModelMapper.selectCount(new LambdaQueryWrapper<AssetModel>()
                .eq(AssetModel::getName, model.getName()));
        if (cnt > 0) throw new BusinessException("模型名称已存在: " + model.getName());
        assetModelMapper.insert(model);
        return model;
    }

    public AssetModel update(Long id, AssetModel model) {
        getById(id);
        Long cnt = assetModelMapper.selectCount(new LambdaQueryWrapper<AssetModel>()
                .eq(AssetModel::getName, model.getName())
                .ne(AssetModel::getId, id));
        if (cnt > 0) throw new BusinessException("模型名称已存在: " + model.getName());
        model.setId(id);
        assetModelMapper.updateById(model);
        return model;
    }

    public void delete(Long id) {
        getById(id);
        assetModelMapper.deleteById(id);
    }
}
